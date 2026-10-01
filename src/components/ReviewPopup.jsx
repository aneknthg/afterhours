/**
 * ReviewPopup.jsx — REPLACEMENT for src/components/ReviewPopup.jsx
 *
 * Changes from original:
 * 1. Added safety rating (1-5 shield icons)
 * 2. Added experience tags ("Felt safe", "Great host", etc.)
 * 3. After submit, shows "Next for you" recommendations instead of just closing
 * 4. Uses reviewsService instead of inline supabase calls
 *
 * Place at: src/components/ReviewPopup.jsx (replaces existing file)
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useToast } from './Toast';
import Button from './ui/Button';

const RATING_LABELS = ['', 'Poor', 'Below average', 'Average', 'Great', 'Outstanding'];
const SAFETY_LABELS = ['', 'Unsafe', 'Uncomfortable', 'Okay', 'Safe', 'Very safe'];

const EXPERIENCE_TAGS = [
  { id: 'felt_safe',       label: 'Felt safe',        icon: 'shield' },
  { id: 'great_host',      label: 'Great host',       icon: 'star' },
  { id: 'good_crowd',      label: 'Good crowd',       icon: 'groups' },
  { id: 'well_organized',  label: 'Well organized',   icon: 'checklist' },
  { id: 'great_venue',     label: 'Great venue',      icon: 'location_on' },
  { id: 'would_return',    label: 'Would return',     icon: 'replay' },
];

export default function ReviewPopup({ event, userId, onClose }) {
  const navigate = useNavigate();
  const [step, setStep] = useState('rate'); // 'rate' | 'done'
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [safetyRating, setSafetyRating] = useState(0);
  const [hoverSafety, setHoverSafety] = useState(0);
  const [selectedTags, setSelectedTags] = useState([]);
  const [reviewText, setReviewText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [anonymous, setAnonymous]     = useState(false);
  const showToast = useToast();

  async function handleSubmit() {
    if (rating === 0) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const { error } = await supabase.from('reviews').insert({
        event_id: event.id,
        user_id: userId,
        rating,
        review_text: reviewText.trim(),
        safety_rating: safetyRating || null,
        tags: selectedTags,
        anonymous,
      });
      if (error) throw error;
      await dismissEvent();
      showToast('Review submitted. Thank you!');
      setStep('done');
    } catch (err) {
      console.error('Review submit error:', err);
      setSubmitError('Could not submit your review. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSkip() {
    await dismissEvent();
    onClose();
  }

  async function dismissEvent() {
    try {
      const { data: profile } = await supabase
        .from('profiles').select('dismissed_reviews').eq('id', userId).maybeSingle();
      const current = profile?.dismissed_reviews || [];
      if (!current.includes(event.id)) {
        await supabase.from('profiles')
          .update({ dismissed_reviews: [...current, event.id] }).eq('id', userId);
      }
    } catch {}
  }

  function toggleTag(tagId) {
    setSelectedTags(prev =>
      prev.includes(tagId) ? prev.filter(t => t !== tagId) : [...prev, tagId]
    );
  }

  const displayRating = hoverRating || rating;
  const displaySafety = hoverSafety || safetyRating;

  // ── Post-submit screen ──────────────────────────────────────────
  if (step === 'done') {
    return (
      <div className="fixed inset-0 z-[400] flex items-center justify-center px-6 bg-background/90 backdrop-blur-2xl">
        <div className="w-full max-w-md bg-surface-container-low rounded-2xl p-8 border border-outline-variant/30 text-center">
          <div className="w-16 h-16 rounded-full bg-primary-container flex items-center justify-center mx-auto mb-5">
            <span className="material-symbols-outlined text-primary text-3xl">favorite</span>
          </div>
          <h3 className="font-headline text-2xl font-bold text-on-surface mb-2">Thanks for reviewing!</h3>
          <p className="text-on-surface-variant text-sm leading-relaxed mb-6">
            Your feedback helps keep the community safe and helps others find great events.
          </p>

          <div className="space-y-3">
            <Button
              variant="primary"
              size="lg"
              fullWidth
              onClick={() => { onClose(); navigate('/'); }}
            >
              Find your next event
            </Button>
            <button
              onClick={onClose}
              className="text-on-surface-variant text-sm hover:text-on-surface transition-colors"
            >
              Maybe later
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Rating screen ───────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center px-6 bg-background/90 backdrop-blur-2xl">
      <div className="w-full max-w-md bg-surface-container-low rounded-2xl overflow-hidden border border-outline-variant/30">
        {/* Event header */}
        <div className="relative h-28 overflow-hidden">
          <img src={event.image_url || event.img} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-surface-container-low via-surface-container-low/60 to-transparent" />
          <div className="absolute bottom-0 left-0 w-full px-6 pb-3">
            <p className="text-xs text-primary uppercase tracking-widest font-bold mb-0.5">How was it?</p>
            <h3 className="font-headline text-base text-on-surface font-semibold leading-tight">{event.title}</h3>
          </div>
        </div>

        <div className="px-6 py-5 max-h-[60vh] overflow-y-auto">
          {/* Overall rating */}
          <div className="mb-5">
            <p className="text-xs text-on-surface-variant uppercase tracking-widest font-bold mb-2">Overall</p>
            <div className="flex justify-center gap-2 mb-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="transition-transform hover:scale-110 active:scale-95"
                >
                  <span
                    className={`material-symbols-outlined text-3xl transition-colors ${
                      star <= displayRating ? 'text-primary' : 'text-surface-container-highest'
                    }`}
                    style={{ fontVariationSettings: star <= displayRating ? "'FILL' 1" : "'FILL' 0" }}
                  >star</span>
                </button>
              ))}
            </div>
            <p className="text-center text-xs text-on-surface-variant">
              {rating === 0 ? 'Tap a star to rate' : RATING_LABELS[rating]}
            </p>
          </div>

          {/* Safety rating — only show after overall rating */}
          {rating > 0 && (
            <div className="mb-5">
              <p className="text-xs text-on-surface-variant uppercase tracking-widest font-bold mb-2">
                How safe did you feel?
              </p>
              <div className="flex justify-center gap-2 mb-1">
                {[1, 2, 3, 4, 5].map((s) => (
                  <button
                    key={s}
                    onClick={() => setSafetyRating(s)}
                    onMouseEnter={() => setHoverSafety(s)}
                    onMouseLeave={() => setHoverSafety(0)}
                    className="transition-transform hover:scale-110 active:scale-95"
                  >
                    <span
                      className={`material-symbols-outlined text-2xl transition-colors ${
                        s <= displaySafety ? 'text-safety' : 'text-surface-container-highest'
                      }`}
                      style={{ fontVariationSettings: s <= displaySafety ? "'FILL' 1" : "'FILL' 0" }}
                    >shield</span>
                  </button>
                ))}
              </div>
              <p className="text-center text-xs text-on-surface-variant">
                {safetyRating === 0 ? 'Optional' : SAFETY_LABELS[safetyRating]}
              </p>
            </div>
          )}

          {/* Experience tags */}
          {rating > 0 && (
            <div className="mb-5">
              <p className="text-xs text-on-surface-variant uppercase tracking-widest font-bold mb-2">
                What stood out?
              </p>
              <div className="flex flex-wrap gap-2">
                {EXPERIENCE_TAGS.map(tag => (
                  <button
                    key={tag.id}
                    onClick={() => toggleTag(tag.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
                      selectedTags.includes(tag.id)
                        ? 'bg-primary text-on-primary border-primary'
                        : 'bg-surface-container text-on-surface-variant border-outline-variant/30 hover:border-primary/30'
                    }`}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 12 }}>{tag.icon}</span>
                    {tag.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Written review */}
          {rating > 0 && (
            <textarea
              rows={3}
              maxLength={500}
              placeholder="Tell others about your experience (optional)..."
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              className="w-full bg-background border border-outline-variant/30 rounded-xl px-4 py-3 text-on-surface text-[16px] md:text-sm font-body outline-none focus:border-primary/50 transition-colors resize-none placeholder:text-on-surface-variant/40 mb-4"
            />
          )}

          {/* Anonymous toggle */}
          {rating > 0 && (
            <button
              type="button"
              onClick={() => setAnonymous((a) => !a)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-surface-container/60 transition-colors mb-3 text-left"
            >
              <div className={`relative w-9 h-[22px] rounded-full transition-colors flex-shrink-0 ${anonymous ? 'bg-primary' : 'bg-outline-variant/40'}`}>
                <span className={`absolute top-[3px] w-4 h-4 bg-white rounded-full shadow-sm transition-all ${anonymous ? 'left-[18px]' : 'left-[3px]'}`} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-on-surface leading-tight">Post anonymously</p>
                <p className="text-xs text-on-surface-variant mt-0.5">Your name won't appear on this review</p>
              </div>
            </button>
          )}

          {/* Actions */}
          {submitError && (
            <p className="text-xs text-error bg-error-container/20 rounded-xl px-4 py-3 mb-3">
              {submitError}
            </p>
          )}
          {/* Stacked on mobile: at 375px each fullWidth button gets ~165px, and
              "SUBMIT REVIEW" (uppercase, tracked, px-6) needs more than the ~117px
              left after padding, so it wrapped to two lines while "Skip" stayed on
              one and the pair looked uneven. */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button variant="secondary" fullWidth onClick={handleSkip}>Skip</Button>
            <Button variant="primary" fullWidth disabled={rating === 0 || submitting} onClick={handleSubmit}>
              {submitting ? 'Submitting…' : 'Submit Review'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
