import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setPendingIntent, takePendingIntent, peekPendingIntent, clearPendingIntent } from './pendingIntent';

// What this guards.
//
// A host shares an event link. Someone opens it, signs up, onboards and
// verifies, and every one of those steps used to end in a hard-coded
// navigate('/') or navigate('/discover') — so she landed in Discover with no
// idea which event she had been invited to. This module carries the
// destination across those hops.
//
// The open-redirect cases matter because the stored value goes straight into
// react-router's navigate(), which reads '//host' as an external origin.
//
// The suite runs in vitest's default node environment (no jsdom in this repo),
// so localStorage is stubbed here rather than pulling in a DOM just for this.

function makeStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: (k) => { map.delete(k); },
    clear: () => { map.clear(); },
  };
}

beforeEach(() => {
  vi.stubGlobal('localStorage', makeStorage());
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('pendingIntent', () => {
  it('returns the path that was stored', () => {
    setPendingIntent('/event/abc-123');
    expect(takePendingIntent()).toBe('/event/abc-123');
  });

  it('clears after a single read, so a later signup is not hijacked', () => {
    setPendingIntent('/event/abc-123');
    takePendingIntent();
    expect(takePendingIntent()).toBeNull();
  });

  it('returns null when nothing was stored', () => {
    expect(takePendingIntent()).toBeNull();
  });

  it('expires an intent older than an hour', () => {
    vi.useFakeTimers();
    setPendingIntent('/event/abc-123');
    vi.advanceTimersByTime(60 * 60 * 1000 + 1);
    expect(takePendingIntent()).toBeNull();
  });

  it('keeps an intent just inside the hour', () => {
    vi.useFakeTimers();
    setPendingIntent('/event/abc-123');
    vi.advanceTimersByTime(60 * 60 * 1000 - 1000);
    expect(takePendingIntent()).toBe('/event/abc-123');
  });

  it.each([
    ['protocol-relative', '//evil.example/event/1'],
    ['absolute https', 'https://evil.example/event/1'],
    ['scheme injection', 'javascript://evil'],
    ['relative', 'event/1'],
    ['empty', ''],
  ])('refuses to store an unsafe path (%s)', (_label, path) => {
    setPendingIntent(path);
    expect(takePendingIntent()).toBeNull();
  });

  it('survives storage throwing, as it does in private mode', () => {
    vi.stubGlobal('localStorage', {
      ...makeStorage(),
      setItem: () => { throw new Error('QuotaExceededError'); },
    });
    expect(() => setPendingIntent('/event/abc-123')).not.toThrow();
    expect(takePendingIntent()).toBeNull();
  });

  it('returns null rather than throwing on unparseable stored data', () => {
    localStorage.setItem('afterhours_pending_intent', 'not json');
    expect(takePendingIntent()).toBeNull();
  });

  // Regression: QA-001 — signing in from a shared link landed on /discover
  // Found by /qa on 2026-09-09
  // Report: .gstack/qa-reports/qa-report-localhost-2026-09-09.md
  //
  // RootRedirect consumed the destination during render. main.jsx wraps the app
  // in React.StrictMode, which double-invokes render, so the first pass took the
  // value and the second saw nothing and fell through to /discover. peek is the
  // pure read that render is allowed to use.
  describe('peekPendingIntent (render-safe read)', () => {
    it('returns the path without consuming it, twice in a row', () => {
      setPendingIntent('/event/abc-123');
      expect(peekPendingIntent()).toBe('/event/abc-123');
      expect(peekPendingIntent()).toBe('/event/abc-123');
      expect(takePendingIntent()).toBe('/event/abc-123');
    });

    it('returns null once the value has been taken', () => {
      setPendingIntent('/event/abc-123');
      takePendingIntent();
      expect(peekPendingIntent()).toBeNull();
    });

    it('honours the same expiry as take', () => {
      vi.useFakeTimers();
      setPendingIntent('/event/abc-123');
      vi.advanceTimersByTime(60 * 60 * 1000 + 1);
      expect(peekPendingIntent()).toBeNull();
    });

    it('refuses an unsafe path the same way take does', () => {
      localStorage.setItem('afterhours_pending_intent', JSON.stringify({ path: '//evil.example', at: Date.now() }));
      expect(peekPendingIntent()).toBeNull();
    });

    it('returns null rather than throwing on unparseable data', () => {
      localStorage.setItem('afterhours_pending_intent', 'not json');
      expect(peekPendingIntent()).toBeNull();
    });
  });

  it('clearPendingIntent removes a stored intent', () => {
    setPendingIntent('/event/abc-123');
    clearPendingIntent();
    expect(takePendingIntent()).toBeNull();
  });
});
