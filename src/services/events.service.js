/**
 * events.service.js — all Supabase event queries in one place
 *
 * Place at: src/services/events.service.js
 */
import { supabase } from '../lib/supabase';

// Columns safe to expose publicly from profiles.
// Private fields (phone, email, buddy_system, etc.) must never be selected
// here — the `profiles` RLS policy should also be tightened, but defense in
// depth: we keep the client-side select narrow too.
const PUBLIC_PROFILE_COLS =
  'display_name, trust_level, avg_host_rating, events_hosted, events_attended';

export const eventsService = {
  /**
   * Fetch all user-created events (future only)
   */
  async fetchUpcoming() {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('events')
      .select(`*, profiles:public_profiles!creator_id(${PUBLIC_PROFILE_COLS})`)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).filter(ev => !ev.starts_at || ev.starts_at > now);
  },

  /**
   * Fetch a single event by ID with host profile
   */
  async fetchById(id) {
    const { data, error } = await supabase
      .from('events')
      .select(`*, profiles:public_profiles!creator_id(${PUBLIC_PROFILE_COLS})`)
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  /**
   * Fetch events created by a specific user
   */
  async fetchByCreator(userId) {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('creator_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  /**
   * Fetch RSVP counts for multiple event IDs (APPROVED only).
   * Pending approval-gated RSVPs must not inflate the "going" count.
   */
  async fetchRsvpCounts(eventIds) {
    if (!eventIds?.length) return {};
    const { data } = await supabase
      .from('rsvps')
      .select('event_id')
      .eq('status', 'approved')
      .in('event_id', eventIds.map(String));
    const counts = {};
    (data || []).forEach(({ event_id }) => {
      counts[event_id] = (counts[event_id] || 0) + 1;
    });
    return counts;
  },

  /**
   * Fetch single RSVP count (APPROVED only).
   */
  async fetchRsvpCount(eventId) {
    const { count } = await supabase
      .from('rsvps')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', String(eventId))
      .eq('status', 'approved');
    return count || 0;
  },

  /**
   * Fetch attendee profiles for an event (APPROVED and paid-or-free only).
   * Only expose public profile columns — no phone, email, buddy_system, etc.
   * Unpaid approvals (payment_due_at set) hold a seat but aren't shown as
   * guests until they pay; hosts see them in ParticipantsModal instead.
   */
  async fetchAttendees(eventId, limit = 8) {
    const { data, error } = await supabase
      .from('rsvps')
      .select('user_id, profiles:public_profiles!user_id(display_name, trust_level, avatar_url)')
      .eq('event_id', String(eventId))
      .eq('status', 'approved')
      .is('payment_due_at', null)
      .limit(limit);
    if (error) throw error;
    return (data || []).map(r => ({
      id: r.user_id,
      display_name: r.profiles?.display_name || 'Anonymous',
      trust_level: r.profiles?.trust_level || 0,
      avatar_url: r.profiles?.avatar_url || null,
    }));
  },

  /**
   * Cancel (hard-delete) an event the caller hosts. Notifies every attendee
   * with the optional cancellation note. Atomic — handled server-side by the
   * cancel_event RPC (verifies the caller is the host).
   */
  async cancelEvent(eventId, note) {
    const { error } = await supabase.rpc('cancel_event', {
      p_event_id: eventId,
      p_note: note?.trim() || null,
    });
    if (error) throw error;
  },

  /**
   * Create a new event
   */
  async create(eventData) {
    const { data, error } = await supabase
      .from('events')
      .insert(eventData)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  /**
   * Update an event the caller hosts. RLS ("Creators can update their own
   * events") already restricts writes to the creator; this is just the query.
   */
  async update(eventId, eventData) {
    const { data, error } = await supabase
      .from('events')
      .update(eventData)
      .eq('id', eventId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  /**
   * Get recommendations for a user (calls the DB function)
   */
  async fetchRecommendations(userId, limit = 6) {
    try {
      const { data, error } = await supabase
        .rpc('get_event_recommendations', { p_user_id: userId, p_limit: limit });
      if (error) throw error;
      return data || [];
    } catch {
      const { data } = await supabase
        .from('events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
      return data || [];
    }
  },
};
