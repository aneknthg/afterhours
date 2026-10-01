/**
 * AttendeeStack.jsx — NEW
 *
 * Small overlapping avatar stack with "+N going" overflow.
 * Drop into EventCard footer or hero. Uses the shared avatar lib.
 *
 * Props:
 *   attendees  Array<{ id, display_name, avatar_url? }>  — up to 5 shown
 *   total      number  — full count for overflow label
 *   size       'sm' | 'md'  default 'sm'
 *   onClick    fn   — optional, fired when stack clicked
 */
import { getInitials } from '../../lib/avatar';

export default function AttendeeStack({ attendees = [], total = 0, size = 'sm', onClick, verb = 'going', quiet = false }) {
  const shown = attendees.slice(0, 5);
  const remaining = Math.max(0, total - shown.length);

  const dim   = size === 'md' ? 'w-7 h-7 text-[11px]' : 'w-5 h-5 text-[9px]';
  const ring  = size === 'md' ? 'ring-2' : 'ring-[1.5px]';
  const labelClass = quiet
    ? 'text-xs text-on-surface-variant/55 group-hover:text-on-surface-variant transition-colors'
    : 'text-xs text-primary font-semibold group-hover:text-primary/80 transition-colors';

  if (total === 0) return null;

  // Only render a real button when there is a handler; otherwise a tap on the
  // avatars would be a dead click that also swallows the parent card's click.
  const Wrapper = onClick ? 'button' : 'div';
  const wrapperProps = onClick
    ? { type: 'button', onClick: (e) => { e.stopPropagation(); onClick(); } }
    : {};

  return (
    <Wrapper
      {...wrapperProps}
      className="flex items-center gap-2 group"
    >
      <div className="flex -space-x-1.5">
        {shown.map((a, i) => {
          const initials = getInitials(a.display_name || '?');
          return a.avatar_url ? (
            <img
              key={a.id || i}
              src={a.avatar_url}
              alt=""
              className={`${dim} rounded-full ${ring} ring-background object-cover bg-surface-container`}
              loading="lazy"
            />
          ) : (
            <div
              key={a.id || i}
              className={`${dim} rounded-full ${ring} ring-background bg-primary/25 text-primary font-semibold flex items-center justify-center`}
            >
              {initials}
            </div>
          );
        })}
        {remaining > 0 && (
          <div className={`${dim} rounded-full ${ring} ring-background bg-surface-container text-on-surface-variant font-semibold flex items-center justify-center`}>
            +{remaining}
          </div>
        )}
      </div>
      <span className={`${labelClass} whitespace-nowrap`}>
        {total} {verb}
      </span>
    </Wrapper>
  );
}
