/**
 * CancelEventModal.jsx
 * Place at: src/components/modals/CancelEventModal.jsx
 *
 * Host-facing modal for cancelling (deleting) an event. Lets the host add an
 * optional note that every attendee receives with the cancellation notice.
 *
 * Props:
 *   eventTitle {string}  — shown in the body copy
 *   busy       {bool}    — true while the cancel request is in flight
 *   onConfirm  {fn}      — called with the note string when the host confirms
 *   onClose    {fn}      — called to dismiss without cancelling
 */
import { useState } from 'react';
import Button from '../ui/Button';

const MAX = 280;

export function CancelEventModal({ eventTitle, busy, onConfirm, onClose }) {
  const [note, setNote] = useState('');

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center px-6 bg-background/80 backdrop-blur-xl">
      <div className="w-full max-w-sm bg-surface-container-low rounded-2xl p-8 border border-outline-variant/30">
        <div className="w-12 h-12 bg-error-container/20 rounded-xl flex items-center justify-center mx-auto mb-5">
          <span className="material-symbols-outlined text-error text-2xl">event_busy</span>
        </div>
        <h3 className="font-headline text-xl font-bold text-on-surface text-center mb-2">
          Cancel this event?
        </h3>
        <p className="text-on-surface-variant text-sm text-center leading-relaxed mb-5">
          <span className="text-on-surface font-semibold">{eventTitle}</span>{' '}
          will be removed for good and everyone who RSVP'd will be notified. This can't be undone.
        </p>

        <label className="block text-xs font-semibold text-on-surface-variant mb-1.5">
          Add a note for attendees <span className="font-normal text-on-surface-variant/60">(optional)</span>
        </label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value.slice(0, MAX))}
          rows={3}
          disabled={busy}
          placeholder="e.g. The venue fell through, so I'll reschedule soon. Sorry!"
          className="w-full rounded-xl bg-surface-container border border-outline-variant/25 px-3 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary/50 resize-none disabled:opacity-50"
        />
        <p className="text-[10px] text-on-surface-variant/50 text-right mt-1 mb-5">{note.length}/{MAX}</p>

        <div className="flex gap-3">
          <Button variant="secondary" fullWidth onClick={onClose} disabled={busy}>
            Keep event
          </Button>
          <Button
            variant="ghost"
            fullWidth
            onClick={() => onConfirm(note)}
            disabled={busy}
            className="text-error hover:bg-error-container/20 border border-error/30"
          >
            {busy ? 'Cancelling…' : 'Cancel event'}
          </Button>
        </div>
      </div>
    </div>
  );
}
