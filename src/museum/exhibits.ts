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
  if (b.medium === "film") return "35 mm film";
  const mp = `${Math.max(...(b.megapixels ?? [0]))} MP`;
  const format = b.family === "S" ? "medium format" : b.sensorWidthMm < 30 ? "APS-C" : "full frame";
  return `${mp} ${format}${b.medium === "mono" ? ", black and white only" : ""}`;
}

function finderLine(b: Body): string {
  if (b.rangefinder) return `${b.rangefinder.magnification.toFixed(2)}× rangefinder`;
  if (b.family === "S") return "reflex finder";
  return "electronic finder";
}

function meterLine(b: Body): string {
  if (b.meter === "none") return "no meter";
  if (b.meter === "leds") return b.autoExposure ? "LED meter, auto exposure" : "LED meter";
  return b.autoExposure ? "metering, auto exposure" : "metering";
}

function familyLine(b: Body): string {
  switch (b.family) {
    case "M film":
      return "M rangefinder, film";
    case "M digital":
      return "M rangefinder, digital";
    case "Q":
      return "Q, fixed lens";
    case "SL":
      return "SL, mirrorless";
    case "CL":
      return "CL, mirrorless";
    case "S":
      return "S, medium format";
  }
}

export function cameraTitle(b: Body): string {
  return `Leica ${b.name}`;
}

export function cameraExhibit(b: Body, content: TimelineContent = TIMELINE_CONTENT): Exhibit {
  const frames = b.rangefinder ? [...new Set(b.rangefinder.frameSets.flat())].sort((x, y) => x - y) : [];
  const facts: Fact[] = [
    { label: "Introduced", value: String(b.year) },
    { label: "Kind", value: familyLine(b) },
    { label: "Captures on", value: capture(b) },
    { label: "Shutter", value: `${formatShutter(b.shutter.slowest)} to ${formatShutter(b.shutter.fastest)}` },
    { label: "Finder", value: b.rangefinder ? `Rangefinder, ${b.rangefinder.magnification}× magnification` : finderLine(b).replace(/^./, (c) => c.toUpperCase()) },
    ...(frames.length ? [{ label: "Frame lines", value: `${frames.join(", ")} mm` }] : []),
    { label: "Light meter", value: b.meter === "none" ? "None" : b.meter === "leds" ? "LEDs in the finder" : "Built in" },
    ...(b.isoRange ? [{ label: "ISO", value: `${b.isoRange[0]} to ${b.isoRange[1].toLocaleString("en-GB")}` }] : []),
    { label: "Lens mount", value: b.fixedLensId ? "Fixed lens" : b.mounts.join(", ") },
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

const metres = (mm: number) => `${(mm / 1000).toLocaleString("en-GB", { maximumFractionDigits: 2 })} m`;

function generations(l: Lens): StoryPart | null {
  const fam = LENS_FAMILIES.find((f) => f.revisions.some((r) => r.lensId === l.id));
  if (!fam || fam.revisions.length < 2) return null;
  const list = fam.revisions
    .map((r) => {
      const lens = LENSES.find((x) => x.id === r.lensId);
      return lens ? `${r.label} (${lens.year})` : r.label;
    })
    .join(", ");
  return { text: `One of ${fam.revisions.length} generations of the ${fam.name}: ${list}.` };
}

export function lensExhibit(l: Lens, content: TimelineContent = TIMELINE_CONTENT): Exhibit {
  const gen = generations(l);
  const facts: Fact[] = [
    { label: "Introduced", value: String(l.year) },
    { label: "Focal length", value: `${l.focalMm} mm` },
    { label: "Widest aperture", value: formatFNumber(l.maxAperture) },
    { label: "Smallest aperture", value: formatFNumber(l.minAperture) },
    { label: "Focuses down to", value: metres(l.minFocusMm) },
    ...(l.apertureBlades ? [{ label: "Aperture blades", value: String(l.apertureBlades) }] : []),
    { label: "Mount", value: l.mount === "fixed" ? "Built into the camera" : `Leica ${l.mount}` },
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
      { text: ANATOMY_PROVENANCE.notes, source: { label: "Illustrative drawing" } },
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
    ...(i.serial ? [{ label: "Serial number", value: i.serial }] : []),
    ...(f?.model ? [{ label: "Factory list", value: `${f.model}${f.variant ? `, ${f.variant}` : ""}` }] : []),
    ...(f ? [{ label: "Made", value: f.year.replace("/", " or ") }] : []),
    ...(f?.batchSize ? [{ label: "Batch", value: `${f.batchSize.toLocaleString("en-GB")} made` }] : []),
    ...(i.acquired ? [{ label: "In the collection since", value: i.acquired.slice(0, 4) }] : []),
  ];
  const year = f ? Number(f.year.slice(0, 4)) : undefined;
  return {
    id: i.id,
    room: "collection",
    title: i.name,
    year: Number.isFinite(year) ? year : undefined,
    line: [i.serial && `No. ${i.serial}`, f && `made ${f.year.replace("/", " or ")}`].filter(Boolean).join(" · ") || (i.kind === "body" ? "Camera" : i.kind === "lens" ? "Lens" : "Accessory"),
    facts,
    story: [
      ...(i.notes ? [{ text: i.notes, source: { label: "The owner's notes" } }] : []),
      ...(f ? [{ text: `From the factory serial list: ${f.source}.` }] : []),
      ...(v?.range ? [{ text: `Similar items sold for ${v.range.low.toLocaleString("en-GB")} to ${v.range.high.toLocaleString("en-GB")} ${v.range.currency} (checked ${v.at.slice(0, 10)}).` }] : []),
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
    { id: "cameras", title: "Cameras", line: "From the M3 of 1954 to today.", exhibits: BODIES.map((b) => cameraExhibit(b)).sort(byYear) },
    { id: "lenses", title: "Lenses", line: "The glass: Summicron, Summilux, Noctilux and more.", exhibits: LENSES.filter((l) => l.mount !== "fixed").map((l) => lensExhibit(l)).sort(byYear) },
    { id: "inside", title: "Inside the camera", line: "How a rangefinder works, part by part.", exhibits: partExhibits() },
    { id: "accessories", title: "Accessories", line: "Finders, meters and the tools around the camera.", exhibits: accessories.map(accessoryExhibit).sort(byYear) },
    { id: "collection", title: "Your collection", line: "The pieces you own.", exhibits: collection.map(collectionExhibit) },
  ];
  return rooms;
}

export function findExhibit(rooms: Room[], roomId: string | undefined, exhibitId: string | undefined): { room: Room; index: number } | null {
  const room = rooms.find((r) => r.id === roomId);
  if (!room) return null;
  const index = exhibitId ? room.exhibits.findIndex((e) => e.id === exhibitId) : 0;
  return { room, index: Math.max(0, index) };
}
