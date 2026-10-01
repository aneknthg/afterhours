/**
 * useEventDetail.js
 * Place at: src/lib/useEventDetail.js
 *
 * Extracts all data-fetching that was inline in EventDetail.jsx.
 * The page component becomes pure rendering + interaction.
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase';
import { useAuth } from './AuthContext';
import { EVENTS_DB, EVENTS_DESC, CAT_DESCRIPTIONS } from '../data/events';
import { fetchRsvpCount } from './useRsvp';
import { shortMonthYear } from './date';

/**
 * useEventDetail(id)
 *
 * Returns:
 *   event         — normalised event object (or null while loading)
 *   isCurated     — true for events from the local EVENTS_DB
 *   hostName      — display name of the host
 *   hostMeta      — { eventsHosted, memberSince }
 *   descData      — curated event description block (or null)
 *   catDesc       — curated category description (or null)
 *   reviews       — array of review objects
 *   attendeeCount — live RSVP count
 *   loading       — true while first fetch is in flight
 *   error         — error message string or null
 *   refreshCount  — call to re-fetch the RSVP count
 */
export function useEventDetail(id) {
  const { user } = useAuth();
  const [event,         setEvent]         = useState(null);
  const [isCurated,     setIsCurated]     = useState(false);
  const [isPublicView,  setIsPublicView]  = useState(false);
  const [hostName,      setHostName]      = useState('');
  const [hostMeta,      setHostMeta]      = useState({ eventsHosted: 0, memberSince: '' });
  const [descData,      setDescData]      = useState(null);
  const [catDesc,       setCatDesc]       = useState(null);
  const [reviews,       setReviews]       = useState([]);
  const [attendeeCount, setAttendeeCount] = useState(0);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState(null);

  const refreshCount = useCallback(async (eventId) => {
    const count = await fetchRsvpCount(eventId);
    setAttendeeCount(count);
  }, []);

  // ── Load event ────────────────────────────────────────────────────────────
  const loadEvent = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);

    try {
      // Check curated DB first
      const curated = EVENTS_DB.find((e) => String(e.id) === String(id));
      if (curated) {
        setEvent(curated);
        setIsCurated(true);
        setHostName('Afterhours Collective');
        setHostMeta({ eventsHosted: EVENTS_DB.length, memberSince: 'Since 2024' });
        setDescData(EVENTS_DESC[id] || null);
        setCatDesc(CAT_DESCRIPTIONS[curated.cat] || null);
        setLoading(false);
        // Fetch RSVP count non-blocking — Supabase may be unreachable
        fetchRsvpCount(id).then(setAttendeeCount).catch(() => {});
        return;
      }

      // Supabase event.
      //
      // A signed-out visitor is almost always someone who followed a shared
      // link, so she reads public_events: same rows, but no venue or extras,
      // so the address of a women-only gathering never reaches a stranger. PostgREST cannot infer a foreign key through a view, so the
      // public branch resolves the host in a second query.
      const isPublic = !user;

      const { data, error: dbError } = isPublic
        ? await supabase.from('public_events').select('*').eq('id', id).single()
        : await supabase
            .from('events')
            .select('*, profiles:public_profiles!creator_id(display_name, created_at)')
            .eq('id', id)
            .single();

      if (dbError || !data) {
        setError('Event not found.');
        setLoading(false);
        return;
      }

      setEvent({
        id:          data.id,
        title:       data.title,
        cat:         data.category,
        venue:       data.venue,
        city:        data.city || '',
        date:        data.date,
        price:       data.price,
        // Machine-readable counterpart to the `price` display string. Checkout
        // reads this; nothing charges money off the free-text column.
        price_paise: data.price_paise ?? 0,
        tag:         data.tag || data.category,
        img:         data.image_url,
        description: data.description || '',
        extras:      data.extras || '',
        capacity:    data.capacity,
        access:      data.access || 'open',
        end_time:    data.end_time || '',
        starts_at:   data.starts_at || null,
        creator_id:  data.creator_id || null,
        women_only:  data.women_only || false,
      });
      setIsCurated(false);
      setIsPublicView(isPublic);
      setDescData(null);
      setCatDesc(null);

      let hostProfile = data.profiles || null;
      if (isPublic && data.creator_id) {
        const { data: hp } = await supabase
          .from('public_profiles')
          .select('display_name, created_at')
          .eq('id', data.creator_id)
          .maybeSingle();
        hostProfile = hp;
      }

      // Publicly she is a first name. A full name next to a time and a city is
      // more than a stranger needs; the rest is part of what signing up buys.
      const fullHostName = hostProfile?.display_name || 'Unknown Host';
      setHostName(isPublic ? fullHostName.trim().split(/\s+/)[0] : fullHostName);

      // Host metadata — events hosted count
      if (data.creator_id) {
        const { count: hostedCount } = await supabase
          .from(isPublic ? 'public_events' : 'events')
          .select('*', { count: 'exact', head: true })
          .eq('creator_id', data.creator_id);

        setHostMeta({
          eventsHosted: hostedCount || 0,
          memberSince: hostProfile?.created_at
            ? `Member since ${shortMonthYear(hostProfile.created_at)}`
            : '',
        });
      }

      refreshCount(data.id);
    } catch (err) {
      console.error('[useEventDetail] loadEvent:', err);
      setError(err.message || 'Failed to load event.');
    } finally {
      setLoading(false);
    }
  }, [id, refreshCount, user]);

  // ── Load reviews ─────────────────────────────────────────────────────────
  const loadReviews = useCallback(async () => {
    if (!id) return;
    try {
      const { data } = await supabase
        .from('reviews')
        .select('*, profiles:public_profiles!user_id(display_name, trust_level)')
        .eq('event_id', id)
        .order('created_at', { ascending: false });

      setReviews(
        (data || []).map((r) => ({
          ...r,
          // Never expose the real name for anonymous reviews — not even in JS state.
          // The host gets trust_level for context; the public sees nothing identifying.
          display_name: r.anonymous ? null : (r.profiles?.display_name || 'Unknown'),
          trust_level:  r.profiles?.trust_level ?? 0,
          anonymous:    r.anonymous ?? false,
        })),
      );
    } catch (err) {
      console.error('[useEventDetail] loadReviews:', err);
    }
  }, [id]);

  useEffect(() => {
    loadEvent();
    loadReviews();
  }, [loadEvent, loadReviews]);

  return {
    event,
    isCurated,
    isPublicView,
    hostName,
    hostMeta,
    descData,
    catDesc,
    reviews,
    attendeeCount,
    setAttendeeCount,
    loading,
    error,
    refreshCount,
  };
}
