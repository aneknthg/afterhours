import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';

const APP_STORE_URL = 'https://apps.apple.com/app/id6784980049';
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.joinafterhours.app';
const DISMISSED_KEY = 'afterhours_get_app_dismissed';

function mobilePlatform() {
  const ua = navigator.userAgent || '';
  if (/android/i.test(ua)) return 'android';
  // iPadOS reports itself as a Mac; the touch check tells the two apart.
  if (/iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
  return null;
}

function wasDismissed() {
  try { return sessionStorage.getItem(DISMISSED_KEY) === '1'; } catch { return false; }
}

/**
 * Shown on a phone viewing an event page. Anyone who reached the web page on a
 * phone almost certainly does not have the app, since an installed app opens
 * /event links itself. Before leaving for the store it parks the event with
 * the deferred-link function (and, on Android, in the Play referrer), so the
 * app opens on this event once she has signed up and onboarded.
 */
export default function GetAppSheet({ eventId }) {
  const [platform] = useState(mobilePlatform);
  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (!platform || wasDismissed()) return;
    // Let the event render first so the sheet reads as an offer, not a wall.
    const t = setTimeout(() => setOpen(true), 1200);
    return () => clearTimeout(t);
  }, [platform]);

  if (!open) return null;

  function dismiss() {
    try { sessionStorage.setItem(DISMISSED_KEY, '1'); } catch {}
    setOpen(false);
  }

  async function getApp() {
    setLeaving(true);
    const storeUrl = platform === 'android'
      ? `${PLAY_STORE_URL}&referrer=${encodeURIComponent(`event=${eventId}`)}`
      : APP_STORE_URL;
    // Parking is best effort: a slow network must not hold her on this page.
    await Promise.race([
      supabase.functions
        .invoke('deferred-link', { body: { action: 'park', platform, event_id: String(eventId) } })
        .catch(() => {}),
      new Promise((resolve) => setTimeout(resolve, 1500)),
    ]);
    window.location.href = storeUrl;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[500] flex items-end justify-center bg-background/70 backdrop-blur-md"
      onClick={dismiss}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="get-app-title"
        className="w-full max-w-md bg-surface-container-low border-t border-outline-variant/20 rounded-t-3xl px-6 pt-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-2xl shadow-black/50"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-4">
          <img src="/favicon-512.png" alt="" className="w-12 h-12 rounded-2xl flex-shrink-0" />
          <div className="min-w-0">
            <p id="get-app-title" className="font-headline text-lg font-semibold text-on-surface leading-snug">
              Join this event in the app
            </p>
            <p className="text-sm text-on-surface-variant mt-1 leading-relaxed">
              Sign up in the Afterhours app and it opens this event for you when you're done.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={getApp}
          disabled={leaving}
          className="mt-6 w-full rounded-full bg-primary text-on-primary font-semibold py-3.5 active:scale-[0.98] transition-transform disabled:opacity-70"
        >
          {leaving ? 'Opening…' : platform === 'android' ? 'Get it on Google Play' : 'Get it on the App Store'}
        </button>
        <button
          type="button"
          onClick={dismiss}
          className="mt-2 w-full rounded-full py-3 text-sm text-on-surface-variant hover:text-on-surface transition-colors"
        >
          Continue on the website
        </button>
      </div>
    </div>,
    document.body,
  );
}
