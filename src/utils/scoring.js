/**
 * src/utils/scoring.js — pure recommendation scoring functions
 *
 * Extracted from Discover.jsx so they can be unit-tested independently.
 * Discover.jsx imports from here; no logic lives in both places.
 */

/**
 * Step-function time decay: returns a weight in [0.1, 1.0] based on how
 * many days ago an interaction happened.
 */
export function decayFactor(daysAgo) {
  if (daysAgo < 14)  return 1.0;   // last 2 weeks  — full weight
  if (daysAgo < 30)  return 0.8;   // last month    — 80%
  if (daysAgo < 90)  return 0.5;   // last 3 months — 50%
  if (daysAgo < 180) return 0.3;   // last 6 months — 30%
  return 0.1;                       // older         — 10%
}

/**
 * Post-processing pass: prevent more than `maxRun` consecutive events
 * in the same category. Deferred events are appended at the end in order.
 */
export function diversify(events, maxRun = 2) {
  if (events.length === 0) return events;
  const result   = [];
  const deferred = [];
  const runCount = {};   // cat → current consecutive run

  for (const event of events) {
    const cat = event.cat || '_';
    const run = runCount[cat] || 0;
    if (run < maxRun) {
      result.push(event);
      runCount[cat] = run + 1;
      // Reset every other category's run when we switch
      if (result.length >= 2 && result[result.length - 2]?.cat !== cat) {
        Object.keys(runCount).forEach((k) => { if (k !== cat) runCount[k] = 0; });
      }
    } else {
      deferred.push(event);
    }
  }

  return [...result, ...deferred];
}

/**
 * Score an event for a given user based on five signals:
 *  1. Past interactions  — categories of the user's current RSVPs
 *  2. Attendance history — time-decayed past RSVP categories/venues
 *  3. Implicit clicks    — time-decayed view history by category
 *  4a. Broad hobby match — hobby→cat alignment (HOBBY_TO_CAT)
 *  4b. Direct tag match  — hobby name appears directly in event tags
 *  5. Popularity         — attendee count (capped)
 */
export function scoreEvent(event, { currentCats, pastCats, pastVenues, hobbyCats, hobbyNames, attendeeCounts, userViewCats }) {
  let score = 0;

  // Signal 1 — Past interactions (active RSVPs in the same category)
  if (currentCats.has(event.cat)) score += 2;

  // Signal 2 — Attendance history with time decay (Map → value in [0.1, 1.0])
  const catDecay   = pastCats.get(event.cat) ?? 0;
  const venueDecay = event.venue ? (pastVenues.get(event.venue) ?? 0) : 0;
  score += 3 * catDecay;
  score += 2 * venueDecay;

  // Signal 3 — Implicit clicks with time decay
  const viewDecay = userViewCats.get(event.cat) ?? 0;
  score += 1.5 * viewDecay;

  // Signal 4a — Broad category alignment with user hobbies
  if (hobbyCats.has(event.cat)) score += 2;

  // Signal 4b — Direct tag-hobby overlap (more precise; takes priority)
  const tagMatches = (event.tags || []).filter((t) => hobbyNames.has(t.toLowerCase()));
  score += tagMatches.length * 3;

  // Signal 5 — Popularity (capped so it can't dominate)
  const pop = attendeeCounts[String(event.id)] || 0;
  score += Math.min(Math.floor(pop / 3), 4);

  return score;
}
