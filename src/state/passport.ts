// Leica Passport (#41): a camera's or lens's life story, kept with it and
// handed to the next owner. Each entry (bought, serviced, checked, a photo of
// its condition, handed over) is sealed into a SHA-256 chain: every entry's
// seal covers the one before it, so a history changed after it was sealed no
// longer matches. The last seal, shortened, is the passport's fingerprint; a
// seller gives it to the buyer separately (a message, the listing), and the
// buyer's copy must show the same one.
//
// What this proves, and what it doesn't: the chain shows the file hasn't been
// edited since the seller sealed it. It does not prove the camera is genuine
// or that the seller told the truth, and the UI says so. The serial checks
// use only the published serial lists (serialFacts).

import type { CollectionItem, ItemKind } from "./collection";
import { lookupSerialFacts, type SerialFacts } from "./serialFacts";

export type EventType = "acquired" | "service" | "condition" | "health" | "repair" | "note" | "transfer";

export const EVENT_TYPES: EventType[] = ["acquired", "service", "repair", "condition", "health", "note", "transfer"];

export interface HealthSummary {
  /** Speeds measured by the shutter test, with the nominal speed and the error in stops. */
  speeds: { nominalSec: number; measuredSec: number; errorStops: number }[];
  /** Checklist answers: id → "ok" | "issue" | "skipped". */
  checks: Record<string, "ok" | "issue" | "skipped">;
  verdict: "good" | "attention" | "service";
}

export interface PassportEvent {
  id: string;
  type: EventType;
  /** When it happened, "YYYY-MM-DD" (the owner's date, not the recording time). */
  date: string;
  /** Short line: "CLA by …", "Bought from …". */
  title: string;
  detail?: string;
  /** A workshop, shop or person. */
  by?: string;
  cost?: string;
  /** Small JPEGs as data URLs. */
  photos?: string[];
  health?: HealthSummary;
  /** Transfers: to whom. */
  to?: string;
  /** When it was recorded (ISO). */
  recordedAt: string;
}

export interface SealedEvent {
  event: PassportEvent;
  /** SHA-256 hex of the previous seal + this event. */
  seal: string;
}

export interface PassportSubject {
  kind: ItemKind;
  name: string;
  serial?: string;
  catalogueId?: string;
  serialFacts?: SerialFacts;
  /** The item's own photo, if any. */
  photo?: string;
}

export interface Passport {
  format: "leica.rt-passport";
  version: 1;
  /** The collection item it belongs to on this device. */
  itemId: string;
  subject: PassportSubject;
  entries: SealedEvent[];
  /** Service reminder, in years; undefined = no reminder. */
  remindYears?: number;
  /** Seals received from a previous owner: entries up to this index can't be edited here. */
  lockedThrough?: number;
}

export const GENESIS = "0".repeat(64);

function last<T>(list: readonly T[]): T | undefined {
  return list[list.length - 1];
}

/**
 * What the chain starts from: the item itself (kind, name, serial,
 * catalogue model), so a file whose serial was changed no longer verifies.
 * The photo is left out (it's large, and re-encoding it changes the bytes).
 */
export async function chainStart(subject: PassportSubject): Promise<string> {
  const { kind, name, serial, catalogueId } = subject;
  return sha256Hex(`${GENESIS}\n${canonical({ kind, name, serial, catalogueId })}`);
}

/** JSON with keys in a fixed order, so the same event always hashes the same. */
export function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${canonical(obj[k])}`)
    .join(",")}}`;
}

export async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function sealOf(previous: string, event: PassportEvent): Promise<string> {
  return sha256Hex(`${previous}\n${canonical(event)}`);
}

export function subjectOf(item: CollectionItem): PassportSubject {
  return { kind: item.kind, name: item.name, serial: item.serial, catalogueId: item.catalogueId, serialFacts: item.serialFacts, photo: item.photo };
}

export function newPassport(item: CollectionItem): Passport {
  return { format: "leica.rt-passport", version: 1, itemId: item.id, subject: subjectOf(item), entries: [] };
}

export function newEventId(now = Date.now()): string {
  return `e${now.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** Entries by date (then recording order); the seal order is the order they were added. */
export function timeline(p: Passport): PassportEvent[] {
  return p.entries.map((e) => e.event).sort((a, b) => a.date.localeCompare(b.date) || a.recordedAt.localeCompare(b.recordedAt));
}

/** Adds an event at the end of the chain. */
export async function addEvent(p: Passport, event: PassportEvent): Promise<Passport> {
  const prev = last(p.entries)?.seal ?? (await chainStart(p.subject));
  return { ...p, entries: [...p.entries, { event, seal: await sealOf(prev, event) }] };
}

/** Whether an entry can still be changed on this device (not part of a received history). */
export function editable(p: Passport, index: number): boolean {
  return p.lockedThrough === undefined || index > p.lockedThrough;
}

/**
 * Replaces or removes an entry the owner added here, then re-seals from that
 * point on. Received entries (a previous owner's) are refused.
 */
export async function replaceEvent(p: Passport, id: string, next: PassportEvent | null): Promise<Passport> {
  const index = p.entries.findIndex((e) => e.event.id === id);
  if (index < 0 || !editable(p, index)) return p;
  const events = p.entries.map((e) => e.event);
  if (next) events[index] = next;
  else events.splice(index, 1);
  return { ...p, entries: await resealFrom(p.subject, p.entries.slice(0, index), events.slice(index)) };
}

async function resealFrom(subject: PassportSubject, kept: SealedEvent[], events: PassportEvent[]): Promise<SealedEvent[]> {
  let prev = last(kept)?.seal ?? (await chainStart(subject));
  const entries = [...kept];
  for (const event of events) {
    const seal = await sealOf(prev, event);
    entries.push({ event, seal });
    prev = seal;
  }
  return entries;
}

/**
 * The owner changed the item (a corrected serial, a new photo): the passport
 * follows it and is re-sealed. A received passport keeps the subject it came
 * with, because that is what the previous owner sealed.
 */
export async function resubject(p: Passport, item: CollectionItem): Promise<Passport> {
  if (p.lockedThrough !== undefined) return p.subject.photo || !item.photo ? p : { ...p, subject: { ...p.subject, photo: item.photo } };
  const subject = subjectOf(item);
  const same = canonical({ ...subject, photo: undefined }) === canonical({ ...p.subject, photo: undefined });
  if (same) return subject.photo === p.subject.photo ? p : { ...p, subject };
  return { ...p, subject, entries: await resealFrom(subject, [], p.entries.map((e) => e.event)) };
}

export type Verification = { ok: true; fingerprint: string } | { ok: false; brokenAt: number };

/** Recomputes the chain: the first entry whose seal doesn't match, or the fingerprint. */
export async function verify(p: Passport): Promise<Verification> {
  let prev = await chainStart(p.subject);
  for (let i = 0; i < p.entries.length; i++) {
    const expected = await sealOf(prev, p.entries[i].event);
    if (expected !== p.entries[i].seal) return { ok: false, brokenAt: i };
    prev = expected;
  }
  return { ok: true, fingerprint: fingerprint(prev) };
}

/** The last seal as four groups of four, easy to read out or type: "7F3A-91C2-0B4D-E8A1". */
export function fingerprint(seal: string): string {
  return (seal.slice(0, 16).toUpperCase().match(/.{4}/g) ?? []).join("-");
}

export async function currentFingerprint(p: Passport): Promise<string> {
  return fingerprint(last(p.entries)?.seal ?? (await chainStart(p.subject)));
}

/**
 * Owners in order, from acquisitions and hand-overs. An acquisition names the
 * seller (`by`), not the new owner, so owners who started or bought outside a
 * hand-over have no name ("").
 */
export function owners(p: Passport): { name: string; from: string; to?: string }[] {
  const out: { name: string; from: string; to?: string }[] = [];
  const events = timeline(p);
  // Whoever started the passport owned it from its first entry, even without a "bought" entry.
  if (events.length && events[0].type !== "acquired") out.push({ name: "", from: events[0].date });
  for (const e of events) {
    if (e.type === "acquired") {
      const prev = last(out);
      // A hand-over followed by the buyer's own "bought" entry is one owner, not two.
      if (prev && prev.from === e.date && !prev.to) continue;
      if (prev && !prev.to) prev.to = e.date;
      out.push({ name: "", from: e.date });
    }
    if (e.type === "transfer") {
      const prev = last(out);
      if (prev) prev.to = e.date;
      out.push({ name: e.to ?? "", from: e.date });
    }
  }
  return out;
}

/** The last service or repair, and when a reminder falls due. */
export function serviceStatus(p: Passport, today: Date): { last?: string; monthsSince?: number; due: boolean; dueDate?: string } {
  const lastService = last(timeline(p).filter((e) => e.type === "service" || e.type === "repair"))?.date;
  if (!lastService) return { due: false };
  const [y, m] = lastService.split("-").map(Number);
  const monthsSince = (today.getFullYear() - y) * 12 + (today.getMonth() + 1 - m);
  if (!p.remindYears) return { last: lastService, monthsSince, due: false };
  const dueDate = `${y + p.remindYears}-${String(m).padStart(2, "0")}${lastService.slice(7)}`;
  return { last: lastService, monthsSince, due: monthsSince >= p.remindYears * 12, dueDate };
}

export type Flag = { level: "ok" | "info" | "warn"; key: string; vars?: Record<string, string> };

/**
 * What the published serial lists say about this item, as flags for the
 * owner or a buyer. Only facts the lists hold: a match, a mismatch with the
 * model it's described as, or "the lists can't say".
 */
export function serialFlags(subject: PassportSubject): Flag[] {
  if (subject.kind === "accessory") return [];
  if (!subject.serial) return [{ level: "info", key: "passport.flag.noSerial" }];
  const found = subject.serialFacts ? null : lookupSerialFacts(subject.kind, subject.serial);
  const f = subject.serialFacts ?? (found?.status === "found" ? found.facts : undefined);
  if (!f) return [{ level: "info", key: "passport.flag.unlisted" }];
  if (subject.kind === "body" && f.bodyId && subject.catalogueId && f.bodyId !== subject.catalogueId)
    return [{ level: "warn", key: "passport.flag.mismatch", vars: { model: f.model ?? "", year: f.year } }];
  if (subject.kind === "body" && f.model) return [{ level: "ok", key: "passport.flag.bodyMatch", vars: { model: f.model, year: f.year } }];
  return [{ level: "ok", key: "passport.flag.lensYear", vars: { year: f.year } }];
}

/** A hand-over file's name: "leica-m3-700123.passport.json". */
export function fileName(p: Passport): string {
  const slug = `${p.subject.name} ${p.subject.serial ?? ""}`
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${slug || "passport"}.passport.json`;
}

export function serialize(p: Passport): string {
  return JSON.stringify(p);
}

export type ParseResult = { ok: true; passport: Passport } | { ok: false; reason: "notPassport" | "newerVersion" | "damaged" };

/** Reads a hand-over file. The chain is checked separately with `verify`. */
export function parsePassport(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, reason: "notPassport" };
  }
  const p = raw as Partial<Passport>;
  if (!p || p.format !== "leica.rt-passport") return { ok: false, reason: "notPassport" };
  if (typeof p.version !== "number" || p.version > 1) return { ok: false, reason: "newerVersion" };
  if (!p.subject || typeof p.subject.name !== "string" || !Array.isArray(p.entries)) return { ok: false, reason: "damaged" };
  for (const e of p.entries) {
    if (!e || typeof e.seal !== "string" || !e.event || typeof e.event.id !== "string" || typeof e.event.date !== "string" || !EVENT_TYPES.includes(e.event.type))
      return { ok: false, reason: "damaged" };
  }
  return { ok: true, passport: p as Passport };
}

/**
 * The buyer's copy: a new collection item for this device, and the passport
 * attached to it with the received history locked.
 */
export function receive(p: Passport, itemId: string): { item: CollectionItem; passport: Passport } {
  const s = p.subject;
  const item: CollectionItem = { id: itemId, kind: s.kind, name: s.name, serial: s.serial, catalogueId: s.catalogueId, serialFacts: s.serialFacts, photo: s.photo };
  const lastTransfer = last(timeline(p).filter((e) => e.type === "transfer"));
  if (lastTransfer) item.acquired = lastTransfer.date;
  return { item, passport: { ...p, itemId, lockedThrough: p.entries.length - 1, remindYears: undefined } };
}
