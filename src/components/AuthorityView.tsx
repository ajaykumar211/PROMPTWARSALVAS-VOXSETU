import React, { useState, useEffect } from 'react';
import { Report, Hotspot, SupportedLang, PriorityBand, Status, Category, Team } from '../types/index.ts';
import { t, formatDate } from '../utils/i18n.ts';
import { LeafletMap } from './LeafletMap.tsx';
import { isPastTargetDue, PRIORITY_FORMULA_TEXT } from '../utils/priority.ts';
import { HOTSPOT_FORMULA_TEXT } from '../utils/hotspots.ts';
import {
  AlertTriangle,
  Flame,
  CheckCircle2,
  Layers,
  Sparkles,
  RotateCcw,
  RefreshCw,
  Search,
  Filter,
  UserCheck,
  Building2,
  Clock,
  Send,
  Eye,
  Check,
  Unlink,
  Radio,
  TrendingUp,
  TrendingDown,
  Minus,
  X,
} from 'lucide-react';

interface AuthorityViewProps {
  lang: SupportedLang;
  reports: Report[];
  hotspots: Hotspot[];
  onRefreshData: () => void;
}

const PRIORITY_BADGES: Record<PriorityBand, { bg: string; text: string; label: string }> = {
  critical: { bg: 'bg-[#D9480F]/15 border-[#D9480F]', text: 'text-[#D9480F]', label: 'priority_critical' },
  high: { bg: 'bg-[#F59F00]/15 border-[#F59F00]', text: 'text-[#F59F00]', label: 'priority_high' },
  medium: { bg: 'bg-[#3B82F6]/15 border-[#3B82F6]', text: 'text-[#3B82F6]', label: 'priority_medium' },
  low: { bg: 'bg-[#94A3B8]/15 border-[#94A3B8]', text: 'text-[#5A6279]', label: 'priority_low' },
};

export const AuthorityView: React.FC<AuthorityViewProps> = ({
  lang,
  reports,
  hotspots,
  onRefreshData,
}) => {
  // Selected state
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [selectedHotspot, setSelectedHotspot] = useState<Hotspot | null>(null);

  // Filters
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [unassignedOnly, setUnassignedOnly] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Workflow Action Form State
  const [actionStatus, setActionStatus] = useState<Status>('Under review');
  const [actionTeam, setActionTeam] = useState<Team | ''>('');
  const [actionNote, setActionNote] = useState<string>('');
  const [resolutionNote, setResolutionNote] = useState<string>('');
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [statusSuccessMsg, setStatusSuccessMsg] = useState<string | null>(null);

  // Action brief loading
  const [generatingBrief, setGeneratingBrief] = useState(false);
  const [activeBrief, setActiveBrief] = useState<string | null>(null);

  // Reset Demo Data
  const [resettingDemo, setResettingDemo] = useState(false);

  // Pre-select first critical report if none selected
  useEffect(() => {
    if (!selectedReportId && reports.length > 0) {
      const topCritical = reports.find((r) => r.priorityBand === 'critical' && !r.duplicateOf) || reports[0];
      setSelectedReportId(topCritical.id);
    }
  }, [reports, selectedReportId]);

  const selectedReport = reports.find((r) => r.id === selectedReportId) || null;

  // When selected report changes, sync workflow fields
  useEffect(() => {
    if (selectedReport) {
      setActionStatus(selectedReport.status);
      setActionTeam(selectedReport.assignedTeam || '');
      setActionNote('');
      setResolutionNote(selectedReport.resolutionNote || '');
      setStatusSuccessMsg(null);
    }
  }, [selectedReportId]);

  // When selected hotspot changes, check for brief
  useEffect(() => {
    if (selectedHotspot) {
      if (selectedHotspot.brief) {
        setActiveBrief(selectedHotspot.brief);
      } else {
        fetchHotspotBrief(selectedHotspot.id);
      }
    } else {
      setActiveBrief(null);
    }
  }, [selectedHotspot?.id]);

  const fetchHotspotBrief = async (hotspotId: string) => {
    setGeneratingBrief(true);
    try {
      const res = await fetch('/api/hotspots/brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hotspotId }),
      });
      if (res.ok) {
        const json = await res.json();
        setActiveBrief(json.brief);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setGeneratingBrief(false);
    }
  };

  const handleResetDemo = async () => {
    if (!confirm('Reset all reports to standard seed data? This will restore 40 synthetic sample reports.')) {
      return;
    }
    setResettingDemo(true);
    try {
      await fetch('/api/reset-demo', { method: 'POST' });
      onRefreshData();
    } catch (err) {
      console.error(err);
    } finally {
      setResettingDemo(false);
    }
  };

  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReport) return;

    if (actionStatus === 'Resolved' && !resolutionNote.trim()) {
      alert('A resolution note is required when marking a report as Resolved.');
      return;
    }

    setUpdatingStatus(true);
    setStatusSuccessMsg(null);

    try {
      const res = await fetch(`/api/reports/${selectedReport.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: actionStatus,
          assignedTeam: actionTeam || null,
          note: actionNote.trim(),
          resolutionNote: actionStatus === 'Resolved' ? resolutionNote.trim() : undefined,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || 'Failed to update status');
      }

      const json = await res.json();
      setStatusSuccessMsg(`Status updated. Citizen will see: "${json.citizenMessage}"`);
      onRefreshData();
    } catch (err: any) {
      alert(err.message || 'Update failed');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleUnlink = async (reportId: string) => {
    try {
      await fetch(`/api/reports/${reportId}/unlink`, { method: 'POST' });
      onRefreshData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleConfirmDuplicate = async (reportId: string, parentId: string) => {
    try {
      await fetch(`/api/reports/${reportId}/confirm-duplicate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parentId }),
      });
      onRefreshData();
    } catch (err) {
      console.error(err);
    }
  };

  // Metrics calculation
  const openCount = reports.filter((r) => r.status !== 'Resolved' && !r.duplicateOf).length;
  const criticalCount = reports.filter((r) => r.priorityBand === 'critical' && r.status !== 'Resolved' && !r.duplicateOf).length;
  const resolvedCount = reports.filter((r) => r.status === 'Resolved' && !r.duplicateOf).length;
  const hotspotsCount = hotspots.length;

  // Filter queue reports
  const filteredReports = reports.filter((r) => {
    // Hide duplicates from main queue list (they appear inside parent's detail view)
    if (r.duplicateOf) return false;

    if (priorityFilter !== 'all' && r.priorityBand !== priorityFilter) return false;
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    if (categoryFilter !== 'all' && r.category !== categoryFilter) return false;
    if (unassignedOnly && r.assignedTeam) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchText =
        r.trackingCode.toLowerCase().includes(q) ||
        r.summary_en.toLowerCase().includes(q) ||
        r.originalText.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q);
      if (!matchText) return false;
    }
    return true;
  });

  // Linked duplicates belonging to selected report
  const linkedDuplicates = selectedReport
    ? reports.filter((r) => r.duplicateOf === selectedReport.id)
    : [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 space-y-6">
      {/* Top Insights Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
        <div className="rounded-xl border border-[#E1E4EE] bg-[#FFFFFF] p-4 shadow-2xs">
          <div className="flex items-center justify-between text-[#5A6279]">
            <span className="text-xs font-semibold">{t(lang, 'insights_open')}</span>
            <AlertTriangle className="h-4 w-4 text-[#1F7A8C]" />
          </div>
          <div className="mt-2 text-2xl font-black text-[#14213D]">{openCount}</div>
          <span className="text-[10px] text-[#5A6279]">Active civic tasks</span>
        </div>

        <div className="rounded-xl border border-red-200 bg-red-50/50 p-4 shadow-2xs">
          <div className="flex items-center justify-between text-red-800">
            <span className="text-xs font-semibold">{t(lang, 'insights_critical')}</span>
            <Flame className="h-4 w-4 text-[#D9480F]" />
          </div>
          <div className="mt-2 text-2xl font-black text-[#D9480F]">{criticalCount}</div>
          <span className="text-[10px] text-red-700">Immediate action req.</span>
        </div>

        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-2xs">
          <div className="flex items-center justify-between text-emerald-800">
            <span className="text-xs font-semibold">{t(lang, 'insights_resolved')}</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-black text-emerald-900">{resolvedCount}</div>
          <span className="text-[10px] text-emerald-700">Closed in field</span>
        </div>

        <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 shadow-2xs">
          <div className="flex items-center justify-between text-blue-800">
            <span className="text-xs font-semibold">{t(lang, 'insights_hotspots')}</span>
            <Layers className="h-4 w-4 text-[#3B82F6]" />
          </div>
          <div className="mt-2 text-2xl font-black text-[#3B82F6]">{hotspotsCount}</div>
          <span className="text-[10px] text-blue-700">Geographic clusters</span>
        </div>

        {/* Demo Data Reset Button */}
        <div className="col-span-2 sm:col-span-4 lg:col-span-1 flex flex-col justify-between rounded-xl border border-dashed border-[#E1E4EE] bg-[#FFFFFF] p-4 shadow-2xs">
          <span className="text-xs font-semibold text-[#5A6279]">Prototype Sandbox</span>
          <button
            type="button"
            onClick={handleResetDemo}
            disabled={resettingDemo}
            className="mt-2 flex h-9 items-center justify-center gap-1.5 rounded-lg border border-[#E1E4EE] bg-[#F7F5F0] px-3 text-xs font-bold text-[#14213D] hover:bg-amber-50 hover:border-amber-300 disabled:opacity-50"
          >
            <RotateCcw className={`h-3.5 w-3.5 text-amber-700 ${resettingDemo ? 'animate-spin' : ''}`} />
            <span>{resettingDemo ? t(lang, 'resetting') : t(lang, 'reset_demo_btn')}</span>
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#E1E4EE] bg-[#FFFFFF] p-4 shadow-2xs">
        <div className="flex flex-wrap items-center gap-2">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute top-2.5 left-2.5 h-4 w-4 text-[#5A6279]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search code, summary, text..."
              className="h-9 w-48 sm:w-64 rounded-lg border border-[#E1E4EE] bg-[#F7F5F0] pl-8 pr-3 text-xs text-[#14213D] placeholder:text-[#5A6279] focus:bg-white focus:ring-2 focus:ring-[#1F7A8C] focus:outline-hidden"
            />
          </div>

          {/* Priority filter */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="h-9 rounded-lg border border-[#E1E4EE] bg-[#F7F5F0] px-2.5 text-xs font-medium text-[#14213D] focus:bg-white focus:ring-2 focus:ring-[#1F7A8C] focus:outline-hidden"
          >
            <option value="all">{t(lang, 'all_priorities')}</option>
            <option value="critical">Critical (70-100)</option>
            <option value="high">High (50-69)</option>
            <option value="medium">Medium (30-49)</option>
            <option value="low">Low (&lt;30)</option>
          </select>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 rounded-lg border border-[#E1E4EE] bg-[#F7F5F0] px-2.5 text-xs font-medium text-[#14213D] focus:bg-white focus:ring-2 focus:ring-[#1F7A8C] focus:outline-hidden"
          >
            <option value="all">{t(lang, 'all_statuses')}</option>
            <option value="Submitted">Submitted</option>
            <option value="Under review">Under review</option>
            <option value="Assigned">Assigned</option>
            <option value="In progress">In progress</option>
            <option value="Resolved">Resolved</option>
            <option value="Reopened">Reopened</option>
          </select>

          {/* Category filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="h-9 rounded-lg border border-[#E1E4EE] bg-[#F7F5F0] px-2.5 text-xs font-medium text-[#14213D] focus:bg-white focus:ring-2 focus:ring-[#1F7A8C] focus:outline-hidden"
          >
            <option value="all">{t(lang, 'all_categories')}</option>
            <option value="Waterlogging">Waterlogging</option>
            <option value="Road damage">Road damage</option>
            <option value="Garbage">Garbage</option>
            <option value="Streetlight">Streetlight</option>
            <option value="Drainage">Drainage</option>
            <option value="Other">Other</option>
          </select>

          {/* Unassigned Only toggle */}
          <button
            type="button"
            onClick={() => setUnassignedOnly(!unassignedOnly)}
            className={`flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition ${
              unassignedOnly
                ? 'border-[#1F7A8C] bg-[#1F7A8C] text-white'
                : 'border-[#E1E4EE] bg-[#F7F5F0] text-[#5A6279] hover:bg-white'
            }`}
          >
            <UserCheck className="h-3.5 w-3.5" />
            <span>{t(lang, 'unassigned_filter')}</span>
          </button>
        </div>

        <div className="text-xs text-[#5A6279]">
          Showing <span className="font-bold text-[#14213D]">{filteredReports.length}</span> reports
        </div>
      </div>

      {/* 3-Column Authority Dashboard Layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Priority Triage Queue (4 cols) */}
        <div className="lg:col-span-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-[#14213D]">
              {t(lang, 'queue_heading')}
            </h3>
            <span className="rounded bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
              Sorted by Score
            </span>
          </div>

          <div className="space-y-2.5 max-h-[820px] overflow-y-auto pr-1">
            {filteredReports.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#E1E4EE] bg-white p-8 text-center text-xs text-[#5A6279]">
                No reports match current filters.
              </div>
            ) : (
              filteredReports.map((report) => {
                const isSelected = selectedReportId === report.id;
                const badge = PRIORITY_BADGES[report.priorityBand];
                const pastTarget = isPastTargetDue(report.targetDueAt);

                return (
                  <div
                    key={report.id}
                    onClick={() => {
                      setSelectedReportId(report.id);
                      setSelectedHotspot(null);
                    }}
                    className={`cursor-pointer rounded-xl border p-4 transition shadow-2xs ${
                      isSelected
                        ? 'border-[#1F7A8C] bg-white ring-2 ring-[#1F7A8C]/20 shadow-xs'
                        : 'border-[#E1E4EE] bg-[#FFFFFF] hover:border-[#1F7A8C]/50 hover:bg-[#F7F5F0]/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase ${badge.bg} ${badge.text}`}>
                          {t(lang, badge.label)} {report.priorityScore}
                        </span>
                        <span className="rounded bg-[#E1E4EE] px-1.5 py-0.5 text-[10px] font-semibold text-[#14213D]">
                          {report.category}
                        </span>
                      </div>
                      <span className="font-mono text-xs font-bold text-[#14213D]">
                        {report.trackingCode}
                      </span>
                    </div>

                    <p className="mt-2 text-xs font-medium text-[#14213D] line-clamp-2">
                      {report.summary_en}
                    </p>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#E1E4EE]/60 pt-2 text-[10px]">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-[#5A6279]">{report.status}</span>
                        {report.assignedTeam && (
                          <span className="text-[#1F7A8C]">({report.assignedTeam})</span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        {report.linkedCount > 0 && (
                          <span className="rounded bg-blue-100 px-1.5 py-0.2 text-[10px] font-bold text-blue-800">
                            +{report.linkedCount} linked
                          </span>
                        )}
                        {pastTarget && report.status !== 'Resolved' && (
                          <span className="rounded bg-red-100 px-1.5 py-0.2 text-[10px] font-bold text-red-800">
                            {t(lang, 'past_target')}
                          </span>
                        )}
                        {report.isSample && (
                          <span className="text-[#5A6279] italic">
                            {t(lang, 'sample_data')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Center Column: Leaflet Map & Hotspot Overlays (4 cols) */}
        <div className="lg:col-span-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-[#14213D]">
              Geospatial Operations Map
            </h3>
            <span className="text-xs font-semibold text-[#5A6279]">
              {hotspots.length} Hotspots Active
            </span>
          </div>

          {/* Quick Hotspot Chips */}
          {hotspots.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pb-1">
              <span className="text-[10px] font-bold text-[#5A6279] uppercase">Hotspots:</span>
              {hotspots.map((hs, idx) => (
                <button
                  key={hs.id}
                  type="button"
                  onClick={() => setSelectedHotspot(hs)}
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold border transition ${
                    selectedHotspot?.id === hs.id
                      ? 'border-[#1F7A8C] bg-[#1F7A8C] text-white shadow-2xs'
                      : 'border-[#E1E4EE] bg-[#FFFFFF] text-[#14213D] hover:bg-[#F7F5F0]'
                  }`}
                >
                  Cluster #{idx + 1} ({hs.totalReportsCount} reports)
                </button>
              ))}
            </div>
          )}

          <div className="h-[480px] rounded-2xl overflow-hidden border border-[#E1E4EE] shadow-sm">
            <LeafletMap
              mode="authority-dashboard"
              reports={filteredReports}
              hotspots={hotspots}
              selectedReportId={selectedReportId}
              selectedHotspotId={selectedHotspot?.id || null}
              onSelectReport={(rep) => {
                setSelectedReportId(rep.id);
                setSelectedHotspot(null);
              }}
              onSelectHotspot={(hs) => {
                setSelectedHotspot(hs);
              }}
            />
          </div>

          {/* Hotspot details card below map if a hotspot is selected */}
          {selectedHotspot && (
            <div className="rounded-2xl border border-blue-300 bg-blue-50/70 p-5 shadow-sm space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold text-blue-950">
                      {selectedHotspot.id}
                    </span>
                    <span className="rounded bg-blue-200 px-2 py-0.5 text-xs font-bold text-blue-900">
                      Score: {selectedHotspot.score}/100
                    </span>
                    {selectedHotspot.isWide && (
                      <span className="rounded bg-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-900">
                        Wide Area (&gt;700m)
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-blue-900">
                    Radius: {selectedHotspot.radiusMeters}m • {selectedHotspot.totalReportsCount} reports total
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedHotspot(null)}
                  className="rounded-md p-1 text-blue-800 hover:bg-blue-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Trend & Breakdown */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg bg-white p-2 border border-blue-200">
                  <span className="text-[#5A6279]">Trend:</span>
                  <div className="font-bold capitalize flex items-center gap-1 text-[#14213D]">
                    {selectedHotspot.trend === 'rising' && <TrendingUp className="h-4 w-4 text-red-600" />}
                    {selectedHotspot.trend === 'falling' && <TrendingDown className="h-4 w-4 text-emerald-600" />}
                    {selectedHotspot.trend === 'steady' && <Minus className="h-4 w-4 text-blue-600" />}
                    {selectedHotspot.trend} (Last 7d: {selectedHotspot.reportsLast7Days})
                  </div>
                </div>
                <div className="rounded-lg bg-white p-2 border border-blue-200">
                  <span className="text-[#5A6279]">Top Category:</span>
                  <div className="font-bold text-[#14213D]">
                    {Object.entries(selectedHotspot.categoryCounts).sort((a, b) => b[1] - a[1])[0]?.[0]}
                  </div>
                </div>
              </div>

              {/* Gemini Action Brief */}
              <div className="rounded-xl bg-white p-3.5 border border-blue-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs font-bold text-[#1F7A8C]">
                    <Sparkles className="h-3.5 w-3.5" />
                    AI Action Brief
                  </span>
                  <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700">
                    Gemini AI
                  </span>
                </div>
                {generatingBrief ? (
                  <p className="text-xs text-[#5A6279] italic animate-pulse">
                    Generating tactical action brief with Gemini...
                  </p>
                ) : activeBrief ? (
                  <p className="text-xs font-medium text-[#14213D] leading-relaxed">
                    {activeBrief}
                  </p>
                ) : (
                  <button
                    onClick={() => fetchHotspotBrief(selectedHotspot.id)}
                    className="text-xs font-semibold text-[#1F7A8C] hover:underline"
                  >
                    Generate brief
                  </button>
                )}
              </div>

              {/* Formula reference */}
              <div className="text-[10px] text-blue-800">
                <strong>Detection:</strong> rule-based Union-Find • {HOTSPOT_FORMULA_TEXT}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Detail Panel & Workflow Controls (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          {selectedReport ? (
            <div className="rounded-2xl border border-[#E1E4EE] bg-[#FFFFFF] p-6 shadow-sm space-y-5">
              {/* Header */}
              <div className="flex items-start justify-between border-b border-[#E1E4EE] pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-base font-black text-[#14213D]">
                      {selectedReport.trackingCode}
                    </span>
                    <span className="rounded bg-[#E1E4EE] px-2 py-0.5 text-xs font-semibold text-[#14213D]">
                      {selectedReport.category}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-[#5A6279]">
                    Submitted {formatDate(selectedReport.createdAt, lang)}
                  </div>
                </div>

                <div className="text-right">
                  <span className={`inline-block rounded-md border px-2.5 py-1 text-xs font-bold uppercase ${PRIORITY_BADGES[selectedReport.priorityBand].bg} ${PRIORITY_BADGES[selectedReport.priorityBand].text}`}>
                    {selectedReport.priorityBand} ({selectedReport.priorityScore})
                  </span>
                </div>
              </div>

              {/* Original Text & Multilingual Comparison */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-[#5A6279]">
                  <span>{t(lang, 'original_text')} ({selectedReport.originalLanguage.toUpperCase()})</span>
                  <span className="rounded bg-indigo-50 px-1.5 py-0.2 text-[10px] text-indigo-700">
                    Gemini detected
                  </span>
                </div>
                <div className="rounded-xl bg-[#F7F5F0] p-3 text-xs text-[#14213D] leading-relaxed">
                  {selectedReport.originalText}
                </div>

                {selectedReport.originalLanguage !== 'en' && (
                  <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-3 text-xs text-[#14213D] space-y-1">
                    <div className="font-bold text-indigo-900 text-[10px] uppercase">
                      {t(lang, 'english_translation')}
                    </div>
                    <p>{selectedReport.summary_en}</p>
                  </div>
                )}

                {selectedReport.imageDataUrl && (
                  <div>
                    <span className="text-xs font-bold text-[#5A6279]">Attached Evidence:</span>
                    <img
                      src={selectedReport.imageDataUrl}
                      alt="Citizen evidence"
                      className="mt-1 max-h-48 w-full rounded-xl object-cover border border-[#E1E4EE]"
                    />
                  </div>
                )}
              </div>

              {/* "Why this priority?" Factor Bars */}
              <div className="border-t border-[#E1E4EE] pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#14213D]">
                    {t(lang, 'why_this_priority')}
                  </h4>
                  <span className="rounded bg-emerald-50 px-1.5 py-0.2 text-[10px] font-bold text-emerald-800">
                    {t(lang, 'rule_based')} formula
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  {Object.entries(selectedReport.factors).map(([key, val]) => {
                    const factorLabels: Record<string, string> = {
                      safetyRisk: t(lang, 'factor_safety'),
                      peopleAffected: t(lang, 'factor_people'),
                      vulnerableLocation: t(lang, 'factor_location'),
                      recurrence: t(lang, 'factor_recurrence'),
                      durationOrWorsening: t(lang, 'factor_duration'),
                    };
                    const pct = (val.score / 5) * 100;
                    return (
                      <div key={key} className="space-y-1">
                        <div className="flex justify-between font-semibold text-[#14213D]">
                          <span>{factorLabels[key] || key}</span>
                          <span className="font-mono text-[#1F7A8C]">{val.score}/5</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-[#E1E4EE]">
                          <div
                            className={`h-1.5 rounded-full ${
                              val.score >= 4 ? 'bg-[#D9480F]' : val.score >= 3 ? 'bg-[#F59F00]' : 'bg-[#1F7A8C]'
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <p className="text-[10px] text-[#5A6279]">{val.reason}</p>
                      </div>
                    );
                  })}
                </div>

                <div className="text-[10px] text-[#5A6279] rounded bg-[#F7F5F0] p-2">
                  <strong>Formula:</strong> {PRIORITY_FORMULA_TEXT}
                </div>
              </div>

              {/* Linked Duplicates Section */}
              {linkedDuplicates.length > 0 && (
                <div className="border-t border-[#E1E4EE] pt-4 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-[#14213D]">
                    <span className="flex items-center gap-1.5 text-blue-900">
                      <Layers className="h-4 w-4" />
                      Linked Duplicates ({linkedDuplicates.length})
                    </span>
                    <span className="rounded bg-blue-100 px-1.5 py-0.2 text-[10px] font-bold text-blue-800">
                      AI Clustered
                    </span>
                  </div>

                  <div className="space-y-2">
                    {linkedDuplicates.map((dup) => (
                      <div
                        key={dup.id}
                        className="rounded-xl border border-blue-200 bg-blue-50/60 p-3 text-xs space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-[#14213D]">{dup.trackingCode}</span>
                          <span className="text-[10px] text-blue-800">
                            Confidence: {Math.round((dup.duplicateConfidence || 0) * 100)}%
                          </span>
                        </div>
                        <p className="text-[11px] text-[#5A6279]">{dup.originalText}</p>
                        <p className="text-[10px] italic text-blue-900">
                          Reason: {dup.duplicateReason}
                        </p>
                        <div className="flex justify-end gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => handleUnlink(dup.id)}
                            className="flex items-center gap-1 rounded border border-blue-300 bg-white px-2 py-1 text-[10px] font-semibold text-blue-800 hover:bg-blue-50"
                          >
                            <Unlink className="h-3 w-3" />
                            <span>{t(lang, 'unlink')}</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Workflow Controls: Assign Team, Status Update */}
              <form onSubmit={handleUpdateStatus} className="border-t border-[#E1E4EE] pt-4 space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#14213D]">
                  Municipal Action & Triage Workflow
                </h4>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-[#5A6279]">
                      {t(lang, 'assign_team')}
                    </label>
                    <select
                      value={actionTeam}
                      onChange={(e) => setActionTeam(e.target.value as Team)}
                      className="mt-1 h-9 w-full rounded-lg border border-[#E1E4EE] bg-[#F7F5F0] px-2 text-xs font-semibold text-[#14213D] focus:bg-white focus:ring-2 focus:ring-[#1F7A8C] focus:outline-hidden"
                    >
                      <option value="">None (Unassigned)</option>
                      <option value="Roads">{t(lang, 'team_roads')}</option>
                      <option value="Sanitation">{t(lang, 'team_sanitation')}</option>
                      <option value="Drainage">{t(lang, 'team_drainage')}</option>
                      <option value="Electrical">{t(lang, 'team_electrical')}</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[#5A6279]">
                      {t(lang, 'update_status')}
                    </label>
                    <select
                      value={actionStatus}
                      onChange={(e) => setActionStatus(e.target.value as Status)}
                      className="mt-1 h-9 w-full rounded-lg border border-[#E1E4EE] bg-[#F7F5F0] px-2 text-xs font-semibold text-[#14213D] focus:bg-white focus:ring-2 focus:ring-[#1F7A8C] focus:outline-hidden"
                    >
                      <option value="Submitted">Submitted</option>
                      <option value="Under review">Under review</option>
                      <option value="Assigned">Assigned</option>
                      <option value="In progress">In progress</option>
                      <option value="Resolved">Resolved</option>
                      <option value="Reopened">Reopened</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#5A6279]">
                    {t(lang, 'status_note_label')}
                  </label>
                  <textarea
                    rows={2}
                    value={actionNote}
                    onChange={(e) => setActionNote(e.target.value)}
                    placeholder="Officer internal note on actions taken (e.g., crew dispatched with dewatering pump)..."
                    className="mt-1 w-full rounded-lg border border-[#E1E4EE] bg-[#F7F5F0] p-2.5 text-xs text-[#14213D] focus:bg-white focus:ring-2 focus:ring-[#1F7A8C] focus:outline-hidden"
                  />
                </div>

                {/* Live Preview of Citizen Message */}
                <div className="rounded-lg border border-dashed border-[#1F7A8C]/30 bg-[#1F7A8C]/5 p-2.5 text-xs">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-[#1F7A8C]">
                    <span>{t(lang, 'preview_citizen_message')}</span>
                    <span className="text-[10px] text-[#5A6279]">(Gemini rewritten)</span>
                  </div>
                  <p className="mt-1 text-xs text-[#14213D] italic">
                    "{actionNote.trim() ? `Our team has been updated: ${actionNote.trim()}` : `Your report status was updated to ${actionStatus}.`}"
                  </p>
                </div>

                {actionStatus === 'Resolved' && (
                  <div>
                    <label className="block text-[11px] font-bold text-[#D9480F]">
                      {t(lang, 'resolution_note_label')} <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      rows={2}
                      required
                      value={resolutionNote}
                      onChange={(e) => setResolutionNote(e.target.value)}
                      placeholder="Explain physical repair and site inspection confirmation..."
                      className="mt-1 w-full rounded-lg border border-red-200 bg-red-50/50 p-2 text-xs text-[#14213D] focus:ring-2 focus:ring-red-400 focus:outline-hidden"
                    />
                  </div>
                )}

                {statusSuccessMsg && (
                  <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-2 text-xs text-emerald-800">
                    {statusSuccessMsg}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={updatingStatus}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#14213D] text-xs font-bold text-white shadow-xs hover:bg-[#1F7A8C] focus:ring-2 focus:ring-[#1F7A8C] focus:outline-hidden disabled:opacity-50"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>{updatingStatus ? 'Updating & Rewriting Message...' : 'Apply Status & Notify Citizen'}</span>
                </button>
              </form>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-[#E1E4EE] bg-white p-12 text-center text-xs text-[#5A6279]">
              Select a report from the queue or map to inspect details and assign teams.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
