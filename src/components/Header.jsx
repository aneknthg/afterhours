import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { useSearch } from '../lib/SearchContext';
import { supabase } from '../lib/supabase';
import { notificationsService } from '../services/notifications.service';
import { NOTIFICATIONS_READ_EVENT } from '../lib/notifications.helpers';
import { useToast } from './Toast';
import NotificationsPopover from './NotificationsPopover';
import PrivacyModal from './PrivacyModal';
import { avatarBg, getInitials } from '../lib/avatar';

const NAV_LINKS = [
  { path: '/discover',  label: 'Discover' },
  { path: '/my-events', label: 'My Events' },
  { path: '/create',    label: 'Create' },
];

// ─── Profile popout menu ──────────────────────────────────────────────────────
function ProfileMenu({ onClose }) {
  const { user, profile, signOut, updateProfile } = useAuth();
  const navigate  = useNavigate();
  const menuRef   = useRef(null);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [signingOut, setSigningOut]   = useState(false);

  const displayName = profile?.display_name || user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'User';
  const email       = user?.email || '';

  // Close on outside click
  useEffect(() => {
    function handleOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) onClose();
    }
    const id = setTimeout(() => document.addEventListener('mousedown', handleOutside), 10);
    return () => { clearTimeout(id); document.removeEventListener('mousedown', handleOutside); };
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    function handleKey(e) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut();
      navigate('/');
      onClose();
    } catch {
      setSigningOut(false);
    }
  }

  return (
    <>
      {!showPrivacy && (
      <div
        ref={menuRef}
        className="absolute right-0 top-[calc(100%+10px)] w-64 bg-surface-container-low border border-outline-variant/20 rounded-2xl shadow-2xl shadow-black/40 overflow-hidden z-[200] animate-[fadeIn_0.15s_ease]"
      >
        {/* User info — click to go to own profile */}
        <button
          onClick={() => { navigate('/profile'); onClose(); }}
          className="w-full flex items-center gap-3 px-4 py-4 border-b border-outline-variant/15 hover:bg-surface-container transition-colors text-left"
        >
          <div className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center ${avatarBg(displayName)}`}>
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
            ) : (
              <span className="text-sm font-bold text-white">{getInitials(displayName)}</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-on-surface truncate">{displayName}</p>
            <p className="text-xs text-on-surface-variant truncate">{email}</p>
          </div>
          <span className="material-symbols-outlined text-on-surface-variant/40 flex-shrink-0" style={{ fontSize: 16 }}>chevron_right</span>
        </button>

        {/* Privacy */}
        <div className="py-1.5 border-b border-outline-variant/15">
          <button
            onClick={() => setShowPrivacy(true)}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-on-surface hover:bg-surface-container transition-colors text-left"
          >
            <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: 18 }}>lock</span>
            <span className="flex-1">Privacy</span>
            <span className="material-symbols-outlined text-on-surface-variant/40" style={{ fontSize: 16 }}>chevron_right</span>
          </button>
        </div>

        {/* Sign out */}
        <div className="py-1.5">
          <button
            onClick={handleSignOut}
            disabled={signingOut}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-error hover:bg-error-container/10 transition-colors text-left disabled:opacity-50"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>logout</span>
            {signingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      </div>
      )}

      {showPrivacy && (
        <PrivacyModal
          onClose={() => { setShowPrivacy(false); onClose(); }}
          profile={profile}
          updateProfile={updateProfile}
        />
      )}
    </>
  );
}

// ─── Header ───────────────────────────────────────────────────────────────────
export default function Header() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { user, profile } = useAuth();
  const { setSearchOpen } = useSearch();
  const showToast = useToast();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [notifCount, setNotifCount] = useState(0);
  const [notifOpen, setNotifOpen]   = useState(false);

  // Poll unread notifications every 30s while mounted
  useEffect(() => {
    if (!user?.id) { setNotifCount(0); return; }
    let cancelled = false;
    async function load() {
      try {
        const n = await notificationsService.fetchUnreadCount(user.id);
        if (!cancelled) setNotifCount(n);
      } catch {
        // silent fail — badge just won't update
      }
    }
    load();
    const intv = setInterval(load, 30000);
    // The Notifications page marks a batch read on open. Its writes land after
    // this effect's route-change recount, so without this the badge stayed at
    // the old number until the next poll.
    window.addEventListener(NOTIFICATIONS_READ_EVENT, load);
    // Refresh whenever the user returns to this route
    return () => {
      cancelled = true;
      clearInterval(intv);
      window.removeEventListener(NOTIFICATIONS_READ_EVENT, load);
    };
  }, [user?.id, location.pathname]);

  // Realtime: instant badge bump + toast when a user_notification is inserted
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`hdr-notifs:${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'user_notifications', filter: `user_id=eq.${user.id}` },
        (payload) => {
          setNotifCount((prev) => prev + 1);
          const { type, event_title } = payload.new || {};
          if (type === 'rsvp_approved' && event_title) {
            showToast(`You're approved for "${event_title}"!`);
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const displayName = profile?.display_name || user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'User';

  function handleProfileClick() {
    if (!user) { navigate('/auth'); return; }
    setProfileMenuOpen((o) => !o);
  }

  return (
    <header className="fixed top-0 w-full z-50 bg-background/90 backdrop-blur-xl border-b border-primary/10">
      <nav className="flex justify-between items-center h-16 px-6 max-w-screen-2xl mx-auto">
        <button
          className="py-2 hover:opacity-80 transition-opacity"
          onClick={() => navigate('/')}
          aria-label="Afterhours home"
        >
          <img src="/logo-white.png" alt="Afterhours" className="h-10 w-auto" />
        </button>

        <div className="hidden md:flex items-center gap-8 text-sm tracking-wide">
          {NAV_LINKS.map((link) => (
            <button
              key={link.path}
              onClick={() => navigate(link.path)}
              className={`transition-colors font-label font-semibold uppercase tracking-widest text-xs cursor-pointer py-3.5 ${
                location.pathname === link.path
                  ? 'text-primary'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              {link.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          {/* Search */}
          <button
            title="Search"
            aria-label="Search"
            onClick={() => setSearchOpen(true)}
            className="p-2.5 rounded-xl text-on-surface-variant hover:text-primary hover:bg-surface-container transition-all"
          >
            <span className="material-symbols-outlined">search</span>
          </button>

          {/* Notifications */}
          {user && (
            <div className="relative">
              <button
                title="Notifications"
                aria-label={notifCount > 0 ? `Notifications, ${notifCount} unread` : 'Notifications'}
                aria-expanded={notifOpen}
                onClick={() => setNotifOpen((o) => !o)}
                className={`relative p-2.5 rounded-xl transition-all ${
                  notifOpen
                    ? 'text-primary bg-surface-container'
                    : 'text-on-surface-variant hover:text-primary hover:bg-surface-container'
                }`}
              >
                <span className="material-symbols-outlined">notifications</span>
                {notifCount > 0 && (
                  <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-primary text-on-primary text-[10px] font-bold flex items-center justify-center ring-2 ring-background">
                    {notifCount > 9 ? '9+' : notifCount}
                  </span>
                )}
              </button>

              {notifOpen && createPortal(
                <NotificationsPopover
                  onClose={() => setNotifOpen(false)}
                  onCountChange={setNotifCount}
                />,
                document.body
              )}
            </div>
          )}

          {/* Chat */}
          <button
            title="Chat"
            aria-label="Chat"
            onClick={() => navigate('/chat')}
            className="p-2.5 rounded-xl text-on-surface-variant hover:text-primary hover:bg-surface-container transition-all"
          >
            <span className="material-symbols-outlined">chat_bubble</span>
          </button>

          {/* Profile avatar + popout (desktop only — bottom nav handles mobile) */}
          <div className="relative hidden md:block">
            <button
              title="Profile"
              aria-label="Profile menu"
              aria-expanded={profileMenuOpen}
              onClick={handleProfileClick}
              className={`p-1 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full transition-all ${
                profileMenuOpen
                  ? 'ring-2 ring-primary ring-offset-2 ring-offset-background'
                  : 'hover:ring-2 hover:ring-outline-variant/50 hover:ring-offset-1 hover:ring-offset-background'
              }`}
            >
              {user && profile ? (
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${avatarBg(displayName)}`}>
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                  ) : (
                    <span className="text-xs font-bold text-white">{getInitials(displayName)}</span>
                  )}
                </div>
              ) : (
                <span className="material-symbols-outlined text-on-surface-variant p-1">account_circle</span>
              )}
            </button>

            {profileMenuOpen && (
              <ProfileMenu onClose={() => setProfileMenuOpen(false)} />
            )}
          </div>
        </div>
      </nav>
    </header>
  );
}
