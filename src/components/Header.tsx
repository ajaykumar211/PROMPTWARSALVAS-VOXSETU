import React from 'react';
import { SupportedLang, CitizenProfile } from '../types/index.ts';
import { LANGS, t } from '../utils/i18n.ts';
import { ShieldAlert, Bell, LogOut, ArrowLeftRight, UserCheck, User } from 'lucide-react';

interface HeaderProps {
  role: 'none' | 'citizen' | 'authority';
  authorityViewMode: 'authority' | 'citizen';
  onAuthorityViewModeChange: (mode: 'authority' | 'citizen') => void;
  lang: SupportedLang;
  onLangChange: (lang: SupportedLang) => void;
  onOpenLimitations: () => void;
  unreadCount: number;
  onClearUnread: () => void;
  isConnectedSse: boolean;
  user: { email: string; role: string } | null;
  onLogout: () => void;
  onSwitchRole: () => void;
  citizenUser?: CitizenProfile | null;
  onOpenCitizenAuth?: () => void;
  onCitizenLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  role,
  authorityViewMode,
  onAuthorityViewModeChange,
  lang,
  onLangChange,
  onOpenLimitations,
  unreadCount,
  onClearUnread,
  isConnectedSse,
  user,
  onLogout,
  onSwitchRole,
  citizenUser,
  onOpenCitizenAuth,
  onCitizenLogout,
}) => {
  return (
    <header className="border-b border-[#E1E4EE] bg-[#FFFFFF] shadow-xs">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-3 sm:px-6">
        {/* Brand & Tagline */}
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-black tracking-tight text-[#14213D]">
              VoxSetu
            </span>
            <span className="hidden rounded bg-[#1F7A8C]/10 px-2 py-0.5 text-xs font-semibold text-[#1F7A8C] sm:inline-block">
              {role === 'authority' ? 'Authority Portal' : 'Citizen Portal'}
            </span>
            {/* Live SSE Indicator */}
            <div
              className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700"
              title={isConnectedSse ? 'Live stream active' : 'Connecting to live updates...'}
            >
              <span className={`h-2 w-2 rounded-full ${isConnectedSse ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'}`} />
              <span className="hidden sm:inline">Live</span>
            </div>
          </div>
          <p className="text-xs font-medium text-[#5A6279]">
            {t(lang, 'tagline')}
          </p>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Notification Bell (for tracked report updates) */}
          {unreadCount > 0 && (
            <button
              onClick={onClearUnread}
              className="relative flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-lg border border-[#E1E4EE] bg-[#F7F5F0] text-[#14213D] transition hover:bg-amber-50 focus:ring-2 focus:ring-[#1F7A8C] focus:outline-hidden cursor-pointer"
              aria-label={`${unreadCount} new civic updates`}
              title="New updates on your tracked reports"
            >
              <Bell className="h-4 w-4 sm:h-5 sm:w-5 text-amber-600 animate-bounce" />
              <span className="absolute -top-1 -right-1 flex h-4 w-4 sm:h-5 sm:w-5 items-center justify-center rounded-full bg-[#D9480F] text-[9px] sm:text-[10px] font-bold text-white shadow-xs">
                {unreadCount}
              </span>
            </button>
          )}

          {/* Citizen Mode Controls: Sign In/Register or User Badge */}
          {role === 'citizen' && (
            <div className="flex items-center gap-2">
              {citizenUser ? (
                <div className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50/80 px-2 py-1 sm:px-3 sm:py-1.5 text-[11px] sm:text-xs">
                  <div className="flex flex-col text-left">
                    <span className="font-bold text-[#14213D] leading-tight truncate max-w-[80px] sm:max-w-none">
                      {citizenUser.fullName}
                    </span>
                    <span className="hidden sm:inline font-mono text-[10px] text-[#3B82F6] font-semibold">
                      ID: {citizenUser.citizenTrackingId}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={onCitizenLogout}
                    className="ml-1 rounded-md bg-white p-1 sm:px-2 sm:py-1 text-[11px] font-bold text-red-600 hover:bg-red-50 border border-red-200 shadow-2xs transition cursor-pointer"
                    title="Sign out of Citizen Account"
                  >
                    <LogOut className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={onOpenCitizenAuth}
                  className="flex h-9 sm:h-10 items-center gap-1.5 rounded-xl border border-[#3B82F6]/40 bg-blue-50 px-2.5 sm:px-3.5 text-xs font-bold text-[#3B82F6] hover:bg-[#3B82F6] hover:text-white transition shadow-2xs cursor-pointer"
                >
                  <UserCheck className="h-4 w-4" />
                  <span className="hidden sm:inline">Sign In / Register</span>
                  <span className="sm:hidden">Sign In</span>
                </button>
              )}

              <button
                type="button"
                onClick={onSwitchRole}
                className="flex h-9 sm:h-10 items-center gap-1.5 rounded-xl border border-[#E1E4EE] bg-[#F7F5F0] px-2 sm:px-3 text-xs font-semibold text-[#5A6279] hover:text-[#14213D] hover:bg-white focus:outline-hidden cursor-pointer"
                title="Switch to portal selection screen"
              >
                <ArrowLeftRight className="h-3.5 w-3.5 text-[#1F7A8C]" />
                <span className="hidden sm:inline">{t(lang, 'switch_role')}</span>
              </button>
            </div>
          )}

          {/* Authority Mode Controls: Toggle View, Officer info, Switch role, Sign out */}
          {role === 'authority' && user && (
            <>
              {/* Citizen/Authority view toggle only for signed-in authorities */}
              <div className="flex rounded-lg border border-[#E1E4EE] bg-[#F7F5F0] p-1 scale-90 sm:scale-100 origin-right">
                <button
                  type="button"
                  onClick={() => onAuthorityViewModeChange('citizen')}
                  className={`flex h-8 sm:h-9 items-center justify-center rounded-md px-2 sm:px-3 text-[10px] sm:text-xs font-semibold transition cursor-pointer ${
                    authorityViewMode === 'citizen'
                      ? 'bg-[#FFFFFF] text-[#14213D] shadow-xs'
                      : 'text-[#5A6279] hover:text-[#14213D]'
                  }`}
                >
                  {t(lang, 'citizen_view')}
                </button>
                <button
                  type="button"
                  onClick={() => onAuthorityViewModeChange('authority')}
                  className={`flex h-8 sm:h-9 items-center justify-center rounded-md px-2 sm:px-3 text-[10px] sm:text-xs font-semibold transition cursor-pointer ${
                    authorityViewMode === 'authority'
                      ? 'bg-[#FFFFFF] text-[#14213D] shadow-xs'
                      : 'text-[#5A6279] hover:text-[#14213D]'
                  }`}
                >
                  {t(lang, 'authority_view')}
                </button>
              </div>

              {/* Officer Account Details & Sign out */}
              <div className="flex items-center gap-1.5 sm:gap-2.5 border-l border-[#E1E4EE] pl-1.5 sm:pl-3">
                <div className="hidden md:flex flex-col text-right">
                  <span className="text-xs font-bold text-[#14213D] leading-tight">
                    {user.email.split('@')[0]}
                  </span>
                  <span className="text-[10px] text-[#5A6279]">
                    Officer
                  </span>
                </div>

                <button
                  type="button"
                  onClick={onLogout}
                  className="flex h-9 sm:h-10 items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2 sm:px-2.5 text-xs font-bold text-red-700 hover:bg-red-100 focus:outline-hidden cursor-pointer"
                  title="Sign out of Authority Portal"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span className="hidden lg:inline">{t(lang, 'sign_out')}</span>
                </button>
              </div>
            </>
          )}

          {/* Language Picker */}
          <div className="relative">
            <select
              value={lang}
              onChange={(e) => onLangChange(e.target.value as SupportedLang)}
              className="flex h-9 sm:h-10 items-center rounded-lg border border-[#E1E4EE] bg-[#FFFFFF] px-2 sm:px-3 pr-7 sm:pr-8 text-xs font-semibold text-[#14213D] shadow-xs focus:border-[#1F7A8C] focus:ring-2 focus:ring-[#1F7A8C] focus:outline-hidden cursor-pointer"
              aria-label="Select interface language"
            >
              {Object.values(LANGS).map((item) => (
                <option key={item.code} value={item.code}>
                  {item.code.toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          {/* Limitations Link */}
          <button
            type="button"
            onClick={onOpenLimitations}
            className="flex h-9 sm:h-10 items-center gap-1.5 rounded-lg border border-dashed border-[#E1E4EE] px-2 sm:px-2.5 text-xs font-semibold text-[#5A6279] hover:border-[#1F7A8C] hover:text-[#1F7A8C] focus:ring-2 focus:ring-[#1F7A8C] focus:outline-hidden cursor-pointer"
            title="Read system limitations, AI honesty disclosures, and design notes"
          >
            <ShieldAlert className="h-4 w-4" />
            <span className="hidden xl:inline">{t(lang, 'limitations')}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
