// Sourced serial facts for a collection item: what the published Leitz/Leica
// serial lists say about a number, with the list named. Pure logic; nothing
// here is guessed, and an AI reading is never mixed in (see aiFindings).

import { BODY_SERIAL_SOURCES, bodyBlock, bodyNotes } from "../data/bodySerials";
import { LENS_SERIAL_SOURCES, lensYear, parseSerial } from "../data/lensSerials";

export interface SerialFacts {
  kind: "body" | "lens";
  /** Bodies only: the model as the list names it. */
  model?: string;
  variant?: string;
  /** As published: "1954", "1957/58", or "1992/1993" where lens ranges overlap. */
  year: string;
  /** Bodies only: the production batch the number sits in. */
  batchFrom?: number;
  batchTo?: number;
  batchSize?: number;
  /** Catalogue body id when the simulator knows the model. */
  bodyId?: string;
  source: string;
  notes: string[];
}

export type SerialLookup = { status: "found"; facts: SerialFacts } | { status: "unknown"; reason: string } | { status: "invalid" };

const fmt = (n: number) => n.toLocaleString("en-GB");

function bodySource(model: string): string {
  if (model === "M5") return BODY_SERIAL_SOURCES.find((s) => s.label.includes("M5"))!.label;
  return BODY_SERIAL_SOURCES[0].label;
}

export function lookupSerialFacts(kind: "body" | "lens", text: string): SerialLookup {
  const serial = parseSerial(text);
  if (serial === null) return { status: "invalid" };

  if (kind === "body") {
    const b = bodyBlock(serial);
    if (!b) return { status: "unknown", reason: `No. ${fmt(serial)} isn't in the sourced body lists (1954–1965 and the M5).` };
    return {
      status: "found",
      facts: {
        kind,
        model: b.model,
        variant: b.variant,
        year: b.year,
        batchFrom: b.from,
        batchTo: b.to,
        batchSize: b.to - b.from + 1,
        bodyId: b.bodyId,
        source: bodySource(b.model),
        notes: bodyNotes(serial, b),
      },
    };
  }

  const a = lensYear(serial);
  if (a.kind === "years") {
    const years = [...new Set(a.ranges.map((r) => r.year))].sort();
    return { status: "found", facts: { kind, year: years.join("/"), source: LENS_SERIAL_SOURCES.map((s) => s.label).join("; "), notes: [] } };
  }
  const reason =
    a.kind === "gap"
      ? `No. ${fmt(serial)} falls in a gap between the published ${a.before.year} and ${a.after.year} ranges.`
      : a.kind === "before"
        ? `No. ${fmt(serial)} is lower than the first published lens range (1933).`
        : a.kind === "after"
          ? `No. ${fmt(serial)} is past the published lens tables (they end in ${a.last.year}).`
          : `No. ${fmt(serial)} isn't a lens serial the tables can read.`;
  return { status: "unknown", reason };
}

/** "1954", "1957/58", "1971–1975", "1992/1993" → first and last year. */
function yearSpan(year: string): [number, number] | null {
  const m = year.match(/^(\d{4})(?:\s*[/–-]\s*(\d{2,4}))?/);
  if (!m) return null;
  const a = Number(m[1]);
  const b = m[2] ? Number(m[2].length === 2 ? m[1].slice(0, 2) + m[2] : m[2]) : a;
  return [a, b];
}

const norm = (s: string) => s.toLowerCase().replace(/\bleica\b|\bleitz\b/g, "").replace(/[\s-]+/g, " ").trim();

function sameModel(listed: string, claimed: string): boolean {
  const c = norm(claimed);
  if (!c) return true;
  return listed.split(/\s+and\s+/).some((m) => {
    const l = norm(m);
    return new RegExp(`(^|\\s)${l.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\s|$)`).test(c) || c === l;
  });
}

/** Where a claim (from a seller, or an AI reading) disagrees with the serial list. */
export function serialConflicts(facts: SerialFacts, claim: { model?: string | null; year?: string | number | null }): string[] {
  const out: string[] = [];
  if (facts.model && claim.model && !sameModel(facts.model, claim.model))
    out.push(`The serial list has this number as ${facts.model}${facts.variant ? ` (${facts.variant})` : ""}, not ${claim.model}.`);
  const claimed = claim.year != null ? yearSpan(String(claim.year)) : null;
  const listed = yearSpan(facts.year);
  if (claimed && listed && (claimed[1] < listed[0] || claimed[0] > listed[1])) out.push(`The serial list dates this number to ${facts.year}, not ${claim.year}.`);
  return out;
}

/** Batch size as a plain fact. It counts cameras made, not cameras surviving. */
export function rarityNote(facts: SerialFacts): string | null {
  if (!facts.batchSize || !facts.model) return null;
  return `Batch of ${fmt(facts.batchSize)} ${facts.model}${facts.variant ? `, ${facts.variant}` : ""}, ${facts.year} (No. ${fmt(facts.batchFrom!)}–${fmt(facts.batchTo!)}).`;
}
