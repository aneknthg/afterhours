/**
 * EventDetail.jsx
 *
 * Non-curated event detail redesigned:
 *   — Luma-inspired: clean prose, no info-grid duplication
 *   — Warm gradient fallback when no image
 *   — RSVP card includes date + venue summary
 *   — "What to expect" as a featured callout (no side-stripe)
 *   — Refined metadata (not uppercase-aggressive)
 */
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { CAT_ICONS } from '../data/events';
import { useAuth } from '../lib/AuthContext';
import { useToast } from '../components/Toast';
import { setPendingIntent } from '../lib/pendingIntent';
import { useRsvp, formatPaymentDue } from '../lib/useRsvp';
import { useVerificationGate } from '../lib/VerificationGate';
import { useEventDetail } from '../lib/useEventDetail';
import { shortDate, isPast } from '../lib/date';
import { useState, useEffect } from 'react';
import Footer from '../components/Footer';
import CalendarMenuButton from '../components/CalendarMenuButton';
import Button from '../components/ui/Button';
import Tag from '../components/ui/Tag';
import { avatarBg, getInitials } from '../lib/avatar';
import AttendeeList from '../components/events/AttendeeList';
import ConnectionPrompt from '../components/events/ConnectionPrompt';
import { CancelConfirmModal, CancelEventModal, RsvpSuccessModal } from '../components/modals';
import ReportModal from '../components/trust/ReportModal';
import { trustService } from '../services/trust.service';
import { eventsService } from '../services/events.service';
import CheckoutSheet from '../components/CheckoutSheet';
import GetAppSheet from '../components/GetAppSheet';
import {
  isPaidEvent, formatPaise, fetchMyOrder, refundAllForEvent,
} from '../lib/payments.service';
import { cancelRsvp } from '../lib/cancelRsvp';

// ─── Per-category warm gradient fallbacks (used when no image) ────────────────
const CAT_GRADIENTS = {
  music:  'linear-gradient(135deg, #1d1418 0%, #2a1525 55%, #1a1830 100%)',
  arts:   'linear-gradient(135deg, #171214 0%, #271a24 55%, #1f1a2e 100%)',
  food:   'linear-gradient(135deg, #1d1418 0%, #2c1e18 55%, #1f1a18 100%)',
  lit:    'linear-gradient(135deg, #171214 0%, #1f1a2c 55%, #2a1a20 100%)',
  sports: 'linear-gradient(135deg, #171214 0%, #1a2028 55%, #221524 100%)',
  film:   'linear-gradient(135deg, #14141a 0%, #1e1428 55%, #221520 100%)',
  other:  'linear-gradient(135deg, #171214 0%, #2a1520 55%, #171a24 100%)',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function Stars({ value, size = 16 }) {
  return (
    <div className="flex items-center gap-px">
      {[1, 2, 3, 4, 5].map((s) => (
        <span
          key={s}
          className={s <= Math.round(value) ? 'text-primary' : 'text-surface-container-highest'}
          style={{
            fontFamily: 'Material Symbols Outlined',
            fontSize: size,
            fontVariationSettings: s <= Math.round(value) ? "'FILL' 1" : "'FILL' 0",
          }}
        >
          star
        </span>
      ))}
    </div>
  );
}

function accessInfo(access) {
  if (access === 'approval') return { label: 'Curator approval required', icon: 'how_to_reg' };
  return                            { label: 'Open to all',               icon: 'public' };
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function EventDetail() {
  const { id }    = useParams();
  const navigate  = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const location  = useLocation();

  // Opened straight from a shared link, this page is the tab's first entry, so
  // Back (ours or the browser's) would leave Afterhours for WhatsApp. Slip an
  // entry point in underneath it: sign-up for a visitor, with the event parked
  // so onboarding ends back here, or Discover for a member. `key` is
  // 'default' only on the entry the tab arrived with, so this runs once.
  useEffect(() => {
    if (authLoading || location.key !== 'default') return;
    const here = location.pathname + location.search;
    if (!user) setPendingIntent(here);
    navigate(user ? '/discover' : '/auth?mode=signup', { replace: true });
    navigate(here);
  }, [authLoading]); // eslint-disable-line react-hooks/exhaustive-deps
  const showToast = useToast();
  const { isGoing, isPending, isAwaitingPayment, paymentDueAt, toggleRsvp, refresh: refreshRsvps } = useRsvp();
  const requireVerified = useVerificationGate();

  const [heroImgFailed, setHeroImgFailed] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showRsvpSuccess, setShowRsvpSuccess] = useState(false);
  const [showReportHost, setShowReportHost]   = useState(false);
  const [blockingHost, setBlockingHost]       = useState(false);
  const [showCancelEvent, setShowCancelEvent] = useState(false);
  const [cancellingEvent, setCancellingEvent] = useState(false);
  const [showCheckout, setShowCheckout]       = useState(false);
  // The attendee's own paid ticket, if any. Cancelling a paid seat has to go
  // through a refund rather than just dropping the rsvps row.
  const [myOrder, setMyOrder]         = useState(null);
  const [orderLoading, setOrderLoading] = useState(false);

  const {
    event, isCurated, hostName, hostMeta,
    descData, catDesc, reviews,
    attendeeCount, setAttendeeCount,
    loading, error,
  } = useEventDetail(id);

  const paid = isPaidEvent(event);

  useEffect(() => {
    if (!paid || !event?.id || !user) { setMyOrder(null); return; }
    let cancelled = false;
    setOrderLoading(true);
    // A failed read leaves myOrder null, which would look like "no ticket".
    // handleCancelConfirmed re-reads and fails closed rather than trusting it.
    fetchMyOrder(String(event.id))
      .then((order) => { if (!cancelled) setMyOrder(order); })
      .catch(() => { if (!cancelled) setMyOrder(null); })
      .finally(() => { if (!cancelled) setOrderLoading(false); });
    return () => { cancelled = true; };
  }, [paid, event?.id, user?.id]);

  async function handleShare() {
    const url = `${window.location.origin}/event/${event.id}`;
    try {
      // The native sheet on mobile. Desktop browsers mostly lack it, and a
      // dismissed sheet rejects, which is not an error worth reporting.
      if (navigator.share) {
        await navigator.share({ title: event.title, text: `${event.title} — on Afterhours`, url });
        return;
      }
    } catch {
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      showToast('Link copied.');
    } catch {
      showToast(url);
    }
  }

  function handleRsvp() {
    if (!user) {
      // She came for this event, very likely from a shared link. Park it so
      // signup, onboarding and verification hand her back here rather than
      // dropping her in Discover.
      setPendingIntent(`/event/${event.id}`);
      navigate('/auth');
      return;
    }
    // Approved on a paid event and not paid yet: her seat is already counted,
    // so this comes before the capacity guard or a full event would lock her out.
    if (isAwaitingPayment(event.id)) { setShowCheckout(true); return; }
    // Capacity guard: a full event can't take new attendees (existing RSVPs can still cancel)
    if (event.capacity != null && attendeeCount != null && attendeeCount >= event.capacity && !isGoing(event.id)) return;
    requireVerified(async () => {
      // Paid events go through checkout instead of a direct RSVP — the seat is
      // written server-side once the payment signature verifies. Approval-gated
      // paid events still request first; payment comes after the host says yes.
      if (paid && event.access !== 'approval') { setShowCheckout(true); return; }
      const result = await toggleRsvp(event);
      if (result === 'event_full') {
        if (event.capacity) setAttendeeCount(event.capacity);
        showToast('This event just filled up. Someone took the last spot a moment before you.');
        return;
      }
      if (result === 'failed') {
        showToast('Could not RSVP. Please try again.');
        return;
      }
      // Only increment the "going" count for open events; approval events await host action
      if (event.access !== 'approval') {
        setAttendeeCount((c) => c + 1);
      }
      setShowRsvpSuccess(true);
    });
  }

  async function handleCancelConfirmed() {
    setShowCancelModal(false);
    // An unpaid approval holds a counted seat too, so giving it up releases one.
    const wasGoing = isGoing(event.id) || isAwaitingPayment(event.id);

    const result = await cancelRsvp({
      event,
      knownOrder: myOrder,
      wasGoing,
      toggleRsvp,
      refreshRsvps,
      showToast,
    });

    setMyOrder(result.order);
    if (result.seatReleased) setAttendeeCount((c) => Math.max(0, c - 1));
  }

  // Host cancels (deletes) the event. The RPC notifies every attendee with the
  // note, then removes the event server-side.
  async function handleCancelEvent(note) {
    setCancellingEvent(true);
    try {
      // Refund BEFORE cancelling. cancel_event notifies attendees and then
      // deletes the event, and money attached to a deleted event has nobody to
      // refund. A refund failure aborts the cancellation rather than stranding it.
      if (paid) await refundAllForEvent(String(event.id));
      await eventsService.cancelEvent(event.id, note);
      setShowCancelEvent(false);
      showToast('Event cancelled. Attendees have been notified.');
      navigate('/my-events');
    } catch (err) {
      showToast(err.message || 'Could not cancel the event. Try again.');
    } finally {
      setCancellingEvent(false);
    }
  }

  // Error first: a missing event leaves `event` null with loading=false, so
  // checking `!event` before `error` would spin forever.
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="text-center">
          <p className="text-on-surface-variant mb-4">{error}</p>
          <Button variant="secondary" onClick={() => navigate(-1)}>Go back</Button>
        </div>
      </div>
    );
  }

  if (loading || !event) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const going      = isGoing(event.id);
  const pending    = isPending(event.id);
  // Approval-gated paid events approve first and charge second. The server
  // marks the gap with rsvps.payment_due_at: the seat is held until then and
  // released if she hasn't paid.
  const awaitingPayment = paid && isAwaitingPayment(event.id) && !myOrder;
  const dueAt = paymentDueAt(event.id);
  const dueLabel = dueAt ? formatPaymentDue(dueAt) : null;
  const isFull     = event.capacity != null && attendeeCount != null && attendeeCount >= event.capacity;
  const isOwnEvent = !isCurated && event.creator_id && user?.id && event.creator_id === user.id;
  const locationStr = isCurated
    ? event.venue
    : [event.venue, event.city].filter(Boolean).join(', ');
  const avgRating  = reviews.length
    ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
    : 0;
  const access     = accessInfo(event.access);
  const hasImage   = !!(event.img) && !heroImgFailed;

  return (
    <div className="page-enter">
      {showCancelModal && (
        <CancelConfirmModal
          eventTitle={event.title}
          onConfirm={handleCancelConfirmed}
          onCancel={() => setShowCancelModal(false)}
        />
      )}
      {showCancelEvent && (
        <CancelEventModal
          eventTitle={event.title}
          busy={cancellingEvent}
          onConfirm={handleCancelEvent}
          onClose={() => setShowCancelEvent(false)}
        />
      )}
      {showRsvpSuccess && (
        <RsvpSuccessModal
          eventTitle={event.title}
          eventId={event.id}
          onClose={() => setShowRsvpSuccess(false)}
          isApproval={event.access === 'approval'}
        />
      )}

      <GetAppSheet eventId={event.id} />

      <CheckoutSheet
        open={showCheckout}
        event={event}
        user={user}
        onClose={() => setShowCheckout(false)}
        onPaid={() => {
          setShowCheckout(false);
          // An approved guest's seat was already counted while it was held.
          if (!awaitingPayment) setAttendeeCount((c) => c + 1);
          refreshRsvps();
          setShowRsvpSuccess(true);
          fetchMyOrder(String(event.id)).then(setMyOrder).catch(() => {});
        }}
      />

      {/* ── Back ── */}
      <div className="px-6 pt-8 max-w-screen-xl mx-auto">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-on-surface-variant hover:text-primary transition-colors text-sm font-label cursor-pointer"
        >
          <span className="material-symbols-outlined text-base">arrow_back</span>
          Back
        </button>
      </div>

      {/* ── Hero ── */}
      <section
        className="relative mt-4 w-full overflow-hidden"
        style={{ height: 'clamp(340px, 48vh, 520px)' }}
      >
        {/* Background */}
        {hasImage ? (
          <img
            alt={event.title}
            className="absolute inset-0 w-full h-full object-cover"
            src={event.img}
            onError={() => setHeroImgFailed(true)}
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{ background: CAT_GRADIENTS[event.cat] || CAT_GRADIENTS.other }}
          >
            {/* Faint oversized category glyph — decorative depth */}
            <div
              className="absolute right-12 top-1/2 -translate-y-1/2 select-none pointer-events-none opacity-[0.035]"
              aria-hidden="true"
            >
              <span className="material-symbols-outlined text-primary" style={{ fontSize: '14rem', lineHeight: 1 }}>{CAT_ICONS[event.cat] || 'star'}</span>
            </div>
            {/* Soft warm glow */}
            <div className="absolute left-1/4 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[480px] h-[480px] rounded-full bg-primary/5 blur-[100px] pointer-events-none" />
          </div>
        )}

        {/* Readability gradients */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent z-10" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/75 via-transparent to-transparent z-10" />

        {/* Hero content */}
        <div className="absolute bottom-0 left-0 right-0 z-20 px-6 pb-10 max-w-screen-xl mx-auto">
          <div className="max-w-2xl">
            {/* Badges */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <Tag variant="primary">{event.tag}</Tag>
              {event.women_only && (
                <span className="px-2.5 py-1 text-[11px] font-semibold bg-primary/10 text-primary border border-primary/20 rounded-full">
                  ♀ Women-only
                </span>
              )}
              {event.access !== 'open' && (
                <span className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold bg-background/50 backdrop-blur-sm text-on-surface-variant border border-outline-variant/20 rounded-full">
                  <span className="material-symbols-outlined" style={{ fontSize: 11 }}>{access.icon}</span>
                  {access.label}
                </span>
              )}
            </div>

            {/* Title */}
            <h1 className="font-headline text-3xl sm:text-4xl md:text-5xl font-bold text-on-surface leading-[1.15] mb-5">
              {event.title}
            </h1>

            {/* Metadata — warm, readable, not uppercase-aggressive */}
            <div className="flex flex-wrap gap-x-5 gap-y-2 text-on-surface-variant text-sm font-label">
              <span className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-primary" style={{ fontSize: 15 }}>calendar_today</span>
                {event.date}
                {event.end_time && (
                  <span className="text-on-surface-variant/60">&nbsp;— until {event.end_time}</span>
                )}
              </span>
              {locationStr && (
                <span className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-primary" style={{ fontSize: 15 }}>location_on</span>
                  {locationStr}
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── Body ── */}
      <section className="max-w-screen-xl mx-auto px-6 py-14">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-14">

          {/* ── Main ── */}
          <div className="lg:col-span-8 space-y-14">

            {/* Curated path (unchanged structure, side-stripe removed) */}
            {isCurated ? (
              <div>
                <h2 className="font-headline text-3xl font-bold mb-8 text-on-surface">The Experience</h2>
                <div className="text-on-surface-variant leading-[1.75] font-body text-lg space-y-6 max-w-[65ch]">
                  <p>{descData?.description || (catDesc ? catDesc.p1 + ' ' + catDesc.p2 : '')}</p>
                  {descData?.extras && (
                    <p className="text-sm text-on-surface-variant/70 italic">{descData.extras}</p>
                  )}
                  {catDesc?.extra1 && catDesc?.extra2 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-10">
                      {[catDesc.extra1, catDesc.extra2].map((ex) => (
                        <div
                          key={ex.title}
                          className="bg-surface-container-low rounded-xl border border-outline-variant/15 p-6"
                        >
                          <h4 className="font-headline font-semibold text-on-surface mb-2">{ex.title}</h4>
                          <p className="text-sm text-on-surface-variant">{ex.body}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* ── Non-curated content (redesigned) ── */
              <div className="space-y-10">

                {/* Description */}
                {event.description ? (
                  <div>
                    <h2 className="font-headline text-2xl font-bold mb-5 text-on-surface">About this event</h2>
                    <p className="text-on-surface-variant leading-[1.8] font-body text-[1.0625rem] max-w-[65ch] whitespace-pre-line">
                      {event.description}
                    </p>
                  </div>
                ) : (
                  <div className="flex items-start gap-3 py-2 text-on-surface-variant/45">
                    <span className="material-symbols-outlined text-sm mt-0.5 flex-shrink-0">info</span>
                    <p className="text-sm italic">The host hasn't added a description yet.</p>
                  </div>
                )}

                {/* What to Expect — featured callout, full border, no side-stripe */}
                {event.extras && (
                  <div className="rounded-2xl bg-surface-container border border-outline-variant/20 p-6 md:p-8">
                    <div className="flex items-center gap-2 mb-4">
                      <span
                        className="material-symbols-outlined text-primary"
                        style={{ fontSize: 18, fontVariationSettings: "'FILL' 1" }}
                      >
                        auto_awesome
                      </span>
                      <h3 className="font-headline text-base font-semibold text-on-surface">
                        What to expect
                      </h3>
                    </div>
                    <p className="text-sm text-on-surface-variant leading-[1.75] max-w-[58ch]">
                      {event.extras}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Attendees */}
            <AttendeeList eventId={id} currentUserId={user?.id} isHost={isOwnEvent} />
            {going && isPast(event.starts_at) && (
              <ConnectionPrompt eventId={id} userId={user?.id} eventTitle={event.title} />
            )}

            {/* Reviews */}
            {reviews.length > 0 && (
              <div>
                <div className="flex items-center gap-3 mb-6 flex-wrap">
                  <h2 className="font-headline text-2xl font-bold text-on-surface">Reviews</h2>
                  <div className="flex items-center gap-2 text-sm text-on-surface-variant">
                    <Stars value={avgRating} size={13} />
                    <span>{avgRating.toFixed(1)}</span>
                    <span className="text-on-surface-variant/60">({reviews.length})</span>
                  </div>
                </div>
                <div className="space-y-3">
                  {reviews.map((review) => {
                    const isAnon = review.anonymous;
                    // Hosts see trust level for anonymous reviews; everyone else sees nothing identifying.
                    const displayLabel = isAnon
                      ? (isOwnEvent && review.trust_level > 0
                          ? `Anonymous attendee · Trust level ${review.trust_level}`
                          : 'Anonymous attendee')
                      : (review.display_name || 'Attendee');

                    return (
                      <div
                        key={review.id}
                        className="rounded-2xl border border-outline-variant/10 bg-surface-container-low/80 p-5"
                      >
                        <div className="flex items-center gap-3 mb-2">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 ${isAnon ? 'bg-surface-container-highest' : avatarBg(displayLabel)}`}
                          >
                            {isAnon
                              ? <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: 16 }}>person</span>
                              : getInitials(displayLabel)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-on-surface">{displayLabel}</p>
                            <Stars value={review.rating} size={11} />
                          </div>
                          <p className="text-xs text-on-surface-variant/70 flex-shrink-0">
                            {shortDate(review.created_at)}
                          </p>
                        </div>
                        {review.review_text && (
                          <p className="text-sm text-on-surface-variant leading-relaxed mt-2 pl-11">
                            {review.review_text}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* ── Sidebar ── */}
          <div className="lg:col-span-4">
            <div className="sticky top-24 space-y-4">

              {/* ── RSVP card ── */}
              <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-low/95 backdrop-blur-sm">

                {/* Price row */}
                <div className="px-6 pt-6 pb-5 border-b border-outline-variant/10">
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <p className="text-xs text-on-surface-variant/60 font-label mb-1">Entry fee</p>
                      <p className="font-headline text-2xl font-bold text-on-surface">{event.price}</p>
                    </div>
                    {attendeeCount > 0 && (
                      <p className="text-xs text-primary font-semibold font-label pb-0.5">
                        {attendeeCount} going
                      </p>
                    )}
                  </div>
                </div>

                {/* CTA */}
                <div className="px-6 py-5 space-y-2">
                  {isOwnEvent ? (
                    <>
                      <div className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-primary/10 border border-primary/20 text-primary font-bold text-sm">
                        <span
                          className="material-symbols-outlined text-base"
                          style={{ fontVariationSettings: "'FILL' 1" }}
                        >
                          shield_person
                        </span>
                        You're hosting
                      </div>
                      <Button variant="secondary" size="sm" fullWidth icon="edit" onClick={() => navigate(`/create?eventId=${event.id}`)}>
                        Edit event details
                      </Button>
                      <button
                        onClick={() => setShowCancelEvent(true)}
                        className="w-full text-xs text-on-surface-variant/40 hover:text-error transition-colors py-1 cursor-pointer"
                      >
                        Cancel event
                      </button>
                    </>
                  ) : pending ? (
                    <>
                      <div className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-surface-container border border-outline-variant/25 text-on-surface-variant font-bold text-sm">
                        <span className="material-symbols-outlined text-base">hourglass_top</span>
                        Awaiting host approval
                      </div>
                      <button
                        onClick={() => setShowCancelModal(true)}
                        className="w-full text-xs text-on-surface-variant/40 hover:text-error transition-colors py-1 cursor-pointer"
                      >
                        Withdraw request
                      </button>
                    </>
                  ) : awaitingPayment ? (
                    <>
                      <Button variant="primary" size="lg" fullWidth onClick={handleRsvp}>
                        {`Pay ${formatPaise(event.price_paise)} to confirm`}
                      </Button>
                      <p className="text-xs text-on-surface-variant/80 text-center leading-snug px-2">
                        {dueLabel
                          ? `The host approved you. Your spot is held until ${dueLabel}; after that it goes to someone else.`
                          : 'The host approved you. Your spot is held until you pay.'}
                      </p>
                      <button
                        onClick={() => setShowCancelModal(true)}
                        className="w-full text-xs text-on-surface-variant/40 hover:text-error transition-colors py-1 cursor-pointer"
                      >
                        Give up my spot
                      </button>
                    </>
                  ) : going ? (
                    <>
                      <Button variant="secondary" size="lg" fullWidth icon="check_circle" onClick={() => navigate('/my-events')}>
                        You're Going
                      </Button>
                      <CalendarMenuButton event={event} variant="full" />
                      <Button
                        variant="ghost"
                        size="sm"
                        fullWidth
                        onClick={() => navigate(`/chat?event=${event.id}`)}
                      >
                        <span className="material-symbols-outlined text-sm mr-1">chat</span>
                        Group chat
                      </Button>
                      <button
                        onClick={() => setShowCancelModal(true)}
                        className="w-full text-xs text-on-surface-variant/40 hover:text-error transition-colors py-1 cursor-pointer"
                      >
                        Cancel RSVP
                      </button>
                    </>
                  ) : isFull ? (
                    <div className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-surface-container border border-outline-variant/25 text-on-surface-variant font-bold text-sm">
                      <span className="material-symbols-outlined text-base">group_off</span>
                      Event full
                    </div>
                  ) : (
                    <Button variant="primary" size="lg" fullWidth onClick={handleRsvp}>
                      {event.access === 'approval'
                        ? 'Request to join'
                        : paid
                          ? `Buy ticket · ${formatPaise(event.price_paise)}`
                          : 'Reserve my spot'}
                    </Button>
                  )}

                  {/* A stranger from a shared link has no idea what she is joining
                      or why the address is missing. Saying it here turns the
                      bounce to /auth into an expected step. */}
                  {!user && (
                    <p className="text-xs text-on-surface-variant/80 text-center leading-snug px-2 pt-1">
                      Women only. Everyone verifies with a selfie before she can RSVP or message.
                    </p>
                  )}

                  {/* Unconditional: hosts promote, attendees bring friends, and
                      someone who cannot RSVP yet can still pass the link on. */}
                  <Button variant="ghost" size="sm" fullWidth icon="ios_share" onClick={handleShare}>
                    Share this event
                  </Button>
                </div>

                {/* Event details summary — Luma-style, below the CTA */}
                <div className="px-6 pb-6 pt-1 border-t border-outline-variant/10 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="flex items-start gap-2.5 text-sm text-on-surface-variant flex-1">
                      <span
                        className="material-symbols-outlined text-primary flex-shrink-0"
                        style={{ fontSize: 15, marginTop: 1 }}
                      >
                        calendar_today
                      </span>
                      <span className="leading-snug">
                        {event.date}
                        {event.end_time && (
                          <span className="block text-xs text-on-surface-variant/70 mt-0.5">
                            Until {event.end_time}
                          </span>
                        )}
                      </span>
                    </div>
                    {going && <CalendarMenuButton event={event} variant="compact" />}
                  </div>

                  {locationStr && (
                    <div className="flex items-start gap-2.5 text-sm text-on-surface-variant">
                      <span
                        className="material-symbols-outlined text-primary flex-shrink-0"
                        style={{ fontSize: 15, marginTop: 1 }}
                      >
                        location_on
                      </span>
                      <span className="leading-snug">
                        {locationStr}
                        {!user && (
                          <span className="block text-xs text-on-surface-variant/70 mt-0.5">
                            Exact address shared with members
                          </span>
                        )}
                      </span>
                    </div>
                  )}

                  {event.capacity > 0 && (
                    <div className="flex items-start gap-2.5 text-sm text-on-surface-variant">
                      <span
                        className="material-symbols-outlined text-primary flex-shrink-0"
                        style={{ fontSize: 15, marginTop: 1 }}
                      >
                        group
                      </span>
                      <span>Limited to {event.capacity} guests</span>
                    </div>
                  )}

                  <div className="flex items-start gap-2.5 text-sm text-on-surface-variant">
                    <span
                      className="material-symbols-outlined text-primary flex-shrink-0"
                      style={{ fontSize: 15, marginTop: 1 }}
                    >
                      {access.icon}
                    </span>
                    <span>{access.label}</span>
                  </div>
                </div>
              </div>

              {/* ── Host card ── */}
              <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-low/95 backdrop-blur-sm px-6 py-5">
                <p className="text-xs font-bold text-on-surface-variant/60 uppercase tracking-widest mb-4">
                  Hosted by
                </p>
                <div className="flex items-center gap-3.5">
                  <div
                    className={`w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold text-white border-2 border-primary/15 flex-shrink-0 transition-all ${avatarBg(hostName)} ${!isCurated && event.creator_id ? 'cursor-pointer hover:ring-2 hover:ring-primary/30 hover:border-primary/30' : ''}`}
                    onClick={() => {
                      if (!isCurated && event.creator_id)
                        navigate(event.creator_id === user?.id ? '/profile' : `/profile/${event.creator_id}`);
                    }}
                  >
                    {getInitials(hostName)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p
                      className={`font-headline font-semibold text-on-surface truncate ${!isCurated && event.creator_id ? 'cursor-pointer hover:text-primary transition-colors' : ''}`}
                      onClick={() => {
                        if (!isCurated && event.creator_id)
                          navigate(event.creator_id === user?.id ? '/profile' : `/profile/${event.creator_id}`);
                      }}
                    >
                      {hostName}
                    </p>
                    {hostMeta.eventsHosted > 0 && (
                      <p className="text-xs text-on-surface-variant mt-0.5">
                        {hostMeta.eventsHosted} {hostMeta.eventsHosted === 1 ? 'event' : 'events'} hosted
                      </p>
                    )}
                    {hostMeta.memberSince && (
                      <p className="text-xs text-on-surface-variant/70">{hostMeta.memberSince}</p>
                    )}
                  </div>

                  {/* Report / block — only for non-own, non-curated events */}
                  {!isCurated && event.creator_id && event.creator_id !== user?.id && user && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => setShowReportHost(true)}
                        className="p-1.5 rounded-lg text-on-surface-variant/50 hover:text-error hover:bg-error-container/15 transition-all"
                        title="Report host"
                        aria-label="Report host"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>flag</span>
                      </button>
                      <button
                        disabled={blockingHost}
                        onClick={async () => {
                          setBlockingHost(true);
                          try {
                            await trustService.blockUser(user.id, event.creator_id);
                            showToast('Host blocked.');
                            navigate(-1);
                          } catch {
                            showToast('Could not block. Try again.');
                          } finally {
                            setBlockingHost(false);
                          }
                        }}
                        className="p-1.5 rounded-lg text-on-surface-variant/50 hover:text-error hover:bg-error-container/15 transition-all disabled:opacity-40"
                        title="Block host"
 aria-label="Block host"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>block</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {showReportHost && (
                <ReportModal
                  isOpen={showReportHost}
                  onClose={() => setShowReportHost(false)}
                  reporterId={user?.id}
                  reportedUserId={event.creator_id}
                  eventId={event.id}
                  eventTitle={event.title}
                />
              )}

            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
