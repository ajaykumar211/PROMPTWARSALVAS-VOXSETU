import { Hotspot, Report } from '../types/index.ts';
import { areCategoriesRelated, haversineDistanceMeters } from './geo.ts';

class UnionFind {
  parent: number[];
  rank: number[];

  constructor(size: number) {
    this.parent = Array.from({ length: size }, (_, i) => i);
    this.rank = new Array(size).fill(0);
  }

  find(i: number): number {
    if (this.parent[i] !== i) {
      this.parent[i] = this.find(this.parent[i]);
    }
    return this.parent[i];
  }

  union(i: number, j: number): void {
    const rootI = this.find(i);
    const rootJ = this.find(j);
    if (rootI !== rootJ) {
      if (this.rank[rootI] < this.rank[rootJ]) {
        this.parent[rootI] = rootJ;
      } else if (this.rank[rootI] > this.rank[rootJ]) {
        this.parent[rootJ] = rootI;
      } else {
        this.parent[rootJ] = rootI;
        this.rank[rootI]++;
      }
    }
  }
}

export const HOTSPOT_FORMULA_TEXT =
  'Hotspot Score = (0.5 × Highest Priority) + (0.3 × min[100, Total Reports × 12]) + (0.2 × % Share in Last 7 Days)';

export function detectHotspots(
  reports: Report[],
  nowMs: number = Date.now()
): Hotspot[] {
  // Only open, non-duplicate reports participate
  // Open means status is not 'Resolved'
  const eligibleReports = reports.filter(
    (r) => r.status !== 'Resolved' && !r.duplicateOf
  );

  const n = eligibleReports.length;
  if (n < 3) return [];

  const uf = new UnionFind(n);

  // Connect pairs if distance <= 300m and categories are same or related
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const repA = eligibleReports[i];
      const repB = eligibleReports[j];
      if (areCategoriesRelated(repA.category, repB.category)) {
        const dist = haversineDistanceMeters(
          repA.lat,
          repA.lon,
          repB.lat,
          repB.lon
        );
        if (dist <= 300) {
          uf.union(i, j);
        }
      }
    }
  }

  // Group by root
  const groups: Map<number, Report[]> = new Map();
  for (let i = 0; i < n; i++) {
    const root = uf.find(i);
    if (!groups.has(root)) {
      groups.set(root, []);
    }
    groups.get(root)!.push(eligibleReports[i]);
  }

  const hotspots: Hotspot[] = [];
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  const fourteenDaysMs = 14 * 24 * 60 * 60 * 1000;

  for (const group of groups.values()) {
    // Group of 3 or more is a hotspot
    if (group.length < 3) continue;

    // Center = average lat/lon
    const sumLat = group.reduce((acc, r) => acc + r.lat, 0);
    const sumLon = group.reduce((acc, r) => acc + r.lon, 0);
    const centerLat = sumLat / group.length;
    const centerLon = sumLon / group.length;

    // Radius: max distance from center + 25m
    let maxDistFromCenter = 0;
    for (const r of group) {
      const d = haversineDistanceMeters(centerLat, centerLon, r.lat, r.lon);
      if (d > maxDistFromCenter) {
        maxDistFromCenter = d;
      }
    }
    const radiusMeters = Math.round(maxDistFromCenter + 25);
    const isWide = radiusMeters * 2 > 700; // diameter wider than 700m

    // Category counts & total reports (counting linked duplicates)
    const categoryCounts: Record<string, number> = {};
    let totalReportsCount = 0;
    let highestPriorityScore = 0;
    let highestBand = group[0].priorityBand;

    let reportsLast7Days = 0;
    let reportsPrior7Days = 0;

    for (const r of group) {
      categoryCounts[r.category] = (categoryCounts[r.category] || 0) + 1;
      const countForThis = 1 + (r.linkedCount || 0);
      totalReportsCount += countForThis;

      if (r.priorityScore > highestPriorityScore) {
        highestPriorityScore = r.priorityScore;
        highestBand = r.priorityBand;
      }

      const reportAgeMs = nowMs - new Date(r.createdAt).getTime();
      if (reportAgeMs <= sevenDaysMs) {
        reportsLast7Days += countForThis;
      } else if (reportAgeMs <= fourteenDaysMs) {
        reportsPrior7Days += countForThis;
      }
    }

    // Trend: rising, steady, falling
    let trend: 'rising' | 'steady' | 'falling' = 'steady';
    if (reportsLast7Days > reportsPrior7Days) {
      trend = 'rising';
    } else if (reportsLast7Days < reportsPrior7Days) {
      trend = 'falling';
    }

    // Share of reports from last 7 days
    const shareLast7Days =
      totalReportsCount > 0 ? reportsLast7Days / totalReportsCount : 0;

    // Hotspot score: 0.5*highest priority + 0.3*min(100, totalReports*12) + 0.2*(share of reports from the last 7 days*100)
    const rawScore =
      0.5 * highestPriorityScore +
      0.3 * Math.min(100, totalReportsCount * 12) +
      0.2 * (shareLast7Days * 100);
    const score = Math.round(Math.min(100, Math.max(0, rawScore)));

    // Sort report IDs consistently
    const reportIds = group.map((r) => r.id).sort();
    const id = `HS-${Math.abs(Math.round(centerLat * 10000))}-${Math.abs(
      Math.round(centerLon * 10000)
    )}-${group.length}`;

    hotspots.push({
      id,
      center: { lat: centerLat, lon: centerLon },
      radiusMeters,
      reports: group,
      reportIds,
      totalReportsCount,
      categoryCounts,
      highestPriorityScore,
      highestPriorityBand: highestBand,
      reportsLast7Days,
      reportsPrior7Days,
      shareLast7Days,
      trend,
      score,
      isWide,
    });
  }

  // Sort by score descending
  return hotspots.sort((a, b) => b.score - a.score);
}
