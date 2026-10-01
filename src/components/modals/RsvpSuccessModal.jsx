/**
 * RsvpSuccessModal.jsx
 * Place at: src/components/modals/RsvpSuccessModal.jsx
 *
 * Extracted from EventDetail.jsx where it was defined inline.
 *
 * Props:
 *   eventTitle  {string}  — shown in the body copy
 *   eventId     {string}  — used to navigate to the event's group chat
 *   onClose     {fn}      — called to dismiss the modal
 */
import { useNavigate } from 'react-router-dom';
import Button from '../ui/Button';

export function RsvpSuccessModal({ eventTitle, eventId, onClose, isApproval = false }) {
  const navigate = useNavigate();

  if (isApproval) {
    return (
      <div className="fixed inset-0 z-[500] flex items-center justify-center px-6 bg-background/80 backdrop-blur-xl">
        <div className="w-full max-w-sm bg-surface-container-low rounded-2xl p-8 border border-outline-variant/30 text-center">
          <div className="w-14 h-14 bg-surface-container rounded-full flex items-center justify-center mx-auto mb-5">
            <span className="material-symbols-outlined text-on-surface-variant text-3xl">hourglass_top</span>
          </div>
          <h3 className="font-headline text-xl font-bold text-on-surface mb-2">Request sent!</h3>
          <p className="text-on-surface-variant text-sm leading-relaxed mb-6">
            Your request to join{' '}
            <span className="text-on-surface font-semibold">{eventTitle}</span>{' '}
            is awaiting host approval. You'll be notified once you're approved.
          </p>
          <div className="space-y-2">
            <Button
              variant="secondary"
              size="lg"
              fullWidth
              onClick={() => { onClose(); navigate('/my-events'); }}
            >
              View My Events
            </Button>
            <button
              onClick={onClose}
              className="text-on-surface-variant text-xs hover:text-on-surface transition-colors mt-2 cursor-pointer"
            >
              Stay on this page
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center px-6 bg-background/80 backdrop-blur-xl">
      <div className="w-full max-w-sm bg-surface-container-low rounded-2xl p-8 border border-outline-variant/30 text-center">
        <div className="w-14 h-14 bg-primary-container rounded-full flex items-center justify-center mx-auto mb-5">
          <span className="material-symbols-outlined text-primary text-3xl">celebration</span>
        </div>
        <h3 className="font-headline text-xl text-on-surface mb-2">You're in!</h3>
        <p className="text-on-surface-variant text-sm leading-relaxed mb-6">
          You've reserved your spot at{' '}
          <span className="text-on-surface font-semibold">{eventTitle}</span>.
          Say hi to other attendees in the group chat.
        </p>
        <div className="space-y-2">
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={() => { onClose(); navigate(`/chat?event=${eventId}`); }}
          >
            Open group chat
          </Button>
          <Button
            variant="secondary"
            size="lg"
            fullWidth
            onClick={() => { onClose(); navigate('/my-events'); }}
          >
            View My Events
          </Button>
          <button
            onClick={onClose}
            className="text-on-surface-variant text-xs hover:text-on-surface transition-colors mt-2 cursor-pointer"
          >
            Stay on this page
          </button>
        </div>
      </div>
    </div>
  );
}
