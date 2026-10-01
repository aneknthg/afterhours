import { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';

function getPasswordStrength(pw) {
  if (!pw) return null;
  const hasUpper  = /[A-Z]/.test(pw);
  const hasLower  = /[a-z]/.test(pw);
  const hasDigit  = /\d/.test(pw);
  const hasSymbol = /[^A-Za-z0-9]/.test(pw);
  const variety   = [hasUpper, hasLower, hasDigit, hasSymbol].filter(Boolean).length;
  if (pw.length < 6)                      return { score: 0, label: 'Too short' };
  if (pw.length < 8 || variety < 2)       return { score: 1, label: 'Weak' };
  if (pw.length < 10 || variety < 3)      return { score: 2, label: 'Fair' };
  return                                         { score: 3, label: 'Strong' };
}

function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

function Alert({ type, message }) {
  if (!message) return null;
  const isError = type === 'error';
  return (
    <div className={`flex items-start gap-2.5 text-sm px-4 py-3 rounded-xl border ${
      isError
        ? 'text-error bg-error-container/20 border-error/20'
        : 'text-primary bg-primary-container/20 border-primary/20'
    }`}>
      <span className="material-symbols-outlined text-sm flex-shrink-0 mt-0.5">
        {isError ? 'error' : 'check_circle'}
      </span>
      <span>{message}</span>
    </div>
  );
}

function CommunityDeclaration({ agreed, onChange }) {
  return (
    <label className="flex items-start gap-3 cursor-pointer group">
      <div className="relative flex-shrink-0 mt-0.5">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only"
        />
        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
          agreed
            ? 'bg-primary border-primary'
            : 'border-outline-variant/50 group-hover:border-primary/50'
        }`}>
          {agreed && <span className="material-symbols-outlined text-on-primary" style={{ fontSize: 14 }}>check</span>}
        </div>
      </div>
      <span className="text-xs text-on-surface-variant leading-relaxed">
        Afterhours is a community for{' '}
        <span className="text-on-surface font-semibold">women</span>.
        By joining, I confirm I identify as a woman, agree to keep this a respectful space for everyone,
        and accept the{' '}
        <Link to="/terms" onClick={(e) => e.stopPropagation()} className="text-on-surface underline underline-offset-2 hover:text-primary transition-colors">Terms</Link>
        {' '}and{' '}
        <Link to="/privacy" onClick={(e) => e.stopPropagation()} className="text-on-surface underline underline-offset-2 hover:text-primary transition-colors">Privacy Policy</Link>.
      </span>
    </label>
  );
}

export default function Auth() {
  // ?mode=signup opens on sign-up: a visitor sent here from a shared event
  // has no account yet, so the login form would be the wrong door.
  const [searchParams]                = useSearchParams();
  const [mode, setMode]               = useState(searchParams.get('mode') === 'signup' ? 'signup' : 'login');
  const [email, setEmail]             = useState('');
  const [password, setPassword]       = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreedToCommunity, setAgreedToCommunity] = useState(false);
  const [error, setError]             = useState('');
  const [success, setSuccess]         = useState('');
  const [loading, setLoading]         = useState(false);

  const { signIn, signUp, signInWithGoogle, updatePassword, passwordRecovery, user } = useAuth();
  const navigate = useNavigate();

  // Redirect already-logged-in users away from /auth.
  // ProtectedRoute handles onboarding detection once the profile loads.
  useEffect(() => {
    // A recovery session (from the reset-password email) must stay here so
    // she can actually set the new password.
    if (passwordRecovery) { setMode('reset'); return; }
    if (user) navigate('/');
  }, [user, passwordRecovery]);

  async function handleResetPassword(e) {
    e.preventDefault();
    setError('');
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setLoading(true);
    try {
      await updatePassword(password);
      navigate('/');
    } catch (err) {
      setError(err.message || 'Could not update your password. Try again.');
    } finally {
      setLoading(false);
    }
  }

  function switchMode(next) {
    setMode(next);
    setError('');
    setSuccess('');
    setPassword('');
    setAgreedToCommunity(false);
  }

  async function handleForgotPassword(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!email.trim()) { setError('Enter your email address first.'); return; }
    setLoading(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        { redirectTo: `${window.location.origin}/auth` }
      );
      if (resetError) throw resetError;
      setSuccess('Check your email. We sent a password reset link.');
    } catch (err) {
      setError(err.message || 'Could not send reset email. Try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (mode === 'login') {
        const data = await signIn(email, password);

        if (!data?.user?.id) {
          throw new Error('Sign in failed. Please try again.');
        }

        // Navigate immediately — ProtectedRoute handles onboarding detection
        // once AuthContext finishes loading the profile in background.
        navigate('/');

      } else {
        // Signup — name + date of birth are collected in onboarding (step 1).
        if (password.length < 6)  { setError('Password must be at least 6 characters.'); setLoading(false); return; }
        if (!agreedToCommunity) {
          setError('Please confirm you identify as a woman and accept the Terms and Privacy Policy to join.');
          setLoading(false);
          return;
        }

        const data = await signUp(email, password);

        if (data?.session) {
          // Email confirmation OFF — user is auto-logged in
          navigate('/onboarding');
        } else {
          // Email confirmation ON — user needs to check email
          // switchMode clears `success`, so set the message after switching.
          switchMode('login');
          setSuccess('Account created! Check your email to confirm, then sign in.');
        }
      }
    } catch (err) {
      const msg = err.message || 'Something went wrong.';

      if (msg.includes('Invalid login credentials')) {
        setError('Wrong email or password. Try again or reset your password.');
      } else if (msg.includes('Email not confirmed')) {
        setError('Please check your email and click the confirmation link first.');
      } else if (msg.includes('User already registered')) {
        setError('This email is already registered. Try signing in instead.');
      } else if (msg.includes('rate limit') || msg.includes('too many') || msg.includes('email rate limit')) {
        setError('Too many attempts. Please wait a minute and try again.');
      } else if (msg.includes('weak_password') || msg.includes('at least')) {
        setError('Password is too weak. Use at least 6 characters.');
      } else if (msg.includes('invalid') && msg.includes('email')) {
        setError('Please enter a valid email address.');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setError('');
    try { await signInWithGoogle(); }
    catch (err) { setError(err.message || 'Google sign-in failed.'); }
  }

  const isLogin  = mode === 'login';
  const isForgot = mode === 'forgot';
  const isReset  = mode === 'reset';

  const headings = {
    login:  { title: 'Welcome back',    sub: 'Sign in to continue.' },
    signup: { title: 'Join Afterhours', sub: 'Create an account and find events worth showing up for.' },
    forgot: { title: 'Reset password',  sub: "Enter your email and we'll send a reset link." },
    reset:  { title: 'Set a new password', sub: 'Choose a new password for your account.' },
  };
  const { title, sub } = headings[mode];

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-20 relative">
      <div className="fixed top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-primary-container/20 blur-[130px] rounded-full pointer-events-none" />

      <div className="w-full max-w-md relative">

        <button
          onClick={() => isForgot ? switchMode('login') : navigate('/')}
          aria-label={isForgot ? 'Back to sign in' : 'Go back'}
          className="flex items-center justify-center text-on-surface-variant hover:text-primary transition-colors mb-8 group w-11 h-11 -ml-2"
        >
          <span className="material-symbols-outlined text-xl group-hover:-translate-x-0.5 transition-transform">arrow_back</span>
        </button>

        <div className="bg-surface-container-low rounded-2xl p-8 md:p-10 border border-outline-variant/20">

          <div className="text-center mb-8">
            <img src="/logo-white.png" alt="Afterhours" className="h-10 w-auto mx-auto mb-6" />
            <h1 className="font-headline text-3xl font-bold text-on-surface mb-2">{title}</h1>
            <p className="text-on-surface-variant text-sm leading-relaxed">{sub}</p>
          </div>

          {isReset ? (
            <form onSubmit={handleResetPassword} className="space-y-4" noValidate>
              <Input
                label="New password" type={showPassword ? 'text' : 'password'} placeholder="At least 6 characters"
                value={password} onChange={(e) => setPassword(e.target.value)}
                icon="lock" autoComplete="new-password" required
              />
              <Alert type="error" message={error} />
              <Button type="submit" variant="primary" size="lg" fullWidth disabled={loading}>
                {loading ? 'Saving…' : 'Save new password'}
              </Button>
            </form>
          ) : isForgot ? (
            <form onSubmit={handleForgotPassword} className="space-y-4" noValidate>
              <Input
                label="Email" type="email" placeholder="you@example.com"
                value={email} onChange={(e) => setEmail(e.target.value)}
                icon="mail" autoComplete="email" required
              />
              <Alert type="error"   message={error} />
              <Alert type="success" message={success} />
              <Button type="submit" variant="primary" size="lg" fullWidth disabled={loading}>
                {loading ? 'Sending…' : 'Send Reset Link'}
              </Button>
            </form>
          ) : (
            <>
              <button
                onClick={handleGoogle}
                className="w-full flex items-center justify-center gap-3 bg-surface-container border border-outline-variant/30 text-on-surface py-3.5 rounded-xl font-semibold text-sm hover:bg-surface-container-high active:scale-[0.98] transition-all mb-5"
              >
                <GoogleLogo />
                Continue with Google
              </button>

              <div className="flex items-center gap-4 mb-5">
                <div className="flex-1 h-px bg-outline-variant/20" />
                <span className="text-on-surface-variant text-xs uppercase tracking-widest">or</span>
                <div className="flex-1 h-px bg-outline-variant/20" />
              </div>

              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                <Input
                  label="Email" type="email" placeholder="you@example.com"
                  value={email} onChange={(e) => setEmail(e.target.value)}
                  icon="mail" autoComplete={isLogin ? 'username' : 'email'} required
                />

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                      Password
                    </label>
                    {isLogin && (
                      <button type="button" onClick={() => switchMode('forgot')}
                        className="text-xs text-on-surface-variant hover:text-primary transition-colors py-3.5">
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none text-base">lock</span>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete={isLogin ? 'current-password' : 'new-password'}
                      required minLength={6}
                      className="w-full bg-background border border-outline-variant/30 rounded-xl pl-9 pr-10 py-3 text-on-surface text-[16px] md:text-sm font-body outline-none focus:border-primary/50 transition-colors placeholder:text-on-surface-variant/40"
                    />
                    <button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'}
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-primary transition-colors p-2.5" tabIndex={-1}>
                      <span className="material-symbols-outlined text-base">{showPassword ? 'visibility_off' : 'visibility'}</span>
                    </button>
                  </div>

                  {/* Password strength — signup only */}
                  {!isLogin && (() => {
                    const strength = getPasswordStrength(password);
                    if (!strength) {
                      return (
                        <p className="mt-1.5 text-xs text-on-surface-variant/70">
                          At least 6 characters
                        </p>
                      );
                    }
                    const barColor = strength.score <= 1 ? 'bg-error' : strength.score === 2 ? 'bg-status-pending' : 'bg-safety';
                    const labelColor = strength.score <= 1 ? 'text-error' : strength.score === 2 ? 'text-status-pending' : 'text-safety';
                    return (
                      <div className="mt-2">
                        <div className="flex gap-1 mb-1.5">
                          {[0, 1, 2].map((i) => (
                            <div
                              key={i}
                              className={`h-1 flex-1 rounded-full transition-all duration-300 ${i < strength.score ? barColor : 'bg-surface-container-highest'}`}
                            />
                          ))}
                        </div>
                        <p className={`text-xs font-semibold ${labelColor}`}>{strength.label}</p>
                      </div>
                    );
                  })()}
                </div>

                {!isLogin && (
                  <div className="pt-1">
                    <CommunityDeclaration agreed={agreedToCommunity} onChange={setAgreedToCommunity} />
                  </div>
                )}

                <Alert type="error"   message={error} />
                <Alert type="success" message={success} />

                <Button type="submit" variant="primary" size="lg" fullWidth disabled={loading}>
                  {loading ? 'Please wait…' : isLogin ? 'Sign In' : 'Create Account'}
                </Button>
              </form>

              <p className="text-center mt-6 text-sm text-on-surface-variant">
                {isLogin ? "Don't have an account? " : 'Already have an account? '}
                <button onClick={() => switchMode(isLogin ? 'signup' : 'login')}
                  className="text-primary font-semibold hover:underline py-3">
                  {isLogin ? 'Sign up' : 'Sign in'}
                </button>
              </p>
            </>
          )}
        </div>

        <p className="text-center text-xs text-on-surface-variant/70 mt-5 leading-relaxed">
          By continuing you agree to our{' '}
          <Link to="/terms" className="text-on-surface-variant hover:text-primary transition-colors underline underline-offset-2">Terms</Link>
          {' '}and{' '}
          <Link to="/privacy" className="text-on-surface-variant hover:text-primary transition-colors underline underline-offset-2">Privacy Policy</Link>.
        </p>
      </div>
    </div>
  );
}
