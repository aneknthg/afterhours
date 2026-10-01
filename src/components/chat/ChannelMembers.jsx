/**
 * ChannelMembers.jsx — roster for a city General chat.
 *
 * Lists the verified women in that city (the people the General is open to)
 * so members can browse the room and send connection requests. Reuses the
 * public_profiles view, so no membership rows are exposed.
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { citySlug } from '../../services/chat.service';
import { connectionsService } from '../../services/connections.service';
import { avatarBg, getInitials } from '../../lib/avatar';
import TrustBadge from '../trust/TrustBadge';
import { useToast } from '../Toast';

function MemberRow({ member, status, currentUserId, onConnect }) {
  const navigate = useNavigate();
  const [localStatus, setLocalStatus] = useState(status);
  const [sending, setSending] = useState(false);

  async function handleConnect(e) {
    e.stopPropagation();
    if (sending || localStatus) return;
    setSending(true);
    const ok = await onConnect(member.id);
    setSending(false);
    if (ok) setLocalStatus('sent-pending');
  }

  let button;
  if (member.id === currentUserId) {
    button = <span className="text-[11px] text-on-surface-variant/50 font-semibold px-2">You</span>;
  } else if (localStatus === 'accepted') {
    button = (
      <span className="flex items-center gap-1 text-[11px] font-bold text-primary px-2">
        <span className="material-symbols-outlined" style={{ fontSize: 13, fontVariationSettings: "'FILL' 1" }}>check_circle</span>
        Connected
      </span>
    );
  } else if (localStatus === 'sent-pending') {
    button = <span className="text-[11px] font-bold text-on-surface-variant/60 px-2">Requested</span>;
  } else if (localStatus === 'received-pending') {
    button = (
      <button onClick={(e) => { e.stopPropagation(); navigate('/notifications'); }}
        className="px-3 py-1.5 rounded-full bg-primary/10 text-primary border border-primary/25 text-[11px] font-bold hover:bg-primary/20 transition-colors">
        Respond
      </button>
    );
  } else {
    button = (
      <button onClick={handleConnect} disabled={sending}
        className="px-3.5 py-1.5 rounded-full bg-primary text-on-primary text-[11px] font-bold uppercase tracking-wide hover:brightness-110 active:scale-95 transition-all disabled:opacity-60">
        {sending ? '…' : 'Connect'}
      </button>
    );
  }

  return (
    <div
      onClick={() => navigate(`/profile/${member.id}`)}
      className="flex items-center gap-3 px-2 py-2.5 rounded-2xl hover:bg-surface-container/60 transition-colors cursor-pointer"
    >
      <div className={`relative w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0 ${avatarBg(member.display_name)}`}>
        {member.avatar_url
          ? <img src={member.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
          : getInitials(member.display_name)}
        {member.trust_level >= 2 && (
          <div className="absolute -bottom-0.5 -right-0.5"><TrustBadge level={member.trust_level} size="sm" /></div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-on-surface truncate">{member.display_name}</p>
        {member.city && <p className="text-[11px] text-on-surface-variant/60 truncate">{member.city}</p>}
      </div>
      <div className="flex-shrink-0">{button}</div>
    </div>
  );
}

export default function ChannelMembers({ city, citySlug: slug, currentUserId, onClose }) {
  const [members, setMembers] = useState([]);
  const [statusById, setStatusById] = useState({});
  const [loading, setLoading] = useState(true);
  const showToast = useToast();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const [{ data: profiles }, { data: sent }, { data: received }, { data: blocked }, { data: blockedBy }] =
        await Promise.all([
          supabase.from('public_profiles')
            .select('id, display_name, avatar_url, city, trust_level, verification_status')
            .eq('verification_status', 'verified').limit(500),
          supabase.from('connections').select('target_id, status').eq('requester_id', currentUserId),
          supabase.from('connections').select('requester_id, status').eq('target_id', currentUserId),
          supabase.from('blocks').select('blocked_id').eq('blocker_id', currentUserId),
          supabase.from('blocks').select('blocker_id').eq('blocked_id', currentUserId),
        ]);

      if (cancelled) return;

      const blockedIds = new Set([
        ...((blocked || []).map((b) => b.blocked_id)),
        ...((blockedBy || []).map((b) => b.blocker_id)),
      ]);

      const status = {};
      (sent || []).forEach((c) => { status[c.target_id] = c.status === 'accepted' ? 'accepted' : 'sent-pending'; });
      (received || []).forEach((c) => {
        if (status[c.requester_id] === 'accepted') return;
        status[c.requester_id] = c.status === 'accepted' ? 'accepted' : 'received-pending';
      });

      const inCity = (profiles || [])
        .filter((p) => citySlug(p.city) === slug && !blockedIds.has(p.id))
        .sort((a, b) => {
          if (a.id === currentUserId) return -1;
          if (b.id === currentUserId) return 1;
          return (a.display_name || '').localeCompare(b.display_name || '');
        });

      setStatusById(status);
      setMembers(inCity);
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [slug, currentUserId]);

  async function handleConnect(targetId) {
    try {
      await connectionsService.sendRequest(currentUserId, targetId);
      showToast('Connection request sent!');
      return true;
    } catch {
      showToast('Could not send request.');
      return false;
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md max-h-[80vh] flex flex-col bg-surface-container-low border border-outline-variant/20 rounded-3xl shadow-card overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 flex-shrink-0 border-b border-outline-variant/15">
          <div>
            <h2 className="font-headline text-lg font-bold text-on-surface leading-tight">In {city}</h2>
            <p className="text-xs text-on-surface-variant/60 mt-0.5">
              {loading ? 'Loading…' : `${members.length} ${members.length === 1 ? 'woman' : 'women'} here · tap to view, connect to chat`}
            </p>
          </div>
          <button onClick={onClose}
            className="w-10 h-10 rounded-full hover:bg-surface-container flex items-center justify-center transition-colors flex-shrink-0"
            aria-label="Close">
            <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: 20 }}>close</span>
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-3 py-2 hide-scrollbar">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : members.length === 0 ? (
            <p className="text-center text-sm text-on-surface-variant/60 py-12 px-6">
              No one else here yet. As more women in {city} verify, they'll show up here.
            </p>
          ) : (
            members.map((m) => (
              <MemberRow
                key={m.id}
                member={m}
                status={statusById[m.id]}
                currentUserId={currentUserId}
                onConnect={handleConnect}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
