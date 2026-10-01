import { supabase } from '../lib/supabase';

const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-identity`;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

async function callAuthed(payload) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const res = await fetch(FN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
      'apikey': ANON_KEY,
    },
    body: JSON.stringify(payload),
  });

  // The edge function returns a structured { verified, reason } body even on some
  // non-2xx codes (400 liveness_required, 429 rate_limited). Parse first so the
  // caller can show real copy instead of a raw status code.
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* non-JSON error body */ }

  if (!res.ok && !json?.reason) {
    throw new Error(json?.message || json?.error || 'Something went wrong. Please try again.');
  }
  return json;
}

/**
 * Step 1 — asks the server to open a Rekognition Face Liveness session.
 * Returns { sessionId, region, credentials, livenessUrl, handoffToken },
 * or a { verified, reason } object if the attempt was refused up front
 * (no_profile_picture, rate_limited, already verified).
 */
export function startLiveness() {
  return callAuthed({ action: 'start' });
}

/**
 * Step 2 — run after the liveness challenge completes in the browser. The server
 * pulls the challenge's reference image from Rekognition and runs the face-match
 * and gender checks against it. No image is sent from here: the client never
 * supplies the pixels that decide verification.
 *
 * Returns { verified, reason, similarity?, gender?, genderConfidence?, livenessConfidence? }
 */
export function completeVerification(sessionId) {
  return callAuthed({ action: 'complete', sessionId });
}

/**
 * Used only by the /liveness handoff page, which is opened from the mobile app's
 * in-app browser and therefore has no Supabase session. Exchanges the one-time
 * token from the URL fragment for short-lived, single-purpose AWS credentials.
 */
export async function exchangeHandoffToken(sessionId, handoffToken) {
  const res = await fetch(FN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // No user session exists here; the anon key satisfies the gateway and the
      // one-time token is what actually authenticates the request.
      'Authorization': `Bearer ${ANON_KEY}`,
      'apikey': ANON_KEY,
    },
    body: JSON.stringify({ action: 'handoff', sessionId, handoffToken }),
  });

  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.reason || 'invalid_handoff');
  return json;
}
