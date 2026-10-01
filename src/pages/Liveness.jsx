/**
 * Liveness.jsx — route: /liveness
 *
 * Standalone liveness page opened by the Expo app in SFSafariViewController /
 * Chrome Custom Tabs. AWS ships no React Native FaceLivenessDetector, so the app
 * hands the challenge off to this page and takes the result back afterwards.
 *
 * URL shape:  /liveness#s=<sessionId>&t=<oneTimeToken>
 *
 * The token lives in the fragment, not the query string, so it never reaches a
 * server access log or a Referer header. It is single-use and expires with the
 * session, and it only yields credentials for a session already bound server-side
 * to the user who started it.
 *
 * This page deliberately does NOT decide the outcome. When the challenge ends it
 * bounces back to the app, and the app asks the edge function what actually
 * happened. Nothing a tampered page could claim here changes the verdict.
 */
import { useEffect, useState } from 'react';
import LivenessCheck from '../components/LivenessCheck';
import { exchangeHandoffToken } from '../services/verification.service';

const APP_RETURN_SCHEME = 'afterhours://verify-liveness';

// Android package id, for the intent:// form below. Must match `android.package`
// in Afterhours-App-main/app.json.
const ANDROID_PACKAGE = 'com.joinafterhours.app';

const IS_ANDROID = /android/i.test(navigator.userAgent);

// Chrome Custom Tabs will not launch a bare custom scheme from a script-initiated
// navigation with no user gesture, and the navigation below runs from
// onAnalysisComplete — an async callback, so there is no gesture to inherit. The
// result was that the challenge finished, the app never heard about it, and both
// sides sat on a spinner. The intent:// form names the target package, which
// Chrome resolves straight to the installed app.
function appReturnUrl(outcome) {
  return IS_ANDROID
    ? `intent://verify-liveness?status=${outcome}#Intent;scheme=afterhours;package=${ANDROID_PACKAGE};end`
    : `${APP_RETURN_SCHEME}?status=${outcome}`;
}

function parseFragment() {
  const raw = window.location.hash.replace(/^#/, '');
  const params = new URLSearchParams(raw);
  return { sessionId: params.get('s') || '', token: params.get('t') || '' };
}

export default function Liveness() {
  const [status, setStatus] = useState('loading'); // loading | ready | done | error
  const [session, setSession] = useState(null);
  const [errorText, setErrorText] = useState('');
  // Which outcome we're handing back, so the button below carries the same one
  // the automatic navigation tried.
  const [outcome, setOutcome] = useState('done');

  useEffect(() => {
    const { sessionId, token } = parseFragment();
    if (!sessionId || !token) {
      setErrorText('This link is missing information. Start verification again from the app.');
      setStatus('error');
      return;
    }

    // Clear the token from the address bar as soon as we've read it, so it isn't
    // sitting in browser history or visible if the user shares their screen.
    window.history.replaceState(null, '', window.location.pathname);

    let cancelled = false;
    exchangeHandoffToken(sessionId, token)
      .then((data) => {
        if (cancelled) return;
        setSession({ sessionId, region: data.region, credentials: data.credentials });
        setStatus('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        setErrorText(
          err.message === 'invalid_handoff'
            ? 'This verification link has expired or was already used. Start again from the app.'
            : 'We could not start the check. Please try again from the app.',
        );
        setStatus('error');
      });
    return () => { cancelled = true; };
  }, []);

  // Hand control back to the app. The app already holds the session id, so the
  // return trip carries no result — only the fact that the challenge is over.
  function returnToApp(nextOutcome) {
    setOutcome(nextOutcome);
    setStatus('done');
    window.location.href = appReturnUrl(nextOutcome);
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-5 py-10">
      <div className="w-full max-w-md">

        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-primary-container flex items-center justify-center mx-auto mb-4">
            <span className="material-symbols-outlined text-primary" style={{ fontSize: 24, fontVariationSettings: "'FILL' 1" }}>
              verified_user
            </span>
          </div>
          <h1 className="font-headline text-xl font-bold text-on-surface mb-1">Liveness check</h1>
          <p className="text-sm text-on-surface-variant">
            This confirms you're really here — not a photo or a video.
          </p>
        </div>

        {status === 'loading' && (
          <div className="flex flex-col items-center gap-4 py-16">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-on-surface-variant">Setting up your camera…</p>
          </div>
        )}

        {status === 'ready' && session && (
          <>
            {/* Same note as VerificationModal: the colour flashing is the light
                challenge, and it reads as a glitch unless we name it first. */}
            <div className="flex gap-3 p-3.5 mb-5 rounded-2xl border border-primary/25 bg-primary-container/10 text-left">
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
            <LivenessCheck
              sessionId={session.sessionId}
              region={session.region}
              credentials={session.credentials}
              onComplete={() => returnToApp('done')}
              onCancel={() => returnToApp('cancelled')}
              onError={() => returnToApp('error')}
            />
          </>
        )}

        {status === 'done' && (
          <div className="flex flex-col items-center gap-5 py-12 text-center">
            <div className="w-14 h-14 rounded-2xl bg-primary-container flex items-center justify-center">
              <span className="material-symbols-outlined text-primary text-2xl">check</span>
            </div>
            <p className="text-sm text-on-surface leading-relaxed max-w-xs">
              That's the check done. Tap below to finish up in the app.
            </p>
            {/* This button is the route back, not a fallback. The navigation in
                returnToApp is a best-effort head start; on Android it is routinely
                declined, and only a real tap carries the user gesture Chrome wants
                before it will hand off to another app. Do not demote this to a
                small link under a spinner — that is what stranded people here. */}
            <a
              href={appReturnUrl(outcome)}
              className="w-full px-5 py-3.5 rounded-xl bg-primary text-on-primary text-sm font-bold uppercase tracking-widest"
            >
              Back to Afterhours
            </a>
          </div>
        )}

        {status === 'error' && (
          <div className="flex flex-col items-center gap-5 py-12 text-center">
            <div className="w-14 h-14 rounded-2xl bg-error/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-error text-2xl">error</span>
            </div>
            <p className="text-sm text-on-surface leading-relaxed max-w-xs">{errorText}</p>
            <a
              href={appReturnUrl('error')}
              className="px-5 py-3 rounded-xl bg-primary text-on-primary text-sm font-bold uppercase tracking-widest"
            >
              Back to Afterhours
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
