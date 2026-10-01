/**
 * PeopleLikeYou.jsx — Personalized people suggestions
 *
 * Shows 5–6 women with genuinely overlapping interests OR who attended
 * the same events as the current user. If a shared event is found,
 * a "You both went to X" badge is shown instead of hobby chips.
 *
 * Rules:
 *  - Same city as the viewer — meeting up is the point, so a profile two
 *    cities away is noise. Matches Discover's event scoping (see lib/city.js).
 *  - Minimum 2 shared hobbies OR at least 1 shared event attendance
 *  - Capped at 6 results
 *  - Never shows the same batch twice per session (results are stable,
 *    not randomly reshuffled on each load)
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import Button from './ui/Button';
import { supabase } from '../lib/supabase';
import { connectionsService } from '../services/connections.service';
import { useToast } from './Toast';
import { avatarBg, getInitials } from '../lib/avatar';
import { sameCity } from '../lib/city';
import TrustBadge from './trust/TrustBadge';

// ─── Person Card ──────────────────────────────────────────────────────────────

function PersonCard({ person, onConnect, connecting }) {
  const navigate = useNavigate();
  const [sent, setSent] = useState(false);

  async function handleConnect(e) {
    e.stopPropagation();
    if (sent) return;
    const ok = await onConnect(person.id);
    if (ok) setSent(true);
  }

  const hasSharedEvent = !!person.sharedEventTitle;
  const sharedHobbies = person.sharedHobbies || [];

  return (
    <div
      onClick={() => navigate(`/profile/${person.id}`)}
      className="flex-shrink-0 w-48 cursor-pointer group"
    >
      <div className="relative bg-surface-container-low border border-outline-variant/15 rounded-2xl p-4 pt-6 text-center hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200">

        {/* Shared event ribbon — shown above avatar */}
        {hasSharedEvent && (
          <div className="absolute -top-px left-1/2 -translate-x-1/2 w-[calc(100%-1rem)]">
            <div className="bg-primary/10 border border-primary/20 rounded-t-xl px-2 py-1 flex items-center justify-center gap-1">
              <span className="material-symbols-outlined text-primary" style={{ fontSize: 10 }}>celebration</span>
              <span className="text-[9px] font-bold text-primary uppercase tracking-wide truncate">
                Met at an event
              </span>
            </div>
          </div>
        )}

        {/* Avatar */}
        <div className="relative mx-auto mb-3 w-fit">
          <div
            className={`w-16 h-16 rounded-full flex items-center justify-center text-lg font-bold text-white border-2 ${
              hasSharedEvent ? 'border-primary/50' : 'border-primary/15'
            } ${avatarBg(person.display_name)}`}
          >
            {person.avatar_url ? (
              <img
                src={person.avatar_url}
                alt=""
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              getInitials(person.display_name)
            )}
          </div>
          {person.trust_level >= 2 && (
            <div className="absolute -bottom-0.5 -right-0.5">
              <TrustBadge level={person.trust_level} size="sm" />
            </div>
          )}
        </div>

        {/* Name */}
        <p className="text-sm font-semibold text-on-surface truncate mb-0.5 group-hover:text-primary transition-colors">
          {person.display_name}
        </p>

        {/* City */}
        {person.city && (
          <p className="text-[11px] text-on-surface-variant/60 truncate mb-2.5">
            {person.city}
          </p>
        )}

        {/* Shared event title */}
        {hasSharedEvent ? (
          <div className="mb-3 px-2 py-1.5 bg-primary/10 rounded-xl">
            <p className="text-[10px] text-primary/80 font-medium leading-tight line-clamp-2">
              "{person.sharedEventTitle}"
            </p>
          </div>
        ) : sharedHobbies.length > 0 ? (
          /* Shared hobbies chips */
          <div className="flex flex-wrap justify-center gap-1 mb-3">
            {sharedHobbies.slice(0, 2).map((h) => (
              <span
                key={h}
                className="px-2 py-0.5 bg-primary/10 text-primary border border-primary/15 rounded-full text-[10px] font-bold"
              >
                {h}
              </span>
            ))}
            {sharedHobbies.length > 2 && (
              <span className="px-2 py-0.5 text-on-surface-variant/50 text-[10px] font-bold">
                +{sharedHobbies.length - 2}
              </span>
            )}
          </div>
        ) : null}

        {/* Connect button */}
        <button
          onClick={handleConnect}
          disabled={sent || connecting}
          className={`w-full py-2 rounded-xl text-xs font-bold uppercase tracking-wide transition-all ${
            sent
              ? 'bg-primary/10 text-primary border border-primary/20 cursor-default'
              : 'bg-primary text-on-primary hover:brightness-110 active:scale-[0.97]'
          }`}
        >
          {sent ? (
            <><span className="material-symbols-outlined" style={{ fontSize: 11, fontVariationSettings: "'FILL' 1" }}>check</span>{' '}Sent</>
          ) : 'Connect'}
        </button>
      </div>
    </div>
  );
}

// ─── Skeleton Card ────────────────────────────────────────────────────────────

function PersonCardSkeleton() {
  return (
    <div className="flex-shrink-0 w-48">
      <div className="bg-surface-container-low border border-outline-variant/15 rounded-2xl p-4 pt-6 text-center animate-pulse">
        <div className="w-16 h-16 rounded-full bg-surface-container mx-auto mb-3" />
        <div className="h-3.5 bg-surface-container rounded-full w-3/4 mx-auto mb-1.5" />
        <div className="h-2.5 bg-surface-container rounded-full w-1/2 mx-auto mb-3" />
        <div className="flex justify-center gap-1 mb-3">
          <div className="h-4 w-14 bg-surface-container rounded-full" />
          <div className="h-4 w-12 bg-surface-container rounded-full" />
        </div>
        <div className="h-8 bg-surface-container rounded-xl w-full" />
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PeopleLikeYou() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const showToast = useToast();
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);

  const isVerified = profile?.verification_status === 'verified';

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    // Don't waste a query for unverified accounts — they see the gate card instead.
    if (!isVerified) {
      setLoading(false);
      return;
    }
    loadSuggestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, profile?.hobbies, profile?.city, isVerified]);

  async function loadSuggestions() {
    setLoading(true);
    try {
      const suggestions = await fetchSuggestedPeople(
        user.id,
        profile?.hobbies || [],
        profile?.city,
        6,
      );
      setPeople(suggestions);
    } catch (err) {
      console.error('PeopleLikeYou error:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleConnect(targetId) {
    setConnecting(true);
    try {
      await connectionsService.sendRequest(user.id, targetId);
      showToast('Connection request sent!');
      return true;
    } catch {
      showToast('Could not send request.');
      return false;
    } finally {
      setConnecting(false);
    }
  }

  const hasHobbies = profile?.hobbies?.length > 0;
  const cityLabel  = (profile?.city || '').split(',')[0].trim() || 'your city';

  // Not logged in — hide entirely
  if (!user) return null;

  // Logged in but not yet verified — show a gentle unlock card.
  // We never surface real people to unverified accounts (and unverified
  // accounts are never surfaced to others), so this section becomes the
  // nudge that converts them into the verification flow.
  if (!isVerified) {
    return (
      <section className="mb-14">
        <div className="flex items-end justify-between mb-7">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary/60 mb-1.5 font-label">
              Your circle
            </p>
            <h2 className="font-headline text-2xl md:text-[1.75rem] font-bold text-on-surface leading-tight">
              People like you
            </h2>
          </div>
        </div>
        <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-surface-container-low/60 to-surface-container-low/60 p-5 sm:p-6">
          <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-primary/15 blur-3xl pointer-events-none" />
          <div className="relative flex items-start gap-4">
            <div className="w-11 h-11 rounded-2xl bg-primary/15 flex items-center justify-center flex-shrink-0 ring-1 ring-primary/25">
              <span
                className="material-symbols-outlined text-primary"
                style={{ fontSize: 22, fontVariationSettings: "'FILL' 1" }}
              >
                verified_user
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-headline text-base sm:text-lg font-bold text-on-surface mb-1 leading-snug">
                Verify to unlock your circle
              </p>
              <p className="text-sm text-on-surface-variant leading-relaxed mb-4">
                Afterhours only shows verified members. Verify your identity to meet women with shared interests.
              </p>
              <Button variant="primary" size="sm" onClick={() => navigate('/verify')}>
                Verify my profile
              </Button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  // Loaded, no hobbies set — prompt to add interests
  if (!loading && !hasHobbies) {
    return (
      <section className="mb-14">
        <div className="flex items-end justify-between mb-7">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary/60 mb-1.5 font-label">
              Your circle
            </p>
            <h2 className="font-headline text-2xl md:text-[1.75rem] font-bold text-on-surface leading-tight">
              People like you
            </h2>
          </div>
        </div>
        <div className="flex items-start gap-4 px-5 py-4 rounded-2xl border border-outline-variant/20 bg-surface-container-low/60">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <span className="material-symbols-outlined text-primary" style={{ fontSize: 20 }}>interests</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-on-surface mb-0.5">Add your interests</p>
            <p className="text-xs text-on-surface-variant leading-relaxed mb-3">
              Tell us what you're into and we'll surface women with the same passions.
            </p>
            <Button variant="primary" size="sm" onClick={() => navigate('/profile?edit=interests')}>
              Complete your profile
            </Button>
          </div>
        </div>
      </section>
    );
  }

  // Loaded, has hobbies, but no matches — hide silently (not actionable)
  if (!loading && people.length === 0) return null;

  return (
    <section className="mb-14">
      {/* Header */}
      <div className="flex items-end justify-between mb-7">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary/60 mb-1.5 font-label">
            Your circle
          </p>
          <h2 className="font-headline text-2xl md:text-[1.75rem] font-bold text-on-surface leading-tight">
            People like you
          </h2>
          <p className="text-sm text-on-surface-variant/70 mt-1">
            Women in {cityLabel} who share your interests or attended the same events
          </p>
        </div>
      </div>

      {/* Scroll row */}
      <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-3 -mx-6 px-6 md:-mx-12 md:px-12">
        {loading
          ? Array.from({ length: 5 }).map((_, i) => <PersonCardSkeleton key={i} />)
          : people.map((person) => (
              <PersonCard
                key={person.id}
                person={person}
                onConnect={handleConnect}
                connecting={connecting}
              />
            ))}
      </div>
    </section>
  );
}

// ─── Smart suggestion logic ───────────────────────────────────────────────────

async function fetchSuggestedPeople(userId, userHobbies = [], viewerCity = '', limit = 6) {
  // No city on the viewer's profile means we can't scope, and an unscoped list
  // would be exactly the cross-city noise this section is meant to avoid.
  const cityPrefix = (viewerCity || '').split(',')[0].trim();
  if (!cityPrefix) return [];

  // 1. Get IDs to exclude (already connected / pending / blocked)
  const [sentRes, receivedRes, blocksRes] = await Promise.all([
    supabase.from('connections').select('target_id').eq('requester_id', userId),
    supabase.from('connections').select('requester_id').eq('target_id', userId),
    supabase.from('blocks').select('blocked_id').eq('blocker_id', userId),
  ]);

  const excludeIds = new Set([
    userId,
    ...((sentRes.data || []).map((c) => c.target_id)),
    ...((receivedRes.data || []).map((c) => c.requester_id)),
    ...((blocksRes.data || []).map((b) => b.blocked_id)),
  ]);

  // 2. Fetch events the current user has RSVP'd to
  const { data: myRsvps } = await supabase
    .from('rsvps')
    .select('event_id')
    .eq('user_id', userId);

  const myEventIds = new Set((myRsvps || []).map((r) => String(r.event_id)));

  // 3. Fetch candidate profiles (with hobbies)
  //    Only verified accounts — we never recommend unverified profiles.
  //    City is filtered in the query so the 120-row window fills with people
  //    the viewer can actually meet; sameCity() below is still the authority,
  //    since stored values vary ("Hyderabad" vs "Hyderabad, Telangana").
  const { data: candidates, error } = await supabase
    .from('public_profiles')
    .select('id, display_name, trust_level, avatar_url, bio, city, hobbies, verification_status')
    .eq('verification_status', 'verified')
    .not('hobbies', 'is', null)
    .ilike('city', `${cityPrefix}%`)
    .order('created_at', { ascending: false })
    .limit(120);

  if (error) throw error;

  const userHobbySet = new Set((userHobbies || []).map((h) => h.toLowerCase()));

  // 4. Score each candidate
  const scored = await Promise.all(
    (candidates || [])
      .filter((p) => !excludeIds.has(p.id) && p.hobbies?.length > 0 && sameCity(p.city, viewerCity))
      .map(async (p) => {
        const overlap = (p.hobbies || []).filter((h) =>
          userHobbySet.has(h.toLowerCase()),
        );
        const overlapCount = overlap.length;

        // Check shared event attendance only if we have rsvps to check
        let sharedEventTitle = null;
        if (myEventIds.size > 0) {
          const { data: theirRsvps } = await supabase
            .from('rsvps')
            .select('event_id, events(title)')
            .eq('user_id', p.id)
            .limit(50);

          const sharedRsvp = (theirRsvps || []).find((r) =>
            myEventIds.has(String(r.event_id)),
          );
          if (sharedRsvp) {
            sharedEventTitle =
              sharedRsvp.events?.title || 'a shared event';
          }
        }

        return {
          ...p,
          overlapCount,
          sharedHobbies: overlap,
          sharedEventTitle,
          // Score: shared events are a strong signal (weight 5), hobbies count too
          score: (sharedEventTitle ? 5 : 0) + overlapCount,
        };
      }),
  );

  return scored
    .filter((p) => p.score > 0 && (p.overlapCount >= 2 || p.sharedEventTitle))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
