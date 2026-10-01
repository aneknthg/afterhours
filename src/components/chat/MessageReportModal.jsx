/**
 * MessageReportModal.jsx — report a specific chat message
 *
 * Place at: src/components/chat/MessageReportModal.jsx
 */
import { useState } from 'react';
import { chatService } from '../../services/chat.service';
import Button from '../ui/Button';

const REASONS = [
  { id: 'harassment',   label: 'Harassment or bullying', icon: 'gpp_bad' },
  { id: 'inappropriate', label: 'Inappropriate content', icon: 'block' },
  { id: 'spam',         label: 'Spam or scam',           icon: 'report' },
  { id: 'threat',       label: 'Threat or violence',     icon: 'warning' },
  { id: 'personal_info', label: 'Sharing personal info',  icon: 'privacy_tip' },
  { id: 'other',        label: 'Other',                  icon: 'more_horiz' },
];

export default function MessageReportModal({ message, reporterId, onClose }) {
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState('');

  if (!message) return null;

  async function handleSubmit() {
    if (!reason) return;
    setSubmitting(true);
    try {
      await chatService.reportMessage({
        messageId: message.id,
        reporterId,
        reason,
        details: details.trim(),
      });
      setSubmitted(true);
    } catch (err) {
      console.error('Message report error:', err);
      setSubmitError('Could not send your report. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="fixed inset-0 z-[500] flex items-center justify-center px-6 bg-background/85 backdrop-blur-xl">
        <div className="w-full max-w-sm bg-surface-container-low rounded-2xl p-6 border border-outline-variant/30 text-center">
          <div className="w-12 h-12 rounded-full bg-primary-container/30 flex items-center justify-center mx-auto mb-4">
            <span className="material-symbols-outlined text-primary text-2xl">check_circle</span>
          </div>
          <h3 className="font-headline text-lg font-bold text-on-surface mb-2">Report submitted</h3>
          <p className="text-sm text-on-surface-variant leading-relaxed mb-5">
            We'll review this message within 24 hours. The sender won't know you reported it.
          </p>
          <Button variant="primary" fullWidth onClick={onClose}>Done</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center px-6 bg-background/85 backdrop-blur-xl">
      <div className="w-full max-w-md bg-surface-container-low rounded-2xl border border-outline-variant/30 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant/15">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-error-container/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-error text-lg">flag</span>
            </div>
            <h3 className="font-headline text-base text-on-surface font-semibold">Report message</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-container transition-colors">
            <span className="material-symbols-outlined text-on-surface-variant text-xl">close</span>
          </button>
        </div>

        <div className="px-6 py-5">
          {/* Message preview */}
          <div className="bg-surface-container rounded-xl px-4 py-3 mb-4 border border-outline-variant/10">
            <p className="text-xs text-on-surface-variant mb-1">{message.display_name}</p>
            <p className="text-sm text-on-surface line-clamp-2">{message.content}</p>
          </div>

          {/* Reasons */}
          <p className="text-sm text-on-surface-variant mb-3">Why are you reporting this?</p>
          <div className="space-y-2 mb-4">
            {REASONS.map(r => (
              <button
                key={r.id}
                onClick={() => setReason(r.id)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-left transition-all border ${
                  reason === r.id
                    ? 'border-primary/40 bg-primary-container/20 text-on-surface'
                    : 'border-outline-variant/20 hover:border-outline-variant/40 text-on-surface-variant'
                }`}
              >
                <span className="material-symbols-outlined text-base">{r.icon}</span>
                <span className="text-sm">{r.label}</span>
              </button>
            ))}
          </div>

          {/* Optional details */}
          {reason && (
            <textarea
              rows={2}
              maxLength={500}
              placeholder="Add details (optional)..."
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              className="w-full bg-background border border-outline-variant/30 rounded-xl px-4 py-3 text-on-surface text-[16px] md:text-sm outline-none focus:border-primary/50 transition-colors resize-none placeholder:text-on-surface-variant/40 mb-4"
            />
          )}

          {submitError && (
            <p role="alert" className="text-sm text-error mb-3">{submitError}</p>
          )}
          <div className="flex gap-3">
            <Button variant="secondary" fullWidth onClick={onClose}>Cancel</Button>
            <Button
              variant="primary"
              fullWidth
              disabled={!reason || submitting}
              onClick={handleSubmit}
              className="bg-error hover:bg-error/90"
            >
              {submitting ? 'Submitting…' : 'Report'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
