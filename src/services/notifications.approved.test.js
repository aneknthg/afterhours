import { describe, it, expect, vi, beforeEach } from 'vitest';

// An rsvp_approved notification on a paid event is not "you're in": the seat is
// held until rsvps.payment_due_at and released if she hasn't paid. So
// fetchUserNotifications reads the viewer's current rsvps row for each approval
// and tags it awaiting_payment / going / none. These pin that mapping.

let tables = {};

function builder(table) {
  const chain = {
    select: () => chain,
    eq: () => chain,
    in: () => Promise.resolve(tables[table]),
    order: () => chain,
    limit: () => Promise.resolve(tables[table]),
  };
  return chain;
}

vi.mock('../lib/supabase', () => ({
  supabase: { from: (t) => builder(t) },
}));

const { notificationsService } = await import('./notifications.service');

const notif = (id, eventId, type = 'rsvp_approved') => ({
  id, type, event_id: eventId, event_title: `Event ${eventId}`, read: false, created_at: '2026-09-28T10:00:00Z',
});

beforeEach(() => {
  tables = {
    user_notifications: {
      data: [notif('n1', 'ev-unpaid'), notif('n2', 'ev-paid'), notif('n3', 'ev-gone'), notif('n4', null, 'connection_accepted')],
      error: null,
    },
    rsvps: {
      data: [
        { event_id: 'ev-unpaid', status: 'approved', payment_due_at: '2026-09-30T14:30:00Z' },
        { event_id: 'ev-paid',   status: 'approved', payment_due_at: null },
      ],
      error: null,
    },
  };
});

describe('fetchUserNotifications approval state', () => {
  it('tags each approval with where it stands now', async () => {
    const items = await notificationsService.fetchUserNotifications('me');
    const byId = Object.fromEntries(items.map((i) => [i.notifId, i]));
    expect(byId.n1.rsvpState).toBe('awaiting_payment');
    expect(byId.n1.paymentDueAt).toBe('2026-09-30T14:30:00Z');
    expect(byId.n2.rsvpState).toBe('going');
    // Lapsed and swept, withdrawn, or removed by the host.
    expect(byId.n3.rsvpState).toBe('none');
    expect(byId.n4.rsvpState).toBeUndefined();
  });

  it('leaves approvals untagged when the rsvps read fails, so the old copy shows', async () => {
    tables.rsvps = { data: null, error: { message: 'boom' } };
    const items = await notificationsService.fetchUserNotifications('me');
    expect(items.find((i) => i.notifId === 'n1').rsvpState).toBeUndefined();
  });
});
