import React, { useState, useEffect, useCallback } from 'react';
import { SupportedLang, Report, Hotspot, CitizenProfile } from './types/index.ts';
import { getSavedLanguage, setLanguage, t } from './utils/i18n.ts';
import { Header } from './components/Header.tsx';
import { CitizenView } from './components/CitizenView.tsx';
import { AuthorityView } from './components/AuthorityView.tsx';
import { LimitationsModal } from './components/LimitationsModal.tsx';
import { LoginScreen } from './components/LoginScreen.tsx';
import { CitizenAuthModal } from './components/CitizenAuthModal.tsx';
import { Sparkles } from 'lucide-react';

export default function App() {
  // Navigation Role: 'none' (LoginScreen), 'citizen', or 'authority'
  const [role, setRole] = useState<'none' | 'citizen' | 'authority'>('none');
  const [authorityViewMode, setAuthorityViewMode] = useState<'authority' | 'citizen'>('authority');
  const [auth, setAuth] = useState<{ email: string; role: string } | null>(null);
  const [authExpiredMessage, setAuthExpiredMessage] = useState<string | null>(null);

  // Citizen Account State
  const [citizenUser, setCitizenUser] = useState<CitizenProfile | null>(null);
  const [isCitizenAuthOpen, setIsCitizenAuthOpen] = useState(false);

  const [lang, setLangState] = useState<SupportedLang>('en');
  const [reports, setReports] = useState<Report[]>([]);
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [activeTrackCode, setActiveTrackCode] = useState<string>('');
  const [initialCitizenTab, setInitialCitizenTab] = useState<'report' | 'track'>('report');
  const [isLimitationsOpen, setIsLimitationsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isConnectedSse, setIsConnectedSse] = useState(false);
  const [liveToast, setLiveToast] = useState<string | null>(null);

  // Initialize Language
  useEffect(() => {
    const saved = getSavedLanguage();
    setLangState(saved);
    document.documentElement.lang = saved;
  }, []);

  const handleLangChange = (newLang: SupportedLang) => {
    setLangState(newLang);
    setLanguage(newLang);
  };

  // Check existing citizen session on mount
  useEffect(() => {
    fetch('/api/auth/citizen/me')
      .then((res) => res.json())
      .then((data) => {
        if (data.authenticated && data.user) {
          setCitizenUser(data.user);
        }
      })
      .catch(() => {});
  }, []);

  const handleCitizenLogout = async () => {
    try {
      await fetch('/api/auth/citizen/logout', { method: 'POST' });
      setCitizenUser(null);
    } catch {
      // ignore
    }
  };

  // Check existing session once on mount if an authority session was previously active
  useEffect(() => {
    try {
      const wasAuthority = localStorage.getItem('voxsetu_authority_active') === '1';
      if (!wasAuthority) return;

      fetch('/api/auth/me')
        .then((res) => {
          if (res.ok) return res.json();
          throw new Error('Not authenticated');
        })
        .then((user) => {
          if (user && user.role === 'authority') {
            setAuth(user);
            setRole('authority');
          } else {
            localStorage.removeItem('voxsetu_authority_active');
          }
        })
        .catch(() => {
          localStorage.removeItem('voxsetu_authority_active');
        });
    } catch {
      // ignore
    }
  }, []);

  // Fetch Authority Data - ONLY when user is an authenticated Authority!
  // This prevents the 2 console 401 errors for unauthenticated users.
  const fetchAuthorityData = useCallback(async () => {
    if (role !== 'authority') return;

    try {
      const [repRes, hsRes] = await Promise.all([
        fetch('/api/reports'),
        fetch('/api/hotspots'),
      ]);

      if (repRes.status === 401 || hsRes.status === 401) {
        // Session expired
        setAuth(null);
        setRole('none');
        setAuthExpiredMessage('Session expired. Please sign in again.');
        return;
      }

      if (repRes.ok) {
        const repJson = await repRes.json();
        setReports(repJson);
      }
      if (hsRes.ok) {
        const hsJson = await hsRes.json();
        setHotspots(hsJson);
      }
    } catch (err) {
      console.warn('Authority data fetch error:', err);
    }
  }, [role]);

  useEffect(() => {
    if (role === 'authority') {
      fetchAuthorityData();
    }
  }, [role, fetchAuthorityData]);

  // Server-Sent Events setup with polling fallback
  useEffect(() => {
    let es: EventSource | null = null;
    let fallbackInterval: any = null;

    try {
      es = new EventSource('/api/events');

      es.onopen = () => {
        setIsConnectedSse(true);
        if (fallbackInterval) {
          clearInterval(fallbackInterval);
          fallbackInterval = null;
        }
      };

      const handleEventUpdate = (e: MessageEvent, eventName: string) => {
        if (role === 'authority') {
          fetchAuthorityData();
        }
        setUnreadCount((prev) => prev + 1);

        try {
          const payload = JSON.parse(e.data);
          const msg =
            eventName === 'status_changed'
              ? `Update on ${payload.trackingCode}: ${payload.status}`
              : eventName === 'report_created'
              ? `New civic report registered (${payload.trackingCode})`
              : 'New update from municipal desk';
          setLiveToast(msg);
          setTimeout(() => setLiveToast(null), 4000);
        } catch {
          // ignore
        }
      };

      es.addEventListener('status_changed', (e) => handleEventUpdate(e, 'status_changed'));
      es.addEventListener('report_created', (e) => handleEventUpdate(e, 'report_created'));
      es.addEventListener('demo_reset', () => {
        if (role === 'authority') fetchAuthorityData();
        setLiveToast('Demo dataset reset to initial state');
        setTimeout(() => setLiveToast(null), 3000);
      });
      es.addEventListener('duplicate_confirmed', () => {
        if (role === 'authority') fetchAuthorityData();
      });
      es.addEventListener('report_unlinked', () => {
        if (role === 'authority') fetchAuthorityData();
      });
      es.addEventListener('affected_incremented', () => {
        if (role === 'authority') fetchAuthorityData();
      });
      es.addEventListener('citizen_confirmed', () => {
        if (role === 'authority') fetchAuthorityData();
      });
      es.addEventListener('report_reopened', () => {
        if (role === 'authority') fetchAuthorityData();
      });

      es.onerror = () => {
        setIsConnectedSse(false);
        if (!fallbackInterval && role === 'authority') {
          fallbackInterval = setInterval(fetchAuthorityData, 6000);
        }
      };
    } catch {
      setIsConnectedSse(false);
      if (role === 'authority') {
        fallbackInterval = setInterval(fetchAuthorityData, 6000);
      }
    }

    return () => {
      es?.close();
      if (fallbackInterval) clearInterval(fallbackInterval);
    };
  }, [role, fetchAuthorityData]);

  // Auth Handlers
  const handleLoginSuccess = (user: { email: string; role: string }) => {
    setAuth(user);
    setRole('authority');
    setAuthorityViewMode('authority');
    setAuthExpiredMessage(null);
    try {
      localStorage.setItem('voxsetu_authority_active', '1');
    } catch {
      // ignore
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    setAuth(null);
    setRole('none');
    setReports([]);
    setHotspots([]);
    try {
      localStorage.removeItem('voxsetu_authority_active');
    } catch {
      // ignore
    }
  };

  // Citizen Navigation
  const handleContinueAsCitizen = () => {
    setRole('citizen');
    setInitialCitizenTab('report');
  };

  const handleTrackWithoutLogin = () => {
    setRole('citizen');
    setInitialCitizenTab('track');
  };

  // ----------------------------------------------------
  // STATE 1: No Role selected -> Render LoginScreen
  // ----------------------------------------------------
  if (role === 'none') {
    return (
      <LoginScreen
        lang={lang}
        onLangChange={handleLangChange}
        onLoginSuccess={handleLoginSuccess}
        onContinueAsCitizen={handleContinueAsCitizen}
        onTrackWithoutLogin={handleTrackWithoutLogin}
        initialError={authExpiredMessage}
      />
    );
  }

  // ----------------------------------------------------
  // STATE 2 & 3: Citizen or Authority View
  // ----------------------------------------------------
  return (
    <div className="flex min-h-screen flex-col bg-[#F7F5F0] text-[#14213D]">
      {/* Live Accessibility Announcement */}
      <div className="sr-only" aria-live="polite">
        {liveToast}
      </div>

      {/* Floating Live Toast Notification */}
      {liveToast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl border border-emerald-300 bg-white px-4 py-3 text-xs font-semibold text-[#14213D] shadow-lg animate-in fade-in slide-in-from-bottom-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>{liveToast}</span>
        </div>
      )}

      {/* Header */}
      <Header
        role={role}
        authorityViewMode={authorityViewMode}
        onAuthorityViewModeChange={setAuthorityViewMode}
        lang={lang}
        onLangChange={handleLangChange}
        onOpenLimitations={() => setIsLimitationsOpen(true)}
        unreadCount={unreadCount}
        onClearUnread={() => setUnreadCount(0)}
        isConnectedSse={isConnectedSse}
        user={auth}
        onLogout={handleLogout}
        onSwitchRole={() => {
          if (role === 'authority') {
            setRole('citizen');
          } else {
            setRole('none');
          }
        }}
        citizenUser={citizenUser}
        onOpenCitizenAuth={() => setIsCitizenAuthOpen(true)}
        onCitizenLogout={handleCitizenLogout}
      />

      {/* Main View Area */}
      <main className="flex-1 pb-16">
        {role === 'citizen' ? (
          <CitizenView
            lang={lang}
            activeTrackCode={activeTrackCode}
            onSetTrackCode={setActiveTrackCode}
            defaultTab={initialCitizenTab}
          />
        ) : (
          /* Authority is logged in: can view Authority triage or preview Citizen view */
          authorityViewMode === 'authority' ? (
            <AuthorityView
              lang={lang}
              reports={reports}
              hotspots={hotspots}
              onRefreshData={fetchAuthorityData}
            />
          ) : (
            <CitizenView
              lang={lang}
              activeTrackCode={activeTrackCode}
              onSetTrackCode={setActiveTrackCode}
              defaultTab="report"
            />
          )
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-[#E1E4EE] bg-[#FFFFFF] py-6 text-center text-xs text-[#5A6279]">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 sm:flex-row sm:px-6">
          <div className="flex flex-col sm:flex-row items-center gap-2">
            <span className="font-bold text-[#14213D]">VoxSetu</span>
            <span className="hidden sm:inline">•</span>
            <span>{t(lang, 'tagline')}</span>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsLimitationsOpen(true)}
              className="font-medium text-[#1F7A8C] hover:underline cursor-pointer"
            >
              {t(lang, 'limitations')}
            </button>
            <span className="text-[#E1E4EE]">|</span>
            <span className="flex items-center gap-1 text-[11px] text-[#5A6279]">
              <Sparkles className="h-3 w-3 text-[#1F7A8C]" />
              Gemini 3.8 Flash + Deterministic Rules
            </span>
          </div>
        </div>
      </footer>

      {/* Honest Limitations Modal */}
      <LimitationsModal
        isOpen={isLimitationsOpen}
        onClose={() => setIsLimitationsOpen(false)}
        lang={lang}
      />

      {/* Citizen Registration & Login Modal */}
      <CitizenAuthModal
        isOpen={isCitizenAuthOpen}
        onClose={() => setIsCitizenAuthOpen(false)}
        lang={lang}
        onSuccess={(profile) => {
          setCitizenUser(profile);
          setIsCitizenAuthOpen(false);
          setRole('citizen');
        }}
      />
    </div>
  );
}
