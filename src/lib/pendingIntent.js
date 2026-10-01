const KEY = 'afterhours_pending_intent';

// A shared link that sends her through signup, onboarding and verification can
// take a few minutes. An hour covers that and is short enough that an intent
// left over from a previous visit never yanks her somewhere she has forgotten.
const TTL_MS = 60 * 60 * 1000;

/**
 * Paths are handed straight to react-router's navigate(), so only in-app
 * absolute paths are allowed. `//evil.example` is the one that matters:
 * navigate() treats a protocol-relative path as an external host, which would
 * turn a shared Afterhours link into an off-site redirect.
 */
function isSafePath(path) {
  return typeof path === 'string'
    && path.startsWith('/')
    && !path.startsWith('//')
    && !path.includes('://');
}

/** Remember where she was heading before we interrupted her to sign up. */
export function setPendingIntent(path) {
  if (!isSafePath(path)) return;
  try {
    localStorage.setItem(KEY, JSON.stringify({ path, at: Date.now() }));
  } catch {
    // Private mode and blocked storage both throw. Losing the destination
    // costs her a redirect, never the signup itself.
  }
}

/**
 * Read WITHOUT clearing. Safe to call from a React render, which takePendingIntent
 * is not: consuming during render breaks under StrictMode's double-invoke, where
 * the first pass takes the value and the second sees nothing. Pair this with
 * clearPendingIntent in an effect.
 */
export function peekPendingIntent() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const { path, at } = JSON.parse(raw);
    if (!isSafePath(path)) return null;
    if (!at || Date.now() - at > TTL_MS) return null;
    return path;
  } catch {
    return null;
  }
}

/**
 * Read once and clear. Returns null when nothing is stored, the entry has
 * expired, or storage is unreadable, so every caller falls back to its own
 * default destination and a null is never an error.
 */
export function takePendingIntent() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    localStorage.removeItem(KEY);
    const { path, at } = JSON.parse(raw);
    if (!isSafePath(path)) return null;
    if (!at || Date.now() - at > TTL_MS) return null;
    return path;
  } catch {
    return null;
  }
}

export function clearPendingIntent() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}
