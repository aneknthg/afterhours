import { useState } from 'react';
import { createPortal } from 'react-dom';

const PRIVACY_OPTIONS = [
  { field: 'show_bio',           icon: 'description',          label: 'Show bio publicly',         desc: 'Others can read your bio when viewing your profile.' },
  { field: 'show_past_events',   icon: 'history',              label: 'Show past events',          desc: 'Your event history is visible to connections.' },
  { field: 'allow_connections',  icon: 'person_add',           label: 'Allow connection requests', desc: 'Women you meet at events can send you a request.' },
  { field: 'show_online_status', icon: 'radio_button_checked', label: 'Show online status',        desc: "Let others know when you're active in chat." },
];

export { PRIVACY_OPTIONS };

export default function PrivacyModal({ onClose, profile, updateProfile }) {
  const [toggling, setToggling] = useState(null);

  async function toggle(field) {
    setToggling(field);
    try {
      const current = profile?.privacy_settings || {};
      const updated = { ...current, [field]: !(current[field] ?? true) };
      await updateProfile({ privacy_settings: updated });
    } catch {
      // fail silently — UI will revert on next load
    } finally {
      setToggling(null);
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[500] flex items-center justify-center p-4 sm:p-6 bg-background/80 backdrop-blur-xl"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-surface-container-low border border-outline-variant/20 rounded-3xl overflow-hidden shadow-2xl shadow-black/50 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant/15 flex-shrink-0">
          <div>
            <p className="font-headline text-lg font-semibold text-on-surface leading-none">Privacy</p>
            <p className="text-xs text-on-surface-variant mt-1">Control what others can see.</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-all flex-shrink-0"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
          </button>
        </div>

        {/* Options */}
        <div className="overflow-y-auto flex-1 px-2 py-2">
          {PRIVACY_OPTIONS.map(({ field, icon, label, desc }) => {
            const enabled = (profile?.privacy_settings?.[field] ?? true);
            const busy    = toggling === field;
            return (
              <button
                key={field}
                type="button"
                onClick={() => toggle(field)}
                disabled={busy}
                className="w-full flex items-start gap-3.5 p-3.5 rounded-2xl hover:bg-surface-container/60 transition-colors text-left disabled:opacity-60"
              >
                <div className="w-9 h-9 rounded-xl bg-surface-container flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: 18 }}>
                    {icon}
                  </span>
                </div>
                <div className="flex-1 min-w-0 pt-0.5">
                  <p className="text-sm font-semibold text-on-surface leading-tight">{label}</p>
                  <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">{desc}</p>
                </div>
                <div
                  className={`relative w-11 h-[26px] rounded-full transition-colors flex-shrink-0 mt-1 ${
                    enabled ? 'bg-primary' : 'bg-outline-variant/40'
                  }`}
                >
                  <span
                    className={`absolute top-[3px] w-5 h-5 bg-white rounded-full shadow-sm transition-all ${
                      enabled ? 'left-[22px]' : 'left-[3px]'
                    }`}
                  />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>,
    document.body
  );
}
