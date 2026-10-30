import React, { useState, useRef, useEffect } from 'react';
import { SupportedLang } from '../types/index.ts';
import { t, LANGS, setLanguage } from '../utils/i18n.ts';
import { Globe, Eye, EyeOff, AlertCircle, ArrowLeft, KeyRound, Info, X } from 'lucide-react';

interface LoginScreenProps {
  lang: SupportedLang;
  onLangChange: (lang: SupportedLang) => void;
  onLoginSuccess: (user: { email: string; role: string }) => void;
  onContinueAsCitizen: () => void;
  onTrackWithoutLogin: () => void;
  initialError?: string | null;
}

export function LoginScreen({
  lang,
  onLangChange,
  onLoginSuccess,
  onContinueAsCitizen,
  onTrackWithoutLogin,
  initialError,
}: LoginScreenProps) {
  const [showAuthForm, setShowAuthForm] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(initialError || null);
  const [capsLockActive, setCapsLockActive] = useState(false);
  const [showForgotDialog, setShowForgotDialog] = useState(false);

  const emailInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showAuthForm) {
      setTimeout(() => emailInputRef.current?.focus(), 50);
    }
  }, [showAuthForm]);

  const handleLanguageChange = (newLang: SupportedLang) => {
    setLanguage(newLang);
    onLangChange(newLang);
  };

  const handleKeyDownOrUp = (e: React.KeyboardEvent) => {
    setCapsLockActive(e.getModifierState && e.getModifierState('CapsLock'));
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      if (res.ok) {
        const user = await res.json();
        onLoginSuccess(user);
      } else if (res.status === 429) {
        setError(t(lang, 'too_many_attempts'));
      } else if (res.status === 401) {
        setError(t(lang, 'invalid_login'));
      } else {
        setError('Server error during sign in. Please try again.');
      }
    } catch (err: any) {
      console.error('Login fetch failed:', err);
      if (err.name === 'TypeError' && err.message === 'Failed to fetch') {
        setError('Connection blocked. Ensure you are on a secure connection and not behind a restrictive firewall.');
      } else {
        setError(`Unable to reach municipal auth server: ${err.message || 'Check connection'}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFillDemo = () => {
    setEmail('officer@voxsetu.demo');
    setPassword('demo1234');
    setError(null);
  };

  const scriptLineHeightClass = lang !== 'en' ? 'leading-[1.6]' : 'leading-normal';

  return (
    <div className={`relative flex min-h-screen flex-col items-center justify-center bg-[#F7F5F0] px-4 py-8 text-[#14213D] ${scriptLineHeightClass}`}>
      {/* Top right language picker */}
      <div className="absolute top-4 right-4 z-10">
        <div className="flex items-center gap-1.5 rounded-full border border-[#E1E4EE] bg-white px-3 py-1.5 shadow-xs transition hover:border-[#1F7A8C]">
          <Globe className="h-4 w-4 text-[#1F7A8C]" aria-hidden="true" />
          <select
            value={lang}
            onChange={(e) => handleLanguageChange(e.target.value as SupportedLang)}
            className="cursor-pointer bg-transparent text-xs font-semibold text-[#14213D] focus:outline-hidden"
            aria-label="Interface language"
          >
            {Object.values(LANGS).map((item) => (
              <option key={item.code} value={item.code}>
                {item.nativeName}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Centred Card */}
      <div className="w-full max-w-[420px] rounded-3xl border border-[#E1E4EE]/80 bg-[#FFFFFF] p-6 sm:p-8 shadow-xl shadow-black/5">
        {/* Brand Header */}
        <div className="text-center space-y-2 mb-6">
          {/* Logo SVG: Speech bubble with bridge arch at bottom */}
          <div className="flex justify-center mb-1">
            <svg
              width="60"
              height="60"
              viewBox="0 0 64 64"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="h-14 w-14 drop-shadow-xs"
              aria-label="VoxSetu Bridge Logo"
            >
              {/* Navy Speech Bubble Body */}
              <rect x="6" y="8" width="52" height="40" rx="14" fill="#14213D" />
              {/* Bridge Arch in Teal forming the speech bottom */}
              <path
                d="M16 48 C 22 28, 42 28, 48 48"
                stroke="#1F7A8C"
                strokeWidth="4.5"
                strokeLinecap="round"
                fill="none"
              />
              {/* Bridge Roadway Deck */}
              <line x1="10" y1="48" x2="54" y2="48" stroke="#1F7A8C" strokeWidth="3.5" strokeLinecap="round" />
              {/* Voice Waves / Community Dots */}
              <circle cx="32" cy="22" r="3" fill="#1F7A8C" />
              <circle cx="22" cy="24" r="2.2" fill="#E1E4EE" />
              <circle cx="42" cy="24" r="2.2" fill="#E1E4EE" />
            </svg>
          </div>

          <h1 className="text-2xl font-black tracking-tight text-[#14213D]">
            VoxSetu
          </h1>
          <p className="text-xs font-semibold text-[#1F7A8C]">
            {t(lang, 'tagline')}
          </p>

          <div className="pt-2">
            <h2 className="text-lg font-bold text-[#14213D]">
              {t(lang, 'login_title')}
            </h2>
            <p className="text-xs text-[#5A6279] mt-0.5">
              {t(lang, 'login_sub')}
            </p>
          </div>
        </div>

        {/* Portal Options or Inline Authority Form */}
        {!showAuthForm ? (
          <div className="space-y-3.5">
            {/* Primary Teal: Citizen */}
            <button
              type="button"
              onClick={onContinueAsCitizen}
              className="flex min-h-[48px] w-full items-center justify-center rounded-xl bg-[#1F7A8C] px-4 py-3 text-sm font-bold text-white shadow-md shadow-[#1F7A8C]/20 transition hover:bg-[#186270] focus:ring-2 focus:ring-[#1F7A8C] focus:ring-offset-2 focus:outline-hidden cursor-pointer"
            >
              {t(lang, 'continue_guest')}
            </button>

            {/* Secondary Outlined: Authority */}
            <button
              type="button"
              onClick={() => {
                setShowAuthForm(true);
                setError(null);
              }}
              className="flex min-h-[48px] w-full items-center justify-center rounded-xl border-2 border-[#1F7A8C] bg-white px-4 py-3 text-sm font-bold text-[#1F7A8C] transition hover:bg-[#1F7A8C]/5 focus:ring-2 focus:ring-[#1F7A8C] focus:ring-offset-2 focus:outline-hidden cursor-pointer"
            >
              {t(lang, 'authority_login')}
            </button>

            {/* Track Without Login Link */}
            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={onTrackWithoutLogin}
                className="text-xs font-semibold text-[#1F7A8C] hover:text-[#14213D] hover:underline focus:outline-hidden cursor-pointer"
              >
                {t(lang, 'track_without_login')} →
              </button>
            </div>
          </div>
        ) : (
          /* Inline Authority Sign-in Form */
          <form onSubmit={handleLogin} className="space-y-4" noValidate>
            <div className="flex items-center justify-between border-b border-[#E1E4EE] pb-2">
              <button
                type="button"
                onClick={() => {
                  setShowAuthForm(false);
                  setError(null);
                }}
                className="flex items-center gap-1.5 text-xs font-bold text-[#5A6279] hover:text-[#14213D] focus:outline-hidden cursor-pointer"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>{t(lang, 'back')}</span>
              </button>
              <span className="text-[11px] font-semibold text-[#1F7A8C] bg-[#1F7A8C]/10 px-2 py-0.5 rounded-md">
                Municipal Officer
              </span>
            </div>

            {/* Email Field */}
            <div>
              <label htmlFor="auth-email" className="block text-xs font-bold text-[#14213D] mb-1">
                {t(lang, 'email')}
              </label>
              <input
                ref={emailInputRef}
                id="auth-email"
                type="email"
                autoComplete="username"
                inputMode="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="officer@voxsetu.demo"
                className="w-full rounded-xl border border-[#E1E4EE] bg-[#F7F5F0] px-3.5 py-2.5 text-sm text-[#14213D] placeholder-[#5A6279]/60 transition focus:border-[#1F7A8C] focus:bg-white focus:ring-2 focus:ring-[#1F7A8C] focus:outline-hidden"
              />
            </div>

            {/* Password Field */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="auth-password" className="text-xs font-bold text-[#14213D]">
                  {t(lang, 'password')}
                </label>
                <button
                  type="button"
                  onClick={() => setShowForgotDialog(true)}
                  className="text-[11px] text-[#1F7A8C] hover:underline"
                >
                  {t(lang, 'forgot')}
                </button>
              </div>

              <div className="relative">
                <input
                  id="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={handleKeyDownOrUp}
                  onKeyUp={handleKeyDownOrUp}
                  aria-describedby={error ? 'auth-error' : undefined}
                  className="w-full rounded-xl border border-[#E1E4EE] bg-[#F7F5F0] px-3.5 py-2.5 pr-11 text-sm text-[#14213D] placeholder-[#5A6279]/60 transition focus:border-[#1F7A8C] focus:bg-white focus:ring-2 focus:ring-[#1F7A8C] focus:outline-hidden"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-pressed={showPassword}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1 text-[#5A6279] hover:text-[#14213D] focus:outline-hidden"
                  aria-label={showPassword ? t(lang, 'hide') : t(lang, 'show')}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              {capsLockActive && (
                <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-amber-600">
                  <AlertCircle className="h-3 w-3" />
                  Caps Lock is ON
                </p>
              )}
            </div>

            {/* Error Message */}
            {error && (
              <div
                id="auth-error"
                role="alert"
                aria-live="polite"
                className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-2.5 text-xs font-medium text-red-700 animate-in fade-in"
              >
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-600" />
                <span>{error}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="flex min-h-[48px] w-full items-center justify-center rounded-xl bg-[#1F7A8C] px-4 py-3 text-sm font-bold text-white shadow-md shadow-[#1F7A8C]/20 transition hover:bg-[#186270] disabled:cursor-not-allowed disabled:opacity-60 focus:ring-2 focus:ring-[#1F7A8C] focus:ring-offset-2 focus:outline-hidden cursor-pointer"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Verifying...</span>
                </span>
              ) : (
                t(lang, 'sign_in')
              )}
            </button>

            {/* Demo Account Filler */}
            <div className="rounded-xl border border-dashed border-[#1F7A8C]/30 bg-[#1F7A8C]/5 p-3 text-center space-y-1">
              <button
                type="button"
                onClick={handleFillDemo}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#1F7A8C] hover:underline cursor-pointer"
              >
                <KeyRound className="h-3.5 w-3.5" />
                <span>{t(lang, 'use_demo')}</span>
              </button>
              <p className="text-[11px] text-[#5A6279]">
                officer@voxsetu.demo • password: demo1234
              </p>
            </div>
          </form>
        )}

        {/* Footer Notes in Card */}
        <div className="mt-6 border-t border-[#E1E4EE] pt-4 space-y-2 text-center">
          <p className="text-[11px] text-[#5A6279]">
            {t(lang, 'privacy_note')}
          </p>
          <div className="inline-block rounded-lg bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-800 border border-amber-200/60">
            {t(lang, 'demo_notice')}
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotDialog && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 animate-in fade-in"
        >
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl space-y-3">
            <div className="flex items-center justify-between border-b border-[#E1E4EE] pb-2">
              <div className="flex items-center gap-2 text-[#14213D] font-bold text-sm">
                <Info className="h-4 w-4 text-[#1F7A8C]" />
                <h3>{t(lang, 'forgot_dialog_title')}</h3>
              </div>
              <button
                onClick={() => setShowForgotDialog(false)}
                className="rounded-md p-1 text-[#5A6279] hover:bg-[#F7F5F0]"
                aria-label="Close dialog"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-[#5A6279] leading-relaxed">
              {t(lang, 'forgot_dialog_msg')}
            </p>
            <div className="pt-2 text-right">
              <button
                onClick={() => setShowForgotDialog(false)}
                className="rounded-lg bg-[#1F7A8C] px-3.5 py-1.5 text-xs font-bold text-white hover:bg-[#186270]"
              >
                {t(lang, 'close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
