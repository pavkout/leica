// "At a glance" for a checked listing: the three things a buyer wants first
// (does the serial fit, any warning signs, is the price fair), one line each.
// Pure logic, from the checked report and the factory serial lists.

import type { ListingReport } from "../services/ai/schemas";
import { askingNote, askingPosition } from "./market";
import { lookupSerialFacts, serialConflicts } from "./serialFacts";

export type GlanceMark = "good" | "warn" | "none";

export interface GlanceLine {
  label: string;
  mark: GlanceMark;
  text: string;
}

export function listingGlance(r: ListingReport): GlanceLine[] {
  const kind = r.kind === "body" || r.kind === "lens" ? r.kind : null;
  let serial: { mark: GlanceMark; text: string };
  if (!r.statedSerial || !kind) serial = { mark: "none", text: "Not shown in the listing. Ask the seller for a clear photo of it." };
  else {
    const found = lookupSerialFacts(kind, r.statedSerial);
    if (found.status !== "found") serial = { mark: "none", text: "Not in the factory lists we have, so it can't be checked." };
    else if (serialConflicts(found.facts, { model: r.model, year: r.statedYear }).length) serial = { mark: "warn", text: "Doesn't match what the seller says. See below." };
    else serial = { mark: "good", text: found.facts.model ? `Matches: a Leica ${found.facts.model} made in ${found.facts.year}.` : `Fits a lens made in ${found.facts.year}.` };
  }
  const flags = r.redFlags.length;
  const note = askingNote(r.asking, r.price.range);
  const price: { mark: GlanceMark; text: string } = note
    ? { mark: askingPosition(r.asking, r.price.range) === "within" ? "good" : "warn", text: note }
    : { mark: "none", text: r.price.range ? "No asking price found to compare." : "Not enough similar sales to compare." };
  return [
    { label: "Serial number", ...serial },
    { label: "Warning signs", mark: flags ? "warn" : "good", text: flags ? `${flags} found. See below.` : "None found." },
    { label: "Price", ...price },
  ];
}
