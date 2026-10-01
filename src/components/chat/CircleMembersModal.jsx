/**
 * CircleMembersModal.jsx — member roster for event and community circles.
 *
 * For event circles: fetches RSVP attendees from the database.
 * For community circles: derives members from recent message senders.
 * City General circles use ChannelMembers.jsx instead.
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { avatarBg, getInitials } from '../../lib/avatar';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function MemberRow({ member }) {
  const navigate = useNavigate();
  return (
    <div
      onClick={() => navigate(`/profile/${member.userId}`)}
      className="flex items-center gap-3 px-2 py-2.5 rounded-2xl hover:bg-surface-container/60 transition-colors cursor-pointer"
    >
      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0 ${avatarBg(member.displayName)}`}>
        {member.avatarUrl
          ? <img src={member.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
          : getInitials(member.displayName)}
      </div>
      <p className="flex-1 text-sm font-medium text-on-surface truncate">{member.displayName}</p>
      <span className="material-symbols-outlined text-on-surface-variant/40" style={{ fontSize: 16 }}>chevron_right</span>
    </div>
  );
}

export default function CircleMembersModal({ circle, messages, onClose }) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        let result = [];

        if (circle.isEvent) {
          const eventId = circle.id.replace('event-', '');
          if (UUID_RE.test(eventId)) {
            const { data: rsvps } = await supabase
              .from('rsvps')
              .select('user_id')
              .eq('event_id', eventId);
            const userIds = (rsvps || []).map((r) => r.user_id).filter(Boolean);
            if (userIds.length > 0) {
              const { data: profiles } = await supabase
                .from('public_profiles')
                .select('id, display_name, avatar_url')
                .in('id', userIds);
              result = (profiles || []).map((p) => ({
                userId: p.id,
                displayName: p.display_name || 'User',
                avatarUrl: p.avatar_url || null,
              }));
            }
          } else {
            // EVENTS_DB event (non-UUID) — derive from message senders
            result = dedupeFromMessages(messages);
          }
        } else {
          // Community circle — derive from recent message senders
          result = dedupeFromMessages(messages);
        }

        if (!cancelled) setMembers(result);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [circle.id]);

  function dedupeFromMessages(msgs) {
    const seen = new Map();
    (msgs || []).forEach((m) => {
      if (m.user_id && !seen.has(m.user_id)) {
        seen.set(m.user_id, { userId: m.user_id, displayName: m.display_name || 'User', avatarUrl: null });
      }
    });
    return [...seen.values()];
  }

  const title = circle.isEvent ? 'Attendees' : 'Members';

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md max-h-[80vh] flex flex-col bg-surface-container-low border border-outline-variant/20 rounded-3xl shadow-card overflow-hidden">
        <div className="flex items-center justify-between px-5 pt-5 pb-3 flex-shrink-0 border-b border-outline-variant/15">
          <div>
            <h2 className="font-headline text-lg font-bold text-on-surface leading-tight">{title}</h2>
            <p className="text-xs text-on-surface-variant/60 mt-0.5">
              {loading ? 'Loading…' : `${members.length} ${members.length === 1 ? 'person' : 'people'}`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full hover:bg-surface-container flex items-center justify-center transition-colors flex-shrink-0"
            aria-label="Close">
            <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: 20 }}>close</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-2 hide-scrollbar">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : members.length === 0 ? (
            <p className="text-center text-sm text-on-surface-variant/60 py-12 px-6">
              No members to show yet.
            </p>
          ) : (
            members.map((m) => <MemberRow key={m.userId} member={m} />)
          )}
        </div>
      </div>
    </div>
  );
}
