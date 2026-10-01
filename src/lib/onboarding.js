import { canonicalCity } from './city';

// Single source of truth for "has this user finished onboarding?". Keep in step
// with the app's lib/onboarding.ts: the two disagreeing is how an account
// complete in one place gets sent back through onboarding in the other.
// Onboarding collects a name, a date of birth (the 18+ gate) and a city. A user
// is incomplete until ALL of those are set, so email-confirmation / OAuth entry
// points can't drop them into the app pre-onboarding. Interests are not part of
// it since 1 Oct 2026: they are asked for afterwards, from Discover.
//
// City is in this list because the app writes onboarding in two steps — hobbies
// at the interests step, city at the step after — so quitting in between left a
// profile that looked complete to every gate and went on to verify with no city.
// Five verified accounts reached that state. Discover, Search and People all
// scope on sameCity(), so a city-less profile sees an empty app with nothing on
// screen explaining why.
//
// canonicalCity() rather than a truthy check: a value we do not serve scopes to
// no events at all, which is the same empty app by a different route.
// Accounts created before 20261001_display_name_not_from_email.sql were given
// the part of their email before the @ as a name. That is an identifier, not a
// name she chose, so it counts as no name at all.
export function isEmailPrefixName(name, email) {
  if (!name || !email) return false;
  return name.trim().toLowerCase() === email.split('@')[0].trim().toLowerCase();
}

// The name onboarding should prefill: hers, never her email prefix.
export function chosenName(name, email) {
  const n = (name ?? '').trim();
  return n && !isEmailPrefixName(n, email) ? n : '';
}

export function needsOnboarding(profile, email) {
  if (!profile) return true;
  return (
    !chosenName(profile.display_name, email) ||
    !profile.date_of_birth ||
    !canonicalCity(profile.city)
  );
}
