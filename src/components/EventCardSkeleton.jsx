/**
 * EventCardSkeleton — shimmer placeholder that mirrors EventCard's layout.
 *
 * Used in Discover (grid) and anywhere else cards load asynchronously.
 * Matches EventCard's aspect-ratio image, body height, and footer exactly
 * so there's zero layout shift when real cards swap in.
 */

function Shimmer({ className = '' }) {
  return (
    <div
      className={`rounded-lg bg-surface-container relative overflow-hidden ${className}`}
    >
      {/* Shimmer sweep */}
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.6s_infinite] bg-gradient-to-r from-transparent via-white/[0.04] to-transparent" />
    </div>
  );
}

export default function EventCardSkeleton() {
  return (
    <div className="rounded-xl overflow-hidden bg-surface-container-low border border-outline-variant/15 flex flex-col">
      {/* Image — same aspect-ratio as EventCard */}
      <div className="aspect-[4/3] relative overflow-hidden bg-surface-container">
        <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.6s_infinite] bg-gradient-to-r from-transparent via-white/[0.04] to-transparent" />

        {/* Tag stub top-right */}
        <div className="absolute top-2.5 right-2.5">
          <Shimmer className="h-5 w-14 rounded-full" />
        </div>
      </div>

      {/* Body */}
      <div className="p-4 flex flex-col flex-1 gap-3">
        {/* Title */}
        <Shimmer className="h-4 w-4/5" />
        <Shimmer className="h-3 w-3/5" />

        {/* Meta rows */}
        <div className="flex flex-col gap-1.5 mt-1">
          <Shimmer className="h-3 w-2/3" />
          <Shimmer className="h-3 w-1/2" />
        </div>

        {/* Social proof */}
        <Shimmer className="h-3 w-1/4" />

        {/* Footer */}
        <div className="flex items-center justify-between mt-auto pt-3 border-t border-outline-variant/15">
          <Shimmer className="h-4 w-10" />
          <Shimmer className="h-8 w-24 rounded-full" />
        </div>
      </div>
    </div>
  );
}

/**
 * EventListRowSkeleton — mirrors Discover's EventListRow (44px thumbnail,
 * title + meta line, price column) so the browse section doesn't jump from a
 * card grid to a list when data arrives.
 */
export function EventListRowSkeleton({ count = 6 }) {
  return (
    <div className="space-y-1" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-3 rounded-xl">
          <Shimmer className="w-11 h-11 rounded-lg flex-shrink-0" />
          <div className="flex-1 min-w-0 space-y-2">
            <Shimmer className="h-3.5 w-3/5" />
            <Shimmer className="h-3 w-2/5" />
          </div>
          <Shimmer className="h-3 w-10" />
        </div>
      ))}
    </div>
  );
}

/**
 * EventCardSkeletonGrid — drop-in for the Discover grid while events load.
 * @param {number} count  How many skeleton cards to render (default 8)
 */
export function EventCardSkeletonGrid({ count = 8 }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
      {Array.from({ length: count }, (_, i) => (
        <EventCardSkeleton key={i} />
      ))}
    </div>
  );
}
