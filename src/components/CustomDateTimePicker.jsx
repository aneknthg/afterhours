/**
 * CustomDateTimePicker.jsx
 *
 * Shared calendar + time picker used by CreateEvent and the MyEvents
 * "Manage event" modal. Emits a `datetime-local` string (YYYY-MM-DDTHH:mm)
 * via onChange. Past dates/times are blocked. `dateOnly` / `timeOnly` render
 * just one trigger.
 *
 * Extracted from CreateEvent.jsx so the host edit form can reuse the exact
 * same picker instead of a free-text date field.
 */
import { useState, useEffect, useRef } from 'react';

const MONTH_LABELS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

function pad2(n) { return String(n).padStart(2, '0'); }

export function toInputStr(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

// Snaps minutes to nearest 15-min increment
function snapMin(m) { return pad2([0,15,30,45].reduce((b,o) => Math.abs(o-m) < Math.abs(b-m) ? o : b, 0)); }

// Returns a Date at the next 15-minute slot from `from` (default: now).
function nextQuarterHour(from = new Date()) {
  const d = new Date(from);
  d.setSeconds(0, 0);
  const mins = d.getMinutes();
  const next = Math.ceil((mins + 1) / 15) * 15; // always strictly in the future
  d.setMinutes(next);
  return d;
}

export default function CustomDateTimePicker({ value, onChange, dateOnly = false, timeOnly = false }) {
  const now = new Date();
  const parsed = value ? new Date(value) : null;
  const [open, setOpen] = useState(false);
  const [popoverStyle, setPopoverStyle] = useState({});
  const [viewMonth, setViewMonth] = useState((parsed || now).getMonth());
  const [viewYear,  setViewYear]  = useState((parsed || now).getFullYear());
  const ref = useRef(null);

  function openPicker() {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setPopoverStyle({ position: 'fixed', top: rect.bottom + 8, left: rect.left, zIndex: 200 });
    }
    // Seed a sensible default (today, next 15-min slot) so the selects
    // reflect real state — otherwise clicking the already-displayed value
    // ('00', 'AM', etc.) is a no-op and the form never captures the change.
    if (!value) {
      const seed = nextQuarterHour();
      onChange(toInputStr(seed));
      setViewMonth(seed.getMonth());
      setViewYear(seed.getFullYear());
    }
    setOpen(o => !o);
  }

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const t = setTimeout(() => document.addEventListener('mousedown', h), 10);
    return () => { clearTimeout(t); document.removeEventListener('mousedown', h); };
  }, [open]);

  // Build 6×7 calendar grid
  const firstDay   = new Date(viewYear, viewMonth, 1).getDay();
  const daysInCur  = new Date(viewYear, viewMonth + 1, 0).getDate();
  const daysInPrev = new Date(viewYear, viewMonth, 0).getDate();
  const prevM = viewMonth === 0  ? 11 : viewMonth - 1;
  const prevY = viewMonth === 0  ? viewYear - 1 : viewYear;
  const nextM = viewMonth === 11 ? 0  : viewMonth + 1;
  const nextY = viewMonth === 11 ? viewYear + 1 : viewYear;

  const cells = [];
  for (let i = firstDay - 1; i >= 0; i--)
    cells.push({ day: daysInPrev - i, month: prevM, year: prevY, cur: false });
  for (let d = 1; d <= daysInCur; d++)
    cells.push({ day: d, month: viewMonth, year: viewYear, cur: true });
  for (let d = 1; cells.length < 42; d++)
    cells.push({ day: d, month: nextM, year: nextY, cur: false });

  // Midnight today — used to gate past dates.
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  function pickDay(cell) {
    const cellDate = new Date(cell.year, cell.month, cell.day);
    if (cellDate < todayStart) return; // block past dates
    const base = parsed || now;
    let h = base.getHours();
    let m = base.getMinutes();
    // If the user picked today but the stored time is already past, bump to next quarter-hour.
    const picked = new Date(cell.year, cell.month, cell.day, h, m);
    if (picked < now) {
      const nq = nextQuarterHour();
      h = nq.getHours();
      m = nq.getMinutes();
    }
    const d = new Date(cell.year, cell.month, cell.day, h, m);
    onChange(toInputStr(d));
  }

  function prevMonth() {
    // Block navigation to months before the current one.
    if (viewYear < now.getFullYear() ||
        (viewYear === now.getFullYear() && viewMonth <= now.getMonth())) return;
    viewMonth === 0 ? (setViewMonth(11), setViewYear(y => y-1)) : setViewMonth(m => m-1);
  }
  function nextMonth() { viewMonth === 11 ? (setViewMonth(0),  setViewYear(y => y+1)) : setViewMonth(m => m+1); }

  const atCurrentMonth = viewYear === now.getFullYear() && viewMonth === now.getMonth();

  // If the selected date is today, filter time options to the future only.
  const isPickedToday = parsed &&
    parsed.getFullYear() === now.getFullYear() &&
    parsed.getMonth()    === now.getMonth() &&
    parsed.getDate()     === now.getDate();

  const h24    = parsed ? parsed.getHours()   : 0;
  const hour12 = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24;
  const ampm   = h24 >= 12 ? 'PM' : 'AM';
  const minute = parsed ? snapMin(parsed.getMinutes()) : '00';

  // Compute allowed time options when picked date is today.
  function timeTo24(h12, min, ap) {
    let h = parseInt(h12);
    if (ap === 'PM' && h < 12) h += 12;
    if (ap === 'AM' && h === 12) h = 0;
    return h * 60 + parseInt(min);
  }
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const allowedAmpm = !isPickedToday ? ['AM','PM'] :
    ['AM','PM'].filter(ap => {
      // Is there any valid (hour, min) pair with this ampm?
      for (let hh = 1; hh <= 12; hh++) {
        for (const mm of ['00','15','30','45']) {
          if (timeTo24(pad2(hh), mm, ap) > nowMinutes) return true;
        }
      }
      return false;
    });
  const allowedHours = !isPickedToday ? Array.from({ length: 12 }, (_, i) => pad2(i + 1)) :
    Array.from({ length: 12 }, (_, i) => pad2(i + 1)).filter(hh => {
      for (const mm of ['00','15','30','45']) {
        if (timeTo24(hh, mm, ampm) > nowMinutes) return true;
      }
      return false;
    });
  const allowedMinutes = !isPickedToday ? ['00','15','30','45'] :
    ['00','15','30','45'].filter(mm => timeTo24(pad2(hour12), mm, ampm) > nowMinutes);

  function updateTime(h12, min, ap) {
    let h = parseInt(h12);
    if (ap === 'PM' && h < 12) h += 12;
    if (ap === 'AM' && h === 12) h = 0;
    const base = parsed || now;
    let d = new Date(base); d.setHours(h, parseInt(min), 0, 0);
    // If picked date is today and this time is in the past, bump to next quarter.
    if (isPickedToday && d < now) {
      const nq = nextQuarterHour();
      d = new Date(base);
      d.setHours(nq.getHours(), nq.getMinutes(), 0, 0);
    }
    onChange(toInputStr(d));
  }

  const dateLabel = parsed
    ? parsed.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' })
    : 'Select date';
  const timeLabel = parsed
    ? parsed.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
    : 'Select time';

  const triggerCls = (active) =>
    `flex items-center gap-2.5 bg-surface-container-high border rounded-xl px-4 py-3 text-sm transition-all cursor-pointer ${
      active ? 'border-primary/50 ring-1 ring-primary/20' : 'border-outline-variant/25 hover:border-primary/35'
    }`;

  const timeSelectCls = 'appearance-none bg-surface-container border border-outline-variant/20 rounded-lg px-1 py-1.5 text-sm text-center text-on-surface focus:outline-none focus:border-primary/50 cursor-pointer';

  return (
    <div ref={ref} className="relative">
      {/* Trigger row */}
      <div className="flex gap-2">
        {!timeOnly && (
          <button type="button" onClick={openPicker} className={`flex-1 ${triggerCls(open)}`}>
            <span className="material-symbols-outlined text-primary/60 flex-shrink-0" style={{ fontSize: 15 }}>calendar_today</span>
            <span className={parsed ? 'text-on-surface font-medium' : 'text-on-surface-variant/40'}>{dateLabel}</span>
          </button>
        )}
        {!dateOnly && (
          <button type="button" onClick={openPicker} className={`flex-1 ${triggerCls(open)}`}>
            <span className="material-symbols-outlined text-primary/60 flex-shrink-0" style={{ fontSize: 15 }}>schedule</span>
            <span className={parsed ? 'text-on-surface font-medium' : 'text-on-surface-variant/40'}>{timeLabel}</span>
          </button>
        )}
      </div>

      {/* Popover */}
      {open && (
        <div
          className="bg-surface-container-low border border-outline-variant/20 rounded-2xl shadow-2xl shadow-black/60 w-72 overflow-hidden"
          style={{ ...popoverStyle, animation: 'fadeIn 0.15s ease' }}
        >
          {/* Month navigation */}
          <div className="flex items-center justify-between px-5 pt-4 pb-3">
            <span className="font-headline text-base text-on-surface">
              {MONTH_LABELS[viewMonth]} {viewYear}
            </span>
            <div className="flex items-center gap-0.5">
              <button type="button" onClick={prevMonth}
                disabled={atCurrentMonth}
                className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
                  atCurrentMonth
                    ? 'text-on-surface-variant/20 cursor-not-allowed'
                    : 'hover:bg-surface-container text-on-surface-variant hover:text-on-surface'
                }`}>
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>chevron_left</span>
              </button>
              <div className="w-1.5 h-1.5 rounded-full bg-outline-variant/30 mx-1" />
              <button type="button" onClick={nextMonth}
                className="w-7 h-7 rounded-full hover:bg-surface-container flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors">
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>chevron_right</span>
              </button>
            </div>
          </div>

          {/* Day-of-week headers */}
          <div className="grid grid-cols-7 px-3 mb-1">
            {['S','M','T','W','T','F','S'].map((d, i) => (
              <div key={i} className="text-center text-[11px] font-bold text-on-surface-variant/35 py-1">{d}</div>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7 px-3 pb-3 gap-y-0.5">
            {cells.map((cell, i) => {
              const cellDate = new Date(cell.year, cell.month, cell.day);
              const isPast = cellDate < todayStart;
              const isSelected = parsed &&
                cell.day   === parsed.getDate()     &&
                cell.month === parsed.getMonth()    &&
                cell.year  === parsed.getFullYear();
              const isToday = cell.day === now.getDate() && cell.month === now.getMonth() && cell.year === now.getFullYear();
              return (
                <button key={i} type="button" onClick={() => pickDay(cell)}
                  disabled={isPast}
                  className={[
                    'w-full aspect-square flex items-center justify-center rounded-lg text-sm transition-all',
                    isPast       ? 'text-on-surface-variant/20 cursor-not-allowed line-through decoration-on-surface-variant/20' :
                    isSelected   ? 'bg-primary text-on-primary font-bold' :
                    isToday      ? 'text-primary font-bold hover:bg-surface-container' :
                    cell.cur     ? 'text-on-surface hover:bg-surface-container' :
                                   'text-on-surface-variant/25 hover:text-on-surface-variant/50',
                  ].join(' ')}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>

          {/* Time selects */}
          <div className="border-t border-outline-variant/10 px-4 py-3 flex items-center gap-3">
            <span className="material-symbols-outlined text-primary/60 flex-shrink-0" style={{ fontSize: 15 }}>schedule</span>
            <div className="flex items-center gap-1.5 flex-1">
              <select value={pad2(hour12)} onChange={(e) => updateTime(e.target.value, minute, ampm)} className={`flex-1 ${timeSelectCls}`}>
                {allowedHours.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
              <span className="text-on-surface-variant/40 font-bold text-sm select-none">:</span>
              <select value={minute} onChange={(e) => updateTime(pad2(hour12), e.target.value, ampm)} className={`flex-1 ${timeSelectCls}`}>
                {allowedMinutes.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <select value={ampm} onChange={(e) => updateTime(pad2(hour12), minute, e.target.value)} className={timeSelectCls}>
                {allowedAmpm.map(ap => <option key={ap} value={ap}>{ap}</option>)}
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Time-only picker (HH:mm value) — used for optional end times.
export function CustomTimePicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [popoverStyle, setPopoverStyle] = useState({});
  const ref = useRef(null);

  function openPicker() {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setPopoverStyle({ position: 'fixed', top: rect.bottom + 8, left: rect.left, zIndex: 200 });
    }
    // Seed a sensible default so the selects reflect real state —
    // otherwise selecting the already-displayed value is a no-op.
    if (!value) {
      const seed = nextQuarterHour();
      onChange(`${pad2(seed.getHours())}:${pad2(seed.getMinutes())}`);
    }
    setOpen(o => !o);
  }

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const t = setTimeout(() => document.addEventListener('mousedown', h), 10);
    return () => { clearTimeout(t); document.removeEventListener('mousedown', h); };
  }, [open]);

  const [h24str = '', minStr = ''] = (value || '').split(':');
  const h24    = parseInt(h24str) || 0;
  const hour12 = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24;
  const ampm   = h24 >= 12 ? 'PM' : 'AM';
  const minute = minStr ? snapMin(parseInt(minStr)) : '00';
  const label  = value ? `${pad2(hour12)}:${minute} ${ampm}` : 'Select time';

  function update(h12, min, ap) {
    let h = parseInt(h12);
    if (ap === 'PM' && h < 12) h += 12;
    if (ap === 'AM' && h === 12) h = 0;
    onChange(`${pad2(h)}:${min}`);
  }

  const cls = `flex items-center gap-2.5 bg-surface-container-high border rounded-xl px-4 py-3 text-sm transition-all cursor-pointer ${
    open ? 'border-primary/50 ring-1 ring-primary/20' : 'border-outline-variant/25 hover:border-primary/35'
  }`;
  const selCls = 'appearance-none bg-surface-container border border-outline-variant/20 rounded-lg px-2 py-1.5 text-sm text-center text-on-surface focus:outline-none focus:border-primary/50 cursor-pointer';

  return (
    <div ref={ref} className="relative inline-block">
      <button type="button" onClick={openPicker} className={cls}>
        <span className="material-symbols-outlined text-primary/60 flex-shrink-0" style={{ fontSize: 15 }}>schedule</span>
        <span className={value ? 'text-on-surface font-medium' : 'text-on-surface-variant/40'}>{label}</span>
      </button>

      {open && (
        <div
          className="bg-surface-container-low border border-outline-variant/20 rounded-xl shadow-2xl shadow-black/60 px-4 py-3 flex items-center gap-3"
          style={{ ...popoverStyle, animation: 'fadeIn 0.15s ease' }}
        >
          <span className="material-symbols-outlined text-primary/60 flex-shrink-0" style={{ fontSize: 15 }}>schedule</span>
          <div className="flex items-center gap-1.5">
            <select value={pad2(hour12)} onChange={(e) => update(e.target.value, minute, ampm)} className={`w-14 ${selCls}`}>
              {Array.from({ length: 12 }, (_, i) => pad2(i + 1)).map(h => <option key={h} value={h}>{h}</option>)}
            </select>
            <span className="text-on-surface-variant/40 font-bold text-sm select-none">:</span>
            <select value={minute} onChange={(e) => update(pad2(hour12), e.target.value, ampm)} className={`w-14 ${selCls}`}>
              {['00','15','30','45'].map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <select value={ampm} onChange={(e) => update(pad2(hour12), minute, e.target.value)} className={selCls}>
              <option value="AM">AM</option>
              <option value="PM">PM</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
