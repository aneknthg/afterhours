/**
 * ReportModal.jsx — 3-step report flow
 *
 * Place at: src/components/trust/ReportModal.jsx
 *
 * Usage:
 *   <ReportModal
 *     isOpen={showReport}
 *     onClose={() => setShowReport(false)}
 *     reporterId={user.id}
 *     reportedUserId={someUserId}      // optional
 *     eventId={event.id}               // optional
 *     eventTitle="Wine Tasting"        // for display
 *   />
 */
import { useState } from 'react';
import { trustService } from '../../services/trust.service';
import Button from '../ui/Button';

const REASONS = [
  { id: 'uncomfortable',   label: 'Made me uncomfortable',   icon: 'sentiment_dissatisfied' },
  { id: 'inappropriate',   label: 'Inappropriate behavior',  icon: 'block' },
  { id: 'harassment',      label: 'Harassment',              icon: 'gpp_bad' },
  { id: 'safety',          label: 'Safety concern',          icon: 'warning' },
  { id: 'fake_profile',    label: 'Fake or suspicious profile', icon: 'person_off' },
  { id: 'other',           label: 'Other',                   icon: 'more_horiz' },
];

export default function ReportModal({
  isOpen, onClose, reporterId, reportedUserId, eventId, eventTitle
}) {
  const [step, setStep] = useState(1);
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState('');

  if (!isOpen) return null;

  function handleClose() {
    setStep(1);
    setReason('');
    setDetails('');
    setSubmitted(false);
    onClose();
  }

  async function handleSubmit() {
    setSubmitting(true);
    try {
      await trustService.submitReport({
        reporterId,
        reportedUserId,
        eventId: eventId ? String(eventId) : null,
        reason,
        details,
      });
      setSubmitted(true);
      setStep(3);
    } catch (err) {
      console.error('Report submission failed:', err);
      setSubmitError('Could not send your report. Please try again.');
    } finally {
      setSubmitting(false);
    }
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
            <div>
              <h3 className="font-headline text-base text-on-surface font-semibold">
                {step === 3 ? 'Report submitted' : 'Report an issue'}
              </h3>
              {eventTitle && step < 3 && (
                <p className="text-xs text-on-surface-variant">{eventTitle}</p>
              )}
            </div>
          </div>
          <button onClick={handleClose} className="p-1.5 rounded-lg hover:bg-surface-container transition-colors">
            <span className="material-symbols-outlined text-on-surface-variant text-xl">close</span>
          </button>
        </div>

        <div className="px-6 py-5">

          {/* Step 1: Pick reason */}
          {step === 1 && (
            <div>
              <p className="text-sm text-on-surface-variant mb-4">What happened?</p>
              <div className="space-y-2">
                {REASONS.map(r => (
                  <button
                    key={r.id}
                    onClick={() => { setReason(r.id); setStep(2); }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all border ${
                      reason === r.id
                        ? 'border-primary/40 bg-primary-container/20 text-on-surface'
                        : 'border-outline-variant/20 hover:border-outline-variant/40 text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    <span className="material-symbols-outlined text-lg">{r.icon}</span>
                    <span className="text-sm font-medium">{r.label}</span>
                    <span className="material-symbols-outlined text-outline-variant ml-auto text-sm">chevron_right</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Details */}
          {step === 2 && (
            <div>
              <button
                onClick={() => setStep(1)}
                className="flex items-center gap-1 text-xs text-primary font-bold uppercase tracking-widest mb-4 hover:underline"
              >
                <span className="material-symbols-outlined text-sm">arrow_back</span>
                Back
              </button>

              <p className="text-sm text-on-surface mb-1 font-semibold">
                {REASONS.find(r => r.id === reason)?.label}
              </p>
              <p className="text-xs text-on-surface-variant mb-4">
                Add details so we can investigate. This is optional but helps us take action faster.
              </p>

              <textarea
                rows={4}
                maxLength={1000}
                placeholder="Describe what happened..."
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                className="w-full bg-background border border-outline-variant/30 rounded-xl px-4 py-3 text-on-surface text-[16px] md:text-sm font-body outline-none focus:border-primary/50 transition-colors resize-none placeholder:text-on-surface-variant/40 mb-4"
              />

              {submitError && (
                <p role="alert" className="text-sm text-error mb-3">{submitError}</p>
              )}
              <div className="flex gap-3">
                <Button variant="secondary" fullWidth onClick={handleClose}>Cancel</Button>
                <Button
                  variant="primary"
                  fullWidth
                  disabled={submitting}
                  onClick={handleSubmit}
                  className="bg-error hover:bg-error/90"
                >
                  {submitting ? 'Submitting…' : 'Submit report'}
                </Button>
              </div>

              <p className="text-xs text-on-surface-variant/50 text-center mt-3 leading-relaxed">
                Reports are confidential. The reported person won't know who filed this.
              </p>
            </div>
          )}

          {/* Step 3: Confirmation */}
          {step === 3 && (
            <div className="text-center py-4">
              <div className="w-14 h-14 rounded-full bg-primary-container/30 flex items-center justify-center mx-auto mb-4">
                <span className="material-symbols-outlined text-primary text-3xl">check_circle</span>
              </div>
              <h3 className="font-headline text-lg font-bold text-on-surface mb-2">Thank you</h3>
              <p className="text-sm text-on-surface-variant leading-relaxed mb-6 max-w-xs mx-auto">
                We take every report seriously. Our team will review this within 24 hours.
              </p>
              <Button variant="primary" fullWidth onClick={handleClose}>Done</Button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
