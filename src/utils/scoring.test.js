import { describe, it, expect } from 'vitest';
import { decayFactor, diversify, scoreEvent } from './scoring';

// ── decayFactor ───────────────────────────────────────────────────────────────

describe('decayFactor', () => {
  it('returns 1.0 for 0 days ago', () => {
    expect(decayFactor(0)).toBe(1.0);
  });
  it('returns 1.0 for 13 days ago', () => {
    expect(decayFactor(13)).toBe(1.0);
  });
  it('returns 0.8 at the 14-day boundary', () => {
    expect(decayFactor(14)).toBe(0.8);
  });
  it('returns 0.8 for 29 days ago', () => {
    expect(decayFactor(29)).toBe(0.8);
  });
  it('returns 0.5 at the 30-day boundary', () => {
    expect(decayFactor(30)).toBe(0.5);
  });
  it('returns 0.5 for 89 days ago', () => {
    expect(decayFactor(89)).toBe(0.5);
  });
  it('returns 0.3 at the 90-day boundary', () => {
    expect(decayFactor(90)).toBe(0.3);
  });
  it('returns 0.3 for 179 days ago', () => {
    expect(decayFactor(179)).toBe(0.3);
  });
  it('returns 0.1 at the 180-day boundary', () => {
    expect(decayFactor(180)).toBe(0.1);
  });
  it('returns 0.1 for 365 days ago', () => {
    expect(decayFactor(365)).toBe(0.1);
  });
});

// ── diversify ─────────────────────────────────────────────────────────────────

describe('diversify', () => {
  it('returns [] for empty input', () => {
    expect(diversify([])).toEqual([]);
  });

  it('passes through events when all cats are different', () => {
    const events = [
      { id: 1, cat: 'music' },
      { id: 2, cat: 'arts' },
      { id: 3, cat: 'food' },
    ];
    expect(diversify(events)).toEqual(events);
  });

  it('allows up to maxRun=2 consecutive same-cat events', () => {
    const events = [
      { id: 1, cat: 'music' },
      { id: 2, cat: 'music' },
    ];
    expect(diversify(events, 2)).toHaveLength(2);
  });

  it('defers the 3rd consecutive same-cat event to the end', () => {
    const events = [
      { id: 1, cat: 'music' },
      { id: 2, cat: 'music' },
      { id: 3, cat: 'music' },
      { id: 4, cat: 'arts' },
    ];
    const result = diversify(events, 2);
    // e3 (3rd music) should be deferred after arts
    expect(result[0].id).toBe(1);
    expect(result[1].id).toBe(2);
    expect(result[2].id).toBe(4);
    expect(result[3].id).toBe(3);
  });

  it('single-item array passes through unchanged', () => {
    const events = [{ id: 1, cat: 'music' }];
    expect(diversify(events)).toEqual(events);
  });
});

// ── scoreEvent ────────────────────────────────────────────────────────────────

function makeCtx(overrides = {}) {
  return {
    currentCats:   new Set(),
    pastCats:      new Map(),
    pastVenues:    new Map(),
    hobbyCats:     new Set(),
    hobbyNames:    new Set(),
    attendeeCounts: {},
    userViewCats:  new Map(),
    ...overrides,
  };
}

function makeEvent(overrides = {}) {
  return { id: 'ev1', cat: 'music', venue: 'The Attic', tags: [], ...overrides };
}

describe('scoreEvent', () => {
  it('returns 0 when no signals match', () => {
    expect(scoreEvent(makeEvent(), makeCtx())).toBe(0);
  });

  it('Signal 1: +2 when event.cat is in currentCats', () => {
    const ctx = makeCtx({ currentCats: new Set(['music']) });
    expect(scoreEvent(makeEvent({ cat: 'music' }), ctx)).toBe(2);
  });

  it('Signal 2: +3 * decay for pastCats match', () => {
    const ctx = makeCtx({ pastCats: new Map([['music', 0.5]]) });
    expect(scoreEvent(makeEvent({ cat: 'music' }), ctx)).toBe(1.5);
  });

  it('Signal 2: +2 * decay for pastVenues match', () => {
    const ctx = makeCtx({ pastVenues: new Map([['The Attic', 1.0]]) });
    expect(scoreEvent(makeEvent({ venue: 'The Attic' }), ctx)).toBe(2);
  });

  it('Signal 2: no venue score when event has no venue', () => {
    const ctx = makeCtx({ pastVenues: new Map([['The Attic', 1.0]]) });
    expect(scoreEvent(makeEvent({ venue: undefined }), ctx)).toBe(0);
  });

  it('Signal 3: +1.5 * decay for userViewCats match', () => {
    const ctx = makeCtx({ userViewCats: new Map([['music', 1.0]]) });
    expect(scoreEvent(makeEvent({ cat: 'music' }), ctx)).toBe(1.5);
  });

  it('Signal 4a: +2 for hobbyCats match', () => {
    const ctx = makeCtx({ hobbyCats: new Set(['music']) });
    expect(scoreEvent(makeEvent({ cat: 'music' }), ctx)).toBe(2);
  });

  it('Signal 4b: +3 per matching tag', () => {
    const ctx = makeCtx({ hobbyNames: new Set(['jazz']) });
    const event = makeEvent({ tags: ['Jazz', 'Live Music'] });
    expect(scoreEvent(event, ctx)).toBe(3);
  });

  it('Signal 4b: +6 for two matching tags', () => {
    const ctx = makeCtx({ hobbyNames: new Set(['jazz', 'live music']) });
    const event = makeEvent({ tags: ['Jazz', 'Live Music'] });
    expect(scoreEvent(event, ctx)).toBe(6);
  });

  it('Signal 4b: case-insensitive tag matching', () => {
    const ctx = makeCtx({ hobbyNames: new Set(['yoga']) });
    const event = makeEvent({ cat: 'sports', tags: ['YOGA'] });
    expect(scoreEvent(event, ctx)).toBe(3);
  });

  it('Signal 4b: no crash when event.tags is undefined', () => {
    const ctx = makeCtx({ hobbyNames: new Set(['jazz']) });
    const event = makeEvent({ tags: undefined });
    expect(scoreEvent(event, ctx)).toBe(0);
  });

  it('Signal 5: +floor(pop/3) for attendees up to cap of 4', () => {
    const ctx = makeCtx({ attendeeCounts: { ev1: 9 } });
    expect(scoreEvent(makeEvent(), ctx)).toBe(3);
  });

  it('Signal 5: capped at 4 regardless of attendee count', () => {
    const ctx = makeCtx({ attendeeCounts: { ev1: 999 } });
    expect(scoreEvent(makeEvent(), ctx)).toBe(4);
  });

  it('Signal 5: 0 when event has no attendees', () => {
    const ctx = makeCtx({ attendeeCounts: {} });
    expect(scoreEvent(makeEvent(), ctx)).toBe(0);
  });

  it('all signals stack correctly', () => {
    const ctx = makeCtx({
      currentCats:    new Set(['music']),
      pastCats:       new Map([['music', 1.0]]),
      pastVenues:     new Map([['The Attic', 1.0]]),
      hobbyCats:      new Set(['music']),
      hobbyNames:     new Set(['jazz']),
      attendeeCounts: { ev1: 12 },
      userViewCats:   new Map([['music', 1.0]]),
    });
    const event = makeEvent({ tags: ['Jazz'] });
    // 2 + 3 + 2 + 1.5 + 2 + 3 + 4 = 17.5
    expect(scoreEvent(event, ctx)).toBe(17.5);
  });
});
