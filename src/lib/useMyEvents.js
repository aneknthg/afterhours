/**
 * useMyEvents.js
 * Place at: src/lib/useMyEvents.js
 *
 * Extracts the two raw supabase.from() calls from MyEvents.jsx.
 * The page only needs to call this hook and render the result.
 */
import { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { useRsvp } from './useRsvp';
import { EVENTS_DB } from '../data/events';
import { isPast } from './date';

// events.id is a uuid column; a single non-uuid RSVP id (legacy/curated "e1")
// in `.in('id', ...)` 400s the entire query (22P02). Only query real uuids.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function normalise(ev) {
  return { ...ev, cat: ev.cat || ev.category, img: ev.img || ev.image_url };
}

// "24 Apr · 21:00" → ISO string for the current year, so isPast() can evaluate it
function parseCuratedDate(dateStr) {
  if (!dateStr) return null;
  const clean = dateStr.replace('·', '').replace(/\s+/g, ' ').trim();
  const match = clean.match(/^(\d{1,2})\s+(\w+)\s+(\d{2}:\d{2})$/);
  if (!match) return null;
  const [, day, mon, time] = match;
  const year = new Date().getFullYear();
  const parsed = new Date(`${day} ${mon} ${year} ${time}`);
  return isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

/**
 * useMyEvents(userId)
 *
 * Returns:
 *   upcomingEvents   — attended events that haven't finished yet (sorted asc)
 *   hostingEvents    — hosted events that haven't finished yet (sorted asc)
 *   pastEvents       — all ended events (attended + hosted, deduped, sorted desc)
 *   loading          — true while any fetch is in flight
 */
export function useMyEvents(userId) {
  // Returned to callers as `rsvp` so a page rendering this hook does not mount
  // a second useRsvp of its own — that means two RSVP fetches and two realtime
  // channels for one screen.
  const rsvp = useRsvp();
  const { rsvpIds, loading: rsvpLoading } = rsvp;

  const [retryKey,        setRetryKey]        = useState(0);

  const [hostedUpcoming,  setHostedUpcoming]  = useState([]);
  const [hostedPast,      setHostedPast]      = useState([]);
  const [hostedLoading,   setHostedLoading]   = useState(true);
  const [hostedError,     setHostedError]     = useState(false);

  const [rsvpUserEvents,  setRsvpUserEvents]  = useState([]);
  const [rsvpUserLoading, setRsvpUserLoading] = useState(true);
  const [rsvpError,       setRsvpError]       = useState(false);

  function retry() { setRetryKey((k) => k + 1); }

  // ── Hosted events ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) { setHostedLoading(false); return; }
    setHostedLoading(true);
    setHostedError(false);
    async function load() {
      try {
        const { data } = await supabase
          .from('events')
          .select('*')
          .eq('creator_id', userId)
          .order('starts_at', { ascending: true });

        const all = (data || []).map(normalise);
        // Pass both starts_at and ends_at so isPast uses the true end time
        setHostedUpcoming(all.filter((ev) => !isPast(ev.starts_at, ev.ends_at)));
        setHostedPast(all.filter((ev) => isPast(ev.starts_at, ev.ends_at)).reverse());
      } catch {
        setHostedUpcoming([]);
        setHostedPast([]);
        setHostedError(true);
      }
      setHostedLoading(false);
    }
    load();
  }, [userId, retryKey]);

  // ── RSVP'd user-created events ────────────────────────────────────────────
  useEffect(() => {
    if (rsvpLoading) return;
    setRsvpError(false);
    const curatedIds = new Set(EVENTS_DB.map((e) => String(e.id)));
    const userIds    = [...rsvpIds].filter((id) => !curatedIds.has(id) && UUID_RE.test(id));

    if (!userIds.length) { setRsvpUserLoading(false); return; }

    setRsvpUserLoading(true);
    async function load() {
      try {
        const { data } = await supabase.from('events').select('*').in('id', userIds);
        setRsvpUserEvents((data || []).map(normalise));
      } catch {
        setRsvpUserEvents([]);
        setRsvpError(true);
      }
      setRsvpUserLoading(false);
    }
    load();
  }, [rsvpIds, rsvpLoading, retryKey]);

  // ── Derive tab data ───────────────────────────────────────────────────────
  const rsvpCurated  = EVENTS_DB
    .filter((e) => rsvpIds.has(String(e.id)))
    .map((e) => ({ ...e, starts_at: e.starts_at || parseCuratedDate(e.date) }));
  const allAttending = [
    ...rsvpCurated.map(normalise),
    ...rsvpUserEvents,
  ];

  const upcomingEvents = allAttending
    .filter((e) => !isPast(e.starts_at, e.ends_at))
    .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));

  const attendingPast = allAttending
    .filter((e) => isPast(e.starts_at, e.ends_at))
    .sort((a, b) => new Date(b.starts_at) - new Date(a.starts_at));

  const pastEvents = [...attendingPast, ...hostedPast]
    .filter((ev, idx, arr) => arr.findIndex((x) => String(x.id) === String(ev.id)) === idx)
    .sort((a, b) => new Date(b.starts_at) - new Date(a.starts_at));

  const loading = rsvpLoading || rsvpUserLoading || hostedLoading;
  const error   = !loading && (hostedError || rsvpError);

  return {
    upcomingEvents,
    hostingEvents: hostedUpcoming,
    pastEvents,
    loading,
    error,
    retry,
    rsvp,
  };
}
