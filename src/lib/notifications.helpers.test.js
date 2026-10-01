import { describe, it, expect } from 'vitest';
import {
  NOTIFICATIONS_READ_EVENT,
  markUnreadAsRead,
  unreadNotifIds,
} from './notifications.helpers';

// The regression these guard.
//
// Opening the notifications feed fired markRead for every unread row and then
// rendered `data` — the snapshot taken before those writes. The server was
// correct; the screen was not. The row tint stayed on and the header badge
// kept its old count until a manual reload re-fetched. "Open and refresh once,
// only then it counts as read."
//
// markUnreadAsRead is the missing half: the same pass that fires the writes
// now also produces the post-write view.

const notif = (id, read) => ({ kind: 'connection_accepted', notifId: id, read });
const rsvpRequest = { kind: 'rsvp_request', rsvpId: 'r1' };
const connRequest = { kind: 'connection_request', connectionId: 'c1' };

describe('markUnreadAsRead', () => {
  it('flips an unread notification to read', () => {
    const out = markUnreadAsRead([notif('n1', false)]);
    expect(out[0].read).toBe(true);
  });

  it('flips every unread row, not just the first', () => {
    const out = markUnreadAsRead([notif('n1', false), notif('n2', false), notif('n3', false)]);
    expect(out.map((i) => i.read)).toEqual([true, true, true]);
  });

  it('leaves rows that were already read alone', () => {
    const out = markUnreadAsRead([notif('n1', true), notif('n2', false)]);
    expect(out.map((i) => i.read)).toEqual([true, true]);
  });

  it('never touches RSVP or connection requests — they are unread until actioned', () => {
    const out = markUnreadAsRead([rsvpRequest, connRequest, notif('n1', false)]);
    expect(out[0]).toBe(rsvpRequest);
    expect(out[1]).toBe(connRequest);
    expect(out[2].read).toBe(true);
    expect('read' in out[0]).toBe(false);
    expect('read' in out[1]).toBe(false);
  });

  it('does not mutate the input', () => {
    const input = [notif('n1', false)];
    markUnreadAsRead(input);
    expect(input[0].read).toBe(false);
  });

  it('returns the same array identity when nothing is unread, to avoid a pointless re-render', () => {
    const input = [notif('n1', true), rsvpRequest];
    expect(markUnreadAsRead(input)).toBe(input);
  });

  it('survives an empty feed and junk input', () => {
    expect(markUnreadAsRead([])).toEqual([]);
    expect(markUnreadAsRead(null)).toBe(null);
    expect(() => markUnreadAsRead([null, undefined, notif('n1', false)])).not.toThrow();
  });
});

describe('unreadNotifIds', () => {
  it('returns exactly the ids that still need a write', () => {
    expect(unreadNotifIds([notif('n1', false), notif('n2', true), notif('n3', false)]))
      .toEqual(['n1', 'n3']);
  });

  it('excludes requests, which have no notifId', () => {
    expect(unreadNotifIds([rsvpRequest, connRequest, notif('n1', false)])).toEqual(['n1']);
  });

  it('is empty when the feed is fully read, so no write and no event fire', () => {
    expect(unreadNotifIds([notif('n1', true), rsvpRequest])).toEqual([]);
  });

  it('agrees with markUnreadAsRead about what changed', () => {
    const feed = [notif('n1', false), notif('n2', true), rsvpRequest, notif('n3', false)];
    const ids = unreadNotifIds(feed);
    const after = markUnreadAsRead(feed);
    const flipped = feed
      .map((item, i) => (item.notifId && item.read !== after[i].read ? item.notifId : null))
      .filter(Boolean);
    expect(flipped).toEqual(ids);
  });

  it('survives junk input', () => {
    expect(unreadNotifIds(null)).toEqual([]);
    expect(unreadNotifIds([null, undefined])).toEqual([]);
  });
});

describe('NOTIFICATIONS_READ_EVENT', () => {
  it('is a stable namespaced string — Header and the page must agree on it', () => {
    expect(NOTIFICATIONS_READ_EVENT).toBe('afterhours:notifications-read');
  });

  // No DOM in this environment, so this exercises the name against a plain
  // EventTarget. It proves the constant works as an event name and that add /
  // dispatch / remove agree on it, which is the part that can silently drift.
  // It does not prove the Header is wired up; that needs a browser.
  it('round-trips through addEventListener/dispatchEvent and stops after removal', () => {
    const bus = new EventTarget();
    let heard = 0;
    const onRead = () => { heard += 1; };
    bus.addEventListener(NOTIFICATIONS_READ_EVENT, onRead);
    bus.dispatchEvent(new Event(NOTIFICATIONS_READ_EVENT));
    expect(heard).toBe(1);
    bus.removeEventListener(NOTIFICATIONS_READ_EVENT, onRead);
    bus.dispatchEvent(new Event(NOTIFICATIONS_READ_EVENT));
    expect(heard).toBe(1);
  });
});
