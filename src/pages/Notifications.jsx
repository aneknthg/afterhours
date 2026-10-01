/**
 * Notifications.jsx
 * Place at: src/pages/Notifications.jsx
 *
 * Unified notifications feed — shows:
 *   • RSVP requests on events you host (access='approval')
 *   • Connection requests received
 *
 * Modelled after Instagram's Activity tab: a single chronological list
 * grouped by recency, with accept/reject actions inline.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { useToast } from '../components/Toast';
import { notificationsService } from '../services/notifications.service';
import { formatPaymentDue } from '../lib/useRsvp';
import { NOTIFICATIONS_READ_EVENT, markUnreadAsRead, unreadNotifIds } from '../lib/notifications.helpers';
import { connectionsService } from '../services/connections.service';
import Footer from '../components/Footer';
import { avatarBg, getInitials } from '../lib/avatar';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60)    return 'just now';
  if (diff < 3600)  return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}


function Avatar({ user, size = 44 }) {
  if (!user) return null;
  const style = { width: size, height: size };
  if (user.avatar_url) {
    return <img src={user.avatar_url} alt="" className="rounded-full object-cover flex-shrink-0" style={style} />;
  }
  return (
    <div
      className={`${avatarBg(user.display_name)} rounded-full flex items-center justify-center flex-shrink-0`}
      style={style}
    >
      <span className="text-xs font-bold text-white">{getInitials(user.display_name)}</span>
    </div>
  );
}

// ─── Row components ──────────────────────────────────────────────────────────

function RsvpRequestRow({ item, onAccept, onReject, busy }) {
  const navigate = useNavigate();
  const { requester, event, createdAt } = item;
  if (!requester || !event) return null;

  return (
    <div className="flex items-start gap-3 px-4 py-3.5 hover:bg-surface-container/50 transition-colors">
      <button onClick={() => navigate(`/profile/${requester.id}`)} className="flex-shrink-0">
        <Avatar user={requester} />
      </button>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-on-surface leading-snug">
          <button onClick={() => navigate(`/profile/${requester.id}`)} className="font-semibold hover:underline">
            {requester.display_name || 'Someone'}
          </button>
          {' '}wants to join{' '}
          <button onClick={() => navigate(`/event/${event.id}`)} className="font-semibold text-primary hover:underline">
            {event.title}
          </button>
        </p>
        <p className="text-xs text-on-surface-variant mt-0.5">
          {timeAgo(createdAt)}
          {requester.city ? ` · ${requester.city}` : ''}
        </p>
        <div className="flex items-center gap-2 mt-2.5">
          <button
            onClick={() => onAccept(item)}
            disabled={busy}
            className="px-4 py-1.5 rounded-lg bg-primary text-on-primary text-xs font-bold hover:brightness-110 disabled:opacity-50 transition-all"
          >
            Approve
          </button>
          <button
            onClick={() => onReject(item)}
            disabled={busy}
            className="px-4 py-1.5 rounded-lg bg-surface-container border border-outline-variant/25 text-on-surface text-xs font-bold hover:border-error/50 hover:text-error disabled:opacity-50 transition-all"
          >
            Decline
          </button>
        </div>
      </div>
      {event.image_url && (
        <button onClick={() => navigate(`/event/${event.id}`)} className="flex-shrink-0">
          <img src={event.image_url} alt="" className="w-12 h-12 rounded-lg object-cover" onError={(e) => { e.target.style.display = 'none'; }} />
        </button>
      )}
    </div>
  );
}

function ConnectionRequestRow({ item, onAccept, onReject, busy }) {
  const navigate = useNavigate();
  const { requester, createdAt } = item;
  if (!requester) return null;

  return (
    <div className="px-3 py-2.5">
      {/* Pill card */}
      <div className="flex items-center gap-3 bg-surface-container rounded-2xl px-4 py-3">
        <button onClick={() => navigate(`/profile/${requester.id}`)} className="flex-shrink-0">
          <Avatar user={requester} size={40} />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-on-surface leading-snug truncate">
            <span className="font-semibold">{requester.display_name || 'Someone'}</span>
            {' '}
            <span className="text-on-surface-variant">knocked</span>
            <span className="text-on-surface-variant/60"> · {timeAgo(createdAt)}</span>
          </p>
        </div>
        <button
          onClick={() => navigate(`/profile/${requester.id}`)}
          className="flex-shrink-0 px-4 py-2 bg-primary/20 text-primary rounded-xl text-sm font-semibold hover:bg-primary/30 transition-colors"
        >
          Open
        </button>
      </div>

      {/* Accept / Decline below */}
      <div className="flex items-center gap-3 mt-2 pl-[52px]">
        <button
          onClick={() => onAccept(item)}
          disabled={busy}
          className="px-4 py-1.5 rounded-lg bg-primary text-on-primary text-xs font-bold hover:brightness-110 disabled:opacity-50 transition-all"
        >
          Accept
        </button>
        <button
          onClick={() => onReject(item)}
          disabled={busy}
          className="text-xs font-bold text-on-surface-variant hover:text-error disabled:opacity-50 transition-colors"
        >
          Decline
        </button>
      </div>
    </div>
  );
}

// Notifications sent TO the user (no accept/reject action): an RSVP you made was
// approved, a connection was accepted, or an event you RSVP'd to was cancelled.
function UserNotifRow({ item }) {
  const navigate = useNavigate();
  const { kind, eventId, eventTitle, acceptorName, note, createdAt, read } = item;

  const meta = {
    event_cancelled:     { icon: 'event_busy', tint: 'text-error',   bg: 'bg-error/15' },
    rsvp_approved:       { icon: 'check_circle', tint: 'text-primary', bg: 'bg-primary/15' },
    connection_accepted: { icon: 'group',        tint: 'text-primary', bg: 'bg-primary/15' },
  }[kind] || { icon: 'notifications', tint: 'text-on-surface-variant', bg: 'bg-surface-container' };

  // A cancelled event is deleted, so its title/note isn't clickable.
  const clickable = kind !== 'event_cancelled' && eventId;
  const go = () => {
    if (kind === 'connection_accepted') navigate('/chat');
    else if (clickable) navigate(`/event/${eventId}`);
  };

  return (
    <div
      onClick={go}
      className={`flex items-start gap-3 px-4 py-3.5 rounded-2xl transition-colors ${clickable || kind === 'connection_accepted' ? 'cursor-pointer hover:bg-surface-container/50' : ''} ${read ? '' : 'bg-surface-container-low/40'}`}
    >
      <div className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 ${meta.bg}`}>
        <span className={`material-symbols-outlined ${meta.tint}`} style={{ fontSize: 22 }}>{meta.icon}</span>
      </div>
      <div className="flex-1 min-w-0">
        {kind === 'event_cancelled' ? (
          <>
            <p className="text-sm text-on-surface leading-snug">
              <span className="font-semibold">{eventTitle || 'An event'}</span>{' '}
              <span className="text-on-surface-variant">was cancelled by the host.</span>
            </p>
            {note && (
              <p className="text-sm text-on-surface-variant mt-1.5 pl-3 border-l-2 border-error/40 italic">
                “{note}”
              </p>
            )}
          </>
        ) : kind === 'rsvp_approved' && item.rsvpState === 'awaiting_payment' && item.paymentDueAt ? (
          <p className="text-sm text-on-surface leading-snug">
            You're approved for{' '}<span className="font-semibold text-primary">{eventTitle || 'an event'}</span>.{' '}
            <span className="text-on-surface-variant">Pay by {formatPaymentDue(item.paymentDueAt)} to confirm your spot.</span>
          </p>
        ) : kind === 'rsvp_approved' ? (
          <p className="text-sm text-on-surface leading-snug">
            You're approved for{' '}<span className="font-semibold text-primary">{eventTitle || 'an event'}</span>.
          </p>
        ) : kind === 'connection_accepted' ? (
          <p className="text-sm text-on-surface leading-snug">
            <span className="font-semibold">{acceptorName || 'Someone'}</span>{' '}
            <span className="text-on-surface-variant">accepted your connection.</span>
          </p>
        ) : (
          <p className="text-sm text-on-surface leading-snug">New notification</p>
        )}
        <p className="text-xs text-on-surface-variant/70 mt-0.5">{timeAgo(createdAt)}</p>
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function Notifications() {
  const { user } = useAuth();
  const showToast = useToast();
  const navigate = useNavigate();

  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [busyId, setBusyId]   = useState(null);
  const [filter, setFilter]   = useState('all'); // 'all' | 'events' | 'people'

  async function load() {
    if (!user?.id) return;
    setLoading(true);
    try {
      const data = await notificationsService.fetchAll(user.id);
      // Viewing the feed clears the unread badge for sent-to-me notifications
      // (approvals, cancellations, accepted connections).
      //
      // Render them read in the same pass that fires the writes. The writes
      // always reached the server, but nothing reflected them locally, so the
      // row tint kept the pre-write snapshot and opening the page did not
      // count as read until a manual reload. Optimistic and self-correcting:
      // a failed write shows up as unread again on the next fetch.
      const unread = unreadNotifIds(data);
      setItems(markUnreadAsRead(data));
      setError('');
      if (unread.length) {
        await Promise.all(
          unread.map((id) => notificationsService.markRead(id).catch(() => {})),
        );
        // The header badge recounts on route change, which races these writes.
        // Tell it once they have landed instead of waiting for its 30s poll.
        window.dispatchEvent(new Event(NOTIFICATIONS_READ_EVENT));
      }
    } catch (err) {
      setError(err.message || 'Failed to load notifications.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user?.id]);

  function keyOf(item) {
    if (item.kind === 'rsvp_request') return `r:${item.rsvpId}`;
    if (item.kind === 'connection_request') return `c:${item.connectionId}`;
    return `n:${item.notifId}`;
  }

  const isRequest = (k) => k === 'rsvp_request' || k === 'connection_request';

  async function handleAccept(item) {
    setBusyId(keyOf(item));
    try {
      if (item.kind === 'rsvp_request') {
        await notificationsService.approveRsvp(item.rsvpId);
        showToast(`${item.requester?.display_name || 'Guest'} approved.`);
      } else {
        await connectionsService.acceptRequest(item.connectionId);
        showToast(`Connected with ${item.requester?.display_name || 'them'}.`);
      }
      setItems((prev) => prev.filter((i) => keyOf(i) !== keyOf(item)));
    } catch (err) {
      showToast(err.message || 'Something went wrong.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleReject(item) {
    setBusyId(keyOf(item));
    try {
      if (item.kind === 'rsvp_request') {
        await notificationsService.rejectRsvp(item.rsvpId);
      } else {
        await connectionsService.rejectRequest(item.connectionId);
      }
      setItems((prev) => prev.filter((i) => keyOf(i) !== keyOf(item)));
    } catch (err) {
      showToast(err.message || 'Something went wrong.');
    } finally {
      setBusyId(null);
    }
  }

  const isEventKind  = (k) => k === 'rsvp_request' || k === 'rsvp_approved' || k === 'event_cancelled';
  const isPeopleKind = (k) => k === 'connection_request' || k === 'connection_accepted';

  const filtered = items.filter((i) => {
    if (filter === 'events') return isEventKind(i.kind);
    if (filter === 'people') return isPeopleKind(i.kind);
    return true;
  });

  const counts = {
    all:    items.length,
    events: items.filter((i) => isEventKind(i.kind)).length,
    people: items.filter((i) => isPeopleKind(i.kind)).length,
  };

  const tabs = [
    { id: 'all',    label: 'All' },
    { id: 'events', label: 'Events' },
    { id: 'people', label: 'People' },
  ];

  return (
    <div className="page-enter">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-10 pb-32">

        <div className="mb-6">
          <h1 className="font-headline text-3xl sm:text-4xl font-bold text-on-surface">Notifications</h1>
          <p className="text-on-surface-variant text-sm mt-1">Requests to join events and connect.</p>
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-1 p-1 bg-surface-container rounded-2xl w-fit mb-6">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setFilter(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
                filter === t.id
                  ? 'bg-primary text-on-primary'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              {t.label}
              {counts[t.id] > 0 && (
                <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
                  filter === t.id ? 'bg-white/20 text-white' : 'bg-surface-container-high text-on-surface-variant'
                }`}>
                  {counts[t.id]}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* List */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3.5 animate-pulse">
                <div className="w-11 h-11 rounded-full bg-surface-container flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-3/4 bg-surface-container rounded" />
                  <div className="h-2.5 w-1/4 bg-surface-container rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center py-16 text-center">
            <span className="material-symbols-outlined text-on-surface-variant text-3xl mb-3">cloud_off</span>
            <p className="text-sm text-on-surface-variant mb-4">{error}</p>
            <button onClick={load} className="text-xs font-bold uppercase tracking-widest text-primary hover:underline">
              Try again
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-surface-container flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-on-surface-variant text-3xl">notifications</span>
            </div>
            <p className="text-on-surface-variant text-sm max-w-xs leading-relaxed">
              {filter === 'events'
                ? 'No event requests right now. When someone asks to join an event you host, they\'ll show up here.'
                : filter === 'people'
                ? 'No connection requests right now.'
                : 'All caught up. New requests will appear here.'}
            </p>
            <button
              onClick={() => navigate('/discover')}
              className="mt-6 text-xs font-bold uppercase tracking-widest text-primary hover:underline"
            >
              Explore events
            </button>
          </div>
        ) : (
          <div className="space-y-1">
            {filtered.map((item) => {
              const busy = busyId === keyOf(item);
              return item.kind === 'rsvp_request' ? (
                <div key={keyOf(item)} className="rounded-2xl border border-outline-variant/15 bg-surface-container-low/40 overflow-hidden">
                  <RsvpRequestRow item={item} onAccept={handleAccept} onReject={handleReject} busy={busy} />
                </div>
              ) : item.kind === 'connection_request' ? (
                <ConnectionRequestRow key={keyOf(item)} item={item} onAccept={handleAccept} onReject={handleReject} busy={busy} />
              ) : (
                <UserNotifRow key={keyOf(item)} item={item} />
              );
            })}
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}
