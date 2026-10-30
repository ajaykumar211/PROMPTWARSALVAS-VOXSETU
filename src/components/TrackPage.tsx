import React, { useState, useEffect } from 'react';
import { SupportedLang, Status } from '../types/index.ts';
import { t, formatDate } from '../utils/i18n.ts';
import {
  Search,
  CheckCircle2,
  Clock,
  Radio,
  Share2,
  ThumbsUp,
  AlertCircle,
  Camera,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Sparkles,
  Layers,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { resizeImageToMax1024 } from '../utils/image.ts';
import { getOrCreateCitizenAccount } from '../utils/citizenAccount.ts';

interface TrackPageProps {
  initialCode?: string;
  lang: SupportedLang;
  onCodeChange?: (code: string) => void;
}

const STATUS_STEPS: Status[] = [
  'Submitted',
  'Under review',
  'Assigned',
  'In progress',
  'Resolved',
];

const PRIORITY_BADGES: Record<string, { bg: string; text: string; label: string }> = {
  critical: { bg: 'bg-[#D9480F]/10 border-[#D9480F]', text: 'text-[#D9480F]', label: 'priority_critical' },
  high: { bg: 'bg-[#F59F00]/10 border-[#F59F00]', text: 'text-[#F59F00]', label: 'priority_high' },
  medium: { bg: 'bg-[#3B82F6]/10 border-[#3B82F6]', text: 'text-[#3B82F6]', label: 'priority_medium' },
  low: { bg: 'bg-[#94A3B8]/10 border-[#94A3B8]', text: 'text-[#5A6279]', label: 'priority_low' },
};

export const TrackPage: React.FC<TrackPageProps> = ({
  initialCode = '',
  lang,
  onCodeChange,
}) => {
  const [citizenAccount] = useState(() => getOrCreateCitizenAccount());
  const [trackingCode, setTrackingCode] = useState(initialCode || citizenAccount.citizenId);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAllHistory, setShowAllHistory] = useState<Record<string, boolean>>({});

  // Actions state per report
  const [affectedCounts, setAffectedCounts] = useState<Record<string, number>>({});
  const [votedAffected, setVotedAffected] = useState<Record<string, boolean>>({});
  const [activeAddInfoId, setActiveAddInfoId] = useState<string | null>(null);
  const [infoText, setInfoText] = useState('');
  const [infoPhoto, setInfoPhoto] = useState<string | null>(null);
  const [submittingInfo, setSubmittingInfo] = useState(false);

  // Reopen modal/inline per report
  const [activeReopenId, setActiveReopenId] = useState<string | null>(null);
  const [reopenReason, setReopenReason] = useState('');
  const [submittingReopen, setSubmittingReopen] = useState(false);

  // Translations cache for notes
  const [translatedNotes, setTranslatedNotes] = useState<Record<string, string>>({});

  const fetchTrackData = async (codeToFetch: string) => {
    if (!codeToFetch.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/track/${encodeURIComponent(codeToFetch.trim())}`, {
        headers: {
          'X-Citizen-Token': citizenAccount.token,
        },
      });
      if (!res.ok) {
        if (res.status === 403) {
          setError("🔒 Access Restricted: You can only view reports associated with your own citizen account identity.");
        } else if (res.status === 404) {
          setError(t(lang, 'report_not_found'));
        } else {
          setError('Failed to fetch tracking data. Please try again.');
        }
        setData(null);
        return;
      }
      const json = await res.json();
      setData(json);

      // Initialize affected counts for reports
      const counts: Record<string, number> = {};
      const reportList = json.reports || [json];
      reportList.forEach((r: any) => {
        counts[r.id || r.trackingCode] = r.affectedCount || 0;
      });
      setAffectedCounts(counts);

      // Trigger background translation for citizen messages if not English
      if (lang !== 'en' && json.reports) {
        json.reports.forEach((rep: any) => {
          if (rep.statusHistory) {
            rep.statusHistory.forEach((h: any) => {
              if (h.citizenMessage && !translatedNotes[h.citizenMessage]) {
                fetch('/api/translate', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ text: h.citizenMessage, lang }),
                })
                  .then((r) => r.json())
                  .then((tr) => {
                    if (tr.translatedText) {
                      setTranslatedNotes((prev) => ({
                        ...prev,
                        [h.citizenMessage]: tr.translatedText,
                      }));
                    }
                  })
                  .catch(() => {});
              }
            });
          }
        });
      }
    } catch {
      setError('Network connection error. Retrying...');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const codeToLoad = initialCode || citizenAccount.citizenId;
    if (codeToLoad) {
      setTrackingCode(codeToLoad);
      fetchTrackData(codeToLoad);
    }
  }, [initialCode, citizenAccount.citizenId]);

  // Polling fallback every 5 seconds for live status
  useEffect(() => {
    if (!data?.trackingCode) return;
    const interval = setInterval(() => {
      fetchTrackData(data.trackingCode);
    }, 5000);
    return () => clearInterval(interval);
  }, [data?.trackingCode]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (onCodeChange) onCodeChange(trackingCode);
    fetchTrackData(trackingCode);
  };

  const handleVoteAffected = async (targetCode: string) => {
    if (votedAffected[targetCode] || !targetCode) return;
    try {
      const res = await fetch(`/api/track/${targetCode}/affected`, {
        method: 'POST',
      });
      if (res.ok) {
        const resJson = await res.json();
        setAffectedCounts((prev) => ({ ...prev, [targetCode]: resJson.affectedCount }));
        setVotedAffected((prev) => ({ ...prev, [targetCode]: true }));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleConfirmFixed = async (targetCode: string) => {
    if (!targetCode) return;
    try {
      const res = await fetch(`/api/track/${targetCode}/confirm`, {
        method: 'POST',
      });
      if (res.ok) {
        fetchTrackData(trackingCode);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleReopenSubmit = async (e: React.FormEvent, targetCode: string) => {
    e.preventDefault();
    if (!targetCode) return;
    setSubmittingReopen(true);
    try {
      const res = await fetch(`/api/track/${targetCode}/reopen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reopenReason }),
      });
      if (res.ok) {
        setActiveReopenId(null);
        setReopenReason('');
        fetchTrackData(trackingCode);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmittingReopen(false);
    }
  };

  const handleAddInfoSubmit = async (e: React.FormEvent, targetCode: string) => {
    e.preventDefault();
    if (!targetCode || (!infoText.trim() && !infoPhoto)) return;
    setSubmittingInfo(true);
    try {
      const res = await fetch(`/api/track/${targetCode}/info`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: infoText.trim(), imageDataUrl: infoPhoto }),
      });
      if (res.ok) {
        setInfoText('');
        setInfoPhoto(null);
        setActiveAddInfoId(null);
        fetchTrackData(trackingCode);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmittingInfo(false);
    }
  };

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const resized = await resizeImageToMax1024(file);
        setInfoPhoto(resized);
      } catch (err) {
        console.error('Photo resize error:', err);
      }
    }
  };

  // Remaining time calculation
  const getRemainingTimeText = (targetIso: string) => {
    const diff = new Date(targetIso).getTime() - Date.now();
    if (diff <= 0) return t(lang, 'past_target');
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${mins}m left`;
  };


  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Search Header */}
      <div className="rounded-2xl border border-[#E1E4EE] bg-[#FFFFFF] p-6 shadow-sm">
        <h2 className="text-xl font-bold text-[#14213D]">
          {t(lang, 'track_issue')}
        </h2>
        <p className="mt-1 text-xs text-[#5A6279]">
          Enter your unique VoxSetu tracking code to check real-time triage and field resolution progress.
        </p>

        <form onSubmit={handleSearch} className="mt-4 flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute top-3.5 left-3.5 h-4 w-4 text-[#5A6279]" />
            <input
              type="text"
              value={trackingCode}
              onChange={(e) => setTrackingCode(e.target.value.toUpperCase())}
              placeholder={t(lang, 'track_input_placeholder')}
              className="h-11 w-full rounded-xl border border-[#E1E4EE] bg-[#F7F5F0] pl-10 pr-4 text-sm font-semibold tracking-wider text-[#14213D] uppercase placeholder:normal-case placeholder:font-normal placeholder:tracking-normal focus:border-[#1F7A8C] focus:bg-[#FFFFFF] focus:ring-2 focus:ring-[#1F7A8C] focus:outline-hidden"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="flex h-11 items-center justify-center rounded-xl bg-[#14213D] px-6 text-sm font-semibold text-white shadow-xs hover:bg-[#1F7A8C] focus:ring-2 focus:ring-[#1F7A8C] focus:outline-hidden disabled:opacity-50"
          >
            {loading ? 'Searching...' : t(lang, 'track_search_btn')}
          </button>
        </form>

        {/* Citizen's Saved Reports */}
        {(() => {
          try {
            const list: string[] = JSON.parse(localStorage.getItem('voxsetu_my_reports') || '[]');
            if (list.length === 0) return null;
            return (
              <div className="mt-4 pt-3 border-t border-[#E1E4EE]">
                <p className="text-[11px] font-bold text-[#5A6279] uppercase tracking-wider mb-2">
                  My recent reports:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {list.map((code) => (
                    <button
                      key={code}
                      type="button"
                      onClick={() => {
                        setTrackingCode(code);
                        if (onCodeChange) onCodeChange(code);
                        fetchTrackData(code);
                      }}
                      className="inline-flex items-center rounded-lg border border-[#E1E4EE] bg-[#F7F5F0] px-2.5 py-1 text-xs font-mono font-bold text-[#14213D] hover:border-[#1F7A8C] hover:bg-[#1F7A8C]/5 transition cursor-pointer"
                    >
                      {code}
                    </button>
                  ))}
                </div>
              </div>
            );
          } catch {
            return null;
          }
        })()}

        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Main Track Card Section */}
      {data && (
        <div className="space-y-6">
          {/* Citizen Account Identity Header */}
          <div className="rounded-2xl border border-[#3B82F6]/30 bg-gradient-to-r from-blue-50/80 to-indigo-50/50 p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#3B82F6]">
                <ShieldCheck className="h-4 w-4" />
                <span>Citizen Account Portfolio</span>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-xs font-medium text-[#5A6279]">Tracking ID:</span>
                <span className="font-mono text-xl font-black text-[#14213D]">{data.citizenId || data.trackingCode}</span>
                <span className="ml-2 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-extrabold text-blue-800">
                  {data.reports ? data.reports.length : 1} Report{((data.reports ? data.reports.length : 1) > 1) ? 's' : ''} Submitted
                </span>
              </div>
              <p className="mt-0.5 text-xs text-[#5A6279]">
                All reports submitted under this citizen account identity are listed below with independent live statuses.
              </p>
            </div>
          </div>

          {/* List of Reports under Citizen Account */}
          {(data.reports || [data]).map((rep: any, index: number) => {
            const reportKey = rep.id || rep.trackingCode || `rep-${index}`;
            const badgeStyle = PRIORITY_BADGES[rep.priorityBand] || PRIORITY_BADGES['low'];
            const historyList = rep.statusHistory || [];
            const showAllHist = showAllHistory[reportKey] || false;
            const visibleHistory = showAllHist ? historyList : historyList.slice(-3);
            const reportAffectedCount = affectedCounts[reportKey] ?? rep.affectedCount ?? 0;
            const reportVoted = votedAffected[reportKey] || false;
            const isAddInfoOpen = activeAddInfoId === reportKey;
            const isReopenOpen = activeReopenId === reportKey;

            return (
              <div key={reportKey} className="overflow-hidden rounded-2xl border border-[#E1E4EE] bg-[#FFFFFF] shadow-sm">
                {/* Top Bar with Live Indicator & Badges */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E1E4EE] bg-[#F7F5F0]/60 px-6 py-4">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-xs font-bold text-[#5A6279] uppercase">
                      Report #{index + 1}
                    </span>
                    <span className="font-mono text-sm font-bold text-[#14213D]">
                      {rep.trackingCode}
                    </span>
                    <div className="flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                      <span className="h-2 w-2 rounded-full bg-emerald-600 animate-ping" />
                      <span>{t(lang, 'live_badge')}</span>
                    </div>
                  </div>

                  {/* Priority Badge */}
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-xs font-bold uppercase ${badgeStyle.bg} ${badgeStyle.text}`}>
                      {t(lang, badgeStyle.label)} ({rep.priorityScore}/100)
                    </span>
                    <span className="rounded-lg bg-[#E1E4EE] px-2.5 py-1 text-xs font-semibold text-[#14213D]">
                      {rep.category}
                    </span>
                  </div>
                </div>

                <div className="p-6 space-y-6">
                  {/* Duplicate Merged Notice */}
                  {rep.isMergedDuplicate && (
                    <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50/70 p-4 text-xs text-blue-900">
                      <Layers className="h-5 w-5 shrink-0 text-blue-700" />
                      <div>
                        <strong className="font-bold">Merged Duplicate Tracker:</strong>{' '}
                        {t(lang, 'duplicate_linked_notice')} Your complaint is active and following primary report{' '}
                        <span className="font-mono font-bold">{rep.parentTrackingCode}</span>.
                      </div>
                    </div>
                  )}

                  {/* Summary */}
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#5A6279]">Issue Summary</h3>
                    <p className="mt-1 text-base font-medium text-[#14213D]">
                      {lang === 'en' ? rep.summary_en : rep.summary_user || rep.summary_en}
                    </p>
                    {rep.assignedTeam && (
                      <p className="mt-2 text-xs font-semibold text-[#1F7A8C]">
                        Assigned Unit: <span className="underline">{rep.assignedTeam} Division</span>
                      </p>
                    )}
                  </div>

                  {/* Target Due Countdown Strip */}
                  {rep.targetDueAt && rep.status !== 'Resolved' && (
                    <div className="flex items-center justify-between rounded-xl border border-dashed border-[#E1E4EE] bg-[#F7F5F0] p-3 text-xs">
                      <div className="flex items-center gap-2 text-[#5A6279]">
                        <Clock className="h-4 w-4 text-[#1F7A8C]" />
                        <span>
                          {t(lang, 'target_resolution_countdown')}{' '}
                          <span className="text-[10px] italic">({t(lang, 'sample_targets_label')})</span>:
                        </span>
                      </div>
                      <div className="font-bold text-[#14213D]">
                        {getRemainingTimeText(rep.targetDueAt)} (by {formatDate(rep.targetDueAt, lang)})
                      </div>
                    </div>
                  )}

                  {/* Stepper Timeline */}
                  <div className="border-t border-[#E1E4EE] pt-6">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#5A6279]">
                      Resolution Lifecycle
                    </h4>
                    <div className="mt-4 flex items-center justify-between">
                      {STATUS_STEPS.map((step, idx) => {
                        const currentIdx = STATUS_STEPS.indexOf(rep.status);
                        const isCompleted = currentIdx >= idx;
                        const isCurrent = rep.status === step;

                        return (
                          <div key={step} className="flex flex-1 flex-col items-center text-center relative">
                            {idx !== 0 && (
                              <div
                                className={`absolute top-4 -left-1/2 w-full h-1 -z-0 ${
                                  isCompleted ? 'bg-[#1F7A8C]' : 'bg-[#E1E4EE]'
                                }`}
                              />
                            )}
                            <div
                              className={`z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 transition ${
                                isCompleted
                                  ? 'border-[#1F7A8C] bg-[#1F7A8C] text-white shadow-xs'
                                  : 'border-[#E1E4EE] bg-[#FFFFFF] text-[#94A3B8]'
                              } ${isCurrent ? 'ring-4 ring-[#1F7A8C]/20' : ''}`}
                            >
                              {isCompleted ? <CheckCircle2 className="h-4 w-4" /> : idx + 1}
                            </div>
                            <span
                              className={`mt-2 text-[11px] font-semibold ${
                                isCurrent
                                  ? 'text-[#1F7A8C]'
                                  : isCompleted
                                  ? 'text-[#14213D]'
                                  : 'text-[#94A3B8]'
                              }`}
                            >
                              {step}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Feed of Plain Language Citizen Updates */}
                  <div className="border-t border-[#E1E4EE] pt-6 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-[#5A6279]">
                        Officer & AI Feed Updates
                      </h4>
                      {historyList.length > 3 && (
                        <button
                          onClick={() => setShowAllHistory((prev) => ({ ...prev, [reportKey]: !showAllHist }))}
                          className="flex items-center gap-1 text-xs font-semibold text-[#1F7A8C] hover:underline"
                        >
                          {showAllHist ? (
                            <>
                              Show recent 3 <ChevronUp className="h-3.5 w-3.5" />
                            </>
                          ) : (
                            <>
                              View all {historyList.length} updates <ChevronDown className="h-3.5 w-3.5" />
                            </>
                          )}
                        </button>
                      )}
                    </div>

                    <div className="space-y-3">
                      {visibleHistory.map((item: any, i: number) => {
                        const messageText =
                          lang !== 'en' && translatedNotes[item.citizenMessage]
                            ? translatedNotes[item.citizenMessage]
                            : item.citizenMessage || item.note;
                        const isTranslated =
                          lang !== 'en' && Boolean(translatedNotes[item.citizenMessage]);

                        return (
                          <div
                            key={i}
                            className="rounded-xl border border-[#E1E4EE] bg-[#F7F5F0]/60 p-4 text-xs transition"
                          >
                            <div className="flex items-center justify-between gap-2 text-[#5A6279]">
                              <span className="font-bold text-[#14213D]">{item.by || 'VoxSetu System'}</span>
                              <span>{formatDate(item.timestamp, lang)}</span>
                            </div>
                            <p className="mt-2 text-sm font-medium text-[#14213D]">
                              {messageText}
                            </p>
                            {isTranslated && (
                              <span className="mt-1 inline-block text-[10px] text-[#5A6279] italic">
                                ({t(lang, 'machine_translated')})
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Citizen Action Bar */}
                  <div className="border-t border-[#E1E4EE] pt-6 flex flex-wrap items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => handleVoteAffected(rep.trackingCode || rep.id)}
                      disabled={reportVoted}
                      className={`flex h-11 items-center gap-2 rounded-xl border px-4 text-xs font-semibold transition ${
                        reportVoted
                          ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                          : 'border-[#E1E4EE] bg-[#FFFFFF] text-[#14213D] hover:bg-[#F7F5F0]'
                      }`}
                    >
                      <ThumbsUp className="h-4 w-4" />
                      <span>
                        {reportVoted ? 'Supported' : t(lang, 'affected_too')} ({reportAffectedCount})
                      </span>
                    </button>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setActiveAddInfoId(isAddInfoOpen ? null : reportKey)}
                        className="flex h-11 items-center gap-2 rounded-xl border border-[#E1E4EE] bg-[#FFFFFF] px-4 text-xs font-semibold text-[#14213D] hover:bg-[#F7F5F0]"
                      >
                        <Camera className="h-4 w-4 text-[#1F7A8C]" />
                        <span>{t(lang, 'add_more_info')}</span>
                      </button>

                      {rep.status === 'Resolved' && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleConfirmFixed(rep.trackingCode || rep.id)}
                            disabled={rep.citizenConfirmed}
                            className={`flex h-11 items-center gap-2 rounded-xl px-4 text-xs font-semibold text-white shadow-xs ${
                              rep.citizenConfirmed
                                ? 'bg-emerald-600 opacity-90'
                                : 'bg-emerald-700 hover:bg-emerald-800'
                            }`}
                          >
                            <ShieldCheck className="h-4 w-4" />
                            <span>
                              {rep.citizenConfirmed ? 'Confirmed Fixed' : t(lang, 'confirm_fixed')}
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setActiveReopenId(isReopenOpen ? null : reportKey)}
                            className="flex h-11 items-center gap-2 rounded-xl border border-[#D9480F] bg-white px-4 text-xs font-semibold text-[#D9480F] hover:bg-red-50"
                          >
                            <RotateCcw className="h-4 w-4" />
                            <span>{t(lang, 'reopen_issue')}</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Add Info Inline Form */}
                  {isAddInfoOpen && (
                    <form
                      onSubmit={(e) => handleAddInfoSubmit(e, rep.trackingCode || rep.id)}
                      className="rounded-xl border border-[#1F7A8C]/30 bg-[#1F7A8C]/5 p-4 space-y-3"
                    >
                      <h4 className="text-xs font-bold text-[#14213D]">
                        Provide Additional Details or Progress Photos
                      </h4>
                      <textarea
                        rows={2}
                        value={infoText}
                        onChange={(e) => setInfoText(e.target.value)}
                        placeholder="E.g. Workers arrived on site / water level increased..."
                        className="w-full rounded-lg border border-[#E1E4EE] bg-white p-2.5 text-xs text-[#14213D] focus:ring-2 focus:ring-[#1F7A8C] focus:outline-hidden"
                      />
                      <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2 text-xs font-medium text-[#5A6279] cursor-pointer">
                          <Camera className="h-4 w-4" />
                          <span>{infoPhoto ? t(lang, 'photo_attached') : t(lang, 'photo_optional')}</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handlePhotoSelect}
                            className="hidden"
                          />
                        </label>
                        <button
                          type="submit"
                          disabled={submittingInfo || (!infoText.trim() && !infoPhoto)}
                          className="rounded-lg bg-[#14213D] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1F7A8C] disabled:opacity-50"
                        >
                          {submittingInfo ? 'Submitting...' : t(lang, 'send_info_btn')}
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Reopen Inline Form */}
                  {isReopenOpen && (
                    <form
                      onSubmit={(e) => handleReopenSubmit(e, rep.trackingCode || rep.id)}
                      className="rounded-xl border border-red-300 bg-red-50 p-4 space-y-3"
                    >
                      <h4 className="text-xs font-bold text-red-900">
                        Reason for Reopening this Issue
                      </h4>
                      <textarea
                        rows={2}
                        required
                        value={reopenReason}
                        onChange={(e) => setReopenReason(e.target.value)}
                        placeholder="Why was the resolution incomplete? E.g., puddle reformed after rain, pothole asphalt cracked..."
                        className="w-full rounded-lg border border-red-200 bg-white p-2.5 text-xs text-[#14213D] focus:ring-2 focus:ring-red-500 focus:outline-hidden"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setActiveReopenId(null)}
                          className="rounded-lg border border-[#E1E4EE] bg-white px-3 py-1.5 text-xs font-medium text-[#5A6279]"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={submittingReopen || !reopenReason.trim()}
                          className="rounded-lg bg-[#D9480F] px-4 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                        >
                          {submittingReopen ? 'Reopening...' : 'Confirm Reopen'}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
