// "At a glance" for a checked listing: the three things a buyer wants first
// (does the serial fit, any warning signs, is the price fair), one line each.
// Pure logic, from the checked report and the factory serial lists.

import type { ListingReport } from "../services/ai/schemas";
import { askingNote, askingPosition } from "./market";
import { lookupSerialFacts, serialConflicts } from "./serialFacts";
import { t, tn } from "../i18n";

export type GlanceMark = "good" | "warn" | "none";

export interface GlanceLine {
  label: string;
  mark: GlanceMark;
  text: string;
}

export function listingGlance(r: ListingReport): GlanceLine[] {
  const kind = r.kind === "body" || r.kind === "lens" ? r.kind : null;
  let serial: { mark: GlanceMark; text: string };
  if (!r.statedSerial || !kind) serial = { mark: "none", text: t("col.glance.serial.none") };
  else {
    const found = lookupSerialFacts(kind, r.statedSerial);
    if (found.status !== "found") serial = { mark: "none", text: t("col.glance.serial.unlisted") };
    else if (serialConflicts(found.facts, { model: r.model, year: r.statedYear }).length) serial = { mark: "warn", text: t("col.glance.serial.conflict") };
    else serial = { mark: "good", text: found.facts.model ? t("col.glance.serial.body", { model: found.facts.model, year: found.facts.year }) : t("col.glance.serial.lens", { year: found.facts.year }) };
  }
  const flags = r.redFlags.length;
  const note = askingNote(r.asking, r.price.range);
  const price: { mark: GlanceMark; text: string } = note
    ? { mark: askingPosition(r.asking, r.price.range) === "within" ? "good" : "warn", text: note }
    : { mark: "none", text: r.price.range ? t("col.glance.price.noAsking") : t("col.glance.price.noSales") };
  return [
    { label: t("col.glance.serial"), ...serial },
    { label: t("col.glance.flags"), mark: flags ? "warn" : "good", text: flags ? tn("col.glance.flagsFound", flags) : t("col.glance.flagsNone") },
    { label: t("col.glance.price"), ...price },
  ];
}
