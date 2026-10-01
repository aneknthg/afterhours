/**
 * useRsvp — unified RSVP state
 *
 * Supabase tables needed:
 *
 * -- rsvps (already exists; ensure status column present)
 * alter table rsvps add column if not exists status text default 'approved';
 * -- status values: 'approved' | 'pending' | 'rejected'
 *
 * create table if not exists rsvps (
 *   id          uuid primary key default gen_random_uuid(),
 *   user_id     uuid references auth.users(id) on delete cascade,
 *   event_id    text not null,
 *   event_title text not null default '',
 *   status      text not null default 'approved',
 *   created_at  timestamptz default now(),
 *   unique(user_id, event_id)
 * );
 * alter table rsvps enable row level security;
 * create policy "Users manage own rsvps" on rsvps
 *   for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from './supabase';
import { useAuth } from './AuthContext';

const LS_KEY = 'afterhours_rsvps_ids';

function lsGet() {
  try { return new Set(JSON.parse(localStorage.getItem(LS_KEY) || '[]')); }
  catch { return new Set(); }
}
function lsSet(set) {
  try { localStorage.setItem(LS_KEY, JSON.stringify([...set])); } catch {}
}

// Fetch total RSVP count for a single event (approved only)
export async function fetchRsvpCount(eventId) {
  const { count } = await supabase
    .from('rsvps')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', String(eventId))
    .eq('status', 'approved');
  return count || 0;
}

// Fetch approved RSVP counts for multiple events at once → returns { [eventId]: count }
export async function fetchRsvpCounts(eventIds) {
  if (!eventIds?.length) return {};
  const { data } = await supabase
    .from('rsvps')
    .select('event_id')
    .in('event_id', eventIds.map(String))
    .eq('status', 'approved');
  const counts = {};
  (data || []).forEach(({ event_id }) => {
    counts[event_id] = (counts[event_id] || 0) + 1;
  });
  return counts;
}

// Fetch slim attendee profiles for an avatar stack → returns { [eventId]: profile[] }
export async function fetchAttendeeAvatars(eventIds, perEvent = 5) {
  if (!eventIds?.length) return {};
  const { data, error } = await supabase
    .from('rsvps')
    .select('event_id, profiles:public_profiles!user_id(id, display_name, avatar_url)')
    .in('event_id', eventIds.map(String))
    .eq('status', 'approved')
    // An unpaid approval is a held seat, not a guest: it still counts toward
    // capacity (fetchRsvpCount) but isn't shown publicly until paid.
    .is('payment_due_at', null)
    .limit(perEvent * eventIds.length);
  if (error) return {};
  const map = {};
  (data || []).forEach(r => {
    if (!r.profiles) return; // orphaned rsvp (deleted user) — left join can yield null
    const k = String(r.event_id);
    map[k] = map[k] || [];
    if (map[k].length < perEvent) map[k].push(r.profiles);
  });
  return map;
}

// rsvps.payment_due_at as "Tue, 30 Sept, 8:00 pm" in the viewer's time zone.
export function formatPaymentDue(iso) {
  return new Date(iso).toLocaleString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

export function useRsvp() {
  const { user } = useAuth();
  // Approved (counted as "going"), pending (awaiting host approval), and
  // dueDates below (approved on a paid event, not paid yet).
  const [rsvpIds, setRsvpIds] = useState(new Set());
  const [pendingIds, setPendingIds] = useState(new Set());
  // Approved on a paid event but not paid yet (rsvps.payment_due_at is set),
  // keyed to that deadline. Kept out of rsvpIds on purpose: rsvpIds is what
  // Chat and My Events read, and an unpaid approval is a held seat, not a place.
  const [dueDates, setDueDates] = useState(new Map());
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  // Stable for the life of this hook instance; see the realtime effect below.
  const instanceId = useRef(Math.random().toString(36).slice(2, 10));
  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);

      if (user?.id) {
        const { data, error } = await supabase
          .from('rsvps')
          .select('event_id, status, payment_due_at')
          .eq('user_id', user.id);

        if (cancelled) return;

        if (error) {
          console.warn('[useRsvp] load error:', error.message);
          setRsvpIds(lsGet());
          setPendingIds(new Set());
          setDueDates(new Map());
        } else {
          const approved = new Set();
          const pending = new Set();
          const due = new Map();
          (data || []).forEach((r) => {
            const id = String(r.event_id);
            if (r.status === 'pending') pending.add(id);
            else if (r.payment_due_at) due.set(id, r.payment_due_at);
            else approved.add(id); // treat approved + any legacy rows as going
          });

          // Migrate guest localStorage RSVPs up to Supabase once
          const local = lsGet();
          const newOnes = [...local].filter((id) => !approved.has(id) && !pending.has(id) && !due.has(id));
          if (newOnes.length) {
            const { error: upsertError } = await supabase.from('rsvps').upsert(
              newOnes.map((event_id) => ({ user_id: user.id, event_id, event_title: '', status: 'approved' })),
              { onConflict: 'user_id,event_id', ignoreDuplicates: true }
            );
            if (cancelled) return;
            // Only forget the local copy once the server actually has them.
            if (!upsertError) {
              newOnes.forEach((id) => approved.add(id));
              localStorage.removeItem(LS_KEY);
            }
          }

          setRsvpIds(approved);
          setPendingIds(pending);
          setDueDates(due);
        }
      } else {
        setRsvpIds(lsGet());
        setPendingIds(new Set());
        setDueDates(new Map());
      }

      if (!cancelled) setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [user?.id, refreshKey]);

  // Always coerce to string so 'e1' === 'e1' regardless of source
  const isGoing = useCallback(
    (eventId) => rsvpIds.has(String(eventId)),
    [rsvpIds]
  );

  const isPending = useCallback(
    (eventId) => pendingIds.has(String(eventId)),
    [pendingIds]
  );

  // Approved on a paid event, not paid yet.
  const isAwaitingPayment = useCallback(
    (eventId) => dueDates.has(String(eventId)),
    [dueDates]
  );

  // When the held seat is released if she hasn't paid (ISO string), or null.
  const paymentDueAt = useCallback(
    (eventId) => dueDates.get(String(eventId)) ?? null,
    [dueDates]
  );

  /**
   * Toggle RSVP.
   *   - For open events: immediately inserts as 'approved'.
   *   - For approval events: inserts as 'pending' (host must approve).
   *   - Cancelling deletes the row in either case.
   *   - Resolves 'ok', 'event_full' or 'failed'. Show "you're going" on 'ok' only.
   */
  const toggleRsvp = useCallback(async (event) => {
    const eventId    = String(event.id);
    const eventTitle = event.title || '';
    const needsApproval = event.access === 'approval';
    const going      = rsvpIds.has(eventId);
    const pending    = pendingIds.has(eventId);
    const due        = dueDates.get(eventId);
    const hadRow     = going || pending || due !== undefined;

    // Optimistic update
    if (hadRow) {
      // Cancel → remove from every set
      setRsvpIds((prev) => { const s = new Set(prev); s.delete(eventId); return s; });
      setPendingIds((prev) => { const s = new Set(prev); s.delete(eventId); return s; });
      setDueDates((prev) => { const m = new Map(prev); m.delete(eventId); return m; });
    } else if (needsApproval) {
      setPendingIds((prev) => new Set([...prev, eventId]));
    } else {
      setRsvpIds((prev) => new Set([...prev, eventId]));
    }

    if (user?.id) {
      if (hadRow) {
        const { error } = await supabase.from('rsvps').delete()
          .eq('user_id', user.id).eq('event_id', eventId);
        if (error) {
          console.error('[useRsvp] delete error:', error.message);
          // Roll back
          if (going) setRsvpIds((prev) => new Set([...prev, eventId]));
          if (pending) setPendingIds((prev) => new Set([...prev, eventId]));
          if (due !== undefined) setDueDates((prev) => new Map(prev).set(eventId, due));
          return 'failed';
        }
      } else {
        const status = needsApproval ? 'pending' : 'approved';
        const { error } = await supabase.from('rsvps').upsert(
          { user_id: user.id, event_id: eventId, event_title: eventTitle, status },
          { onConflict: 'user_id,event_id', ignoreDuplicates: true }
        );
        if (error) {
          console.error('[useRsvp] upsert error:', error.message);
          // Roll back
          if (needsApproval) {
            setPendingIds((prev) => { const s = new Set(prev); s.delete(eventId); return s; });
          } else {
            setRsvpIds((prev) => { const s = new Set(prev); s.delete(eventId); return s; });
          }
          // The capacity trigger (20260928_event_capacity_enforcement.sql)
          // raises 'event_full' when someone took the last spot first, even
          // if this screen still showed room.
          return error.message?.includes('event_full') ? 'event_full' : 'failed';
        }
      }
    } else {
      // Guest (non-auth) users can only do open events locally
      const next = lsGet();
      going ? next.delete(eventId) : next.add(eventId);
      lsSet(next);
    }
    return 'ok';
  }, [rsvpIds, pendingIds, dueDates, user?.id]);

  // Realtime: reflect host approval and external cancellations immediately.
  //
  // The topic carries a per-instance suffix because this hook can legitimately
  // be mounted more than once in a tree — MyEvents holds one and useMyEvents
  // holds another. Supabase keys channels by topic, so two instances sharing
  // `rsvp-status:<uid>` meant the second one called .on() against a channel the
  // first had already subscribed, which throws "cannot add postgres_changes
  // callbacks ... after subscribe()" and took the whole page down.
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`rsvp-status:${user.id}:${instanceId.current}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rsvps', filter: `user_id=eq.${user.id}` },
        (payload) => {
          const eventId = String(payload.new?.event_id);
          const status  = payload.new?.status;
          if (!eventId) return;
          if (status === 'approved' && payload.new?.payment_due_at) {
            setPendingIds((prev) => { const s = new Set(prev); s.delete(eventId); return s; });
            setRsvpIds((prev) => { const s = new Set(prev); s.delete(eventId); return s; });
            setDueDates((prev) => new Map(prev).set(eventId, payload.new.payment_due_at));
          } else if (status === 'approved') {
            setPendingIds((prev) => { const s = new Set(prev); s.delete(eventId); return s; });
            setDueDates((prev) => { const m = new Map(prev); m.delete(eventId); return m; });
            setRsvpIds((prev) => new Set([...prev, eventId]));
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'rsvps', filter: `user_id=eq.${user.id}` },
        (payload) => {
          const eventId = payload.old?.event_id ? String(payload.old.event_id) : null;
          if (!eventId) return;
          setRsvpIds((prev) => { const s = new Set(prev); s.delete(eventId); return s; });
          setPendingIds((prev) => { const s = new Set(prev); s.delete(eventId); return s; });
          setDueDates((prev) => { const m = new Map(prev); m.delete(eventId); return m; });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  return { rsvpIds, pendingIds, isGoing, isPending, isAwaitingPayment, paymentDueAt, toggleRsvp, loading, refresh };
}

