/**
 * verify-identity/index.ts — Supabase Edge Function
 *
 * Two-call flow, driven by `action` in the request body:
 *
 *   action: 'start'    → CreateFaceLivenessSession + short-lived scoped AWS creds.
 *                        Returns { sessionId, region, credentials, livenessUrl, handoffToken }.
 *   action: 'handoff'  → Exchanges a one-time token for creds WITHOUT a Supabase JWT.
 *                        Used by the hosted /liveness page the mobile app opens in
 *                        SFSafariViewController / Chrome Custom Tabs, which has no
 *                        Supabase session of its own.
 *   action: 'complete' → GetFaceLivenessSessionResults, then the two original checks.
 *
 * The three Rekognition checks, in order:
 *   1. Face Liveness — the face must be physically present in front of the camera
 *                      (≥ LIVENESS_MIN_CONFIDENCE, default 80%)
 *   2. CompareFaces  — must match the stored profile picture
 *                      (≥ FACE_MATCH_MIN_SIMILARITY, default 80%)
 *   3. DetectFaces   — must be a female face (≥ 80% confidence)
 *
 * WHY THE LIVENESS STEP EXISTS: this function used to accept a client-supplied
 * `selfieBase64`. CompareFaces and DetectFaces cannot distinguish a live face from a
 * photograph of one, so holding a picture of a woman up to the camera — or POSTing
 * one directly, bypassing the camera entirely — passed verification. That is a
 * women-only-space problem, not a cosmetic one.
 *
 * The fix is not "also run liveness". It is that the image the other two checks run
 * against is now the ReferenceImage that Rekognition itself captured during the live
 * challenge. The client no longer supplies pixels at all. `selfieBase64` is rejected.
 *
 * On success, updates profiles.verification_status = 'verified'.
 *
 * NO-RETENTION GUARANTEE: the liveness ReferenceImage arrives as bytes in the
 * GetFaceLivenessSessionResults response, is passed straight to CompareFaces/DetectFaces
 * in-memory, and is discarded when the request ends. It is never written to Supabase
 * Storage, never persisted to any table, and Rekognition is called in stateless
 * comparison mode (no Collection/IndexFaces call that would let AWS retain a FaceId).
 * AuditImagesLimit is set to 0 so AWS returns — and we hold — no extra frames, and no
 * OutputConfig is set so nothing is written to S3. The profile picture IS fetched (it's
 * already stored as the user's avatar) but no capture of the user's face outlives this
 * request. If this changes, the in-app "never stored" claim (VerificationModal.tsx) and
 * the Privacy Policy must be updated to match — a false claim here is both an App Store
 * and a DPDP Act problem.
 *
 * Deploy:
 *   supabase functions deploy verify-identity
 *
 * Required secrets (set once):
 *   supabase secrets set AWS_REGION=ap-south-1   # Mumbai — keeps biometric processing
 *                                                  # in-region for DPDP Act cross-border
 *                                                  # transfer purposes. Confirm Rekognition
 *                                                  # is available/enabled for this AWS
 *                                                  # account in ap-south-1 before changing
 *                                                  # an already-deployed AWS_REGION secret.
 *   supabase secrets set AWS_ACCESS_KEY_ID=AKIA...
 *   supabase secrets set AWS_SECRET_ACCESS_KEY=...
 *   supabase secrets set AWS_LIVENESS_ROLE_ARN=arn:aws:iam::<acct>:role/AfterhoursLiveness
 *
 * Optional secrets:
 *   AWS_LIVENESS_REGION    Region for the liveness session only. Defaults to AWS_REGION.
 *                          Face Liveness is offered in fewer regions than the rest of
 *                          Rekognition — CONFIRM ap-south-1 supports it in the AWS console.
 *                          If it does not, set this to a supported region; CompareFaces and
 *                          DetectFaces stay in AWS_REGION either way, so only the liveness
 *                          challenge leaves India rather than all biometric processing.
 *   FACE_MATCH_MIN_SIMILARITY  Default 80, matching AWS's own recommendation for
 *                            identity use. This was 70, which is below what AWS
 *                            advises and loose enough to admit a lookalike — the
 *                            risk there is not a man getting in (the gender check
 *                            runs on the live capture, so an uploaded photo cannot
 *                            help him) but a member verifying with her own face
 *                            while displaying someone else's photo. Raising it
 *                            costs nothing on the observed distribution: every
 *                            genuine pass has scored 97.5 or above, and every
 *                            failure has scored exactly 0, because CompareFaces
 *                            returns no match at all rather than a weak one. Do
 *                            not push this to 90+ without more data — a member
 *                            whose profile photo is a few years old or at an angle
 *                            can legitimately land in the 80s.
 *   LIVENESS_MIN_CONFIDENCE  Default 80, which is AWS's own reference threshold. This was
 *                            85 on the theory that a false accept admits a man to a women-only
 *                            space, but the gender check is what actually stops that, and the
 *                            extra 5 points only cost real members: of the first eight
 *                            completed challenges, three failed here at 78.4, 80.9 and 84.2.
 *                            Two of those three were live women who would have passed at 80.
 *   LIVENESS_WEB_ORIGIN      Origin hosting the /liveness page. Default https://www.joinafterhours.in
 *
 * AWS_LIVENESS_ROLE_ARN must point to an IAM role that (a) trusts the IAM user behind
 * AWS_ACCESS_KEY_ID, and (b) allows rekognition:StartFaceLivenessSession. The browser
 * needs real AWS credentials to stream challenge video to Rekognition directly; rather
 * than shipping the long-lived IAM user key to the client (which can also call
 * CompareFaces/DetectFaces and everything else), we hand out 15-minute AssumeRole
 * credentials further narrowed by an inline session policy to that one action.
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  RekognitionClient,
  CompareFacesCommand,
  DetectFacesCommand,
  CreateFaceLivenessSessionCommand,
  GetFaceLivenessSessionResultsCommand,
} from 'npm:@aws-sdk/client-rekognition@3';
import { STSClient, AssumeRoleCommand } from 'npm:@aws-sdk/client-sts@3';
import { sendEmail } from '../_shared/email.ts';
import { buildFoundersWelcomeEmail } from '../_shared/founders-email.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });

// ── Config ────────────────────────────────────────────────────────────────────
const REGION           = Deno.env.get('AWS_REGION') ?? 'ap-south-1';
const LIVENESS_REGION  = Deno.env.get('AWS_LIVENESS_REGION') ?? REGION;
const LIVENESS_MIN_CONFIDENCE = Number(Deno.env.get('LIVENESS_MIN_CONFIDENCE') ?? '80');
const FACE_MATCH_MIN_SIMILARITY = Number(Deno.env.get('FACE_MATCH_MIN_SIMILARITY') ?? '80');
const LIVENESS_WEB_ORIGIN = Deno.env.get('LIVENESS_WEB_ORIGIN') ?? 'https://www.joinafterhours.in';

// A liveness session must be completed within this window. Rekognition expires
// sessions on its own side too; this is our independent bound on how long a
// pending session stays claimable.
const SESSION_TTL_MS = 10 * 60 * 1000;

const awsCredentials = () => ({
  accessKeyId: Deno.env.get('AWS_ACCESS_KEY_ID')!,
  secretAccessKey: Deno.env.get('AWS_SECRET_ACCESS_KEY')!,
});

// ── Token helpers ─────────────────────────────────────────────────────────────
function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ── Scoped browser credentials ────────────────────────────────────────────────
// The inline session policy is the important part: even if the assumed role is
// broader than it should be, these credentials can only start a liveness session.
async function issueLivenessCredentials(userId: string) {
  const roleArn = Deno.env.get('AWS_LIVENESS_ROLE_ARN');
  if (!roleArn) throw new Error('AWS_LIVENESS_ROLE_ARN is not set');

  const sts = new STSClient({ region: LIVENESS_REGION, credentials: awsCredentials() });
  const res = await sts.send(new AssumeRoleCommand({
    RoleArn: roleArn,
    // RoleSessionName only accepts [\w+=,.@-], so strip the UUID's dashes.
    RoleSessionName: `liveness-${userId.replace(/-/g, '').slice(0, 32)}`,
    DurationSeconds: 900, // 15 min — the AssumeRole minimum
    Policy: JSON.stringify({
      Version: '2012-10-17',
      Statement: [{
        Effect: 'Allow',
        Action: 'rekognition:StartFaceLivenessSession',
        Resource: '*',
      }],
    }),
  }));

  const c = res.Credentials;
  if (!c?.AccessKeyId || !c.SecretAccessKey || !c.SessionToken) {
    throw new Error('AssumeRole returned no credentials');
  }
  return {
    accessKeyId: c.AccessKeyId,
    secretAccessKey: c.SecretAccessKey,
    sessionToken: c.SessionToken,
    expiration: c.Expiration?.toISOString() ?? null,
  };
}

// ── Attempt logging ───────────────────────────────────────────────────────────
// Records every outcome that reaches AWS so the 85%/70%/80% thresholds can
// eventually be tuned from real data. Best-effort: a logging failure must never
// block the verification result.
async function logAttempt(
  admin: SupabaseClient,
  userId: string,
  result: 'verified' | 'failed',
  reason: string,
  extra: {
    similarity?: number;
    gender?: string;
    genderConfidence?: number;
    livenessConfidence?: number;
  } = {},
) {
  try {
    await admin.from('identity_verification_log').insert({
      user_id: userId,
      result,
      reason,
      similarity: extra.similarity ?? null,
      gender: extra.gender ?? null,
      gender_confidence: extra.genderConfidence ?? null,
      liveness_confidence: extra.livenessConfidence ?? null,
    });
  } catch (err) {
    console.error('[verify-identity] attempt logging failed:', err);
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  // Body is parsed before auth because the 'handoff' action authenticates with a
  // one-time token instead of a user JWT (the mobile handoff browser has no
  // Supabase session).
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ verified: false, reason: 'invalid_request' }, 400);
  }
  const action = (body.action as string) ?? 'complete';

  const adminClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  if (action === 'handoff') return handleHandoff(body, adminClient);

  // ── Auth: validate JWT ─────────────────────────────────────────────────────
  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader) return new Response('Unauthorized', { status: 401, headers: CORS });

  const anonClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user }, error: authErr } = await anonClient.auth.getUser();
  if (authErr || !user) return new Response('Unauthorized', { status: 401, headers: CORS });

  if (action === 'start')    return handleStart(user.id, adminClient);
  if (action === 'complete') return handleComplete(body, user.id, user.email ?? '', adminClient);

  return json({ verified: false, reason: 'invalid_request' }, 400);
});

// ── action: 'start' ───────────────────────────────────────────────────────────
async function handleStart(userId: string, adminClient: SupabaseClient) {
  const { data: profile, error: profileErr } = await adminClient
    .from('profiles')
    .select('avatar_url, verification_status')
    .eq('id', userId)
    .single();

  if (profileErr) {
    console.error('[verify-identity] profile fetch:', profileErr);
    return json({ verified: false, reason: 'server_error' }, 500);
  }

  // Already verified — idempotent
  if (profile?.verification_status === 'verified') {
    return json({ verified: true, reason: 'already_verified' });
  }

  // Profile picture required before verification. Checked here rather than after
  // the challenge so we don't make her do a liveness check that cannot succeed.
  if (!profile?.avatar_url) {
    return json({ verified: false, reason: 'no_profile_picture' });
  }

  // ── Rate limit ───────────────────────────────────────────────────────────────
  // Cap verification attempts per user BEFORE any AWS spend (cost + brute-force
  // protection). Atomic check+increment via a service-role RPC. Fail OPEN on
  // infra error (e.g. RPC not yet deployed) so we never block legit users — the
  // limiter is a safeguard, not a correctness requirement.
  //
  // Gating 'start' also gates 'complete', since completing requires a session id
  // that only 'start' can mint.
  try {
    const { data: allowed, error: rlErr } = await adminClient.rpc('record_verification_attempt', {
      p_user_id: userId,
    });
    if (rlErr) {
      console.error('[verify-identity] rate-limit check failed (failing open):', rlErr);
    } else if (allowed === false) {
      return json({ verified: false, reason: 'rate_limited' }, 429);
    }
  } catch (err) {
    console.error('[verify-identity] rate-limit check threw (failing open):', err);
  }

  // ── Create the Rekognition liveness session ─────────────────────────────────
  let sessionId: string;
  try {
    const rekognition = new RekognitionClient({
      region: LIVENESS_REGION,
      credentials: awsCredentials(),
    });
    const res = await rekognition.send(new CreateFaceLivenessSessionCommand({
      Settings: {
        // 0 = AWS returns no audit frames. Keeps the "never stored" claim honest and
        // means there is nothing extra to discard. Raise only if manual review of
        // failed attempts becomes necessary — and update the Privacy Policy if so.
        AuditImagesLimit: 0,
        // ChallengePreferences is deliberately omitted: the Rekognition default is
        // FaceMovementAndLightChallenge, which combines movement detection with
        // light analysis and is the stronger of the two options.
      },
    }));
    if (!res.SessionId) throw new Error('CreateFaceLivenessSession returned no SessionId');
    sessionId = res.SessionId;
  } catch (err) {
    console.error('[verify-identity] CreateFaceLivenessSession error:', err);
    return json({ verified: false, reason: 'liveness_unavailable' }, 500);
  }

  // ── Bind the session to this user ───────────────────────────────────────────
  // Without this row, a session id passed to a friend would let them verify as
  // her. Written before credentials are issued so no usable session ever exists
  // unbound.
  const handoffToken = randomToken();
  const { error: insertErr } = await adminClient.from('liveness_sessions').insert({
    session_id: sessionId,
    user_id: userId,
    handoff_hash: await sha256Hex(handoffToken),
  });
  if (insertErr) {
    console.error('[verify-identity] liveness session insert:', insertErr);
    return json({ verified: false, reason: 'server_error' }, 500);
  }

  let credentials;
  try {
    credentials = await issueLivenessCredentials(userId);
  } catch (err) {
    console.error('[verify-identity] AssumeRole error:', err);
    return json({ verified: false, reason: 'liveness_unavailable' }, 500);
  }

  return json({
    sessionId,
    region: LIVENESS_REGION,
    credentials,
    handoffToken,
    // Fragment, not query string: fragments are never sent in Referer headers or
    // written to server access logs, so the one-time token stays out of both.
    livenessUrl: `${LIVENESS_WEB_ORIGIN}/liveness#s=${encodeURIComponent(sessionId)}&t=${encodeURIComponent(handoffToken)}`,
  });
}

// ── action: 'handoff' ─────────────────────────────────────────────────────────
// Called by the hosted /liveness page opened from the mobile app. Authenticates
// with the one-time token rather than a Supabase JWT. Single-use and TTL-bound.
async function handleHandoff(body: Record<string, unknown>, adminClient: SupabaseClient) {
  const sessionId = body.sessionId as string;
  const token     = body.handoffToken as string;
  if (!sessionId || !token) return json({ reason: 'invalid_request' }, 400);

  const cutoff = new Date(Date.now() - SESSION_TTL_MS).toISOString();

  // Single UPDATE ... WHERE ... RETURNING — atomic, so two concurrent requests
  // cannot both claim the same token.
  const { data: claimed, error } = await adminClient
    .from('liveness_sessions')
    .update({ handoff_used_at: new Date().toISOString() })
    .eq('session_id', sessionId)
    .eq('handoff_hash', await sha256Hex(token))
    .is('handoff_used_at', null)
    .is('consumed_at', null)
    .gt('created_at', cutoff)
    .select('user_id')
    .maybeSingle();

  if (error) {
    console.error('[verify-identity] handoff claim:', error);
    return json({ reason: 'server_error' }, 500);
  }
  if (!claimed) return json({ reason: 'invalid_handoff' }, 401);

  try {
    const credentials = await issueLivenessCredentials(claimed.user_id);
    return json({ sessionId, region: LIVENESS_REGION, credentials });
  } catch (err) {
    console.error('[verify-identity] AssumeRole error (handoff):', err);
    return json({ reason: 'liveness_unavailable' }, 500);
  }
}

// ── action: 'complete' ────────────────────────────────────────────────────────
async function handleComplete(
  body: Record<string, unknown>,
  userId: string,
  userEmail: string,
  adminClient: SupabaseClient,
) {
  // Old clients POST { selfieBase64 } with no sessionId. Reject explicitly rather
  // than falling back — a fallback that accepts client pixels would reopen exactly
  // the hole this function exists to close.
  const sessionId = body.sessionId as string;
  if (!sessionId) return json({ verified: false, reason: 'liveness_required' }, 400);

  const { data: profile, error: profileErr } = await adminClient
    .from('profiles')
    .select('avatar_url, verification_status, display_name, city, is_test')
    .eq('id', userId)
    .single();

  if (profileErr) {
    console.error('[verify-identity] profile fetch:', profileErr);
    return json({ verified: false, reason: 'server_error' }, 500);
  }

  if (profile?.verification_status === 'verified') {
    return json({ verified: true, reason: 'already_verified' });
  }
  if (!profile?.avatar_url) {
    return json({ verified: false, reason: 'no_profile_picture' });
  }

  // ── Claim the session ───────────────────────────────────────────────────────
  // Atomically marks it consumed. Enforces all three of: the session belongs to
  // this user, it has not been used before, and it is still inside the TTL.
  const cutoff = new Date(Date.now() - SESSION_TTL_MS).toISOString();
  const { data: claimed, error: claimErr } = await adminClient
    .from('liveness_sessions')
    .update({ consumed_at: new Date().toISOString() })
    .eq('session_id', sessionId)
    .eq('user_id', userId)
    .is('consumed_at', null)
    .gt('created_at', cutoff)
    .select('session_id')
    .maybeSingle();

  if (claimErr) {
    console.error('[verify-identity] session claim:', claimErr);
    return json({ verified: false, reason: 'server_error' }, 500);
  }
  if (!claimed) return json({ verified: false, reason: 'liveness_session_invalid' }, 400);

  // ── Step 1: Face Liveness ───────────────────────────────────────────────────
  // The ReferenceImage returned here is the only face image this function trusts.
  let livenessConfidence = 0;
  // Null until the liveness step yields a reference image. Every failure path below
  // returns, so a null here after the try block can only mean an unexpected shape
  // from AWS — fail closed rather than proceed with no image.
  let selfieBytes: Uint8Array | null = null;
  try {
    const rekognitionLiveness = new RekognitionClient({
      region: LIVENESS_REGION,
      credentials: awsCredentials(),
    });
    const res = await rekognitionLiveness.send(
      new GetFaceLivenessSessionResultsCommand({ SessionId: sessionId }),
    );

    // Status is one of CREATED | IN_PROGRESS | SUCCEEDED | FAILED | EXPIRED.
    // Anything other than SUCCEEDED means the challenge was not passed — treat a
    // spoof (FAILED) and an abandoned session (EXPIRED) the same way: not verified.
    if (res.Status !== 'SUCCEEDED') {
      await adminClient.rpc('set_identity_verification', { p_user_id: userId, p_status: 'failed' });
      await logAttempt(adminClient, userId, 'failed', 'liveness_failed', {
        livenessConfidence: res.Confidence ?? 0,
      });
      return json({ verified: false, reason: 'liveness_failed', livenessConfidence: res.Confidence ?? 0 });
    }

    livenessConfidence = res.Confidence ?? 0;
    if (livenessConfidence < LIVENESS_MIN_CONFIDENCE) {
      await adminClient.rpc('set_identity_verification', { p_user_id: userId, p_status: 'failed' });
      await logAttempt(adminClient, userId, 'failed', 'liveness_low_confidence', { livenessConfidence });
      return json({ verified: false, reason: 'liveness_failed', livenessConfidence });
    }

    const referenceBytes = res.ReferenceImage?.Bytes;
    if (!referenceBytes) {
      // Would only happen if OutputConfig were set to write to S3 instead of
      // returning bytes inline. Fail closed rather than fall back to a client image.
      console.error('[verify-identity] liveness succeeded but returned no ReferenceImage bytes');
      return json({ verified: false, reason: 'server_error' }, 500);
    }
    selfieBytes = referenceBytes as Uint8Array;
  } catch (err) {
    console.error('[verify-identity] GetFaceLivenessSessionResults error:', err);
    return json({ verified: false, reason: 'server_error' }, 500);
  }
  if (!selfieBytes) return json({ verified: false, reason: 'server_error' }, 500);

  // ── Fetch profile picture bytes ─────────────────────────────────────────────
  // Strip cache-busting query params before fetching
  const avatarUrl = profile.avatar_url.split('?')[0];
  const avatarRes = await fetch(avatarUrl);
  if (!avatarRes.ok) {
    console.error('[verify-identity] avatar fetch failed:', avatarRes.status, avatarUrl);
    return json({ verified: false, reason: 'profile_pic_fetch_failed' });
  }
  const profileImageBytes = new Uint8Array(await avatarRes.arrayBuffer());

  const rekognition = new RekognitionClient({ region: REGION, credentials: awsCredentials() });

  // ── Step 2: Compare faces ───────────────────────────────────────────────────
  let similarity = 0;
  try {
    const compareRes = await rekognition.send(
      new CompareFacesCommand({
        SourceImage: { Bytes: profileImageBytes },  // profile picture
        TargetImage: { Bytes: selfieBytes },         // live capture from the liveness session
        SimilarityThreshold: FACE_MATCH_MIN_SIMILARITY,
      }),
    );
    similarity = compareRes.FaceMatches?.[0]?.Similarity ?? 0;
  } catch (err) {
    console.error('[verify-identity] CompareFaces error:', err);
    // InvalidParameterException means no face found in one of the images. The
    // AWS SDK v3 puts that identifier in err.name, not err.message, so match on
    // the name — matching the message text alone misses it and returns a bogus
    // server_error for a plain "no face in photo" case. With liveness upstream the
    // live capture always has a face, so in practice this now means the profile
    // picture doesn't.
    const name = (err as { name?: string }).name ?? '';
    const msg = (err as Error).message ?? '';
    if (name === 'InvalidParameterException' || msg.toLowerCase().includes('no faces') || msg.includes('InvalidParameter')) {
      await adminClient.rpc('set_identity_verification', { p_user_id: userId, p_status: 'failed' });
      await logAttempt(adminClient, userId, 'failed', 'no_face_detected', { similarity: 0, livenessConfidence });
      return json({ verified: false, reason: 'no_face_detected', similarity: 0 });
    }
    return json({ verified: false, reason: 'server_error' }, 500);
  }

  if (similarity < FACE_MATCH_MIN_SIMILARITY) {
    await adminClient.rpc('set_identity_verification', { p_user_id: userId, p_status: 'failed' });
    await logAttempt(adminClient, userId, 'failed', 'face_mismatch', { similarity, livenessConfidence });
    return json({ verified: false, reason: 'face_mismatch', similarity });
  }

  // ── Step 3: Detect gender from the live capture ─────────────────────────────
  let gender = '';
  let genderConfidence = 0;
  try {
    const detectRes = await rekognition.send(
      new DetectFacesCommand({
        Image: { Bytes: selfieBytes },
        Attributes: ['ALL'],
      }),
    );
    const face = detectRes.FaceDetails?.[0];
    gender = face?.Gender?.Value ?? '';
    genderConfidence = face?.Gender?.Confidence ?? 0;
  } catch (err) {
    console.error('[verify-identity] DetectFaces error:', err);
    return json({ verified: false, reason: 'server_error' }, 500);
  }

  const isFemale = gender === 'Female' && genderConfidence >= 80;

  if (!isFemale) {
    await adminClient.rpc('set_identity_verification', { p_user_id: userId, p_status: 'failed' });
    await logAttempt(adminClient, userId, 'failed', 'gender_check_failed', { similarity, gender, genderConfidence, livenessConfidence });
    return json({ verified: false, reason: 'gender_check_failed', gender, genderConfidence });
  }

  // ── All checks passed ─────────────────────────────────────────────────────
  // Write through the RPC so it sets app.bypass_trust_guard and gets past
  // guard_profile_trust_cols(); a plain .update() is silently reverted by the guard.
  // The RPC sets verification_status + verified_at + verification_at + gender.
  await adminClient.rpc('set_identity_verification', {
    p_user_id: userId,
    p_status: 'verified',
    p_gender: gender,
  });
  await logAttempt(adminClient, userId, 'verified', 'success', { similarity, gender, genderConfidence, livenessConfidence });

  // Welcome email — best-effort, never block the verification result on it.
  if (!profile?.is_test && userEmail) {
    const name = profile?.display_name || 'there';
    const city = profile?.city || '';

    // Fetch member count in her city for a personalised line.
    let cityLine = '';
    if (city) {
      const { count } = await adminClient
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('city', city)
        .eq('verification_status', 'verified')
        .neq('id', userId);
      if (count && count > 0) {
        cityLine = `You're joining ${count} verified ${count === 1 ? 'woman' : 'women'} already on Afterhours in ${city}.`;
      }
    }

    try {
      const { subject, text, html } = buildFoundersWelcomeEmail({ name, cityLine });
      await sendEmail(userEmail, subject, text, html);
    } catch (err) {
      console.error('[verify-identity] welcome email failed:', err);
    }
  }

  console.log(`[verify-identity] user ${userId} verified — liveness=${livenessConfidence.toFixed(1)}% similarity=${similarity.toFixed(1)}% gender=${gender}(${genderConfidence.toFixed(0)}%)`);

  return json({ verified: true, reason: 'success', similarity, gender, genderConfidence, livenessConfidence });
}
