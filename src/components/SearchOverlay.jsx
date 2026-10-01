import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { EVENTS_DB, CAT_ICONS, CAT_LABELS, FILTER_CATS } from '../data/events';
import { supabase } from '../lib/supabase';
import { useVerificationGate } from '../lib/VerificationGate';
import { useAuth } from '../lib/AuthContext';
import { LAUNCH_CITY, sameCity } from '../lib/city';
import EmptyState from './EmptyState';
import Button from './ui/Button';
import Tag from './ui/Tag';

let _cachedUserEvents = [];
let _cacheTimestamp   = 0;
const CACHE_TTL_MS    = 60_000;

// Every key in FILTER_CATS needs a label here, or the chip renders empty.
const PILL_LABELS = {
  all: 'All', music: 'Music', arts: 'Arts',
  food: 'Epicurean', lit: 'Literature', sports: 'Sports', film: 'Film',
  networking: 'Networking',
};

export default function SearchOverlay({ isOpen, onClose }) {
  const [query, setQuery]       = useState('');
  const [filter, setFilter]     = useState('all');
  const [activeIdx, setActiveIdx] = useState(-1);
  const [userEvents, setUserEvents] = useState(_cachedUserEvents);
  const inputRef = useRef(null);
  const navigate = useNavigate();
  const requireVerified = useVerificationGate();
  const { profile } = useAuth();

  useEffect(() => {
    if (!isOpen) return;
    setQuery(''); setFilter('all'); setActiveIdx(-1);
    setTimeout(() => inputRef.current?.focus(), 80);

    const now = Date.now();
    if (now - _cacheTimestamp < CACHE_TTL_MS) {
      setUserEvents(_cachedUserEvents);
      return;
    }

    supabase.from('events').select('*').order('created_at', { ascending: false })
      .then(({ data }) => {
        const ts = new Date().toISOString();
        const mapped = (data || [])
          .filter((ev) => !ev.starts_at || ev.starts_at > ts)
          .map((ev) => ({
            id: ev.id, title: ev.title, cat: ev.category, venue: ev.venue,
            city: ev.city || '', date: ev.date, price: ev.price,
            tag: ev.tag || ev.category, img: ev.image_url,
          }));
        _cachedUserEvents = mapped;
        _cacheTimestamp   = Date.now();
        setUserEvents(mapped);
      });
  }, [isOpen]);

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape' && isOpen) onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  // Search is scoped to the user's city. Curated seed events have no city, so
  // they're treated as the launch city.
  const curatedIds = new Set(EVENTS_DB.map((e) => String(e.id)));
  const allEvents  = [
    ...EVENTS_DB.map((e) => ({ ...e, city: e.city || LAUNCH_CITY })),
    ...userEvents.filter((ue) => !curatedIds.has(String(ue.id))),
  ].filter((e) => sameCity(e.city, profile?.city));

  const trim = query.trim().toLowerCase();
  const results = allEvents.filter((ev) => {
    const matchCat = filter === 'all' || ev.cat === filter;
    // FIX: Search across title, venue, city, tag, and price — not just title
    const matchQ   = !trim
      || ev.title.toLowerCase().includes(trim)
      || ev.venue.toLowerCase().includes(trim)
      || (ev.city || '').toLowerCase().includes(trim)
      || (ev.tag || '').toLowerCase().includes(trim)
      || (ev.price || '').toLowerCase().includes(trim)
      || (ev.date || '').toLowerCase().includes(trim);
    return matchCat && matchQ;
  });

  const showGrouped = !trim && filter === 'all';

  function handleSelect(ev) {
    onClose();
    requireVerified(() => navigate(`/event/${ev.id}`));
  }

  function handleKeyDown(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && activeIdx >= 0 && results[activeIdx]) { e.preventDefault(); handleSelect(results[activeIdx]); }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[300] bg-background/95 backdrop-blur-2xl">
      {/* Top bar */}
      <div className="flex items-center gap-4 px-6 py-5 max-w-3xl mx-auto border-b border-outline-variant/20">
        <span className="material-symbols-outlined text-primary flex-shrink-0">search</span>
        <input
          ref={inputRef}
          type="text"
          placeholder="Search by name, venue, or city…"
          autoComplete="off"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setActiveIdx(-1); }}
          onKeyDown={handleKeyDown}
          className="flex-1 bg-transparent border-none outline-none text-on-surface text-lg font-body"
        />
        <button
          onClick={onClose}
          aria-label="Close search"
          className="p-2 rounded-xl text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-all"
        >
          <span className="material-symbols-outlined">close</span>
        </button>
      </div>

      {/* Filter pills */}
      <div className="flex gap-2 px-6 py-3 max-w-3xl mx-auto overflow-x-auto hide-scrollbar">
        {FILTER_CATS.map((cat) => (
          <button
            key={cat}
            onClick={() => { setFilter(cat); setActiveIdx(-1); }}
            className={`flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide transition-all border ${
              filter === cat
                ? 'bg-primary text-on-primary border-primary'
                : 'bg-transparent text-on-surface-variant border-outline-variant/30 hover:bg-surface-container'
            }`}
          >
            {PILL_LABELS[cat]}
          </button>
        ))}
      </div>

      {/* Results */}
      <div className="max-w-3xl mx-auto px-6 pb-10 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 140px)' }}>
        {!profile?.city ? (
          <EmptyState
            icon="location_city"
            title="Where are you?"
            body="Set your city to search events near you. You can change it anytime in your profile."
            ctaLabel="Choose your city"
            onCta={() => { onClose(); navigate('/profile?edit=city'); }}
          />
        ) : results.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <span className="material-symbols-outlined text-on-surface-variant mb-4 text-5xl">search_off</span>
            <h3 className="font-headline text-xl font-bold text-on-surface mb-2">Nothing found</h3>
            <p className="text-on-surface-variant text-sm max-w-xs mb-6">
              No events match &ldquo;{query}&rdquo;. Try a different name, venue, or city.
            </p>
            <Button variant="primary" size="sm" onClick={() => { setQuery(''); setFilter('all'); }}>
              Browse All
            </Button>
          </div>
        ) : showGrouped ? (
          Object.entries(CAT_LABELS).map(([key, label]) => {
            const group = results.filter((e) => e.cat === key);
            if (!group.length) return null;
            return (
              <div key={key}>
                <div className="text-xs text-on-surface-variant uppercase tracking-widest font-bold pt-4 pb-2">{label}</div>
                {group.map((ev) => <SearchRow key={ev.id} event={ev} onClick={() => handleSelect(ev)} />)}
              </div>
            );
          })
        ) : (
          <>
            <div className="text-xs text-on-surface-variant uppercase tracking-widest font-bold py-3">
              {results.length} result{results.length !== 1 ? 's' : ''}
            </div>
            {results.map((ev, i) => (
              <SearchRow key={ev.id} event={ev} isActive={i === activeIdx} onClick={() => handleSelect(ev)} />
            ))}
          </>
        )}
      </div>
    </div>
  );
}

function SearchRow({ event, isActive, onClick }) {
  // Track broken images in state instead of rewriting parentElement.innerHTML:
  // mutating a React-owned node makes the next re-render throw removeChild.
  const [imgBroken, setImgBroken] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left flex gap-4 items-center p-4 rounded-xl cursor-pointer transition-colors hover:bg-surface-container-low border ${
        isActive ? 'bg-surface-container-low border-primary/20' : 'border-transparent'
      }`}
    >
      <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 bg-surface-container">
        {event.img && !imgBroken ? (
          <img
            src={event.img}
            alt=""
            className="w-full h-full object-cover"
            onError={() => setImgBroken(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="material-symbols-outlined text-xl text-on-surface-variant/60">{CAT_ICONS[event.cat] || 'star'}</span>
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-body text-sm font-semibold text-on-surface">{event.title}</span>
          <Tag variant="primary">{event.tag}</Tag>
        </div>
        <div className="flex items-center gap-3 text-xs text-on-surface-variant">
          <span className="flex items-center gap-1">
            <span className="material-symbols-outlined text-primary" style={{ fontSize: 13 }}>location_on</span>
            {[event.venue, event.city].filter(Boolean).join(', ')}
          </span>
          <span className="flex items-center gap-1">
            <span className="material-symbols-outlined text-primary" style={{ fontSize: 13 }}>schedule</span>
            {event.date}
          </span>
        </div>
        <span className="text-xs font-bold text-primary mt-0.5 block">{event.price}</span>
      </div>
      <span className="material-symbols-outlined text-outline-variant flex-shrink-0 text-lg">chevron_right</span>
    </button>
  );
}
