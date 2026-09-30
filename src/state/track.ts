// Routes for geotagging film (#57): where the phone was, and when, recorded
// on a walk or a day out. A frame noted in the Shot log at a certain time is
// then placed where the phone was at that time. Pure logic; the recorder and
// the store keep the routes on this device only.

import { distanceKm } from "../data/cities";

export interface TrackPoint {
  /** Milliseconds since 1970. */
  t: number;
  lat: number;
  lon: number;
  /** Metres. */
  acc?: number;
}

export interface Track {
  id: string;
  startedAt: number;
  endedAt?: number;
  points: TrackPoint[];
}

/** Fixes worse than this are ignored. */
export const MAX_ACCURACY_M = 100;

/** Adds a fix, keeping one every 15 m or minute, whichever comes first. */
export function addPoint(points: TrackPoint[], p: TrackPoint): TrackPoint[] {
  if (p.acc !== undefined && p.acc > MAX_ACCURACY_M) return points;
  const last = points[points.length - 1];
  if (last) {
    const moved = distanceKm(last.lat, last.lon, p.lat, p.lon) * 1000;
    if (moved < 15 && p.t - last.t < 60_000) return points;
  }
  return [...points, p];
}

/**
 * Where the phone was at `time`: between two fixes, along the line between
 * them (if they're no more than `maxGapMs` apart); near the ends, the end fix
 * (within `edgeMs`). Otherwise unknown.
 */
export function positionAt(points: TrackPoint[], time: number, { maxGapMs = 15 * 60_000, edgeMs = 5 * 60_000 } = {}): { lat: number; lon: number } | null {
  if (!points.length) return null;
  const first = points[0];
  const last = points[points.length - 1];
  if (time <= first.t) return first.t - time <= edgeMs ? { lat: first.lat, lon: first.lon } : null;
  if (time >= last.t) return time - last.t <= edgeMs ? { lat: last.lat, lon: last.lon } : null;
  let lo = 0;
  let hi = points.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (points[mid].t <= time) lo = mid;
    else hi = mid;
  }
  const a = points[lo];
  const b = points[hi];
  if (b.t - a.t > maxGapMs) {
    // A long gap: only if the frame is close to one end of it.
    if (time - a.t <= edgeMs) return { lat: a.lat, lon: a.lon };
    if (b.t - time <= edgeMs) return { lat: b.lat, lon: b.lon };
    return null;
  }
  const f = (time - a.t) / Math.max(1, b.t - a.t);
  return { lat: a.lat + (b.lat - a.lat) * f, lon: a.lon + (b.lon - a.lon) * f };
}

/** The position at `time` from whichever route covers it. */
export function locate(tracks: Track[], time: number): { lat: number; lon: number } | null {
  for (const tr of tracks) {
    const p = positionAt(tr.points, time);
    if (p) return p;
  }
  return null;
}

/** Keeps the last `max` routes. */
export function trimTracks(tracks: Track[], max = 60): Track[] {
  return tracks.length > max ? tracks.slice(tracks.length - max) : tracks;
}
