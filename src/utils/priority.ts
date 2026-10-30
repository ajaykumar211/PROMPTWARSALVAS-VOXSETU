import { PriorityBand, ReportFactors } from '../types/index.ts';

export const PRIORITY_WEIGHTS = {
  safetyRisk: 3.0,
  peopleAffected: 2.0,
  vulnerableLocation: 2.0,
  recurrence: 1.5,
  durationOrWorsening: 1.0,
  maxDenominator: 47.5, // (3*5 + 2*5 + 2*5 + 1.5*5 + 1*5) = 15 + 10 + 10 + 7.5 + 5 = 47.5
};

export const PRIORITY_FORMULA_TEXT =
  'Score = [(3 × Safety) + (2 × People) + (2 × Vulnerability) + (1.5 × Recurrence) + (1 × Duration)] ÷ 47.5 × 100';

export function calculatePriorityScore(
  factors: ReportFactors,
  linkedDuplicatesCount: number = 0
): { score: number; effectiveRecurrence: number } {
  const safety = Math.min(5, Math.max(0, factors.safetyRisk.score));
  const people = Math.min(5, Math.max(0, factors.peopleAffected.score));
  const location = Math.min(5, Math.max(0, factors.vulnerableLocation.score));
  
  // Recurrence is raised in code by linked duplicates (up to 5)
  const effectiveRecurrence = Math.min(
    5,
    Math.max(0, factors.recurrence.score + Math.min(3, linkedDuplicatesCount))
  );
  const duration = Math.min(5, Math.max(0, factors.durationOrWorsening.score));

  const weightedSum =
    safety * PRIORITY_WEIGHTS.safetyRisk +
    people * PRIORITY_WEIGHTS.peopleAffected +
    location * PRIORITY_WEIGHTS.vulnerableLocation +
    effectiveRecurrence * PRIORITY_WEIGHTS.recurrence +
    duration * PRIORITY_WEIGHTS.durationOrWorsening;

  const rawScore = (weightedSum / PRIORITY_WEIGHTS.maxDenominator) * 100;
  const score = Math.round(Math.min(100, Math.max(0, rawScore)));

  return { score, effectiveRecurrence };
}

export function determinePriorityBand(
  score: number,
  safetyRiskScore: number
): PriorityBand {
  let band: PriorityBand = 'low';
  if (score >= 70) {
    band = 'critical';
  } else if (score >= 50) {
    band = 'high';
  } else if (score >= 30) {
    band = 'medium';
  } else {
    band = 'low';
  }

  // If safetyRisk is 4 or 5, the band is at least high
  if (safetyRiskScore >= 4 && (band === 'low' || band === 'medium')) {
    band = 'high';
  }

  return band;
}

export function getTargetDueHours(band: PriorityBand): number {
  switch (band) {
    case 'critical':
      return 4;
    case 'high':
      return 24;
    case 'medium':
      return 72;
    case 'low':
      return 168; // 7 days
  }
}

export function computeTargetDueDate(
  createdAtIso: string,
  band: PriorityBand
): string {
  const date = new Date(createdAtIso);
  const hours = getTargetDueHours(band);
  date.setTime(date.getTime() + hours * 60 * 60 * 1000);
  return date.toISOString();
}

export function isPastTargetDue(targetDueAtIso: string): boolean {
  return new Date().getTime() > new Date(targetDueAtIso).getTime();
}
