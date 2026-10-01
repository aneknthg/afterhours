/**
 * ReviewChecker.jsx
 *
 * Thin wrapper: asks reviewsService.fetchPendingReviews() for the first
 * attended event that has actually ended (ends_at, or starts_at + 3h) and
 * hasn't been reviewed or dismissed, then shows ReviewPopup for it.
 */
import { useState, useEffect } from 'react';
import { useAuth } from '../lib/AuthContext';
import { reviewsService } from '../services/reviews.service';
import ReviewPopup from './ReviewPopup';

export default function ReviewChecker() {
  const { user, profile } = useAuth();
  const [pendingEvent, setPendingEvent] = useState(null);
  // Local memory of dismissals so a stale cached profile can't re-open the
  // same event after the user has already closed it.
  const [dismissedLocal, setDismissedLocal] = useState([]);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    // Small delay so the rest of the page loads first
    const timer = setTimeout(async () => {
      try {
        const dismissed = [...(profile?.dismissed_reviews || []), ...dismissedLocal];
        const pending = await reviewsService.fetchPendingReviews(user.id, dismissed);
        if (!cancelled && pending) setPendingEvent(pending);
      } catch (err) {
        console.error('[ReviewChecker]', err);
      }
    }, 2500);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [user?.id, profile, dismissedLocal]);

  if (!pendingEvent) return null;

  return (
    <ReviewPopup
      event={pendingEvent}
      userId={user.id}
      onClose={() => {
        setDismissedLocal((prev) => [...prev, pendingEvent.id]);
        setPendingEvent(null);
      }}
    />
  );
}
