/**
 * CancelConfirmModal.jsx
 * Place at: src/components/modals/CancelConfirmModal.jsx
 *
 * Extracted from EventDetail.jsx where it was defined inline.
 *
 * Props:
 *   eventTitle  {string}  — shown in the body copy
 *   onConfirm   {fn}      — called when user confirms cancellation
 *   onCancel    {fn}      — called when user keeps their spot
 */
import Button from '../ui/Button';

export function CancelConfirmModal({ eventTitle, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center px-6 bg-background/80 backdrop-blur-xl">
      <div className="w-full max-w-sm bg-surface-container-low rounded-2xl p-8 border border-outline-variant/30">
        <div className="w-12 h-12 bg-error-container/20 rounded-xl flex items-center justify-center mx-auto mb-5">
          <span className="material-symbols-outlined text-error text-2xl">event_busy</span>
        </div>
        <h3 className="font-headline text-xl font-bold text-on-surface text-center mb-2">
          Cancel your RSVP?
        </h3>
        <p className="text-on-surface-variant text-sm text-center leading-relaxed mb-6">
          You'll lose your spot at{' '}
          <span className="text-on-surface font-semibold">{eventTitle}</span>.
        </p>
        <div className="flex gap-3">
          <Button variant="secondary" fullWidth onClick={onCancel}>
            Keep my spot
          </Button>
          <Button
            variant="ghost"
            fullWidth
            onClick={onConfirm}
            className="text-error hover:bg-error-container/20 border border-error/30"
          >
            Yes, cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
