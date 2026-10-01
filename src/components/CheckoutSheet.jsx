/**
 * CheckoutSheet.jsx — attendee ticket checkout (web).
 *
 * Web counterpart of components/CheckoutSheet.tsx in Afterhours-App-main.
 * Presents Razorpay Standard Checkout; the app repo still shows simulate
 * buttons because it has no native module yet, so this is the first surface
 * where real Razorpay checkout actually opens.
 *
 * Three states, driven entirely by the server's response:
 *   provider 'razorpay' → checkout.js opens the real modal
 *   provider 'mock'     → simulate success / failure (PAYMENT_PROVIDER=mock)
 *   error               → the server's `reason`, mapped to something readable
 *
 * The amount is never sent from here. create-payment-order derives it from
 * events.price_paise and returns the breakdown; this only renders it.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import Button from './ui/Button';
import {
  startCheckout, confirmPayment, confirmSimulatedPayment, fetchMyOrder,
  formatPaise, REASON_MESSAGES,
} from '../lib/payments.service';

const CHECKOUT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';

/**
 * checkout.js is loaded on demand rather than in index.html: it is a
 * third-party script on every page load otherwise, and most sessions never
 * reach a paid event. Resolves immediately if another sheet already loaded it.
 */
function loadRazorpay() {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) return resolve(window.Razorpay);
    const existing = document.querySelector(`script[src="${CHECKOUT_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(window.Razorpay));
      existing.addEventListener('error', () => reject(new Error('script_failed')));
      return;
    }
    const s = document.createElement('script');
    s.src = CHECKOUT_SRC;
    s.async = true;
    s.onload = () => resolve(window.Razorpay);
    s.onerror = () => reject(new Error('script_failed'));
    document.body.appendChild(s);
  });
}

export default function CheckoutSheet({ open, event, user, onClose, onPaid }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(false);
  const [paying, setPaying]   = useState(false);
  const [error, setError]     = useState('');
  // True once Razorpay's modal has been opened, which is when the reconcile
  // poll below becomes relevant.
  const [launched, setLaunched] = useState(false);

  // onPaid is passed as an inline arrow, so its identity changes every render.
  // Held in a ref so the poll effect below does not restart (and reset its
  // deadline) on each parent re-render.
  const onPaidRef = useRef(onPaid);
  useEffect(() => { onPaidRef.current = onPaid; });

  // Guards against onPaid firing twice when the callback and the poll both win.
  const settledRef = useRef(false);

  const announcePaid = useCallback(() => {
    if (settledRef.current) return;
    settledRef.current = true;
    onPaidRef.current?.();
  }, []);

  // Open the order as soon as the sheet appears. Nothing is charged here; the
  // server fixes the price and holds her seat for 15 minutes.
  useEffect(() => {
    if (!open || !event?.id) return;
    let cancelled = false;

    setLoading(true);
    setError('');
    startCheckout(String(event.id))
      .then((s) => { if (!cancelled) setSession(s); })
      .catch((err) => {
        if (!cancelled) setError(REASON_MESSAGES[err.reason] || err.message);
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [open, event?.id]);

  // Reset between openings so a previous error never greets the next attempt.
  useEffect(() => {
    if (!open) {
      setSession(null); setError(''); setPaying(false); setLaunched(false);
      settledRef.current = false;
    }
  }, [open]);

  /**
   * Reconcile after checkout, because the callback cannot be trusted.
   *
   * On mobile UPI the browser is backgrounded the moment the payment app takes
   * over, and Razorpay's `handler` frequently never runs — that is exactly what
   * happened on the first live payment (the webhook settled it and logged
   * "client did not return"). The seat does get created server-side seconds
   * later, but without this the attendee stares at an unchanged screen and
   * concludes their money vanished.
   *
   * So once the modal has been opened, poll for a settled order instead of
   * waiting to be told. Also checks immediately whenever the tab regains
   * visibility, which is the moment the user returns from their UPI app.
   *
   * Keeps running after `ondismiss`: with UPI intent the payment can complete
   * in the banking app well after the Razorpay sheet was closed.
   */
  useEffect(() => {
    if (!open || !launched || !event?.id) return;

    let stopped = false;
    const deadline = Date.now() + 90_000;

    async function check() {
      if (stopped || settledRef.current) return;
      try {
        const order = await fetchMyOrder(String(event.id));
        if (!stopped && order) {
          stopped = true;
          announcePaid();
        }
      } catch {
        // Transient read failure — keep polling rather than giving up.
      }
    }

    const timer = setInterval(() => {
      if (Date.now() > deadline || stopped) { clearInterval(timer); return; }
      check();
    }, 2500);

    const onVisible = () => {
      if (document.visibilityState === 'visible') check();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [open, launched, event?.id, announcePaid]);

  // orderId is passed in, not read from state: the Razorpay handler closes
  // over this function at the moment Pay was tapped, and the re-check just
  // before that may have swapped the session for a fresh order.
  const settle = useCallback(async (orderId, receipt) => {
    setPaying(true);
    try {
      await confirmPayment({
        orderId,
        providerPaymentId: receipt.razorpay_payment_id,
        providerOrderId:   receipt.razorpay_order_id,
        signature:         receipt.razorpay_signature,
      });
      announcePaid();
    } catch (err) {
      // The money is taken but the seat is not written. Do not pretend it
      // worked — the webhook is the backstop, and support can settle manually.
      setError(
        REASON_MESSAGES[err.reason] ||
        'Payment went through but confirmation failed. Do not pay again — contact support with your payment id.'
      );
    } finally {
      setPaying(false);
    }
  }, [announcePaid]);

  /**
   * Re-opens the order the moment she taps Pay, before any money moves. The
   * server re-checks capacity and restarts the seat hold, so a sheet left open
   * while the event filled up stops here instead of charging her for a seat
   * that is gone.
   */
  async function recheckSeat() {
    try {
      const fresh = await startCheckout(String(event.id));
      setSession(fresh);
      return fresh;
    } catch (err) {
      if (err.reason === 'event_full') setSession(null);
      setError(REASON_MESSAGES[err.reason] || err.message);
      return null;
    }
  }

  async function payWithRazorpay() {
    setError('');
    let Razorpay;
    try {
      Razorpay = await loadRazorpay();
    } catch {
      setError(REASON_MESSAGES.script_failed);
      return;
    }

    setPaying(true);
    const fresh = await recheckSeat();
    if (!fresh) { setPaying(false); return; }

    const rz = new Razorpay({
      key:      fresh.checkout.keyId,
      order_id: fresh.checkout.orderId,
      amount:   fresh.checkout.amountPaise,
      currency: fresh.checkout.currency,
      name:        'Afterhours',
      description: event.title || 'Event ticket',
      prefill: {
        name:  user?.user_metadata?.display_name || '',
        email: user?.email || '',
      },
      theme: { color: '#ffb1c7' }, // tailwind `primary`
      handler: (receipt) => { settle(fresh.orderId, receipt); },
      modal: {
        // Dismissing is not a failure — the order stays open and reopening the
        // sheet reuses it rather than charging twice.
        ondismiss: () => setPaying(false),
      },
    });

    rz.on('payment.failed', (e) => {
      setPaying(false);
      setError(e?.error?.description || 'Payment failed. You have not been charged.');
    });

    setPaying(true);
    setLaunched(true);
    rz.open();
  }

  async function simulate(outcome) {
    setPaying(true);
    setError('');
    const fresh = await recheckSeat();
    if (!fresh) { setPaying(false); return; }
    try {
      await confirmSimulatedPayment(fresh.orderId, outcome);
      if (outcome === 'success') announcePaid();
      else setError('Simulated failure — the order stays unpaid.');
    } catch (err) {
      setError(REASON_MESSAGES[err.reason] || err.message);
    } finally {
      setPaying(false);
    }
  }

  if (!open) return null;

  const b = session?.breakdown;
  const isMock = session?.checkout?.provider === 'mock';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
      <div className="w-full sm:max-w-md bg-surface rounded-t-3xl sm:rounded-3xl border border-outline-variant/20 p-6 pb-8">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h3 className="font-headline text-xl font-bold text-on-surface">Get your ticket</h3>
            <p className="text-xs text-on-surface-variant/70 mt-0.5 line-clamp-1">{event?.title}</p>
          </div>
          <button
            onClick={onClose}
            disabled={paying}
            className="text-on-surface-variant/50 hover:text-on-surface transition-colors disabled:opacity-30 cursor-pointer"
            aria-label="Close checkout"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {loading && (
          <div className="py-8 text-center text-sm text-on-surface-variant">Opening checkout…</div>
        )}

        {!loading && b && (
          <div className="rounded-2xl bg-surface-container border border-outline-variant/20 p-4 mb-5 space-y-2">
            <Row label="Ticket" value={formatPaise(b.ticketPaise)} />
            {b.conveniencePaise > 0 && (
              <Row label={`Convenience fee (${(b.convenienceBps / 100).toFixed(1)}%)`} value={formatPaise(b.conveniencePaise)} />
            )}
            {/* GST is charged on the fee, not on the ticket, so it gets its own
                line — folding it into the fee would misstate both numbers. */}
            {b.attendeeGstPaise > 0 && (
              <Row
                label={`GST (${((b.gstBps ?? 1800) / 100).toFixed(0)}% on the fee)`}
                value={formatPaise(b.attendeeGstPaise)}
              />
            )}
            <div className="h-px bg-outline-variant/20 my-1" />
            <Row label="Total" value={formatPaise(b.totalPaise)} bold />
          </div>
        )}

        {error && (
          <div className="rounded-xl bg-error-container/20 border border-error/30 px-3 py-2.5 mb-4 flex gap-2">
            <span className="material-symbols-outlined text-error text-base shrink-0">error</span>
            <p className="text-xs text-on-surface leading-relaxed">{error}</p>
          </div>
        )}

        {!loading && session && isMock && (
          <>
            <div className="rounded-xl bg-surface-container-high border border-outline-variant/20 px-3 py-2.5 mb-4 flex gap-2">
              <span className="material-symbols-outlined text-on-surface-variant text-base shrink-0">science</span>
              <p className="text-[11px] text-on-surface-variant leading-relaxed">
                Mock mode — no real money moves. Set <code>PAYMENT_PROVIDER=razorpay</code> in Supabase
                secrets for live checkout.
              </p>
            </div>
            <div className="space-y-2">
              <Button variant="primary" size="lg" fullWidth disabled={paying} onClick={() => simulate('success')}>
                {paying ? 'Working…' : `Simulate paying ${formatPaise(b.totalPaise)}`}
              </Button>
              <Button variant="ghost" size="sm" fullWidth disabled={paying} onClick={() => simulate('failure')}>
                Simulate failure
              </Button>
            </div>
          </>
        )}

        {!loading && session && !isMock && (
          <>
            <Button variant="primary" size="lg" fullWidth disabled={paying} onClick={payWithRazorpay}>
              {paying ? 'Waiting for payment…' : `Pay ${formatPaise(b.totalPaise)}`}
            </Button>
            {launched && (
              <p className="text-[11px] text-on-surface-variant/70 text-center mt-3 leading-relaxed">
                Already paid in your UPI app? Keep this open — your ticket will
                appear here automatically. Don't pay again.
              </p>
            )}
          </>
        )}

        {!loading && !session && error && (
          <Button variant="secondary" size="lg" fullWidth onClick={onClose}>Close</Button>
        )}

        <p className="text-[10px] text-on-surface-variant/50 text-center mt-4 leading-relaxed">
          Cancel more than 48h before the event for a refund of the ticket price.
          {b?.conveniencePaise > 0 && ' The convenience fee is non-refundable.'} Refunds take up to 5–7 working
          days to reach your account.
        </p>
      </div>
    </div>
  );
}

function Row({ label, value, bold }) {
  return (
    <div className="flex items-center justify-between">
      <span className={`text-sm ${bold ? 'font-bold text-on-surface' : 'text-on-surface-variant'}`}>{label}</span>
      <span className={`text-sm tabular-nums ${bold ? 'font-bold text-on-surface' : 'text-on-surface-variant'}`}>{value}</span>
    </div>
  );
}
