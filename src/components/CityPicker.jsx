import { useState, useRef, useEffect } from 'react';
import { CITIES, POPULAR_CITIES, canonicalCity, matchCities } from '../lib/city';

/**
 * CityPicker
 * Type-to-filter over the fixed CITIES list. Previously this searched Nominatim,
 * which let two people in the same city store different strings — one picks the
 * suburb ("Madhapur"), one picks the city ("Hyderabad"), and sameCity() stops
 * matching them, silently emptying Discover, Search and People for one of them.
 * Selection is now constrained to canonical values.
 *
 * Only a real pick calls onChange. Typing does not, so a half-typed or misspelt
 * city can never reach the profile row.
 *
 * Props:
 *   value        {string}  — controlled display value
 *   onChange     {fn}      — called with { city, country } on pick or clear
 *   placeholder  {string}  — input placeholder
 *   className    {string}  — extra classes for the wrapper div
 */
export default function CityPicker({ value = '', onChange, placeholder = 'Search for your city…', className = '', autoFocus = false }) {
  const [query, setQuery] = useState(value);
  const [open, setOpen]   = useState(false);
  const blurRef           = useRef(null);

  // Sync if parent resets the value
  useEffect(() => { setQuery(value); }, [value]);
  useEffect(() => () => clearTimeout(blurRef.current), []);

  const q = query.trim().toLowerCase();
  // Once the text is already an exact city the list has nothing left to offer.
  const isExact     = CITIES.some((c) => c.toLowerCase() === q);
  const suggestions = q && !isExact ? matchCities(q) : [];
  // Nothing typed yet — offer the popular cities rather than an empty dropdown.
  const chips = !q ? POPULAR_CITIES.slice(0, 6) : [];

  function handleChange(e) {
    setQuery(e.target.value);
    setOpen(true);
    // Deliberately no onChange here. An unconfirmed string is not a city.
  }

  function handleSelect(city) {
    setOpen(false);
    setQuery(city);
    onChange({ city, country: 'India' });
  }

  function handleClear() {
    setQuery('');
    setOpen(false);
    onChange({ city: '', country: '' });
  }

  // Typing a full city name and tabbing away is a pick in everything but name.
  function handleBlur() {
    blurRef.current = setTimeout(() => {
      setOpen(false);
      const match = canonicalCity(query);
      if (match) {
        setQuery(match);
        // Blur fires right after a click-pick; don't re-commit the same city and
        // set a second profile auto-save going.
        if (match !== value) onChange({ city: match, country: 'India' });
      } else if (query.trim() && query !== value) setQuery(value);
    }, 180);
  }

  const inputBase = 'w-full bg-background border border-outline-variant/30 rounded-xl px-4 py-3 text-on-surface text-[16px] md:text-sm outline-none focus:border-primary/50 transition-colors placeholder:text-on-surface-variant/40';

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-on-surface-variant text-base pointer-events-none">
          location_city
        </span>
        <input
          type="text"
          autoFocus={autoFocus}
          placeholder={placeholder}
          value={query}
          onChange={handleChange}
          onFocus={() => setOpen(true)}
          onBlur={handleBlur}
          className={`${inputBase} pl-9 pr-10`}
          // Chrome ignores autocomplete="off" for fields it reads as an address
          // ("Where are you based?" + "city" trigger its address heuristics), so
          // we use new-password — the value Chrome reliably won't autofill — plus
          // a non-address name and password-manager opt-outs.
          autoComplete="new-password"
          name="afterhours-city-search"
          data-1p-ignore
          data-lpignore="true"
          data-form-type="other"
          spellCheck={false}
        />
        {query && (
          <button
            type="button"
            onClick={handleClear}
            aria-label="Clear city"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface transition-colors"
          >
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        )}
      </div>

      {open && (suggestions.length > 0 || chips.length > 0) && (
        <div className="absolute z-50 left-0 right-0 top-[calc(100%+6px)] bg-surface-container-low border border-outline-variant/20 rounded-2xl shadow-2xl overflow-hidden">
          {chips.length > 0 && (
            <p className="px-4 pt-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50">
              Popular cities
            </p>
          )}
          {(suggestions.length ? suggestions : chips).map((city) => (
            <button
              key={city}
              type="button"
              onMouseDown={() => handleSelect(city)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-container transition-colors text-left border-b border-outline-variant/10 last:border-0"
            >
              <span className="material-symbols-outlined text-primary flex-shrink-0" style={{ fontSize: 15 }}>
                location_on
              </span>
              <p className="text-sm font-semibold text-on-surface truncate">{city}</p>
            </button>
          ))}
        </div>
      )}

      {/* Nothing matched — say so, instead of leaving a dead input. */}
      {open && q && !isExact && suggestions.length === 0 && (
        <div className="absolute z-50 left-0 right-0 top-[calc(100%+6px)] bg-surface-container-low border border-outline-variant/20 rounded-2xl shadow-2xl px-4 py-3">
          <p className="text-sm text-on-surface-variant">
            We're not in that city yet. Pick the nearest one we're in.
          </p>
        </div>
      )}
    </div>
  );
}
