/**
 * trust.service.js — reporting, blocking, verification
 *
 * Place at: src/services/trust.service.js
 */
import { supabase } from '../lib/supabase';

export const trustService = {
  /**
   * Submit a report against a user or event
   */
  async submitReport({ reporterId, reportedUserId, eventId, reason, details }) {
    const { data, error } = await supabase
      .from('reports')
      .insert({
        reporter_id: reporterId,
        reported_user_id: reportedUserId || null,
        event_id: eventId || null,
        reason,
        details: details || '',
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  /**
   * Block a user
   */
  async blockUser(blockerId, blockedId) {
    const { error } = await supabase
      .from('blocks')
      .upsert({ blocker_id: blockerId, blocked_id: blockedId });
    if (error) throw error;
  },

  /**
   * Unblock a user
   */
  async unblockUser(blockerId, blockedId) {
    const { error } = await supabase
      .from('blocks')
      .delete()
      .eq('blocker_id', blockerId)
      .eq('blocked_id', blockedId);
    if (error) throw error;
  },

  /**
   * Get all user IDs this user has blocked
   */
  async fetchBlockedIds(userId) {
    const { data, error } = await supabase
      .from('blocks')
      .select('blocked_id')
      .eq('blocker_id', userId);
    if (error) throw error;
    return new Set((data || []).map(b => b.blocked_id));
  },

  /**
   * Get trust level for a user
   */
  async fetchTrustLevel(userId) {
    const { data, error } = await supabase
      .from('profiles')
      .select('trust_level, phone_verified_at, verified_at, gender')
      .eq('id', userId)
      .single();
    if (error) throw error;
    return data;
  },

  /**
   * Update trust level.
   *
   * SECURITY: The client cannot directly set trust_level — a BEFORE
   * UPDATE trigger on profiles reverts any direct modification. Trust
   * bumps must come from the `upgrade_trust_level` SECURITY DEFINER
   * RPC, which is only granted to service_role. In practice this means
   * you call it from an edge function that has first verified the
   * relevant proof (SMS code, email confirm, ID check, etc.).
   *
   * Do NOT call this from the client directly — it will no-op
   * silently due to the guard trigger. It is kept here for
   * documentation / server code that imports the service module.
   */
  async updateTrustLevel(userId, level, extras = {}) {
    if (typeof window !== 'undefined') {
      console.warn(
        '[trust.service] updateTrustLevel called from the browser — this is a no-op by design. ' +
        'Trust level changes must go through an edge function that calls the upgrade_trust_level RPC with service-role.'
      );
      return;
    }
    const { error } = await supabase.rpc('upgrade_trust_level', {
      p_user_id: userId,
      p_level: level,
      p_phone_verified: !!extras.phone_verified,
    });
    if (error) throw error;
  },

  /**
   * Toggle bookmark for an event
   */
  async toggleBookmark(userId, eventId) {
    // Check if exists
    const { data: existing } = await supabase
      .from('bookmarks')
      .select('user_id')
      .eq('user_id', userId)
      .eq('event_id', eventId)
      .maybeSingle();

    if (existing) {
      await supabase
        .from('bookmarks')
        .delete()
        .eq('user_id', userId)
        .eq('event_id', eventId);
      return false; // unbookmarked
    } else {
      await supabase
        .from('bookmarks')
        .insert({ user_id: userId, event_id: eventId });
      return true; // bookmarked
    }
  },

  /**
   * Get all bookmarked event IDs for a user
   */
  async fetchBookmarkedIds(userId) {
    const { data, error } = await supabase
      .from('bookmarks')
      .select('event_id')
      .eq('user_id', userId);
    if (error) throw error;
    return new Set((data || []).map(b => b.event_id));
  },
};
