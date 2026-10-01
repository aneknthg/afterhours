/**
 * admin-payouts/index.ts — Supabase Edge Function
 *
 * The money view for whoever runs Afterhours: what has been sold, what has been
 * refunded, and who is owed what. Also the one place that marks a host paid.
 *
 * WHY A FUNCTION AND NOT RLS: the obvious alternative is a profiles.is_admin
 * column plus admin-read policies on payment_orders and host_earnings. That is
 * a trap. Profile editing already lets a user update her own profiles row, so
 * unless is_admin were separately guarded, anyone could grant themselves admin
 * over the REST API and read every order in the system. It also widens the RLS
 * surface on payment tables permanently. Here the service role never leaves the
 * server, the allowlist lives in an env var no user can write, and the browser
 * page is a dumb renderer with no privileged access of its own.
 *
 * AUTH: two gates. The gateway verifies the JWT (verify_jwt defaults to true —
 * do NOT add this function to config.toml), and then the caller's email is
 * checked against ADMIN_EMAILS. Failing the second returns 403 with no data.
 *
 *   supabase secrets set ADMIN_EMAILS='you@example.com,someone@example.com'
 *
 * MONEY IS ALWAYS INTEGER PAISE. No floats anywhere in this file.
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // ── Gate ───────────────────────────────────────────────────────────────────
  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace('Bearer ', '').trim();
  if (!token) return json({ error: 'not_authenticated' }, 401);

  const { data: { user }, error: authErr } = await admin.auth.getUser(token);
  if (authErr || !user) return json({ error: 'not_authenticated' }, 401);

  const allowed = (Deno.env.get('ADMIN_EMAILS') ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (!allowed.length) {
    // Fail closed. An unset allowlist must not mean "everyone".
    console.error('[admin-payouts] ADMIN_EMAILS is not set — refusing all access');
    return json({ error: 'not_configured' }, 500);
  }
  if (!allowed.includes((user.email ?? '').toLowerCase())) {
    console.warn('[admin-payouts] denied for', user.id);
    return json({ error: 'forbidden' }, 403);
  }

  let body: { action?: string; earningIds?: string[] };
  try { body = await req.json(); } catch { return json({ error: 'invalid_request' }, 400); }

  // Cheap enough for Profile to call on every load: reaching here already
  // means both gates passed, so there is nothing left to check.
  if (body.action === 'whoami') return json({ isAdmin: true });

  if (body.action === 'mark_paid') return markPaid(admin, body.earningIds ?? [], user.id);
  if (body.action === 'overview' || !body.action) return overview(admin);
  return json({ error: 'invalid_request' }, 400);
});

/**
 * Everything before this is test data: mock-mode orders, test-mode Razorpay
 * runs, and the seeding done while the integration was being built. Counting it
 * would report money we never actually collected.
 *
 * Live payments began on 14 Aug 2026. Override with the LIVE_FROM secret if
 * that date ever needs to move; the page shows whichever value is in force so
 * the filter is never invisible.
 */
function liveFrom(): string {
  return Deno.env.get('LIVE_FROM') ?? '2026-08-14T00:00:00Z';
}

// ── Overview ─────────────────────────────────────────────────────────────────

async function overview(admin: ReturnType<typeof createClient>) {
  const since = liveFrom();

  const [ordersRes, earningsRes, refundsRes, accountsRes, eventsRes] = await Promise.all([
    admin.from('payment_orders')
      .select('id, event_id, event_title, event_starts_at, user_id, host_id, status, ticket_paise, convenience_paise, total_paise, commission_paise, host_net_paise, refunded_paise, paid_at, created_at, provider_payment_id')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(200),
    admin.from('host_earnings')
      .select('id, host_id, event_id, event_title, status, gross_paise, commission_paise, net_paise, payable_after, paid_at, created_at')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(500),
    admin.from('refunds')
      .select('id, order_id, amount_paise, reason, initiated_by, status, provider_refund_id, created_at')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(100),
    // Masks, not credentials. This overview exists to answer "can this host be
    // paid", which account_last4 answers as well as the full number does — and
    // the admin dashboard is no place to render every host's bank details. The
    // ciphertext is not selected either: only run-payouts holds the key.
    admin.from('host_payout_accounts').select('user_id, method, account_name, ifsc, account_last4, upi_masked'),
    admin.from('events').select('id, title, price_paise, capacity, starts_at, creator_id').gt('price_paise', 0),
  ]);

  const err = ordersRes.error || earningsRes.error || refundsRes.error || accountsRes.error || eventsRes.error;
  if (err) {
    console.error('[admin-payouts] overview read failed', err);
    return json({ error: 'read_failed', detail: err.message }, 500);
  }

  const orders = ordersRes.data ?? [];
  const earnings = earningsRes.data ?? [];
  const refunds = refundsRes.data ?? [];
  const accounts = accountsRes.data ?? [];
  const paidEvents = eventsRes.data ?? [];

  // Names for every host and buyer we are about to show.
  const ids = new Set<string>();
  orders.forEach((o) => { ids.add(o.host_id); ids.add(o.user_id); });
  earnings.forEach((e) => ids.add(e.host_id));
  paidEvents.forEach((e) => ids.add(e.creator_id));

  const { data: profiles } = await admin
    .from('profiles')
    .select('id, display_name')
    .in('id', [...ids].filter(Boolean));

  const nameById: Record<string, string> = {};
  (profiles ?? []).forEach((p: { id: string; display_name: string | null }) => {
    nameById[p.id] = p.display_name || '';
  });

  const accountByUser: Record<string, unknown> = {};
  accounts.forEach((a) => { accountByUser[a.user_id] = a; });

  // ── Totals. Settled money only: an order that never reached 'paid' moved
  // nothing, and counting it would inflate every figure on the page.
  const settled = orders.filter((o) => o.status === 'paid' || o.status === 'refunded');
  const totals = {
    ordersSettled:     settled.length,
    ordersPaid:        orders.filter((o) => o.status === 'paid').length,
    ordersRefunded:    orders.filter((o) => o.status === 'refunded').length,
    grossPaise:        sum(settled, (o) => o.total_paise),
    refundedPaise:     sum(settled, (o) => o.refunded_paise),
    conveniencePaise:  sum(settled, (o) => o.convenience_paise),
    commissionPaise:   sum(orders.filter((o) => o.status === 'paid'), (o) => o.commission_paise),
    hostNetPaise:      sum(orders.filter((o) => o.status === 'paid'), (o) => o.host_net_paise),
  };

  // ── Who we owe. Grouped per host, split by whether the cooling-off window
  // has passed, because 'payable' only appears after mature_host_earnings()
  // has run and we do not want the page to depend on that having happened.
  const now = Date.now();
  const owedByHost: Record<string, {
    hostId: string; hostName: string; account: unknown;
    duePaise: number; notYetDuePaise: number; tickets: number;
    earningIds: string[]; nextMaturesAt: string | null;
  }> = {};

  for (const e of earnings) {
    if (e.status === 'paid' || e.status === 'refunded') continue;
    const due = e.payable_after ? new Date(e.payable_after).getTime() <= now : true;

    const row = owedByHost[e.host_id] ??= {
      hostId: e.host_id,
      hostName: nameById[e.host_id] || '',
      account: accountByUser[e.host_id] ?? null,
      duePaise: 0,
      notYetDuePaise: 0,
      tickets: 0,
      earningIds: [],
      nextMaturesAt: null,
    };

    row.tickets += 1;
    if (due) {
      row.duePaise += e.net_paise;
      row.earningIds.push(e.id);
    } else {
      row.notYetDuePaise += e.net_paise;
      if (!row.nextMaturesAt || e.payable_after < row.nextMaturesAt) {
        row.nextMaturesAt = e.payable_after;
      }
    }
  }

  const owed = Object.values(owedByHost).sort((a, b) => b.duePaise - a.duePaise);

  // ── Paid events, with how each is selling.
  const eventRows = paidEvents.map((ev) => {
    const evOrders = orders.filter((o) => o.event_id === ev.id);
    return {
      id: ev.id,
      title: ev.title,
      hostId: ev.creator_id,
      hostName: nameById[ev.creator_id] || '',
      pricePaise: ev.price_paise,
      capacity: ev.capacity,
      startsAt: ev.starts_at,
      sold: evOrders.filter((o) => o.status === 'paid').length,
      refunded: evOrders.filter((o) => o.status === 'refunded').length,
      grossPaise: sum(evOrders.filter((o) => o.status === 'paid'), (o) => o.total_paise),
      hostHasPayoutAccount: Boolean(accountByUser[ev.creator_id]),
    };
  }).sort((a, b) => (a.startsAt < b.startsAt ? 1 : -1));

  return json({
    totals,
    owed,
    events: eventRows,
    orders: orders.slice(0, 50).map((o) => ({
      ...o,
      buyerName: nameById[o.user_id] || '',
      hostName: nameById[o.host_id] || '',
    })),
    refunds,
    liveFrom: since,
    generatedAt: new Date().toISOString(),
  });
}

// ── Mark paid ────────────────────────────────────────────────────────────────

async function markPaid(
  admin: ReturnType<typeof createClient>,
  earningIds: string[],
  actorId: string,
) {
  if (!Array.isArray(earningIds) || earningIds.length === 0) {
    return json({ error: 'invalid_request', detail: 'earningIds is required' }, 400);
  }

  // Rows only become 'payable' when this has run, and nothing schedules it.
  // Idempotent, so calling it here costs nothing and removes a manual step.
  const { error: matureErr } = await admin.rpc('mature_host_earnings');
  if (matureErr) {
    console.error('[admin-payouts] mature_host_earnings failed', matureErr);
    return json({ error: 'mature_failed', detail: matureErr.message }, 500);
  }

  // `status = 'payable'` in the filter is what makes a double click safe: the
  // second call matches nothing rather than paying the same host twice.
  const { data, error } = await admin
    .from('host_earnings')
    .update({ status: 'paid', paid_at: new Date().toISOString() })
    .in('id', earningIds)
    .eq('status', 'payable')
    .select('id, host_id, net_paise');

  if (error) {
    console.error('[admin-payouts] mark_paid failed', error);
    return json({ error: 'update_failed', detail: error.message }, 500);
  }

  const marked = data ?? [];
  console.log('[admin-payouts]', actorId, 'marked', marked.length, 'earnings paid,',
    sum(marked, (r) => r.net_paise), 'paise');

  return json({
    marked: marked.length,
    requested: earningIds.length,
    paise: sum(marked, (r) => r.net_paise),
  });
}

function sum<T>(rows: T[], pick: (row: T) => number | null | undefined): number {
  return rows.reduce((acc, row) => acc + (Number(pick(row)) || 0), 0);
}
