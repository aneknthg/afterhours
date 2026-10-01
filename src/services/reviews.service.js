/**
 * reviews.service.js — review/rating queries
 *
 * Place at: src/services/reviews.service.js
 */
import { supabase } from '../lib/supabase';

export const reviewsService = {
  /**
   * Fetch reviews for an event
   */
  async fetchByEvent(eventId) {
    const { data, error } = await supabase
      .from('reviews')
      .select('*, profiles:public_profiles!user_id(display_name, trust_level)')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(r => ({
      ...r,
      display_name: r.anonymous ? null : (r.profiles?.display_name || 'Unknown'),
      trust_level:  r.profiles?.trust_level ?? 0,
      anonymous:    r.anonymous ?? false,
    }));
  },

  /**
   * Submit a review (with optional safety rating and tags)
   */
  async submit({ eventId, userId, rating, reviewText, safetyRating, tags }) {
    const { error } = await supabase.from('reviews').insert({
      event_id: eventId,
      user_id: userId,
      rating,
      review_text: reviewText?.trim() || '',
      safety_rating: safetyRating || null,
      tags: tags || [],
    });
    if (error) throw error;
  },

  /**
   * Get event IDs that a user has already reviewed
   */
  async fetchReviewedEventIds(userId) {
    const { data, error } = await supabase
      .from('reviews')
      .select('event_id')
      .eq('user_id', userId);
    if (error) throw error;
    return new Set((data || []).map(r => r.event_id));
  },

  /**
   * Find events this user attended (via RSVP) that have fully ended
   * and haven't been reviewed yet.
   *
   * FIX: Previously used starts_at < now, which triggered the review
   * prompt the moment an event started. Now uses ends_at when available,
   * with a 3-hour fallback from starts_at — matching the isPast() logic
   * in date.js so behaviour is consistent across the app.
   */
  async fetchPendingReviews(userId, dismissedIds = []) {
    const now = new Date();

    // 1. Get all events this user RSVP'd to
    const { data: rsvps } = await supabase
      .from('rsvps')
      .select('event_id')
      .eq('user_id', userId);

    if (!rsvps?.length) return null;
    const rsvpEventIds = rsvps.map(r => r.event_id);

    // 2. Fetch the full event rows (including ends_at) for user-created events.
    //    Curated events (short IDs like "e1") don't live in the DB so we skip them.
    const uuidIds = rsvpEventIds.filter(id => id.length > 5);
    let endedEvents = [];

    if (uuidIds.length > 0) {
      const { data: events } = await supabase
        .from('events')
        .select('id, title, image_url, starts_at, ends_at')
        .in('id', uuidIds)
        .neq('creator_id', userId); // hosts should not review their own events

      // Filter in JS so we can apply the same ends_at / fallback logic as isPast()
      endedEvents = (events || []).filter(ev => {
        if (ev.ends_at) {
          // Use the actual end time if the host set one
          return new Date(ev.ends_at) < now;
        }
        if (ev.starts_at) {
          // Fallback: assume events last 3 hours
          const fallbackEnd = new Date(new Date(ev.starts_at).getTime() + 3 * 60 * 60 * 1000);
          return fallbackEnd < now;
        }
        return false;
      });
    }

    if (endedEvents.length === 0) return null;

    // 3. Get already-reviewed event IDs
    const reviewedIds = await this.fetchReviewedEventIds(userId);

    // 4. Return the first unreviewed, undismissed ended event
    const pending = endedEvents.find(
      ev => !reviewedIds.has(ev.id) && !dismissedIds.includes(ev.id)
    );

    return pending || null;
  },
};
