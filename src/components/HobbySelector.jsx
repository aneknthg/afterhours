import { useState } from 'react';
import { HOBBY_CATEGORIES } from '../data/interests';

// ── Compact mode: collapsible category accordion ──────────────────────────────
function CompactCategory({ cat, selected, onToggle }) {
  const [open, setOpen] = useState(() => cat.hobbies.some((h) => selected.includes(h)));
  const selectedInCat = cat.hobbies.filter((h) => selected.includes(h));

  return (
    <div className="border border-outline-variant/20 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-surface-container/50 hover:bg-surface-container transition-colors text-left"
      >
        <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
          {cat.label}
        </span>
        <div className="flex items-center gap-2">
          {selectedInCat.length > 0 && (
            <span className="text-[10px] font-bold bg-primary/20 text-primary px-2 py-0.5 rounded-full">
              {selectedInCat.length}
            </span>
          )}
          <span
            className="material-symbols-outlined text-on-surface-variant transition-transform"
            style={{ fontSize: 16, transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
          >
            expand_more
          </span>
        </div>
      </button>

      {open && (
        <div className="px-4 py-3 flex flex-wrap gap-1.5">
          {cat.hobbies.map((hobby) => {
            const isSelected = selected.includes(hobby);
            return (
              <button
                key={hobby}
                onClick={() => onToggle(hobby)}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                  isSelected
                    ? 'bg-primary text-on-primary'
                    : 'bg-surface-container text-on-surface-variant border border-outline-variant/30 hover:border-primary/40 hover:text-on-surface'
                }`}
              >
                {hobby}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function HobbySelector({ selected = [], onChange, compact = false }) {
  const [customInput, setCustomInput] = useState('');

  function toggle(hobby) {
    if (selected.includes(hobby)) {
      onChange(selected.filter((h) => h !== hobby));
    } else {
      onChange([...selected, hobby]);
    }
  }

  function addCustom() {
    const trimmed = customInput.trim();
    if (!trimmed) return;
    if (selected.some((h) => h.toLowerCase() === trimmed.toLowerCase())) {
      setCustomInput('');
      return;
    }
    onChange([...selected, trimmed]);
    setCustomInput('');
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      addCustom();
    }
  }

  // ── Compact layout (used in edit modal) ────────────────────────────────────
  if (compact) {
    return (
      <div className="space-y-2">
        {/* Selected summary strip */}
        {selected.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3 pb-3 border-b border-outline-variant/15">
            {selected.map((hobby) => (
              <button
                key={hobby}
                onClick={() => toggle(hobby)}
                className="px-3 py-1 rounded-full text-xs font-bold bg-primary text-on-primary flex items-center gap-1 hover:brightness-110 transition-all"
              >
                {hobby}
                <span className="material-symbols-outlined" style={{ fontSize: 12 }}>close</span>
              </button>
            ))}
          </div>
        )}

        {/* Collapsible categories */}
        {HOBBY_CATEGORIES.map((cat) => (
          <CompactCategory key={cat.label} cat={cat} selected={selected} onToggle={toggle} />
        ))}

        {/* Custom input */}
        <div className="flex gap-2 pt-2">
          <input
            type="text"
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Add a custom interest…"
            maxLength={30}
            className="flex-1 bg-background border border-outline-variant/30 rounded-xl px-3 py-2 text-on-surface text-xs font-body outline-none focus:border-primary/50 transition-colors placeholder:text-on-surface-variant/40"
          />
          <button
            onClick={addCustom}
            className="px-4 py-2 bg-surface-container border border-outline-variant/30 rounded-xl text-on-surface-variant font-bold text-xs hover:bg-surface-container-high hover:text-on-surface transition-all"
          >
            Add
          </button>
        </div>
      </div>
    );
  }

  // ── Full layout (used in Onboarding, etc.) ─────────────────────────────────
  return (
    <div className="space-y-6">
      {selected.length > 0 && (
        <div>
          <div className="text-xs uppercase tracking-widest text-on-surface-variant font-bold mb-3">
            Your hobbies ({selected.length})
          </div>
          <div className="flex flex-wrap gap-2">
            {selected.map((hobby) => (
              <button
                key={hobby}
                onClick={() => toggle(hobby)}
                className="px-3.5 py-1.5 rounded-full text-xs font-bold bg-primary text-on-primary flex items-center gap-1.5 hover:brightness-110 transition-all"
              >
                {hobby}
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>close</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="text-xs uppercase tracking-widest text-on-surface-variant font-bold mb-2">
          Add your own
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a hobby and press Enter..."
            maxLength={30}
            className="flex-1 bg-background border border-outline-variant/30 rounded-xl px-4 py-3 text-on-surface text-[16px] md:text-sm font-body outline-none focus:border-primary/50 transition-colors placeholder:text-on-surface-variant/40"
          />
          <button
            onClick={addCustom}
            className="px-4 py-3 bg-surface-container border border-outline-variant/30 rounded-xl text-on-surface-variant font-bold text-sm hover:bg-surface-container-high transition-all"
          >
            Add
          </button>
        </div>
      </div>

      {HOBBY_CATEGORIES.map((cat) => (
        <div key={cat.label}>
          <div className="text-xs uppercase tracking-widest text-on-surface-variant font-bold mb-2.5">
            {cat.label}
          </div>
          <div className="flex flex-wrap gap-2">
            {cat.hobbies.map((hobby) => {
              const isSelected = selected.includes(hobby);
              return (
                <button
                  key={hobby}
                  onClick={() => toggle(hobby)}
                  className={`px-4 py-2 rounded-full text-sm font-label transition-all ${
                    isSelected
                      ? 'bg-primary text-on-primary font-bold'
                      : 'bg-surface-container text-on-surface-variant border border-outline-variant/30 hover:border-primary/30 hover:text-on-surface'
                  }`}
                >
                  {hobby}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
