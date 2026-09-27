// Leica timeline / interactive museum (feature #23). Items come from the gear
// catalogue (years, specs); historical notes come from a versioned content
// dataset (content/timeline.json), each with a citation. This module joins
// the two and validates the content so facts stay auditable.

import content from "../content/timeline.json";
import { BODIES, LENSES, isAdapted, lensesForBody, type Body, type BodyFamily, type Lens, type Mount } from "./gear";
import { LENS_FAMILIES } from "./lensFamilies";

export interface NoteProvenance {
  kind: "reference";
  source: string;
  url: string;
  /** Date the source was last read against the note (YYYY-MM-DD). */
  checked: string;
}

export interface TimelineNote {
  id: string;
  text: string;
  provenance: NoteProvenance;
  bodyId?: string;
  lensId?: string;
  /** Standalone milestones (not in the catalogue) carry their own year, title and filter facts. */
  year?: number;
  title?: string;
  medium?: Medium;
  mount?: Mount;
  finder?: Finder;
}

export interface TimelineContent {
  version: number;
  updated: string;
  about: string;
  notes: TimelineNote[];
}

export const TIMELINE_CONTENT = content as TimelineContent;

export type Medium = "film" | "digital";
export type Finder = "rangefinder" | "electronic" | "reflex";
export type ItemKind = "body" | "lens" | "milestone";

export interface TimelineItem {
  id: string;
  kind: ItemKind;
  year: number;
  title: string;
  body?: Body;
  lens?: Lens;
  /** Null for lenses: they appear under film and digital alike. */
  medium: Medium | null;
  /** Null for lenses. */
  finder: Finder | null;
  mount: Mount | null;
  notes: TimelineNote[];
}

/** Finder type by body family: every M is a rangefinder, Q/SL/CL use an electronic finder, the S an optical reflex finder. */
const FINDER_BY_FAMILY: Record<BodyFamily, Finder> = {
  "M film": "rangefinder",
  "M digital": "rangefinder",
  Q: "electronic",
  SL: "electronic",
  CL: "electronic",
  S: "reflex",
};

export function finderOf(body: Body): Finder {
  return FINDER_BY_FAMILY[body.family];
}

/** The body's main mount, or "fixed" for fixed-lens cameras. */
export function mountOf(body: Body): Mount {
  return body.fixedLensId ? "fixed" : body.mounts[0];
}

/** Lens milestones: lenses with a historical note, or that belong to a tracked lens family (#24). */
function milestoneLens(lens: Lens, notes: TimelineNote[]) {
  return notes.some((n) => n.lensId === lens.id) || LENS_FAMILIES.some((f) => f.revisions.some((r) => r.lensId === lens.id));
}

export function timelineItems(c: TimelineContent = TIMELINE_CONTENT): TimelineItem[] {
  const items: TimelineItem[] = [
    ...BODIES.map((b) => ({
      id: `body:${b.id}`,
      kind: "body" as const,
      year: b.year,
      title: b.name,
      body: b,
      medium: (b.medium === "film" ? "film" : "digital") as Medium,
      finder: finderOf(b),
      mount: mountOf(b),
      notes: c.notes.filter((n) => n.bodyId === b.id),
    })),
    ...LENSES.filter((l) => l.mount !== "fixed" && milestoneLens(l, c.notes)).map((l) => ({
      id: `lens:${l.id}`,
      kind: "lens" as const,
      year: l.year,
      title: l.name,
      lens: l,
      medium: null,
      finder: null,
      mount: l.mount,
      notes: c.notes.filter((n) => n.lensId === l.id),
    })),
    ...c.notes
      .filter((n) => !n.bodyId && !n.lensId)
      .map((n) => ({
        id: `note:${n.id}`,
        kind: "milestone" as const,
        year: n.year as number,
        title: n.title as string,
        medium: n.medium ?? null,
        finder: n.finder ?? null,
        mount: n.mount ?? null,
        notes: [n],
      })),
  ];
  return items.sort((a, b) => a.year - b.year || a.kind.localeCompare(b.kind) || a.title.localeCompare(b.title));
}

export interface TimelineFilter {
  /** Decade start (e.g. 1950), or null for all. */
  decade: number | null;
  medium: Medium | null;
  finder: Finder | null;
  mount: Mount | null;
  lenses: boolean;
}

export const NO_FILTER: TimelineFilter = { decade: null, medium: null, finder: null, mount: null, lenses: false };

export function filterItems(items: TimelineItem[], f: TimelineFilter): TimelineItem[] {
  return items.filter((it) => {
    if (it.kind === "lens" && !f.lenses) return false;
    if (f.decade !== null && Math.floor(it.year / 10) * 10 !== f.decade) return false;
    if (f.medium && it.medium !== null && it.medium !== f.medium) return false;
    if (f.medium && it.kind === "milestone" && it.medium === null) return false;
    if (f.finder && it.finder !== f.finder) return false;
    if (f.mount && it.mount !== f.mount) return false;
    return true;
  });
}

export function decades(items: TimelineItem[]): number[] {
  return [...new Set(items.map((i) => Math.floor(i.year / 10) * 10))].sort((a, b) => a - b);
}

/**
 * Whether "Simulate this" can be offered: only for catalogue bodies and
 * lenses, which carry the specs the simulator needs. Milestones outside the
 * catalogue can't be simulated.
 */
export function canSimulate(item: TimelineItem): boolean {
  if (item.kind === "body") return !!item.body && BODIES.includes(item.body);
  if (item.kind === "lens") return !!item.lens && BODIES.some((b) => lensesForBody(b).includes(item.lens!));
  return false;
}

/** The body to simulate a lens on: the current body when it takes the lens, else the newest body that takes it natively. */
export function bodyForLens(lens: Lens, current: Body): Body | null {
  if (lensesForBody(current).includes(lens)) return current;
  const fits = BODIES.filter((b) => lensesForBody(b).includes(lens));
  const native = fits.filter((b) => !isAdapted(b, lens));
  const pool = native.length ? native : fits;
  return pool.length ? pool.reduce((a, b) => (b.year > a.year ? b : a)) : null;
}

/**
 * Content problems: missing or incomplete citations, unknown catalogue ids,
 * standalone milestones without a year or title, duplicate ids, and years
 * written into catalogue-linked notes (they'd drift from the catalogue).
 */
export function timelineProblems(c: TimelineContent = TIMELINE_CONTENT): string[] {
  const out: string[] = [];
  if (!Number.isInteger(c.version) || c.version < 1) out.push("content version must be a positive integer");
  const ids = new Set<string>();
  for (const n of c.notes) {
    if (ids.has(n.id)) out.push(`duplicate note id ${n.id}`);
    ids.add(n.id);
    const p = n.provenance;
    if (!p || p.kind !== "reference" || !p.source || !/^https:\/\//.test(p.url ?? "") || !/^\d{4}-\d{2}-\d{2}$/.test(p.checked ?? "")) out.push(`${n.id}: incomplete provenance`);
    if (n.bodyId && !BODIES.some((b) => b.id === n.bodyId)) out.push(`${n.id}: unknown body ${n.bodyId}`);
    if (n.lensId && !LENSES.some((l) => l.id === n.lensId)) out.push(`${n.id}: unknown lens ${n.lensId}`);
    if (!n.bodyId && !n.lensId && (!n.year || !n.title)) out.push(`${n.id}: a standalone milestone needs a year and title`);
    if ((n.bodyId || n.lensId) && /\b(19|20)\d\d\b/.test(n.text)) out.push(`${n.id}: catalogue-linked notes must not state years`);
    if (n.text.length > 280) out.push(`${n.id}: keep notes to a concise original summary`);
  }
  return out;
}
