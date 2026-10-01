/**
 * MyEvents.jsx
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { useMyEvents } from '../lib/useMyEvents';
import { formatTime } from '../lib/date';
import { CAT_ICONS, EVENTS_DESC } from '../data/events';
import { fetchRsvpCounts, fetchAttendeeAvatars, formatPaymentDue } from '../lib/useRsvp';
import { cancelRsvp } from '../lib/cancelRsvp';
import { supabase } from '../lib/supabase';
import { eventsService } from '../services/events.service';
import Footer from '../components/Footer';
import Button from '../components/ui/Button';
import AttendeeStack from '../components/events/AttendeeStack';
import { CancelEventModal, CancelConfirmModal } from '../components/modals';
import { useToast } from '../components/Toast';
import CalendarMenuButton from '../components/CalendarMenuButton';
import CustomDateTimePicker, { toInputStr, CustomTimePicker } from '../components/CustomDateTimePicker';

// ─── Date column helper ───────────────────────────────────────────────────────

function parseDateColumn(event) {
  if (event.starts_at) {
    const d = new Date(event.starts_at);
    const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
    const DAYS   = ['SUN','MON','TUE','WED','THU','FRI','SAT'];
    return { month: MONTHS[d.getMonth()], day: String(d.getDate()), dow: DAYS[d.getDay()] };
  }
  if (!event.date) return null;
  const s = String(event.date);
  if (/tonight/i.test(s)) return { month: null, day: null, dow: 'NOW' };
  const dayMatch = s.match(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)/i);
  if (dayMatch) return { month: null, day: null, dow: dayMatch[1].toUpperCase() };
  const monthDay = s.match(/^([A-Za-z]{3})\s+(\d+)/);
  if (monthDay) return { month: monthDay[1].toUpperCase(), day: monthDay[2], dow: null };
  const dayMonth = s.match(/^(\d{1,2})\s+([A-Za-z]{3})/);
  if (dayMonth) return { month: dayMonth[2].toUpperCase(), day: dayMonth[1], dow: null };
  return null;
}

// ─── Star picker ──────────────────────────────────────────────────────────────

function StarPicker({ value, onChange }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex items-center gap-0.5 mb-4">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          onMouseEnter={() => setHovered(star)}
          onMouseLeave={() => setHovered(0)}
          className="p-1.5 transition-transform hover:scale-110"
        >
          <span
            className={`material-symbols-outlined transition-colors ${
              star <= (hovered || value) ? 'text-primary' : 'text-on-surface-variant/25'
            }`}
            style={{ fontSize: 26, fontVariationSettings: star <= (hovered || value) ? "'FILL' 1" : "'FILL' 0" }}
          >
            star
          </span>
        </button>
      ))}
      {value > 0 && (
        <span className="ml-2 text-xs text-on-surface-variant/60">
          {['', 'Poor', 'Fair', 'Good', 'Great', 'Amazing'][value]}
        </span>
      )}
    </div>
  );
}

// ─── Review modal ─────────────────────────────────────────────────────────────

function ReviewModal({ event, userId, onClose, onSubmit }) {
  const showToast = useToast();
  const [rating, setRating] = useState(0);
  const [note,   setNote]   = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (rating === 0) return;
    setSaving(true);
    // supabase-js doesn't throw — check the error, or a failed insert would
    // still mark the event "Note left" and the user could never retry.
    const { error } = await supabase.from('reviews').insert({
      user_id:     userId,
      event_id:    String(event.id),
      rating,
      review_text: note.trim() || null,
      created_at:  new Date().toISOString(),
    });
    setSaving(false);
    if (error) {
      showToast('Could not save your note. Please try again.');
      return;
    }
    onSubmit();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-background/80 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md bg-surface-container rounded-2xl border border-outline-variant/20 shadow-xl p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-headline text-xl font-bold text-on-surface mb-0.5">{event.title}</h2>
        <p className="text-xs text-on-surface-variant/60 mb-5">Leave a note about your experience</p>
        <form onSubmit={handleSubmit}>
          <StarPicker value={rating} onChange={setRating} />
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="How was it? What made it memorable? (optional)"
            rows={4}
            className="w-full bg-surface-container-high border border-outline-variant/20 rounded-xl px-4 py-3 text-[16px] md:text-sm text-on-surface placeholder:text-on-surface-variant/35 resize-none focus:outline-none focus:border-primary/40 transition-colors mb-4"
          />
          <div className="flex items-center gap-3 justify-end">
            <button type="button" onClick={onClose} className="text-sm text-on-surface-variant hover:text-on-surface transition-colors">Cancel</button>
            <button
              type="submit"
              disabled={rating === 0 || saving}
              className="text-sm font-bold px-5 py-2.5 bg-primary text-on-primary rounded-xl hover:brightness-110 disabled:opacity-50 transition-all"
            >
              {saving ? 'Saving…' : 'Leave note'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Manage modal ─────────────────────────────────────────────────────────────

function ManageModal({ event, userId, onClose, onCancelled, onSaved }) {
  const showToast = useToast();
  const [showCancelEvent, setShowCancelEvent] = useState(false);
  const [cancellingEvent, setCancellingEvent] = useState(false);
  const [activeTab, setActiveTab] = useState('details');
  const [form, setForm] = useState({
    title:       event.title       || '',
    venue:       event.venue       || '',
    description: event.description || '',
    price:       event.price       || '',
  });
  const [startsAt,    setStartsAt]    = useState(event.starts_at ? toInputStr(new Date(event.starts_at)) : '');
  const [endTime,     setEndTime]     = useState(event.end_time || '');
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [saved,       setSaved]       = useState(false);
  const [rsvps,       setRsvps]       = useState([]);
  const [rsvpsLoading, setRsvpsLoading] = useState(false);
  // An approval on a paid event is a held seat until paid, not "going".
  const goingCount    = rsvps.filter((r) => r.status !== 'pending' && !r.payment_due_at).length;
  const awaitingCount = rsvps.filter((r) => r.status === 'approved' && r.payment_due_at).length;
  const pendingCount  = rsvps.filter((r) => r.status === 'pending').length;

  useEffect(() => {
    if (activeTab !== 'rsvps') return;
    setRsvpsLoading(true);
    supabase
      .from('rsvps')
      .select('user_id, status, payment_due_at, profiles:public_profiles!user_id(display_name, avatar_url)')
      .eq('event_id', String(event.id))
      .then(({ data }) => { setRsvps((data || []).filter((r) => r.status !== 'rejected')); setRsvpsLoading(false); });
  }, [activeTab, event.id]);

  function handleSubmit(e) {
    e.preventDefault();
    setShowConfirm(true);
  }

  async function handleSave() {
    setShowConfirm(false);
    setSaving(true);
    try {
      // Regenerate the free-text `date` label from starts_at so both stay in
      // sync (same format as create). starts_at is the source of truth.
      const startDate = startsAt ? new Date(startsAt) : null;
      const priceDigits = String(form.price || '').replace(/[^0-9.]/g, '');
      const priceRupees = priceDigits ? parseFloat(priceDigits) : 0;
      const pricePaise  = priceRupees > 0 ? Math.round(priceRupees * 100) : 0;
      const priceLabel  = pricePaise > 0 ? `₹${Math.round(priceRupees)}` : 'Free';
      const dateLabel = startDate
        ? startDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) +
          ' · ' + startDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
        : event.date;
      // supabase doesn't throw — check the error or a failed write (RLS,
      // network) would still show "Saved" and notify attendees.
      const { error: updateError } = await supabase
        .from('events')
        .update({
          title: form.title,
          venue: form.venue,
          description: form.description,
          price: priceLabel,
          // price_paise is what checkout charges. Keep it in lockstep with the
          // display label so "Free" can never still charge ₹400 (or vice versa).
          price_paise: pricePaise,
          end_time: endTime || '',
          ...(startDate ? { starts_at: startDate.toISOString(), date: dateLabel } : {}),
        })
        .eq('id', event.id);
      if (updateError) throw updateError;

      // Notify all attendees
      const { data: rsvpData } = await supabase
        .from('rsvps').select('user_id').eq('event_id', String(event.id));
      const notifs = (rsvpData || [])
        .filter((r) => r.user_id !== userId)
        .map((r) => ({
          user_id:    r.user_id,
          type:       'event_updated',
          title:      'Event updated',
          body:       `"${form.title}" has been updated by the host.`,
          event_id:   String(event.id),
          created_at: new Date().toISOString(),
          read:       false,
        }));
      if (notifs.length) await supabase.from('notifications').insert(notifs);

      onSaved?.();
      setSaved(true);
      setTimeout(() => { setSaved(false); onClose(); }, 1200);
    } catch (err) {
      showToast(err?.message || 'Could not save changes. Try again.');
    }
    setSaving(false);
  }

  async function handleCancelEvent(note) {
    setCancellingEvent(true);
    try {
      await eventsService.cancelEvent(event.id, note);
      setShowCancelEvent(false);
      onClose();
      onCancelled?.();
      showToast('Event cancelled. Attendees have been notified.');
    } catch (err) {
      showToast(err.message || 'Could not cancel the event. Try again.');
    } finally {
      setCancellingEvent(false);
    }
  }

  const FIELDS = [
    { key: 'title',       label: 'Title',       type: 'text' },
    { key: 'venue',       label: 'Venue',       type: 'text' },
    { key: 'price',       label: 'Price',       type: 'text', placeholder: 'e.g. ₹400 or Free' },
  ];

  return (
    <>
    {showCancelEvent && (
      <CancelEventModal
        eventTitle={event.title}
        busy={cancellingEvent}
        onConfirm={handleCancelEvent}
        onClose={() => setShowCancelEvent(false)}
      />
    )}
    {showConfirm && (
      <div className="fixed inset-0 z-[500] flex items-center justify-center px-6 bg-background/80 backdrop-blur-xl" onClick={() => setShowConfirm(false)}>
        <div className="w-full max-w-sm bg-surface-container-low rounded-2xl p-8 border border-outline-variant/30" onClick={(e) => e.stopPropagation()}>
          <div className="w-12 h-12 bg-primary/15 rounded-xl flex items-center justify-center mx-auto mb-5">
            <span className="material-symbols-outlined text-primary text-2xl">edit_calendar</span>
          </div>
          <h3 className="font-headline text-xl font-bold text-on-surface text-center mb-2">
            Save changes?
          </h3>
          <p className="text-on-surface-variant text-sm text-center leading-relaxed mb-6">
            All attendees of{' '}
            <span className="text-on-surface font-semibold">{event.title}</span>{' '}
            will be notified of the updated details.
          </p>
          <div className="flex gap-3">
            <Button variant="secondary" fullWidth onClick={() => setShowConfirm(false)}>
              Keep editing
            </Button>
            <Button variant="primary" fullWidth onClick={handleSave}>
              Save &amp; notify
            </Button>
          </div>
        </div>
      </div>
    )}
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-background/80 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg bg-surface-container rounded-2xl border border-outline-variant/20 shadow-xl" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-outline-variant/15">
          <div>
            <h2 className="font-headline text-lg font-bold text-on-surface">Manage event</h2>
            <p className="text-xs text-on-surface-variant/60 mt-0.5 truncate max-w-xs">{event.title}</p>
          </div>
          <button onClick={onClose} className="w-11 h-11 flex items-center justify-center rounded-full hover:bg-surface-container-high text-on-surface-variant transition-colors">
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
          </button>
        </div>

        {/* Sub-tabs */}
        <div className="flex gap-6 px-6 border-b border-outline-variant/15">
          {[['details', 'Edit details'], ['rsvps', 'RSVP requests']].map(([id, label]) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`text-xs font-bold py-3.5 border-b-2 transition-colors ${
                activeTab === id
                  ? 'text-primary border-primary'
                  : 'text-on-surface-variant/60 border-transparent hover:text-on-surface'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="p-6 max-h-[60vh] overflow-y-auto">
          {activeTab === 'details' ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-[0.14em] text-on-surface-variant/70 mb-1.5 font-label">Date &amp; Time</label>
                <CustomDateTimePicker value={startsAt} onChange={setStartsAt} />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-[0.14em] text-on-surface-variant/70 mb-1.5 font-label">End time (optional)</label>
                <div className="flex items-center gap-2">
                  <CustomTimePicker value={endTime} onChange={setEndTime} />
                  {endTime && (
                    <button
                      type="button"
                      onClick={() => setEndTime('')}
                      className="p-1.5 rounded-lg text-on-surface-variant/60 hover:text-on-surface hover:bg-surface-container-high transition-colors"
                      title="Clear end time"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
                    </button>
                  )}
                </div>
              </div>
              {FIELDS.map(({ key, label, type, placeholder }) => (
                <div key={key}>
                  <label className="block text-[10px] font-bold uppercase tracking-[0.14em] text-on-surface-variant/70 mb-1.5 font-label">{label}</label>
                  <input
                    type={type}
                    value={form[key]}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className="w-full bg-surface-container-high border border-outline-variant/20 rounded-xl px-4 py-2.5 text-[16px] md:text-sm text-on-surface placeholder:text-on-surface-variant/35 focus:outline-none focus:border-primary/40 transition-colors"
                  />
                </div>
              ))}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-[0.14em] text-on-surface-variant/70 mb-1.5 font-label">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={3}
                  className="w-full bg-surface-container-high border border-outline-variant/20 rounded-xl px-4 py-2.5 text-[16px] md:text-sm text-on-surface resize-none focus:outline-none focus:border-primary/40 transition-colors"
                />
              </div>
              <div className="flex items-center justify-between pt-2">
                <p className="text-xs text-on-surface-variant/70">Attendees will be notified of changes.</p>
                <button
                  type="submit"
                  disabled={saving || saved}
                  className="flex items-center gap-1.5 text-sm font-bold px-5 py-2.5 bg-primary text-on-primary rounded-xl hover:brightness-110 disabled:opacity-60 transition-all"
                >
                  {saved
                    ? <><span className="material-symbols-outlined" style={{ fontSize: 15, fontVariationSettings: "'FILL' 1" }}>check_circle</span>Saved</>
                    : saving ? 'Saving…' : 'Save changes'}
                </button>
              </div>

              <div className="mt-2 pt-4 border-t border-outline-variant/15 flex items-center justify-between">
                <p className="text-xs text-on-surface-variant/50">Cancelling notifies attendees and removes the event.</p>
                <button
                  type="button"
                  onClick={() => setShowCancelEvent(true)}
                  className="text-sm font-bold px-4 py-2 rounded-xl text-error border border-error/30 hover:bg-error/10 transition-colors"
                >
                  Cancel event
                </button>
              </div>
            </form>
          ) : rsvpsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3 animate-pulse">
                  <div className="w-9 h-9 rounded-full bg-surface-container-high" />
                  <div className="h-3 bg-surface-container-high rounded w-36" />
                </div>
              ))}
            </div>
          ) : rsvps.length === 0 ? (
            <div className="text-center py-12">
              <span className="material-symbols-outlined text-on-surface-variant/30 text-3xl block mb-3">group</span>
              <p className="text-sm text-on-surface-variant/50">No RSVPs yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-on-surface-variant/70 mb-4">
                {goingCount} {goingCount === 1 ? 'person' : 'people'} going
                {awaitingCount > 0 && ` · ${awaitingCount} awaiting payment`}
                {pendingCount > 0 && ` · ${pendingCount} pending`}
              </p>
              {rsvps.map((r) => (
                <div key={r.user_id} className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-surface-container-high overflow-hidden flex-shrink-0">
                    {r.profiles?.avatar_url ? (
                      <img src={r.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="material-symbols-outlined text-on-surface-variant/40" style={{ fontSize: 16 }}>person</span>
                      </div>
                    )}
                  </div>
                  <span className="text-sm text-on-surface flex-1 min-w-0 truncate">
                    {r.profiles?.display_name || 'Anonymous'}
                    {r.status === 'approved' && r.payment_due_at && (
                      <span className="block text-[11px] text-on-surface-variant/70">
                        Awaiting payment · until {formatPaymentDue(r.payment_due_at)}
                      </span>
                    )}
                  </span>
                  {r.status === 'pending' && (
                    <span className="text-[10px] font-bold uppercase tracking-wide text-status-pending bg-status-pending/10 border border-status-pending/20 px-2 py-0.5 rounded-full flex-shrink-0">
                      Pending
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
    </>
  );
}

// ─── Event card ───────────────────────────────────────────────────────────────

function MyEventCard({ event, tab, userId, attendeeCount, attendees, onChanged, rsvp }) {
  const navigate    = useNavigate();
  const dateCol     = parseDateColumn(event);
  const cat         = event.cat || event.category;
  const imgSrc      = event.img || event.image_url;
  const timeStr     = formatTime(event.starts_at);
  const catLabel    = (cat || '').toUpperCase();
  const venue       = [event.venue, event.city].filter(Boolean).join(', ');
  const note        = EVENTS_DESC[String(event.id)]?.extras || event.description || null;

  const [hasReviewed, setHasReviewed] = useState(() => {
    try { return !!localStorage.getItem(`review_${userId}_${event.id}`); } catch { return false; }
  });
  const [showReview,  setShowReview]  = useState(false);
  const [showManage,  setShowManage]  = useState(false);
  const [showCancel,  setShowCancel]  = useState(false);

  const cardToast = useToast();

  // Shares EventDetail's cancel path rather than reimplementing it — a paid
  // seat has to be refunded before it is released, and a second copy of that
  // would be a second chance to drop someone's ticket without their money back.
  async function handleCancelRsvp() {
    setShowCancel(false);
    await cancelRsvp({
      event,
      wasGoing: rsvp.isGoing(event.id),
      toggleRsvp: rsvp.toggleRsvp,
      refreshRsvps: rsvp.refresh,
      showToast: cardToast,
    });
    onChanged?.();
  }

  // Sync hasReviewed with the DB so it persists across sessions/devices
  useEffect(() => {
    if (tab !== 'past' || hasReviewed || !userId) return;
    supabase
      .from('reviews')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('event_id', String(event.id))
      .then(({ count }) => {
        if ((count ?? 0) > 0) {
          try { localStorage.setItem(`review_${userId}_${event.id}`, '1'); } catch {}
          setHasReviewed(true);
        }
      });
  }, [tab, userId, event.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleReviewSubmit() {
    try { localStorage.setItem(`review_${userId}_${event.id}`, '1'); } catch {}
    setHasReviewed(true);
    setShowReview(false);
  }

  return (
    <>
      <div className="rounded-2xl bg-surface-container-low border border-outline-variant/15 p-4 sm:p-5 hover:border-outline-variant/30 transition-colors">
        <div className="flex gap-3 sm:gap-4">

          {/* Date column */}
          {dateCol && (
            <div className="flex-shrink-0 w-[58px] rounded-xl bg-surface-container flex flex-col items-center justify-center py-3 gap-0.5 self-start mt-0.5">
              {dateCol.month && (
                <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-on-surface-variant/70 font-label leading-none">
                  {dateCol.month}
                </span>
              )}
              {dateCol.day && (
                <span className="font-headline text-[1.6rem] font-bold text-on-surface leading-none my-0.5">
                  {dateCol.day}
                </span>
              )}
              {dateCol.dow && (
                <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-on-surface-variant/70 font-label leading-none">
                  {dateCol.dow}
                </span>
              )}
            </div>
          )}

          {/* Thumbnail */}
          <div
            className="w-[88px] h-[88px] sm:w-[100px] sm:h-[100px] rounded-xl overflow-hidden flex-shrink-0 bg-surface-container cursor-pointer"
            onClick={() => navigate(`/event/${event.id}`)}
          >
            {imgSrc ? (
              <img src={imgSrc} alt="" className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                onError={(e) => { e.target.style.display = 'none'; }} />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="material-symbols-outlined text-on-surface-variant/40" style={{ fontSize: 26 }}>{CAT_ICONS[cat] || 'star'}</span>
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 flex flex-col">

            {/* Top row: category·time + status badge */}
            <div className="flex items-start justify-between gap-2 mb-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-on-surface-variant/70 font-label leading-none pt-0.5">
                {[catLabel, timeStr].filter(Boolean).join(' · ')}
              </p>
              {tab === 'upcoming' && (
                <span className="flex-shrink-0 inline-flex items-center gap-1 text-[10px] font-bold text-on-surface border border-outline-variant/30 px-2 py-0.5 rounded-full">
                  <span className="material-symbols-outlined text-primary" style={{ fontSize: 11, fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                  Going
                </span>
              )}
              {tab === 'hosting' && (
                <span className="flex-shrink-0 text-[10px] font-bold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full">
                  ★ Hosting
                </span>
              )}
              {tab === 'past' && (
                <span className="flex-shrink-0 text-[10px] font-bold text-on-surface-variant border border-outline-variant/20 px-2 py-0.5 rounded-full">
                  Attended
                </span>
              )}
            </div>

            {/* Title */}
            <h3
              className="font-headline text-[15px] font-semibold text-on-surface leading-snug mb-1.5 cursor-pointer hover:text-primary transition-colors line-clamp-2"
              onClick={() => navigate(`/event/${event.id}`)}
            >
              {event.title}
            </h3>

            {/* Venue */}
            {venue && (
              <p className="flex items-center gap-1 text-xs text-on-surface-variant/60">
                <span className="material-symbols-outlined flex-shrink-0" style={{ fontSize: 12 }}>location_on</span>
                <span className="truncate">{venue}</span>
              </p>
            )}

            {/* Note (dashed box) — hidden on past tab; also hidden when note duplicates title */}
            {note && tab !== 'past' && note.trim().toLowerCase() !== (event.title || '').trim().toLowerCase() && (
              <p className="mt-2 text-xs text-on-surface-variant/70 italic border border-dashed border-outline-variant/30 rounded-lg px-3 py-2 leading-relaxed">
                {note}
              </p>
            )}
          </div>
        </div>

        {/* Footer row (full-width, separated): attendees + actions */}
        <div className="mt-4 pt-3 border-t border-outline-variant/10 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            {attendeeCount > 0 ? (
              <AttendeeStack
                attendees={attendees || []}
                total={attendeeCount}
                size="sm"
                verb={tab === 'past' ? 'attended' : 'going'}
                quiet={tab === 'past'}
              />
            ) : (
              <span className="text-xs text-on-surface-variant/60">No RSVPs yet</span>
            )}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {tab === 'upcoming' && <CalendarMenuButton event={event} variant="icon" />}
            {tab === 'upcoming' && event.creator_id !== userId && (
              <button
                onClick={(e) => { e.stopPropagation(); setShowCancel(true); }}
                className="text-[11px] font-semibold text-on-surface-variant border border-outline-variant/25 px-3 py-1.5 rounded-xl hover:border-error/40 hover:text-error transition-all"
              >
                Cancel
              </button>
            )}
            {tab === 'hosting' && (
              <button
                onClick={(e) => { e.stopPropagation(); setShowManage(true); }}
                className="text-[11px] font-semibold text-on-surface border border-outline-variant/25 px-3 py-1.5 rounded-xl hover:border-primary/40 hover:text-primary transition-all"
              >
                Manage
              </button>
            )}
            {tab === 'past' && event.creator_id !== userId && !hasReviewed && (
              <button
                onClick={(e) => { e.stopPropagation(); setShowReview(true); }}
                className="text-[11px] font-semibold text-on-surface border border-outline-variant/25 px-3 py-1.5 rounded-xl hover:border-primary/40 hover:text-primary transition-all"
              >
                Leave a note
              </button>
            )}
            {tab === 'past' && event.creator_id !== userId && hasReviewed && (
              <span className="flex items-center gap-1 text-xs text-on-surface-variant/60">
                <span className="material-symbols-outlined" style={{ fontSize: 13, fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                Note left
              </span>
            )}
          </div>
        </div>
      </div>

      {showReview && (
        <ReviewModal event={event} userId={userId} onClose={() => setShowReview(false)} onSubmit={handleReviewSubmit} />
      )}
      {showManage && (
        <ManageModal event={event} userId={userId} onClose={() => setShowManage(false)} onCancelled={onChanged} onSaved={onChanged} />
      )}
      {showCancel && (
        <CancelConfirmModal
          eventTitle={event.title}
          onConfirm={handleCancelRsvp}
          onCancel={() => setShowCancel(false)}
        />
      )}
    </>
  );
}

// ─── Per-tab section header ───────────────────────────────────────────────────

const TAB_META = {
  upcoming: { eyebrow: 'Upcoming', heading: 'Your next rooms' },
  hosting:  { eyebrow: 'Hosting',  heading: "Rooms you're holding" },
  past:     { eyebrow: 'Past',     heading: "Where you've been" },
};

function TabSectionHeader({ tab, count }) {
  const { eyebrow, heading } = TAB_META[tab] || TAB_META.upcoming;
  const subtitles = {
    upcoming: count === 1 ? '1 evening on your calendar' : `${count} evenings on your calendar`,
    hosting:  "Events you're running",
    past:     "Events you've been to",
  };
  return (
    <div className="mb-8">
      <p className="text-xs font-bold uppercase tracking-[0.22em] text-primary/70 mb-2 font-label">{eyebrow}</p>
      <h2 className="font-headline text-3xl md:text-4xl font-bold text-on-surface leading-tight mb-1">{heading}</h2>
      <p className="text-sm text-on-surface-variant/60">{subtitles[tab]}</p>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

const EMPTY_STATES = {
  upcoming: { icon: 'calendar_month', message: "Nothing on the calendar yet.", cta: 'Browse events',   nav: '/discover' },
  hosting:  { icon: 'celebration',    message: "You haven't hosted anything yet.", cta: 'Create an event', nav: '/create'   },
  past:     { icon: 'auto_stories',   message: 'Nothing yet. Attend your first event and it will show up here.', cta: null },
};

function EmptyState({ tab, onCta }) {
  const { icon, message, cta } = EMPTY_STATES[tab] || EMPTY_STATES.upcoming;
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
        <span className="material-symbols-outlined text-primary text-3xl">{icon}</span>
      </div>
      <p className="text-on-surface-variant text-sm mb-5 max-w-xs leading-relaxed">{message}</p>
      {cta && onCta && <Button variant="primary" size="sm" onClick={onCta}>{cta}</Button>}
    </div>
  );
}

// ─── Error state ──────────────────────────────────────────────────────────────

function ErrorState({ onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-2xl bg-surface-container flex items-center justify-center mb-4">
        <span className="material-symbols-outlined text-on-surface-variant text-3xl">cloud_off</span>
      </div>
      <p className="text-on-surface-variant text-sm mb-5 max-w-xs leading-relaxed">
        Couldn't load your events. Check your connection and try again.
      </p>
      <Button variant="secondary" size="sm" onClick={onRetry}>Try again</Button>
    </div>
  );
}

// ─── Animated tab bar ─────────────────────────────────────────────────────────

const TAB_ICONS = { upcoming: 'calendar_month', hosting: 'star', past: 'history' };

function TabBar({ tabs, activeTab, onChange }) {
  const tabRefs = [null, null, null].map(() => null);
  const refs    = { current: tabRefs };
  const [indicator, setIndicator] = useState({ left: 4, width: 0 });

  useEffect(() => {
    const idx = tabs.findIndex((t) => t.id === activeTab);
    const el  = refs.current[idx];
    if (el) setIndicator({ left: el.offsetLeft, width: el.offsetWidth });
  }, [activeTab, tabs]);

  return (
    <div className="relative flex items-center gap-1 p-1 bg-surface-container rounded-2xl w-fit">
      <div
        className="absolute top-1 bottom-1 rounded-xl bg-primary pointer-events-none transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
        style={{ left: indicator.left, width: indicator.width }}
      />
      {tabs.map((tab, i) => (
        <button
          key={tab.id}
          ref={(el) => { refs.current[i] = el; }}
          onClick={() => onChange(tab.id)}
          className={`relative z-10 flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-colors duration-200 ${
            activeTab === tab.id ? 'text-on-primary' : 'text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 15 }}>{TAB_ICONS[tab.id]}</span>
          {tab.label}
          {tab.count !== undefined && tab.count > 0 && (
            <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full transition-colors duration-200 ${
              activeTab === tab.id ? 'bg-on-primary/20 text-on-primary' : 'bg-surface-container-high text-on-surface-variant'
            }`}>
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// ─── Discover nudge (past tab) ────────────────────────────────────────────────

function DiscoverNudge({ onExplore }) {
  return (
    <div className="mt-8 px-4 py-4 rounded-2xl bg-surface-container border border-outline-variant/10 flex items-center gap-3">
      <span className="material-symbols-outlined text-primary flex-shrink-0" style={{ fontSize: 22 }}>explore</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-on-surface leading-snug">Enjoyed these events?</p>
        <p className="text-xs text-on-surface-variant">Find more like them on Discover.</p>
      </div>
      <Button variant="secondary" size="sm" onClick={onExplore}>Explore</Button>
    </div>
  );
}

// ─── Hero header ──────────────────────────────────────────────────────────────

function HeroHeader({ upcomingEvents, hostingEvents, pastEvents, loading, navigate }) {
  const nextEvent   = upcomingEvents[0] || null;
  const nextTimeStr = nextEvent?.starts_at ? formatTime(nextEvent.starts_at) : (nextEvent?.date || '');
  const nextVenue   = nextEvent ? [nextEvent.venue, nextEvent.city].filter(Boolean).join(', ') : '';

  const stats = [
    { value: loading ? '—' : upcomingEvents.length, label: 'Going' },
    { value: loading ? '—' : hostingEvents.length,  label: 'Hosting' },
    { value: loading ? '—' : pastEvents.length,     label: 'Attended' },
  ];

  return (
    <div className="relative overflow-hidden border-b border-outline-variant/15">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -left-16 w-[480px] h-[320px] rounded-full bg-primary/[0.08] blur-[80px]" />
        <div className="absolute top-0 right-0 w-[320px] h-[240px] rounded-full bg-secondary/[0.06] blur-[70px]" />
      </div>

      <div className="relative max-w-screen-xl mx-auto px-6 md:px-12 pt-12 pb-10">
        <div className="flex flex-col lg:flex-row lg:items-start gap-8 lg:gap-16">

          {/* Left: copy + stats */}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-primary/70 mb-3 font-label">Your Calendar</p>
            <h1 className="font-headline text-4xl md:text-5xl font-bold text-on-surface leading-[1.08] mb-3">
              Plans worth keeping.
            </h1>
            <p className="text-sm text-on-surface-variant/70 leading-relaxed mb-8 max-w-sm">
              What's coming, what you're hosting, and where you've been.
            </p>

            <div className="flex items-center gap-0">
              {stats.map(({ value, label }, i) => (
                <div key={label} className="flex items-center">
                  <div className={i === 0 ? 'pr-7' : 'px-7'}>
                    <p className="font-headline text-[1.75rem] font-bold text-on-surface leading-none tabular-nums">{value}</p>
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-on-surface-variant/70 mt-1 font-label">{label}</p>
                  </div>
                  {i < stats.length - 1 && <div className="h-9 w-px bg-outline-variant/25 flex-shrink-0" />}
                </div>
              ))}
            </div>
          </div>

          {/* Right: Up Next card — compact thumbnail style, wider */}
          {!loading && nextEvent && (
            <div className="w-full lg:w-[420px] xl:w-[460px] flex-shrink-0">
              <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-low">
                <div className="p-5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary mb-4 font-label">Up Next</p>

                  <div
                    className="flex gap-4 cursor-pointer group mb-5"
                    onClick={() => navigate(`/event/${nextEvent.id}`)}
                  >
                    <div className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 bg-surface-container">
                      {(nextEvent.img || nextEvent.image_url) ? (
                        <img src={nextEvent.img || nextEvent.image_url} alt={nextEvent.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          onError={(e) => { e.target.style.display = 'none'; }} />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <span className="material-symbols-outlined text-on-surface-variant/40" style={{ fontSize: 22 }}>
                            {CAT_ICONS[nextEvent.cat || nextEvent.category] || 'event'}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3 className="font-headline text-base font-semibold text-on-surface leading-snug mb-2 group-hover:text-primary transition-colors line-clamp-2">
                        {nextEvent.title}
                      </h3>
                      <div className="space-y-1">
                        {nextTimeStr && (
                          <div className="flex items-center gap-1.5 text-xs text-on-surface-variant/65">
                            <span className="material-symbols-outlined text-primary/55 flex-shrink-0" style={{ fontSize: 13 }}>schedule</span>
                            {nextTimeStr}
                          </div>
                        )}
                        {nextVenue && (
                          <div className="flex items-center gap-1.5 text-xs text-on-surface-variant/65">
                            <span className="material-symbols-outlined text-primary/55 flex-shrink-0" style={{ fontSize: 13 }}>location_on</span>
                            <span className="truncate">{nextVenue}</span>
                          </div>
                        )}
                        {nextEvent.price && (
                          <div className="flex items-center gap-1.5 text-xs text-on-surface-variant/65">
                            <span className="material-symbols-outlined text-primary/55 flex-shrink-0" style={{ fontSize: 13 }}>confirmation_number</span>
                            {nextEvent.price}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => navigate(`/event/${nextEvent.id}`)}
                      className="flex-1 text-xs font-bold px-3 py-2.5 rounded-xl bg-primary text-on-primary hover:brightness-110 active:scale-[0.98] transition-all"
                    >
                      View details
                    </button>
                    <CalendarMenuButton event={nextEvent} variant="block" />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-2xl bg-surface-container-low border border-outline-variant/15 p-5 animate-pulse">
          <div className="flex gap-4">
            <div className="w-[58px] h-[80px] rounded-xl bg-surface-container flex-shrink-0" />
            <div className="w-[88px] h-[88px] rounded-xl bg-surface-container flex-shrink-0" />
            <div className="flex-1 space-y-2 pt-1">
              <div className="h-2.5 bg-surface-container rounded w-24" />
              <div className="h-4 bg-surface-container rounded w-3/4" />
              <div className="h-3 bg-surface-container rounded w-1/2" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function MyEvents() {
  const { user }   = useAuth();
  const navigate   = useNavigate();
  const [tab, setTab] = useState('upcoming');

  // `rsvp` comes from useMyEvents, which already holds one. Mounting a second
  // useRsvp here duplicated the fetch and collided on the realtime channel
  // topic, which crashed the page outright.
  const { upcomingEvents, hostingEvents, pastEvents, loading, error, retry, rsvp } =
    useMyEvents(user?.id);

  const [attendeeCounts,   setAttendeeCounts]   = useState({});
  const [attendeeProfiles, setAttendeeProfiles] = useState({});

  useEffect(() => {
    if (loading) return;
    const ids = [...upcomingEvents, ...hostingEvents, ...pastEvents].map((e) => String(e.id));
    if (!ids.length) return;
    Promise.all([fetchRsvpCounts(ids), fetchAttendeeAvatars(ids)]).then(([counts, profiles]) => {
      setAttendeeCounts(counts);
      setAttendeeProfiles(profiles);
    });
  }, [loading, upcomingEvents.length, hostingEvents.length, pastEvents.length]);

  const tabs = [
    { id: 'upcoming', label: 'Upcoming', count: !loading ? upcomingEvents.length : undefined },
    { id: 'hosting',  label: 'Hosting',  count: !loading ? hostingEvents.length  : undefined },
    { id: 'past',     label: 'Past',     count: !loading ? pastEvents.length      : undefined },
  ];

  const activeEvents = tab === 'upcoming' ? upcomingEvents : tab === 'hosting' ? hostingEvents : pastEvents;

  function renderCards() {
    return activeEvents.map((event) => (
      <MyEventCard
        key={event.id}
        event={event}
        tab={tab}
        userId={user?.id}
        attendeeCount={attendeeCounts[String(event.id)] || 0}
        attendees={attendeeProfiles[String(event.id)] || []}
        onChanged={retry}
        rsvp={rsvp}
      />
    ));
  }

  return (
    <div className="page-enter">

      <HeroHeader
        upcomingEvents={upcomingEvents}
        hostingEvents={hostingEvents}
        pastEvents={pastEvents}
        loading={loading}
        navigate={navigate}
      />

      <div className="max-w-3xl mx-auto px-6 pt-8 pb-32">

        {/* Tab bar */}
        <div className="mb-8">
          <TabBar tabs={tabs} activeTab={tab} onChange={setTab} />
        </div>

        {/* Per-tab heading */}
        {!loading && !error && (
          <TabSectionHeader tab={tab} count={activeEvents.length} />
        )}

        {/* Content */}
        {loading ? (
          <LoadingSkeleton />
        ) : error ? (
          <ErrorState onRetry={retry} />
        ) : activeEvents.length === 0 ? (
          <EmptyState tab={tab} onCta={tab === 'upcoming' ? () => navigate('/discover') : tab === 'hosting' ? () => navigate('/create') : null} />
        ) : (
          <>
            <div className="space-y-3">
              {renderCards()}
            </div>
            {tab === 'past' && <DiscoverNudge onExplore={() => navigate('/discover')} />}
          </>
        )}
      </div>

      <Footer />
    </div>
  );
}
