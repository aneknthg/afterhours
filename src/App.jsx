/**
 * App.jsx
 * Place at: src/App.jsx  (replaces existing)
 *
 * Changes:
 *  1. All page imports converted to React.lazy() — Vite will split each
 *     page into its own chunk, so the initial bundle only contains the
 *     router + providers + the page the user lands on.
 *  2. <Suspense> wraps the route tree with a shared spinner fallback.
 *  3. Root-level <ErrorBoundary> so any page crash shows a recovery UI
 *     instead of a blank screen.
 */
import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/AuthContext';
import { SearchProvider } from './lib/SearchContext';
import { ToastProvider } from './components/Toast';
import { VerificationGateProvider } from './lib/VerificationGate';
import ProtectedRoute from './components/ProtectedRoute';
import { needsOnboarding } from './lib/onboarding';
import { peekPendingIntent, clearPendingIntent } from './lib/pendingIntent';
import ErrorBoundary from './components/ErrorBoundary';
import PublicLayout from './layouts/PublicLayout';
import AppLayout from './layouts/AppLayout';

// ── Lazy page imports ────────────────────────────────────────────────────────
// Vite code-splits on each dynamic import automatically.
// Named `/* webpackChunkName */` comments are optional but help in traces.

const Landing       = lazy(() => import('./pages/Landing'));
const Auth          = lazy(() => import('./pages/Auth'));
const Onboarding    = lazy(() => import('./pages/Onboarding'));
const Discover      = lazy(() => import('./pages/Discover'));
const MyEvents      = lazy(() => import('./pages/MyEvents'));
const EventDetail   = lazy(() => import('./pages/EventDetail'));
const CreateEvent   = lazy(() => import('./pages/CreateEvent'));
const Chat          = lazy(() => import('./pages/Chat'));
const Profile       = lazy(() => import('./pages/Profile'));
const PublicProfile = lazy(() => import('./pages/PublicProfile'));
// ProtectedRoute only proves someone is signed in. The real gate is the
// ADMIN_EMAILS allowlist inside the admin-payouts function, so a signed-in
// non-admin who guesses this URL gets a page that renders a 403 and no data.
const Admin         = lazy(() => import('./pages/Admin'));
const Terms         = lazy(() => import('./pages/Terms'));
const Privacy       = lazy(() => import('./pages/Privacy'));
const About         = lazy(() => import('./pages/About'));
const Manifesto     = lazy(() => import('./pages/Manifesto'));
const Press         = lazy(() => import('./pages/Press'));
const Safety        = lazy(() => import('./pages/Safety'));
const ChildSafety   = lazy(() => import('./pages/ChildSafety'));
const Hosts         = lazy(() => import('./pages/Hosts'));
const Cities        = lazy(() => import('./pages/Cities'));
const Notifications = lazy(() => import('./pages/Notifications'));
const Verify        = lazy(() => import('./pages/Verify'));
const Liveness      = lazy(() => import('./pages/Liveness'));

// ── Shared loading fallback ───────────────────────────────────────────────────
// Shown while a lazy chunk is being fetched. Matches the app background
// so there's no flash of white.
function PageSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

// ── Root redirect ─────────────────────────────────────────────────────────────
function RootRedirect() {
  const { user, loading, profile, profileLoading, passwordRecovery } = useAuth();
  if (loading) return <PageSpinner />;
  // A reset-password link signs her in with a recovery session; send her to
  // the set-new-password form instead of straight into the app. The app's
  // reset emails point here too (Site URL), so this must live at the root.
  if (passwordRecovery) return <Navigate to="/auth" replace />;
  if (!user) return <Navigate to="/landing" replace />;
  // Wait for the profile before deciding so a complete account isn't flashed
  // into /onboarding while it loads (the reason this check was removed before).
  if (profileLoading) return <PageSpinner />;
  // Accounts that haven't finished onboarding (no 18+ DOB / no interests) must
  // complete it before entering the app. This covers Google OAuth sign-ins,
  // which otherwise land here and skip onboarding entirely.
  if (needsOnboarding(profile, user.email)) return <Navigate to="/onboarding" replace />;
  // A shared event link parks its destination before sending her to sign up.
  // It is consumed HERE and nowhere else, for two reasons. Auth.jsx used to
  // consume it in both its user effect and its submit handler, which raced:
  // the first won, the second got null and sent her to /discover. And
  // /event/:id sits outside ProtectedRoute, so honouring the intent any
  // earlier would walk a brand new account straight past the 18+ gate above.
  const parked = peekPendingIntent();
  return <ParkedRedirect to={parked} />;
}

// Peek during render, clear on commit. Reading-and-clearing inside RootRedirect's
// render body looked fine and was not: StrictMode double-invokes render, so the
// first pass consumed the destination and the second navigated to /discover.
// Clearing in an effect is idempotent, so a double-invoke costs nothing.
function ParkedRedirect({ to }) {
  useEffect(() => { if (to) clearPendingIntent(); }, [to]);
  return <Navigate to={to ?? '/discover'} replace />;
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <SearchProvider>
          <ToastProvider>
            <VerificationGateProvider>
            {/* Root boundary — catches crashes from any page */}
            <ErrorBoundary>
              <Suspense fallback={<PageSpinner />}>
                <Routes>
                  <Route path="/" element={<RootRedirect />} />

                  {/* Liveness handoff for the mobile app. Deliberately outside
                      PublicLayout and outside ProtectedRoute: it's opened in the
                      app's in-app browser, which has no Supabase session, and it
                      authenticates with the one-time token in the URL fragment. */}
                  <Route path="/liveness" element={<Liveness />} />

                  {/* Public pages */}
                  <Route element={<PublicLayout />}>
                    <Route path="/landing"    element={<Landing />} />
                    <Route path="/auth"       element={<Auth />} />
                    <Route path="/onboarding" element={
                      <ProtectedRoute requireVerification={false} requireOnboarding={false}><Onboarding /></ProtectedRoute>
                    } />
                    <Route path="/verify" element={
                      <ProtectedRoute requireVerification={false} requireOnboarding={false}><Verify /></ProtectedRoute>
                    } />
                    <Route path="/terms"      element={<Terms />} />
                    <Route path="/privacy"    element={<Privacy />} />
                    <Route path="/about"      element={<About />} />
                    <Route path="/manifesto"  element={<Manifesto />} />
                    <Route path="/press"      element={<Press />} />
                    <Route path="/safety"     element={<Safety />} />
                    <Route path="/child-safety" element={<ChildSafety />} />
                    <Route path="/hosts"      element={<Hosts />} />
                    <Route path="/cities"     element={<Cities />} />
                  </Route>

                  {/* App pages */}
                  <Route element={<AppLayout />}>
                    <Route path="/discover"   element={
                      <ProtectedRoute requireVerification={false}><Discover /></ProtectedRoute>
                    } />
                    <Route path="/event/:id"  element={<EventDetail />} />
                    <Route path="/my-events"  element={
                      <ProtectedRoute><MyEvents /></ProtectedRoute>
                    } />
                    <Route path="/create"     element={
                      <ProtectedRoute><CreateEvent /></ProtectedRoute>
                    } />
                    <Route path="/chat"       element={
                      <ProtectedRoute><Chat /></ProtectedRoute>
                    } />
                    <Route path="/admin"      element={
                      <ProtectedRoute><Admin /></ProtectedRoute>
                    } />
                    <Route path="/notifications" element={
                      <ProtectedRoute><Notifications /></ProtectedRoute>
                    } />
                    <Route path="/profile/:id" element={<PublicProfile />} />
                    <Route path="/profile"    element={
                      <ProtectedRoute requireVerification={false}><Profile /></ProtectedRoute>
                    } />
                  </Route>

                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Suspense>
            </ErrorBoundary>
            </VerificationGateProvider>
          </ToastProvider>
        </SearchProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
