import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { useToast } from '../components/Toast';
import { useVerificationGate } from '../lib/VerificationGate';
import { connectionsService } from '../services/connections.service';
import { avatarBg, getInitials } from '../lib/avatar';
import TrustBadge from '../components/trust/TrustBadge';
import ReportModal from '../components/trust/ReportModal';
import Footer from '../components/Footer';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { CAT_ICONS } from '../data/events';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function isPastEvent(event) {
  if (!event.starts_at) return false;
  return new Date(event.starts_at) < new Date();
}

function formatUpcomingDate(startsAt) {
  if (!startsAt) return '';
  const d = new Date(startsAt);
  const day  = d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true }).replace(' ', '').toUpperCase();
  return `${day} ${time}`;
}

function formatPastDate(startsAt) {
  if (!startsAt) return '';
  const d = new Date(startsAt);
  const month = d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
  const day   = d.getDate().toString().padStart(2, '0');
  return `${month} ${day}`;
}

// ─── EventTile ────────────────────────────────────────────────────────────────
function EventTile({ event, past }) {
  const navigate = useNavigate();
  const label = past ? formatPastDate(event.starts_at) : formatUpcomingDate(event.starts_at);
  return (
    <button type="button" onClick={() => navigate(`/event/${event.id}`)} className="group cursor-pointer text-left w-full">
      <div className="aspect-[4/3] rounded-xl overflow-hidden relative mb-2">
        {event.image_url ? (
          <img
            src={event.image_url}
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
            <span className="material-symbols-outlined text-3xl text-on-surface-variant/60">{CAT_ICONS[event.category] || 'star'}</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent pointer-events-none" />
        {label && (
          <span className="absolute bottom-2 left-3 text-xs text-on-surface/90 font-bold uppercase tracking-widest">
            {label}
          </span>
        )}
      </div>
      {/* Clamped to two lines with the height reserved. Tile heights have to match
          or one wrapping title makes its column taller than the next and the grid
          goes ragged — most visible at 2 columns on mobile. */}
      <p className="text-sm font-headline text-on-surface group-hover:text-primary transition-colors leading-snug line-clamp-2 min-h-[2.5rem]">
        {event.title}
      </p>
      <p className="text-xs text-on-surface-variant mt-0.5 truncate">{event.venue || event.city || ''}</p>
    </button>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function PublicProfile() {
  const { id } = useParams();
  const navigate  = useNavigate();
  const { user, profile: myProfile } = useAuth();
  const showToast = useToast();
  const requireVerified = useVerificationGate();

  const [profile, setProfile]               = useState(null);
  const [loading, setLoading]               = useState(true);
  const [hostedEvents, setHostedEvents]     = useState([]);
  const [pastEvents, setPastEvents]         = useState([]);
  const [showAllPast, setShowAllPast]       = useState(false);
  const [hostedCount, setHostedCount]       = useState(0);
  const [attendedCount, setAttendedCount]   = useState(0);
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [actionLoading, setActionLoading]   = useState(false);
  const [sharedHobbies, setSharedHobbies]   = useState([]);
  const [mutualConnections, setMutualConnections] = useState([]);
  const [theirConnections, setTheirConnections]   = useState([]);
  const [showReport, setShowReport]         = useState(false);

  const isOwnProfile = user?.id === id;

  useEffect(() => {
    if (isOwnProfile) { navigate('/profile', { replace: true }); return; }
    loadProfile();
  }, [id, user?.id]);

  async function loadProfile() {
    setLoading(true);
    try {
      // Fetch profile and connection status in parallel so we know
      // whether the viewer is a connection before applying privacy gates.
      const [{ data: prof, error }, connStatus] = await Promise.all([
        supabase
          .from('public_profiles')
          .select('id, display_name, trust_level, avatar_url, bio, city, country, hobbies, created_at, show_past_events')
          .eq('id', id)
          .single(),
        user?.id
          ? connectionsService.getConnectionStatus(user.id, id)
          : Promise.resolve(null),
      ]);

      if (error || !prof) { navigate('/', { replace: true }); return; }

      setProfile(prof);
      setConnectionStatus(connStatus);

      const isConnected     = connStatus?.status === 'accepted';
      const showPastEvents  = prof.show_past_events !== false;
      const showConnections = true;

      // Shared hobbies
      if (myProfile?.hobbies?.length && prof.hobbies?.length) {
        const mySet = new Set(myProfile.hobbies.map(h => h.toLowerCase()));
        setSharedHobbies(prof.hobbies.filter(h => mySet.has(h.toLowerCase())));
      }

      // Hosted events (always public)
      try {
        const { data: hosted } = await supabase
          .from('events')
          .select('id, title, category, venue, city, date, starts_at, image_url')
          .eq('creator_id', id)
          .order('starts_at', { ascending: true })
          .limit(12);

        const allHosted = hosted || [];
        setHostedEvents(allHosted.filter(e => !isPastEvent(e)));

        if (showPastEvents) {
          const { data: attended } = await supabase
            .from('rsvps')
            .select('event_id, events (id, title, category, venue, city, date, starts_at, image_url)')
            .eq('user_id', id)
            .order('created_at', { ascending: false })
            .limit(20);

          const attendedEvs = (attended || []).filter(r => r.events).map(r => r.events);
          const pastHosted   = allHosted.filter(e => isPastEvent(e));
          const pastAttended = attendedEvs.filter(e => isPastEvent(e));
          const combined = [...pastHosted, ...pastAttended]
            .filter((e, i, arr) => arr.findIndex(x => x.id === e.id) === i)
            .sort((a, b) => new Date(b.starts_at) - new Date(a.starts_at));
          setPastEvents(combined);
        }
      } catch (e) {
        console.error('Events load error:', e);
      }

      // Counts
      const now = new Date().toISOString();
      const [{ count: hCount }, { count: aCount }] = await Promise.all([
        supabase.from('events').select('*', { count: 'exact', head: true })
          .eq('creator_id', id).lt('starts_at', now),
        supabase.from('rsvps')
          .select('event_id, events!inner(starts_at)', { count: 'exact', head: true })
          .eq('user_id', id).lt('events.starts_at', now),
      ]);
      setHostedCount(hCount || 0);
      setAttendedCount(aCount || 0);

      // Mutual connections (only meaningful for logged-in users)
      if (user?.id) {
        try {
          const [myIds, theirIds] = await Promise.all([
            connectionsService.fetchConnectedIds(user.id),
            connectionsService.fetchConnectedIds(id),
          ]);
          const mutualIds = [...myIds].filter(mid => theirIds.has(mid)).slice(0, 5);
          if (mutualIds.length > 0) {
            const { data: mutualProfs } = await supabase
              .from('public_profiles')
              .select('id, display_name, avatar_url')
              .in('id', mutualIds);
            setMutualConnections(mutualProfs || []);
          }
        } catch {}
      }

      // Their connections sidebar — connections always see this
      if (showConnections) {
        try {
          const conns = await connectionsService.fetchConnections(id);
          setTheirConnections(conns);
        } catch {}
      }

    } catch (err) {
      console.error('PublicProfile load error:', err);
      navigate('/', { replace: true });
    } finally {
      setLoading(false);
    }
  }

  function handleConnect() {
    if (!user) { navigate('/auth'); return; }
    requireVerified(async () => {
      setActionLoading(true);
      try {
        await connectionsService.sendRequest(user.id, id);
        setConnectionStatus({ id: null, status: 'pending', direction: 'sent' });
        showToast('Connection request sent!');
      } catch {
        showToast('Could not send request. Try again.');
      } finally {
        setActionLoading(false);
      }
    });
  }

  function handleAccept() {
    if (!connectionStatus?.id) return;
    requireVerified(async () => {
      setActionLoading(true);
      try {
        await connectionsService.acceptRequest(connectionStatus.id);
        setConnectionStatus({ ...connectionStatus, status: 'accepted' });
        showToast('Connected!');
      } catch {
        showToast('Could not accept. Try again.');
      } finally {
        setActionLoading(false);
      }
    });
  }

  async function handleRemove() {
    if (!connectionStatus?.id) return;
    setActionLoading(true);
    try {
      await connectionsService.removeConnection(connectionStatus.id);
      setConnectionStatus(null);
      showToast('Connection removed.');
    } catch {
      showToast('Could not remove. Try again.');
    } finally {
      setActionLoading(false);
    }
  }

  if (loading || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ── Privacy gates ──────────────────────────────────────────────────────────
  // bio, city, country are already privacy-gated server-side in the
  // public_profiles view; null means the owner hid the field.
  const isConnected  = connectionStatus?.status === 'accepted';
  const showBio         = isConnected || !!profile.bio;
  const showLocation    = isConnected || !!(profile.city || profile.country);
  const showConnections = true;
  const showPastEvents  = profile.show_past_events !== false;

  const locationStr  = showLocation ? [profile.city, profile.country].filter(Boolean).join(', ') : '';
  const joinedDate   = profile.created_at
    ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : null;
  const isPending     = connectionStatus?.status === 'pending';
  const isSentByMe    = connectionStatus?.direction === 'sent';

  const gridPast    = pastEvents.slice(0, 4);
  const restPast    = pastEvents.slice(4);
  const hasMorePast = pastEvents.length > 4;

  return (
    <div className="page-enter">
      {showReport && (
        <ReportModal
          isOpen={showReport}
          onClose={() => setShowReport(false)}
          reporterId={user?.id}
          reportedUserId={id}
          eventTitle={profile.display_name}
        />
      )}

      {/* px-4 at mobile matches the other pages (Notifications, CreateEvent); px-6
          here was costing 16px of width on a 375px screen. */}
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 md:px-12 pt-10 pb-32">

        {/* Back */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-on-surface-variant hover:text-primary transition-colors text-sm mb-8"
        >
          <span className="material-symbols-outlined text-base">arrow_back</span> Back
        </button>

        {/* ── Header ── */}
        <div className="flex items-start gap-4 sm:gap-6 mb-8">

          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <div className={`w-20 h-20 md:w-24 md:h-24 rounded-full border-2 border-primary flex items-center justify-center shadow-glow ${avatarBg(profile.display_name)}`}>
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
              ) : (
                <span className="text-2xl font-bold text-white">{getInitials(profile.display_name)}</span>
              )}
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0 pt-1">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="min-w-0">

                {/* Name + trust */}
                <div className="flex items-center gap-2 sm:gap-3 mb-1 flex-wrap">
                  {/* break-words so a long single-token display name can't push the
                      header wider than the viewport on a 375px screen. */}
                  <h1 className="font-headline text-2xl md:text-3xl font-bold text-on-surface break-words min-w-0">{profile.display_name}</h1>
                  {profile.trust_level > 0 && <TrustBadge level={profile.trust_level} size="md" showLabel />}
                </div>

                {/* Joined + location */}
                <div className="flex items-center gap-3 flex-wrap mb-2">
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
                {showBio && profile.bio && (
                  <p className="text-on-surface-variant text-sm leading-relaxed max-w-lg mb-3">{profile.bio}</p>
                )}

                {/* Stats */}
                <div className="flex items-center gap-0 mb-3 flex-wrap">
                  {[
                    { value: hostedCount,   label: 'Hosted'   },
                    { value: attendedCount, label: 'Attended' },
                    ...(showConnections && theirConnections.length > 0
                      ? [{ value: theirConnections.length, label: 'Connections' }]
                      : []),
                  ].map(({ value, label }, i, arr) => (
                    <div key={label} className="flex items-center">
                      <div className={i === 0 ? 'pr-5' : 'px-5'}>
                        <p className="font-headline text-xl font-bold text-on-surface leading-none tabular-nums">{value}</p>
                        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-on-surface-variant/50 mt-1">{label}</p>
                      </div>
                      {i < arr.length - 1 && <div className="h-8 w-px bg-outline-variant/25 flex-shrink-0" />}
                    </div>
                  ))}
                </div>

                {/* Shared hobbies callout */}
                {sharedHobbies.length > 0 && (
                  <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-xl bg-primary-container/15 border border-primary/10 w-fit">
                    <span className="material-symbols-outlined text-primary text-sm">interests</span>
                    <p className="text-xs text-primary">
                      You both like <span className="font-bold">{sharedHobbies.join(', ')}</span>
                    </p>
                  </div>
                )}

              </div>

              {/* Action buttons */}
              {user && !isOwnProfile && (
                // Full width once this wraps below the name on mobile, so the action
                // row reads as its own row instead of a chip floating mid-column.
                <div className="flex items-center gap-2 flex-shrink-0 w-full sm:w-auto mt-1 sm:mt-0">
                  {isConnected ? (
                    <>
                      <span className="flex items-center gap-1.5 px-4 py-2 bg-primary/10 border border-primary/20 text-primary rounded-xl text-xs font-bold">
                        <span className="material-symbols-outlined text-sm">check_circle</span>
                        Connected
                      </span>
                      <button
                        onClick={handleRemove}
                        disabled={actionLoading}
                        className="p-2 rounded-xl text-on-surface-variant hover:text-error hover:bg-error-container/20 transition-all"
                        title="Remove connection"
                      >
                        <span className="material-symbols-outlined text-base">person_remove</span>
                      </button>
                    </>
                  ) : isPending && isSentByMe ? (
                    <span className="flex items-center gap-1.5 px-4 py-2 bg-surface-container border border-outline-variant/30 text-on-surface-variant rounded-xl text-xs font-bold">
                      <span className="material-symbols-outlined text-sm">schedule</span>
                      Request Sent
                    </span>
                  ) : isPending && !isSentByMe ? (
                    <div className="flex items-center gap-2">
                      <Button variant="primary" size="sm" onClick={handleAccept} disabled={actionLoading}>Accept</Button>
                      <Button variant="ghost" size="sm" onClick={handleRemove} disabled={actionLoading}>Decline</Button>
                    </div>
                  ) : (
                    <Button variant="primary" size="sm" icon="person_add" onClick={handleConnect} disabled={actionLoading}>
                      Connect
                    </Button>
                  )}

                  <button
                    onClick={() => setShowReport(true)}
                    className="p-2 rounded-xl text-on-surface-variant/60 hover:text-error hover:bg-error-container/20 transition-all"
                    title="Report user"
                  >
                    <span className="material-symbols-outlined text-base">flag</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mutual connections */}
        {mutualConnections.length > 0 && (
          <Card className="p-4 mb-8">
            <div className="flex items-center gap-2 mb-3">
              <span className="material-symbols-outlined text-primary text-base">group</span>
              <p className="text-sm text-on-surface font-semibold">
                {mutualConnections.length} mutual {mutualConnections.length === 1 ? 'connection' : 'connections'}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {mutualConnections.map(mc => (
                <button
                  key={mc.id}
                  onClick={() => navigate(`/profile/${mc.id}`)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-container border border-outline-variant/20 hover:border-primary/30 transition-all"
                >
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0 ${avatarBg(mc.display_name)}`}>
                    {mc.avatar_url ? <img src={mc.avatar_url} alt="" className="w-full h-full rounded-full object-cover" /> : getInitials(mc.display_name)}
                  </div>
                  <span className="text-xs text-on-surface font-medium">{mc.display_name}</span>
                </button>
              ))}
            </div>
          </Card>
        )}

        {/* ── Body: two-column ── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-10 items-start">

          {/* Left: Hosting + Past */}
          <div className="space-y-12">

            {/* Hosting */}
            {hostedEvents.length > 0 && (
              <section>
                <h2 className="font-headline text-xl font-bold text-on-surface mb-5">Hosting</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {hostedEvents.map(ev => <EventTile key={ev.id} event={ev} />)}
                </div>
              </section>
            )}

            {/* Empty hosting state */}
            {hostedEvents.length === 0 && pastEvents.length === 0 && (
              <Card className="p-8 text-center">
                <span className="material-symbols-outlined text-on-surface-variant mb-3 block text-4xl">nights_stay</span>
                <p className="text-on-surface-variant text-sm">
                  {profile.display_name} hasn't hosted any upcoming events yet.
                </p>
              </Card>
            )}

            {/* Past */}
            {showPastEvents && pastEvents.length > 0 && (
              <section>
                <div className="flex items-baseline gap-3 mb-5">
                  <h2 className="font-headline text-xl font-bold text-on-surface">Past</h2>
                  <span className="text-xs text-on-surface-variant font-bold uppercase tracking-widest">
                    {pastEvents.length} events
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 opacity-70 hover:opacity-100 transition-opacity">
                  {gridPast.map(ev => <EventTile key={ev.id} event={ev} past />)}
                </div>

                {hasMorePast && (
                  <>
                    {showAllPast && (
                      <div className="mt-4 border border-outline-variant/15 rounded-xl divide-y divide-outline-variant/10 bg-surface-container-low/40 overflow-hidden">
                        {restPast.map(ev => (
                          <button
                            key={ev.id}
                            type="button"
                            onClick={() => navigate(`/event/${ev.id}`)}
                            className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-surface-container transition-colors text-left group"
                          >
                            <div className="w-11 h-11 rounded-lg overflow-hidden flex-shrink-0 bg-surface-container-high flex items-center justify-center">
                              {ev.image_url ? (
                                <img src={ev.image_url} alt="" className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none'; }} />
                              ) : (
                                <span className="material-symbols-outlined text-lg text-on-surface-variant/60">{CAT_ICONS[ev.category] || 'star'}</span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-on-surface truncate group-hover:text-primary transition-colors">{ev.title}</p>
                              <p className="text-xs text-on-surface-variant truncate">{ev.venue || ev.city || '—'}</p>
                            </div>
                            <span className="text-[11px] text-on-surface-variant/60 font-bold uppercase tracking-wider flex-shrink-0">
                              {formatPastDate(ev.starts_at)}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="flex justify-center mt-4">
                      <button
                        type="button"
                        onClick={() => setShowAllPast(v => !v)}
                        className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold uppercase tracking-widest text-on-surface-variant hover:text-primary transition-colors"
                      >
                        {showAllPast ? 'Show less' : `View all (${pastEvents.length})`}
                        <span className="material-symbols-outlined transition-transform" style={{ fontSize: 16, transform: showAllPast ? 'rotate(180deg)' : 'none' }}>
                          expand_more
                        </span>
                      </button>
                    </div>
                  </>
                )}
              </section>
            )}
          </div>

          {/* Right: Connections sidebar */}
          {showConnections && theirConnections.length > 0 && (
            <div>
              <Card className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  <h3 className="font-headline text-base font-semibold text-on-surface">Connections</h3>
                  <span className="text-xs font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                    {theirConnections.length}
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-x-3 gap-y-4">
                  {theirConnections.slice(0, 8).map(conn => {
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
              </Card>
            </div>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
}
