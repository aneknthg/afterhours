/**
 * EventCard.jsx — src/components/EventCard.jsx
 *
 * Layout:
 *   Image — top-left: category tag · top-right: date badge
 *   Body  — title, icon meta rows (time, location), footer (attendees + price pill)
 */
import { useNavigate } from 'react-router-dom';
import { CAT_IMAGES } from '../lib/categoryImages';
import { useVerificationGate } from '../lib/VerificationGate';
import TrustBadge from './trust/TrustBadge';
import Card from './ui/Card';
import Tag from './ui/Tag';
import AttendeeStack from './events/AttendeeStack';

// Parse a date string into a compact two-line badge { top, bottom }
function parseDateBadge(dateStr) {
  if (!dateStr) return null;
  if (/tonight/i.test(dateStr)) return { top: 'NOW', bottom: null };
  // "Sat 8PM", "Sun 7PM", etc.
  const dayMatch = dateStr.match(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)/i);
  if (dayMatch) return { top: dayMatch[1].toUpperCase(), bottom: null };
  // "May 24", "Jun 1", "Oct 24" (month first)
  const monthDay = dateStr.match(/^([A-Za-z]{3})\s+(\d+)/);
  if (monthDay) return { top: monthDay[1].toUpperCase(), bottom: monthDay[2] };
  // "20 Apr", "20 Apr · 21:00" (day first)
  const dayMonth = dateStr.match(/^(\d{1,2})\s+([A-Za-z]{3})/);
  if (dayMonth) return { top: dayMonth[2].toUpperCase(), bottom: dayMonth[1] };
  // time-only like "11:30PM", "10PM"
  if (/^\d{1,2}(:\d{2})?\s*(AM|PM)/i.test(dateStr)) return { top: 'NOW', bottom: null };
  return null;
}

export default function EventCard({
  event,
  isGoing,
  onRsvp,
  attendeeCount,
  attendees,
  onBookmark,
  isBookmarked,
  currentUserId,
}) {
  const navigate = useNavigate();
  const requireVerified = useVerificationGate();

  const isOwnEvent      = !!(currentUserId && event.creator_id && event.creator_id === currentUserId);
  const hostName        = event.hostName        || event.profiles?.display_name  || null;
  const hostTrust       = event.hostTrust       || event.profiles?.trust_level   || 0;
  const hostEventsCount = event.hostEventsHosted || event.profiles?.events_hosted || 0;

  const capacity     = event.capacity || null;
  const spotsLeft    = capacity && attendeeCount != null ? Math.max(0, capacity - attendeeCount) : null;
  const isAlmostFull = spotsLeft !== null && spotsLeft <= 5 && spotsLeft > 0;
  const isFull       = spotsLeft === 0;

  const dateBadge = parseDateBadge(event.date);

  function handleRsvpClick(e) {
    e.stopPropagation();
    if (isGoing) navigate('/my-events');
    else if (!isFull && onRsvp) onRsvp(event);
  }

  function handleBookmark(e) {
    e.stopPropagation();
    if (onBookmark) onBookmark(event);
  }

  return (
    <Card hover onClick={() => requireVerified(() => navigate(`/event/${event.id}`))} className="flex flex-col group">

      {/* ── Image ──────────────────────────────────────────────────────── */}
      <div className="aspect-[4/3] overflow-hidden relative">
        <img
          alt={event.title}
          src={event.img}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          onError={(e) => {
            const fallback = CAT_IMAGES[event.cat] || CAT_IMAGES.other;
            if (e.target.src !== fallback) e.target.src = fallback;
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background/75 via-transparent to-transparent pointer-events-none" />

        {/* Top-left: tag + optional going / women-only badges */}
        <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 flex-wrap">
          <Tag variant="surface">{event.tag}</Tag>
          {event.women_only && (
            <Tag
              variant="solid"
              className="bg-primary/95 text-on-primary text-[10px] font-bold tracking-wide
                         flex items-center gap-1 shadow-glow"
              title="Verified women-only event"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 11, fontVariationSettings: "'FILL' 1" }}>
                verified
              </span>
              WOMEN ONLY
            </Tag>
          )}
          {isGoing && (
            <Tag variant="solid" className="flex items-center gap-0.5">
              <span className="material-symbols-outlined" style={{ fontSize: 10, fontVariationSettings: "'FILL' 1" }}>check</span>
              Going
            </Tag>
          )}
        </div>

        {/* Top-right: date badge */}
        {dateBadge && (
          <div className="absolute top-2.5 right-2.5">
            <div className="flex flex-col items-center justify-center min-w-[38px] px-2 py-1.5 rounded-xl bg-background/75 backdrop-blur-md border border-outline-variant/25">
              <span className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant/70 leading-none font-label">
                {dateBadge.top}
              </span>
              {dateBadge.bottom && (
                <span className="text-[15px] font-bold text-on-surface leading-none mt-0.5 font-headline">
                  {dateBadge.bottom}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Bookmark */}
        {onBookmark && (
          <button
            type="button"
            onClick={handleBookmark}
            aria-label={isBookmarked ? 'Remove bookmark' : 'Bookmark event'}
            aria-pressed={!!isBookmarked}
            className="absolute bottom-2.5 right-2.5 w-11 h-11 rounded-full bg-background/60 backdrop-blur-sm flex items-center justify-center hover:bg-background/80 transition-all"
          >
            <span
              className={`material-symbols-outlined text-lg ${isBookmarked ? 'text-primary' : 'text-white/80'}`}
              style={{ fontVariationSettings: isBookmarked ? "'FILL' 1" : "'FILL' 0" }}
            >
              bookmark
            </span>
          </button>
        )}
      </div>

      {/* ── Body ───────────────────────────────────────────────────────── */}
      <div className="p-4 flex flex-col flex-1">

        {/* Title */}
        <h3 className="font-headline text-base font-semibold leading-snug mb-3 text-on-surface">
          {event.title}
        </h3>

        {/* Meta rows: time + location */}
        <div className="space-y-1.5 mb-3">
          {event.date && (
            <div className="flex items-center gap-1.5 text-xs text-on-surface-variant/70">
              <span className="material-symbols-outlined text-primary/60 flex-shrink-0" style={{ fontSize: 13 }}>schedule</span>
              {event.date}
            </div>
          )}
          {(event.venue || event.city) && (
            <div className="flex items-center gap-1.5 text-xs text-on-surface-variant/70">
              <span className="material-symbols-outlined text-primary/60 flex-shrink-0" style={{ fontSize: 13 }}>location_on</span>
              {[event.venue, event.city].filter(Boolean).join(', ')}
            </div>
          )}
        </div>

        {/* Host */}
        {hostName && (
          <div className="flex items-center gap-1.5 mb-3">
            <TrustBadge level={hostTrust} size="sm" />
            <span className="text-xs text-on-surface-variant/60 truncate">
              by{' '}
              <span
                className={`text-on-surface-variant font-medium ${event.creator_id ? 'hover:text-primary cursor-pointer transition-colors' : ''}`}
                onClick={(e) => {
                  if (event.creator_id) {
                    e.stopPropagation();
                    navigate(event.creator_id === currentUserId ? '/profile' : `/profile/${event.creator_id}`);
                  }
                }}
              >
                {hostName}
              </span>
              {hostEventsCount > 0 && (
                <span className="text-on-surface-variant/40"> · {hostEventsCount} hosted</span>
              )}
            </span>
          </div>
        )}

        {/* Footer: attendees left · price/cta right */}
        <div className="flex items-center justify-between mt-auto pt-3 border-t border-outline-variant/15">
          <div className="flex items-center gap-2">
            {attendeeCount > 0 ? (
              <AttendeeStack attendees={attendees || []} total={attendeeCount} size="sm" />
            ) : (
              <span className="flex items-center gap-1 text-xs text-on-surface-variant/40">
                <span className="material-symbols-outlined" style={{ fontSize: 12 }}>auto_awesome</span>
                Be first
              </span>
            )}
            {isAlmostFull && (
              <span className="text-xs text-error font-bold flex items-center gap-0.5">
                <span className="material-symbols-outlined" style={{ fontSize: 12 }}>local_fire_department</span>
                {spotsLeft} left
              </span>
            )}
            {isFull && <span className="text-xs text-error font-bold">Full</span>}
          </div>

          {isOwnEvent ? (
            <span className="flex items-center gap-1.5 text-xs font-bold text-primary/80 bg-primary/10 px-2.5 py-1 rounded-full">
              <span className="material-symbols-outlined" style={{ fontSize: 12, fontVariationSettings: "'FILL' 1" }}>shield_person</span>
              Your event
            </span>
          ) : (
            <button
              onClick={handleRsvpClick}
              disabled={isFull && !isGoing}
              className={`text-xs font-bold px-3 py-1.5 rounded-full transition-all font-headline ${
                isGoing
                  ? 'bg-primary/15 text-primary border border-primary/25 hover:bg-primary/20'
                  : isFull
                  ? 'bg-surface-container text-on-surface-variant/40 cursor-not-allowed'
                  : 'bg-primary text-on-primary hover:brightness-110 active:scale-[0.97]'
              }`}
            >
              {isGoing ? (
                <><span className="material-symbols-outlined" style={{ fontSize: 11, fontVariationSettings: "'FILL' 1" }}>check</span>{' '}Going</>
              ) : isFull ? 'Full' : event.price}
            </button>
          )}
        </div>
      </div>
    </Card>
  );
}
