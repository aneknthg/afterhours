import { createContext, useCallback, useContext, useRef, useState, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { isVerified } from './verification';

const VerificationModal = lazy(() => import('../components/VerificationModal'));

const VerificationGateContext = createContext(null);

/**
 * VerificationGateProvider — wrap the app so any component can do:
 *
 *   const requireVerified = useVerificationGate();
 *   onClick={() => requireVerified(() => doTheThing())}
 *
 * Behaviour:
 *   - Not logged in            → navigate('/auth') and return without running the action
 *   - Logged in, not verified  → open the verification modal; run the action on success
 *   - Logged in & verified     → run the action immediately
 *
 * This is the action-level companion to ProtectedRoute (which is route-level).
 * Use it for any interaction that should be blocked for unverified users:
 * RSVP, connection requests, joining chats, etc.
 */
export function VerificationGateProvider({ children }) {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const pendingActionRef = useRef(null);

  const requireVerified = useCallback((action) => {
    if (typeof action !== 'function') return;
    if (!user) { navigate('/auth'); return; }
    if (isVerified(profile)) { action(); return; }
    pendingActionRef.current = action;
    setOpen(true);
  }, [user, profile?.verification_status, profile?.is_test, navigate]);

  const handleClose = useCallback(() => {
    pendingActionRef.current = null;
    setOpen(false);
  }, []);

  const handleVerified = useCallback(() => {
    const action = pendingActionRef.current;
    pendingActionRef.current = null;
    setOpen(false);
    if (action) action();
  }, []);

  return (
    <VerificationGateContext.Provider value={requireVerified}>
      {children}
      {open && (
        <Suspense fallback={null}>
          <VerificationModal onClose={handleClose} onVerified={handleVerified} />
        </Suspense>
      )}
    </VerificationGateContext.Provider>
  );
}

export function useVerificationGate() {
  const ctx = useContext(VerificationGateContext);
  if (!ctx) throw new Error('useVerificationGate must be used inside <VerificationGateProvider>');
  return ctx;
}
