import { Navigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { needsOnboarding } from '../lib/onboarding';
import { isVerified } from '../lib/verification';

function Spinner() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

/**
 * requireVerification (default true):
 *   true  — redirect unverified users to /verify
 *   false — allow access regardless of verification status (used for /profile and /verify itself)
 * requireOnboarding (default true):
 *   true  — redirect users who haven't finished onboarding (no DOB / no interests) to /onboarding
 *   false — allow access (set on the /onboarding route itself to avoid a redirect loop)
 */
export default function ProtectedRoute({ children, requireVerification = true, requireOnboarding = true }) {
  const { user, profile, loading, profileLoading } = useAuth();

  // Waiting for session
  if (loading) return <Spinner />;

  // Not logged in
  if (!user) return <Navigate to="/auth" replace />;

  // Need the profile before we can check onboarding/verification
  if ((requireOnboarding || requireVerification) && profileLoading) return <Spinner />;

  // Onboarding (incl. the 18+ gate) must be completed before anything else
  if (requireOnboarding && needsOnboarding(profile, user.email)) {
    return <Navigate to="/onboarding" replace />;
  }

  // Profile loaded — check verification
  if (requireVerification && !isVerified(profile)) {
    return <Navigate to="/verify" replace />;
  }

  return children;
}
