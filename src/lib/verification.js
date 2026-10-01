/**
 * One definition of "verified", mirroring lib/verification.ts in the app repo.
 *
 * The app has always treated is_test as verified; the website only ever checked
 * verification_status. So the two demo accounts in APP-REVIEW.md, which are
 * is_test with verification_status 'unverified', could RSVP in the app and hit
 * the verification modal on the website. That split matters more now that
 * shared event links land people on the website first.
 */
export function isVerified(profile) {
  return !!profile && (profile.verification_status === 'verified' || profile.is_test === true);
}
