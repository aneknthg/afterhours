import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { useToast } from '../components/Toast';
import { supabase } from '../lib/supabase';
import { CAT_ICONS } from '../data/events';
import HobbySelector from '../components/HobbySelector';
import CityPicker from '../components/CityPicker';
import { canonicalCity } from '../lib/city';
import { resizeForUpload, AVATAR_MAX_WIDTH } from '../lib/image';
import Footer from '../components/Footer';
import Button from '../components/ui/Button';
import PayoutAccountCard from '../components/PayoutAccountCard';
import { checkIsAdmin } from '../lib/admin.service';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import { connectionsService } from '../services/connections.service';
import PrivacyModal, { PRIVACY_OPTIONS } from '../components/PrivacyModal';
import AvatarCropModal from '../components/AvatarCropModal';
import VerificationModal from '../components/VerificationModal';
import { avatarBg, getInitials } from '../lib/avatar';


// ─── Helpers ──────────────────────────────────────────────────────────────────
function isPastEvent(event) {
  if (!event.starts_at) return false;
  return new Date(event.starts_at) < new Date();
}

function formatUpcomingDate(startsAt) {
  if (!startsAt) return '';
  const d = new Date(startsAt);
  const day = d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true }).replace(' ', '').toUpperCase();
  return `${day} ${time}`;
}

function formatPastDate(startsAt) {
  if (!startsAt) return '';
  const d = new Date(startsAt);
  const month = d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
  const day = d.getDate().toString().padStart(2, '0');
  return `${month} ${day}`;
}

// ─── EventTile ────────────────────────────────────────────────────────────────
function EventTile({ event, past }) {
  const navigate = useNavigate();
  const label = past ? formatPastDate(event.starts_at) : formatUpcomingDate(event.starts_at);
  return (
    <button type="button" onClick={() => navigate(`/event/${event.id}`)} className="group cursor-pointer text-left w-full">
      <div className="aspect-[4/3] rounded-xl overflow-hidden relative mb-2">
        {event.img ? (
          <img
            src={event.img}
            alt={event.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            onError={(e) => {
              e.target.style.display = 'none';
              e.target.parentElement.classList.add('bg-surface-container', 'flex', 'items-center', 'justify-center');
              e.target.parentElement.innerHTML = '<span class="material-symbols-outlined text-3xl text-on-surface-variant/60">star</span>';
            }}
          />
        ) : (
          <div className="w-full h-full bg-surface-container flex items-center justify-center">
            <span className="material-symbols-outlined text-3xl text-on-surface-variant/60">{CAT_ICONS[event.cat || event.category] || 'star'}</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent pointer-events-none" />
        {label && (
          <span className="absolute bottom-2 left-3 text-xs text-on-surface/90 font-bold uppercase tracking-widest">
            {label}
          </span>
        )}
      </div>
      {/* Same clamp as PublicProfile's EventTile — equal tile heights keep the
          2-column mobile grid from going ragged when a title wraps. */}
      <p className="text-sm font-headline text-on-surface group-hover:text-primary transition-colors leading-snug line-clamp-2 min-h-[2.5rem]">
        {event.title}
      </p>
      <p className="text-xs text-on-surface-variant mt-0.5 truncate">{event.venue || event.city || ''}</p>
    </button>
  );
}

// ─── NewEventTile ─────────────────────────────────────────────────────────────
function NewEventTile({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group cursor-pointer w-full text-left"
    >
      <div className="aspect-[4/3] rounded-xl overflow-hidden relative mb-2 border-2 border-dashed border-outline-variant/30 bg-surface-container/30 flex items-center justify-center hover:border-primary/40 hover:bg-surface-container/50 transition-all">
        <div className="text-center">
          <span className="text-3xl text-on-surface-variant/60 group-hover:text-primary/60 transition-colors block">+</span>
          <span className="text-xs text-on-surface-variant/60 font-bold uppercase tracking-widest mt-1 block group-hover:text-primary/60 transition-colors">
            NEW EVENT
          </span>
        </div>
      </div>
    </button>
  );
}

// ─── Toggle ───────────────────────────────────────────────────────────────────
function Toggle({ enabled, onToggle, disabled }) {
  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${
        enabled ? 'bg-safety' : 'bg-outline-variant/40'
      } ${disabled ? 'opacity-50' : ''}`}
    >
      <span
        className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-all ${
          enabled ? 'left-[26px]' : 'left-0.5'
        }`}
      />
    </button>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function Profile() {
  const { user, profile, signOut, updateProfile } = useAuth();
  const navigate  = useNavigate();
  const showToast = useToast();

  const [editing, setEditing]         = useState(false);
  const [isAdmin, setIsAdmin]         = useState(false);
  const [form, setForm]               = useState({ name: '', bio: '', city: '', country: '' });
  const [editHobbies, setEditHobbies] = useState([]);
  const [editPrivacy, setEditPrivacy] = useState({ show_location: true, show_bio: true, show_connections: true, show_past_events: true });
  const [editError, setEditError]     = useState('');
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarPreview, setAvatarPreview]     = useState(null);
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);
  const [cropSrc, setCropSrc]                 = useState(null);

  // Reset error flag when the stored URL changes (e.g. after a fresh upload)
  const prevAvatarUrlRef = useRef(null);
  if (profile?.avatar_url !== prevAvatarUrlRef.current) {
    prevAvatarUrlRef.current = profile?.avatar_url ?? null;
    if (avatarLoadFailed) setAvatarLoadFailed(false);
  }

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading]         = useState(false);
  const [deleteError, setDeleteError]             = useState('');

  // Deep link: "Choose your city" CTAs across the app send users to
  // /profile?edit=city. Open the editor straight onto the city field so a new
  // user can actually pick a city instead of landing on a static profile.
  const [searchParams, setSearchParams] = useSearchParams();
  const cityFieldRef    = useRef(null);
  const cityIntentRef   = useRef(false);
  const [cityIntent, setCityIntent] = useState(false);
  // ?edit=interests comes from Discover's "Add your interests" card: open the
  // editor scrolled to the interests.
  const [interestsIntent, setInterestsIntent] = useState(false);
  const interestsRef = useRef(null);

  // Ask the server whether this account is on the admin allowlist. Resolves
  // false when signed out or on any error, so the link stays hidden by default.
  useEffect(() => {
    if (!user?.id) { setIsAdmin(false); return; }
    let cancelled = false;
    checkIsAdmin().then((ok) => { if (!cancelled) setIsAdmin(ok); });
    return () => { cancelled = true; };
  }, [user?.id]);

  useEffect(() => {
    if (searchParams.get('edit') !== 'interests' || !profile) return;
    startEdit();
    setInterestsIntent(true);
    setSearchParams({}, { replace: true });
  }, [searchParams, profile]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (editing && interestsIntent && interestsRef.current) {
      interestsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setInterestsIntent(false);
    }
  }, [editing, interestsIntent]);

  useEffect(() => {
    if (cityIntentRef.current) return;
    if (searchParams.get('edit') !== 'city' || !profile) return;
    cityIntentRef.current = true;
    startEdit();
    setCityIntent(true);
    setSearchParams({}, { replace: true }); // so refresh/back doesn't re-trigger
  }, [searchParams, profile]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (editing && cityIntent && cityFieldRef.current) {
      cityFieldRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [editing, cityIntent]);

  const [hostedEvents, setHostedEvents]         = useState([]);
  const [pastHostedEvents, setPastHostedEvents] = useState([]);
  const [pastEvents, setPastEvents]             = useState([]);
  const [showAllPast, setShowAllPast]           = useState(false);
  const [attendedCount, setAttendedCount]       = useState(0);
  const [hostedCount, setHostedCount]           = useState(0);
  const [dataLoading, setDataLoading]           = useState(true);

  // ── Connections state ──────────────────────────────────────────────────────
  const [connections, setConnections]       = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [connsLoading, setConnsLoading]     = useState(true);
  const [connActionLoading, setConnActionLoading] = useState(false);

  const [showPrivacy, setShowPrivacy]           = useState(false);
  const [showVerification, setShowVerification] = useState(false);
  const [showFeedback, setShowFeedback]         = useState(false);
  const [feedbackText, setFeedbackText]         = useState('');
  const [feedbackSending, setFeedbackSending]   = useState(false);
  const [feedbackDone, setFeedbackDone]         = useState(false);

  async function handleSendFeedback() {
    if (!feedbackText.trim() || feedbackSending) return;
    setFeedbackSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ message: feedbackText.trim() }),
      });
      setFeedbackDone(true);
      setFeedbackText('');
      setTimeout(() => { setShowFeedback(false); setFeedbackDone(false); }, 1800);
    } catch {
      showToast('Could not send feedback. Please try again.');
    } finally {
      setFeedbackSending(false);
    }
  }

  const verificationStatus = profile?.verification_status ?? 'unverified';

  const displayName = profile?.display_name || user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'User';
  // A usable avatar = a live preview or a non-empty stored URL that hasn't failed to load.
  const hasAvatar = !!(avatarPreview || profile?.avatar_url?.trim()) && !avatarLoadFailed;
  const bio         = profile?.bio || '';
  const city        = profile?.city    || '';
  const country     = profile?.country || '';
  const locationStr = [city, country].filter(Boolean).join(', ');
  const hobbies     = profile?.hobbies || [];

  const joinedDate = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : null;

  // ── Load activity ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user?.id) { setDataLoading(false); return; }

    async function loadActivity() {
      setDataLoading(true);
      try {

      const now = new Date().toISOString();
      const { count: hCount } = await supabase
        .from('events').select('*', { count: 'exact', head: true })
        .eq('creator_id', user.id)
        .lt('starts_at', now);
      setAttendedCount(profile?.events_attended ?? 0);
      setHostedCount(hCount || 0);

      const { data: hosted } = await supabase
        .from('events')
        .select('id, title, category, venue, city, date, starts_at, price, tag, image_url')
        .eq('creator_id', user.id)
        .order('created_at', { ascending: false });

      const allHosted = (hosted || []).map((ev) => ({
        id: ev.id, title: ev.title, cat: ev.category,
        venue: ev.venue, city: ev.city, date: ev.date,
        starts_at: ev.starts_at, img: ev.image_url,
      }));
      setHostedEvents(allHosted.filter((e) => !isPastEvent(e)));
      setPastHostedEvents(allHosted.filter((e) => isPastEvent(e)));

      const { data: attended, error: attendedErr } = await supabase
        .from('rsvps')
        .select('event_id, status, events(id, title, category, venue, city, date, starts_at, image_url)')
        .eq('user_id', user.id);

      if (attendedErr) console.error('[Profile] attended fetch:', attendedErr);

      const attendedEvents = (attended || [])
        .filter((r) => r.events && r.status !== 'rejected')
        .map((r) => ({
          id: r.events.id, title: r.events.title, cat: r.events.category,
          venue: r.events.venue, city: r.events.city, date: r.events.date,
          starts_at: r.events.starts_at, img: r.events.image_url,
        }));

      setPastEvents(
        attendedEvents.filter((e) => isPastEvent(e)).sort((a, b) => new Date(b.starts_at) - new Date(a.starts_at))
      );
      } catch (err) {
        console.error('Profile activity load failed:', err);
      } finally {
        // Always resolve, or a single failed query leaves the skeleton forever.
        setDataLoading(false);
      }
    }

    loadActivity();
  }, [user?.id]);

  // ── Load connections ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!user?.id) { setConnsLoading(false); return; }
    async function loadConns() {
      setConnsLoading(true);
      try {
        const [conns, pending] = await Promise.all([
          connectionsService.fetchConnections(user.id),
          connectionsService.fetchPendingRequests(user.id),
        ]);
        setConnections(conns);
        setPendingRequests(pending);
      } catch (err) {
        console.error('Connections error:', err);
      } finally {
        setConnsLoading(false);
      }
    }
    loadConns();
  }, [user?.id]);

  // ── Edit handlers ──────────────────────────────────────────────────────────
  function startEdit() {
    setForm({ name: displayName, bio, city, country });
    setEditHobbies(hobbies);
    const defaults = { show_location: true, show_bio: true, show_connections: true, show_past_events: true };
    setEditPrivacy({ ...defaults, ...(profile?.privacy_settings || {}) });
    setEditError('');
    skipAutoSaveRef.current = true; // the seeding above must not trigger a save
    setSaveState('idle');
    setEditing(true);
  }

  // Edits save automatically shortly after each change (no Save button — users
  // scrolled away without noticing it and lost their city/hobby picks).
  const AUTOSAVE_MS = 900;
  const autoSaveTimer = useRef(null);
  const skipAutoSaveRef = useRef(true);
  const [saveState, setSaveState] = useState('idle'); // idle | saving | saved | error

  async function persistEdits() {
    setSaveState('saving');
    setEditError('');
    try {
      const payload = {
        bio:              form.bio.trim(),
        // Prefer the canonical city — storing a locality ("Madhapur") instead of
        // the city quietly empties Discover, Search and People for this account,
        // so saving repairs a legacy value where it can. Falls back to what's
        // already saved, never to the field: clearing the picker to type a new
        // city autosaves mid-edit, and an empty city fails needsOnboarding(),
        // which bounced verified members back through onboarding.
        city:             canonicalCity(form.city) || profile?.city || '',
        country:          canonicalCity(form.city) ? form.country.trim() : (profile?.country || ''),
        // Same gate for interests: removing the last one mid-edit must not save
        // an empty list.
        hobbies:          editHobbies.length ? editHobbies : (profile?.hobbies || []),
        privacy_settings: editPrivacy,
      };
      // Never persist an empty display name — keep the last saved one instead.
      if (form.name.trim()) payload.display_name = form.name.trim();
      await updateProfile(payload);
      setSaveState('saved');
    } catch (err) {
      console.error('[Profile autosave] failed:', err);
      setSaveState('error');
      setEditError(err.message || 'Failed to save.');
    }
  }

  useEffect(() => {
    if (!editing) return;
    // Skip the run caused by startEdit seeding the fields from the profile.
    if (skipAutoSaveRef.current) { skipAutoSaveRef.current = false; return; }
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => { autoSaveTimer.current = null; persistEdits(); }, AUTOSAVE_MS);
    return () => { if (autoSaveTimer.current) { clearTimeout(autoSaveTimer.current); autoSaveTimer.current = null; } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, form, editHobbies, editPrivacy]);

  function closeEditor() {
    // Flush any pending debounce so closing right after a change can't lose it.
    if (autoSaveTimer.current) {
      clearTimeout(autoSaveTimer.current);
      autoSaveTimer.current = null;
      persistEdits();
    }
    setEditing(false);
    setShowDeleteConfirm(false);
    setDeleteError('');
  }

  async function handleSignOut() {
    try { await signOut(); navigate('/'); } catch {}
  }

  async function handleDeleteAccount() {
    setDeleteLoading(true);
    setDeleteError('');
    try {
      // SECURITY: single atomic RPC deletes all user data server-side;
      // replaces manual partial deletes that left orphaned rows
      const { error } = await supabase.rpc('delete_user_account');
      if (error) {
        console.error('[DeleteAccount]', error);
        // Refused server-side so paid attendees are not left without a refund.
        setDeleteError(error.message?.includes('hosts_paid_upcoming_event')
          ? "You're hosting an upcoming event that people have paid for. Cancel it first so they're refunded, then delete your account."
          : 'Could not delete account. Please contact support.');
        return;
      }
      await signOut();
      navigate('/');
    } finally {
      setDeleteLoading(false);
    }
  }

  async function handleAcceptConnection(connectionId) {
    setConnActionLoading(true);
    try {
      await connectionsService.acceptRequest(connectionId);
      showToast('Connected!');
      const accepted = pendingRequests.find(r => r.connectionId === connectionId);
      setPendingRequests(prev => prev.filter(r => r.connectionId !== connectionId));
      if (accepted) setConnections(prev => [{ ...accepted, connectedAt: new Date().toISOString() }, ...prev]);
    } catch {
      showToast('Could not accept. Try again.');
    } finally {
      setConnActionLoading(false);
    }
  }

  async function handleDeclineConnection(connectionId) {
    setConnActionLoading(true);
    try {
      await connectionsService.rejectRequest(connectionId);
      setPendingRequests(prev => prev.filter(r => r.connectionId !== connectionId));
    } catch {
      showToast('Could not decline. Try again.');
    } finally {
      setConnActionLoading(false);
    }
  }

  // Changing/removing the photo invalidates verification (the selfie was matched to it),
  // so warn verified users. Also enforced server-side: the profiles guard resets
  // verification_status whenever avatar_url changes.
  function confirmAvatarChange() {
    if (verificationStatus !== 'verified') return true;
    return window.confirm(
      "You'll lose your verified status.\n\nYour verification matched your selfie to this photo. Changing or removing it means you'll need to verify again."
    );
  }

  function handleAvatarUpload(e) {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;
    if (!confirmAvatarChange()) { e.target.value = ''; return; }
    if (!file.type.startsWith('image/')) { showToast('Please select an image file.'); return; }
    if (file.size > 20 * 1024 * 1024)   { showToast('Image must be under 20MB.'); return; }
    const objectUrl = URL.createObjectURL(file);
    setCropSrc(objectUrl);
    e.target.value = '';
  }

  async function handleCropSave(blob) {
    if (!user?.id) return;
    const prevCropSrc = cropSrc;
    setCropSrc(null);
    const previewUrl = URL.createObjectURL(blob);
    setAvatarPreview(previewUrl);
    setAvatarUploading(true);
    try {
      const path = `${user.id}/avatar.jpg`;
      // Shrink before storing. This path used to upload the crop at whatever
      // resolution the source photo was: the live bucket averaged 1.5 MB an
      // avatar, all of it re-downloaded to draw a small circle.
      const upload = await resizeForUpload(blob, AVATAR_MAX_WIDTH);
      const { error: uploadError } = await supabase.storage.from('avatars').upload(path, upload, { upsert: true, contentType: 'image/jpeg' });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
      await updateProfile({ avatar_url: `${publicUrl}?t=${Date.now()}` });
      setAvatarPreview(null);
      showToast('Profile picture updated!');
    } catch (err) {
      console.error('Avatar upload error:', err);
      setAvatarPreview(null);
      showToast('Failed to upload image. Please try again.');
    } finally {
      setAvatarUploading(false);
      URL.revokeObjectURL(previewUrl);
      URL.revokeObjectURL(prevCropSrc);
    }
  }

  async function handleRemoveAvatar() {
    if (!user?.id) return;
    if (!confirmAvatarChange()) return;
    setAvatarUploading(true);
    try {
      // Best-effort storage cleanup; a missing object is not an error worth surfacing.
      await supabase.storage.from('avatars').remove([`${user.id}/avatar.jpg`]);
      await updateProfile({ avatar_url: '' });
      setAvatarPreview(null);
      setAvatarLoadFailed(false);
      showToast('Profile picture removed.');
    } catch (err) {
      console.error('Avatar remove error:', err);
      showToast('Failed to remove photo. Please try again.');
    } finally {
      setAvatarUploading(false);
    }
  }

  function handleCropCancel() {
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
  }

  // ── Derived ────────────────────────────────────────────────────────────────
  const allPast = [...pastEvents, ...pastHostedEvents]
    .sort((a, b) => new Date(b.starts_at) - new Date(a.starts_at));
  const gridPast   = allPast.slice(0, 4);
  const restPast   = allPast.slice(4);
  const hasPast    = allPast.length > 0;
  const hasMorePast = allPast.length > 4;

  const connectionsCount = connections.length;
  const pendingCount     = pendingRequests.length;

  return (
    <div className="page-enter">

      {/* ── Edit Profile modal ── */}
      {editing && (
        <div className="fixed inset-0 z-[300] bg-background/95 backdrop-blur-2xl overflow-y-auto">
          <div className="max-w-xl mx-auto px-5 py-10 pb-24">
            <div className="flex items-center justify-between mb-8">
              <h2 className="font-headline text-2xl font-bold text-on-surface">Edit Profile</h2>
              <button
                onClick={closeEditor}
                className="p-2 rounded-xl text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-all"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="space-y-5">
              {/* Profile photo */}
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-2">
                  Profile photo
                </label>
                <div className="flex items-center gap-4">
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0 relative ${avatarBg(displayName)}`}>
                    {hasAvatar ? (
                      <img
                        src={avatarPreview || profile.avatar_url}
                        alt=""
                        className="w-full h-full object-cover"
                        onError={() => setAvatarLoadFailed(true)}
                        onLoad={(e) => { if (!e.currentTarget.naturalWidth) setAvatarLoadFailed(true); }}
                      />
                    ) : (
                      <span className="text-xl font-bold text-white font-body">{getInitials(displayName)}</span>
                    )}
                    {avatarUploading && (
                      <div className="absolute inset-0 bg-background/70 flex items-center justify-center">
                        <span className="material-symbols-outlined text-white text-lg animate-spin">autorenew</span>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <label className="cursor-pointer inline-flex items-center gap-1.5 px-4 rounded-xl bg-surface-container border border-outline-variant/40 text-on-surface text-xs font-bold hover:border-primary/50 hover:text-primary transition-all min-h-[44px]">
                      <span className="material-symbols-outlined text-base">photo_camera</span>
                      {hasAvatar ? 'Change' : 'Add photo'}
                      <input type="file" accept="image/*" className="sr-only" onChange={handleAvatarUpload} disabled={avatarUploading} />
                    </label>
                    {hasAvatar && (
                      <button
                        type="button"
                        onClick={handleRemoveAvatar}
                        disabled={avatarUploading}
                        className="inline-flex items-center gap-1.5 px-4 rounded-xl border border-outline-variant/40 text-on-surface-variant text-xs font-bold hover:border-error/50 hover:text-error transition-all disabled:opacity-40 min-h-[44px]"
                      >
                        <span className="material-symbols-outlined text-base">delete</span>
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <Input
                label="Display Name *"
                placeholder="Your name"
                maxLength={30}
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
              <Input
                label="Bio"
                placeholder="Tell people a little about yourself…"
                maxLength={160}
                textarea
                rows={3}
                value={form.bio}
                onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
                hint={`${form.bio.length}/160`}
              />
              <div ref={cityFieldRef}>
                <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-1.5">
                  City
                </label>
                <CityPicker
                  value={form.city}
                  autoFocus={cityIntent}
                  placeholder="Search for your city…"
                  onChange={({ city, country }) =>
                    setForm((f) => ({ ...f, city, country: country || f.country }))
                  }
                />
                <p className="text-xs text-on-surface-variant/70 mt-1.5">
                  Discover shows events in this city. Change it anytime to explore elsewhere.
                </p>
              </div>
            </div>

            <div className="mt-8 scroll-mt-24" ref={interestsRef}>
              <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-4">
                Your Interests
              </p>
              <HobbySelector selected={editHobbies} onChange={setEditHobbies} compact />
            </div>

            {/* Privacy */}
            <div className="mt-8">
              <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-1">Privacy</p>
              <p className="text-xs text-on-surface-variant/70 mb-4">Control what others see on your public profile.</p>
              <div className="space-y-3">
                {[
                  { key: 'show_location',    label: 'Show location' },
                  { key: 'show_bio',         label: 'Show bio' },
                  { key: 'show_connections', label: 'Show connections' },
                  { key: 'show_past_events', label: 'Show past events' },
                ].map(({ key, label }) => (
                  <div key={key} className="flex items-center justify-between">
                    <span className="text-sm text-on-surface">{label}</span>
                    <Toggle
                      enabled={editPrivacy[key] !== false}
                      onToggle={() => setEditPrivacy(p => ({ ...p, [key]: !p[key] }))}
                    />
                  </div>
                ))}
              </div>
            </div>

            {editError && (
              <p className="text-sm text-error bg-error-container/20 rounded-xl px-4 py-3 mt-5">{editError}</p>
            )}

            <div className="mt-8 space-y-3">
              <div className="flex items-center justify-center gap-2 py-1">
                <span
                  className={`material-symbols-outlined ${saveState === 'error' ? 'text-error' : saveState === 'saved' ? 'text-primary' : 'text-on-surface-variant/50'}`}
                  style={{ fontSize: 15 }}
                >
                  {saveState === 'saving' ? 'progress_activity' : saveState === 'error' ? 'error' : 'check_circle'}
                </span>
                <span className={`text-xs ${saveState === 'error' ? 'text-error' : 'text-on-surface-variant/70'}`}>
                  {saveState === 'saving' ? 'Saving…'
                    : saveState === 'saved' ? 'All changes saved'
                    : saveState === 'error' ? "Couldn't save — check your connection and try again"
                    : 'Changes save automatically'}
                </span>
              </div>
              <Button variant="primary" fullWidth size="lg" onClick={closeEditor}>
                Done
              </Button>
              <button
                onClick={() => setShowFeedback(true)}
                className="w-full py-2.5 text-xs text-on-surface-variant/70 hover:text-primary transition-colors"
              >
                Send feedback
              </button>
              <button
                onClick={handleSignOut}
                className="w-full py-2.5 text-xs text-on-surface-variant/70 hover:text-error transition-colors"
              >
                Sign out
              </button>

              {!showDeleteConfirm ? (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="w-full py-2 text-xs text-on-surface-variant/50 hover:text-error/70 transition-colors"
                >
                  Delete account
                </button>
              ) : (
                <div className="rounded-xl border border-error/30 bg-error/5 p-4 space-y-3">
                  <div className="flex items-start gap-2.5">
                    <span className="material-symbols-outlined text-error flex-shrink-0 mt-0.5" style={{ fontSize: 16 }}>warning</span>
                    <div>
                      <p className="text-sm font-semibold text-on-surface">Delete your account?</p>
                      <p className="text-xs text-on-surface-variant mt-0.5 leading-relaxed">
                        This permanently removes your profile, RSVPs, and all account data. This cannot be undone.
                      </p>
                    </div>
                  </div>
                  {deleteError && (
                    <p className="text-xs text-error bg-error-container/20 rounded-lg px-3 py-2">{deleteError}</p>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setShowDeleteConfirm(false); setDeleteError(''); }}
                      disabled={deleteLoading}
                      className="flex-1 py-2 rounded-xl text-xs font-bold border border-outline-variant/30 text-on-surface-variant hover:bg-surface-container transition-all disabled:opacity-40"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDeleteAccount}
                      disabled={deleteLoading}
                      className="flex-1 py-2 rounded-xl text-xs font-bold bg-error text-on-error hover:brightness-110 transition-all disabled:opacity-40"
                    >
                      {deleteLoading ? 'Deleting…' : 'Delete permanently'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showPrivacy && (
        <PrivacyModal
          onClose={() => setShowPrivacy(false)}
          profile={profile}
          updateProfile={updateProfile}
        />
      )}

      {cropSrc && (
        <AvatarCropModal
          src={cropSrc}
          onSave={handleCropSave}
          onCancel={handleCropCancel}
        />
      )}

      {showVerification && (
        <VerificationModal
          onClose={() => setShowVerification(false)}
          onVerified={() => showToast('Identity verified!')}
        />
      )}

      {/* ── Feedback modal ── */}
      {showFeedback && (
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-4">
          <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" onClick={() => setShowFeedback(false)} />
          <div className="relative w-full max-w-md bg-surface-container-low border border-outline-variant/20 rounded-3xl shadow-card overflow-hidden">
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-outline-variant/15">
              <div>
                <h2 className="font-headline text-lg font-bold text-on-surface">Send feedback</h2>
                <p className="text-xs text-on-surface-variant/60 mt-0.5">Goes straight to us, not a support queue</p>
              </div>
              <button
                onClick={() => setShowFeedback(false)}
                className="w-10 h-10 rounded-full hover:bg-surface-container flex items-center justify-center transition-colors"
              >
                <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: 20 }}>close</span>
              </button>
            </div>
            <div className="p-5">
              {feedbackDone ? (
                <div className="flex flex-col items-center gap-3 py-8">
                  <span className="material-symbols-outlined text-primary" style={{ fontSize: 40, fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                  <p className="text-sm font-semibold text-on-surface">Sent. We'll read it.</p>
                </div>
              ) : (
                <>
                  <textarea
                    className="w-full h-32 bg-surface-container border border-outline-variant/40 rounded-xl px-4 py-3 text-sm text-on-surface placeholder:text-on-surface-variant/50 resize-none focus:outline-none focus:border-primary/60 transition-colors"
                    placeholder="Something broken? An idea you can't stop thinking about? This goes straight to us."
                    value={feedbackText}
                    onChange={(e) => setFeedbackText(e.target.value)}
                    autoFocus
                  />
                  <button
                    onClick={handleSendFeedback}
                    disabled={!feedbackText.trim() || feedbackSending}
                    className="mt-3 w-full py-3 rounded-xl bg-primary text-on-primary text-sm font-bold uppercase tracking-wide hover:brightness-110 transition-all disabled:opacity-50"
                  >
                    {feedbackSending ? 'Sending…' : 'Send'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Profile header ── */}
      <section className="px-6 md:px-12 max-w-screen-xl mx-auto pt-10">
        <div className="flex items-start gap-6">

          {/* Avatar */}
          <div className="relative flex-shrink-0 group">
            <label className="block cursor-pointer" title="Change profile picture">
              <div className={`w-20 h-20 md:w-24 md:h-24 rounded-full flex items-center justify-center overflow-hidden relative ${avatarBg(displayName)}`}>
                {hasAvatar ? (
                  <img
                    src={avatarPreview || profile.avatar_url}
                    alt=""
                    className="w-full h-full object-cover"
                    onError={() => setAvatarLoadFailed(true)}
                    // A broken/empty upload can return HTTP 200 without firing onError;
                    // naturalWidth === 0 means nothing actually decoded, so fall back to initials.
                    onLoad={(e) => { if (!e.currentTarget.naturalWidth) setAvatarLoadFailed(true); }}
                  />
                ) : (
                  <span className="text-2xl font-bold text-white font-body">{getInitials(displayName)}</span>
                )}
                {avatarUploading && (
                  <div className="absolute inset-0 bg-background/70 flex items-center justify-center">
                    <span className="material-symbols-outlined text-white text-xl animate-spin">autorenew</span>
                  </div>
                )}
              </div>
              <input type="file" accept="image/*" className="sr-only" onChange={handleAvatarUpload} disabled={avatarUploading} />
            </label>
            <div className="absolute bottom-0.5 right-0.5 w-6 h-6 rounded-full bg-primary border-2 border-background flex items-center justify-center pointer-events-none">
              <span className="material-symbols-outlined text-on-primary" style={{ fontSize: 12 }}>photo_camera</span>
            </div>
            {/* Verification badge */}
            {verificationStatus === 'verified' && (
              <div className="absolute -top-1 -right-1 w-7 h-7 rounded-full bg-background flex items-center justify-center" title="Identity verified">
                <span className="material-symbols-outlined text-primary" style={{ fontSize: 20, fontVariationSettings: "'FILL' 1" }}>verified</span>
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0 pt-1">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h1 className="font-headline text-2xl md:text-3xl font-bold text-on-surface leading-tight">
                  {displayName}
                </h1>

                {/* Joined + location */}
                <div className="flex items-center gap-3 flex-wrap mt-1">
                  {joinedDate && (
                    <p className="text-on-surface-variant text-xs flex items-center gap-1">
                      <span className="material-symbols-outlined text-on-surface-variant/60" style={{ fontSize: 14 }}>calendar_month</span>
                      Joined {joinedDate}
                    </p>
                  )}
                  {locationStr && (
                    <p className="text-on-surface-variant text-xs flex items-center gap-1">
                      <span className="material-symbols-outlined text-primary" style={{ fontSize: 14 }}>location_on</span>
                      {locationStr}
                    </p>
                  )}
                </div>

                {/* Bio */}
                {bio && (
                  <p className="text-on-surface-variant text-sm mt-2 leading-relaxed max-w-lg">
                    {bio}
                  </p>
                )}

              </div>

              {/* Edit button */}
              <button
                onClick={startEdit}
                className="flex items-center gap-1.5 px-4 py-2 bg-surface-container/80 border border-outline-variant/40 text-on-surface-variant rounded-xl text-xs font-bold hover:border-primary/50 hover:text-primary transition-all flex-shrink-0"
              >
                <span className="material-symbols-outlined text-sm">edit</span> Edit
              </button>
            </div>
          </div>
        </div>

        {/* Stats row — full width so labels never overflow */}
        <div className="flex items-center gap-0 mt-5 border-t border-outline-variant/15 pt-5">
          {[
            { value: dataLoading  ? '—' : hostedCount,      label: 'Hosted'      },
            { value: dataLoading  ? '—' : attendedCount,     label: 'Attended'    },
            { value: connsLoading ? '—' : connectionsCount,  label: 'Connections' },
          ].map(({ value, label }, i) => (
            <div key={label} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <p className="font-headline text-xl font-bold text-on-surface leading-none tabular-nums">{value}</p>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-on-surface-variant/70 mt-1">{label}</p>
              </div>
              {i < 2 && <div className="h-8 w-px bg-outline-variant/25 flex-shrink-0" />}
            </div>
          ))}
        </div>
      </section>

      {/* ── Verification banner ── */}
      {verificationStatus !== 'verified' && (
        <section className="px-6 md:px-12 max-w-screen-xl mx-auto mt-5">
          <div className={`flex items-center justify-between gap-4 px-5 py-4 rounded-2xl border ${
            verificationStatus === 'failed'
              ? 'bg-error/10 border-error/20'
              : 'bg-status-pending/10 border-status-pending/20'
          }`}>
            <div className="flex items-center gap-3 min-w-0">
              <span
                className={`material-symbols-outlined flex-shrink-0 ${verificationStatus === 'failed' ? 'text-error' : 'text-status-pending'}`}
                style={{ fontSize: 20, fontVariationSettings: "'FILL' 1" }}
              >
                {verificationStatus === 'failed' ? 'error' : 'warning'}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold text-on-surface">
                  {verificationStatus === 'failed' ? 'Verification failed' : 'Identity not verified'}
                </p>
                <p className="text-xs text-on-surface-variant mt-0.5 leading-snug">
                  {verificationStatus === 'failed'
                    ? 'Your previous attempt failed. Upload a clear profile photo and try again.'
                    : 'Verify your identity to access all features. Afterhours is a women-only space.'}
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowVerification(true)}
              className="flex-shrink-0 px-4 py-2 rounded-xl bg-primary text-on-primary text-xs font-bold uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all"
            >
              Verify now
            </button>
          </div>
        </section>
      )}

      {/* ── Body: two-column layout ── */}
      <div className="max-w-screen-xl mx-auto px-6 md:px-12 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-10 items-start">

          {/* ── Left: Hosting + Past ── */}
          <div className="space-y-12">

            {/* Hosting */}
            <section>
              <div className="mb-5">
                <h2 className="font-headline text-xl font-bold text-on-surface">Hosting</h2>
              </div>

              {/* Canonical home for payout details. Create Event shows the same
                  card once a ticket price is entered, so a host who fills this
                  in first simply sees it confirmed there. */}
              <PayoutAccountCard context="profile" />

              {/* Only rendered for allowlisted accounts. checkIsAdmin asks the
                  server, since the browser has no way to know and must not be
                  the thing deciding. The page itself is gated server-side too,
                  so this only controls whether the link is visible. */}
              {isAdmin && (
                <button
                  onClick={() => navigate('/admin')}
                  className="w-full rounded-2xl border border-outline-variant/20 bg-surface-container px-5 py-4 mb-6 flex items-center justify-between gap-4 hover:border-primary/40 transition-colors text-left"
                >
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-on-surface-variant/60 font-semibold mb-1">
                      Admin
                    </p>
                    <p className="text-sm text-on-surface font-medium">
                      Money: sales, refunds and host payouts
                    </p>
                  </div>
                  <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: 20 }}>
                    chevron_right
                  </span>
                </button>
              )}

              {dataLoading ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {[1, 2, 3].map((i) => <div key={i} className="aspect-[4/3] rounded-xl bg-surface-container animate-pulse" />)}
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {hostedEvents.map((ev) => <EventTile key={ev.id} event={ev} />)}
                  <NewEventTile onClick={() => navigate('/create')} />
                </div>
              )}
            </section>

            {/* Past */}
            {hasPast && (
              <section>
                <div className="flex items-baseline gap-3 mb-5">
                  <h2 className="font-headline text-xl font-bold text-on-surface">Past</h2>
                  <span className="text-xs text-on-surface-variant font-bold uppercase tracking-widest">
                    {allPast.length} events
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 opacity-70 hover:opacity-100 transition-opacity">
                  {gridPast.map((ev) => <EventTile key={ev.id} event={ev} past />)}
                </div>

                {hasMorePast && (
                  <>
                    {showAllPast && (
                      <div className="mt-4 border border-outline-variant/15 rounded-xl divide-y divide-outline-variant/10 bg-surface-container-low/40 overflow-hidden">
                        {restPast.map((ev) => (
                          <button
                            key={ev.id}
                            type="button"
                            onClick={() => navigate(`/event/${ev.id}`)}
                            className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-surface-container transition-colors text-left group"
                          >
                            <div className="w-11 h-11 rounded-lg overflow-hidden flex-shrink-0 bg-surface-container-high flex items-center justify-center">
                              {ev.img ? (
                                <img src={ev.img} alt="" className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none'; }} />
                              ) : (
                                <span className="material-symbols-outlined text-lg text-on-surface-variant/60">{CAT_ICONS[ev.cat || ev.category] || 'star'}</span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-on-surface truncate group-hover:text-primary transition-colors">{ev.title}</p>
                              <p className="text-xs text-on-surface-variant truncate">{ev.venue || ev.city || '—'}</p>
                            </div>
                            <span className="text-xs text-on-surface-variant/70 font-bold uppercase tracking-wider flex-shrink-0">
                              {formatPastDate(ev.starts_at)}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="flex justify-center mt-4">
                      <button
                        type="button"
                        onClick={() => setShowAllPast((v) => !v)}
                        className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold uppercase tracking-widest text-on-surface-variant hover:text-primary transition-colors"
                      >
                        {showAllPast ? 'Show less' : `View all (${allPast.length})`}
                        <span
                          className="material-symbols-outlined transition-transform"
                          style={{ fontSize: 16, transform: showAllPast ? 'rotate(180deg)' : 'none' }}
                        >
                          expand_more
                        </span>
                      </button>
                    </div>
                  </>
                )}
              </section>
            )}
          </div>

          {/* ── Right: Sidebar ── */}
          <div className="space-y-5">

            {/* Privacy card */}
            <Card className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-headline text-base font-semibold text-on-surface">Privacy</h3>
                <button
                  onClick={() => setShowPrivacy(true)}
                  className="text-on-surface-variant text-xs font-bold uppercase tracking-widest hover:text-primary transition-colors"
                >
                  Manage
                </button>
              </div>
              <div className="space-y-2.5">
                {PRIVACY_OPTIONS.map(({ field, icon, label }) => {
                  const enabled = profile?.privacy_settings?.[field] ?? true;
                  return (
                    <button
                      key={field}
                      type="button"
                      onClick={() => setShowPrivacy(true)}
                      className="w-full flex items-center gap-3 group"
                    >
                      <div className="w-7 h-7 rounded-lg bg-surface-container flex items-center justify-center flex-shrink-0">
                        <span className="material-symbols-outlined text-on-surface-variant/70" style={{ fontSize: 15 }}>{icon}</span>
                      </div>
                      <span className="flex-1 text-xs text-on-surface text-left leading-snug group-hover:text-primary transition-colors">{label}</span>
                      <span className={`text-[10px] font-bold uppercase tracking-wider flex-shrink-0 ${enabled ? 'text-primary' : 'text-on-surface-variant/70'}`}>
                        {enabled ? 'On' : 'Off'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </Card>

            {/* Feedback card */}
            <Card className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-outlined text-primary" style={{ fontSize: 16 }}>chat</span>
                </div>
                <div>
                  <h3 className="font-headline text-base font-semibold text-on-surface">Send feedback</h3>
                  <p className="text-[11px] text-on-surface-variant/60">Goes straight to us, not a support queue</p>
                </div>
              </div>
              <button
                onClick={() => setShowFeedback(true)}
                className="w-full py-2.5 rounded-xl bg-primary/10 hover:bg-primary/15 text-primary text-sm font-semibold transition-colors"
              >
                Say something
              </button>
            </Card>

            {/* Connections card */}
            <Card className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <h3 className="font-headline text-base font-semibold text-on-surface">Connections</h3>
                  {!connsLoading && connectionsCount > 0 && (
                    <span className="text-xs font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                      {connectionsCount}
                    </span>
                  )}
                </div>
                {pendingCount > 0 && (
                  <span className="flex items-center gap-1 text-xs font-bold text-primary">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                    {pendingCount} pending
                  </span>
                )}
              </div>

              {connsLoading ? (
                <div className="grid grid-cols-4 gap-3">
                  {[1,2,3,4].map(i => (
                    <div key={i} className="flex flex-col items-center gap-1.5">
                      <div className="w-12 h-12 rounded-full bg-surface-container animate-pulse" />
                      <div className="h-2.5 w-10 bg-surface-container rounded animate-pulse" />
                    </div>
                  ))}
                </div>
              ) : connections.length === 0 && pendingRequests.length === 0 ? (
                <div className="text-center py-4">
                  <span className="material-symbols-outlined text-on-surface-variant/40 text-3xl block mb-2">people</span>
                  <p className="text-xs text-on-surface-variant">Connect with women you meet at events.</p>
                  <button
                    onClick={() => navigate('/discover')}
                    className="text-primary text-xs font-bold uppercase tracking-widest hover:underline mt-2 block mx-auto"
                  >
                    Explore events →
                  </button>
                </div>
              ) : (
                <>
                  {/* Pending requests */}
                  {pendingRequests.length > 0 && (
                    <div className="space-y-2 mb-4">
                      {pendingRequests.map(req => {
                        const u = req.user;
                        if (!u) return null;
                        return (
                          <div key={req.connectionId} className="flex items-center gap-2 p-2 rounded-xl bg-primary-container/10 border border-primary/10">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 ${avatarBg(u.display_name)}`}>
                              {u.avatar_url ? <img src={u.avatar_url} alt="" className="w-full h-full rounded-full object-cover" /> : getInitials(u.display_name)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-on-surface truncate">{u.display_name}</p>
                              <p className="text-[10px] text-on-surface-variant">wants to connect</p>
                            </div>
                            <div className="flex gap-1">
                              <button onClick={() => handleAcceptConnection(req.connectionId)} disabled={connActionLoading} className="px-3.5 py-1.5 bg-primary text-on-primary rounded-lg text-xs font-bold hover:brightness-110 transition-all disabled:opacity-40">Accept</button>
                              <button onClick={() => handleDeclineConnection(req.connectionId)} disabled={connActionLoading} aria-label="Decline" className="p-2 text-on-surface-variant hover:text-error transition-colors disabled:opacity-40"><span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span></button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Avatar grid */}
                  {connections.length > 0 && (
                    <div className="grid grid-cols-4 gap-x-3 gap-y-4">
                      {connections.slice(0, 8).map(conn => {
                        const u = conn.user;
                        if (!u) return null;
                        return (
                          <button
                            type="button"
                            key={conn.connectionId}
                            onClick={() => navigate(`/profile/${u.id}`)}
                            className="flex flex-col items-center gap-1 cursor-pointer group"
                          >
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold text-white group-hover:ring-2 group-hover:ring-primary transition-all ${avatarBg(u.display_name)}`}>
                              {u.avatar_url ? (
                                <img src={u.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                              ) : (
                                getInitials(u.display_name)
                              )}
                            </div>
                            <span className="text-[10px] text-on-surface-variant text-center truncate w-full group-hover:text-primary transition-colors">
                              {u.display_name?.split(' ')[0]}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                </>
              )}
            </Card>

          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
