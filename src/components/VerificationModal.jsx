import { useState, useRef, useEffect, lazy, Suspense } from 'react';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';
import { startLiveness, completeVerification } from '../services/verification.service';
import AvatarCropModal from './AvatarCropModal';

// FaceLivenessDetector drags in TensorFlow.js and MediaPipe — ~320kB gzipped. Load
// it only when the user actually reaches the liveness step, not when the modal opens.
const LivenessCheck = lazy(() => import('./LivenessCheck'));

const REASON_MESSAGES = {
  no_profile_picture: 'We couldn\'t find your profile picture. Please pick one and try again.',
  face_mismatch:      'Your face doesn\'t match your profile picture. Make sure your profile picture is a clear, recent photo of you with your face fully visible.',
  gender_check_failed:'We weren\'t able to confirm your gender as female. Afterhours is a women-only space. If you believe this is an error, please contact support.',
  no_face_detected:   'We couldn\'t detect a face in your profile picture. Make sure your face is clearly visible and well-lit.',
  profile_pic_fetch_failed: 'We couldn\'t load your profile picture. Please pick a different one and try again.',
  server_error:       'Something went wrong on our end. Please try again in a moment.',
  rate_limited:       'Too many verification attempts. Please wait a little while and try again.',
  liveness_failed:    'We couldn\'t confirm a live person in front of the camera. Photos, screens and recordings won\'t pass — please do the check yourself, in good lighting, and follow the on-screen prompts.',
  liveness_session_invalid: 'That check expired or was already used. Please start again.',
  liveness_unavailable: 'The liveness check is temporarily unavailable. Please try again in a moment.',
  liveness_required:  'Please complete the liveness check before submitting.',
};

// ── Step indicator ─────────────────────────────────────────────────────────────
function Steps({ current }) {
  const steps = ['Profile picture', 'Liveness check', 'Verification'];
  return (
    <div className="flex items-center gap-1.5 sm:gap-2 mb-6 sm:mb-8">
      {steps.map((label, i) => {
        const n      = i + 1;
        const done   = n < current;
        const active = n === current;
        return (
          <div key={n} className="flex items-center gap-1.5 sm:gap-2 flex-1 last:flex-none min-w-0">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 transition-all ${
              done   ? 'bg-primary text-on-primary' :
              active ? 'bg-primary text-on-primary' :
                       'bg-surface-container text-on-surface-variant border border-outline-variant/30'
            }`}>
              {done
                ? <span className="material-symbols-outlined" style={{ fontSize: 12 }}>check</span>
                : n}
            </div>
            <span className={`text-[10px] sm:text-[11px] font-bold uppercase tracking-wider sm:tracking-widest whitespace-nowrap truncate ${
              active ? 'text-primary' : 'text-on-surface-variant/40 hidden sm:inline'
            }`}>{label}</span>
            {i < steps.length - 1 && (
              <div className={`flex-1 h-0.5 rounded mx-0.5 sm:mx-1 ${done ? 'bg-primary' : 'bg-outline-variant/20'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function VerificationModal({ onClose, onVerified }) {
  const { user, profile, updateProfile, refreshProfile } = useAuth();

  // 'intro' | 'upload' | 'starting' | 'liveness' | 'submitting' | 'success' | 'failed'
  const [phase, setPhase]       = useState('intro');
  const [failReason, setFailReason] = useState('');
  const [submitError, setSubmitError] = useState('');

  // Rekognition liveness session: { sessionId, region, credentials }
  const [liveness, setLiveness] = useState(null);

  // Welcome data shown on success
  const [memberCount, setMemberCount] = useState(null);
  const [nearbyEvents, setNearbyEvents] = useState([]);

  // ── Inline profile-picture upload state ─────────────────────────────────────
  const [pickedPreview, setPickedPreview] = useState('');     // object URL for the cropped <img>
  const pickedBlobRef = useRef(null);                          // cropped JPEG blob to upload
  const [originalSrc, setOriginalSrc]   = useState('');       // object URL of the file as picked
  const [showCrop, setShowCrop]         = useState(false);
  const [uploadError, setUploadError]   = useState('');
  const [uploading, setUploading]       = useState(false);

  // ── Profile-picture reachability check ─────────────────────────────────────
  // `profile.avatar_url` can be set on the row but point to a deleted/missing
  // object in storage. Probing the URL is the only honest way to know whether
  // step 1 is actually done. While we don't know yet, treat step 1 as not done
  // so we don't skip past an upload the user genuinely needs.
  // 'pending' | 'ok' | 'missing'
  const [picCheck, setPicCheck] = useState('pending');
  const avatarUrl = profile?.avatar_url;
  useEffect(() => {
    const url = (avatarUrl || '').trim();
    if (!url) { setPicCheck('missing'); return; }
    setPicCheck('pending');
    const img = new Image();
    let cancelled = false;
    img.onload  = () => { if (!cancelled) setPicCheck(img.naturalWidth > 0 ? 'ok' : 'missing'); };
    img.onerror = () => { if (!cancelled) setPicCheck('missing'); };
    img.src = url;
    return () => { cancelled = true; img.onload = img.onerror = null; };
  }, [avatarUrl]);

  const hasProfilePic = picCheck === 'ok';
  const checkingProfilePic = picCheck === 'pending';
  const stepNumber =
    phase === 'intro'  ? (hasProfilePic ? 2 : 1) :
    phase === 'upload' ? 1 :
    phase === 'starting' || phase === 'liveness' ? 2 :
    3;

  // Revoke any object URL the picker made
  useEffect(() => () => { if (pickedPreview) URL.revokeObjectURL(pickedPreview); }, [pickedPreview]);
  useEffect(() => () => { if (originalSrc) URL.revokeObjectURL(originalSrc); }, [originalSrc]);

  // ── Open a liveness session ─────────────────────────────────────────────────
  // The server mints the session id and the short-lived AWS credentials the
  // detector needs. It can also refuse here (no profile picture, rate limited,
  // already verified), in which case there's nothing to run.
  async function beginLiveness() {
    setPhase('starting');
    setSubmitError('');
    try {
      const data = await startLiveness();
      if (data?.verified) { await refreshProfile(); setPhase('success'); onVerified?.(); return; }
      if (!data?.sessionId) {
        setFailReason(data?.reason || 'server_error');
        setPhase('failed');
        return;
      }
      setLiveness({ sessionId: data.sessionId, region: data.region, credentials: data.credentials });
      setPhase('liveness');
    } catch (err) {
      setSubmitError(err.message || 'Something went wrong. Please try again.');
      setFailReason('server_error');
      setPhase('failed');
    }
  }

  // ── Intro → next step ───────────────────────────────────────────────────────
  function handleStart() {
    if (checkingProfilePic) return;
    if (hasProfilePic) beginLiveness();
    else setPhase('upload');
  }

  // ── Profile-picture upload (file picker → crop → upload) ───────────────────
  function handlePickFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setUploadError('Please select an image file.');
      return;
    }
    // The crop step re-encodes to a 400×400 JPEG, so the source only has to be
    // small enough to decode in the browser — Rekognition never sees the original.
    if (file.size > 20 * 1024 * 1024) {
      setUploadError('Image must be under 20MB. Try a smaller photo.');
      return;
    }
    setUploadError('');
    // Start clean: a new source means the previous crop no longer has an original
    // behind it, so cancelling the cropper should land back on the empty state.
    pickedBlobRef.current = null;
    setPickedPreview('');
    setOriginalSrc(URL.createObjectURL(file));
    setShowCrop(true);
  }

  function handleCropSave(blob) {
    pickedBlobRef.current = blob;
    setPickedPreview(URL.createObjectURL(blob));
    setShowCrop(false);
  }

  function handleCropCancel() {
    setShowCrop(false);
    // Nothing cropped yet — drop the source so "Choose a photo" comes back.
    if (!pickedBlobRef.current) setOriginalSrc('');
  }

  async function handleConfirmPhoto() {
    const blob = pickedBlobRef.current;
    if (!blob || !user?.id) return;
    setUploading(true);
    setUploadError('');
    try {
      const path = `${user.id}/avatar.jpg`;
      const { error: upErr } = await supabase.storage
        .from('avatars')
        .upload(path, blob, { upsert: true, contentType: 'image/jpeg' });
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
      await updateProfile({ avatar_url: `${publicUrl}?t=${Date.now()}` });
      pickedBlobRef.current = null;
      setPickedPreview('');
      setOriginalSrc('');
      beginLiveness();
    } catch (err) {
      console.error('[verify] avatar upload:', err);
      setUploadError(err?.message || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  }

  // ── Ask the server for the verdict ─────────────────────────────────────────
  // Runs once the challenge finishes. No image is sent: the server pulls the
  // reference frame Rekognition captured during the live challenge and runs the
  // face match and gender check against that.
  async function handleSubmit() {
    if (!liveness?.sessionId) return;
    setPhase('submitting');
    setSubmitError('');
    try {
      const result = await completeVerification(liveness.sessionId);
      if (result.verified) {
        // SECURITY: never write verification_status from the client — it is set
        // authoritatively by the verify-identity edge function (service role).
        // Re-read the profile so local state reflects the server-set status.
        await refreshProfile();

        // Fetch welcome data — member count in her city + nearby upcoming events.
        const city = profile?.city;
        if (city) {
          const [{ count }, { data: events }] = await Promise.all([
            // `profiles` is owner-only under RLS (count would be 0/1); the
            // public view is readable. Prefix-match the city like Discover does.
            supabase
              .from('public_profiles')
              .select('*', { count: 'exact', head: true })
              .ilike('city', `${city.split(',')[0].trim()}%`)
              .eq('verification_status', 'verified'),
            supabase
              .from('events')
              .select('id, title, starts_at, venue')
              .eq('city', city)
              .gt('starts_at', new Date().toISOString())
              .order('starts_at', { ascending: true })
              .limit(3),
          ]);
          setMemberCount(count ?? null);
          setNearbyEvents(events ?? []);
        }

        setPhase('success');
        onVerified?.();
      } else {
        setFailReason(result.reason ?? 'server_error');
        setPhase('failed');
      }
    } catch (err) {
      setSubmitError((err).message || 'Something went wrong. Please try again.');
      setPhase('failed');
      setFailReason('server_error');
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    // The backdrop blur is dropped for the liveness phase on purpose. `backdrop-filter`
    // makes this element the containing block for `position: fixed` descendants, which
    // re-anchors Amplify's full-viewport freshness canvas to this box and leaves the
    // colour challenge filling only part of the screen. Solid background instead, so
    // the flash covers the viewport the way the light challenge expects.
    <div className={`fixed inset-0 z-[400] overflow-y-auto flex flex-col ${
      phase === 'liveness' ? 'bg-background' : 'bg-background/95 backdrop-blur-2xl'
    }`}>
      <div className="max-w-lg mx-auto w-full px-4 sm:px-5 pt-6 pb-10 sm:py-10 sm:pb-24 flex flex-col flex-1">

        {/* Header */}
        <div className="flex items-center justify-between mb-6 sm:mb-8 gap-3">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-primary-container flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-outlined text-primary" style={{ fontSize: 18, fontVariationSettings: "'FILL' 1" }}>verified_user</span>
            </div>
            <div className="min-w-0">
              <h2 className="font-headline text-lg sm:text-xl font-bold text-on-surface leading-tight truncate">Identity Verification</h2>
              <p className="text-[11px] sm:text-xs text-on-surface-variant mt-0.5 truncate">Quick, private, women-only</p>
            </div>
          </div>
          {phase !== 'submitting' && (
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-all flex-shrink-0"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          )}
        </div>

        <Steps current={stepNumber} />

        {/* ── Phase: intro ── */}
        {phase === 'intro' && (
          <div className="flex-1 flex flex-col">
            <div className="mb-6 sm:mb-8">
              <h3 className="font-headline text-xl sm:text-2xl font-bold text-on-surface mb-2 sm:mb-3">
                Verify your identity
              </h3>
              <p className="text-on-surface-variant text-sm leading-relaxed">
                Afterhours is a women-only space. We use facial analysis to confirm your identity and ensure the safety of our community.
              </p>
            </div>

            {/* Steps preview */}
            <div className="space-y-2.5 sm:space-y-3 mb-6 sm:mb-8">
              {[
                {
                  icon: 'photo_camera',
                  title: 'Profile picture',
                  desc: checkingProfilePic
                    ? 'Checking your profile picture…'
                    : hasProfilePic
                      ? 'A clear photo of your face. Already on your profile.'
                      : 'Pick a clear photo of your face from your device.',
                  done: hasProfilePic,
                },
                { icon: 'face',         title: 'Liveness check',  desc: 'A short on-camera check that confirms a real person is present. Your screen will flash colours as part of it. Photos and videos won\'t pass.', done: false },
                { icon: 'verified',     title: 'Instant check',   desc: 'We match your face to your profile picture and confirm eligibility in seconds.', done: false },
              ].map(({ icon, title, desc, done }) => (
                <div key={title} className={`flex gap-3 sm:gap-4 p-3 sm:p-4 rounded-2xl border ${done ? 'border-primary/25 bg-primary-container/10' : 'border-outline-variant/20 bg-surface-container/30'}`}>
                  <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${done ? 'bg-primary/15' : 'bg-surface-container'}`}>
                    <span className={`material-symbols-outlined text-xl ${done ? 'text-primary' : 'text-on-surface-variant'}`} style={{ fontVariationSettings: done ? "'FILL' 1" : "'FILL' 0" }}>{done ? 'check_circle' : icon}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-bold mb-0.5 ${done ? 'text-primary' : 'text-on-surface'}`}>{title}</p>
                    <p className="text-xs text-on-surface-variant/70 leading-snug">{desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-auto pt-4">
              <button
                onClick={handleStart}
                disabled={checkingProfilePic}
                className="w-full py-4 rounded-2xl bg-primary text-on-primary font-bold text-sm uppercase tracking-widest hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {checkingProfilePic ? (
                  <>
                    <span className="w-4 h-4 border-2 border-on-primary/40 border-t-on-primary rounded-full animate-spin" />
                    Checking profile…
                  </>
                ) : (
                  <>Start verification →</>
                )}
              </button>
              <p className="text-center text-[11px] text-on-surface-variant/40 mt-3 leading-relaxed">
                Your photos are processed securely and never stored beyond your session.
              </p>
            </div>
          </div>
        )}

        {/* ── Phase: upload (profile picture) ── */}
        {phase === 'upload' && (
          <div className="flex-1 flex flex-col">
            <div className="mb-5">
              <h3 className="font-headline text-xl font-bold text-on-surface mb-1">Pick your profile picture</h3>
              <p className="text-sm text-on-surface-variant">A clear, recent photo of you. You'll crop it next, then we'll match it against your live selfie.</p>
            </div>

            {!pickedPreview ? (
              <label className="flex-1 flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-outline-variant/30 bg-surface-container/30 hover:bg-surface-container/50 cursor-pointer transition-all py-12 px-6">
                <div className="w-16 h-16 rounded-2xl bg-primary-container flex items-center justify-center">
                  <span className="material-symbols-outlined text-primary text-3xl">add_photo_alternate</span>
                </div>
                <div className="text-center">
                  <p className="text-sm font-bold text-on-surface mb-1">Choose a photo</p>
                  <p className="text-xs text-on-surface-variant/70">JPG or PNG · under 20MB</p>
                </div>
                <input type="file" accept="image/*" className="sr-only" onChange={handlePickFile} />
              </label>
            ) : (
              <div className="flex flex-col items-center gap-3 mb-2">
                <div className="w-44 h-44 rounded-full overflow-hidden bg-surface-container">
                  <img src={pickedPreview} alt="Your profile picture" className="w-full h-full object-cover" />
                </div>
                <button
                  type="button"
                  onClick={() => setShowCrop(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-outline-variant/30 text-xs font-bold text-on-surface-variant hover:bg-surface-container transition-all"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>crop</span>
                  Adjust crop
                </button>
              </div>
            )}

            {uploadError && (
              <p className="text-sm text-error bg-error/10 border border-error/20 rounded-xl px-4 py-3 mt-4">{uploadError}</p>
            )}

            {/* Stacked on mobile: side by side, the secondary button gets ~114px at
                375px and "Different photo" plus its icon needs more than that, so the
                label overflowed its pill. Row again from sm up. */}
            <div className="flex flex-col sm:flex-row gap-3 mt-auto pt-5">
              {!pickedPreview ? (
                <button
                  onClick={() => setPhase('intro')}
                  className="w-full sm:flex-1 py-3 rounded-xl border border-outline-variant/30 text-sm font-bold text-on-surface-variant hover:bg-surface-container transition-all"
                >
                  Back
                </button>
              ) : (
                <>
                  <label className="w-full sm:flex-1 py-3 rounded-xl border border-outline-variant/30 text-sm font-bold text-on-surface-variant hover:bg-surface-container transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap">
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>refresh</span>
                    Different photo
                    <input type="file" accept="image/*" className="sr-only" onChange={handlePickFile} />
                  </label>
                  <button
                    onClick={handleConfirmPhoto}
                    disabled={uploading}
                    className="w-full sm:flex-[2] py-3 rounded-xl bg-primary text-on-primary text-sm font-bold uppercase tracking-wider sm:tracking-widest hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-40 flex items-center justify-center gap-2 whitespace-nowrap"
                  >
                    {uploading ? (
                      <>
                        <span className="w-4 h-4 border-2 border-on-primary/40 border-t-on-primary rounded-full animate-spin" />
                        Uploading…
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined" style={{ fontSize: 16, fontVariationSettings: "'FILL' 1" }}>check</span>
                        Use this photo
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* ── Phase: starting (opening the Rekognition session) ── */}
        {phase === 'starting' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-5 py-16">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-on-surface-variant">Preparing your liveness check…</p>
          </div>
        )}

        {/* ── Phase: liveness ── */}
        {phase === 'liveness' && liveness && (
          <div className="flex-1 flex flex-col">
            <div className="mb-4">
              <h3 className="font-headline text-xl font-bold text-on-surface mb-1">Liveness check</h3>
              <p className="text-sm text-on-surface-variant">
                Follow the on-screen prompts. This confirms a real person is in front of the
                camera — a photo or a video won't pass.
              </p>
            </div>

            {/* The colour flashing is the light challenge, not a glitch: Rekognition reads
                the light reflecting off a real face, which is what catches a photo or a
                screen held up to the camera. Users read it as a bug unless we say so
                first, so this note is load-bearing — don't drop it to tidy the layout. */}
            <div className="flex gap-3 p-3 sm:p-3.5 mb-5 rounded-2xl border border-primary/25 bg-primary-container/10">
              <span
                className="material-symbols-outlined text-primary flex-shrink-0"
                style={{ fontSize: 20, fontVariationSettings: "'FILL' 1" }}
                aria-hidden="true"
              >
                lightbulb
              </span>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                <span className="font-bold text-on-surface">Your screen will flash bright colours.</span>{' '}
                That's the check working — we read the light reflecting off your face, which is
                what a photo or a screen can't fake. Skip it if you're photosensitive.
              </p>
            </div>

            <Suspense fallback={
              <div className="flex flex-col items-center justify-center gap-4 py-16">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-on-surface-variant">Loading camera check…</p>
                <p className="text-xs text-on-surface-variant/50 max-w-[15rem] text-center leading-relaxed">
                  First run downloads the on-device face model, so this one takes a moment.
                </p>
              </div>
            }>
              <LivenessCheck
                sessionId={liveness.sessionId}
                region={liveness.region}
                credentials={liveness.credentials}
                onComplete={handleSubmit}
                onCancel={() => setPhase('intro')}
                onError={(err) => {
                  console.error('[verify] liveness detector error:', err);
                  setFailReason('liveness_failed');
                  setPhase('failed');
                }}
              />
            </Suspense>
          </div>
        )}


        {/* ── Phase: submitting ── */}
        {phase === 'submitting' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-6 py-12">
            <div className="relative w-20 h-20">
              <div className="absolute inset-0 w-20 h-20 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <div className="absolute inset-3 flex items-center justify-center">
                <span className="material-symbols-outlined text-primary" style={{ fontSize: 24, fontVariationSettings: "'FILL' 1" }}>face</span>
              </div>
            </div>
            <div className="text-center">
              <p className="font-headline text-lg font-bold text-on-surface mb-1">Analysing…</p>
              <p className="text-sm text-on-surface-variant">Comparing faces and checking gender. This takes a few seconds.</p>
            </div>
          </div>
        )}

        {/* ── Phase: success ── */}
        {phase === 'success' && (
          <div className="flex-1 flex flex-col items-center gap-5 py-8 text-center overflow-y-auto">
            <div className="w-20 h-20 rounded-2xl bg-primary-container flex items-center justify-center shadow-glow flex-shrink-0">
              <span className="material-symbols-outlined text-primary" style={{ fontSize: 40, fontVariationSettings: "'FILL' 1" }}>verified</span>
            </div>

            <div>
              <h3 className="font-headline text-2xl font-bold text-on-surface mb-2">You're in.</h3>
              {memberCount > 0 && profile?.city ? (
                <p className="text-sm text-on-surface leading-relaxed max-w-xs mx-auto">
                  You're joining <span className="font-bold text-primary">{memberCount}</span> verified {memberCount === 1 ? 'woman' : 'women'} in {profile.city} — welcome.
                </p>
              ) : (
                <p className="text-sm text-on-surface-variant leading-relaxed max-w-xs mx-auto">
                  Welcome to Afterhours. Full access unlocked.
                </p>
              )}
            </div>

            {nearbyEvents.length > 0 && (
              <div className="w-full max-w-xs text-left bg-surface-container rounded-2xl border border-outline-variant/30 p-4 space-y-3">
                <p className="text-[10px] font-bold tracking-widest uppercase text-on-surface-variant/60">Happening near you</p>
                {nearbyEvents.map((ev) => {
                  const d = new Date(ev.starts_at);
                  const dateStr = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                  return (
                    <div key={ev.id} className="flex items-start gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-on-surface truncate">{ev.title}</p>
                        <p className="text-xs text-on-surface-variant mt-0.5">{dateStr}{ev.venue ? ` · ${ev.venue}` : ''}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <button
              onClick={onClose}
              className="w-full max-w-xs py-4 rounded-2xl bg-primary text-on-primary font-bold text-sm uppercase tracking-widest hover:brightness-110 active:scale-[0.98] transition-all flex-shrink-0"
            >
              Start exploring →
            </button>
          </div>
        )}

        {/* ── Phase: failed ── */}
        {phase === 'failed' && (
          <div className="flex-1 flex flex-col">
            <div className="flex items-center gap-3 mb-6 p-4 rounded-xl bg-error/10 border border-error/20">
              <span className="material-symbols-outlined text-error flex-shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>error</span>
              <p className="text-sm text-on-surface leading-snug">
                {submitError || REASON_MESSAGES[failReason] || REASON_MESSAGES.server_error}
              </p>
            </div>

            <div className="space-y-3 mt-auto">
              {/* Allow retry for most failure reasons */}
              {failReason !== 'gender_check_failed' && (
                <button
                  onClick={() => {
                    // If the failure was about the profile picture itself, send them back to
                    // re-upload. Otherwise open a fresh liveness session — sessions are
                    // single-use, so retrying always means starting a new one.
                    const backToUpload = failReason === 'no_profile_picture'
                      || failReason === 'profile_pic_fetch_failed'
                      || failReason === 'no_face_detected';
                    setFailReason('');
                    setSubmitError('');
                    setLiveness(null);
                    if (backToUpload) setPhase('upload');
                    else beginLiveness();
                  }}
                  className="w-full py-3.5 rounded-2xl bg-primary text-on-primary text-sm font-bold uppercase tracking-widest hover:brightness-110 active:scale-[0.98] transition-all"
                >
                  Try again
                </button>
              )}
              <button
                onClick={onClose}
                className="w-full py-3 rounded-xl border border-outline-variant/30 text-sm font-bold text-on-surface-variant hover:bg-surface-container transition-all"
              >
                {failReason === 'gender_check_failed' ? 'Close' : 'Cancel'}
              </button>
              <p className="text-center text-xs text-on-surface-variant/50 leading-relaxed">
                Think this is a mistake?{' '}
                <a href="mailto:team@joinafterhours.in?subject=Verification%20help" className="text-primary underline">Email team@joinafterhours.in</a>
              </p>
            </div>
          </div>
        )}
      </div>

      {showCrop && originalSrc && (
        <AvatarCropModal
          src={originalSrc}
          onSave={handleCropSave}
          onCancel={handleCropCancel}
        />
      )}
    </div>
  );
}
