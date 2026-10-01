const DATE_MOODS = [
  { id: 'all',     label: 'All',          icon: 'grid_view' },
  { id: 'tonight', label: 'Tonight',      icon: 'nights_stay' },
  { id: 'tomorrow',label: 'Tomorrow',     icon: 'wb_twilight' },
  { id: 'weekend', label: 'This weekend', icon: 'weekend' },
  { id: 'week',    label: 'This week',    icon: 'date_range' },
  { id: 'free',    label: 'Free',         icon: 'volunteer_activism' },
];

const CATEGORIES = [
  { id: 'all',      label: 'All' },
  { id: 'music',    label: 'Music' },
  { id: 'arts',     label: 'Arts' },
  { id: 'food',     label: 'Epicurean' },
  { id: 'lit',      label: 'Literature' },
  { id: 'sports',   label: 'Sports' },
  { id: 'film',     label: 'Film' },
  { id: 'wellness', label: 'Wellness' },
  { id: 'tech',     label: 'Tech' },
];

export default function MoodFilter({
  activeMood = 'all',
  activeCat  = 'all',
  onMoodChange,
  onCatChange,
}) {
  return (
    <div className="space-y-3 mb-6">

      {/* ── Row 1: When ─────────────────────────────────────────────── */}
      <div>
        <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-on-surface-variant/40 mb-2 px-0.5">
          WHEN
        </p>
        <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
          {DATE_MOODS.map(mood => {
            const isActive = activeMood === mood.id;
            return (
              <button
                key={mood.id}
                onClick={() => onMoodChange?.(mood.id)}
                aria-pressed={isActive}
                aria-label={mood.label}
                className={[
                  'flex-shrink-0 flex items-center gap-1.5 px-4 min-h-[44px] rounded-full text-xs font-bold',
                  'transition-all duration-200 select-none',
                  isActive
                    ? 'bg-primary text-on-primary shadow-glow scale-[1.02]'
                    : 'bg-surface-container text-on-surface-variant border border-outline-variant/30 hover:border-primary/40 hover:text-on-surface',
                ].join(' ')}
              >
                <span
                  className="material-symbols-outlined"
                  style={{
                    fontSize: 14,
                    fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0",
                  }}
                >
                  {mood.icon}
                </span>
                {mood.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Row 2: Category ──────────────────────────────────────────── */}
      <div>
        <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-on-surface-variant/40 mb-2 px-0.5">
          CATEGORY
        </p>
        <div className="flex gap-1.5 overflow-x-auto hide-scrollbar pb-1">
          {CATEGORIES.map(cat => {
            const isActive = activeCat === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => onCatChange?.(cat.id)}
                aria-pressed={isActive}
                aria-label={cat.label}
                className={[
                  'flex-shrink-0 px-4 min-h-[44px] rounded-xl text-xs font-bold uppercase tracking-wide transition-all duration-200 select-none',
                  isActive
                    ? 'bg-on-surface text-surface'
                    : 'bg-surface-container text-on-surface-variant border border-outline-variant/30 hover:border-primary/40 hover:text-on-surface',
                ].join(' ')}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>

    </div>
  );
}

/**
 * applyMoodFilter — filters events by mood (date), category, and city.
 */
export function applyMoodFilter(events, mood, cat, city) {
  let result = events;

  if (cat !== 'all') {
    result = result.filter(e => e.cat === cat || e.category === cat);
  }
  if (city !== 'all') {
    result = result.filter(e => e.city && e.city.toLowerCase() === city.toLowerCase());
  }

  const today = new Date();
  const todayStr = today.toDateString();

  switch (mood) {
    case 'tonight':
      result = result.filter(e => {
        if (e.date?.toLowerCase().includes('tonight')) return true;
        if (e.starts_at) return new Date(e.starts_at).toDateString() === todayStr;
        return false;
      });
      break;
    case 'tomorrow': {
      const tom = new Date(today); tom.setDate(today.getDate() + 1);
      const tomStr = tom.toDateString();
      result = result.filter(e => {
        if (e.starts_at) return new Date(e.starts_at).toDateString() === tomStr;
        return e.date?.toLowerCase().includes('tomorrow');
      });
      break;
    }
    case 'weekend': {
      const dayOfWeek = today.getDay();
      // On Sunday "this weekend" is yesterday+today, not next weekend.
      const daysToSat = dayOfWeek === 0 ? -1 : (6 - dayOfWeek);
      const sat = new Date(today); sat.setDate(today.getDate() + daysToSat);
      const sun = new Date(sat);   sun.setDate(sat.getDate() + 1);
      result = result.filter(e => {
        if (/sat|sun|weekend/i.test(e.date || '')) return true;
        if (e.starts_at) {
          const d = new Date(e.starts_at);
          return d.toDateString() === sat.toDateString() || d.toDateString() === sun.toDateString();
        }
        return false;
      });
      break;
    }
    case 'week': {
      const weekEnd = new Date(today); weekEnd.setDate(today.getDate() + 7);
      result = result.filter(e => {
        if (e.starts_at) {
          const d = new Date(e.starts_at);
          return d >= today && d <= weekEnd;
        }
        return /tonight|tomorrow|this week|sat|sun|mon|tue|wed|thu|fri/i.test(e.date || '');
      });
      break;
    }
    case 'free':
      result = result.filter(e => !e.price || /^(free|\$0|0)$/i.test(String(e.price).trim()));
      break;
    default: break;
  }

  return result;
}
