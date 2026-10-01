/**
 * Admin.jsx — the money view.
 *
 * Answers three questions, in the order they get asked: what has been sold,
 * who do we owe, and has anything gone wrong. Deliberately an operations page
 * rather than a metrics dashboard, because the job it replaces is the weekly
 * SQL runbook for paying hosts by hand.
 *
 * Holds no privileged access. Everything here comes from the admin-payouts
 * edge function, which enforces the allowlist server-side; a non-admin who
 * navigates to /admin sees a permission message and nothing else.
 */
import { useState, useEffect, useCallback } from 'react';
import { useToast } from '../components/Toast';
import Button from '../components/ui/Button';
import { fetchAdminOverview, markEarningsPaid, rupees } from '../lib/admin.service';

const dateTime = (iso) =>
  iso ? new Date(iso).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  }) : '';

const day = (iso) =>
  iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '';

export default function Admin() {
  const showToast = useToast();
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [paying, setPaying]   = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await fetchAdminOverview());
    } catch (err) {
      setError(err.message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleMarkPaid(host) {
    if (!window.confirm(
      `Mark ${rupees(host.duePaise)} as paid to ${host.hostName || 'this host'}?\n\n`
      + 'Only do this after you have actually sent the money. This does not move '
      + 'any money by itself.'
    )) return;

    setPaying(host.hostId);
    try {
      const res = await markEarningsPaid(host.earningIds);
      showToast(
        res.marked
          ? `Marked ${rupees(res.paise)} paid across ${res.marked} ticket${res.marked === 1 ? '' : 's'}.`
          : 'Nothing was marked. Those earnings may already have been paid.',
        5000,
      );
      await load();
    } catch (err) {
      showToast(err.message, 5000);
    } finally {
      setPaying(null);
    }
  }

  if (loading) {
    return <Shell><p className="text-on-surface-variant">Loading…</p></Shell>;
  }

  if (error) {
    return (
      <Shell>
        <div className="rounded-2xl border border-error/30 bg-error-container/10 px-5 py-4">
          <p className="text-sm text-on-surface break-words">{error}</p>
          <button onClick={load} className="text-xs font-semibold text-primary hover:underline mt-3">
            Try again
          </button>
        </div>
      </Shell>
    );
  }

  const t = data.totals;
  const owedNow = data.owed.reduce((a, h) => a + h.duePaise, 0);
  const missingAccounts = data.owed.filter((h) => h.duePaise > 0 && !h.account).length;

  return (
    <Shell onRefresh={load} generatedAt={data.generatedAt} liveFrom={data.liveFrom}>
      {/* ── Totals ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
        <Stat label="Collected" value={rupees(t.grossPaise)} sub={`${t.ordersPaid} paid`} />
        <Stat label="Refunded" value={rupees(t.refundedPaise)} sub={`${t.ordersRefunded} refunded`} />
        <Stat label="Our commission" value={rupees(t.commissionPaise)} sub={`plus ${rupees(t.conveniencePaise)} fees`} />
        <Stat label="Owed to hosts" value={rupees(owedNow)} sub={owedNow ? 'due now' : 'nothing due'} tone={owedNow ? 'warn' : undefined} />
      </div>

      {missingAccounts > 0 && (
        <div className="rounded-2xl border border-status-pending/30 bg-status-pending/10 px-5 py-4 mb-8">
          <p className="text-sm text-on-surface">
            {missingAccounts} host{missingAccounts === 1 ? ' is' : 's are'} owed money but
            {missingAccounts === 1 ? ' has' : ' have'} not added payout details yet. Ask
            {missingAccounts === 1 ? ' her' : ' them'} to fill it in under Profile, Hosting.
          </p>
        </div>
      )}

      {/* ── Who we owe ── */}
      <Section title="Who we owe" count={data.owed.length}>
        {data.owed.length === 0 ? (
          <Empty>Nobody is owed anything right now.</Empty>
        ) : (
          <div className="space-y-3">
            {data.owed.map((h) => (
              <div key={h.hostId} className="rounded-2xl border border-outline-variant/20 bg-surface-container px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-on-surface">
                      {h.hostName || h.hostId.slice(0, 8)}
                    </p>
                    <p className="text-xs text-on-surface-variant mt-0.5">
                      {h.tickets} ticket{h.tickets === 1 ? '' : 's'}
                      {h.notYetDuePaise > 0 && ` · ${rupees(h.notYetDuePaise)} not due until ${day(h.nextMaturesAt)}`}
                    </p>
                    <p className="text-xs mt-2 font-mono text-on-surface-variant">
                      {h.account
                        ? h.account.method === 'upi'
                          ? h.account.upi_masked
                          : `${h.account.account_name} · ••••${h.account.account_last4 ?? ''} · ${h.account.ifsc}`
                        : <span className="text-amber-400 font-sans">No payout details yet</span>}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-lg font-bold text-on-surface tabular-nums">{rupees(h.duePaise)}</p>
                    {h.duePaise > 0 && h.account && (
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={paying === h.hostId}
                        onClick={() => handleMarkPaid(h)}
                      >
                        {paying === h.hostId ? 'Marking…' : 'Mark paid'}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* ── Paid events ── */}
      <Section title="Paid events" count={data.events.length}>
        {data.events.length === 0 ? (
          <Empty>No one has priced an event yet.</Empty>
        ) : (
          <Table
            head={['Event', 'Host', 'Price', 'Sold', 'Refunded', 'Collected']}
            rows={data.events.map((e) => [
              <span className="text-on-surface">{e.title}</span>,
              <span className="flex items-center gap-1.5">
                {e.hostName || e.hostId.slice(0, 8)}
                {!e.hostHasPayoutAccount && <span title="No payout details" className="text-amber-400">!</span>}
              </span>,
              rupees(e.pricePaise),
              String(e.sold),
              String(e.refunded),
              rupees(e.grossPaise),
            ])}
          />
        )}
      </Section>

      {/* ── Recent orders ── */}
      <Section title="Recent orders" count={data.orders.length}>
        {data.orders.length === 0 ? (
          <Empty>No orders yet.</Empty>
        ) : (
          <Table
            head={['When', 'Event', 'Buyer', 'Status', 'Paid', 'Refunded']}
            rows={data.orders.map((o) => [
              dateTime(o.created_at),
              <span className="text-on-surface">{o.event_title}</span>,
              o.buyerName || o.user_id.slice(0, 8),
              <StatusPill status={o.status} />,
              rupees(o.total_paise),
              o.refunded_paise ? rupees(o.refunded_paise) : '',
            ])}
          />
        )}
      </Section>

      {/* ── Refunds ── */}
      <Section title="Refunds" count={data.refunds.length}>
        {data.refunds.length === 0 ? (
          <Empty>No refunds yet.</Empty>
        ) : (
          <Table
            head={['When', 'Amount', 'Reason', 'By', 'Status', 'Gateway id']}
            rows={data.refunds.map((r) => [
              dateTime(r.created_at),
              rupees(r.amount_paise),
              r.reason,
              r.initiated_by,
              <StatusPill status={r.status} />,
              <span className="font-mono text-[11px]">{r.provider_refund_id || ''}</span>,
            ])}
          />
        )}
      </Section>
    </Shell>
  );
}

// ── Pieces ───────────────────────────────────────────────────────────────────

function Shell({ children, onRefresh, generatedAt, liveFrom }) {
  return (
    <main className="min-h-screen bg-background px-6 md:px-12 py-10 max-w-screen-xl mx-auto">
      <div className="flex items-baseline justify-between gap-4 mb-8">
        <div>
          <h1 className="font-headline text-3xl font-bold text-on-surface">Money</h1>
          {/* State the cutoff rather than filtering quietly. Anything earlier
              was mock and test-mode traffic from building the integration, and
              a total nobody can explain is worse than no total. */}
          {liveFrom && (
            <p className="text-xs text-on-surface-variant/60 mt-1">
              Since {new Date(liveFrom).toLocaleDateString('en-IN', {
                day: 'numeric', month: 'long', year: 'numeric',
              })}. Earlier records were test payments and are excluded.
            </p>
          )}
        </div>
        {onRefresh && (
          <div className="flex items-center gap-3">
            {generatedAt && (
              <span className="text-[11px] text-on-surface-variant/50">
                as of {dateTime(generatedAt)}
              </span>
            )}
            <button onClick={onRefresh} className="text-xs font-semibold text-primary hover:underline">
              Refresh
            </button>
          </div>
        )}
      </div>
      {children}
    </main>
  );
}

function Stat({ label, value, sub, tone }) {
  return (
    <div className="rounded-2xl border border-outline-variant/20 bg-surface-container px-5 py-4">
      <p className="text-[10px] uppercase tracking-wider text-on-surface-variant/60 font-semibold">{label}</p>
      <p className={`text-2xl font-bold tabular-nums mt-1 ${tone === 'warn' ? 'text-amber-400' : 'text-on-surface'}`}>
        {value}
      </p>
      {sub && <p className="text-[11px] text-on-surface-variant/60 mt-0.5">{sub}</p>}
    </div>
  );
}

function Section({ title, count, children }) {
  return (
    <section className="mb-10">
      <div className="flex items-baseline gap-2 mb-4">
        <h2 className="font-headline text-lg font-bold text-on-surface">{title}</h2>
        <span className="text-xs text-on-surface-variant/50 tabular-nums">{count}</span>
      </div>
      {children}
    </section>
  );
}

function Empty({ children }) {
  return (
    <p className="text-sm text-on-surface-variant/60 rounded-2xl border border-outline-variant/15 px-5 py-6 text-center">
      {children}
    </p>
  );
}

function Table({ head, rows }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-outline-variant/20">
      <table className="w-full text-sm min-w-[680px]">
        <thead>
          <tr className="bg-surface-container">
            {head.map((h) => (
              <th key={h} className="text-left font-semibold text-[10px] uppercase tracking-wider text-on-surface-variant/60 px-4 py-3">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((cells, i) => (
            <tr key={i} className="border-t border-outline-variant/10">
              {cells.map((c, j) => (
                <td key={j} className="px-4 py-3 text-on-surface-variant tabular-nums align-top">{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusPill({ status }) {
  const tone = status === 'paid' || status === 'processed'
    ? 'text-primary border-primary/30 bg-primary/5'
    : status === 'refunded'
      ? 'text-amber-400 border-amber-500/30 bg-amber-500/5'
      : status === 'failed'
        ? 'text-error border-error/30 bg-error/5'
        : 'text-on-surface-variant border-outline-variant/25';
  return (
    <span className={`inline-block text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-md border ${tone}`}>
      {status}
    </span>
  );
}
