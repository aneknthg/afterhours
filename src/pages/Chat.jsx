/**
 * Chat.jsx — redesigned visual layer
 *
 * Logic preserved: Supabase realtime, presence, auth, RSVP gating,
 * community stats, content moderation, RichContent/SafeImageLink.
 *
 * Visual changes:
 * 1. Unified CircleRow for event + community (with type label)
 * 2. Search bar in sidebar
 * 3. "Event chat" / "Community" label in chat header
 * 4. Left accent indicator for active circle
 * 5. Online user avatars in desktop header
 * 6. Grouped same-author messages
 * 7. Pill-shaped input, gradient send button
 * 8. Profile footer in desktop sidebar
 */
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useRsvp } from '../lib/useRsvp';
import { EVENTS_DB } from '../data/events';
import { avatarBg, getInitials } from '../lib/avatar';
import { chatService, moderateMessage, citySlug, isGeneralChannel, cityGeneralCircle, generalCircleFromChannel, communityTypeKey } from '../services/chat.service';
import { useToast } from '../components/Toast';
import MessageReportModal from '../components/chat/MessageReportModal';
import ChannelMembers from '../components/chat/ChannelMembers';
import CircleMembersModal from '../components/chat/CircleMembersModal';
import PollMessage from '../components/PollMessage';
import CreatePollModal from '../components/CreatePollModal';

// WhatsApp-style composer: grows with content up to ~4 lines, then the box
// stays put and scrolls internally instead of clipping the newest line.
const MIN_INPUT_HEIGHT = 38;
const MAX_INPUT_HEIGHT = 100;

// ── Ice breakers ─────────────────────────────────────────────────────────────
const ICE_BREAKERS = {
  event: [
    "Hey everyone!",
    "First time at this event?",
    "Who else is coming solo?",
    "What are you most excited about?",
    "Anyone need a buddy for the day?",
    "What time are you arriving?",
    "Can't wait for this!",
  ],
  'community-general': [
    "Hey everyone!",
    "What's everyone up to this weekend?",
    "New here — excited to meet you all!",
    "What events are you planning to join?",
    "Anyone else loving this city?",
  ],
  'community-fitness':  ["Who's up for a workout buddy?", "Morning or evening workouts?", "What's your current fitness goal?", "Just finished a run! Anyone else active today?", "Favorite workout spot in the city?"],
  'community-creative': ["What's your current project?", "Self-taught or formal training?", "What inspires your work lately?", "Anyone want to collab?", "Share something you made recently!"],
  'community-music':    ["What are you listening to right now?", "Instrument, vocalist, or producer?", "Anyone looking for a jam session?", "Recommend a song!", "Live shows or studio recordings?"],
  'community-foodie':   ["Best restaurant you've tried lately?", "Anyone up for a group dinner?", "Home cook or eat out person?", "What cuisine are you obsessed with?", "Share your latest dish!"],
  'community-bookish':  ["What are you reading right now?", "Fiction or non-fiction person?", "Recommend a book that changed you!", "Last book that blew your mind?", "Anyone forming a reading group?"],
  'community-outdoors': ["Anyone up for a hike?", "Best trail you've done lately?", "Morning or sunset hikes?", "New to outdoor adventures here!", "What's on your adventure bucket list?"],
  'community-games':    ["What games are you into?", "Anyone want to organize a game night?", "Board games or video games?", "What's your chess skill level?", "Favorite game of all time?"],
  'community-tech':     ["What are you building?", "Frontend, backend, or full-stack?", "Favorite language or framework?", "Working on a side project?", "Best resource you've found lately?"],
  'community-wellness': ["How's everyone's wellness journey?", "Anyone have a morning routine they love?", "Favorite meditation practice?", "What's your self-care ritual?", "Anyone else doing a digital detox?"],
  'community-cinema':   ["Last film that stuck with you?", "Cinema or streaming at home?", "Recommend something underrated!", "Anyone up for a movie night?", "Favorite director of all time?"],
};

function getIceBreakers(circle) {
  if (!circle) return ICE_BREAKERS.event;
  if (circle.isEvent) return ICE_BREAKERS.event;
  // Keyed by circle type, not by room: ids carry a city now.
  return ICE_BREAKERS[communityTypeKey(circle.id)] || ICE_BREAKERS['community-general'];
}

function IceBreakerChips({ circle, onSelect, compact = false }) {
  const suggestions = getIceBreakers(circle);
  if (compact) {
    return (
      <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
        {suggestions.map((text) => (
          <button key={text} onClick={() => onSelect(text)}
            className="flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/25 hover:bg-primary/20 transition-all active:scale-95 whitespace-nowrap cursor-pointer">
            {text}
          </button>
        ))}
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-sm mx-auto">
      <p className="text-[10px] text-on-surface-variant/70 uppercase tracking-[0.2em] font-bold">Break the ice</p>
      <div className="flex flex-wrap justify-center gap-2">
        {suggestions.map((text) => (
          <button key={text} onClick={() => onSelect(text)}
            className="px-3.5 py-2 rounded-full text-sm font-medium bg-surface-container text-on-surface border border-outline-variant/20 hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-all active:scale-95 whitespace-nowrap cursor-pointer">
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Reply content encoding ────────────────────────────────────────────────────
// Replies are encoded directly in the message content so no extra DB column is needed.
// Format: __REPLY__{"i":"<id>","n":"<name>","c":"<quoted text>"}__\n<actual message>
const REPLY_PREFIX = '__REPLY__';
const REPLY_SUFFIX = '__\n';
function encodeReply(replyMsg, userText) {
  const meta = JSON.stringify({
    i: replyMsg.id,
    n: replyMsg.display_name,
    c: parseMessageContent(replyMsg.content).text.slice(0, 120),
  });
  return `${REPLY_PREFIX}${meta}${REPLY_SUFFIX}${userText}`;
}
function parseMessageContent(content) {
  if (!content || !content.startsWith(REPLY_PREFIX)) return { reply: null, text: content || '' };
  const end = content.indexOf(REPLY_SUFFIX, REPLY_PREFIX.length);
  if (end === -1) return { reply: null, text: content };
  try {
    const r = JSON.parse(content.slice(REPLY_PREFIX.length, end));
    return { reply: { id: r.i, display_name: r.n, content: r.c }, text: content.slice(end + REPLY_SUFFIX.length) };
  } catch { return { reply: null, text: content }; }
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function timeStr(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
function dateLabel(ts) {
  const d = new Date(ts);
  const diff = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

const CONTENT_REGEX = /(@\w+)|https?:\/\/[^\s<]+/g;
const IMAGE_EXT = /\.(jpg|jpeg|png|gif|webp)(\?[^\s]*)?$/i;

function SafeImageLink({ url }) {
  const [failed, setFailed] = useState(false);
  const short = url.replace(/^https?:\/\/(www\.)?/, '');
  if (failed) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer"
        className="text-primary underline text-xs break-all">
        {short.length > 60 ? short.slice(0, 60) + '…' : short}
      </a>
    );
  }
  return (
    <a href={url} target="_blank" rel="noopener noreferrer">
      <img src={url} alt="Shared"
        className="max-w-full max-h-60 rounded-xl border border-outline-variant/20 hover:opacity-90 transition-opacity"
        onError={() => setFailed(true)} />
    </a>
  );
}

function RichContent({ text }) {
  const parts = [];
  let lastIndex = 0;
  let match;
  const regex = new RegExp(CONTENT_REGEX);
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push({ type: 'text', value: text.slice(lastIndex, match.index) });
    if (match[0].startsWith('@')) {
      parts.push({ type: 'mention', value: match[0] });
    } else {
      const clean = match[0].replace(/["'<>`]/g, '');
      parts.push({ type: IMAGE_EXT.test(clean) ? 'image' : 'link', value: clean });
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) parts.push({ type: 'text', value: text.slice(lastIndex) });
  if (parts.length === 0) return <span>{text}</span>;
  return (
    <span>
      {parts.map((part, i) => {
        if (part.type === 'image') return <span key={i} className="block mt-2"><SafeImageLink url={part.value} /></span>;
        if (part.type === 'link') {
          const short = part.value.replace(/^https?:\/\/(www\.)?/, '');
          return <a key={i} href={part.value} target="_blank" rel="noopener noreferrer" className="text-primary underline break-all hover:brightness-110" onClick={(e) => e.stopPropagation()}>{short.length > 40 ? short.slice(0, 40) + '…' : short}</a>;
        }
        if (part.type === 'mention') return <span key={i} className="text-primary font-semibold">{part.value}</span>;
        return <span key={i}>{part.value}</span>;
      })}
    </span>
  );
}

// ── Avatar ────────────────────────────────────────────────────────────────────
function Avatar({ name, size = 'md', ring = false }) {
  const sz = size === 'lg' ? 'w-12 h-12 text-sm' : size === 'sm' ? 'w-8 h-8 text-[11px]' : 'w-9 h-9 text-xs';
  return (
    <div className={`${sz} ${avatarBg(name)} rounded-full flex items-center justify-center font-bold text-white flex-shrink-0 ${ring ? 'ring-2 ring-primary/40 ring-offset-2 ring-offset-background' : ''}`}>
      {getInitials(name)}
    </div>
  );
}

// ── Unified CircleRow ─────────────────────────────────────────────────────────
function CircleRow({ circle, isActive, onClick, stats, isPast = false }) {
  const isEvent = !!circle.isEvent;
  const { memberCount = 0, topContributors = [] } = stats || {};
  const subtitle = isEvent ? 'Event chat' : memberCount > 0 ? `${memberCount} members` : (circle.desc || 'Community');

  return (
    <button
      onClick={onClick}
      className={`group relative w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-left transition-all cursor-pointer ${
        isActive ? 'bg-surface-container-high/80' : 'hover:bg-surface-container/60'
      } ${isPast && !isActive ? 'opacity-55' : ''}`}
    >
      {/* Left accent */}
      <span className={`absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-r-full bg-primary transition-all duration-200 ${
        isActive ? 'h-7 opacity-100' : 'h-0 opacity-0'
      }`} />

      {/* Icon */}
      <div className="relative flex-shrink-0">
        <div className={`w-11 h-11 rounded-full flex items-center justify-center text-primary ${
          isEvent
            ? 'bg-gradient-to-br from-primary/20 to-primary-container/60 border border-primary/25'
            : 'bg-primary-container border border-primary/15'
        }`}>
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>{circle.icon}</span>
        </div>
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-sm font-semibold text-on-surface truncate">{circle.name}</span>
          {isEvent && (
            <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-primary/15 text-primary flex-shrink-0">
              Event
            </span>
          )}
        </div>
        <p className="text-xs text-on-surface-variant/60 truncate">{subtitle}</p>
        {!isEvent && topContributors.length > 0 && (
          <div className="flex items-center gap-1.5 mt-1.5">
            <div className="flex">
              {topContributors.slice(0, 3).map((c, i) => (
                <div key={c.user_id}
                  className={`w-4 h-4 rounded-full ${avatarBg(c.display_name)} flex items-center justify-center text-[8px] font-bold text-white border border-background`}
                  style={{ marginLeft: i > 0 ? '-4px' : 0, zIndex: 10 - i }}>
                  {getInitials(c.display_name)}
                </div>
              ))}
            </div>
            <span className="text-[10px] text-on-surface-variant/60 truncate">
              {topContributors[0]?.display_name.split(' ')[0]}
              {topContributors.length > 1 && ` +${topContributors.length - 1}`}
            </span>
          </div>
        )}
      </div>
    </button>
  );
}

// ── Event date helpers ────────────────────────────────────────────────────────
function parseEventDateStr(dateStr) {
  if (!dateStr) return null;
  const MONTHS = { jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11 };
  const m = dateStr.toLowerCase().match(/^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+(\d+)/);
  if (!m) return null;
  const mo = MONTHS[m[1]], day = parseInt(m[2]);
  const now = new Date();
  const year = (mo < now.getMonth() || (mo === now.getMonth() && day < now.getDate()))
    ? now.getFullYear() + 1 : now.getFullYear();
  return new Date(year, mo, day);
}
// events.id is a uuid column. A single non-uuid RSVP id (e.g. a legacy/curated
// "e1") in an `.in('id', ...)` filter 400s the whole query (22P02), which used
// to wipe out every event chat. Only pass real uuids to the events table.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function circleDate(circle) {
  if (circle.startsAt) return new Date(circle.startsAt);
  return parseEventDateStr(circle.eventDate);
}
function isCirclePast(circle) {
  const d = circleDate(circle);
  return d ? d < new Date() : false;
}

// ── Circle event categories ───────────────────────────────────────────────────
const CIRCLE_EVENT_CATS = {
  'community-general':  null,
  'community-fitness':  'sports',
  'community-creative': 'arts',
  'community-music':    'music',
  'community-foodie':   'food',
  'community-bookish':  'lit',
  'community-cinema':   'film',
  'community-outdoors': 'sports',
  'community-games':    null,
  'community-tech':     'tech',
  'community-career':   'networking',
  'community-wellness': 'wellness',
};
function upcomingCount(circleId) {
  const cat = CIRCLE_EVENT_CATS[circleId];
  if (cat === undefined) return 0;
  return cat ? EVENTS_DB.filter((e) => e.cat === cat).length : EVENTS_DB.length;
}

// ── RsvpGate ──────────────────────────────────────────────────────────────────
function RsvpGate({ circleName, onBrowse }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
      <div className="w-20 h-20 rounded-full bg-primary-container/40 border border-primary/30 flex items-center justify-center mb-6 shadow-glow">
        <span className="material-symbols-outlined text-primary" style={{ fontSize: 32 }}>lock</span>
      </div>
      <h3 className="font-headline text-2xl font-bold text-on-surface mb-2">RSVP required</h3>
      <p className="text-on-surface-variant text-sm max-w-xs leading-relaxed mb-7">
        You need to RSVP to <span className="text-on-surface font-semibold">{circleName}</span> before you can join the event chat.
      </p>
      <button onClick={onBrowse}
        className="px-6 py-3 rounded-full bg-primary text-on-primary text-sm font-semibold hover:brightness-110 hover:-translate-y-0.5 transition-all shadow-glow cursor-pointer">
        Browse events
      </button>
    </div>
  );
}

// ── JoinGate ────────────────────────────────────────────────────────────────
// Shown when the user opens a city General she hasn't joined yet. Asks her to
// confirm before she becomes a member and can read/post.
function JoinGate({ circleName, memberCount, joining, onJoin }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
      <div className="w-20 h-20 rounded-full bg-primary-container/40 border border-primary/30 flex items-center justify-center mb-6 shadow-glow">
        <span className="material-symbols-outlined text-primary" style={{ fontSize: 32 }}>groups</span>
      </div>
      <h3 className="font-headline text-2xl font-bold text-on-surface mb-2">Join {circleName}?</h3>
      <p className="text-on-surface-variant text-sm max-w-xs leading-relaxed mb-2">
        This is the community chat for everyone in this city. Join to see the conversation and say hello.
      </p>
      {memberCount > 0 && (
        <p className="text-xs text-on-surface-variant/60 mb-7">
          {memberCount} {memberCount === 1 ? 'member' : 'members'}
        </p>
      )}
      <button onClick={onJoin} disabled={joining}
        className="px-6 py-3 rounded-full bg-primary text-on-primary text-sm font-semibold hover:brightness-110 hover:-translate-y-0.5 transition-all shadow-glow cursor-pointer disabled:opacity-60 disabled:cursor-default disabled:hover:translate-y-0">
        {joining ? 'Joining…' : 'Join this chat'}
      </button>
    </div>
  );
}

// ── TypingIndicator ───────────────────────────────────────────────────────────
function TypingIndicator({ typingUsers }) {
  if (!typingUsers.length) return null;
  const names = typingUsers.slice(0, 3);
  const label = names.length === 1 ? `${names[0]} is typing`
    : names.length === 2 ? `${names[0]} and ${names[1]} are typing`
    : `${names[0]} and ${names.length - 1} others are typing`;
  return (
    <div className="flex items-center gap-2 self-start px-3 py-2 rounded-2xl bg-surface-container-high/50 border border-outline-variant/20">
      <div className="flex gap-0.5">
        {[0, 150, 300].map((d) => (
          <span key={d} className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: `${d}ms` }} />
        ))}
      </div>
      <span className="text-xs text-on-surface-variant/60 italic">{label}</span>
    </div>
  );
}

// ── MessageContextMenu ────────────────────────────────────────────────────────
function MessageContextMenu({ message, isOwn, position, onReport, onDelete, onCopy, onEdit, onReply, onClose }) {
  const menuRef = useRef(null);
  useEffect(() => {
    const h = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) onClose(); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [onClose]);
  const isDeleted = !message.content && !message.poll;
  const isPoll = !!message.poll;
  return (
    <div ref={menuRef}
      className="fixed z-[300] bg-surface-container-low/95 backdrop-blur-xl border border-outline-variant/30 rounded-2xl shadow-card overflow-hidden py-1.5 min-w-[180px] animate-fade-up"
      style={{ top: position.y, left: position.x }}>
      {!isDeleted && (
        <button onClick={() => { onReply(); onClose(); }}
          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-on-surface hover:bg-surface-container transition-colors text-left cursor-pointer">
          <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: 16 }}>reply</span>
          Reply
        </button>
      )}
      {!isDeleted && !isPoll && (
        <button onClick={() => { onCopy(); onClose(); }}
          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-on-surface hover:bg-surface-container transition-colors text-left cursor-pointer">
          <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: 16 }}>content_copy</span>
          Copy text
        </button>
      )}
      {isOwn && !isDeleted && !isPoll && (
        <button onClick={() => { onEdit(); onClose(); }}
          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-on-surface hover:bg-surface-container transition-colors text-left cursor-pointer">
          <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: 16 }}>edit</span>
          Edit message
        </button>
      )}
      {isOwn && !isDeleted && (
        <button onClick={() => { onDelete(); onClose(); }}
          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-error hover:bg-error-container/10 transition-colors text-left cursor-pointer">
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
          Delete {isPoll ? 'poll' : 'message'}
        </button>
      )}
      {!isOwn && !isDeleted && (
        <button onClick={() => { onReport(); onClose(); }}
          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-error hover:bg-error-container/10 transition-colors text-left cursor-pointer">
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>flag</span>
          Report {isPoll ? 'poll' : 'message'}
        </button>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Chat() {
  const { user, profile } = useAuth();
  const displayName = profile?.display_name || user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'User';
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const showToast = useToast();
  const { rsvpIds, loading: rsvpLoading, refresh: refreshRsvps } = useRsvp();

  // The rsvps realtime channel doesn't reliably deliver cancels, so a cancel made
  // elsewhere can leave a stale event chat here. Refetch RSVPs when the tab regains
  // focus so the event-chat list always matches the user's current RSVPs.
  useEffect(() => {
    const onFocus = () => refreshRsvps();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refreshRsvps]);

  const [eventCircles, setEventCircles] = useState([]);
  const [eventCirclesLoaded, setEventCirclesLoaded] = useState(false);
  const [communityCircles, setCommunityCircles] = useState([]);
  const [joinedGenerals, setJoinedGenerals] = useState(() => new Set());

  useEffect(() => {
    setCommunityCircles(chatService.buildCommunityCircles(profile?.hobbies || [], profile?.city));
  }, [profile?.hobbies, profile?.city]);

  // Which city Generals this user has joined (sticky across city changes).
  useEffect(() => {
    if (!user?.id) return;
    chatService.fetchJoinedGenerals(user.id).then((channels) => setJoinedGenerals(new Set(channels)));
  }, [user?.id]);

  // General circles = every city General the user has joined, plus her current
  // city's General (shown as joinable if she hasn't joined it yet). The current
  // city floats to the top.
  const generalCircles = useMemo(() => {
    const byId = new Map();
    for (const ch of joinedGenerals) byId.set(ch, generalCircleFromChannel(ch));
    const current = cityGeneralCircle(profile?.city);
    if (current && !byId.has(current.id)) byId.set(current.id, current);
    const list = [...byId.values()];
    const currentId = current?.id;
    // Current city first, then the rest alphabetically.
    return list.sort((a, b) => {
      if (a.id === currentId) return -1;
      if (b.id === currentId) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [joinedGenerals, profile?.city]);

  // Generals render above the hobby circles in the "Your Communities" section.
  const allCommunityCircles = useMemo(
    () => [...generalCircles, ...communityCircles],
    [generalCircles, communityCircles],
  );

  useEffect(() => {
    if (rsvpLoading) return;
    async function build() {
      const circles = [];
      EVENTS_DB.forEach((ev) => { if (rsvpIds.has(String(ev.id))) circles.push({ id: `event-${ev.id}`, name: ev.title, icon: 'confirmation_number', isEvent: true, eventDate: ev.date }); });
      if (rsvpIds.size > 0) {
        const curatedIds = new Set(EVENTS_DB.map((e) => String(e.id)));
        const userEventIds = [...rsvpIds].filter((id) => !curatedIds.has(id) && UUID_RE.test(id));
        if (userEventIds.length > 0) {
          const { data } = await supabase.from('events').select('id, title, starts_at').in('id', userEventIds);
          (data || []).forEach((ev) => circles.push({ id: `event-${ev.id}`, name: ev.title, icon: 'confirmation_number', isEvent: true, startsAt: ev.starts_at }));
        }
      }
      setEventCircles(circles);
      setEventCirclesLoaded(true);
    }
    build();
    const intv = setInterval(build, 30_000);
    return () => clearInterval(intv);
  }, [rsvpIds, rsvpLoading]);

  const allCircles = [...eventCircles, ...allCommunityCircles];
  const [activeCircle, setActiveCircle] = useState(null);

  // Which deep link (if any) has already been applied. Lets a later
  // /chat?event=B navigation switch circles even though Chat is already
  // mounted with circle A, without re-applying the same link when the
  // circle list re-fetches behind the user's own selection.
  const eventParam   = searchParams.get('event');
  const channelParam = searchParams.get('channel');
  const paramKey     = `${eventParam || ''}|${channelParam || ''}`;
  const handledParamRef = useRef(null);

  useEffect(() => {
    if (allCircles.length === 0) return;
    const paramChanged = handledParamRef.current !== paramKey;
    if (activeCircle && !paramChanged) return;
    if (eventParam) {
      const target = allCircles.find((c) => c.id === `event-${eventParam}`);
      if (target) { handledParamRef.current = paramKey; setActiveCircle(target); return; }
      // The deep-linked event circle is built async (rsvps + events fetch).
      // Don't fall back to a default until that build has finished, otherwise
      // we'd land on General and never correct.
      if (!eventCirclesLoaded) return;
      handledParamRef.current = paramKey;
      if (!activeCircle) setActiveCircle(allCircles[0]);
      return;
    }
    // Deep link straight into a city General, e.g. /chat?channel=community-general-hyderabad
    // (used for email links). Falls back to the join gate if she hasn't joined it yet.
    if (channelParam) {
      handledParamRef.current = paramKey;
      const target = allCircles.find((c) => c.id === channelParam);
      if (target) { setActiveCircle(target); return; }
      if (isGeneralChannel(channelParam)) { setActiveCircle(generalCircleFromChannel(channelParam)); return; }
    }
    handledParamRef.current = paramKey;
    if (!activeCircle) setActiveCircle(allCircles.find((c) => c.isEvent) || allCircles[0]);
  }, [allCircles.length, eventCirclesLoaded, paramKey]);

  const activeIsEventCircle = activeCircle?.isEvent ?? false;
  const activeEventId = activeIsEventCircle ? activeCircle.id.replace(/^event-/, '') : null;
  const hasRsvpForActiveCircle = activeIsEventCircle ? rsvpIds.has(String(activeEventId)) : true;

  // A city General the user hasn't joined yet shows a "Join this chat" gate
  // instead of messages, and blocks the composer until she joins.
  const activeIsUnjoinedGeneral =
    !!activeCircle?.isCityGeneral && !joinedGenerals.has(activeCircle.id);
  const canPostToActive = hasRsvpForActiveCircle && !activeIsUnjoinedGeneral;

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loadingMsgs, setLoadingMsgs] = useState(true);
  const [moderationError, setModerationError] = useState('');
  const messagesEndRef = useRef(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const typingTimeoutRef = useRef(null);
  const presenceChannelRef = useRef(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [reportingMessage, setReportingMessage] = useState(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [showIceBreakers, setShowIceBreakers] = useState(false);
  const [communityStats, setCommunityStats] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [editingMessage, setEditingMessage] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null);
  const [showPollModal, setShowPollModal] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionStartIndex, setMentionStartIndex] = useState(0);
  const [highlightedMsg, setHighlightedMsg] = useState(null);
  const inputRef = useRef(null);
  const messageRefs = useRef({});

  // Auto-grow the composer with content, capped at MAX_INPUT_HEIGHT — once
  // capped, the textarea scrolls internally instead of clipping the newest line.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, MAX_INPUT_HEIGHT) + 'px';
  }, [input]);

  function getActiveMention(text, cursor) {
    const before = text.slice(0, cursor);
    const match = before.match(/@(\w*)$/);
    if (!match) return null;
    return { start: match.index, query: match[1] };
  }
  function scrollToMessage(msgId) {
    const el = messageRefs.current[msgId];
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHighlightedMsg(msgId);
    setTimeout(() => setHighlightedMsg(null), 1200);
  }
  function cancelEdit() { setEditingMessage(null); setInput(''); }
  function cancelReply() { setReplyingTo(null); }
  function insertMention(name) {
    const cursor = inputRef.current?.selectionStart ?? input.length;
    const activeMention = getActiveMention(input, cursor);
    if (!activeMention) return;
    const newVal = input.slice(0, activeMention.start) + '@' + name + ' ' + input.slice(cursor);
    setInput(newVal);
    setShowMentionDropdown(false);
    setTimeout(() => {
      inputRef.current?.focus();
      const pos = activeMention.start + name.length + 2;
      inputRef.current?.setSelectionRange(pos, pos);
    }, 0);
  }

  // ── Community stats ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!allCommunityCircles.length) return;
    const ids = allCommunityCircles.map((c) => c.id);
    const since30d = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const since24h = new Date(Date.now() - 86_400_000).toISOString();

    async function loadStats() {
      // Message activity drives per-circle stats (top contributors, 24h volume).
      // Verified profiles per city drive each city General's "members" number.
      const [{ data }, { data: verified }] = await Promise.all([
        supabase.from('messages').select('channel, user_id, display_name, created_at')
          .in('channel', ids).gte('created_at', since30d).not('content', 'is', null)
          .order('created_at', { ascending: false }).limit(2000),
        supabase.from('public_profiles').select('city')
          .eq('verification_status', 'verified').limit(2000),
      ]);

      // Verified members per city slug — a city General's member count.
      const verifiedByCity = {};
      (verified || []).forEach(({ city }) => {
        const slug = citySlug(city);
        if (slug) verifiedByCity[slug] = (verifiedByCity[slug] || 0) + 1;
      });

      const agg = {};
      ids.forEach((id) => { agg[id] = { members: new Map(), lastActivity: null, msgCount24h: 0 }; });
      (data || []).forEach((msg) => {
        const s = agg[msg.channel];
        if (!s) return;
        if (!s.lastActivity) s.lastActivity = msg.created_at;
        if (msg.created_at >= since24h) s.msgCount24h++;
        const prev = s.members.get(msg.user_id);
        s.members.set(msg.user_id, { user_id: msg.user_id, display_name: msg.display_name, count: (prev?.count || 0) + 1 });
      });
      const stats = {};
      Object.entries(agg).forEach(([id, s]) => {
        const sorted = [...s.members.values()].sort((a, b) => b.count - a.count);
        stats[id] = { memberCount: s.members.size, topContributors: sorted.slice(0, 3), lastActivity: s.lastActivity, msgCount24h: s.msgCount24h };
      });

      // A city General is open to every verified woman in that city, not just
      // people who've posted. Count verified-in-city so a quiet but growing
      // community doesn't read as "2 members". Themed circles keep their
      // active-poster count, which is the more honest signal there.
      allCommunityCircles.forEach((c) => {
        if (c.isCityGeneral && stats[c.id]) {
          stats[c.id].memberCount = Math.max(verifiedByCity[c.citySlug] || 0, stats[c.id].memberCount);
        }
      });

      setCommunityStats(stats);
    }

    loadStats();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allCommunityCircles.length, allCommunityCircles.map((c) => c.id).join(',')]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // ── Join a city General ─────────────────────────────────────────────────────
  const [joining, setJoining] = useState(false);
  async function handleJoin(circle) {
    if (!user?.id || !circle) return;
    setJoining(true);
    try {
      await chatService.joinGeneral(user.id, circle.id);
      setJoinedGenerals((prev) => new Set(prev).add(circle.id));
    } catch {
      showToast('Could not join the chat. Please try again.');
    } finally {
      setJoining(false);
    }
  }

  // ── Messages + realtime ────────────────────────────────────────────────────
  useEffect(() => {
    if (!activeCircle || !canPostToActive) return;
    setLoadingMsgs(true); setMessages([]); setModerationError(''); setShowIceBreakers(false); setShowMembers(false);
    // Event chats and city Generals show full history so newcomers can read
    // what was said before they joined. Hobby circles still start from the
    // user's join date.
    const since = (activeCircle.isEvent || activeCircle.isCityGeneral) ? null : (user?.created_at ?? null);
    chatService.fetchMessages(activeCircle.id, 80, since).then((data) => { setMessages(data); setLoadingMsgs(false); }).catch(() => setLoadingMsgs(false));
    const ch = supabase.channel(`chat:${activeCircle.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `channel=eq.${activeCircle.id}` },
        (p) => { setMessages((prev) => prev.some((m) => m.id === p.new.id) ? prev : [...prev, p.new]); })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `channel=eq.${activeCircle.id}` },
        (p) => { setMessages((prev) => prev.map((m) => m.id === p.new.id ? { ...m, content: p.new.content, edited_at: p.new.edited_at ?? m.edited_at, poll: p.new.poll ?? m.poll, deleted_at: p.new.deleted_at ?? m.deleted_at } : m)); })
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [activeCircle?.id, canPostToActive]);

  // ── Presence ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!activeCircle || !user?.id || !canPostToActive) return;
    const pch = supabase.channel(`presence:${activeCircle.id}`, { config: { presence: { key: user.id } } });
    pch.on('presence', { event: 'sync' }, () => {
      const state = pch.presenceState();
      const users = []; const typing = [];
      Object.entries(state).forEach(([uid, presences]) => {
        if (uid === user.id) return;
        const p = presences[0];
        if (p) { users.push(p.display_name || 'Someone'); if (p.typing) typing.push(p.display_name || 'Someone'); }
      });
      setOnlineUsers(users); setTypingUsers(typing);
    }).subscribe(async (status) => { if (status === 'SUBSCRIBED') await pch.track({ display_name: displayName, typing: false }); });
    presenceChannelRef.current = pch;
    return () => { pch.untrack(); supabase.removeChannel(pch); };
  }, [activeCircle?.id, user?.id, canPostToActive]);

  const broadcastTyping = useCallback((isTyping) => {
    presenceChannelRef.current?.track({ display_name: displayName, typing: isTyping });
  }, [displayName]);

  function handleInputChange(e) {
    const val = e.target.value;
    setInput(val); setModerationError('');
    broadcastTyping(true);
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => broadcastTyping(false), 2000);
    const activeMention = getActiveMention(val, e.target.selectionStart);
    if (activeMention) {
      setMentionQuery(activeMention.query.toLowerCase());
      setMentionStartIndex(activeMention.start);
      setShowMentionDropdown(true);
    } else {
      setShowMentionDropdown(false);
    }
  }

  async function sendMessage() {
    const text = input.trim();
    if (!text || !user?.id || !activeCircle) return;
    setShowMentionDropdown(false);
    if (editingMessage) {
      const check = moderateMessage(text);
      if (!check.allowed) { setModerationError(check.reason); return; }
      setInput(''); setModerationError('');
      // Preserve the reply prefix from the original message when editing
      const { reply: origReply, text: origText } = parseMessageContent(editingMessage.content);
      const fullContent = origReply ? encodeReply({ id: origReply.id, display_name: origReply.display_name, content: origReply.content }, text) : text;
      if (text.trim() === origText.trim()) { setEditingMessage(null); return; }
      try {
        const result = await chatService.editMessage(editingMessage.id, user.id, fullContent);
        if (!result.edited) { setModerationError(result.reason); setInput(text); }
        else {
          const now = new Date().toISOString();
          setMessages((prev) => prev.map((m) => m.id === editingMessage.id ? { ...m, content: fullContent, edited_at: now } : m));
          setEditingMessage(null);
        }
      } catch { setInput(text); }
      return;
    }
    const check = moderateMessage(text);
    if (!check.allowed) { setModerationError(check.reason); return; }
    // Encode reply into content — no extra DB column needed
    const fullContent = replyingTo ? encodeReply(replyingTo, text) : text;
    setReplyingTo(null);
    setInput(''); setModerationError(''); broadcastTyping(false);
    try {
      const result = await chatService.sendMessage({ channel: activeCircle.id, userId: user.id, displayName, content: fullContent });
      if (!result.sent) { setModerationError(result.reason); setInput(text); }
      else if (result.warning) showToast(result.warning);
    } catch { setInput(text); }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    if (e.key === 'Escape') {
      if (editingMessage) cancelEdit();
      else if (replyingTo) cancelReply();
      else if (showMentionDropdown) setShowMentionDropdown(false);
    }
  }

  async function sendPoll({ question, options, multiple }) {
    if (!user?.id || !activeCircle) return;
    try {
      await chatService.sendPoll({ channel: activeCircle.id, userId: user.id, displayName, question, options, multiple });
    } catch { showToast('Failed to create poll. Please try again.'); }
  }

  async function sendIceBreaker(text) {
    if (!user?.id || !activeCircle) return;
    setShowIceBreakers(false);
    const check = moderateMessage(text);
    if (!check.allowed) return;
    try {
      const result = await chatService.sendMessage({ channel: activeCircle.id, userId: user.id, displayName, content: text });
      if (!result.sent) setModerationError(result.reason);
      else if (result.warning) showToast(result.warning);
    } catch {}
  }

  function handleContextMenu(e, msg) {
    e.preventDefault(); e.stopPropagation();
    setContextMenu({ message: msg, x: Math.min(e.clientX, window.innerWidth - 200), y: Math.min(e.clientY, window.innerHeight - 240) });
  }
  function handleLongPress(msg) {
    setContextMenu({ message: msg, x: window.innerWidth / 2 - 100, y: window.innerHeight / 2 - 100 });
  }

  async function handleDeleteMessage(msg) {
    try {
      await chatService.deleteOwnMessage(msg.id, user.id);
      setMessages((prev) => prev.map((m) => m.id === msg.id ? { ...m, content: null, deleted_at: new Date().toISOString() } : m));
    } catch {}
  }
  function handleCopyMessage(msg) {
    const { text } = parseMessageContent(msg.content);
    navigator.clipboard?.writeText(text);
    showToast('Copied to clipboard');
  }

  // Still resolving (rsvps loading, or circles exist but the first one hasn't
  // been selected yet) → spinner.
  if (rsvpLoading || (!activeCircle && allCircles.length > 0)) {
    return (
      <div className="flex items-center justify-center" style={{ height: 'calc(100vh - 64px)' }}>
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // No circles at all — e.g. a verified user with no city set and no event
  // RSVPs. Point her at setting a city so her city General appears.
  if (!activeCircle) {
    return (
      <div className="flex flex-col items-center justify-center text-center px-8" style={{ height: 'calc(100vh - 64px)' }}>
        <div className="w-20 h-20 rounded-full bg-primary-container/40 border border-primary/30 flex items-center justify-center mb-6 shadow-glow">
          <span className="material-symbols-outlined text-primary" style={{ fontSize: 32 }}>forum</span>
        </div>
        <h3 className="font-headline text-2xl font-bold text-on-surface mb-2">No chats yet</h3>
        <p className="text-on-surface-variant text-sm max-w-xs leading-relaxed mb-7">
          Set your city to join its community chat, or RSVP to an event to unlock its group chat.
        </p>
        <button onClick={() => navigate('/profile?edit=city')}
          className="px-6 py-3 rounded-full bg-primary text-on-primary text-sm font-semibold hover:brightness-110 hover:-translate-y-0.5 transition-all shadow-glow cursor-pointer">
          Set your city
        </button>
      </div>
    );
  }

  // Filtered lists for search
  const q = searchQuery.toLowerCase();
  const filteredEvents = eventCircles.filter((c) => !q || c.name.toLowerCase().includes(q));
  const filteredCommunities = allCommunityCircles.filter((c) => !q || c.name.toLowerCase().includes(q));

  // ── Sidebar content ────────────────────────────────────────────────────────
  function SidebarContent({ onSelect }) {
    const upcomingEvents = filteredEvents
      .filter((c) => !isCirclePast(c))
      .sort((a, b) => {
        const da = circleDate(a), db = circleDate(b);
        if (!da && !db) return 0;
        if (!da) return 1;
        if (!db) return -1;
        return da - db;
      });
    const pastEvents = filteredEvents
      .filter((c) => isCirclePast(c))
      .sort((a, b) => {
        const da = circleDate(a), db = circleDate(b);
        if (!da && !db) return 0;
        if (!da) return 1;
        if (!db) return -1;
        return db - da;
      });

    return (
      <div className="flex-1 overflow-y-auto px-2 py-2 hide-scrollbar flex flex-col gap-0.5">
        {/* Upcoming Events */}
        {upcomingEvents.length > 0 && (
          <div className="mb-1">
            <p className="text-[10px] text-on-surface-variant/70 uppercase tracking-[0.18em] font-bold px-3 pt-3 pb-1.5">
              Upcoming Events
            </p>
            {upcomingEvents.map((c) => (
              <CircleRow key={c.id} circle={c} isActive={activeCircle?.id === c.id}
                onClick={() => { setActiveCircle(c); onSelect?.(); }}
                stats={null} isPast={false} />
            ))}
          </div>
        )}

        {filteredEvents.length === 0 && !rsvpLoading && !q && (
          <div className="mx-1 mt-2 p-4 rounded-2xl bg-surface-container border border-outline-variant/15 text-center">
            <span className="material-symbols-outlined text-on-surface-variant text-2xl mb-2 block">event_available</span>
            <p className="text-xs text-on-surface-variant leading-relaxed">RSVP to an event to unlock its group chat.</p>
            <button onClick={() => navigate('/')} className="text-xs text-primary font-bold mt-2 hover:underline cursor-pointer">Browse events</button>
          </div>
        )}

        {/* Your Communities */}
        {filteredCommunities.length > 0 && (
          <div className="mb-1">
            <p className="text-[10px] text-on-surface-variant/70 uppercase tracking-[0.18em] font-bold px-3 pt-3 pb-1.5">
              Your Communities
            </p>
            {filteredCommunities.map((c) => (
              <CircleRow key={c.id} circle={c} isActive={activeCircle?.id === c.id}
                onClick={() => { setActiveCircle(c); onSelect?.(); }}
                stats={communityStats[c.id]} />
            ))}
          </div>
        )}

        {/* Past Events */}
        {pastEvents.length > 0 && (
          <div className="mb-1">
            <p className="text-[10px] text-on-surface-variant/60 uppercase tracking-[0.18em] font-bold px-3 pt-3 pb-1.5">
              Past Events
            </p>
            {pastEvents.map((c) => (
              <CircleRow key={c.id} circle={c} isActive={activeCircle?.id === c.id}
                onClick={() => { setActiveCircle(c); onSelect?.(); }}
                stats={null} isPast={true} />
            ))}
          </div>
        )}

        {q && filteredEvents.length === 0 && filteredCommunities.length === 0 && (
          <div className="mx-2 mt-6 text-center">
            <p className="text-sm text-on-surface-variant/60">No circles match &ldquo;{searchQuery}&rdquo;</p>
          </div>
        )}
      </div>
    );
  }

  // ── Sidebar header (shared) ────────────────────────────────────────────────
  function SidebarHeader({ showClose }) {
    return (
      <div className="px-4 pt-5 pb-3 flex-shrink-0 border-b border-outline-variant/15">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-headline text-xl font-bold text-on-surface">Circles</h2>
          <div className="flex items-center gap-2">
            {showClose && (
              <button onClick={() => setMobileSidebarOpen(false)}
                className="w-11 h-11 rounded-full hover:bg-surface-container flex items-center justify-center transition-colors cursor-pointer"
                aria-label="Close">
                <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: 18 }}>close</span>
              </button>
            )}
          </div>
        </div>
        {/* Search */}
        <div className="relative">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/40 pointer-events-none" style={{ fontSize: 16 }}>search</span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search circles..."
            className="w-full bg-surface-container/60 border border-outline-variant/20 rounded-full pl-9 pr-4 py-2 text-[16px] md:text-sm text-on-surface placeholder:text-on-surface-variant/40 outline-none focus:border-primary/40 transition-all"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex overflow-hidden h-[calc(100dvh-144px)] md:h-[calc(100dvh-64px)]">
      {reportingMessage && (
        <MessageReportModal message={reportingMessage} reporterId={user?.id} onClose={() => setReportingMessage(null)} />
      )}
      {showPollModal && (
        <CreatePollModal onClose={() => setShowPollModal(false)} onSubmit={sendPoll} />
      )}
      {showMembers && activeCircle?.isCityGeneral && (
        <ChannelMembers
          city={activeCircle.name.replace(/^General · /, '')}
          citySlug={activeCircle.citySlug}
          currentUserId={user?.id}
          onClose={() => setShowMembers(false)}
        />
      )}
      {showMembers && activeCircle && !activeCircle.isCityGeneral && (
        <CircleMembersModal
          circle={activeCircle}
          messages={messages}
          onClose={() => setShowMembers(false)}
        />
      )}
      {contextMenu && (
        <MessageContextMenu
          message={contextMenu.message}
          isOwn={contextMenu.message.user_id === user?.id}
          position={{ x: contextMenu.x, y: contextMenu.y }}
          onReport={() => setReportingMessage(contextMenu.message)}
          onDelete={() => handleDeleteMessage(contextMenu.message)}
          onCopy={() => handleCopyMessage(contextMenu.message)}
          onReply={() => { setReplyingTo(contextMenu.message); setEditingMessage(null); setTimeout(() => inputRef.current?.focus(), 50); }}
          onEdit={() => { setEditingMessage(contextMenu.message); setInput(parseMessageContent(contextMenu.message.content).text); setReplyingTo(null); setTimeout(() => inputRef.current?.focus(), 50); }}
          onClose={() => setContextMenu(null)} />
      )}

      {/* ── Desktop sidebar ── */}
      <aside className="w-72 min-w-[288px] hidden md:flex flex-col flex-shrink-0 border-r border-outline-variant/20 bg-surface-container-lowest/80 backdrop-blur-xl">
        {SidebarHeader({ showClose: false })}
        {SidebarContent({})}
      </aside>

      {/* ── Mobile sidebar overlay ── */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-[200] md:hidden">
          <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" onClick={() => setMobileSidebarOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-[88%] max-w-sm bg-surface-container-lowest border-r border-outline-variant/20 flex flex-col shadow-card">
            {SidebarHeader({ showClose: true })}
            {SidebarContent({ onSelect: () => setMobileSidebarOpen(false) })}
          </aside>
        </div>
      )}

      {/* ── Chat area ── */}
      <div className="flex-1 flex flex-col bg-background min-w-0 relative">
        {/* Ambient glow */}
        <div className="absolute top-0 inset-x-0 h-64 bg-gradient-glow pointer-events-none opacity-60" />

        {/* Header */}
        <div className="relative px-3 md:px-6 py-3 flex items-center gap-3 flex-shrink-0 bg-background/70 backdrop-blur-xl border-b border-outline-variant/20 z-10">
          <button
            onClick={() => setMobileSidebarOpen(true)}
            className="md:hidden w-9 h-9 rounded-full hover:bg-surface-container flex items-center justify-center flex-shrink-0 transition-colors cursor-pointer"
            aria-label="Open circles">
            <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: 20 }}>menu</span>
          </button>

          <div className={`w-11 h-11 rounded-full flex items-center justify-center text-primary flex-shrink-0 ${
            activeCircle.isEvent
              ? 'bg-gradient-to-br from-primary/20 to-primary-container/60 border border-primary/25'
              : 'bg-primary-container border border-primary/15'
          }`}>
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>{activeCircle.icon}</span>
          </div>

          <div className="flex-1 min-w-0">
            <p className="font-headline text-base text-on-surface font-semibold truncate leading-tight">{activeCircle.name}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <p className="text-xs text-on-surface-variant/60 truncate">
                {activeCircle.isEvent ? 'Event chat' : 'Community'}
              </p>
            </div>
          </div>

          {/* Members button — always visible; opens roster for any circle type */}
          <button
            onClick={() => setShowMembers(true)}
            title="See who's here"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-container-high/60 border border-outline-variant/20 hover:bg-surface-container-high transition-colors flex-shrink-0 cursor-pointer">
            <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: 16 }}>group</span>
            {activeCircle.isCityGeneral && communityStats[activeCircle.id]?.memberCount > 0 && (
              <span className="text-xs font-semibold text-on-surface-variant">
                {communityStats[activeCircle.id].memberCount}
              </span>
            )}
          </button>
        </div>

        {!hasRsvpForActiveCircle ? (
          <RsvpGate circleName={activeCircle.name} onBrowse={() => navigate('/')} />
        ) : activeIsUnjoinedGeneral ? (
          <JoinGate
            circleName={activeCircle.name}
            memberCount={communityStats[activeCircle.id]?.memberCount || 0}
            joining={joining}
            onJoin={() => handleJoin(activeCircle)}
          />
        ) : (
          <>
            {/* Messages */}
            <div className="relative flex-1 overflow-y-auto px-3 md:px-6 py-5 flex flex-col gap-1">
              {loadingMsgs ? (
                <div className="flex items-center justify-center flex-1">
                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center flex-1 text-center px-4 gap-7">
                  <div>
                    <div className="w-20 h-20 rounded-full bg-primary-container/50 border border-primary/25 flex items-center justify-center mb-5 mx-auto shadow-glow text-primary">
                      <span className="material-symbols-outlined" style={{ fontSize: 36 }}>{activeCircle.icon}</span>
                    </div>
                    <p className="font-headline text-xl font-semibold text-on-surface mb-1.5">Start the conversation</p>
                    <p className="text-on-surface-variant text-sm max-w-xs leading-relaxed">
                      {activeCircle.isEvent
                        ? `Say hi to fellow attendees of ${activeCircle.name}.`
                        : `Be the first to say something in ${activeCircle.name}.`}
                    </p>
                  </div>
                  <IceBreakerChips circle={activeCircle} onSelect={sendIceBreaker} />
                </div>
              ) : (
                messages.map((msg, idx) => {
                  const isMine = msg.user_id === user?.id;
                  const isDeleted = !msg.content && !msg.poll;
                  const curDateKey = new Date(msg.created_at).toDateString();
                  const prevDateKey = idx > 0 ? new Date(messages[idx - 1].created_at).toDateString() : null;
                  const showSep = curDateKey !== prevDateKey;
                  const prev = messages[idx - 1];
                  const next = messages[idx + 1];
                  const sameAuthor = prev && prev.user_id === msg.user_id && !showSep
                    && new Date(msg.created_at).getTime() - new Date(prev.created_at).getTime() < 5 * 60_000;
                  const isLastInGroup = !next || next.user_id !== msg.user_id
                    || new Date(next.created_at).getTime() - new Date(msg.created_at).getTime() >= 5 * 60_000;
                  const { reply: msgReply, text: msgText } = parseMessageContent(msg.content);

                  return (
                    <div
                      key={msg.id}
                      ref={(el) => { if (el) messageRefs.current[msg.id] = el; }}
                      className={`${sameAuthor ? 'mt-0.5' : 'mt-3'} rounded-xl transition-colors duration-300 ${highlightedMsg === msg.id ? 'bg-primary/10' : ''}`}
                    >
                      {showSep && (
                        <div className="flex items-center gap-3 my-4">
                          <div className="flex-1 h-px bg-outline-variant/15" />
                          <span className="text-[10px] text-on-surface-variant/60 uppercase tracking-widest font-bold px-2">{dateLabel(msg.created_at)}</span>
                          <div className="flex-1 h-px bg-outline-variant/15" />
                        </div>
                      )}
                      <div
                        className={`flex gap-2.5 ${isMine ? 'flex-row-reverse' : ''} group`}
                        onContextMenu={(e) => handleContextMenu(e, msg)}
                        onTouchStart={() => {
                          const t = setTimeout(() => handleLongPress(msg), 500);
                          // Cancel on touchmove too, or scrolling with a finger
                          // held down opens the context menu.
                          const c = () => {
                            clearTimeout(t);
                            document.removeEventListener('touchend', c);
                            document.removeEventListener('touchmove', c);
                          };
                          document.addEventListener('touchend', c, { once: true });
                          document.addEventListener('touchmove', c, { once: true });
                        }}
                      >
                        {/* Avatar */}
                        {!isMine && (
                          <div className="w-9 flex-shrink-0 self-end">
                            {isLastInGroup
                              ? <button onClick={() => navigate(`/profile/${msg.user_id}`)} className="hover:opacity-80 transition-opacity cursor-pointer"><Avatar name={msg.display_name} /></button>
                              : null}
                          </div>
                        )}

                        <div className={`max-w-[72%] md:max-w-[60%] flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                          {!isMine && !sameAuthor && (
                            <button onClick={() => navigate(`/profile/${msg.user_id}`)}
                              className="text-[11px] font-semibold text-primary mb-1 px-1 hover:underline cursor-pointer">
                              {msg.display_name}
                            </button>
                          )}
                          {/* Reply quote block */}
                          {msgReply && !isDeleted && (
                            <button
                              onClick={() => scrollToMessage(msgReply.id)}
                              className="flex items-start gap-2 mb-1 px-2.5 py-1.5 rounded-xl bg-surface-container-high/60 border border-outline-variant/15 hover:bg-surface-container-high/80 transition-colors max-w-full text-left cursor-pointer">
                              <div className="w-[3px] self-stretch min-h-5 bg-primary/60 rounded-full flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-[10px] font-semibold text-primary truncate">{msgReply.display_name}</p>
                                <p className="text-xs text-on-surface-variant/70 truncate leading-snug">{msgReply.content}</p>
                              </div>
                            </button>
                          )}
                          <div className={`px-4 py-2.5 text-sm leading-relaxed break-words ${
                            isDeleted
                              ? 'bg-surface-container/50 text-on-surface-variant/40 border border-outline-variant/10 rounded-2xl italic'
                              : isMine
                              ? `bg-primary-container text-primary border border-primary/25 rounded-2xl ${sameAuthor && !msgReply ? 'rounded-tr-md' : ''} rounded-br-md`
                              : `bg-surface-container text-on-surface border border-outline-variant/20 rounded-2xl ${sameAuthor && !msgReply ? 'rounded-tl-md' : ''} rounded-bl-md`
                          }`}>
                            {isDeleted ? (
                              <span className="flex items-center gap-1.5 italic">
                                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>delete</span>
                                Message deleted
                              </span>
                            ) : msg.poll ? (
                              <PollMessage message={msg} />
                            ) : (
                              <RichContent text={msgText} />
                            )}
                          </div>
                          <div className={`flex items-center gap-1.5 mt-1 px-1 ${isMine ? 'flex-row-reverse' : ''}`}>
                            <p className="text-[10px] text-on-surface-variant/60 font-medium">{timeStr(msg.created_at)}</p>
                            {msg.edited_at && !isDeleted && (
                              <span className="text-[10px] text-on-surface-variant/50 italic">edited</span>
                            )}
                            {!isDeleted && (
                              <button
                                onClick={(e) => handleContextMenu(e, msg)}
                                className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-surface-container cursor-pointer"
                                aria-label="Message options">
                                <span className="material-symbols-outlined text-on-surface-variant/30 hover:text-on-surface-variant" style={{ fontSize: 14 }}>more_horiz</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <TypingIndicator typingUsers={typingUsers} />
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div
              className="px-3 md:px-6 py-3 flex-shrink-0 bg-background/80 backdrop-blur-xl border-t border-outline-variant/15"
              style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
            >
              {showIceBreakers && (
                <div className="mb-2.5 animate-fade-up">
                  <IceBreakerChips circle={activeCircle} onSelect={sendIceBreaker} compact />
                </div>
              )}
              {/* Reply preview */}
              {replyingTo && (
                <div className="flex items-center gap-2 mb-2 px-3 py-2 rounded-2xl bg-primary/10 border border-primary/20 animate-fade-up">
                  <div className="w-[3px] h-8 bg-primary/70 rounded-full flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-semibold text-primary">{replyingTo.display_name}</p>
                    <p className="text-xs text-on-surface-variant/60 truncate">{replyingTo.content}</p>
                  </div>
                  <button onClick={cancelReply} className="flex-shrink-0 text-on-surface-variant/40 hover:text-on-surface-variant cursor-pointer">
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
                  </button>
                </div>
              )}
              {/* Edit banner */}
              {editingMessage && (
                <div className="flex items-center gap-2 mb-2 px-3 py-2 rounded-2xl bg-surface-container border border-outline-variant/20 animate-fade-up">
                  <span className="material-symbols-outlined text-primary flex-shrink-0" style={{ fontSize: 16 }}>edit</span>
                  <p className="text-xs text-on-surface-variant flex-1 truncate">Editing: {editingMessage.content.slice(0, 60)}{editingMessage.content.length > 60 ? '…' : ''}</p>
                  <button onClick={cancelEdit} className="flex-shrink-0 text-on-surface-variant/40 hover:text-on-surface-variant cursor-pointer">
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
                  </button>
                </div>
              )}
              {moderationError && (
                <div className="flex items-start gap-2 mb-2 px-3 py-2.5 rounded-2xl bg-error-container/20 border border-error/25 animate-fade-up">
                  <span className="material-symbols-outlined text-error flex-shrink-0 mt-0.5" style={{ fontSize: 14 }}>shield</span>
                  <p className="text-xs text-error leading-relaxed flex-1">{moderationError}</p>
                  <button onClick={() => setModerationError('')} className="flex-shrink-0 text-error/50 hover:text-error cursor-pointer">
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>close</span>
                  </button>
                </div>
              )}
              <div className="relative">
                {/* @mention dropdown */}
                {showMentionDropdown && (() => {
                  // Build participant list from message senders + currently online users
                  const onlineSet = new Set(onlineUsers);
                  const seen = new Set();
                  const participants = [];
                  messages.forEach((m) => {
                    if (m.user_id !== user?.id && m.display_name && !seen.has(m.display_name)) {
                      seen.add(m.display_name);
                      participants.push({ name: m.display_name, online: onlineSet.has(m.display_name) });
                    }
                  });
                  onlineUsers.forEach((name) => {
                    if (!seen.has(name)) participants.push({ name, online: true });
                  });
                  const suggestions = participants.filter(({ name }) => !mentionQuery || name.toLowerCase().startsWith(mentionQuery));
                  return suggestions.length > 0 ? (
                    <div className="absolute bottom-full left-0 right-0 mb-1.5 bg-surface-container-low/95 backdrop-blur-xl border border-outline-variant/30 rounded-2xl shadow-card overflow-hidden animate-fade-up z-10">
                      {suggestions.map(({ name, online }) => (
                        <button key={name}
                          onMouseDown={(e) => { e.preventDefault(); insertMention(name); }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-on-surface hover:bg-surface-container transition-colors text-left cursor-pointer">
                          <div className={`w-7 h-7 rounded-full ${avatarBg(name)} flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0`}>
                            {getInitials(name)}
                          </div>
                          <span className="font-medium flex-1">{name}</span>
                        </button>
                      ))}
                    </div>
                  ) : null;
                })()}
                <div className="flex items-end gap-2 bg-surface-container rounded-3xl pl-2 pr-1.5 py-1.5 border border-outline-variant/20 focus-within:border-primary/40 transition-all">
                  {/* Ice breaker toggle */}
                  <button
                    onClick={() => setShowIceBreakers((v) => !v)}
                    aria-label="Ice breakers"
                    title="Ice breakers"
                    className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-all cursor-pointer ${
                      showIceBreakers ? 'bg-primary/15 text-primary' : 'text-on-surface-variant/40 hover:text-on-surface-variant hover:bg-surface-container-high'
                    }`}>
                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>auto_awesome</span>
                  </button>
                  {/* Poll button */}
                  {!editingMessage && (
                    <button
                      onClick={() => setShowPollModal(true)}
                      aria-label="Create poll"
                      title="Create poll"
                      className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-on-surface-variant/40 hover:text-on-surface-variant hover:bg-surface-container-high transition-all cursor-pointer">
                      <span className="material-symbols-outlined" style={{ fontSize: 18 }}>bar_chart</span>
                    </button>
                  )}
                  <textarea
                    ref={inputRef}
                    rows={1}
                    maxLength={1000}
                    placeholder={editingMessage ? 'Edit message...' : activeCircle.isEvent ? `Message ${activeCircle.name} attendees...` : `Message ${activeCircle.name}...`}
                    value={input}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    style={{ minHeight: MIN_INPUT_HEIGHT, maxHeight: MAX_INPUT_HEIGHT, lineHeight: '22px' }}
                    className="flex-1 bg-transparent border-none outline-none resize-none text-on-surface text-[16px] md:text-sm caret-primary placeholder:text-on-surface-variant/40 py-2"
                  />
                  <button
                    onClick={sendMessage}
                    aria-label={editingMessage ? 'Save edit' : 'Send message'}
                    disabled={!input.trim()}
                    className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                      input.trim()
                        ? 'bg-primary text-on-primary hover:brightness-110 active:scale-95 shadow-glow cursor-pointer'
                        : 'bg-surface-container-high text-on-surface-variant/30 cursor-default'
                    }`}>
                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{editingMessage ? 'check' : 'send'}</span>
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
