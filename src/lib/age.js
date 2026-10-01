// Age helpers for the 18+ signup gate (mirrors the iOS app's lib/age.ts).
// The authoritative check lives in the Supabase DB trigger; these run client-side
// for immediate feedback.

export const MIN_AGE = 18;

/** Full years between `dob` and `now` (defaults to today). */
export function calculateAge(dob, now = new Date()) {
  const birth = typeof dob === 'string' ? new Date(dob) : dob;
  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

/** True when the person is at least MIN_AGE years old. Invalid/empty dates → false. */
export function isAtLeast18(dob) {
  if (!dob) return false;
  const birth = typeof dob === 'string' ? new Date(dob) : dob;
  if (isNaN(birth.getTime())) return false;
  return calculateAge(birth) >= MIN_AGE;
}

/** Latest DOB that still qualifies as 18+, as YYYY-MM-DD — use as <input type="date" max>. */
export function maxEligibleBirthDateISO(now = new Date()) {
  const d = new Date(now.getFullYear() - MIN_AGE, now.getMonth(), now.getDate());
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
