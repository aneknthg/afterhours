/**
 * date.js
 * Place at: src/lib/date.js
 *
 * Single source of truth for all date formatting across the app.
 * Replaces the three slightly-different inline implementations in
 * MyEvents.jsx, Profile.jsx, and EventDetail.jsx.
 */

// Whole calendar days from today to `d` (negative = past). Compares day
// boundaries, so 09:00 tomorrow seen at 22:00 tonight is 1 ("Tomorrow"),
// not 0 — elapsed-hours ÷ 24 would floor that to "Today".
function calendarDayDiff(d, now = new Date()) {
  const startOfDay = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate());
  return Math.round((startOfDay(d) - startOfDay(now)) / (1000 * 60 * 60 * 24));
}

/**
 * relativeDate(startsAt, fallback?)
 *
 * Returns a human-friendly label for an event date.
 *
 * Examples:
 *   "Today"
 *   "Tomorrow"
 *   "Yesterday"
 *   "Friday"          ← within the next 7 days
 *   "12 Jun"          ← further out / in the past
 *
 * @param {string|Date|null} startsAt  — ISO string or Date object
 * @param {string}           fallback  — returned when startsAt is falsy
 */
export function relativeDate(startsAt, fallback = '') {
  if (!startsAt) return fallback;
  const d    = new Date(startsAt);
  const diff = calendarDayDiff(d);

  if (diff === 0)  return 'Today';
  if (diff === 1)  return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  if (diff > 1 && diff < 7)
    return d.toLocaleDateString('en-GB', { weekday: 'long' });
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

/**
 * relativeDateLong(startsAt, fallback?)
 *
 * Same as relativeDate but uses full weekday + date for the
 * "within 7 days" bucket. Used by MyEvents bucket headers.
 *
 * Example: "Friday, 14 June"
 */
export function relativeDateLong(startsAt, fallback = '') {
  if (!startsAt) return fallback;
  const d    = new Date(startsAt);
  const diff = calendarDayDiff(d);

  if (diff === 0)  return 'Today';
  if (diff === 1)  return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
}

/**
 * shortDate(startsAt, fallback?)
 *
 * Always returns "12 Jun" style — no relative labels.
 * Used in review timestamps, profile event tiles, etc.
 */
export function shortDate(startsAt, fallback = '') {
  if (!startsAt) return fallback;
  return new Date(startsAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

/**
 * monthYear(dateString, fallback?)
 *
 * Returns "June 2024" style — used in profile "Joined" and host "Member since".
 */
export function monthYear(dateString, fallback = '') {
  if (!dateString) return fallback;
  return new Date(dateString).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

/**
 * shortMonthYear(dateString, fallback?)
 *
 * Returns "Jun 2024" — compact variant for tight spaces.
 */
export function shortMonthYear(dateString, fallback = '') {
  if (!dateString) return fallback;
  return new Date(dateString).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
}

/**
 * formatTime(startsAt, fallback?)
 *
 * Returns "7:30 PM" style. Used in event rows.
 */
export function formatTime(startsAt, fallback = '') {
  if (!startsAt) return fallback;
  return new Date(startsAt).toLocaleTimeString('en-GB', {
    hour:   '2-digit',
    minute: '2-digit',
    hour12: true,
  }).toUpperCase();
}

/**
 * isPast(startsAt, endsAt?)
 *
 * Returns true only when an event has finished — not merely started.
 *
 * Resolution order:
 *   1. If endsAt is provided, use it directly.
 *   2. If only startsAt is provided, assume a 3-hour duration as a fallback.
 *   3. If neither is provided, return false (treat as not yet past).
 *
 * This prevents events from being moved to "past" or triggering the
 * review prompt the moment they start.
 *
 * @param {string|Date|null} startsAt
 * @param {string|Date|null} endsAt
 */
export function isPast(startsAt, endsAt) {
  const now = new Date();

  if (endsAt) {
    return new Date(endsAt) < now;
  }

  if (startsAt) {
    // Default assumption: events last 3 hours
    const fallbackEnd = new Date(new Date(startsAt).getTime() + 3 * 60 * 60 * 1000);
    return fallbackEnd < now;
  }

  return false;
}
