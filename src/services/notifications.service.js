/**
 * notifications.service.js
 *
 * Aggregates two streams of notifications for the logged-in user:
 *
 *   1. RSVP requests on events the user is hosting (rsvps.status='pending',
 *      joined through events where creator_id = user.id)
 *   2. Connection requests received (connections.status='pending',
 *      target_id = user.id)
 *
 * The page renders both as a single feed ordered by recency.
 *
 * REQUIRES: rsvps.status column (see supabase-schema.sql)
 *   alter table rsvps add column if not exists status text default 'approved';
 */
import { supabase } from '../lib/supabase';

export const notificationsService = {
  /**
   * Fetch all pending RSVP requests for events the user hosts.
   * Each entry includes the requester's profile and event details.
   */
  async fetchRsvpRequests(hostUserId) {
    // One round trip, not two. This used to fetch the host's approval events to
    // collect their ids, then fetch pending RSVPs .in() those ids. events!inner
    // applies both filters in the same query and returns each event alongside
    // its RSVP. That matters more than it looks: the database is in Sydney and
    // every round trip from India costs roughly half a second, and the header
    // badge calls this on every route change and again every 30 seconds.
    const { data, error } = await supabase
      .from('rsvps')
      .select(
        'id, user_id, event_id, created_at, status,' +
        ' profiles:public_profiles!user_id(id, display_name, trust_level, avatar_url, city),' +
        ' events!inner(id, title, image_url, category, starts_at, capacity, access, creator_id)',
      )
      .eq('status', 'pending')
      .eq('events.creator_id', hostUserId)
      .eq('events.access', 'approval')
      .order('created_at', { ascending: false });
    if (error) throw error;

    // PostgREST returns an embedded row as an object or a single-element array
    // depending on how it reads the relationship; the old code already guarded
    // this for profiles and the same applies to events.
    const norm = (p) => (Array.isArray(p) ? (p[0] ?? null) : p);
    return (data || []).map((r) => {
      const ev = norm(r.events);
      return {
        kind: 'rsvp_request',
        rsvpId: r.id,
        requester: norm(r.profiles),
        // Shaped exactly as the two-query version built it, so the row
        // component sees no difference. creator_id exists only to drive the
        // join filter and is dropped here.
        event: ev
          ? {
              id: ev.id,
              title: ev.title,
              image_url: ev.image_url,
              category: ev.category,
              starts_at: ev.starts_at,
              capacity: ev.capacity,
              access: ev.access,
            }
          : undefined,
        createdAt: r.created_at,
      };
    });
  },

  /**
   * Fetch all pending connection requests received.
   */
  async fetchConnectionRequests(userId) {
    const { data, error } = await supabase
      .from('connections')
      .select('id, requester_id, event_id, created_at, profiles:public_profiles!requester_id(id, display_name, trust_level, avatar_url, bio, city)')
      .eq('target_id', userId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    if (error) throw error;
    const norm = (p) => (Array.isArray(p) ? (p[0] ?? null) : p);
    return (data || []).map((c) => ({
      kind: 'connection_request',
      connectionId: c.id,
      requester: norm(c.profiles),
      eventId: c.event_id,
      createdAt: c.created_at,
    }));
  },

  /**
   * Notifications sent TO the current user (e.g. RSVP approved).
   */
  async fetchUserNotifications(userId) {
    try {
      const { data } = await supabase
        .from('user_notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20);
      const items = (data || []).map((n) => ({
        kind:        n.type,          // 'rsvp_approved' | 'connection_accepted' | 'event_cancelled'
        notifId:     n.id,
        eventId:     n.event_id,
        eventTitle:  n.type === 'connection_accepted' ? null : n.event_title,
        acceptorName: n.type === 'connection_accepted' ? n.event_title : null,
        note:        n.note ?? null,  // host's cancellation note (event_cancelled)
        read:        n.read,
        createdAt:   n.created_at,
      }));

      // rsvp_approved only: where that approval stands now, not when it was
      // sent. On a paid event an approval is a seat held until payment_due_at,
      // so the same notification can mean "pay by", "you're in", or a lapsed
      // hold. rsvpState: 'awaiting_payment' | 'going' | 'none'.
      const approvedEventIds = items
        .filter((i) => i.kind === 'rsvp_approved' && i.eventId)
        .map((i) => String(i.eventId));
      if (approvedEventIds.length) {
        const { data: rows, error } = await supabase
          .from('rsvps')
          .select('event_id, status, payment_due_at')
          .eq('user_id', userId)
          .in('event_id', approvedEventIds);
        if (!error) {
          const byEvent = new Map((rows || []).map((r) => [String(r.event_id), r]));
          items.forEach((i) => {
            if (i.kind !== 'rsvp_approved' || !i.eventId) return;
            const r = byEvent.get(String(i.eventId));
            i.rsvpState = !r || r.status !== 'approved' ? 'none'
              : r.payment_due_at ? 'awaiting_payment' : 'going';
            i.paymentDueAt = r?.payment_due_at ?? null;
          });
        }
      }
      return items;
    } catch {
      return []; // table may not exist yet in older deployments
    }
  },

  /**
   * Mark a user_notification as read.
   */
  async markRead(notifId) {
    await supabase.from('user_notifications').update({ read: true }).eq('id', notifId);
  },

  /**
   * Fetch both streams and merge, sorted by createdAt descending.
   */
  async fetchAll(userId) {
    const [rsvpReqs, connReqs, userNotifs] = await Promise.all([
      this.fetchRsvpRequests(userId),
      this.fetchConnectionRequests(userId),
      this.fetchUserNotifications(userId),
    ]);
    // Drop action requests whose requester profile couldn't be loaded — a
    // deleted account or a profile unreadable under RLS. They can't be
    // rendered or acted on, and would otherwise surface as a phantom
    // "N pending" with an empty list (the row component skips them).
    const actionable = [...rsvpReqs, ...connReqs].filter((i) => i.requester);
    return [...actionable, ...userNotifs].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );
  },

  /**
   * Unread count — used for the header badge.
   *
   * Delegates to fetchAll so the badge can never disagree with what the
   * popover actually shows: orphaned requests (null requester) are already
   * filtered out there, so they won't inflate the count.
   */
  async fetchUnreadCount(userId) {
    try {
      const items = await this.fetchAll(userId);
      return items.filter((i) =>
        i.kind === 'rsvp_request' || i.kind === 'connection_request' || !i.read
      ).length;
    } catch {
      return 0;
    }
  },

  /**
   * Host approves an RSVP request.
   * Also inserts a user_notification so the applicant is informed.
   */
  async approveRsvp(rsvpId) {
    // Fetch RSVP first so we have user_id + event_id for the notification
    const { data: rsvp } = await supabase
      .from('rsvps')
      .select('user_id, event_id')
      .eq('id', rsvpId)
      .maybeSingle();

    const { error } = await supabase
      .from('rsvps')
      .update({ status: 'approved' })
      .eq('id', rsvpId);
    // The capacity trigger refuses approvals past the event's limit.
    if (error?.message?.includes('event_full')) {
      throw new Error('Your event is full. Raise the capacity or remove a guest to approve this request.');
    }
    if (error) throw error;

    // Notify the applicant
    if (rsvp) {
      try {
        const { data: ev } = await supabase
          .from('events')
          .select('title')
          .eq('id', rsvp.event_id)
          .maybeSingle();
        await supabase.from('user_notifications').insert({
          user_id:     rsvp.user_id,
          type:        'rsvp_approved',
          event_id:    rsvp.event_id,
          event_title: ev?.title || '',
          read:        false,
        });
      } catch {} // non-critical — approval still succeeds
    }
  },

  /**
   * Host rejects an RSVP request (deletes the row so the user can try again later).
   */
  async rejectRsvp(rsvpId) {
    const { error } = await supabase.from('rsvps').delete().eq('id', rsvpId);
    if (error) throw error;
  },
};
