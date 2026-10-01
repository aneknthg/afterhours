/**
 * admin.service.js — client half of the admin money view.
 *
 * Holds no privilege of its own. Every call goes to the admin-payouts edge
 * function, which checks the caller's email against an ADMIN_EMAILS allowlist
 * before returning anything. A non-admin hitting these gets a 403 and an empty
 * page; there is no client-side check to bypass.
 */
import { supabase } from './supabase';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export class AdminError extends Error {
  constructor(message, reason, detail = '') {
    super(message);
    this.name = 'AdminError';
    this.reason = reason;
    this.detail = detail;
  }
}

const REASONS = {
  not_authenticated: 'Please sign in.',
  forbidden:         'This account does not have access to the admin view.',
  not_configured:    'ADMIN_EMAILS is not set on the server, so nobody has access yet.',
  read_failed:       'Could not read the payment tables.',
  mature_failed:     'Could not mature earnings before marking them paid.',
  update_failed:     'Could not mark those earnings paid.',
  invalid_request:   'That request was malformed.',
};

async function call(payload) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new AdminError(REASONS.not_authenticated, 'not_authenticated');

  const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-payouts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
      'apikey': SUPABASE_KEY,
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* non-JSON body */ }

  if (!res.ok) {
    const reason = json?.error || 'unknown';
    const summary = REASONS[reason]
      || `admin-payouts failed (${res.status}): ${text.slice(0, 120)}`;

    // Every failure the function returns carries a `detail` next to its code —
    // usually the raw Postgres message. Showing it is the difference between
    // "Could not read the payment tables." and "column
    // host_payout_accounts.upi_id does not exist", which is the line that
    // names a stale deploy on sight. Safe to render: this page is behind the
    // ADMIN_EMAILS allowlist, and the detail describes schema, never a row.
    const detail = typeof json?.detail === 'string' ? json.detail.trim() : '';

    throw new AdminError(detail ? `${summary} (${detail})` : summary, reason, detail);
  }
  return json;
}

export function fetchAdminOverview() {
  return call({ action: 'overview' });
}

/**
 * True only for allowlisted accounts. Used to decide whether to show the admin
 * link on Profile. Resolves false on any failure, including being signed out,
 * so a hidden link is the default and nothing leaks from an error.
 */
export async function checkIsAdmin() {
  try {
    const res = await call({ action: 'whoami' });
    return Boolean(res?.isAdmin);
  } catch {
    return false;
  }
}

/** Marks a host's matured earnings paid after you have sent the money yourself. */
export function markEarningsPaid(earningIds) {
  return call({ action: 'mark_paid', earningIds });
}

/** Paise → "₹1,234" / "₹1,234.56". Money is integer paise everywhere else. */
export function rupees(paise) {
  const value = (Number(paise) || 0) / 100;
  return `₹${value.toLocaleString('en-IN', {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}
