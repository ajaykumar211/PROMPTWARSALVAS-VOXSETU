/**
 * Geographic calculations and Haversine distance
 */

export function haversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth's radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function areCategoriesRelated(catA: string, catB: string): boolean {
  if (catA === catB) return true;
  const waterRoadDrain = new Set(['Waterlogging', 'Drainage', 'Road damage']);
  if (waterRoadDrain.has(catA) && waterRoadDrain.has(catB)) {
    return true;
  }
  return false;
}

import { Zone } from '../types/index.ts';

export const SAMPLE_ZONES: Zone[] = [
  {
    id: 'zone-a',
    name: 'Hampankatta Central',
    bounds: { north: 12.925, south: 12.915, east: 74.855, west: 74.840 },
    defaultTeam: 'Roads',
  },
  {
    id: 'zone-b',
    name: 'Bejai Ward',
    bounds: { north: 12.935, south: 12.925, east: 74.860, west: 74.845 },
    defaultTeam: 'Sanitation',
  },
  {
    id: 'zone-c',
    name: 'Kodialbail',
    bounds: { north: 12.915, south: 12.900, east: 74.850, west: 74.835 },
    defaultTeam: 'Drainage',
  },
  {
    id: 'zone-d',
    name: 'Pandeshwar Port',
    bounds: { north: 12.900, south: 12.885, east: 74.855, west: 74.830 },
    defaultTeam: 'Sanitation',
  },
  {
    id: 'zone-e',
    name: 'Kadri Hills',
    bounds: { north: 12.930, south: 12.910, east: 74.880, west: 74.860 },
    defaultTeam: 'Electrical',
  },
];

export function isPointInBounds(lat: number, lon: number, bounds: { north: number; south: number; east: number; west: number }): boolean {
  return lat >= bounds.south && lat <= bounds.north && lon >= bounds.west && lon <= bounds.east;
}

export function getZoneForPoint(lat: number, lon: number): string {
  const zone = SAMPLE_ZONES.find(z => isPointInBounds(lat, lon, z.bounds));
  return zone ? zone.id : 'Unzoned';
}

export function isValidCoordinate(lat: number, lon: number): boolean {
  return (
    typeof lat === 'number' &&
    typeof lon === 'number' &&
    !isNaN(lat) &&
    !isNaN(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180
  );
}
