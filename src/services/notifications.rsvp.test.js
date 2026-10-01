import { describe, it, expect, vi, beforeEach } from 'vitest';

// fetchRsvpRequests went from two round trips (fetch the host's approval events
// for their ids, then fetch pending RSVPs .in() those ids) to one query using an
// events!inner join. The database is in Sydney and every trip from India costs
// roughly half a second, and the header badge calls this on every route change
// and again every 30 seconds.
//
// There were no pending RSVPs in production when this was written, and the rsvps
// table is not readable unsigned-in, so the joined shape could not be checked
// against a real row. These tests pin the contract instead: the filters that
// must be sent, and the object the row component must receive.

const captured = { table: null, select: null, eq: [], order: null };
let response = { data: [], error: null };

function builder() {
  const chain = {
    select: (s) => { captured.select = s; return chain; },
    eq: (col, val) => { captured.eq.push([col, val]); return chain; },
    order: (col, opts) => { captured.order = [col, opts]; return Promise.resolve(response); },
  };
  return chain;
}

vi.mock('../lib/supabase', () => ({
  supabase: { from: (t) => { captured.table = t; return builder(); } },
}));

const { notificationsService } = await import('./notifications.service');

const eventRow = {
  id: 'ev-1', title: 'Sunday Walk', image_url: 'https://img/1.jpg',
  category: 'Outdoors', starts_at: '2026-09-20T04:00:00Z', capacity: 12,
  access: 'approval', creator_id: 'host-1',
};
const profileRow = {
  id: 'user-9', display_name: 'Asha', trust_level: 2,
  avatar_url: 'https://img/a.jpg', city: 'Hyderabad',
};
const rsvpRow = {
  id: 'rsvp-1', user_id: 'user-9', event_id: 'ev-1',
  created_at: '2026-09-03T10:00:00Z', status: 'pending',
  profiles: profileRow, events: eventRow,
};

beforeEach(() => {
  captured.table = null; captured.select = null; captured.eq = []; captured.order = null;
  response = { data: [], error: null };
});

describe('fetchRsvpRequests query', () => {
  it('asks rsvps once, not events then rsvps', async () => {
    await notificationsService.fetchRsvpRequests('host-1');
    expect(captured.table).toBe('rsvps');
  });

  it('pushes both event filters into the join instead of a second trip', async () => {
    await notificationsService.fetchRsvpRequests('host-1');
    expect(captured.eq).toEqual([
      ['status', 'pending'],
      ['events.creator_id', 'host-1'],
      ['events.access', 'approval'],
    ]);
  });

  it('uses an inner join, so RSVPs on other hosts events cannot leak in', async () => {
    await notificationsService.fetchRsvpRequests('host-1');
    expect(captured.select).toContain('events!inner');
  });

  it('still selects every field the row component renders', async () => {
    await notificationsService.fetchRsvpRequests('host-1');
    for (const field of ['title', 'image_url', 'category', 'starts_at', 'capacity', 'access']) {
      expect(captured.select).toContain(field);
    }
    expect(captured.select).toContain('public_profiles!user_id');
  });

  it('orders newest first', async () => {
    await notificationsService.fetchRsvpRequests('host-1');
    expect(captured.order).toEqual(['created_at', { ascending: false }]);
  });
});

describe('fetchRsvpRequests mapping', () => {
  it('returns the same shape the two-query version built', async () => {
    response = { data: [rsvpRow], error: null };
    const [item] = await notificationsService.fetchRsvpRequests('host-1');
    expect(item).toEqual({
      kind: 'rsvp_request',
      rsvpId: 'rsvp-1',
      requester: profileRow,
      event: {
        id: 'ev-1', title: 'Sunday Walk', image_url: 'https://img/1.jpg',
        category: 'Outdoors', starts_at: '2026-09-20T04:00:00Z',
        capacity: 12, access: 'approval',
      },
      createdAt: '2026-09-03T10:00:00Z',
    });
  });

  it('drops creator_id, which existed only to drive the join', async () => {
    response = { data: [rsvpRow], error: null };
    const [item] = await notificationsService.fetchRsvpRequests('host-1');
    expect('creator_id' in item.event).toBe(false);
  });

  it('accepts an embedded row arriving as a single-element array', async () => {
    // PostgREST returns an embedding as an object or a one-element array
    // depending on how it reads the relationship. Both must map identically.
    response = { data: [{ ...rsvpRow, events: [eventRow], profiles: [profileRow] }], error: null };
    const [item] = await notificationsService.fetchRsvpRequests('host-1');
    expect(item.event.title).toBe('Sunday Walk');
    expect(item.requester.display_name).toBe('Asha');
  });

  it('survives a null embedding rather than throwing', async () => {
    response = { data: [{ ...rsvpRow, events: null, profiles: null }], error: null };
    const [item] = await notificationsService.fetchRsvpRequests('host-1');
    expect(item.event).toBeUndefined();
    expect(item.requester).toBeNull();
  });

  it('returns an empty list when the host has no pending requests', async () => {
    response = { data: [], error: null };
    expect(await notificationsService.fetchRsvpRequests('host-1')).toEqual([]);
  });

  it('throws on a query error rather than reporting zero requests', async () => {
    response = { data: null, error: { message: 'boom' } };
    await expect(notificationsService.fetchRsvpRequests('host-1')).rejects.toBeTruthy();
  });
});
