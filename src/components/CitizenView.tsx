import React, { useState, useEffect } from 'react';
import { SupportedLang, Category } from '../types/index.ts';
import { t } from '../utils/i18n.ts';
import { LeafletMap } from './LeafletMap.tsx';
import { TrackPage } from './TrackPage.tsx';
import { resizeImageToMax1024 } from '../utils/image.ts';
import { getOrCreateCitizenAccount } from '../utils/citizenAccount.ts';
import {
  startWebSpeechRecognition,
  WebSpeechSession,
  getSpeechLangCode,
  isSpeechRecognitionSupported,
  requestMicrophonePermission,
  queryMicrophonePermission,
  getCurrentSiteOrigin,
  isAppSecureContext,
  isRunningInIframe,
} from '../utils/speech.ts';
import { LANGS } from '../utils/i18n.ts';
import {
  Sparkles,
  MapPin,
  Camera,
  Mic,
  MicOff,
  Copy,
  Check,
  AlertTriangle,
  AlertCircle,
  Loader2,
  ArrowRight,
  ThumbsUp,
  Layers,
  Info,
  Shield,
  ShieldCheck,
  Lock,
  RefreshCw,
  ExternalLink,
  X,
} from 'lucide-react';
import { PRIORITY_FORMULA_TEXT } from '../utils/priority.ts';

interface CitizenViewProps {
  lang: SupportedLang;
  activeTrackCode?: string;
  onSetTrackCode?: (code: string) => void;
  defaultTab?: 'report' | 'track';
}

const CATEGORIES: Category[] = [
  'Waterlogging',
  'Road damage',
  'Garbage',
  'Streetlight',
  'Drainage',
  'Other',
];

export const CitizenView: React.FC<CitizenViewProps> = ({
  lang,
  activeTrackCode = '',
  onSetTrackCode,
  defaultTab = 'report',
}) => {
  const [activeTab, setActiveTab] = useState<'report' | 'track'>(
    defaultTab || (activeTrackCode ? 'track' : 'report')
  );

  // Form states
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<Category | ''>('');
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lon: number }>({
    lat: 12.9141,
    lon: 74.8560,
  });
  const [isLocating, setIsLocating] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechSession, setSpeechSession] = useState<WebSpeechSession | null>(null);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [isRetryingPermission, setIsRetryingPermission] = useState(false);
  const [permissionLiveGranted, setPermissionLiveGranted] = useState(false);

  // Photo AI Analysis States
  const [isAnalyzingPhoto, setIsAnalyzingPhoto] = useState(false);
  const [photoAnalysisError, setPhotoAnalysisError] = useState<string | null>(null);
  const [photoUnclearWarning, setPhotoUnclearWarning] = useState<string | null>(null);
  const [photoSuggestion, setPhotoSuggestion] = useState<{ description: string; category?: Category } | null>(null);
  const [suggestedAutoApplied, setSuggestedAutoApplied] = useState(false);

  const siteOrigin = typeof window !== 'undefined' ? getCurrentSiteOrigin() : '';
  const isSecure = typeof window !== 'undefined' ? isAppSecureContext() : true;
  const inIframe = typeof window !== 'undefined' ? isRunningInIframe() : false;

  // Nearby similar reports
  const [nearbySimilar, setNearbySimilar] = useState<any[]>([]);
  const [loadingSimilar, setLoadingSimilar] = useState(false);

  // Citizen Permanent Account Identity
  const [citizenAccount] = useState(() => getOrCreateCitizenAccount());
  const [loggedInCitizen, setLoggedInCitizen] = useState<{ id: string; email: string; fullName: string; citizenTrackingId: string } | null>(null);
  const [copiedCitizenId, setCopiedCitizenId] = useState(false);

  useEffect(() => {
    fetch('/api/auth/citizen/me')
      .then((r) => r.json())
      .then((data) => {
        if (data.authenticated && data.user) {
          setLoggedInCitizen(data.user);
        }
      })
      .catch(() => {});
  }, []);

  // Active tracking ID (user account tracking ID or anonymous local storage ID)
  const activeCitizenTrackingId = loggedInCitizen?.citizenTrackingId || citizenAccount.citizenId;

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submissionResult, setSubmissionResult] = useState<any | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  // Cleanup speech session on unmount
  useEffect(() => {
    return () => {
      speechSession?.abort();
    };
  }, [speechSession]);

  // Monitor live permission changes if supported (e.g. user toggles Allow in browser bar)
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.permissions?.query) return;
    let permStatus: PermissionStatus | null = null;
    navigator.permissions
      .query({ name: 'microphone' as PermissionName })
      .then((status) => {
        permStatus = status;
        const handlePermChange = () => {
          if (status.state === 'granted') {
            setPermissionLiveGranted(true);
            setSpeechError(null);
          } else if (status.state === 'denied') {
            setPermissionLiveGranted(false);
          }
        };
        status.onchange = handlePermChange;
      })
      .catch(() => {
        // Permissions query not supported for microphone on this browser
      });

    return () => {
      if (permStatus) permStatus.onchange = null;
    };
  }, []);

  // Fetch similar nearby reports whenever coords change
  useEffect(() => {
    let cancelled = false;
    const fetchSimilar = async () => {
      setLoadingSimilar(true);
      try {
        const catQuery = category ? `&category=${encodeURIComponent(category)}` : '';
        const res = await fetch(`/api/similar?lat=${coords.lat}&lon=${coords.lon}${catQuery}`);
        if (res.ok && !cancelled) {
          const json = await res.json();
          setNearbySimilar(json);
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoadingSimilar(false);
      }
    };

    fetchSimilar();
    return () => {
      cancelled = true;
    };
  }, [coords.lat, coords.lon, category]);

  // Internal helper to start recognition session (strictly on user click)
  const startSpeechSession = (baseText: string) => {
    const session = startWebSpeechRecognition({
      lang,
      baseText,
      onTranscript: (updatedText) => {
        setDescription(updatedText);
      },
      onError: (friendlyMsg, code) => {
        if (code === 'not-allowed' || code === 'service-not-allowed') {
          setPermissionDenied(true);
          setSpeechError(
            'Microphone access is blocked for this site. Please enable microphone permissions in your browser address bar to use voice input.'
          );
        } else {
          setSpeechError(friendlyMsg);
        }
        setIsListening(false);
        setSpeechSession(null);
      },
      onListeningChange: (listening) => {
        setIsListening(listening);
        if (!listening) {
          setSpeechSession(null);
        }
      },
    });

    if (session) {
      setSpeechSession(session);
    }
  };

  // Web Speech API: Starts only after the user clicks the microphone button
  const toggleSpeech = () => {
    // If currently listening, stop the active recognition session
    if (isListening && speechSession) {
      speechSession.stop();
      setSpeechSession(null);
      setIsListening(false);
      return;
    }

    setSpeechError(null);
    setPermissionDenied(false);

    // Save existing user text as baseText so nothing previously typed is overwritten or deleted
    startSpeechSession(description);
  };

  // Retry voice input after enabling permission in browser
  const handleRetryVoiceInput = async () => {
    setIsRetryingPermission(true);
    setSpeechError(null);

    try {
      const permResult = await requestMicrophonePermission();
      if (permResult.granted) {
        setPermissionDenied(false);
        setPermissionLiveGranted(false);
        setSpeechError(null);
        // Start listening immediately
        startSpeechSession(description);
      } else {
        setPermissionDenied(true);
        setSpeechError(
          `Microphone permission is not yet allowed for ${siteOrigin || 'this site'}. Please change the permission to "Allow" in your address bar and tap Retry.`
        );
      }
    } catch {
      setPermissionDenied(true);
    } finally {
      setIsRetryingPermission(false);
    }
  };

  // Image Upload and Server-side Gemini AI Analysis
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const inputElement = e.target;

    // Clear previous photo analysis states
    setPhotoAnalysisError(null);
    setPhotoUnclearWarning(null);
    setPhotoSuggestion(null);
    setSuggestedAutoApplied(false);

    // 1. File type validation
    const validExtensions = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'heif', 'bmp', 'tiff'];
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const isValidFormat = (file.type && file.type.startsWith('image/')) || validExtensions.includes(ext);

    if (!isValidFormat) {
      inputElement.value = '';
      setPhotoAnalysisError(t(lang, 'invalid_file_type') || 'Unsupported file format. Please upload a JPEG, PNG, WebP, GIF, or HEIC image.');
      return;
    }

    // 2. Oversized file validation (10MB limit)
    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      inputElement.value = '';
      setPhotoAnalysisError(t(lang, 'file_too_large') || 'Selected photo is too large (maximum 10MB). Please select a smaller photo.');
      return;
    }

    // 3. Process & Resize Image
    let resized: string;
    try {
      resized = await resizeImageToMax1024(file);
      setImageDataUrl(resized);
    } catch (err) {
      console.error('Image processing failed:', err);
      setPhotoAnalysisError('Could not process selected photo. Please choose another image file.');
      return;
    }

    // 4. Send to server-side Gemini API endpoint
    setIsAnalyzingPhoto(true);
    try {
      const res = await fetch('/api/analyze-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageDataUrl: resized, lang }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        setPhotoAnalysisError(errJson.error || t(lang, 'photo_analysis_error') || 'Could not analyze photo automatically. You can still type your description manually.');
        return;
      }

      const result = await res.json();

      if (result.isUnclear) {
        setPhotoUnclearWarning(
          result.unclearReason || 'The photo appears dark or blurry to identify a clear civic issue. Please upload a clearer photo if possible.'
        );
      } else {
        const suggestedText = (result.description_user || result.description_en || '').trim();
        const suggestedCategory = result.category as Category;

        if (suggestedText) {
          setPhotoSuggestion({
            description: suggestedText,
            category: suggestedCategory,
          });

          // Check if description text box is empty or already has citizen text
          if (!description.trim()) {
            // Case A: Text box is empty -> Write suggested description automatically!
            setDescription(suggestedText);
            setSuggestedAutoApplied(true);
            if (suggestedCategory && (!category || category === 'Other')) {
              setCategory(suggestedCategory);
            }
          } else {
            // Case B: Citizen ALREADY typed text -> Preserve it! Offer suggestion box below text area.
            if (suggestedCategory && (!category || category === 'Other')) {
              setCategory(suggestedCategory);
            }
          }
        }
      }
    } catch (err) {
      console.warn('Photo analysis error:', err);
      setPhotoAnalysisError(t(lang, 'photo_analysis_error') || 'Could not analyze photo automatically. You can still type your description manually.');
    } finally {
      setIsAnalyzingPhoto(false);
    }
  };

  const handleRemovePhoto = () => {
    setImageDataUrl(null);
    setPhotoAnalysisError(null);
    setPhotoUnclearWarning(null);
    setPhotoSuggestion(null);
    setSuggestedAutoApplied(false);
  };

  const handleAppendPhotoSuggestion = () => {
    if (!photoSuggestion) return;
    setDescription((prev) => {
      const clean = prev.trim();
      if (!clean) return photoSuggestion.description;
      return `${clean}\n\nPhoto detail: ${photoSuggestion.description}`;
    });
    setPhotoSuggestion(null);
    setSuggestedAutoApplied(false);
  };

  const handleReplacePhotoSuggestion = () => {
    if (!photoSuggestion) return;
    setDescription(photoSuggestion.description);
    setPhotoSuggestion(null);
    setSuggestedAutoApplied(true);
  };

  const handleDismissPhotoSuggestion = () => {
    setPhotoSuggestion(null);
    setSuggestedAutoApplied(false);
  };

  // Geolocation
  const handleUseLocation = () => {
    if (!navigator.geolocation) return;
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        setIsLocating(false);
      },
      (err) => {
        console.warn('Location error:', err);
        setIsLocating(false);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  // Handle support on existing nearby report
  const handleSupportNearby = async (code: string) => {
    try {
      const res = await fetch(`/api/track/${code}/affected`, { method: 'POST' });
      if (res.ok) {
        if (onSetTrackCode) onSetTrackCode(code);
        setActiveTab('track');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Form Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      setSubmitError('Please describe the issue before submitting.');
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Citizen-Token': citizenAccount.token,
        },
        body: JSON.stringify({
          text: description.trim(),
          imageDataUrl,
          category: category || undefined,
          lat: coords.lat,
          lon: coords.lon,
          lang,
          citizenId: citizenAccount.citizenId,
          token: citizenAccount.token,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || 'Failed to submit report');
      }

      const json = await res.json();
      setSubmissionResult(json);
      if (onSetTrackCode) onSetTrackCode(json.trackingCode);

      // Save to citizen local reports list
      try {
        const stored = JSON.parse(localStorage.getItem('voxsetu_my_reports') || '[]');
        if (!stored.includes(json.trackingCode)) {
          stored.unshift(json.trackingCode);
          localStorage.setItem('voxsetu_my_reports', JSON.stringify(stored.slice(0, 15)));
        }
      } catch {
        // ignore
      }
    } catch (err: any) {
      setSubmitError(err.message || 'An error occurred while submitting.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      {/* Sub-Tabs: Report vs Track */}
      <div className="mb-6 flex rounded-xl border border-[#E1E4EE] bg-[#FFFFFF] p-1.5 shadow-xs">
        <button
          onClick={() => setActiveTab('report')}
          className={`flex-1 rounded-lg py-2.5 text-center text-sm font-bold transition ${
            activeTab === 'report'
              ? 'bg-[#14213D] text-white shadow-xs'
              : 'text-[#5A6279] hover:text-[#14213D]'
          }`}
        >
          {t(lang, 'report_issue')}
        </button>
        <button
          onClick={() => setActiveTab('track')}
          className={`flex-1 rounded-lg py-2.5 text-center text-sm font-bold transition ${
            activeTab === 'track'
              ? 'bg-[#14213D] text-white shadow-xs'
              : 'text-[#5A6279] hover:text-[#14213D]'
          }`}
        >
          {t(lang, 'track_issue')}
        </button>
      </div>

      {activeTab === 'track' ? (
        <TrackPage
          initialCode={activeTrackCode || citizenAccount.citizenId}
          lang={lang}
          onCodeChange={onSetTrackCode}
        />
      ) : submissionResult ? (
        /* Post-Submission Result Card */
        <div className="overflow-hidden rounded-2xl border border-emerald-200 bg-[#FFFFFF] p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex items-center gap-3 border-b border-[#E1E4EE] pb-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800">
              <Check className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#14213D]">
                {t(lang, 'report_submitted')}
              </h2>
              <p className="text-xs text-[#5A6279]">
                AI triage verified and cataloged your civic report.
              </p>
            </div>
          </div>

          {/* Tracking Code Banner */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-xl border border-[#E1E4EE] bg-[#F7F5F0] p-4">
            <div>
              <span className="text-xs font-semibold text-[#5A6279]">
                {t(lang, 'tracking_code')} (save this to track updates):
              </span>
              <div className="font-mono text-2xl font-black text-[#14213D]">
                {submissionResult.trackingCode}
              </div>
            </div>
            <button
              onClick={() => handleCopyCode(submissionResult.trackingCode)}
              className="flex h-11 items-center gap-2 rounded-xl bg-[#FFFFFF] px-4 text-xs font-bold text-[#14213D] border border-[#E1E4EE] shadow-2xs hover:bg-[#F7F5F0]"
            >
              {copiedCode ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
              <span>{copiedCode ? t(lang, 'code_copied') : t(lang, 'copy_code')}</span>
            </button>
          </div>

          {/* Duplicate Linkage notice if applicable */}
          {submissionResult.report.duplicateOf && (
            <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50/70 p-4 text-xs text-blue-900">
              <Layers className="h-5 w-5 shrink-0 text-blue-700" />
              <div>
                <strong className="font-bold">Merged with Nearby Report:</strong>{' '}
                {submissionResult.report.duplicateReason || t(lang, 'duplicate_linked_notice')}
              </div>
            </div>
          )}

          {/* AI Result Card */}
          <div className="rounded-xl border border-[#E1E4EE] bg-[#FFFFFF] p-5 space-y-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-bold text-[#1F7A8C]">
                <Sparkles className="h-4 w-4" />
                {t(lang, 'ai_analysis_title')}
              </span>
              <span className="rounded bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
                {submissionResult.report.isFallbackAi ? t(lang, 'rule_based') : t(lang, 'gemini_ai')}
              </span>
            </div>

            <div>
              <div className="text-xs text-[#5A6279]">Detected Category:</div>
              <div className="text-sm font-bold text-[#14213D]">
                {submissionResult.report.category}
              </div>
            </div>

            <div>
              <div className="text-xs text-[#5A6279]">Summary:</div>
              <p className="text-sm font-medium text-[#14213D]">
                {submissionResult.report.summary_user || submissionResult.report.summary_en}
              </p>
            </div>

            {/* Why This Priority Breakdown */}
            <div className="border-t border-[#E1E4EE] pt-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#5A6279] mb-3">
                {t(lang, 'why_this_priority')} (Score: {submissionResult.report.priorityScore}/100 - {submissionResult.report.priorityBand.toUpperCase()})
              </h4>
              <div className="space-y-2 text-xs">
                {Object.entries(submissionResult.report.factors || {}).map(([key, val]: [string, any]) => {
                  const factorLabels: Record<string, string> = {
                    safetyRisk: t(lang, 'factor_safety'),
                    peopleAffected: t(lang, 'factor_people'),
                    vulnerableLocation: t(lang, 'factor_location'),
                    recurrence: t(lang, 'factor_recurrence'),
                    durationOrWorsening: t(lang, 'factor_duration'),
                  };
                  return (
                    <div key={key} className="rounded-lg bg-[#F7F5F0] p-2.5">
                      <div className="flex justify-between font-semibold text-[#14213D]">
                        <span>{factorLabels[key] || key}</span>
                        <span className="font-mono text-[#1F7A8C]">{val.score}/5</span>
                      </div>
                      <p className="text-[11px] text-[#5A6279] mt-0.5">{val.reason}</p>
                    </div>
                  );
                })}
              </div>

              <div className="mt-3 rounded-lg border border-dashed border-[#E1E4EE] bg-[#F7F5F0]/60 p-2 text-[10px] text-[#5A6279]">
                <strong className="text-[#14213D]">{t(lang, 'priority_formula')} ({t(lang, 'rule_based')}):</strong> {PRIORITY_FORMULA_TEXT}
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                if (onSetTrackCode) onSetTrackCode(submissionResult.trackingCode);
                setActiveTab('track');
              }}
              className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-[#1F7A8C] px-6 text-sm font-bold text-white shadow-xs hover:bg-[#196372]"
            >
              <span>Go to Live Tracker</span>
              <ArrowRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                setSubmissionResult(null);
                setDescription('');
                setImageDataUrl(null);
              }}
              className="flex h-12 items-center justify-center rounded-xl border border-[#E1E4EE] bg-white px-6 text-sm font-semibold text-[#5A6279] hover:bg-[#F7F5F0]"
            >
              Report Another Issue
            </button>
          </div>
        </div>
      ) : (
        /* Report Form */
        <div className="space-y-6">
          {/* Permanent Citizen Tracking ID Banner */}
          <div className="rounded-2xl border border-[#3B82F6]/30 bg-gradient-to-r from-blue-50 to-indigo-50/50 p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#3B82F6]">
                <ShieldCheck className="h-4 w-4" />
                <span>
                  {loggedInCitizen ? `Citizen Account: ${loggedInCitizen.fullName}` : 'Citizen Permanent Identity'}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-xs font-medium text-[#5A6279]">Your Permanent Tracking ID:</span>
                <span className="font-mono text-lg font-black text-[#14213D]">{activeCitizenTrackingId}</span>
              </div>
              <p className="mt-0.5 text-xs text-[#5A6279]">
                {loggedInCitizen
                  ? `Signed in as ${loggedInCitizen.email}. All reports you submit are linked to your secure account.`
                  : 'All civic reports you submit are automatically attached to this ID. Sign in to sync across devices.'}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(activeCitizenTrackingId);
                  setCopiedCitizenId(true);
                  setTimeout(() => setCopiedCitizenId(false), 2000);
                }}
                className="flex h-9 items-center gap-1.5 rounded-xl border border-[#3B82F6]/30 bg-white px-3 text-xs font-bold text-[#3B82F6] hover:bg-blue-50 transition shadow-2xs"
              >
                {copiedCitizenId ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copiedCitizenId ? 'Copied ID' : 'Copy ID'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onSetTrackCode) onSetTrackCode(activeCitizenTrackingId);
                  setActiveTab('track');
                }}
                className="flex h-9 items-center gap-1.5 rounded-xl bg-[#14213D] px-3.5 text-xs font-bold text-white hover:bg-[#1E293B] transition shadow-2xs"
              >
                <span>View My Reports</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
          <div className="rounded-2xl border border-[#E1E4EE] bg-[#FFFFFF] p-6 sm:p-8 shadow-sm space-y-5">
            {/* Description first */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="issue-description" className="text-sm font-bold text-[#14213D]">
                  {t(lang, 'description_label')} <span className="text-[#D9480F]">*</span>
                </label>

                {/* Voice speech recognition button */}
                <button
                  type="button"
                  onClick={toggleSpeech}
                  aria-pressed={isListening}
                  className={`flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-bold transition shadow-2xs focus:ring-2 focus:ring-[#1F7A8C] focus:outline-hidden cursor-pointer ${
                    isListening
                      ? 'bg-red-600 text-white animate-pulse ring-2 ring-red-400 ring-offset-1'
                      : 'border border-[#1F7A8C]/30 bg-teal-50/70 text-[#1F7A8C] hover:bg-[#1F7A8C] hover:text-white'
                  }`}
                  title={isListening ? 'Stop listening' : `Voice input in ${LANGS[lang]?.nativeName || 'current language'} (${getSpeechLangCode(lang)})`}
                >
                  {isListening ? (
                    <>
                      <MicOff className="h-4 w-4 animate-bounce" />
                      <span>Listening... (Tap to stop)</span>
                    </>
                  ) : (
                    <>
                      <Mic className="h-4 w-4" />
                      <span>{t(lang, 'speak_input')}</span>
                    </>
                  )}
                </button>
              </div>

              <div className="relative">
                <textarea
                  id="issue-description"
                  required
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t(lang, 'description_placeholder')}
                  className={`w-full rounded-xl border p-3.5 text-sm text-[#14213D] transition placeholder:text-[#5A6279]/60 focus:bg-white focus:outline-hidden ${
                    isListening
                      ? 'border-red-400 bg-red-50/20 ring-2 ring-red-300'
                      : 'border-[#E1E4EE] bg-[#F7F5F0] focus:border-[#1F7A8C] focus:ring-2 focus:ring-[#1F7A8C]'
                  }`}
                />
              </div>

              {/* AI Auto-applied note (when text box was empty and photo draft was auto-inserted) */}
              {suggestedAutoApplied && description.trim() && (
                <div className="mt-2 flex items-center justify-between rounded-xl bg-teal-50 border border-teal-200/80 px-3 py-2 text-xs text-[#1F7A8C] font-semibold animate-in fade-in">
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-[#1F7A8C]" />
                    Drafted from photo analysis. You can edit or replace freely before submitting.
                  </span>
                  <button
                    type="button"
                    onClick={() => setSuggestedAutoApplied(false)}
                    className="rounded p-0.5 text-slate-500 hover:bg-teal-100 cursor-pointer"
                    aria-label="Dismiss note"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              {/* AI Suggestion Card (when photo yielded a suggestion and user already had typed description) */}
              {photoSuggestion && !suggestedAutoApplied && (
                <div className="mt-2.5 rounded-2xl border border-[#1F7A8C]/30 bg-teal-50/90 p-3.5 text-xs text-[#14213D] space-y-2.5 shadow-2xs animate-in fade-in">
                  <div className="flex items-center justify-between font-bold text-[#1F7A8C]">
                    <span className="flex items-center gap-1.5">
                      <Sparkles className="h-4 w-4 text-[#1F7A8C]" />
                      {t(lang, 'photo_suggestion_title') || 'AI Photo Analysis Suggestion'}
                    </span>
                    <button
                      type="button"
                      onClick={handleDismissPhotoSuggestion}
                      className="rounded p-1 text-slate-500 hover:bg-teal-100 hover:text-slate-800 cursor-pointer"
                      aria-label="Dismiss suggestion"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <p className="italic bg-white/90 p-2.5 rounded-xl border border-teal-200/60 leading-relaxed text-[#14213D]">
                    "{photoSuggestion.description}"
                  </p>

                  <div className="flex flex-wrap items-center gap-2 pt-0.5">
                    <button
                      type="button"
                      onClick={handleAppendPhotoSuggestion}
                      className="flex h-8 items-center gap-1 rounded-lg bg-[#1F7A8C] px-3 font-bold text-white hover:bg-[#186270] transition cursor-pointer"
                    >
                      {t(lang, 'append_suggestion') || 'Append to Description'}
                    </button>
                    <button
                      type="button"
                      onClick={handleReplacePhotoSuggestion}
                      className="flex h-8 items-center gap-1 rounded-lg border border-[#1F7A8C] bg-white px-3 font-bold text-[#1F7A8C] hover:bg-teal-50 transition cursor-pointer"
                    >
                      {t(lang, 'replace_suggestion') || 'Replace Description'}
                    </button>
                    <button
                      type="button"
                      onClick={handleDismissPhotoSuggestion}
                      className="text-xs text-slate-600 hover:underline ml-auto cursor-pointer"
                    >
                      {t(lang, 'dismiss_suggestion') || 'Dismiss'}
                    </button>
                  </div>
                </div>
              )}

              {/* Active listening banner */}
              {isListening && (
                <div className="mt-1.5 flex items-center justify-between rounded-lg border border-red-200 bg-red-50/90 px-3 py-1.5 text-xs text-red-800 animate-in fade-in">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-600" />
                    </span>
                    <span className="font-semibold">
                      Listening in {LANGS[lang]?.nativeName} ({getSpeechLangCode(lang)})... Speak now.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={toggleSpeech}
                    className="font-bold underline text-red-700 hover:text-red-900 cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              )}

              {/* Dedicated Microphone Permission Guide for not-allowed / service-not-allowed */}
              {permissionDenied && (
                <div
                  role="alert"
                  className="mt-2.5 rounded-2xl border border-amber-300 bg-amber-50/95 p-4 text-xs text-[#14213D] shadow-sm animate-in fade-in space-y-3"
                >
                  <div className="flex items-start justify-between gap-2 border-b border-amber-200/80 pb-2.5">
                    <div className="flex items-center gap-2 font-bold text-amber-900 text-sm">
                      <Lock className="h-4 w-4 text-amber-700 shrink-0" />
                      <span>Microphone Access Blocked for This Site</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setPermissionDenied(false);
                        setSpeechError(null);
                      }}
                      className="rounded p-1 text-amber-800 hover:bg-amber-100 cursor-pointer"
                      aria-label="Dismiss permission guide"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Domain & HTTPS status confirmation */}
                  <div className="flex flex-wrap items-center gap-2 text-[11px]">
                    <span className="font-semibold text-slate-700">Domain:</span>
                    <code className="rounded bg-white/80 px-2 py-0.5 font-mono text-amber-950 border border-amber-200">
                      {siteOrigin || 'Current Site'}
                    </code>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 font-semibold text-emerald-800">
                      <ShieldCheck className="h-3 w-3" />
                      {isSecure ? 'Served over HTTPS (Secure Context)' : 'Insecure Context (HTTPS Required)'}
                    </span>
                  </div>

                  {/* Permission instructions */}
                  <div className="rounded-xl bg-white/90 p-3 border border-amber-200/70 space-y-1.5 text-slate-700">
                    <p className="font-bold text-amber-950">
                      How to enable microphone for voice input on this domain:
                    </p>
                    <ol className="list-decimal pl-4 space-y-1 text-xs">
                      <li>
                        Look at your browser's address bar at the top (next to the website URL).
                      </li>
                      <li>
                        Click the <strong>Lock / View site information</strong> icon 🔒 or the <strong>Microphone</strong> icon with a red strike-through 🎤.
                      </li>
                      <li>
                        Switch <strong>Microphone</strong> from <em>Block</em> to <strong>Allow</strong>.
                      </li>
                      {inIframe && (
                        <li className="text-amber-800 font-medium">
                          In the AI Studio preview, also ensure your browser allows microphone permissions for <code>aistudio.google.com</code>.
                        </li>
                      )}
                    </ol>
                  </div>

                  {/* Live granted notification */}
                  {permissionLiveGranted && (
                    <div className="flex items-center gap-2 rounded-xl bg-emerald-100/90 border border-emerald-300 p-2.5 text-xs font-bold text-emerald-900 animate-in fade-in">
                      <Check className="h-4 w-4 text-emerald-700 shrink-0" />
                      <span>Permission granted! Tap "Retry Voice Input" to start speaking.</span>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex flex-wrap items-center gap-2.5 pt-1">
                    <button
                      type="button"
                      onClick={handleRetryVoiceInput}
                      disabled={isRetryingPermission}
                      className="flex h-9 items-center gap-1.5 rounded-xl bg-[#1F7A8C] px-4 text-xs font-bold text-white shadow-xs hover:bg-[#186270] transition disabled:opacity-50 cursor-pointer"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${isRetryingPermission ? 'animate-spin' : ''}`} />
                      <span>{isRetryingPermission ? 'Checking permission...' : 'Retry Voice Input'}</span>
                    </button>

                    {inIframe && typeof window !== 'undefined' && (
                      <a
                        href={window.location.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex h-9 items-center gap-1.5 rounded-xl border border-[#E1E4EE] bg-white px-3 text-xs font-semibold text-[#14213D] hover:bg-[#F7F5F0] transition"
                        title="Open this application in a dedicated standalone tab"
                      >
                        <ExternalLink className="h-3.5 w-3.5 text-[#1F7A8C]" />
                        <span>Open in Direct Tab</span>
                      </a>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setPermissionDenied(false);
                        setSpeechError(null);
                      }}
                      className="text-xs text-slate-600 hover:text-slate-900 underline ml-auto cursor-pointer"
                    >
                      Dismiss & Type Manually
                    </button>
                  </div>
                </div>
              )}

              {/* Standard Speech Error Banner (for no-speech, network, audio-capture) */}
              {!permissionDenied && speechError && (
                <div
                  role="alert"
                  className="mt-1.5 flex items-start justify-between gap-2 rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-900 animate-in fade-in"
                >
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                    <span>{speechError}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={toggleSpeech}
                      className="font-bold underline text-amber-900 hover:text-amber-950 cursor-pointer text-[11px]"
                    >
                      Try Again
                    </button>
                    <button
                      type="button"
                      onClick={() => setSpeechError(null)}
                      className="rounded p-0.5 text-amber-700 hover:bg-amber-100 cursor-pointer"
                      aria-label="Dismiss error"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Optional Photo */}
            <div>
              <label className="block text-sm font-bold text-[#14213D]">
                {t(lang, 'photo_optional')}
              </label>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <label className="flex h-11 items-center gap-2 rounded-xl border border-[#E1E4EE] bg-[#F7F5F0] px-4 text-xs font-semibold text-[#14213D] cursor-pointer hover:bg-[#FFFFFF] focus-within:ring-2 focus-within:ring-[#1F7A8C] transition">
                  <Camera className="h-4 w-4 text-[#1F7A8C]" />
                  <span>{imageDataUrl ? t(lang, 'photo_attached') : 'Choose Photo or Take Picture'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                </label>

                {isAnalyzingPhoto && (
                  <div className="flex items-center gap-2 rounded-xl bg-teal-50 px-3 py-2 text-xs font-semibold text-[#1F7A8C] border border-teal-200/80 animate-in fade-in">
                    <Loader2 className="h-4 w-4 animate-spin shrink-0 text-[#1F7A8C]" />
                    <span>Analyzing photo with AI...</span>
                  </div>
                )}

                {imageDataUrl && (
                  <div className="flex items-center gap-2">
                    <img
                      src={imageDataUrl}
                      alt="Preview"
                      className="h-11 w-11 rounded-lg object-cover border border-[#E1E4EE]"
                    />
                    <button
                      type="button"
                      onClick={handleRemovePhoto}
                      className="text-xs font-bold text-[#D9480F] hover:underline cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>

              {/* Photo Analysis Loading State */}
              {isAnalyzingPhoto && (
                <div className="mt-2 flex items-center gap-2 rounded-xl border border-teal-200 bg-teal-50/80 p-2.5 text-xs text-[#1F7A8C] font-medium animate-in fade-in">
                  <Sparkles className="h-4 w-4 animate-spin shrink-0 text-[#1F7A8C]" />
                  <span>AI analyzing photo and drafting problem description...</span>
                </div>
              )}

              {/* Unclear / Blurry Photo Warning */}
              {photoUnclearWarning && (
                <div
                  role="alert"
                  className="mt-2.5 flex items-start justify-between gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 animate-in fade-in"
                >
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                    <div>
                      <strong className="font-bold">{t(lang, 'unclear_photo_title') || 'Unclear Photo Detected'}:</strong>{' '}
                      {photoUnclearWarning}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPhotoUnclearWarning(null)}
                    className="rounded p-0.5 text-amber-800 hover:bg-amber-100 cursor-pointer"
                    aria-label="Dismiss warning"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              {/* Photo Error Banner (unsupported format, >10MB, analysis error) */}
              {photoAnalysisError && (
                <div
                  role="alert"
                  className="mt-2.5 flex items-start justify-between gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800 animate-in fade-in"
                >
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
                    <span>{photoAnalysisError}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPhotoAnalysisError(null)}
                    className="rounded p-0.5 text-red-800 hover:bg-red-100 cursor-pointer"
                    aria-label="Dismiss error"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* Optional Category */}
            <div>
              <label className="block text-sm font-bold text-[#14213D]">
                {t(lang, 'category_label')}
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as Category)}
                className="mt-2 h-11 w-full rounded-xl border border-[#E1E4EE] bg-[#F7F5F0] px-3 text-sm font-medium text-[#14213D] focus:border-[#1F7A8C] focus:bg-[#FFFFFF] focus:ring-2 focus:ring-[#1F7A8C] focus:outline-hidden cursor-pointer"
              >
                <option value="">Auto-detect via Gemini AI</option>
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Location with Leaflet map + GPS */}
            <div>
              <div className="flex items-center justify-between">
                <label className="text-sm font-bold text-[#14213D]">
                  {t(lang, 'location_label')}
                </label>
                <button
                  type="button"
                  onClick={handleUseLocation}
                  disabled={isLocating}
                  className="flex items-center gap-1.5 rounded-lg border border-[#E1E4EE] bg-[#F7F5F0] px-3 py-1.5 text-xs font-semibold text-[#1F7A8C] hover:bg-teal-50 focus:ring-2 focus:ring-[#1F7A8C] focus:outline-hidden disabled:opacity-50"
                >
                  <MapPin className="h-3.5 w-3.5" />
                  <span>{isLocating ? t(lang, 'locating') : t(lang, 'use_my_location')}</span>
                </button>
              </div>

              <p className="mt-1 text-xs text-[#5A6279]">
                {t(lang, 'tap_to_place_pin')} ({coords.lat.toFixed(4)}, {coords.lon.toFixed(4)})
              </p>

              <div className="mt-2 h-64 rounded-xl overflow-hidden border border-[#E1E4EE]">
                <LeafletMap
                  mode="citizen-picker"
                  center={[coords.lat, coords.lon]}
                  selectedCoord={coords}
                  onCoordSelect={(lat, lon) => setCoords({ lat, lon })}
                />
              </div>
            </div>

            {/* Similar reports nearby prompt */}
            {nearbySimilar.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 space-y-3">
                <div className="flex items-start gap-2">
                  <Info className="h-4 w-4 text-amber-700 mt-0.5 shrink-0" />
                  <div>
                    <h4 className="text-xs font-bold text-amber-900">
                      {t(lang, 'similar_reports_nearby')} ({nearbySimilar.length})
                    </h4>
                    <p className="text-[11px] text-amber-800">
                      {t(lang, 'similar_reports_hint')}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  {nearbySimilar.map((item) => (
                    <div
                      key={item.id}
                      className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 rounded-lg bg-white p-3 border border-amber-200 shadow-2xs text-xs"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-[#14213D]">{item.trackingCode}</span>
                          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                            {item.category}
                          </span>
                          <span className="text-[10px] text-[#5A6279]">{item.distanceMeters}m away</span>
                        </div>
                        <p className="mt-1 text-[11px] text-[#5A6279] line-clamp-1">
                          {item.summary_user || item.summary_en}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleSupportNearby(item.trackingCode)}
                        className="flex h-8 items-center gap-1.5 rounded-lg bg-amber-600 px-3 text-[11px] font-semibold text-white hover:bg-amber-700 whitespace-nowrap"
                      >
                        <ThumbsUp className="h-3.5 w-3.5" />
                        <span>{t(lang, 'affected_too')} ({item.affectedCount || 0})</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {submitError && (
              <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{submitError}</span>
              </div>
            )}

            {/* Submit button */}
            <button
              type="submit"
              disabled={submitting}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#14213D] text-sm font-bold text-white shadow-xs hover:bg-[#1F7A8C] focus:ring-2 focus:ring-[#1F7A8C] focus:outline-hidden disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Sparkles className="h-4 w-4 animate-spin" />
                  <span>{t(lang, 'submitting')}</span>
                </>
              ) : (
                <span>{t(lang, 'submit_report')}</span>
              )}
            </button>
          </div>
        </form>
        </div>
      )}
    </div>
  );
};
