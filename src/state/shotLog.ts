// Shot log for a real camera: every frame you take on a meterless M, noted as
// you go (settings, place, a note). When the scans come back, they're matched
// to the log in frame order, so each picture sits beside what you did. Pure
// logic here; the component stores the log on this device.

export interface LogEntry {
  id: string;
  /** Which roll the frame belongs to, e.g. "Roll 3". */
  roll: string;
  /** Frame number on that roll, from 1. */
  frame: number;
  takenAt: string;
  body: string;
  lens: string;
  fNumber: number;
  shutterSec: number;
  /** Film name or "ISO n". */
  film: string;
  /** `Infinity` at infinity; omitted when not noted. */
  focusMm?: number;
  place?: string;
  note?: string;
  /** A small JPEG of the scan, once it's back from the lab. */
  scan?: string;
  /** Roll review (#58): the photographer's keeper. */
  pick?: boolean;
  /** Roll review: what went wrong, if anything. */
  issue?: FrameIssue;
}

export type FrameIssue = "focus" | "blur" | "under" | "over";
export const FRAME_ISSUES: FrameIssue[] = ["focus", "blur", "under", "over"];

export type NewEntry = Omit<LogEntry, "id" | "frame" | "takenAt"> & { takenAt?: string };

/** The next frame number on a roll. */
export function nextFrame(log: LogEntry[], roll: string): number {
  return log.filter((e) => e.roll === roll).reduce((n, e) => Math.max(n, e.frame), 0) + 1;
}

export function addEntry(log: LogEntry[], entry: NewEntry, now = new Date()): LogEntry[] {
  const e: LogEntry = {
    ...entry,
    id: `${now.getTime().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    frame: nextFrame(log, entry.roll),
    takenAt: entry.takenAt ?? now.toISOString(),
  };
  return [...log, e];
}

/** Rolls in the order they were started. */
export function rollsOf(log: LogEntry[]): string[] {
  return [...new Set(log.map((e) => e.roll))];
}

/**
 * Attaches scans to a roll's frames in order: the first scan to the first
 * frame without one, and so on. Returns the new log and how many scans didn't
 * find a frame (more scans than logged frames).
 */
export function attachScans(log: LogEntry[], roll: string, scans: string[]): { log: LogEntry[]; unmatched: number } {
  const waiting = log
    .filter((e) => e.roll === roll && !e.scan)
    .sort((a, b) => a.frame - b.frame)
    .map((e) => e.id);
  const byId = new Map<string, string>();
  scans.forEach((s, i) => {
    if (i < waiting.length) byId.set(waiting[i], s);
  });
  return {
    log: log.map((e) => (byId.has(e.id) ? { ...e, scan: byId.get(e.id) } : e)),
    unmatched: Math.max(0, scans.length - waiting.length),
  };
}

const csvField = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

export function logToCsv(log: LogEntry[]): string {
  const head = ["roll", "frame", "taken_at", "body", "lens", "aperture", "shutter_s", "film", "focus_mm", "place", "note", "scan"];
  const rows = log.map((e) => [
    e.roll,
    String(e.frame),
    e.takenAt,
    e.body,
    e.lens,
    String(e.fNumber),
    String(e.shutterSec),
    e.film,
    e.focusMm === undefined ? "" : Number.isFinite(e.focusMm) ? String(Math.round(e.focusMm)) : "inf",
    e.place ?? "",
    e.note ?? "",
    e.scan ? "yes" : "",
  ]);
  return [head, ...rows].map((r) => r.map(csvField).join(",")).join("\r\n");
}
