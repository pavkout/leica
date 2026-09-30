// Routes on this device (#57), and the one recorder that fills them. Photo
// walks and Tag your scans share it: a walk with the distance counted is also
// a route, and a route can be recorded on its own for a day out. A web page
// can only follow the phone while it's open, and the page says so.

import { useSyncExternalStore } from "react";
import { getString, setString } from "../services/persistence";
import { addPoint, trimTracks, type Track } from "./track";

const KEY = "rangefinder-tracks";

function read(): Track[] {
  try {
    const x = JSON.parse(getString(KEY) ?? "[]") as Track[];
    return Array.isArray(x) ? x : [];
  } catch {
    return [];
  }
}

let tracks: Track[] | null = null;
let watchId: number | null = null;
let recording: string | null = null;
let snap: { tracks: Track[]; recording: string | null } = { tracks: [], recording: null };
const listeners = new Set<() => void>();

function commit(next: Track[]) {
  tracks = next;
  snap = { tracks: next, recording };
  setString(KEY, JSON.stringify(next));
  listeners.forEach((l) => l());
}

function current(): Track[] {
  if (!tracks) {
    tracks = read();
    snap = { tracks, recording };
  }
  return tracks;
}

export function useTracks(): { tracks: Track[]; recording: string | null } {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      current();
      return () => listeners.delete(l);
    },
    () => (current(), snap),
    () => snap
  );
}

export function getTracks(): Track[] {
  return current();
}

/** Starts following the phone (from a tap, so the browser asks for location). Returns false where location isn't available. */
export function startRoute(): boolean {
  if (recording) return true;
  if (typeof navigator === "undefined" || !navigator.geolocation) return false;
  const id = Date.now().toString(36);
  recording = id;
  commit(trimTracks([...current(), { id, startedAt: Date.now(), points: [] }]));
  watchId = navigator.geolocation.watchPosition(
    (p) => {
      const list = current();
      const i = list.findIndex((tr) => tr.id === id);
      if (i < 0) return;
      const points = addPoint(list[i].points, { t: p.timestamp || Date.now(), lat: p.coords.latitude, lon: p.coords.longitude, acc: p.coords.accuracy });
      if (points !== list[i].points) commit(list.map((tr, j) => (j === i ? { ...tr, points } : tr)));
    },
    () => stopRoute(),
    { enableHighAccuracy: true, maximumAge: 15_000 }
  );
  return true;
}

export function stopRoute(): void {
  if (watchId !== null) navigator.geolocation.clearWatch(watchId);
  watchId = null;
  const id = recording;
  recording = null;
  // Empty routes aren't worth keeping.
  commit(current().flatMap((tr) => (tr.id === id ? (tr.points.length ? [{ ...tr, endedAt: Date.now() }] : []) : [tr])));
}

export function deleteRoute(id: string): void {
  commit(current().filter((tr) => tr.id !== id));
}
