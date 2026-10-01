/**
 * payments.service.js — client side of ticket checkout (web).
 *
 * Mirrors lib/payments.service.ts in Afterhours-App-main. Both repos deploy to
 * the same Supabase project, so this deliberately calls the SAME two edge
 * functions rather than adding a parallel /api route:
 *
 *   1. startCheckout(eventId)  → create-payment-order opens an order
 *   2. confirmPayment(...)     → verify-payment checks the HMAC signature and
 *                                calls settle_paid_order(), which writes the
 *                                rsvps row and the host's escrow row in one
 *                                transaction. Idempotent.
 *
 * Between them sits Razorpay Standard Checkout (see CheckoutSheet.jsx).
 *
 * WHY NOT A LOCAL /api/create-order: the amount must never come from the
 * client. create-payment-order reads events.price_paise, computes the split,
 * and checks the buyer is verified / the event isn't full / approval was
 * granted. A second endpoint that trusts a posted amount would bypass all of
 * it, and an RLS policy on rsvps blocks client-written paid seats anyway — the
 * only thing that seats someone is a verified gateway signature applied by an
 * edge function under the service role.
 *
 * The publishable key is all this file ever sees. RAZORPAY_KEY_SECRET lives in
 * Supabase secrets and never reaches the browser; the key_id needed to open
 * checkout comes back from the server inside `checkout.keyId`.
 */

import { supabase } from './supabase';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

/**
 * Thrown with the server's machine-readable `reason` intact (not_verified,
 * needs_approval, event_full, past_cutoff, …) so callers branch on it rather
 * than string-matching a message.
 */
export class PaymentError extends Error {
  constructor(message, reason) {
    super(message);
    this.name = 'PaymentError';
    this.reason = reason;
  }
}

/**
 * Server reasons → readable copy. Shared by every caller.
 *
 * refund-ticket returns only { refunded, reason } with NO `error` field, so
 * without this map every refund failure rendered as a generic "Something went
 * wrong" and threw away the one diagnostic the server did send. Two of its
 * paths also answer with plain-text 'Unauthorized'/'Forbidden' rather than
 * JSON, which is why callFunction falls through to the raw status below.
 */
export const REASON_MESSAGES = {
  not_authenticated: 'Please sign in first.',
  not_verified:      'Verify your profile before buying a ticket.',
  needs_approval:    'The host needs to approve you first. You have not been charged.',
  approval_expired:  'Your approval expired before you paid, so the spot was released. Request to join again.',
  event_full:        'This event filled up. You have not been charged.',
  event_started:     'This event has already started.',
  not_paid_event:    'This event is free — no payment needed.',
  gateway_error:     'Could not reach the payment provider. Please try again.',
  script_failed:     'Could not load the payment window. Check your connection and retry.',
  // refund-ticket
  no_order:          'We could not find your ticket for this event.',
  no_event:          'That event no longer exists.',
  order_created:     'This ticket was never paid for, so there is nothing to refund.',
  order_refunded:    'This ticket was already refunded. Refunds can take up to 5–7 working days to reach your account.',
  order_cancelled:   'This order was cancelled.',
  order_failed:      'That payment did not go through, so there is nothing to refund.',
  past_cutoff:       'Too close to the event for a refund — your ticket still stands.',
  refund_failed:     'The refund could not be issued. You have not lost your ticket — contact support.',
  partial_failure:   'Some tickets could not be refunded, so the event was not cancelled.',
  invalid_request:   'That request was malformed.',
  read_failed:       'Could not read your ticket. Please try again.',
};

async function callFunction(name, payload) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new PaymentError('Please sign in first.', 'not_authenticated');

  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
      'apikey': SUPABASE_KEY,
    },
    body: JSON.stringify(payload),
  });

  // These functions return a structured { error, reason } body on 4xx as well
  // as 2xx, so parse before deciding.
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* non-JSON error body */ }

  if (!res.ok) {
    const reason = json?.reason || 'unknown';
    throw new PaymentError(
      json?.error
        || REASON_MESSAGES[reason]
        // Non-JSON bodies carry no reason at all. Surface the status and body
        // rather than a generic string, so a 401/403 is diagnosable instead of
        // looking identical to every other failure.
        || (text ? `${name} failed (${res.status}): ${text.slice(0, 120)}` : `${name} failed (${res.status}).`),
      reason,
    );
  }
  return json;
}

// ── Checkout ─────────────────────────────────────────────────────────────────

/** Opens an order. Nothing is charged yet and no seat is held. */
export function startCheckout(eventId) {
  return callFunction('create-payment-order', { eventId });
}

/** Hands a real gateway receipt back for signature verification. */
export function confirmPayment({ orderId, providerPaymentId, providerOrderId, signature }) {
  return callFunction('verify-payment', {
    orderId,
    providerPaymentId,
    providerOrderId,
    signature,
  });
}

/**
 * Mock-mode only. The server mints the signature with the same HMAC scheme the
 * live path verifies, so the whole flow can be exercised without Razorpay.
 * Rejected outright once PAYMENT_PROVIDER=razorpay.
 */
export function confirmSimulatedPayment(orderId, outcome) {
  return callFunction('verify-payment', { orderId, simulate: outcome });
}

// ── Display helpers ──────────────────────────────────────────────────────────

/** Paise → "₹450" / "₹461.25". Money is integer paise everywhere else. */
export function formatPaise(paise) {
  const rupees = (paise || 0) / 100;
  return `₹${Number.isInteger(rupees) ? rupees : rupees.toFixed(2)}`;
}

/** True when the event charges for entry. Reads the numeric column, not the display string. */
export function isPaidEvent(event) {
  return (event?.price_paise ?? 0) > 0;
}

// ── Refunds ──────────────────────────────────────────────────────────────────

/**
 * Attendee gives up a paid seat. Throws PaymentError('past_cutoff') inside the
 * 48-hour window — the caller should then warn that cancelling forfeits the
 * ticket rather than silently dropping the RSVP.
 */
export function cancelPaidTicket(orderId) {
  return callFunction('refund-ticket', { action: 'attendee_cancel', orderId });
}

/**
 * Refunds every ticket on an event in full. Must succeed BEFORE the cancel_event
 * RPC runs — that RPC notifies attendees and then deletes the event, and money
 * attached to a deleted event has nobody to refund.
 */
export function refundAllForEvent(eventId) {
  return callFunction('refund-ticket', { action: 'host_cancel', eventId });
}

// ── Reads ────────────────────────────────────────────────────────────────────
//
// These THROW on failure rather than returning null. A transient network blip
// that reads as "no ticket" would let the cancel path drop a paid RSVP row
// directly: seat gone, money kept, no refund. Callers must fail closed.

const ORDER_COLS =
  'id, event_id, event_title, event_starts_at, status, ticket_paise, ' +
  'convenience_paise, total_paise, refunded_paise, paid_at, created_at';

async function currentUserId() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id ?? null;
}

/** The signed-in user's paid ticket for an event, if they bought one. */
export async function fetchMyOrder(eventId) {
  const userId = await currentUserId();
  if (!userId) return null;

  const { data, error } = await supabase
    .from('payment_orders')
    .select(ORDER_COLS)
    .eq('user_id', userId)
    .eq('event_id', eventId)
    .eq('status', 'paid')
    .maybeSingle();

  if (error) throw new PaymentError(error.message, 'read_failed');
  return data ?? null;
}
