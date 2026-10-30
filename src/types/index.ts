export type Category =
  | 'Waterlogging'
  | 'Road damage'
  | 'Garbage'
  | 'Streetlight'
  | 'Drainage'
  | 'Other';

export type Status =
  | 'Submitted'
  | 'Under review'
  | 'Assigned'
  | 'In progress'
  | 'Resolved'
  | 'Reopened';

export type PriorityBand = 'critical' | 'high' | 'medium' | 'low';

export type Team = 'Roads' | 'Sanitation' | 'Drainage' | 'Electrical';

export interface FactorScore {
  score: number; // 0-5
  reason: string;
}

export interface ReportFactors {
  safetyRisk: FactorScore;
  peopleAffected: FactorScore;
  vulnerableLocation: FactorScore;
  recurrence: FactorScore;
  durationOrWorsening: FactorScore;
}

export interface StatusHistoryEntry {
  status: Status;
  note: string;
  citizenMessage: string;
  by: string;
  timestamp: string;
}

export interface Report {
  id: string;
  trackingCode: string;
  citizenId: string;
  originalText: string;
  originalLanguage: string;
  summary_en: string;
  summary_user: string;
  category: Category;
  lat: number;
  lon: number;
  imageDataUrl?: string;
  factors: ReportFactors;
  priorityScore: number; // 0-100
  priorityBand: PriorityBand;
  status: Status;
  assignedTeam: Team | null;
  duplicateOf: string | null;
  duplicateConfidence: number | null;
  duplicateReason: string | null;
  linkedCount: number;
  affectedCount: number;
  targetDueAt: string;
  statusHistory: StatusHistoryEntry[];
  resolutionNote: string | null;
  citizenConfirmed: boolean;
  reopenCount: number;
  suspectedSpam: boolean;
  isSample: boolean;
  isFallbackAi?: boolean;
  userId?: string;
  createdAt: string;
}

export interface CitizenProfile {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
  citizenTrackingId: string;
}

export interface CitizenAccount {
  citizenId: string;
  token: string;
  createdAt: string;
}

export interface Hotspot {
  id: string;
  center: { lat: number; lon: number };
  radiusMeters: number;
  reports: Report[];
  reportIds: string[];
  totalReportsCount: number; // including linked duplicates
  categoryCounts: Record<string, number>;
  highestPriorityScore: number;
  highestPriorityBand: PriorityBand;
  reportsLast7Days: number;
  reportsPrior7Days: number;
  shareLast7Days: number;
  trend: 'rising' | 'steady' | 'falling';
  score: number; // 0-100
  isWide: boolean; // radius > 350m (diameter > 700m)
  brief?: string;
  briefCachedAt?: string;
}

export type SupportedLang = 'en' | 'hi' | 'kn' | 'te';
