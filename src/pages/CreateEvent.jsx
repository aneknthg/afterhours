/**
 * src/pages/CreateEvent.jsx
 *
 * Redesigned from 4-step wizard → single-page split layout.
 * Left: live event card preview (updates as you type).
 * Right: all form fields in one scrollable column.
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { resizeForUpload, COVER_MAX_WIDTH } from '../lib/image';
import { useToast } from '../components/Toast';
import { CAT_TAGS } from '../data/interests';
import { CAT_IMAGES } from '../lib/categoryImages';
import { eventsService } from '../services/events.service';
import { supabase } from '../lib/supabase';
import Footer from '../components/Footer';
import PayoutAccountCard from '../components/PayoutAccountCard';
import { fetchPayoutAccount } from '../lib/payouts.service';
import CustomDateTimePicker, { CustomTimePicker, toInputStr } from '../components/CustomDateTimePicker';

// ─── Constants ────────────────────────────────────────────────────────────────
const CATEGORIES = [
  { value: 'music',  label: 'Music',       icon: 'music_note' },
  { value: 'arts',   label: 'The Arts',    icon: 'palette' },
  { value: 'food',   label: 'Epicurean',   icon: 'restaurant' },
  { value: 'lit',    label: 'Literature',  icon: 'menu_book' },
  { value: 'sports', label: 'Sports',      icon: 'sports_tennis' },
  { value: 'film',   label: 'Cinema',      icon: 'movie' },
  { value: 'networking', label: 'Networking',  icon: 'work' },
  { value: 'other',       label: 'Other',  icon: 'star' },
];


const ACCESS_OPTIONS = [
  { value: 'open',     label: 'Open',           icon: 'public',     hint: 'Anyone can join' },
  { value: 'approval', label: 'Curator Approval', icon: 'how_to_reg', hint: 'You approve guests' },
];

const UNSPLASH_SUGGESTIONS = {
  music:  [
    'https://images.unsplash.com/photo-1501612780327-45045538702b?w=600&q=80',
    'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600&q=80',
    'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=600&q=80',
    'https://images.unsplash.com/photo-1506157154730-8f0745cc45a9?w=600&q=80',
    'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=600&q=80',
    'https://images.unsplash.com/photo-1471478331149-c72f17e33c73?w=600&q=80',
  ],
  arts:   [
    'https://images.unsplash.com/photo-1578926288207-a90a5366759d?w=600&q=80',
    'https://images.unsplash.com/photo-1561214115-f2f134cc4912?w=600&q=80',
    'https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?w=600&q=80',
    'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=600&q=80',
    'https://images.unsplash.com/photo-1452860606245-08befc0ff44b?w=600&q=80',
    'https://images.unsplash.com/photo-1547826039-a47c68ef7ef6?w=600&q=80',
  ],
  food:   [
    'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=600&q=80',
    'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&q=80',
    'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=600&q=80',
    'https://images.unsplash.com/photo-1559339352-11d035aa65de?w=600&q=80',
    'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=600&q=80',
    'https://images.unsplash.com/photo-1528605248644-14dd04022da1?w=600&q=80',
  ],
  lit:    [
    'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=600&q=80',
    'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=600&q=80',
    'https://images.unsplash.com/photo-1507842217343-583bb7270b66?w=600&q=80',
    'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=600&q=80',
    'https://images.unsplash.com/photo-1521587760476-6c12a4b040da?w=600&q=80',
    'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600&q=80',
  ],
  sports: [
    'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=600&q=80',
    'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=600&q=80',
    'https://images.unsplash.com/photo-1526676037777-05a232554f77?w=600&q=80',
    'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=600&q=80',
    'https://images.unsplash.com/photo-1546483875-ad9aa541af1a?w=600&q=80',
    'https://images.unsplash.com/photo-1540497077202-7c8a3999166f?w=600&q=80',
  ],
  film:   [
    'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=600&q=80',
    'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=600&q=80',
    'https://images.unsplash.com/photo-1478720568477-152d9b164e26?w=600&q=80',
    'https://images.unsplash.com/photo-1535016120720-40dce8a3253b?w=600&q=80',
    'https://images.unsplash.com/photo-1440404653325-ab127d49abc1?w=600&q=80',
    'https://images.unsplash.com/photo-1522869635100-9f4c5e86aa37?w=600&q=80',
  ],
  other: [
    'https://images.unsplash.com/photo-1531058020387-3be344556be6?w=600&q=80',
    'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=600&q=80',
    'https://images.unsplash.com/photo-1475721027785-f74eccf877e2?w=600&q=80',
    'https://images.unsplash.com/photo-1611996575749-79a3a250f948?w=600&q=80',
    'https://images.unsplash.com/photo-1453847668862-487637052f8a?w=600&q=80',
    'https://images.unsplash.com/photo-1505506874110-6a7a69069a08?w=600&q=80',
  ],
  networking: [
    'https://images.unsplash.com/photo-1515187029135-18ee286d815b?w=600&q=80',
    'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=600&q=80',
    'https://images.unsplash.com/photo-1582192730841-2a682d7375f9?w=600&q=80',
    'https://images.unsplash.com/photo-1552664730-d307ca884978?w=600&q=80',
    'https://images.unsplash.com/photo-1497366216548-37526070297c?w=600&q=80',
    'https://images.unsplash.com/photo-1491438590914-bc09fcaaf77a?w=600&q=80',
  ],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatPreviewDate(dtStr) {
  if (!dtStr) return null;
  try {
    const d = new Date(dtStr);
    return {
      weekday: d.toLocaleDateString('en-GB', { weekday: 'short' }),
      day:     d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
      time:    d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
    };
  } catch { return null; }
}

// ─── Location Picker (Nominatim / OpenStreetMap, via the geocode proxy) ──────
// Nominatim's usage policy prohibits bulk/client-side geocoding, so requests
// go through the `geocode` Edge Function (cached + rate-limited server-side)
// instead of calling nominatim.openstreetmap.org directly from the browser.

/**
 * LocationPicker
 * Props: venue, city, onSelect({ venue, city, fullAddress, lat, lng })
 */
function LocationPicker({ venue, city, onSelect }) {
  const [query, setQuery]           = useState(venue || '');
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen]             = useState(false);
  const [loading, setLoading]       = useState(false);
  const debounceRef                 = useRef(null);
  const controllerRef               = useRef(null);

  // Sync if parent resets
  useEffect(() => { setQuery(venue || ''); }, [venue]);

  const fetchSuggestions = useCallback(async (input) => {
    if (input.length < 2) { setSuggestions([]); setOpen(false); return; }

    // Abort any in-flight request
    if (controllerRef.current) controllerRef.current.abort();
    controllerRef.current = new AbortController();

    setLoading(true);
    try {
      // Proxied through the `geocode` Edge Function (cached + rate-limited server-side)
      // rather than calling Nominatim directly from the client.
      const { data, error } = await supabase.functions.invoke('geocode', {
        body: { query: input, limit: 6 },
        signal: controllerRef.current.signal,
      });
      if (error) throw error;
      const results = data?.results || [];
      setSuggestions(results);
      setOpen(results.length > 0);
    } catch (err) {
      if (err.name !== 'AbortError') setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  function handleChange(e) {
    const val = e.target.value;
    setQuery(val);
    onSelect({ venue: val, city, fullAddress: val, lat: null, lng: null });
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(val), 400);
  }

  function handleSelect(result) {
    setOpen(false);
    setSuggestions([]);

    // Extract a clean venue name — prefer display_name's first segment
    const addr     = result.address || {};
    const venueName =
      addr.amenity      ||
      addr.leisure      ||
      addr.tourism      ||
      addr.shop         ||
      addr.building     ||
      addr.road         ||
      result.display_name.split(',')[0];

    const resolvedCity =
      addr.city            ||
      addr.town            ||
      addr.village         ||
      addr.county          ||
      addr.state_district  ||
      addr.state           ||
      '';

    setQuery(venueName);
    onSelect({
      venue:       venueName,
      city:        resolvedCity,
      fullAddress: result.display_name,
      lat:         parseFloat(result.lat),
      lng:         parseFloat(result.lon),
    });
  }

  function handleClear() {
    setQuery('');
    setSuggestions([]);
    setOpen(false);
    onSelect({ venue: '', city: '', fullAddress: '', lat: null, lng: null });
  }

  // Pick an icon based on the OSM type/category
  function getIcon(result) {
    const cat = result.category || result.type || '';
    if (['amenity','leisure','tourism','shop','entertainment'].some(c => cat.includes(c))) return 'storefront';
    if (cat.includes('highway') || cat.includes('road')) return 'signpost';
    return 'location_on';
  }

  // Shorten the secondary line to just city + country
  function getSecondary(result) {
    const addr = result.address || {};
    const parts = [
      addr.city || addr.town || addr.village || addr.county || '',
      addr.country || '',
    ].filter(Boolean);
    return parts.join(', ') || result.display_name;
  }

  const inputClass = 'w-full bg-background border border-outline-variant/30 rounded-xl px-4 py-3 text-on-surface text-[16px] md:text-sm outline-none focus:border-primary/50 transition-colors placeholder:text-on-surface-variant/40';

  return (
    <div className="relative">
      {/* Search input */}
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-on-surface-variant text-base pointer-events-none">
          location_on
        </span>
        <input
          type="text"
          placeholder="Search for a venue or address *"
          value={query}
          onChange={handleChange}
          onFocus={() => query.length >= 2 && suggestions.length > 0 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 180)}
          className={`${inputClass} pl-9 pr-10`}
          autoComplete="off"
          spellCheck={false}
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {query && !loading && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface transition-colors"
          >
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        )}
      </div>

      {/* Dropdown */}
      {open && suggestions.length > 0 && (
        <div className="absolute z-50 left-0 right-0 top-[calc(100%+6px)] bg-surface-container-low border border-outline-variant/20 rounded-2xl shadow-2xl overflow-hidden">
          {suggestions.map((result) => (
            <button
              key={result.place_id}
              type="button"
              onMouseDown={() => handleSelect(result)}
              className="w-full flex items-start gap-3 px-4 py-3.5 hover:bg-surface-container transition-colors text-left border-b border-outline-variant/10 last:border-0"
            >
              <span
                className="material-symbols-outlined text-primary flex-shrink-0 mt-0.5"
                style={{ fontSize: 16 }}
              >
                {getIcon(result)}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-on-surface truncate">
                  {result.display_name.split(',')[0]}
                </p>
                <p className="text-xs text-on-surface-variant truncate mt-0.5">
                  {getSecondary(result)}
                </p>
              </div>
            </button>
          ))}
          {/* OSM attribution — required by Nominatim usage policy */}
          <div className="flex items-center gap-1.5 px-4 py-2 bg-surface-container/60">
            <span className="material-symbols-outlined text-on-surface-variant/50" style={{ fontSize: 11 }}>public</span>
            <span className="text-[10px] text-on-surface-variant/50">
              © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="underline hover:text-on-surface-variant">OpenStreetMap</a> contributors
            </span>
          </div>
        </div>
      )}

      {/* City chip — shows auto-resolved city after selection */}
      {city && (
        <div className="flex items-center gap-1.5 mt-2 text-xs text-on-surface-variant">
          <span className="material-symbols-outlined" style={{ fontSize: 12 }}>location_city</span>
          <span>{city}</span>
        </div>
      )}
    </div>
  );
}

// ─── Section label ────────────────────────────────────────────────────────────
function Label({ children }) {
  return (
    <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2">
      {children}

    </p>
  );
}

// ─── Field wrapper with subtle divider ───────────────────────────────────────
function Field({ children, className = '' }) {
  return <div className={`py-5 ${className}`}>{children}</div>;
}

// ─── Live Preview Card ────────────────────────────────────────────────────────
function PreviewCard({ form, onUpdateImage, onUploadFile, imageUploading }) {
  const [showPicker, setShowPicker] = useState(false);
  const [pickerTab, setPickerTab]   = useState('picks'); // 'picks' | 'url'
  const fileInputRef = useRef(null);
  const imgSrc    = form.imageUrl.trim() || CAT_IMAGES[form.category] || CAT_IMAGES.other;
  const dateInfo  = formatPreviewDate(form.date);
  const catObj    = CATEGORIES.find((c) => c.value === form.category);
  const accessObj = ACCESS_OPTIONS.find((a) => a.value === form.access);

  const suggestions = form.category ? (UNSPLASH_SUGGESTIONS[form.category] || []) : [];

  return (
    <div className="rounded-2xl overflow-hidden border border-outline-variant/20 bg-surface-container-low shadow-xl">
      {/* Cover image — click to open picker */}
      <div
        className="relative aspect-[4/3] overflow-hidden bg-surface-container cursor-pointer group"
        onClick={() => setShowPicker((v) => !v)}
      >
        {imgSrc ? (
          <img key={imgSrc} src={imgSrc} alt="" className="w-full h-full object-cover transition-opacity duration-500" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-on-surface-variant/40">
            <span className="material-symbols-outlined text-5xl">add_photo_alternate</span>
            <span className="text-xs font-bold uppercase tracking-widest">Add cover image</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />

        {/* Hover hint */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 text-white text-sm font-semibold pointer-events-none">
          <span className="material-symbols-outlined text-lg">add_photo_alternate</span>
          {imgSrc ? 'Change image' : 'Add image'}
        </div>

        {/* Category badge */}
        {catObj && (
          <div className="absolute top-4 left-4 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-white text-xs font-bold">
            <span className="material-symbols-outlined text-sm">{catObj.icon}</span>
            <span>{catObj.label}</span>
          </div>
        )}

        {/* Access badge */}
        <div className="absolute top-4 right-4 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-white text-xs font-bold">
          <span className="material-symbols-outlined text-xs">{accessObj?.icon || 'public'}</span>
          <span>{accessObj?.label || 'Open'}</span>
        </div>

        {/* Clear custom image */}
        {form.imageUrl.trim() && (
          <button
            onClick={(e) => { e.stopPropagation(); onUpdateImage(''); setShowPicker(false); }}
            className="absolute bottom-4 right-4 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors z-10"
          >
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        )}

        {/* Date overlay */}
        {dateInfo && (
          <div className="absolute bottom-4 left-4">
            <p className="text-white/70 text-xs font-bold uppercase tracking-widest">{dateInfo.weekday}</p>
            <p className="text-white text-2xl font-headline font-bold leading-tight">{dateInfo.day}</p>
            <p className="text-white/80 text-sm">{dateInfo.time}{form.endTime ? ` – ${form.endTime}` : ''}</p>
          </div>
        )}
      </div>

      {/* Inline image picker — expands inside the card below the cover */}
      {showPicker && (
        <div className="border-b border-outline-variant/15 bg-surface-container" onClick={(e) => e.stopPropagation()}>
          {/* Tab bar */}
          <div className="flex border-b border-outline-variant/15">
            {suggestions.length > 0 && (
              <button
                onClick={() => setPickerTab('picks')}
                className={`flex-1 py-2.5 text-[10px] font-bold uppercase tracking-widest transition-colors ${pickerTab === 'picks' ? 'text-primary border-b-2 border-primary -mb-px' : 'text-on-surface-variant/50 hover:text-on-surface-variant'}`}
              >
                Quick picks
              </button>
            )}
            <button
              onClick={() => setPickerTab('url')}
              className={`flex-1 py-2.5 text-[10px] font-bold uppercase tracking-widest transition-colors ${pickerTab === 'url' ? 'text-primary border-b-2 border-primary -mb-px' : 'text-on-surface-variant/50 hover:text-on-surface-variant'}`}
            >
              Paste URL
            </button>
            <label className={`flex-1 py-2.5 text-[10px] font-bold uppercase tracking-widest transition-colors cursor-pointer text-center ${imageUploading ? 'text-primary/50' : 'text-on-surface-variant/50 hover:text-on-surface-variant'}`}>
              {imageUploading ? 'Uploading…' : 'Upload'}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="sr-only"
                disabled={imageUploading}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) { onUploadFile(f); setShowPicker(false); } }}
              />
            </label>
          </div>

          <div className="px-4 py-4 space-y-3">
            {/* Quick picks grid */}
            {pickerTab === 'picks' && suggestions.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {suggestions.map((url, i) => (
                  <button
                    key={i}
                    onClick={() => { onUpdateImage(url); setShowPicker(false); }}
                    className={`aspect-video rounded-lg overflow-hidden border-2 transition-all ${
                      form.imageUrl === url ? 'border-primary' : 'border-transparent hover:border-primary/40'
                    }`}
                  >
                    <img src={url} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}

            {/* URL input */}
            {pickerTab === 'url' && (
              <div className="flex items-center gap-2">
                <input
                  type="url"
                  placeholder="Paste image URL…"
                  value={form.imageUrl}
                  onChange={(e) => onUpdateImage(e.target.value)}
                  className="flex-1 bg-background border border-outline-variant/30 rounded-xl px-3 py-2 text-on-surface text-[16px] md:text-sm outline-none focus:border-primary/50 transition-colors placeholder:text-on-surface-variant/40"
                />
                <button
                  onClick={() => setShowPicker(false)}
                  className="flex-shrink-0 w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center hover:bg-primary/20 transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">check</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Card body */}
      <div className="p-5">
        <h2 className="font-headline text-xl font-bold text-on-surface leading-snug mb-3 min-h-[1.75rem]">
          {form.name || <span className="text-on-surface-variant/40 font-normal italic">Event name…</span>}
        </h2>

        {(form.venue || form.city) && (
          <div className="flex items-center gap-2 text-sm text-on-surface-variant mb-2">
            <span className="material-symbols-outlined text-primary text-sm">location_on</span>
            <span>{[form.venue, form.city].filter(Boolean).join(', ')}</span>
          </div>
        )}

        {form.description && (
          <p className="text-xs text-on-surface-variant leading-relaxed mt-3 line-clamp-3">
            {form.description}
          </p>
        )}

        <div className="flex items-center justify-between mt-4 pt-4 border-t border-outline-variant/15">
          <div className="flex items-center gap-1.5 text-sm">
            <span className="material-symbols-outlined text-primary text-sm">confirmation_number</span>
            <span className="font-semibold text-on-surface">
              {form.price ? `₹${parseFloat(form.price).toFixed(0)}` : 'Free'}
            </span>
          </div>
          {form.capacity && (
            <div className="flex items-center gap-1.5 text-xs text-on-surface-variant">
              <span className="material-symbols-outlined text-sm">group</span>
              <span>{form.capacity} guests max</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function CreateEvent() {
  const { user, profile } = useAuth();
  const navigate  = useNavigate();
  const showToast = useToast();
  const formRef   = useRef(null);
  const [searchParams] = useSearchParams();
  const editEventId = searchParams.get('eventId');
  const isEditing = !!editEventId;

  const [form, setForm] = useState({
    name: '', category: '', date: '', endTime: '', venue: '', city: '',
    description: '', extras: '', imageUrl: '', capacity: '', price: '', access: 'open',
    womenOnly: false, fullAddress: '', lat: null, lng: null, tags: [],
  });
  const [error, setError]           = useState('');
  const [publishing, setPublishing] = useState(false);
  const [createdId, setCreatedId]   = useState(null);
  const [imageUploading, setImageUploading] = useState(false);

  // ── Edit mode: load the existing event and pre-fill the form ─────────────
  const [loadingEvent, setLoadingEvent] = useState(isEditing);
  const [loadError, setLoadError]       = useState('');

  useEffect(() => {
    if (!isEditing || !user?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const ev = await eventsService.fetchById(editEventId);
        if (cancelled) return;
        if (ev.creator_id !== user.id) {
          setLoadError("You don't have permission to edit this event.");
          return;
        }
        const priceDigits = (ev.price || '').replace(/[^0-9]/g, '');
        setForm({
          name:        ev.title || '',
          category:    ev.category || '',
          date:        ev.starts_at ? toInputStr(new Date(ev.starts_at)) : '',
          endTime:     ev.end_time || '',
          venue:       ev.venue || '',
          city:        ev.city || '',
          description: ev.description || '',
          extras:      ev.extras || '',
          imageUrl:    ev.image_url || '',
          capacity:    ev.capacity != null ? String(ev.capacity) : '',
          price:       ev.price === 'Free' ? '' : priceDigits,
          access:      ev.access || 'open',
          womenOnly:   !!ev.women_only,
          fullAddress: '', lat: null, lng: null,
          tags:        ev.tags || [],
        });
      } catch {
        if (!cancelled) setLoadError('Could not load this event.');
      } finally {
        if (!cancelled) setLoadingEvent(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isEditing, editEventId, user?.id]);

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (error) setError('');
  }

  async function handleImageUpload(file) {
    if (!user?.id) return;
    if (!file.type.startsWith('image/')) { showToast('Please select an image file.'); return; }
    if (file.size > 5 * 1024 * 1024) { showToast('Image must be under 5 MB.'); return; }
    setImageUploading(true);
    try {
      // Shrink before storing. A cover is card art, not an archive print, and
      // the original was being served in full to every Discover card.
      const upload = await resizeForUpload(file, COVER_MAX_WIDTH);
      // Always .jpg when the resize actually re-encoded, or the bucket serves a
      // PNG-named JPEG. If resizeForUpload handed the original back untouched,
      // keep its real extension.
      const ext = upload === file ? file.name.split('.').pop().toLowerCase() : 'jpg';
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from('event-covers').upload(path, upload, { upsert: true });
      if (uploadErr) throw uploadErr;
      const { data: { publicUrl } } = supabase.storage.from('event-covers').getPublicUrl(path);
      update('imageUrl', publicUrl);
      showToast('Image uploaded!');
    } catch {
      showToast('Upload failed. Try pasting a URL instead.');
    } finally {
      setImageUploading(false);
    }
  }

  function validate() {
    if (!form.name.trim())  { setError('Give your event a name.'); return false; }
    if (!form.category)     { setError('Pick a category.'); return false; }
    if (!form.date)         { setError('Set a start date and time.'); return false; }
    if (!form.venue.trim()) { setError('Add a venue or location.'); return false; }
    return true;
  }

  /**
   * A paid event cannot go live until the host has somewhere to be paid.
   *
   * The PayoutAccountCard above has been shown whenever a price is set, but
   * showing a form is not the same as requiring it — before this, a host could
   * scroll past it and publish. run-payouts then skips a host with no account,
   * so her money sat in the platform balance with no instruction. Mirrors
   * payoutDetailsMissing in Afterhours-App-main's create screen.
   */
  async function payoutDetailsMissing() {
    if (!(Number(form.price) > 0)) return false;
    try {
      const account = await fetchPayoutAccount();
      if (account) return false;
      setError('Add your payout details above before publishing a paid event.');
      return true;
    } catch {
      // A dropped read is not the same as having no details — do not block a
      // host over a bad connection.
      setError('We could not check your payout details. Check your connection and try again.');
      return true;
    }
  }

  async function handlePublish() {
    if (!user?.id) { setError('You must be logged in.'); return; }
    if (!validate()) {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    setPublishing(true);
    setError('');

    if (await payoutDetailsMissing()) {
      setPublishing(false);
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    const startDate  = new Date(form.date);
    const priceStr   = form.price ? `₹${parseFloat(form.price).toFixed(0)}` : 'Free';
    // price_paise is what checkout charges against; `price` stays the display
    // mirror. Written together so a listed price can never be chargeable
    // without the host having actually set one.
    const pricePaise = form.price ? Math.round(parseFloat(form.price) * 100) : 0;
    const dateDisplay = startDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) +
      ' · ' + startDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

    const eventData = {
      title:       form.name.trim(),
      category:    form.category,
      venue:       form.venue.trim(),
      // The location picker only sets a city when the host picks a geocoded
      // suggestion. Free-typed venues leave form.city blank, which silently
      // hides the event from Discover (sameCity() never matches an empty
      // city). Fall back to the host's own profile city in that case.
      city:        form.city.trim() || profile?.city?.trim() || '',
      date:        dateDisplay,
      starts_at:   startDate.toISOString(),
      end_time:    form.endTime || '',
      price:       priceStr,
      price_paise: pricePaise,
      tag:         form.category.charAt(0).toUpperCase() + form.category.slice(1),
      description: form.description.trim(),
      extras:      form.extras.trim(),
      capacity:    parseInt(form.capacity, 10) > 0 ? parseInt(form.capacity, 10) : null,
      access:      form.access,
      women_only:  form.womenOnly,
      image_url:   form.imageUrl.trim() || CAT_IMAGES[form.category] || CAT_IMAGES.other,
      tags:        form.tags,
    };

    try {
      if (isEditing) {
        await eventsService.update(editEventId, eventData);
        showToast('Event updated!');
        navigate(`/event/${editEventId}`);
        return;
      }

      const created = await eventsService.create({ ...eventData, creator_id: user.id });
      // Auto-RSVP the host so the event chat appears in their chat list immediately
      await supabase.from('rsvps').upsert(
        { user_id: user.id, event_id: created.id },
        { onConflict: 'user_id,event_id', ignoreDuplicates: true }
      );
      setCreatedId(created.id);
      showToast(`${form.name.trim()} is live!`);
      setTimeout(() => navigate(`/event/${created.id}`), 1200);
    } catch (err) {
      setError(err.message || 'Failed to publish.');
      setPublishing(false);
    }
  }

  const inputClass = 'w-full bg-background border border-outline-variant/30 rounded-xl px-4 py-3 text-on-surface text-[16px] md:text-sm outline-none focus:border-primary/50 transition-colors placeholder:text-on-surface-variant/40';

  return (
    <div className="page-enter min-h-screen overflow-x-hidden">
      <div className="max-w-screen-xl mx-auto px-4 md:px-10 pt-10 pb-20">

        {/* Page title */}
        <div className="mb-8">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-on-surface-variant hover:text-on-surface transition-colors mb-4 text-sm"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_back</span>
            Back
          </button>
          <span className="text-primary text-xs uppercase tracking-widest font-bold block mb-2">
            {isEditing ? 'Manage Event' : 'New Event'}
          </span>
          <h1 className="font-headline text-4xl md:text-5xl font-bold text-on-surface">
            {isEditing ? 'Edit your event' : 'Create an event'}
          </h1>
          <p className="mt-2 text-on-surface-variant">
            {isEditing
              ? 'Update the details, or change who can join.'
              : 'Fill in the details. Your preview updates as you go.'}
          </p>
        </div>

        {loadingEvent ? (
          <div className="flex items-center justify-center py-24 gap-3 text-on-surface-variant">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            Loading event…
          </div>
        ) : loadError ? (
          <div className="max-w-lg mx-auto text-center py-24">
            <span className="material-symbols-outlined text-error text-4xl mb-3 block">error</span>
            <p className="text-on-surface font-semibold mb-1">{loadError}</p>
            <button onClick={() => navigate('/my-events')} className="text-primary text-sm font-bold hover:underline mt-2 cursor-pointer">
              Back to My Events
            </button>
          </div>
        ) : (
        <>
        {/* Split layout */}
        <div className="flex flex-col lg:flex-row gap-8 lg:gap-12 lg:items-start">

          {/* ── LEFT: sticky preview ── */}
          <div className="w-full lg:w-[380px] lg:sticky lg:top-6 lg:self-start flex-shrink-0">
            <PreviewCard
              form={form}
              onUpdateImage={(url) => update('imageUrl', url)}
              onUploadFile={handleImageUpload}
              imageUploading={imageUploading}
            />

            {/* Publish button on desktop — sits below the card */}
            <div className="hidden lg:block mt-4 space-y-3">
              {error && (
                <div className="px-4 py-3 rounded-xl bg-error/10 border border-error/30 text-error text-sm flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm flex-shrink-0">error</span>
                  {error}
                </div>
              )}
              {createdId ? (
                <button
                  onClick={() => navigate(`/event/${createdId}`)}
                  className="w-full py-4 rounded-xl bg-primary/10 border border-primary/30 text-primary font-bold text-sm hover:bg-primary/20 transition-all flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-base">open_in_new</span>
                  View your event
                </button>
              ) : (
                <button
                  onClick={handlePublish}
                  disabled={publishing}
                  className="w-full py-4 rounded-xl bg-primary text-on-primary font-bold text-sm hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-base">rocket_launch</span>
                  {publishing ? 'Publishing…' : isEditing ? 'Save changes' : 'Publish Event'}
                </button>
              )}
            </div>
          </div>

          {/* ── RIGHT: form ── */}
          <div ref={formRef} className="w-full flex-1 min-w-0 bg-surface-container-low border border-outline-variant/20 rounded-2xl divide-y divide-outline-variant/15 overflow-hidden">

            {/* Event name — big inline input like Luma */}
            <div className="px-4 md:px-6 py-5">
              <input
                type="text"
                placeholder="Event Name"
                value={form.name}
                onChange={(e) => update('name', e.target.value)}
                maxLength={80}
                className="w-full bg-transparent text-on-surface text-2xl font-headline font-bold outline-none placeholder:text-on-surface-variant/30 placeholder:font-normal"
              />
            </div>

            {/* Date & Time */}
            <Field className="px-4 md:px-6">
              <Label>Date & Time</Label>

              {/* Mobile: date full width, then start + end time together */}
              <div className="flex flex-col gap-2 sm:hidden">
                <div>
                  <p className="text-xs text-on-surface-variant mb-1.5">Date *</p>
                  <CustomDateTimePicker value={form.date} onChange={(v) => update('date', v)} dateOnly />
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <p className="text-xs text-on-surface-variant mb-1.5">Start time *</p>
                    <CustomDateTimePicker value={form.date} onChange={(v) => update('date', v)} timeOnly />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-on-surface-variant mb-1.5">End time</p>
                    <CustomTimePicker value={form.endTime} onChange={(v) => update('endTime', v)} />
                  </div>
                </div>
              </div>

              {/* Desktop: original layout */}
              <div className="hidden sm:flex sm:flex-row gap-3">
                <div className="flex-1">
                  <p className="text-xs text-on-surface-variant mb-1.5">Start *</p>
                  <CustomDateTimePicker value={form.date} onChange={(v) => update('date', v)} />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-on-surface-variant mb-1.5">End time</p>
                  <CustomTimePicker value={form.endTime} onChange={(v) => update('endTime', v)} />
                </div>
              </div>
            </Field>

            {/* Location */}
            <Field className="px-4 md:px-6">
              <Label>Location</Label>
              <LocationPicker
                venue={form.venue}
                city={form.city}
                onSelect={({ venue, city, fullAddress, lat, lng }) =>
                  setForm((f) => ({ ...f, venue, city, fullAddress, lat, lng }))
                }
              />
            </Field>

            {/* Category */}
            <Field className="px-4 md:px-6">
              <Label>Category *</Label>
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                {CATEGORIES.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => { update('category', c.value); update('tags', []); }}
                    className={`flex flex-col items-center gap-1 p-2.5 rounded-xl text-center transition-all border ${
                      form.category === c.value
                        ? 'bg-primary/10 border-primary/40 text-primary'
                        : 'bg-background border-outline-variant/20 text-on-surface-variant hover:border-outline-variant/50'
                    }`}
                  >
                    <span className="material-symbols-outlined text-xl">{c.icon}</span>
                    <span className="text-[10px] font-bold leading-tight">{c.label}</span>
                  </button>
                ))}
              </div>
            </Field>

            {/* Interest Tags */}
            {form.category && CAT_TAGS[form.category]?.length > 0 && (
              <Field className="px-4 md:px-6">
                <Label>Interest Tags</Label>
                <p className="text-xs text-on-surface-variant/60 mb-3">
                  Tag your event so attendees find it through their interests.
                </p>
                <div className="flex flex-wrap gap-2">
                  {CAT_TAGS[form.category].map((tag) => {
                    const active = form.tags.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => update('tags', active
                          ? form.tags.filter((t) => t !== tag)
                          : [...form.tags, tag]
                        )}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${
                          active
                            ? 'bg-primary text-on-primary border-primary'
                            : 'bg-background border-outline-variant/30 text-on-surface-variant hover:border-primary/40 hover:text-on-surface'
                        }`}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
                {form.tags.length > 0 && (
                  <p className="text-xs text-primary/80 mt-2">
                    {form.tags.length} tag{form.tags.length > 1 ? 's' : ''} selected
                  </p>
                )}
              </Field>
            )}

            {/* Description */}
            <Field className="px-4 md:px-6">
              <Label>Description</Label>
              <textarea
                rows={4}
                placeholder="Set the scene. What should guests expect?"
                value={form.description}
                onChange={(e) => update('description', e.target.value)}
                className={`${inputClass} resize-none`}
              />
            </Field>

            {/* What to expect */}
            <Field className="px-4 md:px-6">
              <Label>What to Expect</Label>
              <input
                type="text"
                placeholder="Dress code, what to bring, anything special…"
                value={form.extras}
                onChange={(e) => update('extras', e.target.value)}
                className={inputClass}
              />
              <p className="text-xs text-on-surface-variant/70 mt-1.5">e.g. Smart attire · Bring a notebook</p>
            </Field>

            {/* Event Options — like Luma's bottom row */}
            <Field className="px-4 md:px-6">
              <Label>Event Options</Label>
              <div className="space-y-0 divide-y divide-outline-variant/15 rounded-xl overflow-hidden border border-outline-variant/20">

                {/* Ticket price */}
                <div className="flex items-center justify-between px-4 py-3.5 bg-background gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="material-symbols-outlined text-on-surface-variant text-base">confirmation_number</span>
                    <span className="text-sm text-on-surface">Ticket Price</span>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm pointer-events-none">₹</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      placeholder="Free"
                      value={form.price}
                      onChange={(e) => {
                        const v = e.target.value.replace(/[^0-9]/g, '');
                        update('price', v);
                      }}
                      className="w-28 bg-surface-container border border-outline-variant/30 rounded-lg pl-7 pr-3 py-1.5 text-sm text-on-surface outline-none focus:border-primary/50 transition-colors text-right"
                    />
                  </div>
                </div>

                {/* Only once she is actually charging. A host running a free
                    event never sees a bank form, and a host who already saved
                    details in her profile just sees them confirmed here. */}
                {Number(form.price) > 0 && (
                  <div className="px-4 py-3.5 bg-background">
                    <PayoutAccountCard context="create" />
                  </div>
                )}

                {/* Access / Approval */}
                <div className="flex items-center justify-between px-4 py-3.5 bg-background">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-on-surface-variant text-base">how_to_reg</span>
                    <span className="text-sm text-on-surface">Access</span>
                  </div>
                  <select
                    value={form.access}
                    onChange={(e) => update('access', e.target.value)}
                    className="bg-surface-container border border-outline-variant/30 rounded-lg px-3 py-1.5 text-sm text-on-surface outline-none focus:border-primary/50 transition-colors [color-scheme:dark]"
                  >
                    {ACCESS_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label} — {o.hint}</option>
                    ))}
                  </select>
                </div>

                {/* Capacity */}
                <div className="flex items-center justify-between px-4 py-3.5 bg-background gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="material-symbols-outlined text-on-surface-variant text-base">group</span>
                    <span className="text-sm text-on-surface">Capacity</span>
                  </div>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="Unlimited"
                    value={form.capacity}
                    onChange={(e) => {
                      const v = e.target.value.replace(/[^0-9]/g, '');
                      update('capacity', v);
                    }}
                    className="w-28 bg-surface-container border border-outline-variant/30 rounded-lg px-3 py-1.5 text-[16px] md:text-sm text-on-surface outline-none focus:border-primary/50 transition-colors text-right placeholder:text-on-surface-variant/50"
                  />
                </div>

              </div>
            </Field>

          </div>{/* end form column */}
        </div>{/* end split layout */}

        {/* Mobile publish button */}
        <div className="lg:hidden mt-6 space-y-3">
          {error && (
            <div className="px-4 py-3 rounded-xl bg-error/10 border border-error/30 text-error text-sm flex items-center gap-2">
              <span className="material-symbols-outlined text-sm flex-shrink-0">error</span>
              {error}
            </div>
          )}
          {createdId ? (
            <button
              onClick={() => navigate(`/event/${createdId}`)}
              className="w-full py-4 rounded-xl bg-primary/10 border border-primary/30 text-primary font-bold text-sm hover:bg-primary/20 transition-all flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-base">open_in_new</span>
              View your event
            </button>
          ) : (
            <button
              onClick={handlePublish}
              disabled={publishing}
              className="w-full py-4 rounded-xl bg-primary text-on-primary font-bold text-sm hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-60 flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-base">rocket_launch</span>
              {publishing ? 'Publishing…' : isEditing ? 'Save changes' : 'Publish Event'}
            </button>
          )}
        </div>
        </>
        )}

      </div>
      <Footer />
    </div>
  );
}
