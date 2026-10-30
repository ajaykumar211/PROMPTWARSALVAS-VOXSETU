import React, { useState } from 'react';
import { SupportedLang, CitizenProfile } from '../types/index.ts';
import { t } from '../utils/i18n.ts';
import { X, User, Mail, Lock, Phone, UserCheck, AlertCircle, Loader2, ShieldCheck, ArrowRight } from 'lucide-react';

interface CitizenAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: SupportedLang;
  onSuccess: (profile: CitizenProfile) => void;
  initialMode?: 'login' | 'register';
}

export const CitizenAuthModal: React.FC<CitizenAuthModalProps> = ({
  isOpen,
  onClose,
  lang,
  onSuccess,
  initialMode = 'login',
}) => {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    if (!password || password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }
    if (mode === 'register' && !fullName.trim()) {
      setError('Please enter your full name.');
      return;
    }

    setLoading(true);

    const endpoint = mode === 'register' ? '/api/auth/citizen/register' : '/api/auth/citizen/login';
    const payload =
      mode === 'register'
        ? { email: email.trim(), password, fullName: fullName.trim(), phone: phone.trim() || undefined }
        : { email: email.trim(), password };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.message || json.error || 'Authentication failed. Please check your details.');
      }

      if (json.user) {
        onSuccess(json.user);
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-[#E1E4EE] bg-white shadow-xl animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E1E4EE] bg-[#F7F5F0] px-6 py-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-[#3B82F6]" />
            <h3 className="font-bold text-[#14213D]">
              {mode === 'login' ? 'Citizen Sign In' : 'Create Citizen Account'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-[#5A6279] hover:bg-[#E1E4EE] hover:text-[#14213D] transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Toggle */}
        <div className="flex border-b border-[#E1E4EE] bg-[#F7F5F0]/50 p-1.5">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError(null);
            }}
            className={`flex-1 rounded-lg py-2 text-center text-xs font-bold transition ${
              mode === 'login'
                ? 'bg-white text-[#14213D] shadow-2xs'
                : 'text-[#5A6279] hover:text-[#14213D]'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setError(null);
            }}
            className={`flex-1 rounded-lg py-2 text-center text-xs font-bold transition ${
              mode === 'register'
                ? 'bg-white text-[#14213D] shadow-2xs'
                : 'text-[#5A6279] hover:text-[#14213D]'
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {mode === 'register' && (
            <div>
              <label className="block text-xs font-bold text-[#14213D] mb-1">
                Full Name <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <User className="absolute top-3 left-3 h-4 w-4 text-[#5A6279]" />
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="E.g. Ramesh Kumar"
                  className="h-10 w-full rounded-xl border border-[#E1E4EE] bg-[#F7F5F0] pl-9 pr-3 text-xs font-medium text-[#14213D] focus:border-[#3B82F6] focus:bg-white focus:ring-2 focus:ring-[#3B82F6] focus:outline-hidden"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-[#14213D] mb-1">
              Email Address <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Mail className="absolute top-3 left-3 h-4 w-4 text-[#5A6279]" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="citizen@example.com"
                className="h-10 w-full rounded-xl border border-[#E1E4EE] bg-[#F7F5F0] pl-9 pr-3 text-xs font-medium text-[#14213D] focus:border-[#3B82F6] focus:bg-white focus:ring-2 focus:ring-[#3B82F6] focus:outline-hidden"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#14213D] mb-1">
              Password <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Lock className="absolute top-3 left-3 h-4 w-4 text-[#5A6279]" />
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="h-10 w-full rounded-xl border border-[#E1E4EE] bg-[#F7F5F0] pl-9 pr-3 text-xs font-medium text-[#14213D] focus:border-[#3B82F6] focus:bg-white focus:ring-2 focus:ring-[#3B82F6] focus:outline-hidden"
              />
            </div>
          </div>

          {mode === 'register' && (
            <div>
              <label className="block text-xs font-bold text-[#14213D] mb-1">
                Mobile Number <span className="text-[10px] text-[#5A6279] font-normal">(Optional for SMS alerts)</span>
              </label>
              <div className="relative">
                <Phone className="absolute top-3 left-3 h-4 w-4 text-[#5A6279]" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="h-10 w-full rounded-xl border border-[#E1E4EE] bg-[#F7F5F0] pl-9 pr-3 text-xs font-medium text-[#14213D] focus:border-[#3B82F6] focus:bg-white focus:ring-2 focus:ring-[#3B82F6] focus:outline-hidden"
                />
              </div>
            </div>
          )}

          <p className="text-[11px] text-[#5A6279] leading-relaxed pt-1">
            🔒 Your password is securely encrypted with cryptographic salting. Your account is assigned a permanent citizen tracking identity for looking up your civic reports.
          </p>

          <button
            type="submit"
            disabled={loading}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#14213D] text-xs font-bold text-white shadow-xs hover:bg-[#1E293B] focus:ring-2 focus:ring-[#3B82F6] disabled:opacity-50 transition"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{mode === 'register' ? 'Creating Account...' : 'Signing In...'}</span>
              </>
            ) : (
              <>
                <span>{mode === 'register' ? 'Complete Registration' : 'Sign In to Citizen Portal'}</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
