import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import VerificationModal from '../components/VerificationModal';

export default function Verify() {
  const { profile } = useAuth();
  const navigate    = useNavigate();

  // Already verified — skip to discover
  useEffect(() => {
    if (profile?.verification_status === 'verified') {
      // '/' rather than /discover: RootRedirect owns the parked-link lookup.
      navigate('/', { replace: true });
    }
  }, [profile, navigate]);

  function handleClose() {
    // After dismissing from /verify, send to profile so they can upload a pic if needed
    navigate('/profile');
  }

  function handleVerified() {
    setTimeout(() => navigate('/', { replace: true }), 2000);
  }

  return (
    <VerificationModal
      onClose={handleClose}
      onVerified={handleVerified}
    />
  );
}
