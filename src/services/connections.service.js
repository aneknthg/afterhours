/**
 * connections.service.js — friend/connection system
 *
 * Handles: sending requests, accepting, rejecting,
 * listing connections, fetching "people like you" suggestions.
 *
 * NOTE: The main "people like you" smart query now lives in
 * PeopleLikeYou.jsx (fetchSuggestedPeople), because it also needs
 * to JOIN rsvps to find shared event attendance.
 * The fetchSuggestedPeople here is kept as a lightweight fallback
 * used elsewhere (e.g. PublicProfile sidebar).
 */
import { supabase } from '../lib/supabase';

export const connectionsService = {
  /**
   * Send a connection request
   */
  async sendRequest(requesterId, targetId, eventId = null) {
    const { data, error } = await supabase
      .from('connections')
      .upsert(
        {
          requester_id: requesterId,
          target_id: targetId,
          event_id: eventId ? String(eventId) : null,
          status: 'pending',
        },
        { onConflict: 'requester_id,target_id' },
      )
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  /**
   * Accept a connection request (called by the target)
   */
  async acceptRequest(connectionId) {
    // Fetch the requester before updating so we can notify them.
    // Also pulls target_id so we can scope the update to the intended recipient.
    const { data: conn } = await supabase
      .from('connections')
      .select('requester_id, target_id, profiles:public_profiles!target_id(display_name)')
      .eq('id', connectionId)
      .maybeSingle();

    // Scope to the signed-in user (same as rejectRequest). Using conn?.target_id
    // would send `target_id=eq.undefined` when the pre-read failed.
    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    const { error } = await supabase
      .from('connections')
      .update({ status: 'accepted' })
      .eq('id', connectionId)
      .eq('target_id', uid); // only the intended recipient can accept
    if (error) throw error;

    // Notify the requester that their connection request was accepted
    if (conn?.requester_id) {
      const acceptorName = Array.isArray(conn.profiles)
        ? (conn.profiles[0]?.display_name ?? '')
        : (conn.profiles?.display_name ?? '');
      try {
        await supabase.from('user_notifications').insert({
          user_id:      conn.requester_id,
          type:         'connection_accepted',
          event_title:  acceptorName, // repurpose field to carry acceptor name
          read:         false,
        });
      } catch {} // non-critical
    }
  },

  /**
   * Reject a connection request
   */
  async rejectRequest(connectionId) {
    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    const { error } = await supabase
      .from('connections')
      .update({ status: 'rejected' })
      .eq('id', connectionId)
      .eq('target_id', uid); // only the intended recipient can reject
    if (error) throw error;
  },

  /**
   * Remove an existing connection
   */
  async removeConnection(connectionId) {
    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    const { error } = await supabase
      .from('connections')
      .delete()
      .eq('id', connectionId)
      .or(`requester_id.eq.${uid},target_id.eq.${uid}`); // either party can remove
    if (error) throw error;
  },

  /**
   * Get all accepted connections for a user (both directions)
   */
  async fetchConnections(userId) {
    const { data: sent, error: e1 } = await supabase
      .from('connections')
      .select('id, target_id, event_id, created_at')
      .eq('requester_id', userId)
      .eq('status', 'accepted');
    if (e1) throw e1;

    const { data: received, error: e2 } = await supabase
      .from('connections')
      .select('id, requester_id, event_id, created_at')
      .eq('target_id', userId)
      .eq('status', 'accepted');
    if (e2) throw e2;

    const userIds = [
      ...(sent || []).map((c) => c.target_id),
      ...(received || []).map((c) => c.requester_id),
    ];
    if (userIds.length === 0) return [];

    // Use public_profiles view — profiles table now restricts reads to owner only
    const { data: profiles, error: e3 } = await supabase
      .from('public_profiles')
      .select('id, display_name, trust_level, avatar_url, bio, city, hobbies')
      .in('id', userIds);
    if (e3) throw e3;

    const profileMap = Object.fromEntries((profiles || []).map((p) => [p.id, p]));
    return [
      ...(sent || []).map((c) => ({
        connectionId: c.id,
        user: profileMap[c.target_id] ?? null,
        eventId: c.event_id,
        connectedAt: c.created_at,
      })),
      ...(received || []).map((c) => ({
        connectionId: c.id,
        user: profileMap[c.requester_id] ?? null,
        eventId: c.event_id,
        connectedAt: c.created_at,
      })),
    ];
  },

  /**
   * Get pending connection requests received by this user
   */
  async fetchPendingRequests(userId) {
    const { data, error } = await supabase
      .from('connections')
      .select('id, requester_id, event_id, created_at')
      .eq('target_id', userId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    if (error) throw error;

    const userIds = (data || []).map((c) => c.requester_id);
    if (userIds.length === 0) return [];

    const { data: profiles, error: pe } = await supabase
      .from('public_profiles')
      .select('id, display_name, trust_level, avatar_url, bio, city')
      .in('id', userIds);
    if (pe) throw pe;

    const profileMap = Object.fromEntries((profiles || []).map((p) => [p.id, p]));
    return (data || []).map((c) => ({
      connectionId: c.id,
      user: profileMap[c.requester_id] ?? null,
      eventId: c.event_id,
      requestedAt: c.created_at,
    }));
  },

  /**
   * Get the connection status between two users.
   * Returns: null | { id, status, direction }
   *   direction: 'sent' (current user sent it) or 'received' (current user received it)
   */
  async getConnectionStatus(userId, otherUserId) {
    const { data: sent } = await supabase
      .from('connections')
      .select('id, status')
      .eq('requester_id', userId)
      .eq('target_id', otherUserId)
      .maybeSingle();

    if (sent) return { id: sent.id, status: sent.status, direction: 'sent' };

    const { data: received } = await supabase
      .from('connections')
      .select('id, status')
      .eq('requester_id', otherUserId)
      .eq('target_id', userId)
      .maybeSingle();

    if (received)
      return { id: received.id, status: received.status, direction: 'received' };

    return null;
  },

  /**
   * Get IDs of all users connected to this user (accepted only)
   */
  async fetchConnectedIds(userId) {
    const { data: sent } = await supabase
      .from('connections')
      .select('target_id')
      .eq('requester_id', userId)
      .eq('status', 'accepted');

    const { data: received } = await supabase
      .from('connections')
      .select('requester_id')
      .eq('target_id', userId)
      .eq('status', 'accepted');

    const ids = new Set([
      ...(sent || []).map((c) => c.target_id),
      ...(received || []).map((c) => c.requester_id),
    ]);
    return ids;
  },

  /**
   * Lightweight "people like you" — used in sidebars / public profile page.
   * Requires ≥ 1 hobby overlap. Does NOT check shared events (use
   * PeopleLikeYou.jsx's fetchSuggestedPeople for the full version).
   */
  async fetchSuggestedPeople(userId, userHobbies = [], limit = 6) {
    if (!userHobbies.length) return [];

    // Fetch all exclusion lists in parallel
    const [{ data: sentAll }, { data: receivedAll }, { data: blocks }] = await Promise.all([
      supabase.from('connections').select('target_id').eq('requester_id', userId),
      supabase.from('connections').select('requester_id').eq('target_id', userId),
      supabase.from('blocks').select('blocked_id').eq('blocker_id', userId),
    ]);

    const excludeIds = [
      userId,
      ...(sentAll || []).map((c) => c.target_id),
      ...(receivedAll || []).map((c) => c.requester_id),
      ...(blocks || []).map((b) => b.blocked_id),
    ];

    // Push both the hobby overlap filter and exclusions to the DB.
    // Fetch a small buffer (limit * 4) so client-side overlap-count sorting has
    // enough candidates — far cheaper than pulling 100 rows and filtering in JS.
    // Only verified accounts — unverified profiles are never recommended.
    const { data: candidates, error } = await supabase
      .from('public_profiles')
      .select('id, display_name, trust_level, avatar_url, bio, city, hobbies')
      .eq('verification_status', 'verified')
      .overlaps('hobbies', userHobbies)
      .not('id', 'in', `(${excludeIds.join(',')})`)
      .limit(limit * 4);

    if (error) throw error;

    const userHobbySet = new Set(userHobbies.map((h) => h.toLowerCase()));

    return (candidates || [])
      .map((p) => {
        const overlap = (p.hobbies || []).filter((h) => userHobbySet.has(h.toLowerCase()));
        return { ...p, overlapCount: overlap.length, sharedHobbies: overlap };
      })
      .filter((p) => p.overlapCount >= 1)
      .sort((a, b) => b.overlapCount - a.overlapCount)
      .slice(0, limit);
  },
};
