import { describe, it, expect } from 'vitest';
import { needsOnboarding, isEmailPrefixName, chosenName } from './onboarding';

// The regression this guards.
//
// needsOnboarding checked date_of_birth and hobbies but not city. The app
// persists hobbies at its interests step and the city one step later, so
// quitting in between produced a profile that every gate called complete. Five
// verified accounts reached that state, two of them after the fixed city list
// shipped on 2026-07-31. Discover, Search and People all scope on sameCity(),
// so those users saw an empty app with nothing explaining why.

const complete = {
  display_name: 'Priya',
  date_of_birth: '2000-01-01',
  hobbies: ['Jazz'],
  city: 'Hyderabad',
};

describe('needsOnboarding', () => {
  it('lets a fully onboarded profile through', () => {
    expect(needsOnboarding(complete)).toBe(false);
  });

  it('catches the app drop-off: interests saved, city never reached', () => {
    expect(needsOnboarding({ ...complete, city: null })).toBe(true);
    expect(needsOnboarding({ ...complete, city: '' })).toBe(true);
    expect(needsOnboarding({ ...complete, city: '   ' })).toBe(true);
  });

  it('still catches a missing date of birth — the 18+ gate', () => {
    expect(needsOnboarding({ ...complete, date_of_birth: null })).toBe(true);
  });

  // Interests moved out of onboarding on 1 Oct 2026 (asked for from Discover).
  // A gate that still required them would send every new member back here.
  it('no longer requires interests', () => {
    expect(needsOnboarding({ ...complete, hobbies: [] })).toBe(false);
    expect(needsOnboarding({ ...complete, hobbies: null })).toBe(false);
  });

  it('catches a missing name', () => {
    expect(needsOnboarding({ ...complete, display_name: '' })).toBe(true);
    expect(needsOnboarding({ ...complete, display_name: '   ' })).toBe(true);
    expect(needsOnboarding({ ...complete, display_name: null })).toBe(true);
  });

  it('treats a null profile as incomplete rather than throwing', () => {
    expect(needsOnboarding(null)).toBe(true);
    expect(needsOnboarding(undefined)).toBe(true);
  });
});

describe('needsOnboarding — city has to be one we actually serve', () => {
  it('accepts a city on the canonical list', () => {
    expect(needsOnboarding({ ...complete, city: 'Delhi' })).toBe(false);
    expect(needsOnboarding({ ...complete, city: 'Bengaluru' })).toBe(false);
  });

  it('accepts an alias, because it resolves to a served city', () => {
    expect(needsOnboarding({ ...complete, city: 'Bangalore' })).toBe(false);
    expect(needsOnboarding({ ...complete, city: 'Madhapur' })).toBe(false);
    // NCR aliases to Delhi, so the member already storing "Faridabad" is not
    // sent back through onboarding by the city gate.
    expect(needsOnboarding({ ...complete, city: 'Faridabad' })).toBe(false);
    expect(needsOnboarding({ ...complete, city: 'Gurgaon' })).toBe(false);
  });

  it('accepts a geocoded value with a region suffix', () => {
    expect(needsOnboarding({ ...complete, city: 'Hyderabad, Telangana' })).toBe(false);
  });

  it('sends a user back when her city is one we do not serve', () => {
    // Not gatekeeping for its own sake: an unserved city matches no event, so
    // the app is empty either way. Better to ask than to show her nothing.
    expect(needsOnboarding({ ...complete, city: 'Dubai' })).toBe(true);
    expect(needsOnboarding({ ...complete, city: 'asdf' })).toBe(true);
  });
});

// The regression this guards: the sign-up trigger used to name email accounts
// after their address (split_part(email, '@', 1)). 7 of 116 profiles carried
// that as their public name on 1 Oct 2026, 4 of them past onboarding.
describe('needsOnboarding — a name made from the email address is no name', () => {
  const email = 'priya.sharma88@gmail.com';

  it('sends back a profile still named after its email prefix', () => {
    expect(needsOnboarding({ ...complete, display_name: 'priya.sharma88' }, email)).toBe(true);
    expect(needsOnboarding({ ...complete, display_name: 'Priya.Sharma88 ' }, email)).toBe(true);
  });

  it('lets a chosen name through, including one that shares a word with the email', () => {
    expect(needsOnboarding({ ...complete, display_name: 'Priya Sharma' }, email)).toBe(false);
    expect(needsOnboarding({ ...complete, display_name: 'Priya' }, email)).toBe(false);
  });

  it('does not judge the name when the email is unknown', () => {
    expect(isEmailPrefixName('priya.sharma88', undefined)).toBe(false);
    expect(chosenName('priya.sharma88', null)).toBe('priya.sharma88');
  });

  it('never prefills the email prefix', () => {
    expect(chosenName('priya.sharma88', email)).toBe('');
    expect(chosenName('  Priya  ', email)).toBe('Priya');
  });
});
