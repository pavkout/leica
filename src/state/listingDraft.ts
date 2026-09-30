// Sell it well (#59): an honest sale listing from what the app knows about a
// piece: the owner's record, what the published serial lists say, its
// passport's history, and a condition description (the owner's, or an AI's
// factual notes). Pure logic, written in the reader's language through `t`.

import type { CollectionItem } from "./collection";
import type { Passport } from "./passport";
import { timeline } from "./passport";
import type { ConditionReport } from "../services/ai/schemas";

type T = (key: string, vars?: Record<string, string | number>) => string;

export interface DraftInput {
  item: CollectionItem;
  passport?: Passport;
  fingerprint?: string;
  condition?: ConditionReport | null;
  ownNotes?: string;
  included?: string;
}

export interface Draft {
  title: string;
  body: string;
}

export function listingDraft(d: DraftInput, t: T, date: (iso: string) => string): Draft {
  const { item, passport } = d;
  const f = item.serialFacts;
  const title = [item.name, item.serial && `No. ${item.serial}`, f?.year].filter(Boolean).join(" · ");
  const lines: string[] = [];

  lines.push(t("sell.d.about"));
  if (f?.model) lines.push(`• ${t("sell.d.serialBody", { model: f.model, year: f.year })}`);
  else if (f) lines.push(`• ${t("sell.d.serialLens", { year: f.year })}`);
  if (item.acquired) lines.push(`• ${t("sell.d.owned", { date: date(item.acquired) })}`);

  const events = passport ? timeline(passport) : [];
  const services = events.filter((e) => e.type === "service" || e.type === "repair");
  if (services.length || events.some((e) => e.type === "health")) {
    lines.push("", t("sell.d.history"));
    for (const e of services) lines.push(`• ${date(e.date)}: ${e.title}${e.by ? ` (${e.by})` : ""}`);
    const health = events.filter((e) => e.type === "health").pop();
    if (health?.health) lines.push(`• ${date(health.date)}: ${t("sell.d.health", { verdict: t(`health.verdict.${health.health.verdict}`) })}`);
  }

  const c = d.condition;
  if (c || d.ownNotes?.trim()) {
    lines.push("", t("sell.d.condition"));
    if (d.ownNotes?.trim()) lines.push(d.ownNotes.trim());
    if (c) {
      if (c.summary) lines.push(c.summary);
      for (const x of c.cosmetic) lines.push(`• ${x}`);
      if (c.glass) lines.push(`• ${t("sell.d.glass")}: ${c.glass}`);
      for (const x of c.mechanical) lines.push(`• ${x}`);
      if (c.notVisible.length) lines.push(t("sell.d.notShown", { list: c.notVisible.join("; ") }));
    }
  }

  if (d.included?.trim()) lines.push("", t("sell.d.included"), d.included.trim());
  if (passport && passport.entries.length) lines.push("", t("sell.d.passport", { n: passport.entries.length, code: d.fingerprint ?? "" }));
  lines.push("", t("sell.d.questions"));
  return { title, body: lines.join("\n") };
}

/** The guided photos a buyer wants to see, in order. */
export const SELL_SHOTS = ["front", "back", "top", "bottom", "glass", "serial"] as const;
export type SellShot = (typeof SELL_SHOTS)[number];
