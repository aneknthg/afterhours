import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { isAtLeast18, maxEligibleBirthDateISO } from '../lib/age';
import CityPicker from '../components/CityPicker';
import { canonicalCity } from '../lib/city';
import { chosenName, isEmailPrefixName, needsOnboarding } from '../lib/onboarding';
import { isVerified } from '../lib/verification';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';

const VerificationModal = lazy(() => import('../components/VerificationModal'));

// Two screens, same as the app: who she is (name, date of birth, city) in one
// save, then verification, which she can skip. The old five steps also asked
// why she was here (written, never read), her interests (now asked for from
// Discover) and showed "matches" from a demo list that is empty, and saved
// nothing until the last one, so quitting midway lost everything.
const TOTAL_STEPS = 2;

// The app's step pill, so both say the same thing in the same shape. The old
// five-label progress bar wrapped to three rows on a phone.
function StepPill({ step }) {
  return (
    <div className="mb-8">
      <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-primary/15 text-primary text-[11px] font-bold tracking-wide">
        Step {step} of {TOTAL_STEPS}
      </span>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────
export default function Onboarding() {
  const { user, profile, updateProfile } = useAuth();
  const navigate          = useNavigate();

  const [step, setStep]               = useState(1);
  const [name, setName]               = useState('');
  const [nameTouched, setNameTouched] = useState(false);
  const [dob, setDob]                 = useState('');
  const [city, setCity]               = useState('');
  const [country, setCountry]         = useState('');
  const [errors, setErrors]           = useState({});
  const [saving, setSaving]           = useState(false);
  const [saveError, setSaveError]     = useState('');
  const [verifyOpen, setVerifyOpen]     = useState(false);
  const [verifyFailed, setVerifyFailed] = useState(false);

  // Step 0: woman-identity declaration. Email signups already agreed on the form;
  // OAuth (Google) signups confirm it here before anything else.
  const [communityAgreed, setCommunityAgreed]   = useState(false);
  const [communityError, setCommunityError]     = useState('');
  const [communitySaving, setCommunitySaving]   = useState(false);
  const [communityDone, setCommunityDone]       = useState(false);

  // Seed the editable name from the Google name, never from her email prefix:
  // accounts made before 20261001 were given one as a name, and prefilling it
  // is how it ended up public.
  useEffect(() => {
    if (nameTouched) return;
    const seed =
      chosenName(profile?.display_name, user?.email) ||
      chosenName(user?.user_metadata?.display_name || user?.user_metadata?.full_name, user?.email);
    if (seed) setName(seed);
  }, [profile?.display_name, user, nameTouched]);

  // Hydrate from any details the account already has, so a returning/incomplete
  // user only fills what's missing. Runs once, when the profile first arrives,
  // and never clobbers edits made this session (guarded by hydratedRef).
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (hydratedRef.current || !profile) return;
    hydratedRef.current = true;
    if (profile.date_of_birth) setDob(profile.date_of_birth);
    if (canonicalCity(profile.city)) setCity(canonicalCity(profile.city));
    if (profile.country) setCountry(profile.country);
    // Everything on file already: she came here to verify.
    if (!needsOnboarding(profile, user?.email)) {
      if (isVerified(profile)) navigate('/', { replace: true });
      else setStep(2);
    }
  }, [profile, user, navigate]);

  // Validate all three, save them together, then verify. Errors sit under the
  // field they belong to.
  async function handleContinueFromAbout() {
    const next = {};
    if (!name.trim()) next.name = 'Please enter your name.';
    else if (isEmailPrefixName(name, user?.email)) next.name = 'Use the name you go by, not your email address.';
    if (!dob) next.dob = 'Please enter your date of birth.';
    else if (!isAtLeast18(dob)) next.dob = 'You must be 18 or older to join Afterhours.';
    // Canonical only — a locality or typo here matches no events, no people
    // and no search results, with nothing on screen explaining the empty app.
    const canonical = canonicalCity(city);
    if (!canonical) next.city = 'Please choose your city from the list.';
    setErrors(next);
    setSaveError('');
    const first = ['name', 'dob', 'city'].find((f) => next[f]);
    if (first) {
      document.getElementById(`onb-${first}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    setSaving(true);
    try {
      // updateProfile refreshes AuthContext's cached profile too — otherwise
      // RootRedirect/ProtectedRoute would still see an incomplete profile and
      // bounce her back here.
      await updateProfile({
        display_name:  name.trim(),
        date_of_birth: dob,
        city:          canonical,
        ...(country.trim() ? { country: country.trim() } : {}),
      });
    } catch (err) {
      console.error('Onboarding save failed:', err);
      setSaveError(err?.message || 'Could not save your profile. Check your connection and try again.');
      setSaving(false);
      return;
    }
    setSaving(false);
    // A verified member only lands here to fill a gap; never ask her to verify again.
    if (isVerified(profile)) navigate('/');
    else setStep(2);
  }

  async function handleConfirmCommunity() {
    if (!communityAgreed) {
      setCommunityError('Please confirm you identify as a woman and accept the Terms and Privacy Policy to join.');
      return;
    }
    setCommunityError('');
    setCommunitySaving(true);
    try {
      await updateProfile({ community_guidelines_accepted: true });
      setCommunityDone(true);
    } catch {
      setCommunityError('Could not save. Please try again.');
    } finally {
      setCommunitySaving(false);
    }
  }

  // Done: RootRedirect sends her to a parked shared event, or Discover.
  function finish() { navigate('/'); }

  function startVerification() {
    setVerifyFailed(false);
    setVerifyOpen(true);
  }
  function handleVerified() {
    setVerifyOpen(false);
    setVerifyFailed(false);
    finish();
  }
  function handleCloseVerification() {
    setVerifyOpen(false);
    // If onVerified raced ahead of close (success → close), advance.
    if (profile?.verification_status === 'verified') { finish(); return; }
    setVerifyFailed(true);
  }
  function skipVerification() {
    setVerifyOpen(false);
    setVerifyFailed(false);
    finish();
  }

  const glow = (
    <div className="fixed top-1/4 left-1/2 -translate-x-1/2 w-[520px] h-[300px] bg-primary-container/15 blur-[130px] rounded-full pointer-events-none" />
  );

  // ── Step 0: Women-only declaration ────────────────────────────────────────
  // Gate everyone who hasn't accepted yet (chiefly Google signups; email signups
  // are marked accepted at signup). Wait for the profile to load so returning
  // users who already accepted don't see a flash of this screen.
  const communityAccepted = communityDone || profile?.community_guidelines_accepted;
  if (profile && !communityAccepted) {
    return (
      <div className="min-h-screen flex flex-col px-6 py-12 max-w-2xl mx-auto relative">
        {glow}
        <div className="relative flex-1 flex flex-col">
          <div className="w-14 h-14 bg-primary-container rounded-2xl flex items-center justify-center mb-6">
            <span className="material-symbols-outlined text-primary text-3xl">favorite</span>
          </div>

          <div className="mb-8">
            <h1 className="font-headline text-3xl md:text-4xl font-bold text-on-surface mb-3 leading-tight">
              Afterhours is for women.
            </h1>
            <p className="text-on-surface-variant text-base leading-relaxed">
              This is a women-only space. Before you continue, please confirm this is you.
            </p>
          </div>

          <div className="flex-1">
            <label className="flex items-start gap-3 cursor-pointer group p-4 rounded-2xl border border-outline-variant/20 bg-surface-container/30">
              <div className="relative flex-shrink-0 mt-0.5">
                <input
                  type="checkbox"
                  checked={communityAgreed}
                  onChange={(e) => { setCommunityAgreed(e.target.checked); setCommunityError(''); }}
                  className="sr-only"
                />
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                  communityAgreed ? 'bg-primary border-primary' : 'border-outline-variant/50 group-hover:border-primary/50'
                }`}>
                  {communityAgreed && <span className="material-symbols-outlined text-on-primary" style={{ fontSize: 14 }}>check</span>}
                </div>
              </div>
              <span className="text-sm text-on-surface-variant leading-relaxed">
                Afterhours is a community for{' '}
                <span className="text-on-surface font-semibold">women</span>.
                I confirm I identify as a woman, agree to keep this a respectful space for everyone,
                and accept the{' '}
                <Link to="/terms" onClick={(e) => e.stopPropagation()} className="text-on-surface underline underline-offset-2 hover:text-primary transition-colors">Terms</Link>
                {' '}and{' '}
                <Link to="/privacy" onClick={(e) => e.stopPropagation()} className="text-on-surface underline underline-offset-2 hover:text-primary transition-colors">Privacy Policy</Link>.
              </span>
            </label>

            {communityError && (
              <div className="flex items-center gap-2 mt-4 px-4 py-3 rounded-xl bg-error/10 border border-error/25" role="alert">
                <span className="material-symbols-outlined text-error text-sm flex-shrink-0">error</span>
                <p className="text-sm text-error">{communityError}</p>
              </div>
            )}
          </div>

          <div className="sticky bottom-0 pt-6 pb-8 mt-8 bg-gradient-to-t from-background via-background/90 to-transparent">
            <Button variant="primary" size="lg" fullWidth disabled={communitySaving} onClick={handleConfirmCommunity}>
              {communitySaving ? 'Saving…' : 'Continue →'}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Step 1: About you (name, date of birth, city) ─────────────────────────
  if (step === 1) {
    return (
      <div className="min-h-screen flex flex-col px-6 py-12 max-w-2xl mx-auto relative">
        {glow}
        <div className="relative flex-1 flex flex-col">
          <StepPill step={1} />

          <div className="mb-8">
            <h1 className="font-headline text-3xl md:text-4xl font-bold text-on-surface mb-3 leading-tight">
              Let's get to know you.
            </h1>
            <p className="text-on-surface-variant text-base leading-relaxed">
              The name other women will see, your date of birth, and where we should look for events.
            </p>
          </div>

          <div className="flex-1 space-y-5">
            <div id="onb-name">
              <Input
                label="Your name" type="text" icon="person"
                placeholder="How others will see you"
                value={name}
                onChange={(e) => { setName(e.target.value); setNameTouched(true); setErrors((x) => ({ ...x, name: undefined })); }}
                error={errors.name}
                autoComplete="name" required
              />
            </div>
            <div id="onb-dob">
              <Input
                label="Date of birth" type="date" icon="calendar_month"
                value={dob}
                onChange={(e) => { setDob(e.target.value); setErrors((x) => ({ ...x, dob: undefined })); }}
                max={maxEligibleBirthDateISO()}
                hint="You must be 18 or older to join."
                error={errors.dob}
                autoComplete="bday" required
              />
            </div>
            <div id="onb-city">
              <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2">
                Where are you based?
              </p>
              <CityPicker
                value={city}
                placeholder="Search for your city…"
                onChange={({ city: c, country: co }) => {
                  setCity(c);
                  if (co) setCountry(co);
                  setErrors((x) => ({ ...x, city: undefined }));
                }}
              />
              {errors.city
                ? <p className="text-xs text-error mt-2" role="alert">{errors.city}</p>
                : <p className="text-xs text-on-surface-variant/60 mt-2">We use this to show you events nearby. Change it anytime in your profile.</p>}
            </div>
            {saveError && (
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-error/10 border border-error/25" role="alert">
                <span className="material-symbols-outlined text-error text-sm flex-shrink-0">error</span>
                <p className="text-sm text-error">{saveError}</p>
              </div>
            )}
          </div>

          <div className="sticky bottom-0 pt-6 pb-8 mt-8 bg-gradient-to-t from-background via-background/90 to-transparent">
            <Button variant="primary" size="lg" fullWidth disabled={saving} onClick={handleContinueFromAbout}>
              {saving ? 'Saving…' : 'Continue →'}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Step 2: Verify identity (skippable) ───────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col px-6 py-12 max-w-2xl mx-auto relative">
      {glow}
      <div className="relative flex-1 flex flex-col">
        <StepPill step={2} />

        {!verifyFailed ? (
          // Intro
          <>
            <div className="mb-8">
              <h1 className="font-headline text-3xl md:text-4xl font-bold text-on-surface mb-3 leading-tight">
                This is what keeps every event here safe.
              </h1>
              <p className="text-on-surface-variant text-base leading-relaxed">
                Every woman you'll meet here did this exact 30-second step first.
              </p>
            </div>

            <div className="flex-1 space-y-3">
              {[
                { icon: 'photo_camera', title: 'Profile picture',   desc: 'A clear photo of your face from your device.' },
                { icon: 'face',         title: 'Live selfie',       desc: 'A quick selfie so we can match your face.' },
                { icon: 'verified',     title: 'Instant check',     desc: 'We verify in seconds. Private, never stored.' },
              ].map(({ icon, title, desc }) => (
                <div key={title} className="flex gap-4 p-4 rounded-2xl border border-outline-variant/20 bg-surface-container/30">
                  <div className="w-10 h-10 rounded-xl bg-surface-container flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined text-on-surface-variant text-xl">{icon}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-on-surface mb-0.5">{title}</p>
                    <p className="text-xs text-on-surface-variant/70 leading-snug">{desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="sticky bottom-0 pt-6 pb-8 mt-8 bg-gradient-to-t from-background via-background/90 to-transparent">
              <div className="flex gap-3">
                <Button variant="secondary" size="lg" onClick={() => setStep(1)} className="px-5">Back</Button>
                <Button variant="primary" size="lg" fullWidth onClick={startVerification}>
                  Verify now →
                </Button>
              </div>
              {/* Was 12px at 40% alpha: the only way past this screen without
                  a camera, and close to invisible. */}
              <button onClick={skipVerification} className="w-full min-h-[44px] text-center mt-2 text-sm text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer">
                Continue with limited access
              </button>
            </div>
          </>
        ) : (
          // Failure / not-completed
          <>
            <div className="mb-8 flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-error/10 flex items-center justify-center flex-shrink-0">
                <span className="material-symbols-outlined text-error text-2xl">error</span>
              </div>
              <div>
                <h1 className="font-headline text-2xl md:text-3xl font-bold text-on-surface mb-2 leading-tight">
                  Verification not completed
                </h1>
                <p className="text-on-surface-variant text-sm leading-relaxed">
                  You can try again, or continue with limited access for now. Verify any time from your profile.
                </p>
              </div>
            </div>

            <div className="flex-1 p-4 rounded-2xl border border-outline-variant/20 bg-surface-container/30">
              <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2">Limited access means</p>
              <ul className="space-y-1.5 text-sm text-on-surface-variant/80">
                <li className="flex items-start gap-2">
                  <span className="material-symbols-outlined text-primary mt-0.5" style={{ fontSize: 16 }}>check</span>
                  Browse events and explore Discover
                </li>
                <li className="flex items-start gap-2">
                  <span className="material-symbols-outlined text-on-surface-variant/50 mt-0.5" style={{ fontSize: 16 }}>lock</span>
                  RSVP, connections, and chat stay locked until verified
                </li>
              </ul>
            </div>

            <div className="sticky bottom-0 pt-6 pb-8 mt-8 bg-gradient-to-t from-background via-background/90 to-transparent">
              <div className="flex flex-col gap-2.5">
                <Button variant="primary" size="lg" fullWidth onClick={startVerification}>
                  Try again
                </Button>
                <Button variant="secondary" size="lg" fullWidth onClick={skipVerification}>
                  Continue with limited access
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      {verifyOpen && (
        <Suspense fallback={null}>
          <VerificationModal onClose={handleCloseVerification} onVerified={handleVerified} />
        </Suspense>
      )}
    </div>
  );
}
