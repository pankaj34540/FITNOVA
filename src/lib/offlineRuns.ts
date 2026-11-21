import type { GpsPoint } from './types.ts';
import { api } from './api.ts';

const OFFLINE_KEY = 'fitnova_offline_runs_v1';

export interface OfflineRunPayload {
  id: string;
  route_points: GpsPoint[];
  duration_seconds: number;
  started_at: string;
  distance_preview_m: number;
}

export function haversineMeters(a: GpsPoint, b: GpsPoint): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLng / 2);
  const c = s1 * s1 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * s2 * s2;
  return R * 2 * Math.atan2(Math.sqrt(c), Math.sqrt(1 - c));
}

export function isValidNextPoint(prev: GpsPoint | null, next: GpsPoint): { ok: boolean; reason?: string; deltaMeters: number } {
  if (next.accuracy > 50) {
    return { ok: false, reason: `Weak GPS accuracy (${Math.round(next.accuracy)}m > 50m)`, deltaMeters: 0 };
  }
  if (!prev) return { ok: true, deltaMeters: 0 };
  const dtSec = Math.max(0.5, (next.timestamp - prev.timestamp) / 1000);
  const dist = haversineMeters(prev, next);
  const speedKmh = (dist / dtSec) * 3.6;
  if (speedKmh > 32 || dist > 250) {
    return { ok: false, reason: `GPS jump filtered (${speedKmh.toFixed(1)} km/h)`, deltaMeters: 0 };
  }
  return { ok: true, deltaMeters: dist };
}

export function getOfflineRuns(): OfflineRunPayload[] {
  try {
    const raw = localStorage.getItem(OFFLINE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveOfflineRun(run: OfflineRunPayload): void {
  const list = getOfflineRuns();
  list.push(run);
  localStorage.setItem(OFFLINE_KEY, JSON.stringify(list));
}

export async function syncOfflineRuns(): Promise<number> {
  const list = getOfflineRuns();
  if (list.length === 0) return 0;
  const remaining: OfflineRunPayload[] = [];
  let synced = 0;
  for (const run of list) {
    try {
      await api('/api/runs', {
        method: 'POST',
        body: JSON.stringify({
          route_points: run.route_points,
          duration_seconds: run.duration_seconds,
          started_at: run.started_at,
          synced_from_offline: true,
        }),
      });
      synced++;
    } catch {
      remaining.push(run);
    }
  }
  localStorage.setItem(OFFLINE_KEY, JSON.stringify(remaining));
  return synced;
}
