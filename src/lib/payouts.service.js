/**
 * payouts.service.js — where a host tells us to send her money.
 *
 * Web counterpart of the payout half of lib/payments.service.ts in
 * Afterhours-App-main. Both repos write the same `host_payout_accounts` row.
 *
 * No KYC is collected here. Payouts push from the platform balance to whatever
 * the host provides, so a UPI id, or an account number plus IFSC, is enough.
 *
 * The table enforces the same rules at the database level (see
 * host_payout_accounts_fields_present). validatePayoutAccount below mirrors
 * that constraint deliberately, so a host gets a readable message in the form
 * instead of a raw Postgres check-constraint violation.
 */
import { supabase } from './supabase';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;

export class PayoutError extends Error {
  constructor(message, reason) {
    super(message);
    this.name = 'PayoutError';
    this.reason = reason;
  }
}

async function currentUserId() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id ?? null;
}

/** The signed-in host's payout details, or null if she has not set any. */
export async function fetchPayoutAccount() {
  const userId = await currentUserId();
  if (!userId) return null;

  // Masked columns only. The credentials are encrypted under a key held in edge
  // function secrets, and the client's column grant does not cover the
  // ciphertext either — selecting account_number_enc here returns 403.
  const { data, error } = await supabase
    .from('host_payout_accounts')
    .select('method, account_name, ifsc, account_last4, upi_masked, updated_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw new PayoutError(error.message, 'read_failed');
  return data ?? null;
}

/**
 * Mirrors the DB constraint. Returns a readable message, or null when valid.
 */
export function validatePayoutAccount(account) {
  if (account.method === 'upi') {
    const upi = (account.upi_id || '').trim();
    if (upi.length <= 2) return 'Enter your UPI ID, something like yourname@bank.';
    if (!upi.includes('@')) return 'A UPI ID has an @ in it, like yourname@bank.';
    return null;
  }

  if (account.method === 'bank') {
    if ((account.account_name || '').trim().length < 2) {
      return "Enter the account holder's name as it appears on the account.";
    }
    if ((account.account_number || '').trim().length < 6) {
      return 'That account number looks too short. Check it and try again.';
    }
    if (!IFSC_RE.test((account.ifsc || '').trim().toUpperCase())) {
      return 'That IFSC does not look right. It should look like HDFC0001234.';
    }
    return null;
  }

  return 'Choose how you want to be paid.';
}

/**
 * Saves the host's payout details through save-payout-account.
 *
 * This used to upsert the table directly, which put the account number into
 * Postgres in plaintext — readable by anything that bypasses RLS, which is a
 * dump, a backup, the dashboard or a leaked service-role key. The client's
 * INSERT/UPDATE grant is revoked now; the edge function encrypts under
 * PAYOUT_ENC_KEY, a secret the database does not hold, and stores only
 * ciphertext plus a display mask.
 *
 * Returns the masked account the server wrote. Only the fields for the chosen
 * method are stored; the others are nulled server-side, so a leftover value
 * from a previous method can never be used to pay someone.
 */
export async function savePayoutAccount(account) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new PayoutError('Please sign in first.', 'not_authenticated');

  const invalid = validatePayoutAccount(account);
  if (invalid) throw new PayoutError(invalid, 'invalid_request');

  const isUpi = account.method === 'upi';
  const res = await fetch(`${SUPABASE_URL}/functions/v1/save-payout-account`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      apikey: SUPABASE_KEY,
    },
    body: JSON.stringify({
      method:        account.method,
      upiId:         isUpi ? account.upi_id.trim() : null,
      accountName:   isUpi ? null : account.account_name.trim(),
      accountNumber: isUpi ? null : account.account_number.trim(),
      ifsc:          isUpi ? null : account.ifsc.trim(),
    }),
  });

  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* non-JSON error body */ }

  if (!res.ok) {
    throw new PayoutError(json?.error || 'Could not save payout details.', json?.reason || 'db_error');
  }
  return json;
}

/**
 * "7890" → "••••7890". Takes account_last4 now rather than a full number: the
 * client no longer receives one to mask. Kept because callers render it.
 */
export function maskAccountNumber(value) {
  const s = String(value || '');
  return s ? `••••${s.slice(-4)}` : '';
}
