/**
 * CalendarMenuButton.jsx
 * Place at: src/components/CalendarMenuButton.jsx
 *
 * "Add to Calendar" trigger + dropdown. Replaces the old single-click .ics
 * download with a choice: Google Calendar and Outlook open a pre-filled
 * page directly (no file), Apple Calendar/Other still uses .ics since
 * neither has a direct web add-event link.
 *
 * Props:
 *   event   {object} — the event to add
 *   variant {'full'|'compact'|'icon'|'block'} — which trigger style to render
 */
import { useState } from 'react';
import Button from './ui/Button';
import { googleCalendarUrl, outlookCalendarUrl, downloadIcs } from '../lib/calendarLinks';

const OPTIONS = [
  { key: 'google', label: 'Google Calendar', icon: 'event' },
  { key: 'outlook', label: 'Outlook', icon: 'mail' },
  { key: 'ics', label: 'Apple Calendar / Other (.ics)', icon: 'download' },
];

export default function CalendarMenuButton({ event, variant = 'full' }) {
  const [open, setOpen] = useState(false);

  function handleSelect(key) {
    setOpen(false);
    if (key === 'google') window.open(googleCalendarUrl(event), '_blank', 'noopener,noreferrer');
    else if (key === 'outlook') window.open(outlookCalendarUrl(event), '_blank', 'noopener,noreferrer');
    else downloadIcs(event);
  }

  const menu = open && (
    <>
      <button
        aria-label="Close menu"
        onClick={() => setOpen(false)}
        className="fixed inset-0 z-10 cursor-default"
      />
      <div className="absolute bottom-full right-0 mb-1.5 w-64 bg-surface-container-low/95 backdrop-blur-xl border border-outline-variant/30 rounded-2xl shadow-card overflow-hidden animate-fade-up z-20">
        {OPTIONS.map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => handleSelect(key)}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-on-surface hover:bg-surface-container transition-colors text-left cursor-pointer"
          >
            <span className="material-symbols-outlined text-primary" style={{ fontSize: 18 }}>{icon}</span>
            {label}
          </button>
        ))}
      </div>
    </>
  );

  if (variant === 'icon') {
    return (
      <div className="relative flex-shrink-0">
        <button
          onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
          title="Add to Calendar"
          className="text-[11px] font-semibold text-on-surface-variant/60 hover:text-on-surface transition-colors cursor-pointer"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>calendar_add_on</span>
        </button>
        {menu}
      </div>
    );
  }

  if (variant === 'block') {
    return (
      <div className="relative flex-1">
        <button
          onClick={() => setOpen((v) => !v)}
          className="w-full text-xs font-bold px-3 py-2.5 rounded-xl bg-surface-container border border-outline-variant/20 text-on-surface-variant hover:text-on-surface hover:border-outline-variant/40 transition-all cursor-pointer"
        >
          Add to calendar
        </button>
        {menu}
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div className="relative flex-shrink-0">
        <button
          onClick={() => setOpen((v) => !v)}
          title="Add to Calendar"
          className="flex items-center gap-1 text-[11px] font-semibold text-primary bg-primary/10 hover:bg-primary/20 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 12 }}>calendar_add_on</span>
          Add
        </button>
        {menu}
      </div>
    );
  }

  return (
    <div className="relative">
      <Button variant="ghost" size="sm" fullWidth icon="calendar_add_on" onClick={() => setOpen((v) => !v)}>
        Add to Calendar
      </Button>
      {menu}
    </div>
  );
}
