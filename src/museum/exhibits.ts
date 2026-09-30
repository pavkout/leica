// Museum mode (#39): rooms and exhibits, built only from what the app already
// knows and can cite. The gear catalogue gives names, years and specs; the
// timeline content gives sourced history; the anatomy model explains parts;
// accessories come from their own cited dataset; the collection is the
// owner's. Nothing here adds a claim: exhibit lines are derived from specs.

import { BODIES, LENSES, formatShutter, type Body, type Lens } from "../data/gear";
import { LENS_FAMILIES } from "../data/lensFamilies";
import { TIMELINE_CONTENT, type TimelineContent } from "../data/timeline";
import { ANATOMY_PROVENANCE, PARTS, type PartId } from "../mechanics/anatomy";
import type { CollectionItem } from "../state/collection";
import { formatFNumber } from "../utils/format";
import { ACCESSORIES, type Accessory } from "./accessories";
import { langTag, t } from "../i18n";

export type RoomId = "cameras" | "lenses" | "inside" | "accessories" | "collection";

export interface Fact {
  label: string;
  value: string;
}

export interface Source {
  label: string;
  url?: string;
}

export interface StoryPart {
  text: string;
  source?: Source;
}

export type ExhibitArt =
  | { kind: "body"; bodyId: string }
  | { kind: "lens"; lensId: string }
  | { kind: "part"; partId: PartId }
  | { kind: "accessory"; accessoryId: string }
  | { kind: "item"; itemId: string };

export interface Exhibit {
  /** Unique within its room; used in the URL. */
  id: string;
  room: RoomId;
  title: string;
  year?: number;
  /** One line under the title, derived from facts. */
  line: string;
  facts: Fact[];
  story: StoryPart[];
  art: ExhibitArt;
  /** A best-known piece: first in the display loop, and the room's preview in the lobby. */
  hero: boolean;
  /** "Try it in the simulator" target. */
  simulate?: { bodyId?: string; lensId?: string };
  /** The body whose shutter can be heard. */
  soundBodyId?: string;
}

export interface Room {
  id: RoomId;
  title: string;
  /** What the room holds, in one line. */
  line: string;
  exhibits: Exhibit[];
}

// ── Cameras ─────────────────────────────────────────────

function capture(b: Body): string {
  if (b.medium === "film") return t("mu.film35");
  const mp = `${Math.max(...(b.megapixels ?? [0]))} MP`;
  const format = b.family === "S" ? t("mu.format.medium") : b.sensorWidthMm < 30 ? "APS-C" : t("mu.format.full");
  return `${mp} ${format}${b.medium === "mono" ? t("mu.monoOnly") : ""}`;
}

function finderLine(b: Body): string {
  if (b.rangefinder) return t("mu.finder.rf", { m: b.rangefinder.magnification.toFixed(2) });
  if (b.family === "S") return t("mu.finder.reflex");
  return t("mu.finder.evf");
}

function meterLine(b: Body): string {
  if (b.meter === "none") return t("mu.meter.none");
  if (b.meter === "leds") return b.autoExposure ? t("mu.meter.ledsAuto") : t("mu.meter.leds");
  return b.autoExposure ? t("mu.meter.auto") : t("mu.meter.on");
}

function familyLine(b: Body): string {
  switch (b.family) {
    case "M film":
      return t("mu.family.mFilm");
    case "M digital":
      return t("mu.family.mDigital");
    case "Q":
      return t("mu.family.q");
    case "SL":
      return t("mu.family.sl");
    case "CL":
      return t("mu.family.cl");
    case "S":
      return t("mu.family.s");
  }
}

export function cameraTitle(b: Body): string {
  return `Leica ${b.name}`;
}

export function cameraExhibit(b: Body, content: TimelineContent = TIMELINE_CONTENT): Exhibit {
  const frames = b.rangefinder ? [...new Set(b.rangefinder.frameSets.flat())].sort((x, y) => x - y) : [];
  const facts: Fact[] = [
    { label: t("mu.f.introduced"), value: String(b.year) },
    { label: t("mu.f.kind"), value: familyLine(b) },
    { label: t("mu.f.captures"), value: capture(b) },
    { label: t("common.shutter"), value: t("sn.range", { a: formatShutter(b.shutter.slowest), b: formatShutter(b.shutter.fastest) }) },
    { label: t("sn.finder"), value: b.rangefinder ? t("mu.f.rfMag", { m: b.rangefinder.magnification }) : finderLine(b).replace(/^./, (c) => c.toUpperCase()) },
    ...(frames.length ? [{ label: t("mu.f.frames"), value: `${frames.join(", ")} mm` }] : []),
    { label: t("mu.f.meter"), value: b.meter === "none" ? t("sn.meter.none") : b.meter === "leds" ? t("mu.f.leds") : t("sn.meter.built") },
    ...(b.isoRange ? [{ label: "ISO", value: t("sn.range", { a: b.isoRange[0], b: num(b.isoRange[1]) }) }] : []),
    { label: t("mu.f.mount"), value: b.fixedLensId ? t("mu.f.fixed") : b.mounts.join(", ") },
  ];
  return {
    id: b.id,
    room: "cameras",
    title: cameraTitle(b),
    year: b.year,
    line: [capture(b), finderLine(b), meterLine(b)].join(" · "),
    facts,
    story: content.notes.filter((n) => n.bodyId === b.id).map((n) => ({ text: n.text, source: { label: n.provenance.source, url: n.provenance.url } })),
    art: { kind: "body", bodyId: b.id },
    hero: b.family === "M film" || b.family === "M digital",
    simulate: { bodyId: b.id },
    soundBodyId: b.id,
  };
}

// ── Lenses ──────────────────────────────────────────────

const locale = () => (langTag() === "en" ? "en-GB" : langTag());
const num = (n: number) => n.toLocaleString(locale());
const metres = (mm: number) => `${(mm / 1000).toLocaleString(locale(), { maximumFractionDigits: 2 })} m`;

function generations(l: Lens): StoryPart | null {
  const fam = LENS_FAMILIES.find((f) => f.revisions.some((r) => r.lensId === l.id));
  if (!fam || fam.revisions.length < 2) return null;
  const list = fam.revisions
    .map((r) => {
      const lens = LENSES.find((x) => x.id === r.lensId);
      return lens ? `${r.label} (${lens.year})` : r.label;
    })
    .join(", ");
  return { text: t("mu.generations", { n: fam.revisions.length, name: fam.name, list }) };
}

export function lensExhibit(l: Lens, content: TimelineContent = TIMELINE_CONTENT): Exhibit {
  const gen = generations(l);
  const facts: Fact[] = [
    { label: t("mu.f.introduced"), value: String(l.year) },
    { label: t("mu.f.focal"), value: `${l.focalMm} mm` },
    { label: t("mu.f.widest"), value: formatFNumber(l.maxAperture) },
    { label: t("mu.f.smallest"), value: formatFNumber(l.minAperture) },
    { label: t("mu.f.closest"), value: metres(l.minFocusMm) },
    ...(l.apertureBlades ? [{ label: t("mu.f.blades"), value: String(l.apertureBlades) }] : []),
    { label: t("mu.f.lensMount"), value: l.mount === "fixed" ? t("mu.f.builtIn") : `Leica ${l.mount}` },
  ];
  const notes = content.notes.filter((n) => n.lensId === l.id).map((n) => ({ text: n.text, source: { label: n.provenance.source, url: n.provenance.url } }));
  return {
    id: l.id,
    room: "lenses",
    title: l.name,
    year: l.year,
    line: [`${l.focalMm} mm`, formatFNumber(l.maxAperture), l.nickname].filter(Boolean).join(" · "),
    facts,
    story: [...notes, ...(gen ? [gen] : [])],
    art: { kind: "lens", lensId: l.id },
    hero: notes.length > 0 || Boolean(gen) || Boolean(l.nickname),
    simulate: { lensId: l.id },
  };
}

// ── Inside the camera ───────────────────────────────────

function firstSentence(text: string): string {
  const m = /^(.+?[.!?])(\s|$)/.exec(text);
  return m ? m[1] : text;
}

export function partExhibits(): Exhibit[] {
  return PARTS.map((p) => ({
    id: p.id,
    room: "inside" as const,
    title: p.label,
    line: firstSentence(p.what),
    facts: [],
    story: [
      { text: p.what },
      ...(p.history ? [{ text: p.history }] : []),
      { text: ANATOMY_PROVENANCE.notes, source: { label: t("mu.illustrative") } },
    ],
    art: { kind: "part" as const, partId: p.id },
    hero: true,
  }));
}

// ── Accessories ─────────────────────────────────────────

export function accessoryExhibit(a: Accessory): Exhibit {
  return {
    id: a.id,
    room: "accessories",
    title: a.name,
    year: a.year ?? undefined,
    line: a.line,
    facts: a.facts,
    story: a.story.map((s) => ({ text: s.text, source: { label: s.source, url: s.url } })),
    art: { kind: "accessory", accessoryId: a.id },
    hero: true,
  };
}

// ── The owner's collection ──────────────────────────────

export function collectionExhibit(i: CollectionItem): Exhibit {
  const f = i.serialFacts;
  const v = i.valuations?.[0];
  const facts: Fact[] = [
    ...(i.serial ? [{ label: t("col.glance.serial"), value: i.serial }] : []),
    ...(f?.model ? [{ label: t("mu.f.factory"), value: `${f.model}${f.variant ? `, ${f.variant}` : ""}` }] : []),
    ...(f ? [{ label: t("mu.f.made"), value: f.year.replace("/", t("col.or")) }] : []),
    ...(f?.batchSize ? [{ label: t("mu.f.batch"), value: t("mu.f.batchMade", { n: num(f.batchSize) }) }] : []),
    ...(i.acquired ? [{ label: t("mu.f.since"), value: i.acquired.slice(0, 4) }] : []),
  ];
  const year = f ? Number(f.year.slice(0, 4)) : undefined;
  return {
    id: i.id,
    room: "collection",
    title: i.name,
    year: Number.isFinite(year) ? year : undefined,
    line: [i.serial && `No. ${i.serial}`, f && t("mu.madeLower", { year: f.year.replace("/", t("col.or")) })].filter(Boolean).join(" · ") || t(`col.kind.${i.kind}`),
    facts,
    story: [
      ...(i.notes ? [{ text: i.notes, source: { label: t("mu.ownerNotes") } }] : []),
      ...(f ? [{ text: `${t("col.serial.source", { source: f.source })}.` }] : []),
      ...(v?.range ? [{ text: t("mu.sold", { low: num(v.range.low), high: num(v.range.high), currency: v.range.currency, date: v.at.slice(0, 10) }) }] : []),
    ],
    art: { kind: "item", itemId: i.id },
    hero: false,
    simulate: i.catalogueId ? (i.kind === "body" ? { bodyId: i.catalogueId } : i.kind === "lens" ? { lensId: i.catalogueId } : undefined) : undefined,
    soundBodyId: i.kind === "body" ? i.catalogueId : undefined,
  };
}

// ── Rooms ───────────────────────────────────────────────

const byYear = (a: Exhibit, b: Exhibit) => (a.year ?? 9999) - (b.year ?? 9999) || a.title.localeCompare(b.title);

export function buildRooms(collection: CollectionItem[] = [], accessories: Accessory[] = ACCESSORIES): Room[] {
  const rooms: Room[] = [
    { id: "cameras", title: t("mu.room.cameras"), line: t("mu.room.cameras.line"), exhibits: BODIES.map((b) => cameraExhibit(b)).sort(byYear) },
    { id: "lenses", title: t("mu.room.lenses"), line: t("mu.room.lenses.line"), exhibits: LENSES.filter((l) => l.mount !== "fixed").map((l) => lensExhibit(l)).sort(byYear) },
    { id: "inside", title: t("mu.room.inside"), line: t("mu.room.inside.line"), exhibits: partExhibits() },
    { id: "accessories", title: t("mu.room.accessories"), line: t("mu.room.accessories.line"), exhibits: accessories.map(accessoryExhibit).sort(byYear) },
    { id: "collection", title: t("mu.room.collection"), line: t("mu.room.collection.line"), exhibits: collection.map(collectionExhibit) },
  ];
  return rooms;
}

export function findExhibit(rooms: Room[], roomId: string | undefined, exhibitId: string | undefined): { room: Room; index: number } | null {
  const room = rooms.find((r) => r.id === roomId);
  if (!room) return null;
  const index = exhibitId ? room.exhibits.findIndex((e) => e.id === exhibitId) : 0;
  return { room, index: Math.max(0, index) };
}
