/**
 * NotificationsPopover.jsx
 * Place at: src/components/NotificationsPopover.jsx
 *
 * Instagram-style dropdown anchored to the bell icon in the header.
 * Shows RSVP requests + connection requests inline with Approve/Decline actions.
 */
import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { useToast } from './Toast';
import { notificationsService } from '../services/notifications.service';
import { formatPaymentDue } from '../lib/useRsvp';
import { connectionsService } from '../services/connections.service';
import { avatarBg, getInitials } from '../lib/avatar';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60)     return 'just now';
  if (diff < 3600)   return `${Math.floor(diff / 60)}m`;
  if (diff < 86400)  return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}


function Avatar({ user, size = 40 }) {
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
      <span className="text-[11px] font-bold text-white">{getInitials(user.display_name)}</span>
    </div>
  );
}

// ─── Row components ──────────────────────────────────────────────────────────

// Activity notification sent TO the current user (RSVP approved, connection
// accepted, event cancelled)
function ActivityRow({ item, onClose, onMarkRead }) {
  const navigate = useNavigate();
  const isRsvpApproved = item.kind === 'rsvp_approved';
  const isCancelled    = item.kind === 'event_cancelled';

  function handleClick() {
    onMarkRead(item.notifId);
    // A cancelled event is deleted, so there is nothing to navigate to.
    if (isCancelled) return;
    onClose();
    if (isRsvpApproved && item.eventId) navigate(`/event/${item.eventId}`);
  }

  return (
    <button
      type="button"
      className={`w-full flex items-start gap-3 px-4 py-3 hover:bg-surface-container/40 transition-colors text-left ${isRsvpApproved || item.eventId ? 'cursor-pointer' : 'cursor-default'} ${!item.read ? 'bg-primary/5' : ''}`}
      onClick={handleClick}
    >
      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${isCancelled ? 'bg-error/15' : 'bg-primary-container'}`}>
        <span className={`material-symbols-outlined text-base ${isCancelled ? 'text-error' : 'text-primary'}`}>
          {isCancelled ? 'event_busy' : isRsvpApproved ? 'check_circle' : 'person_check'}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] text-on-surface leading-snug">
          {isCancelled ? (
            <><span className="font-semibold">{item.eventTitle || 'An event'}</span> was cancelled by the host</>
          ) : isRsvpApproved && item.rsvpState === 'awaiting_payment' && item.paymentDueAt ? (
            <>You were <span className="font-semibold text-primary">approved</span> to join{' '}
            <span className="font-semibold">{item.eventTitle || 'an event'}</span>. Pay by{' '}
            {formatPaymentDue(item.paymentDueAt)} to confirm your spot</>
          ) : isRsvpApproved ? (
            <>You were <span className="font-semibold text-primary">approved</span> to join{' '}
            <span className="font-semibold">{item.eventTitle || 'an event'}</span></>
          ) : (
            <><span className="font-semibold">{item.acceptorName || 'Someone'}</span> accepted your connection request</>
          )}
        </p>
        {isCancelled && item.note && (
          <p className="text-xs text-on-surface-variant mt-1 pl-2 border-l-2 border-error/40 italic">“{item.note}”</p>
        )}
        <p className="text-[11px] text-on-surface-variant/70 mt-0.5">{timeAgo(item.createdAt)}</p>
      </div>
      {!item.read && (
        <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1.5" />
      )}
    </button>
  );
}

function Row({ item, onAccept, onReject, onClose, busy }) {
  const navigate = useNavigate();
  const isRsvp   = item.kind === 'rsvp_request';
  const requester = item.requester;
  const event     = item.event;
  if (!requester) return null;

  function goToProfile(e) {
    e.stopPropagation();
    onClose();
    navigate(`/profile/${requester.id}`);
  }
  function goToEvent(e) {
    e.stopPropagation();
    if (!event) return;
    onClose();
    navigate(`/event/${event.id}`);
  }

  return (
    <div className="flex items-start gap-3 px-4 py-3 hover:bg-surface-container/40 transition-colors">
      <button onClick={goToProfile} className="flex-shrink-0">
        <Avatar user={requester} />
      </button>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] text-on-surface leading-snug">
          <button onClick={goToProfile} className="font-semibold hover:underline">
            {requester.display_name || 'Someone'}
          </button>
          {isRsvp ? (
            <>
              {' '}wants to join{' '}
              {event && (
                <button onClick={goToEvent} className="font-semibold text-primary hover:underline">
                  {event.title}
                </button>
              )}
            </>
          ) : (
            <> sent you a connection request</>
          )}
        </p>
        <p className="text-[11px] text-on-surface-variant/70 mt-0.5">{timeAgo(item.createdAt)}</p>
        <div className="flex items-center gap-1.5 mt-2">
          <button
            onClick={() => onAccept(item)}
            disabled={busy}
            className="px-3 py-1 rounded-lg bg-primary text-on-primary text-[11px] font-bold hover:brightness-110 disabled:opacity-50 transition-all"
          >
            {isRsvp ? 'Approve' : 'Accept'}
          </button>
          <button
            onClick={() => onReject(item)}
            disabled={busy}
            className="px-3 py-1 rounded-lg bg-surface-container border border-outline-variant/25 text-on-surface text-[11px] font-bold hover:border-error/50 hover:text-error disabled:opacity-50 transition-all"
          >
            Decline
          </button>
        </div>
      </div>
      {isRsvp && event?.image_url && (
        <button onClick={goToEvent} className="flex-shrink-0">
          <img
            src={event.image_url}
            alt=""
            className="w-10 h-10 rounded-lg object-cover"
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        </button>
      )}
    </div>
  );
}

// ─── Popover ─────────────────────────────────────────────────────────────────

export default function NotificationsPopover({ onClose, onCountChange }) {
  const { user }   = useAuth();
  const showToast  = useToast();
  const popRef     = useRef(null);
  const navigate   = useNavigate();

  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [busyId, setBusyId]   = useState(null);

  // Close on outside click / escape
  useEffect(() => {
    const onMouse = (e) => {
      if (popRef.current && !popRef.current.contains(e.target)) onClose();
    };
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    const t = setTimeout(() => document.addEventListener('mousedown', onMouse), 10);
    document.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener('mousedown', onMouse);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  // Load on mount + poll every 20s while popover is open
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;

    async function load() {
      try {
        const data = await notificationsService.fetchAll(user.id);
        if (cancelled) return;
        setItems(data);
        const unread = data.filter((i) =>
          i.kind === 'rsvp_request' || i.kind === 'connection_request' || !i.read
        ).length;
        onCountChange?.(unread);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    const intv = setInterval(load, 20_000);
    return () => { cancelled = true; clearInterval(intv); };
  }, [user?.id, onCountChange]);

  const isRequest = (k) => k === 'rsvp_request' || k === 'connection_request';

  function keyOf(item) {
    if (item.kind === 'rsvp_request')       return `r:${item.rsvpId}`;
    if (item.kind === 'connection_request') return `c:${item.connectionId}`;
    return `n:${item.notifId}`;
  }

  const actionItems   = items.filter((i) => isRequest(i.kind));
  // Everything else (approved, accepted, cancelled) is an activity row. The
  // unread badge counts all of them, so they must all be visible here.
  const activityItems = items.filter((i) => !isRequest(i.kind));

  async function handleMarkRead(notifId) {
    await notificationsService.markRead(notifId);
    setItems((prev) => {
      const next = prev.map((i) => i.notifId === notifId ? { ...i, read: true } : i);
      const unread = next.filter((i) => isRequest(i.kind) || !i.read).length;
      onCountChange?.(unread);
      return next;
    });
  }

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
      setItems((prev) => {
        const next = prev.filter((i) => keyOf(i) !== keyOf(item));
        const unread = next.filter((i) =>
          i.kind === 'rsvp_request' || i.kind === 'connection_request' || !i.read
        ).length;
        onCountChange?.(unread);
        return next;
      });
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
      setItems((prev) => {
        const next = prev.filter((i) => keyOf(i) !== keyOf(item));
        const unread = next.filter((i) =>
          i.kind === 'rsvp_request' || i.kind === 'connection_request' || !i.read
        ).length;
        onCountChange?.(unread);
        return next;
      });
    } catch (err) {
      showToast(err.message || 'Something went wrong.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      {/* Mobile: full-screen backdrop */}
      <div
        className="fixed inset-0 z-[199] bg-black/50 backdrop-blur-sm md:hidden"
        onClick={onClose}
      />

      <div
        ref={popRef}
        className="fixed inset-0 z-[200] bg-surface-container-low flex flex-col md:inset-auto md:right-6 md:top-16 md:w-[360px] md:max-w-[calc(100vw-1rem)] md:border md:border-outline-variant/20 md:rounded-2xl md:shadow-2xl md:shadow-black/50 md:max-h-[min(540px,80vh)]"
        style={{ animation: 'fadeIn 0.15s ease' }}
      >
        {/* Header */}
        <div className="px-5 py-4 md:px-4 md:py-3 border-b border-outline-variant/15 flex items-center justify-between flex-shrink-0">
          <p className="font-headline text-lg md:text-base font-semibold text-on-surface">Notifications</p>
          <div className="flex items-center gap-3">
            {actionItems.length > 0 && (
              <span className="text-xs text-on-surface-variant">{actionItems.length} pending</span>
            )}
            <button
              onClick={onClose}
              className="md:hidden p-1 -mr-1 text-on-surface-variant hover:text-on-surface transition-colors"
              aria-label="Close notifications"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto md:max-h-[min(480px,70vh)]">
          {loading ? (
            <div className="px-4 py-3 space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3 animate-pulse">
                  <div className="w-10 h-10 rounded-full bg-surface-container flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-3/4 bg-surface-container rounded" />
                    <div className="h-2.5 w-1/3 bg-surface-container rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center py-10 px-4 text-center">
              <span className="material-symbols-outlined text-on-surface-variant mb-2" style={{ fontSize: 28 }}>cloud_off</span>
              <p className="text-xs text-on-surface-variant">{error}</p>
            </div>
          ) : actionItems.length === 0 && activityItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[280px] py-12 px-6 text-center">
              <div className="w-14 h-14 rounded-2xl bg-surface-container flex items-center justify-center mb-3">
                <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: 26 }}>
                  notifications_off
                </span>
              </div>
              <p className="text-sm font-semibold text-on-surface mb-1">No notifications yet</p>
              <p className="text-xs text-on-surface-variant leading-relaxed max-w-[240px]">
                RSVP approvals and connection updates will appear here.
              </p>
            </div>
          ) : (
            <div>
              {actionItems.length > 0 && (
                <>
                  <p className="px-4 pt-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50">
                    Needs action
                  </p>
                  <div className="divide-y divide-outline-variant/10">
                    {actionItems.map((item) => (
                      <Row
                        key={keyOf(item)}
                        item={item}
                        onAccept={handleAccept}
                        onReject={handleReject}
                        onClose={onClose}
                        busy={busyId === keyOf(item)}
                      />
                    ))}
                  </div>
                </>
              )}
              {activityItems.length > 0 && (
                <>
                  <p className={`px-4 pb-1 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50 ${actionItems.length > 0 ? 'pt-4 border-t border-outline-variant/10' : 'pt-3'}`}>
                    Recent activity
                  </p>
                  <div className="divide-y divide-outline-variant/10">
                    {activityItems.map((item) => (
                      <ActivityRow
                        key={keyOf(item)}
                        item={item}
                        onClose={onClose}
                        onMarkRead={handleMarkRead}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer — link to the full notifications page.
            Hidden on the empty state: a "See all" link below an empty panel
            just points at another empty page. */}
        {!loading && !error && (actionItems.length > 0 || activityItems.length > 0) && (
          <button
            onClick={() => { onClose(); navigate('/notifications'); }}
            className="flex-shrink-0 w-full px-4 py-3 border-t border-outline-variant/15 text-center text-sm font-semibold text-primary hover:bg-surface-container/50 transition-colors"
          >
            See all notifications
          </button>
        )}
      </div>
    </>
  );
}
