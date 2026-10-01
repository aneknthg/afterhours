/**
 * calendarLinks.js
 * Place at: src/lib/calendarLinks.js
 *
 * Shared "Add to Calendar" logic for EventDetail (and anywhere else that
 * needs it). Builds direct add-event links for Google Calendar and Outlook
 * (no file download — opens a pre-filled page in a new tab) plus an .ics
 * blob URL for Apple Calendar and anything else that only understands files.
 */

// events.end_time is a free-text display string ("5:15 PM"), not a real
// timestamp column — combine it with the start date, or fall back to a
// 3-hour default (same assumption isPast() already makes in date.js).
function resolveEnd(start, endTimeText) {
  const fallback = new Date(start.getTime() + 3 * 60 * 60 * 1000);
  if (!endTimeText) return fallback;
  // Accept both "20:30" (what CustomTimePicker writes) and "8:30 PM".
  const m = String(endTimeText).trim().match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
  if (!m) return fallback;
  let hour = parseInt(m[1], 10);
  if (m[3]) {
    hour %= 12;
    if (/pm/i.test(m[3])) hour += 12;
  }
  if (hour > 23) return fallback;
  const end = new Date(start);
  end.setHours(hour, parseInt(m[2], 10), 0, 0);
  if (end <= start) end.setDate(end.getDate() + 1); // crossed midnight
  return end;
}

function utcStamp(d) {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function resolveEventTimes(event) {
  const start = event.starts_at ? new Date(event.starts_at) : new Date();
  const end = resolveEnd(start, event.end_time);
  return { start, end };
}

function eventDetailsText(event) {
  const parts = [];
  if (event.description) parts.push(event.description);
  parts.push(`${window.location.origin}/event/${event.id}`);
  return parts.join('\n\n');
}

export function googleCalendarUrl(event) {
  const { start, end } = resolveEventTimes(event);
  const location = [event.venue, event.city].filter(Boolean).join(', ');
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title || '',
    dates: `${utcStamp(start)}/${utcStamp(end)}`,
    details: eventDetailsText(event),
    location,
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

export function outlookCalendarUrl(event) {
  const { start, end } = resolveEventTimes(event);
  const location = [event.venue, event.city].filter(Boolean).join(', ');
  const params = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: event.title || '',
    startdt: start.toISOString(),
    enddt: end.toISOString(),
    location,
    body: eventDetailsText(event),
  });
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params}`;
}

// Apple Calendar (and anything else) has no direct "add event" URL, so this
// stays a file — but on iOS Safari, navigating to an .ics URL (rather than
// forcing a download) opens it straight in the Calendar app's add-event
// sheet instead of dropping a file in Downloads.
export function downloadIcs(event) {
  const { start, end } = resolveEventTimes(event);
  const location = [event.venue, event.city].filter(Boolean).join(', ');
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//AfterHours//EN',
    'BEGIN:VEVENT',
    `DTSTART:${utcStamp(start)}`,
    `DTEND:${utcStamp(end)}`,
    `SUMMARY:${event.title || ''}`,
    `LOCATION:${location}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  if (isIOS) {
    window.location.href = url;
  } else {
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(event.title || 'event').replace(/\s+/g, '-')}.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
