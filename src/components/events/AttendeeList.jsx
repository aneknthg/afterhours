/**
 * AttendeeList.jsx — "Who's going" section for EventDetail
 *
 * Avatars are clickable → navigate to /profile/:id
 * When isHost=true, clicking the stack opens ParticipantsModal where
 * the host can view all attendees, visit their profiles, or remove them.
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { eventsService } from '../../services/events.service';
import TrustBadge from '../trust/TrustBadge';
import { avatarBg, getInitials } from '../../lib/avatar';
import { formatPaymentDue } from '../../lib/useRsvp';

// ─── Participants modal (host only) ──────────────────────────────────────────

function ParticipantsModal({ eventId, currentUserId, onClose }) {
  const navigate = useNavigate();
  const [attendees, setAttendees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState(null);

  useEffect(() => {
    if (!eventId) return;
    supabase
      .from('rsvps')
      .select('user_id, payment_due_at, profiles:public_profiles!user_id(id, display_name, trust_level, avatar_url, city)')
      .eq('event_id', String(eventId))
      .eq('status', 'approved')
      .then(({ data }) => {
        const norm = (p) => (Array.isArray(p) ? (p[0] ?? null) : p);
        setAttendees(
          (data || []).map((r) => {
            const prof = norm(r.profiles);
            return {
              id:           r.user_id,
              display_name: prof?.display_name || 'Anonymous',
              trust_level:  prof?.trust_level  || 0,
              avatar_url:   prof?.avatar_url   || null,
              city:         prof?.city         || '',
              // Approved on a paid event, not paid yet: held until then.
              payment_due_at: r.payment_due_at || null,
            };
          })
        );
      })
      .catch(() => setAttendees([]))
      .finally(() => setLoading(false));
  }, [eventId]);

  async function handleRemove(userId) {
    setRemovingId(userId);
    try {
      // supabase-js doesn't throw — without this check an RLS-blocked delete
      // would still remove the row from the list while the seat stays booked.
      const { error } = await supabase
        .from('rsvps')
        .delete()
        .eq('user_id', userId)
        .eq('event_id', String(eventId));
      if (error) throw error;
      setAttendees((prev) => prev.filter((a) => a.id !== userId));
    } catch (err) {
      console.error('Remove attendee failed:', err);
    } finally {
      setRemovingId(null);
    }
  }

  function goToProfile(userId) {
    onClose();
    navigate(userId === currentUserId ? '/profile' : `/profile/${userId}`);
  }

  return (
    <div
      className="fixed inset-0 z-[500] flex items-center justify-center p-4 sm:p-6 bg-background/80 backdrop-blur-xl"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-surface-container-low border border-outline-variant/20 rounded-3xl overflow-hidden shadow-2xl shadow-black/50 flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant/15 flex-shrink-0">
          <div>
            <p className="font-headline text-lg font-semibold text-on-surface leading-none">Participants</p>
            {!loading && (
              <p className="text-xs text-on-surface-variant mt-1">{attendees.length} approved</p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-all"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="space-y-3 p-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3 animate-pulse">
                  <div className="w-10 h-10 rounded-full bg-surface-container flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-1/2 bg-surface-container rounded" />
                    <div className="h-2.5 w-1/4 bg-surface-container rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : attendees.length === 0 ? (
            <div className="py-12 text-center">
              <span className="material-symbols-outlined text-on-surface-variant/40 text-4xl mb-2 block">group_off</span>
              <p className="text-sm text-on-surface-variant">No approved participants yet.</p>
            </div>
          ) : (
            <ul className="divide-y divide-outline-variant/10">
              {attendees.map((a) => (
                <li key={a.id} className="flex items-center gap-3 px-4 py-3">
                  {/* Avatar */}
                  <button
                    onClick={() => goToProfile(a.id)}
                    className="relative flex-shrink-0 hover:scale-105 transition-transform"
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold text-white ${avatarBg(a.display_name)}`}>
                      {a.avatar_url ? (
                        <img src={a.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                      ) : (
                        getInitials(a.display_name)
                      )}
                    </div>
                    {a.trust_level >= 2 && (
                      <div className="absolute -bottom-0.5 -right-0.5">
                        <TrustBadge level={a.trust_level} size="sm" />
                      </div>
                    )}
                  </button>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-on-surface truncate">
                      {a.id === currentUserId ? 'You' : a.display_name}
                    </p>
                    {a.city && <p className="text-xs text-on-surface-variant truncate">{a.city}</p>}
                    {a.payment_due_at && (
                      <p className="text-xs text-on-surface-variant/70 truncate">
                        Awaiting payment · until {formatPaymentDue(a.payment_due_at)}
                      </p>
                    )}
                  </div>

                  {/* Actions (don't show for current user) */}
                  {a.id !== currentUserId && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => goToProfile(a.id)}
                        className="p-1.5 rounded-lg text-on-surface-variant hover:text-primary hover:bg-surface-container transition-all"
                        title="View profile"
                        aria-label="View profile"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>person</span>
                      </button>
                      <button
                        onClick={() => handleRemove(a.id)}
                        disabled={removingId === a.id}
                        className="p-1.5 rounded-lg text-on-surface-variant hover:text-error hover:bg-error-container/20 transition-all disabled:opacity-40"
                        title="Remove from event"
                        aria-label="Remove from event"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                          {removingId === a.id ? 'hourglass_top' : 'person_remove'}
                        </span>
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────

export default function AttendeeList({ eventId, maxDisplay = 8, currentUserId, isHost = false }) {
  const [attendees, setAttendees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!eventId) return;
    setLoading(true);
    eventsService.fetchAttendees(String(eventId), maxDisplay + 1)
      .then(data => setAttendees(data))
      .catch(() => setAttendees([]))
      .finally(() => setLoading(false));
  }, [eventId, maxDisplay]);

  if (loading) {
    return (
      <div>
        <p className="text-xs uppercase tracking-widest text-on-surface font-bold mb-3">
          Who's going
        </p>
        <div className="flex -space-x-2">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="w-9 h-9 rounded-full bg-surface-container animate-pulse border-2 border-background" />
          ))}
        </div>
      </div>
    );
  }

  if (attendees.length === 0) return null;

  const displayed = attendees.slice(0, maxDisplay);
  const overflow = attendees.length > maxDisplay ? attendees.length - maxDisplay : 0;

  function handleClick(userId) {
    if (!userId) return;
    if (userId === currentUserId) navigate('/profile');
    else navigate(`/profile/${userId}`);
  }

  return (
    <>
      {showModal && (
        <ParticipantsModal
          eventId={eventId}
          currentUserId={currentUserId}
          onClose={() => setShowModal(false)}
        />
      )}

      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs uppercase tracking-widest text-on-surface font-bold">
            Who's going
          </p>
          {isHost && (
            <button
              onClick={() => setShowModal(true)}
              className="text-xs text-primary font-semibold hover:underline transition-colors"
            >
              View all
            </button>
          )}
        </div>

        {/* Avatar stack — clicking opens modal for host, profile for others */}
        <div className="flex items-center -space-x-2 mb-2">
          {displayed.map(a => (
            <button
              key={a.id}
              onClick={() => isHost ? setShowModal(true) : handleClick(a.id)}
              className="relative hover:z-10 hover:scale-110 transition-transform"
              title={isHost ? 'View all participants' : a.display_name}
            >
              {a.avatar_url ? (
                <img
                  src={a.avatar_url}
                  alt=""
                  className="w-10 h-10 rounded-full object-cover border-2 border-background flex-shrink-0 bg-surface-container"
                  loading="lazy"
                />
              ) : (
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold text-white border-2 border-background flex-shrink-0 ${avatarBg(a.display_name)}`}
                >
                  {getInitials(a.display_name)}
                </div>
              )}
              {a.trust_level >= 2 && (
                <div className="absolute -bottom-0.5 -right-0.5">
                  <TrustBadge level={a.trust_level} size="sm" />
                </div>
              )}
            </button>
          ))}
          {overflow > 0 && (
            isHost ? (
              <button
                type="button"
                onClick={() => setShowModal(true)}
                aria-label={`View all ${attendees.length} participants`}
                className="w-10 h-10 rounded-full bg-surface-container border-2 border-background flex items-center justify-center text-xs font-bold text-primary flex-shrink-0 cursor-pointer hover:bg-surface-container-high transition-colors"
              >
                +{overflow}
              </button>
            ) : (
              <div className="w-10 h-10 rounded-full bg-surface-container border-2 border-background flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
                +{overflow}
              </div>
            )
          )}
        </div>

        {/* Name list (first 3) */}
        <p className="text-xs text-on-surface-variant">
          {displayed.slice(0, 3).map((a, i) => (
            <span key={a.id}>
              <button
                onClick={() => handleClick(a.id)}
                className="text-on-surface font-semibold hover:text-primary transition-colors"
              >
                {a.id === currentUserId ? 'You' : a.display_name}
              </button>
              {i < Math.min(displayed.length, 3) - 1 && ', '}
            </span>
          ))}
          {attendees.length > 3 && (
            <span> and {attendees.length - 3} {attendees.length - 3 === 1 ? 'other' : 'others'}</span>
          )}
        </p>
      </div>
    </>
  );
}
