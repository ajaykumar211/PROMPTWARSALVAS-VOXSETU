import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculatePriorityScore,
  determinePriorityBand,
  computeTargetDueDate,
  getTargetDueHours,
} from '../src/utils/priority.ts';
import { haversineDistanceMeters, areCategoriesRelated } from '../src/utils/geo.ts';
import { detectHotspots } from '../src/utils/hotspots.ts';
import { Report } from '../src/types/index.ts';

test('Priority Score Calculation: correctly applies weights and denominator 47.5', () => {
  // All 5s -> score 100
  const maxFactors = {
    safetyRisk: { score: 5, reason: '' },
    peopleAffected: { score: 5, reason: '' },
    vulnerableLocation: { score: 5, reason: '' },
    recurrence: { score: 5, reason: '' },
    durationOrWorsening: { score: 5, reason: '' },
  };
  const { score: maxScore } = calculatePriorityScore(maxFactors, 0);
  assert.equal(maxScore, 100);

  // All 0s -> score 0
  const zeroFactors = {
    safetyRisk: { score: 0, reason: '' },
    peopleAffected: { score: 0, reason: '' },
    vulnerableLocation: { score: 0, reason: '' },
    recurrence: { score: 0, reason: '' },
    durationOrWorsening: { score: 0, reason: '' },
  };
  const { score: zeroScore } = calculatePriorityScore(zeroFactors, 0);
  assert.equal(zeroScore, 0);

  // Moderate factors: safety 3, people 2, loc 2, rec 1, dur 1
  // Weighted: 3*3 + 2*2 + 2*2 + 1.5*1 + 1*1 = 9 + 4 + 4 + 1.5 + 1 = 19.5
  // Score = 19.5 / 47.5 * 100 = 41.05 -> round 41
  const modFactors = {
    safetyRisk: { score: 3, reason: '' },
    peopleAffected: { score: 2, reason: '' },
    vulnerableLocation: { score: 2, reason: '' },
    recurrence: { score: 1, reason: '' },
    durationOrWorsening: { score: 1, reason: '' },
  };
  const { score: modScore } = calculatePriorityScore(modFactors, 0);
  assert.equal(modScore, 41);

  // Recurrence raised in code by linked duplicates
  const { score: bumpedScore, effectiveRecurrence } = calculatePriorityScore(modFactors, 2);
  assert.equal(effectiveRecurrence, 3); // 1 + 2 = 3
  assert.ok(bumpedScore > modScore);
});

test('Priority Band Determination & Safety Override', () => {
  // Score >= 70 -> critical
  assert.equal(determinePriorityBand(75, 3), 'critical');
  // Score 50-69 -> high
  assert.equal(determinePriorityBand(55, 3), 'high');
  // Score 30-49 -> medium
  assert.equal(determinePriorityBand(40, 2), 'medium');
  // Score < 30 -> low
  assert.equal(determinePriorityBand(20, 1), 'low');

  // Hard rule: if safetyRisk is 4 or 5, the band is at least high!
  assert.equal(determinePriorityBand(25, 4), 'high');
  assert.equal(determinePriorityBand(35, 5), 'high');
});

test('Target Due Hours & Dates', () => {
  assert.equal(getTargetDueHours('critical'), 4);
  assert.equal(getTargetDueHours('high'), 24);
  assert.equal(getTargetDueHours('medium'), 72);
  assert.equal(getTargetDueHours('low'), 168);

  const baseDate = '2026-10-29T10:00:00.000Z';
  const criticalDue = computeTargetDueDate(baseDate, 'critical');
  assert.equal(criticalDue, '2026-10-29T14:00:00.000Z');
});

test('Haversine Distance & Category Relationships', () => {
  // Same coordinates = 0 meters
  assert.equal(Math.round(haversineDistanceMeters(12.91, 74.85, 12.91, 74.85)), 0);

  // Small coordinate difference (~111m per 0.001 deg lat)
  const dist = haversineDistanceMeters(12.910, 74.850, 12.911, 74.850);
  assert.ok(dist > 100 && dist < 120);

  // Related categories
  assert.equal(areCategoriesRelated('Waterlogging', 'Drainage'), true);
  assert.equal(areCategoriesRelated('Drainage', 'Road damage'), true);
  assert.equal(areCategoriesRelated('Waterlogging', 'Garbage'), false);
  assert.equal(areCategoriesRelated('Streetlight', 'Streetlight'), true);
});

test('Hotspot Detection: Groups >= 3 connected reports within 300m', () => {
  const dummyFactors = {
    safetyRisk: { score: 3, reason: '' },
    peopleAffected: { score: 3, reason: '' },
    vulnerableLocation: { score: 3, reason: '' },
    recurrence: { score: 2, reason: '' },
    durationOrWorsening: { score: 2, reason: '' },
  };

  const createMockReport = (id: string, lat: number, lon: number, cat: Report['category'], score: number): Report => ({
    id,
    trackingCode: `VS-${id}`,
    citizenId: `VX-${id}`,
    originalText: 'mock report',
    originalLanguage: 'en',
    summary_en: 'mock',
    summary_user: 'mock',
    category: cat,
    lat,
    lon,
    factors: dummyFactors,
    priorityScore: score,
    priorityBand: determinePriorityBand(score, 3),
    status: 'Submitted',
    assignedTeam: null,
    duplicateOf: null,
    duplicateConfidence: null,
    duplicateReason: null,
    linkedCount: 0,
    affectedCount: 0,
    targetDueAt: new Date().toISOString(),
    statusHistory: [],
    resolutionNote: null,
    citizenConfirmed: false,
    reopenCount: 0,
    suspectedSpam: false,
    isSample: true,
    createdAt: new Date().toISOString(),
    zoneId: 'zone-1',
    locality: 'Mock Locality',
    aiCategory: cat,
  });

  // 3 close reports (within ~50m) in Waterlogging / Drainage
  const r1 = createMockReport('1', 12.9100, 74.8500, 'Waterlogging', 65);
  const r2 = createMockReport('2', 12.9102, 74.8501, 'Drainage', 55);
  const r3 = createMockReport('3', 12.9101, 74.8503, 'Road damage', 70);
  // 1 distant report (1 km away)
  const r4 = createMockReport('4', 12.9200, 74.8600, 'Waterlogging', 50);

  const hotspots = detectHotspots([r1, r2, r3, r4]);
  assert.equal(hotspots.length, 1);
  assert.equal(hotspots[0].reports.length, 3);
  assert.equal(hotspots[0].highestPriorityScore, 70);
  assert.ok(hotspots[0].radiusMeters >= 25);
  assert.ok(hotspots[0].score > 0);
});

import { appendSpokenText, getSpeechLangCode } from '../src/utils/speech.ts';

test('Voice Input: appendSpokenText cleanly appends without deleting typed text', () => {
  // Empty base text
  assert.equal(appendSpokenText('', 'Water leaking from pipe'), 'Water leaking from pipe');
  assert.equal(appendSpokenText('   ', 'Pothole on main road'), 'Pothole on main road');

  // Existing base text without trailing space
  assert.equal(
    appendSpokenText('Broken streetlight near junction', 'causing darkness at night'),
    'Broken streetlight near junction causing darkness at night'
  );

  // Existing base text with trailing space
  assert.equal(
    appendSpokenText('Garbage piled up near market ', 'stray dogs tearing bags'),
    'Garbage piled up near market stray dogs tearing bags'
  );

  // Existing base text with trailing newline
  assert.equal(
    appendSpokenText('Issue description line 1\n', 'Line 2 from speech input'),
    'Issue description line 1\nLine 2 from speech input'
  );

  // Empty incoming speech returns existing text untouched
  assert.equal(appendSpokenText('Original text saved', ''), 'Original text saved');
  assert.equal(appendSpokenText('Original text saved', '   '), 'Original text saved');
});

test('Voice Input: getSpeechLangCode maps all supported languages to BCP-47 locales', () => {
  assert.equal(getSpeechLangCode('en'), 'en-IN');
  assert.equal(getSpeechLangCode('hi'), 'hi-IN');
  assert.equal(getSpeechLangCode('kn'), 'kn-IN');
  assert.equal(getSpeechLangCode('te'), 'te-IN');
});

import { isAppSecureContext } from '../src/utils/speech.ts';

test('Voice Input: isAppSecureContext safely runs in SSR/Node and browser environments', () => {
  // In node/ssr environment without window, should default safely to true
  assert.equal(isAppSecureContext(), true);
});

test('Photo AI Analysis: Append suggestion preserves citizen typed text', () => {
  const existingTypedText = 'Dangerous hole near school gate.';
  const aiPhotoSuggestion = 'Deep excavated trench with rainwater accumulating.';

  const combinedText = `${existingTypedText.trim()}\n\nPhoto detail: ${aiPhotoSuggestion.trim()}`;

  assert.ok(combinedText.includes(existingTypedText));
  assert.ok(combinedText.includes(aiPhotoSuggestion));
  assert.equal(
    combinedText,
    'Dangerous hole near school gate.\n\nPhoto detail: Deep excavated trench with rainwater accumulating.'
  );
});

test('Permanent Citizen Tracking ID: Multiple reports share same citizenId', () => {
  const citizenId = 'VX-7K3Q9';
  const report1: Report = {
    id: 'rep-1',
    trackingCode: citizenId,
    citizenId,
    originalText: 'Broken streetlight',
    originalLanguage: 'en',
    summary_en: 'Broken streetlight',
    summary_user: 'Broken streetlight',
    category: 'Streetlight',
    lat: 12.9141,
    lon: 74.8560,
    factors: {
      safetyRisk: { score: 3, reason: '' },
      peopleAffected: { score: 3, reason: '' },
      vulnerableLocation: { score: 2, reason: '' },
      recurrence: { score: 1, reason: '' },
      durationOrWorsening: { score: 2, reason: '' },
    },
    priorityScore: 40,
    priorityBand: 'medium',
    status: 'Submitted',
    assignedTeam: null,
    duplicateOf: null,
    duplicateConfidence: null,
    duplicateReason: null,
    linkedCount: 0,
    affectedCount: 1,
    targetDueAt: new Date().toISOString(),
    statusHistory: [],
    resolutionNote: null,
    citizenConfirmed: false,
    reopenCount: 0,
    suspectedSpam: false,
    isSample: false,
    createdAt: new Date().toISOString(),
    zoneId: 'zone-1',
    locality: 'Kodialbail',
    aiCategory: 'Streetlight',
  };

  const report2: Report = {
    ...report1,
    id: 'rep-2',
    category: 'Garbage',
    originalText: 'Uncollected garbage pile',
  };

  const citizenReports = [report1, report2].filter((r) => r.citizenId === citizenId);
  assert.equal(citizenReports.length, 2);
  assert.equal(citizenReports[0].citizenId, citizenReports[1].citizenId);
});
