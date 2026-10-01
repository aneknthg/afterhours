import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { supabase } from './supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(true);
  const [connectionStalled, setConnectionStalled] = useState(false); // SECURITY: surfaced to UI for slow-network feedback
  // True between clicking a password-reset email link and setting the new
  // password. Auth.jsx shows the "set new password" form instead of
  // redirecting, otherwise the recovery session just lands on Discover.
  const [passwordRecovery, setPasswordRecovery] = useState(false);

  // Prevents loadProfileInBackground from running multiple times for the same
  // user when INITIAL_SESSION + SIGNED_IN + getSession() all fire during OAuth.
  const profileLoadingForRef = useRef(null);

  useEffect(() => {
    // Race the session fetch against a timeout.
    // If Supabase is unreachable or stalled, we treat the user as logged-out
    // rather than blocking the whole app on loading=true indefinitely.
    const SESSION_TIMEOUT_MS = 15000; // SECURITY: 5s was too aggressive on slow Indian mobile networks

    // Show a stalled indicator if session takes > 8 seconds
    const stallTimer = setTimeout(() => setConnectionStalled(true), 8000);

    const timeout = new Promise((resolve) =>
      setTimeout(() => resolve({ data: { session: null } }), SESSION_TIMEOUT_MS)
    );
    Promise.race([supabase.auth.getSession(), timeout])
      .then(({ data: { session } }) => {
        clearTimeout(stallTimer);
        setConnectionStalled(false);
        setUser(session?.user ?? null);
        setLoading(false);

        if (session?.user) {
          loadProfileInBackground(session.user.id, session.user);
        } else {
          setProfileLoading(false);
        }
      }).catch(() => {
        clearTimeout(stallTimer);
        setConnectionStalled(false);
        setLoading(false);
        setProfileLoading(false);
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true);
        setUser(session?.user ?? null);
        setLoading(false);

        if (session?.user) {
          // INITIAL_SESSION is covered by the getSession() Promise.race above.
          // Only reload profile on real auth transitions so we don't triple-fire
          // during the PKCE code exchange (INITIAL_SESSION → SIGNED_IN → getSession).
          if (event !== 'INITIAL_SESSION') {
            loadProfileInBackground(session.user.id, session.user);
          }
        } else {
          profileLoadingForRef.current = null;
          setProfile(null);
          setProfileLoading(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  async function loadProfileInBackground(userId, authUser) {
    if (profileLoadingForRef.current === userId) return;
    profileLoadingForRef.current = userId;
    setProfileLoading(true);
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (data) {
        setProfile(data);
        return;
      }

      // Auto-create profile for new users
      const displayName =
        authUser?.user_metadata?.display_name ||
        authUser?.user_metadata?.full_name ||
        authUser?.email?.split('@')[0] ||
        'User';

      const { data: newProfile } = await supabase
        .from('profiles')
        .upsert({ id: userId, display_name: displayName })
        .select()
        .maybeSingle();

      setProfile(newProfile || { id: userId, display_name: displayName });
    } catch {
      // A transient read failure must not fabricate a profile with no DOB /
      // hobbies — that sends a fully-onboarded user back to /onboarding. Leave
      // the profile unknown and allow the next auth event to retry.
      profileLoadingForRef.current = null;
    } finally {
      setProfileLoading(false);
    }
  }

  // Re-read the authoritative profile from the DB. Used after server-side state
  // changes (e.g. the verify-identity edge function sets verification_status) so
  // the client reflects truth without writing protected columns itself.
  async function refreshProfile() {
    if (!user) return null;
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();
    if (data) setProfile(data);
    return data;
  }

  // FIX: signUp now ensures the profile row exists before returning.
  // This eliminates the race condition where Auth.jsx queries profiles
  // before loadProfileInBackground has created it.
  // Name + date of birth are collected in onboarding (step 1), not here — this keeps a
  // single collection point for both email and Google signups.
  async function signUp(email, password) {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;

    // FIX: Check if this is actually a new user.
    // Supabase returns a user with empty identities if the email is already registered
    // (when "Confirm email" is ON). It does NOT throw an error. We must check manually.
    if (data?.user?.identities?.length === 0) {
      return data; // treat as pending-confirmation — never reveal whether email exists
    }

    // FIX: If we got a session (email confirm OFF), create the profile immediately
    // so it exists before any profile query runs. display_name/date_of_birth are filled
    // in onboarding.
    if (data?.session?.user) {
      try {
        await supabase
          .from('profiles')
          .upsert({
            id: data.session.user.id,
            // Email signups tick the woman-identity box on the form, so mark it
            // accepted here and they skip the onboarding community-guidelines step.
            // OAuth (Google) signups get the DB default (false) and confirm in onboarding.
            community_guidelines_accepted: true,
          })
          .select()
          .maybeSingle();
      } catch {
        // Non-critical — loadProfileInBackground will retry
      }
    }

    return data;
  }

  // FIX: signIn now returns the full data object so Auth.jsx can use session.user
  async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }

  async function signInWithGoogle() {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth` },
    });
    if (error) throw error;
    return data;
  }

  async function signOut() {
    await supabase.auth.signOut();
    profileLoadingForRef.current = null;
    setUser(null);
    setProfile(null);
    setPasswordRecovery(false);
  }

  /** Completes the reset-password flow started from the email link. */
  async function updatePassword(password) {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
    setPasswordRecovery(false);
  }

  async function updateProfile(updates) {
    if (!user) return;

    const { data, error } = await supabase
      .from('profiles')
      .upsert({ id: user.id, ...updates, updated_at: new Date().toISOString() })
      .select()
      .maybeSingle();

    if (!error) {
      setProfile(data);
      return data;
    }

    if (error.message?.includes('column') && error.message?.includes('schema cache')) {
      const safeUpdates = { display_name: updates.display_name };
      const { data: safe, error: safeError } = await supabase
        .from('profiles')
        .upsert({ id: user.id, ...safeUpdates, updated_at: new Date().toISOString() })
        .select()
        .maybeSingle();
      if (safeError) throw safeError;
      setProfile(safe);
      return safe;
    }

    throw error;
  }

  return (
    <AuthContext.Provider
      value={{ user, profile, loading, profileLoading, connectionStalled, passwordRecovery, signUp, signIn, signInWithGoogle, signOut, updateProfile, updatePassword, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
