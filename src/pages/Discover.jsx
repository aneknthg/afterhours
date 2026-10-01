/**
 * Discover.jsx — Personalized discovery page
 *
 * Sections (in order):
 *  1. Hero — featured event
 *  2. People like you — matched users
 *  3. Shelves — horizontal scroll rows ("For you", "Free tonight")
 *  4. Browse — desktop: list + spotlight split | mobile: card grid
 */
import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { EVENTS_DB, EVENTS_DESC } from '../data/events';
import { HOBBY_TO_CAT } from '../data/interests';
import { decayFactor, diversify, scoreEvent } from '../utils/scoring';
import { useAuth } from '../lib/AuthContext';
import { useToast } from '../components/Toast';
import { useRsvp, fetchRsvpCounts, fetchAttendeeAvatars } from '../lib/useRsvp';
import { useVerificationGate } from '../lib/VerificationGate';
import { supabase } from '../lib/supabase';
import EventCard from '../components/EventCard';
import { EventListRowSkeleton } from '../components/EventCardSkeleton';
import Footer from '../components/Footer';
import Button from '../components/ui/Button';
import Tag from '../components/ui/Tag';
import PeopleLikeYou from '../components/PeopleLikeYou';
import MoodFilter, { applyMoodFilter } from '../components/events/MoodFilter';
import EmptyState from '../components/EmptyState';
import { LAUNCH_CITY, sameCity } from '../lib/city';
import { CAT_IMAGES } from '../lib/categoryImages';
import { isPaidEvent } from '../lib/payments.service';


// ─── Hero label ───────────────────────────────────────────────────────────────
// Returns a day-aware label for the hero carousel badge.
// "Trending" when the event has RSVPs; "Spotlight" otherwise.
// Never says "Tonight" — that framing implies a nightlife platform.
function getHeroLabel(event, attendeeCount, countsLoading) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  let eventDate = null;
  if (event.starts_at) {
    eventDate = new Date(event.starts_at);
  } else if (event.date) {
    const m = event.date.match(/^(\d+)\s+(\w+)/);
    if (m) {
      const monthMap = { Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11 };
      const mo = monthMap[m[2]];
      if (mo !== undefined) eventDate = new Date(now.getFullYear(), mo, parseInt(m[1], 10));
    }
  }

  const hasTraction = !countsLoading && attendeeCount > 0;
  const prefix = hasTraction ? 'Trending' : 'Spotlight';

  if (!eventDate) return prefix;
  const diff = Math.round((new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate()) - todayStart) / 86400000);
  const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const suffix = diff === 0 ? 'Today' : diff === 1 ? 'Tomorrow' : diff > 1 && diff <= 6 ? dayNames[eventDate.getDay()] : '';

  return suffix ? `${prefix} · ${suffix}` : prefix;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CAT_FILTER_CONFIG = [
  { key: 'all',      label: 'All',      icon: 'apps' },
  { key: 'music',    label: 'Music',    icon: 'music_note' },
  { key: 'arts',     label: 'Arts',     icon: 'palette' },
  { key: 'food',     label: 'Food',     icon: 'restaurant' },
  { key: 'lit',      label: 'Books',    icon: 'menu_book' },
  { key: 'sports',   label: 'Sports',   icon: 'sports_tennis' },
  { key: 'film',     label: 'Film',     icon: 'movie' },
  { key: 'wellness', label: 'Wellness', icon: 'self_improvement' },
  { key: 'tech',     label: 'Tech',     icon: 'computer' },
  { key: 'social',   label: 'Social',   icon: 'groups' },
];


// ─── Section Header ───────────────────────────────────────────────────────────

function SectionHeader({ eyebrow, title, subtitle, action }) {
  return (
    <div className="flex items-end justify-between mb-7">
      <div>
        {eyebrow && (
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary/60 mb-1.5 font-label">
            {eyebrow}
          </p>
        )}
        <h2 className="font-headline text-2xl md:text-[1.75rem] font-bold text-on-surface leading-tight">
          {title}
        </h2>
        {subtitle && (
          <p className="text-sm text-on-surface-variant/70 mt-1">{subtitle}</p>
        )}
      </div>
      {action && <div className="ml-4 flex-shrink-0">{action}</div>}
    </div>
  );
}

// ─── Shelf Row ────────────────────────────────────────────────────────────────
// Desktop: 4-col grid. Mobile/tablet: horizontal scroll + snap.

function ShelfRow({ events, isGoing, onRsvp, attendeeCounts, countsLoading, attendeeProfiles }) {
  const cardFor = (event) => (
    <EventCard
      key={event.id}
      event={event}
      isGoing={isGoing(event.id)}
      onRsvp={onRsvp}
      attendeeCount={countsLoading ? null : (attendeeCounts[String(event.id)] || 0)}
      attendees={attendeeProfiles?.[String(event.id)] || []}
    />
  );

  return (
    <>
      {/* Desktop: grid — all cards visible, no scroll needed */}
      <div className="hidden lg:grid lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {events.map(cardFor)}
      </div>

      {/* Mobile / tablet: horizontal scroll + snap */}
      <div
        className="lg:hidden flex gap-4 overflow-x-auto hide-scrollbar pb-4 -mx-6 px-6 md:-mx-12 md:px-12"
        style={{ scrollSnapType: 'x mandatory' }}
      >
        {events.map((event) => (
          <div key={event.id} className="flex-shrink-0 w-[72vw] sm:w-72" style={{ scrollSnapAlign: 'start' }}>
            {cardFor(event)}
          </div>
        ))}
      </div>
    </>
  );
}

// ─── Event List Row ───────────────────────────────────────────────────────────
// Compact one-liner for the browse list

function EventListRow({ event, isSelected, isGoing, attendeeCount, onClick }) {
  const catIcon = CAT_FILTER_CONFIG.find((c) => c.key === event.cat)?.icon || 'event';

  return (
    <button
      onClick={onClick}
      className={[
        'relative w-full flex items-center gap-3 py-3 text-left',
        'transition-all duration-150 cursor-pointer group',
        isSelected
          ? 'bg-surface-container/80 rounded-r-xl pl-[calc(0.75rem+3px)] pr-3'
          : 'border border-transparent hover:bg-surface-container/50 rounded-xl px-3',
      ].join(' ')}
    >
      {/* Left accent bar — visible only when selected */}
      {isSelected && (
        <div className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-primary" />
      )}

      {/* Thumbnail */}
      <div className="w-11 h-11 rounded-lg overflow-hidden flex-shrink-0 bg-surface-container">
        {event.img ? (
          <img
            src={event.img}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
            onError={(e) => {
              const fallback = CAT_IMAGES[event.cat] || CAT_IMAGES.other;
              if (e.target.src !== fallback) e.target.src = fallback;
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="material-symbols-outlined text-on-surface-variant/40" style={{ fontSize: 18 }}>
              {catIcon}
            </span>
          </div>
        )}
      </div>

      {/* Title + meta */}
      <div className="flex-1 min-w-0">
        <p className={[
          'text-sm font-semibold leading-snug truncate transition-colors',
          isSelected ? 'text-on-surface' : 'text-on-surface/90 group-hover:text-on-surface',
        ].join(' ')}>
          {event.title}
        </p>
        <p className="text-xs text-on-surface-variant/70 truncate mt-0.5">
          {[event.date, event.venue].filter(Boolean).join(' · ')}
        </p>
      </div>

      {/* Price + going + arrow indicator */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <div className="flex flex-col items-end gap-0.5">
          <span className="text-xs font-bold text-primary">{event.price}</span>
          {isGoing ? (
            <span className="text-[10px] font-semibold text-primary flex items-center gap-0.5">
              <span className="material-symbols-outlined" style={{ fontSize: 11, fontVariationSettings: "'FILL' 1" }}>check_circle</span>
              Going
            </span>
          ) : attendeeCount > 0 ? (
            <span className="text-[10px] text-primary/70 font-semibold">{attendeeCount} going</span>
          ) : (
            <span className="text-[10px] text-on-surface-variant/50">No RSVPs yet</span>
          )}
        </div>
        {/* Right-pointing arrow — signals this row drives the panel */}
        <span
          className={[
            'material-symbols-outlined transition-all duration-150',
            isSelected ? 'text-primary' : 'text-outline-variant/30 group-hover:text-outline-variant/60',
          ].join(' ')}
          style={{ fontSize: 16 }}
        >
          chevron_right
        </span>
      </div>
    </button>
  );
}

// ─── Event Spotlight ──────────────────────────────────────────────────────────
// Right-panel detail view shown on desktop

function EventSpotlight({ event, isGoing, onRsvp, attendeeCount, countsLoading, currentUserId }) {
  const navigate = useNavigate();
  const requireVerified = useVerificationGate();
  const isOwnEvent = !!(currentUserId && event.creator_id && event.creator_id === currentUserId);

  function handleRsvp() {
    if (isGoing) navigate('/my-events');
    else if (onRsvp) onRsvp(event);
  }

  const openDetail = () => requireVerified(() => navigate(`/event/${event.id}`));

  return (
    <div
      key={event.id}
      className="rounded-2xl overflow-hidden bg-surface-container-low border border-outline-variant/15 border-l-primary/30 shadow-[inset_2px_0_0_0_rgba(255,177,199,0.25)]"
      style={{ animation: 'fadeIn 0.18s ease-out' }}
    >
      {/* Image */}
      <div className="relative aspect-[4/3] overflow-hidden">
        <img
          src={event.img}
          alt={event.title}
          className="w-full h-full object-cover"
          onError={(e) => {
            const fallback = CAT_IMAGES[event.cat] || CAT_IMAGES.other;
            if (e.target.src !== fallback) e.target.src = fallback;
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background/55 via-transparent to-transparent pointer-events-none" />

        {/* Top badges */}
        <div className="absolute top-3 left-3 flex items-center gap-2 flex-wrap">
          <Tag variant="surface">{event.tag}</Tag>
          {event.women_only && (
            <Tag variant="solid" className="bg-primary/90 text-on-primary text-[10px]">♀ Only</Tag>
          )}
        </div>
        {isGoing && (
          <div className="absolute top-3 right-3">
            <Tag variant="solid" className="flex items-center gap-0.5">
              <span className="material-symbols-outlined" style={{ fontSize: 10, fontVariationSettings: "'FILL' 1" }}>check</span>
              Going
            </Tag>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="p-5">
        <h3 className="font-headline text-xl xl:text-2xl font-bold text-on-surface leading-snug mb-4">
          {event.title}
        </h3>

        <div className="space-y-2.5 mb-5">
          <div className="flex items-center gap-2 text-sm text-on-surface-variant/80">
            <span className="material-symbols-outlined text-primary/60 flex-shrink-0" style={{ fontSize: 15 }}>schedule</span>
            {event.date}
          </div>
          <div className="flex items-center gap-2 text-sm text-on-surface-variant/80">
            <span className="material-symbols-outlined text-primary/60 flex-shrink-0" style={{ fontSize: 15 }}>location_on</span>
            {[event.venue, event.city].filter(Boolean).join(', ')}
          </div>
          {!countsLoading && attendeeCount > 0 && (
            <div className="flex items-center gap-2 text-sm text-primary font-semibold">
              <span className="material-symbols-outlined text-primary flex-shrink-0" style={{ fontSize: 15 }}>group</span>
              {attendeeCount} people going
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-outline-variant/10">
          <span className="font-headline text-2xl font-bold text-primary">{event.price}</span>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={openDetail}>
              Details
            </Button>
            {!isOwnEvent && (
              <Button variant="primary" size="sm" onClick={handleRsvp}>
                {isGoing ? (
                  <><span className="material-symbols-outlined" style={{ fontSize: 13, fontVariationSettings: "'FILL' 1" }}>check</span>{' '}Going</>
                ) : 'Reserve'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Section Transition ───────────────────────────────────────────────────────

function SectionTransition() {
  return (
    <div className="relative h-14 -mx-6 md:-mx-12 mb-2 overflow-hidden pointer-events-none">
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-px bg-outline-variant/10" />
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[280px] h-[56px] bg-primary/5 blur-[28px] rounded-full" />
    </div>
  );
}

// ─── Ranking ──────────────────────────────────────────────────────────────────
// decayFactor, diversify, scoreEvent are imported from src/utils/scoring.js

// ─── Main Page ────────────────────────────────────────────────────────────────

// Columns, not *. select('*') shipped search_vector, the full-text tsvector, on
// every Discover load. Nothing here reads it, it is the largest column in the
// row, and it grows with the description. Keep in sync with the app's Discover.
const EVENT_COLUMNS =
  'access, capacity, category, city, created_at, creator_id, date, description,'
  + ' end_time, extras, id, image_url, is_curated, price, price_paise, starts_at,'
  + ' tag, tags, title, venue, women_only';

// Nothing bounded this query. Upcoming-only makes 200 generous, but it is a
// ceiling: past it the newest-created 200 win, which is arbitrary rather than
// nearest-first. A server-side city filter is not the obvious next step either,
// because sameCity() resolves aliases and geocoded suffixes, so an eq/in on the
// column would silently hide "Noida" from a Delhi member and "Hyderabad,
// Telangana" from everyone.
const EVENT_FETCH_LIMIT = 200;

export default function Discover() {
  const [activeCat, setActiveCat]           = useState('all');
  const [activeMood, setActiveMood]         = useState('all');
  const [attendeeProfiles, setAttendeeProfiles] = useState({});
  const [userEvents, setUserEvents]         = useState([]);
  const [attendeeCounts, setAttendeeCounts] = useState({});
  const [eventsLoading, setEventsLoading]   = useState(true);
  const [countsLoading, setCountsLoading]   = useState(true);
  const [selectedEvent, setSelectedEvent]   = useState(null);
  const [pastRsvpCats, setPastRsvpCats]     = useState(new Map());
  const [pastRsvpVenues, setPastRsvpVenues] = useState(new Map());
  const [userViewCats, setUserViewCats]     = useState(new Map());
  const [heroIdx, setHeroIdx]               = useState(0);
  const heroTimerRef = useRef(null);
  const allEventsRef   = useRef(null);
  const sessionViewed  = useRef(new Set()); // dedup clicks within a page session

  const navigate  = useNavigate();
  const { user, profile, profileLoading } = useAuth();
  const showToast = useToast();
  const { isGoing, toggleRsvp, rsvpIds } = useRsvp();
  const requireVerified = useVerificationGate();

  // ── Fetch events ────────────────────────────────────────────────────────────
  useEffect(() => {
    async function fetchUserEvents() {
      const now = new Date().toISOString();
      const { data } = await supabase
        .from('events')
        .select(EVENT_COLUMNS)
        // Past events used to be fetched and then dropped here in JS. Filtering
        // server-side means they never cross the network. Events with no start
        // time are kept, exactly as the client-side filter kept them.
        .or(`starts_at.is.null,starts_at.gte.${now}`)
        .order('created_at', { ascending: false })
        .limit(EVENT_FETCH_LIMIT);
      const mapped = (data || [])
        .map((ev) => ({
          id: ev.id, title: ev.title, cat: ev.category, venue: ev.venue,
          city: ev.city || '', date: ev.date, price: ev.price,
          tag: ev.tag || ev.category, img: ev.image_url, isUserCreated: true,
          creator_id: ev.creator_id || null,
          women_only: ev.women_only || false,
          tags: ev.tags || [],
          // Needed downstream: date filters read starts_at, cards read
          // capacity, and handleRsvp must know whether the event is paid or
          // approval-gated so it can route to the detail page instead of
          // granting a free seat.
          starts_at: ev.starts_at || null,
          capacity: ev.capacity ?? null,
          price_paise: ev.price_paise ?? 0,
          access: ev.access || 'open',
        }));
      setUserEvents(mapped);
      setEventsLoading(false);
    }
    fetchUserEvents();
  }, []);

  // ── Merge curated + user events ─────────────────────────────────────────────
  const allEvents = useMemo(() => {
    const now = new Date().toISOString();
    const curatedIds = new Set(EVENTS_DB.map((e) => String(e.id)));
    const base = EVENTS_DB
      .filter((e) => !e.starts_at || e.starts_at > now)
      .map((e) => ({ ...e, city: LAUNCH_CITY, isUserCreated: false }));
    const extras = userEvents.filter((ue) => !curatedIds.has(String(ue.id)));
    // Scope everything downstream (hero, sections, browse) to the user's city.
    // Curated seed events have no city, so they're treated as the launch city.
    return [...base, ...extras].filter((e) => sameCity(e.city, profile?.city));
  }, [userEvents, profile?.city]);

  const eventIdsKey = useMemo(
    () => allEvents.map((e) => String(e.id)).join(','),
    [allEvents],
  );

  useEffect(() => {
    if (!allEvents.length) return;
    const ids = allEvents.map((e) => String(e.id));

    function refreshCounts() {
      Promise.all([
        fetchRsvpCounts(ids),
        fetchAttendeeAvatars(ids),
      ]).then(([counts, profiles]) => {
        setAttendeeCounts(counts);
        setAttendeeProfiles(profiles);
        setCountsLoading(false);
      });
    }

    setCountsLoading(true);
    refreshCounts();
    const intv = setInterval(refreshCounts, 20_000);
    return () => clearInterval(intv);
  }, [eventIdsKey]);

  // ── Fetch attendance history (with time decay) ──────────────────────────────
  useEffect(() => {
    if (!user?.id) return;
    const now = Date.now();
    supabase
      .from('rsvps')
      .select('event_id, created_at, events(category, venue)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100)
      .then(({ data }) => {
        const cats   = new Map();
        const venues = new Map();
        (data || []).forEach((r) => {
          const daysAgo = (now - new Date(r.created_at).getTime()) / 86_400_000;
          const decay   = decayFactor(daysAgo);
          if (r.events?.category) {
            cats.set(r.events.category, Math.max(cats.get(r.events.category) ?? 0, decay));
          }
          if (r.events?.venue) {
            venues.set(r.events.venue, Math.max(venues.get(r.events.venue) ?? 0, decay));
          }
        });
        setPastRsvpCats(cats);
        setPastRsvpVenues(venues);
      });
  }, [user?.id]);

  // ── Fetch implicit click history (with time decay) ───────────────────────────
  useEffect(() => {
    if (!user?.id) return;
    const now = Date.now();
    supabase
      .from('event_views')
      // event_views has no category column; it comes from the viewed event.
      .select('event_id, viewed_at, events(category)')
      .eq('user_id', user.id)
      .order('viewed_at', { ascending: false })
      .limit(200)
      .then(({ data }) => {
        if (!data) return;
        const cats = new Map();
        data.forEach((r) => {
          const category = r.events?.category;
          if (!category) return;
          const daysAgo = (now - new Date(r.viewed_at).getTime()) / 86_400_000;
          const decay   = decayFactor(daysAgo);
          cats.set(category, Math.max(cats.get(category) ?? 0, decay));
        });
        setUserViewCats(cats);
      });
  }, [user?.id]);

  // ── Filtered events ──────────────────────────────────────────────────────────
  // allEvents is already scoped to the user's city, so no city arg here.
  const filtered = useMemo(
    () => applyMoodFilter(allEvents, activeMood, activeCat, 'all'),
    [allEvents, activeMood, activeCat]
  );

  // ── Ranked events ─────────────────────────────────────────────────────────
  const ranked = useMemo(() => {
    if (!user) return filtered;

    // Categories of events the user is currently going to (past interactions)
    const currentCats = new Set(
      allEvents.filter((e) => rsvpIds.has(String(e.id))).map((e) => e.cat),
    );

    // Hobbies mapped to event categories (broad signal)
    const hobbyCats = new Set(
      (profile?.hobbies || []).map((h) => HOBBY_TO_CAT[h.toLowerCase()]).filter(Boolean),
    );

    // Exact hobby names for direct tag matching (precise signal)
    const hobbyNames = new Set((profile?.hobbies || []).map((h) => h.toLowerCase()));

    const hasSignals =
      currentCats.size > 0 || pastRsvpCats.size > 0 ||
      hobbyCats.size > 0   || userViewCats.size > 0  || hobbyNames.size > 0;
    if (!hasSignals) return filtered;

    const ctx = {
      currentCats,
      pastCats:     pastRsvpCats,
      pastVenues:   pastRsvpVenues,
      hobbyCats,
      hobbyNames,
      attendeeCounts,
      userViewCats,
    };

    const sorted = [...filtered].sort((a, b) => scoreEvent(b, ctx) - scoreEvent(a, ctx));

    // Diversity pass: no more than 2 consecutive same-category events
    return diversify(sorted, 2);
  }, [filtered, rsvpIds, pastRsvpCats, pastRsvpVenues, userViewCats, profile?.hobbies, attendeeCounts, allEvents, user]);

  const rankingActive = user && (pastRsvpCats.size > 0 || rsvpIds.size >= 2);

  // Sync spotlight with filter changes
  useEffect(() => {
    setSelectedEvent(ranked[0] ?? null);
  }, [activeCat, activeMood]);

  // Set initial spotlight once events load
  useEffect(() => {
    if (!eventsLoading && !selectedEvent && ranked.length > 0) {
      setSelectedEvent(ranked[0]);
    }
  }, [eventsLoading]);

  // ── Shelf data ───────────────────────────────────────────────────────────────
  const personalisedEvents = useMemo(() => {
    if (!profile?.hobbies?.length || rsvpIds.size < 2) return { events: [], reason: null };

    const hobbySet = new Set(profile.hobbies.map((h) => h.toLowerCase()));

    // Build cat → first matching hobby (broad fallback)
    const catToHobby = {};
    for (const h of profile.hobbies) {
      const cat = HOBBY_TO_CAT[h.toLowerCase()];
      if (cat && !catToHobby[cat]) catToHobby[cat] = h;
    }
    const relevantCats = new Set(Object.keys(catToHobby));

    // Scoring context (mirrors ranked useMemo — shelf shows the same best picks)
    const currentCats = new Set(
      allEvents.filter((e) => rsvpIds.has(String(e.id))).map((e) => e.cat),
    );
    const hobbyCats = new Set(
      profile.hobbies.map((h) => HOBBY_TO_CAT[h.toLowerCase()]).filter(Boolean),
    );
    const hobbyNames = hobbySet;
    const ctx = { currentCats, pastCats: pastRsvpCats, pastVenues: pastRsvpVenues, hobbyCats, hobbyNames, attendeeCounts, userViewCats };

    // Filter by tag (precise) or category (broad), then sort by score so shelf
    // shows the same top picks the ranked feed surfaces
    const events = allEvents
      .filter((e) => {
        if (relevantCats.has(e.cat)) return true;
        return (e.tags || []).some((t) => hobbySet.has(t.toLowerCase()));
      })
      .sort((a, b) => scoreEvent(b, ctx) - scoreEvent(a, ctx))
      .slice(0, 10);

    // Prefer a tag-based reason (most specific)
    let reason = null;
    for (const e of events) {
      const match = (e.tags || []).find((t) => hobbySet.has(t.toLowerCase()));
      if (match) {
        reason = profile.hobbies.find((h) => h.toLowerCase() === match.toLowerCase()) || match;
        break;
      }
    }

    // Fall back to category-based reason
    if (!reason) {
      const catCounts = {};
      events.forEach((e) => { catCounts[e.cat] = (catCounts[e.cat] || 0) + 1; });
      const topCat = Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
      reason = topCat && catToHobby[topCat] ? catToHobby[topCat] : null;
    }

    return { events, reason };
  }, [allEvents, profile?.hobbies, rsvpIds, pastRsvpCats, pastRsvpVenues, attendeeCounts, userViewCats]);

  const freeEvents = useMemo(
    () => allEvents.filter((e) => e.price === 'Free' || e.price === '$0').slice(0, 10),
    [allEvents],
  );

  // Build shelf rows — only include shelves with 2+ events
  const shelves = useMemo(() => {
    const rows = [];
    if (user && personalisedEvents.events.length >= 2) {
      rows.push({
        id: 'foryou',
        eyebrow: 'Picked for you',
        title: personalisedEvents.reason
          ? `Because you love ${personalisedEvents.reason}`
          : "Events you'll love",
        subtitle: personalisedEvents.reason
          ? 'Based on your interests'
          : null,
        events: personalisedEvents.events,
      });
    }
    if (freeEvents.length >= 2) {
      rows.push({ id: 'free', eyebrow: 'No cover charge', title: 'Free to attend', events: freeEvents });
    }
    return rows;
  }, [personalisedEvents, freeEvents, user]);

  // ── Trending hero events ─────────────────────────────────────────────────────
  // Pick 4 events with the most RSVPs. If no RSVPs exist yet, shuffle from allEvents.
  const trendingEvents = useMemo(() => {
    if (allEvents.length === 0) return [];

    const HERO_COUNT = 4;
    const totalRsvps = Object.values(attendeeCounts).reduce((s, c) => s + c, 0);

    if (totalRsvps > 0) {
      // Sort by RSVP count descending, take top N
      return [...allEvents]
        .sort((a, b) => (attendeeCounts[String(b.id)] || 0) - (attendeeCounts[String(a.id)] || 0))
        .slice(0, HERO_COUNT);
    }

    // Fallback: deterministic-ish daily shuffle so it feels fresh but stable per session
    const seed = new Date().toDateString();
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) & 0x7fffffff;
    // Event ids are UUID strings, so hash them as strings (h ^ id would
    // coerce to NaN and every key would tie).
    const keyFor = (id) => {
      let k = h;
      for (const ch of String(id)) k = (k * 31 + ch.charCodeAt(0)) & 0x7fffffff;
      return k;
    };
    const shuffled = [...allEvents].sort((a, b) => keyFor(a.id) - keyFor(b.id));
    return shuffled.slice(0, HERO_COUNT);
  }, [allEvents, attendeeCounts]);

  // Auto-rotate hero every 7 seconds
  useEffect(() => {
    if (trendingEvents.length <= 1) return;
    heroTimerRef.current = setInterval(() => {
      setHeroIdx(i => (i + 1) % trendingEvents.length);
    }, 7000);
    return () => clearInterval(heroTimerRef.current);
  }, [trendingEvents.length]);

  // Reset index when trending list changes
  useEffect(() => { setHeroIdx(0); }, [trendingEvents.length]);

  const heroEvent = trendingEvents[heroIdx] || allEvents[0];

  // ── RSVP ────────────────────────────────────────────────────────────────────
  function handleRsvp(event) {
    if (!user) { navigate('/auth'); return; }
    if (event.creator_id && user.id && event.creator_id === user.id) return;
    if (isGoing(event.id)) return;
    // Paid and approval-gated events go through checkout / the request flow
    // on the detail page. Granting them here would skip payment or approval.
    if (isPaidEvent(event) || event.access === 'approval') {
      navigate(`/event/${event.id}`);
      return;
    }
    requireVerified(async () => {
      const result = await toggleRsvp(event);
      if (result === 'event_full') {
        if (event.capacity) setAttendeeCounts((prev) => ({ ...prev, [String(event.id)]: event.capacity }));
        showToast('This event just filled up. Someone took the last spot a moment before you.');
        return;
      }
      if (result === 'failed') {
        showToast('Could not RSVP. Please try again.');
        return;
      }
      setAttendeeCounts((prev) => ({
        ...prev,
        [String(event.id)]: (prev[String(event.id)] || 0) + 1,
      }));
      showToast(`You're going to ${event.title}! Check My Events for details.`);
    });
  }

  // ── Track implicit click signal ─────────────────────────────────────────────
  function trackEventView(event) {
    if (!user?.id) return;
    const key = String(event.id);
    if (sessionViewed.current.has(key)) return;
    sessionViewed.current.add(key);
    // Optimistically update local view state so ranking reacts immediately
    setUserViewCats((prev) => {
      const next = new Map(prev);
      next.set(event.cat, Math.max(next.get(event.cat) ?? 0, 1.0));
      return next;
    });
    // Fire-and-forget persist
    supabase.from('event_views')
      .insert({ user_id: user.id, event_id: key })
      .then(() => {}).catch(() => {});
  }

  // No city set → prompt to choose one. City set but no events → zero-state.
  // Wait for the profile to load so we don't flash these for returning users.
  if (!profileLoading && !profile?.city) {
    return (
      <div className="page-enter pt-6 md:pt-10">
        <EmptyState
          icon="location_city"
          title="Where are you?"
          body="Set your city to see events happening near you. You can change it anytime in your profile."
          ctaLabel="Choose your city"
          onCta={() => navigate('/profile?edit=city')}
        />
      </div>
    );
  }
  // When there are no events yet (e.g. a fresh city at launch), we still render
  // the page so recommended connections (PeopleLikeYou) stay visible. The events
  // area below swaps to a zero-state instead of early-returning the whole page.
  const noEvents = !eventsLoading && allEvents.length === 0;

  return (
    <div className="page-enter">

      {/* ── Hero — trending carousel ── */}
      {heroEvent && (
        <section className="relative w-full h-[540px] md:h-[580px] overflow-hidden flex items-end pb-14 md:pb-20">

          {/* Background image — crossfade */}
          {trendingEvents.map((ev, i) => (
            <div
              key={ev.id}
              className="absolute inset-0 z-0 transition-opacity duration-700"
              style={{ opacity: i === heroIdx ? 1 : 0 }}
            >
              <img
                alt=""
                className="w-full h-full object-cover"
                src={ev.img}
                onError={(e) => {
                  const fallback = CAT_IMAGES[ev.cat] || CAT_IMAGES.other;
                  if (e.target.src !== fallback) e.target.src = fallback;
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-r from-background/95 via-background/60 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
            </div>
          ))}
          <div className="absolute -left-1/4 top-1/3 w-[600px] h-[600px] bg-primary-container/25 blur-[120px] rounded-full pointer-events-none z-0" />

          {/* Content — keyed for text transition */}
          <div key={heroEvent.id} className="relative z-10 px-8 md:px-20 max-w-3xl w-full animate-[fadeIn_0.4s_ease-out]">
            <div className="flex items-center gap-3 mb-4">
              <span className="inline-flex items-center gap-1.5 bg-primary/15 border border-primary/25 text-primary text-[11px] font-bold uppercase tracking-[0.14em] px-3 py-1.5 rounded-full backdrop-blur-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                {getHeroLabel(heroEvent, attendeeCounts[String(heroEvent.id)] || 0, countsLoading)}
              </span>
              {heroEvent.tag && (
                <span className="text-on-surface-variant/60 text-xs font-label">{heroEvent.tag}</span>
              )}
            </div>

            <h1 className="font-headline text-4xl md:text-[3.25rem] font-bold leading-[1.1] mb-3 text-on-surface">
              {heroEvent.title}
            </h1>

            {EVENTS_DESC[String(heroEvent.id)]?.description && (
              <p className="text-on-surface-variant/75 text-sm md:text-base leading-relaxed mb-5 max-w-xl line-clamp-2">
                {EVENTS_DESC[String(heroEvent.id)].description}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-on-surface-variant/80 mb-6">
              <span className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-primary/70" style={{ fontSize: 15 }}>schedule</span>
                {heroEvent.date}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-primary/70" style={{ fontSize: 15 }}>location_on</span>
                {heroEvent.venue}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-primary/70" style={{ fontSize: 15 }}>confirmation_number</span>
                {heroEvent.price}
              </span>
              {!countsLoading && attendeeCounts[String(heroEvent.id)] > 0 && (
                <span className="flex items-center gap-1.5 text-primary font-semibold">
                  <span className="material-symbols-outlined text-primary" style={{ fontSize: 15 }}>group</span>
                  {attendeeCounts[String(heroEvent.id)]} going
                </span>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              {heroEvent.creator_id && user?.id && heroEvent.creator_id === user.id ? (
                <Button variant="ghost" size="lg" className="w-full sm:w-auto" onClick={() => navigate(`/event/${heroEvent.id}`)}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16, fontVariationSettings: "'FILL' 1" }}>shield_person</span>
                  {" You're Hosting"}
                </Button>
              ) : (
                <Button variant="primary" size="lg" className="w-full sm:w-auto" onClick={() => handleRsvp(heroEvent)}>
                  {isGoing(heroEvent.id) ? (
                    <><span className="material-symbols-outlined" style={{ fontSize: 16, fontVariationSettings: "'FILL' 1" }}>check_circle</span>{" You're Going"}</>
                  ) : 'Reserve Access'}
                </Button>
              )}
              <Button variant="secondary" size="lg" className="w-full sm:w-auto" onClick={() => requireVerified(() => navigate(`/event/${heroEvent.id}`))}>
                View Details
              </Button>
            </div>
          </div>

          {/* Dots indicator */}
          {trendingEvents.length > 1 && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2">
              {trendingEvents.map((ev, i) => (
                <button
                  key={ev.id}
                  onClick={() => {
                    setHeroIdx(i);
                    clearInterval(heroTimerRef.current);
                    heroTimerRef.current = setInterval(() => setHeroIdx(j => (j + 1) % trendingEvents.length), 7000);
                  }}
                  aria-label={`Go to slide ${i + 1}`}
                  className="min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center"
                >
                  <span className={`rounded-full transition-all duration-300 pointer-events-none ${
                    i === heroIdx
                      ? 'w-6 h-1.5 bg-primary'
                      : 'w-1.5 h-1.5 bg-on-surface/25 hover:bg-on-surface/40'
                  }`} />
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── Body ── */}
      <div className={`px-6 md:px-12 max-w-screen-2xl mx-auto ${heroEvent ? 'pt-12' : 'pt-6 md:pt-10'}`}>

        {/* People like you */}
        {user && <PeopleLikeYou />}

        {/* No events yet — show a zero-state in place of shelves/browse, but
            keep the connections section above visible. */}
        {noEvents ? (
          <div className="pb-16 -mt-8">
            <EmptyState
              icon="event_upcoming"
              title={`No events in ${profile.city} yet`}
              body="Afterhours is just getting started here. Be the first to host something, or check back soon as new events go live."
              ctaLabel="Host an event"
              onCta={() => navigate('/create')}
            />
          </div>
        ) : (
        <>

        {/* ── Shelves ── */}
        {shelves.length > 0 && (
          <div className="mb-4">
            {shelves.map((shelf, i) => (
              <section key={shelf.id} className="mb-14">
                <SectionHeader eyebrow={shelf.eyebrow} title={shelf.title} subtitle={shelf.subtitle} />
                <ShelfRow
                  events={shelf.events}
                  isGoing={isGoing}
                  onRsvp={handleRsvp}
                  attendeeCounts={attendeeCounts}
                  countsLoading={countsLoading}
                  attendeeProfiles={attendeeProfiles}
                />
              </section>
            ))}
          </div>
        )}

        {/* Nudge for users who haven't hit the RSVP threshold yet */}
        {user && rsvpIds.size < 2 && (
          <p className="text-xs text-on-surface-variant/70 text-center py-2">
            RSVP to 2 events to unlock your personal feed
          </p>
        )}

        {/* Transition into browse */}
        {shelves.length > 0 && <SectionTransition />}

        {/* ── Browse ── */}
        <div ref={allEventsRef} className="pb-16 pt-4">
          <SectionHeader
            eyebrow="Browse"
            title={user ? 'All Events' : 'Upcoming Events'}
            subtitle={
              eventsLoading
                ? null
                : `${ranked.length} ${ranked.length === 1 ? 'event' : 'events'} happening soon`
            }
            action={rankingActive && (
              <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-primary/70 bg-primary/[0.08] border border-primary/15 px-3 py-1.5 rounded-full">
                <span className="material-symbols-outlined" style={{ fontSize: 13, fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
                Ranked for you
              </span>
            )}
          />

          {/* Filter bar — sticky below header */}
          <div className="sticky top-16 z-40 -mx-6 md:-mx-12 px-6 md:px-12 py-3 mb-5
                          bg-background/90 backdrop-blur-xl border-b border-outline-variant/10">
            <MoodFilter
              activeMood={activeMood}
              activeCat={activeCat}
              onMoodChange={setActiveMood}
              onCatChange={setActiveCat}
            />
          </div>

          {/* Loading */}
          {eventsLoading && <EventListRowSkeleton count={6} />}

          {/* Empty */}
          {!eventsLoading && ranked.length === 0 && (
            <div className="text-center py-20">
              <div className="w-16 h-16 rounded-2xl bg-surface-container mx-auto mb-5 flex items-center justify-center">
                <span className="material-symbols-outlined text-on-surface-variant/40 text-3xl">search_off</span>
              </div>
              <p className="font-headline text-xl font-semibold text-on-surface mb-2">Nothing here yet</p>
              <p className="text-on-surface-variant/60 text-sm mb-6 max-w-xs mx-auto">
                Try a different category or time. New events are added all the time.
              </p>
              <Button variant="secondary" size="sm" onClick={() => { setActiveCat('all'); setActiveMood('all'); }}>
                Reset filters
              </Button>
            </div>
          )}

          {/* Desktop: list + spotlight split */}
          {!eventsLoading && ranked.length > 0 && (
            <>
              {/* ── Desktop layout ── */}
              <div className="hidden lg:flex gap-6 items-start">
                {/* List — scrollable */}
                <div className="flex-1 overflow-y-auto max-h-[640px] hide-scrollbar space-y-0.5 pr-1">
                  {ranked.map((event) => (
                    <EventListRow
                      key={event.id}
                      event={event}
                      isSelected={selectedEvent?.id === event.id}
                      isGoing={isGoing(event.id)}
                      attendeeCount={countsLoading ? 0 : (attendeeCounts[String(event.id)] || 0)}
                      onClick={() => { trackEventView(event); setSelectedEvent(event); }}
                    />
                  ))}
                </div>

                {/* Spotlight — sticky */}
                <div className="w-[380px] xl:w-[420px] flex-shrink-0 sticky top-6">
                  {selectedEvent && (
                    <EventSpotlight
                      event={selectedEvent}
                      isGoing={isGoing(selectedEvent.id)}
                      onRsvp={handleRsvp}
                      attendeeCount={countsLoading ? 0 : (attendeeCounts[String(selectedEvent.id)] || 0)}
                      countsLoading={countsLoading}
                      currentUserId={user?.id}
                    />
                  )}
                </div>
              </div>

              {/* ── Mobile layout — compact list rows ── */}
              <div className="space-y-1 lg:hidden">
                {ranked.map((event) => (
                  <EventListRow
                    key={event.id}
                    event={event}
                    isSelected={false}
                    isGoing={isGoing(event.id)}
                    attendeeCount={countsLoading ? 0 : (attendeeCounts[String(event.id)] || 0)}
                    onClick={() => requireVerified(() => { trackEventView(event); navigate(`/event/${event.id}`); })}
                  />
                ))}
              </div>
            </>
          )}
        </div>
        </>
        )}
      </div>

      <Footer />
    </div>
  );
}
