/**
 * cancelRsvp — the single path for giving up a seat, paid or free.
 *
 * This lives outside the pages because a paid cancellation moves money. It has
 * to refund before the seat is released, and it has to fail closed when it
 * cannot establish whether a ticket exists. Two copies of that logic would be
 * two chances to drop a paid seat without refunding it, and they would drift
 * apart the first time one of them was touched.
 *
 * Callers own their own UI state, so they pass in what they have (a possibly
 * stale order, the toast fn, the rsvp helpers) and get back a small result they
 * can apply to their own counters.
 */
import {
  fetchMyOrder, cancelPaidTicket, isPaidEvent, formatPaise,
} from './payments.service';

/**
 * @returns {{ ok: boolean, seatReleased: boolean, order: object|null, refundedPaise?: number }}
 *   `seatReleased` is what a caller should decrement an attendee count on.
 *   `order` is the best current knowledge of the user's ticket — null once it
 *   has been refunded, so callers can write it straight back to their state.
 */
export async function cancelRsvp({
  event,
  knownOrder = null,
  wasGoing,
  toggleRsvp,
  refreshRsvps,
  showToast,
}) {
  const eventId = String(event.id);

  if (isPaidEvent(event)) {
    // Re-read rather than trusting a possibly-stale order: mistaking a failed
    // read for an unpaid seat would mean seat gone, money kept, no refund.
    let order = knownOrder;
    if (!order) {
      try {
        order = await fetchMyOrder(eventId);
      } catch {
        showToast('Could not check your ticket. Please try again.');
        return { ok: false, seatReleased: false, order: null };
      }
    }

    if (order) {
      try {
        const { refundedPaise } = await cancelPaidTicket(order.id);
        // refund-ticket deletes the rsvps row server-side, so this path never
        // calls toggleRsvp and local "going" state would otherwise stay stale
        // until a reload. Re-read rather than guessing.
        refreshRsvps?.();
        // "On its way", not "refunded". Razorpay processes instantly but the
        // bank credit lags days behind, and a user who reads this as done will
        // check their account, find nothing, and assume we kept the money.
        showToast(
          `Ticket cancelled. ${formatPaise(refundedPaise)} is on its way back — refunds take up to 5–7 working days to reach your account.`,
          6000,
        );
        return { ok: true, seatReleased: true, order: null, refundedPaise };
      } catch (err) {
        showToast(
          err.reason === 'past_cutoff'
            ? 'Too close to the event for a refund — your ticket still stands.'
            : err.message || 'Could not cancel your ticket. Please try again.',
        );
        return { ok: false, seatReleased: false, order };
      }
    }
    // Priced event but no paid ticket: an unpaid request on an approval-gated
    // event. Falls through to the ordinary path, which withdraws it.
  }

  await toggleRsvp(event);
  showToast(wasGoing ? 'RSVP cancelled.' : 'Request withdrawn.');
  return { ok: true, seatReleased: Boolean(wasGoing), order: null };
}
