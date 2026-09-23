import React, { useState } from 'react';
import {
  X,
  Lock,
  Mail,
  User,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Building2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const AuthModal: React.FC = () => {
  const {
    authModalOpen,
    authModalMode,
    accountType,
    setAccountType,
    openAuthModal,
    closeAuthModal,
    loginWithEmail,
    signUpWithEmail,
    signInWithGoogle,
    resetPassword,
  } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');

  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const [formError, setFormError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState(false);

  if (!authModalOpen) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();

    setFormError(null);
    setResetSuccess(false);

    if (!email.includes('@')) {
      setFormError(
        'Please enter a valid email address.'
      );
      return;
    }

    if (
      authModalMode !== 'forgot' &&
      password.length < 8
    ) {
      setFormError(
        'Password must be at least 8 characters.'
      );
      return;
    }

    if (
      authModalMode === 'signup' &&
      !fullName.trim()
    ) {
      setFormError(
        'Full name is required.'
      );
      return;
    }

    if (
      authModalMode === 'signup' &&
      password !== confirmPassword
    ) {
      setFormError(
        'Passwords do not match.'
      );
      return;
    }

    setLoading(true);

    try {
      if (authModalMode === 'forgot') {
        await resetPassword(email);
        setResetSuccess(true);
      } else if (authModalMode === 'signup') {
        /*
         * Authority accounts cannot be publicly
         * created. They must be provisioned by
         * the administrator.
         */
        if (accountType === 'authority') {
          throw new Error(
            'Municipal authority accounts are provisioned by the system administrator. Use Google Sign-In with your authorized authority account.'
          );
        }

        await signUpWithEmail(
          fullName,
          email,
          password,
          'citizen'
        );
      } else {
        await loginWithEmail(
          email,
          password
        );
      }
    } catch (err) {
      setFormError(
        err instanceof Error
          ? err.message
          : 'Authentication failed.'
      );
    } finally {
      setLoading(false);
    }
  };

  const google = async () => {
    setFormError(null);
    setGoogleLoading(true);

    try {
      /*
       * AuthContext checks accountType.
       *
       * Citizen:
       * → normal Google sign-in
       *
       * Authority:
       * → only an authorized authority
       *   Firestore profile is accepted
       */
      await signInWithGoogle();
    } catch (err) {
      setFormError(
        err instanceof Error
          ? err.message
          : 'Google sign-in failed.'
      );
    } finally {
      setGoogleLoading(false);
    }
  };

  const isAuthority =
    accountType === 'authority';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">

        {/* TOP ACCENT */}
        <div
          className={`h-1.5 w-full ${
            isAuthority
              ? 'bg-amber-500'
              : 'bg-cyan-500'
          }`}
        />

        <div className="p-6 sm:p-8">

          {/* CLOSE */}
          <button
            onClick={closeAuthModal}
            aria-label="Close authentication"
            className="absolute right-5 top-5 rounded-xl p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>

          {/* ACCOUNT TYPE */}
          <div className="mb-5 grid grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-1.5">

            <button
              type="button"
              onClick={() => {
                setAccountType('citizen');
                setFormError(null);
              }}
              className={`rounded-xl py-2 text-xs font-bold transition ${
                accountType === 'citizen'
                  ? 'bg-cyan-500 text-slate-950 shadow-sm'
                  : 'text-slate-500 hover:bg-white'
              }`}
            >
              <User className="mr-1 inline h-4 w-4" />
              Citizen
            </button>

            <button
              type="button"
              onClick={() => {
                setAccountType('authority');
                setFormError(null);
              }}
              className={`rounded-xl py-2 text-xs font-bold transition ${
                accountType === 'authority'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-500 hover:bg-white'
              }`}
            >
              <Building2 className="mr-1 inline h-4 w-4" />
              Authority
            </button>

          </div>

          {/* HEADER */}
          <div className="text-center">

            <div
              className={`mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border ${
                isAuthority
                  ? 'border-amber-200 bg-amber-50 text-amber-600'
                  : 'border-cyan-200 bg-cyan-50 text-cyan-600'
              }`}
            >
              {isAuthority ? (
                <Building2 className="h-6 w-6" />
              ) : (
                <ShieldCheck className="h-6 w-6" />
              )}
            </div>

            <h3 className="mt-3 text-xl font-black text-slate-900">
              {isAuthority
                ? 'Municipal Authority Login'
                : authModalMode === 'signup'
                ? 'Create Citizen Account'
                : authModalMode === 'forgot'
                ? 'Reset Password'
                : 'Citizen Portal Login'}
            </h3>

            <p className="mt-1 text-xs text-slate-500">
              {isAuthority
                ? 'Sign in with your authorized municipal account.'
                : 'Use your verified account to report and track road issues.'}
            </p>

          </div>

          {/* ERROR */}
          {formError && (
            <div
              role="alert"
              className="mt-4 flex gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700"
            >
              <AlertCircle className="h-4 w-4 shrink-0" />

              <span>
                {formError}
              </span>
            </div>
          )}

          {/* RESET SUCCESS */}
          {resetSuccess && (
            <div
              role="status"
              className="mt-4 flex gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700"
            >
              <CheckCircle2 className="h-4 w-4" />

              <span>
                Password reset link sent.
                Check your inbox.
              </span>
            </div>
          )}

          {/* FORM */}
          <form
            onSubmit={submit}
            className="mt-5 space-y-3"
          >

            {/* FULL NAME */}
            {authModalMode === 'signup' &&
              accountType === 'citizen' && (
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-slate-700">
                    Full Name
                  </label>

                  <div className="relative">
                    <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                    <input
                      value={fullName}
                      onChange={e =>
                        setFullName(
                          e.target.value
                        )
                      }
                      className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs text-slate-900 outline-none focus:border-cyan-500"
                      placeholder="Enter your name"
                    />
                  </div>
                </div>
              )}

            {/* EMAIL */}
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-slate-700">
                {isAuthority
                  ? 'Municipal Account Email'
                  : 'Email Address'}
              </label>

              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                <input
                  type="email"
                  value={email}
                  onChange={e =>
                    setEmail(
                      e.target.value
                    )
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs text-slate-900 outline-none focus:border-cyan-500"
                  placeholder={
                    isAuthority
                      ? 'Authorized municipal email'
                      : 'name@example.com'
                  }
                />
              </div>
            </div>

            {/* PASSWORD */}
            {authModalMode !== 'forgot' && (
              <div>
                <div className="mb-1 flex justify-between">
                  <label className="text-[11px] font-semibold text-slate-700">
                    Password
                  </label>

                  {authModalMode === 'login' && (
                    <button
                      type="button"
                      onClick={() =>
                        openAuthModal(
                          'forgot',
                          accountType
                        )
                      }
                      className="text-[11px] text-cyan-600 hover:text-cyan-700"
                    >
                      Forgot?
                    </button>
                  )}
                </div>

                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                  <input
                    type="password"
                    value={password}
                    onChange={e =>
                      setPassword(
                        e.target.value
                      )
                    }
                    className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs text-slate-900 outline-none focus:border-cyan-500"
                    placeholder="••••••••"
                  />
                </div>
              </div>
            )}

            {/* CONFIRM PASSWORD */}
            {authModalMode === 'signup' &&
              accountType === 'citizen' && (
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={e =>
                    setConfirmPassword(
                      e.target.value
                    )
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-cyan-500"
                  placeholder="Confirm password"
                />
              )}

            {/* MAIN BUTTON */}
            <button
              disabled={
                loading ||
                googleLoading
              }
              className={`flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                isAuthority
                  ? 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                  : 'bg-cyan-500 text-slate-950 hover:bg-cyan-400'
              }`}
            >
              {loading && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}

              {authModalMode === 'signup'
                ? 'Create Account'
                : authModalMode === 'forgot'
                ? 'Send Reset Link'
                : 'Sign In'}
            </button>

          </form>

          {/* GOOGLE SIGN IN
              NOW AVAILABLE FOR BOTH
              CITIZEN AND AUTHORITY
          */}
          {authModalMode !== 'forgot' && (
            <>
              <div className="my-4 flex items-center gap-2">
                <div className="h-px flex-1 bg-slate-200" />

                <span className="text-[10px] text-slate-400">
                  OR
                </span>

                <div className="h-px flex-1 bg-slate-200" />
              </div>

              <button
                type="button"
                onClick={google}
                disabled={
                  googleLoading ||
                  loading
                }
                className={`flex w-full items-center justify-center gap-2 rounded-xl border py-2.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                  isAuthority
                    ? 'border-amber-200 bg-white text-slate-700 hover:bg-amber-50'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {googleLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full border border-slate-200 text-[11px] font-black">
                    G
                  </span>
                )}

                {isAuthority
                  ? 'Continue with Google as Authority'
                  : 'Continue with Google'}
              </button>

              {isAuthority && (
                <p className="mt-2 text-center text-[10px] leading-relaxed text-slate-400">
                  Only administrator-provisioned
                  municipal accounts can access
                  the Authority Hub.
                </p>
              )}
            </>
          )}

          {/* LOGIN / SIGNUP SWITCH */}
          {authModalMode !== 'forgot' && (
            <button
              type="button"
              onClick={() =>
                openAuthModal(
                  authModalMode === 'login'
                    ? 'signup'
                    : 'login',
                  accountType
                )
              }
              className="mt-4 w-full text-center text-xs text-slate-500 hover:text-cyan-600"
            >
              {authModalMode === 'login'
                ? accountType === 'authority'
                  ? 'Authority accounts are provisioned by administrators'
                  : 'New citizen? Create an account'
                : 'Already have an account? Sign in'}
            </button>
          )}

        </div>
      </div>
    </div>
  );
};
