// Camera birthdays (#63): a camera or lens turning 50 this year, or a year
// with you today. The year it was made comes from the published serial lists
// (a year, never a day, and sometimes a range like "1957/58", which is read
// as "about"); the day you got it comes from your own record.

import type { CollectionItem } from "./collection";

export type Birthday =
  | { kind: "made"; item: CollectionItem; years: number; year: number; approx: boolean }
  | { kind: "owned"; item: CollectionItem; years: number; date: string; inDays: number };

/** A made-year age worth marking: 1, 5, 10, 25, and every ten after. */
export const isMilestone = (years: number) => years === 1 || years === 5 || years === 25 || years === 75 || (years >= 10 && years % 10 === 0);

/** The earliest year a published year string names, and whether it's a range. */
export function madeYear(year: string | undefined): { year: number; approx: boolean } | null {
  const m = year?.match(/\d{4}/);
  if (!m) return null;
  return { year: Number(m[0]), approx: /[/–-]/.test(year!) };
}

const DAY = 86_400_000;

/** Days from `today` until this year's anniversary of `date` ("YYYY-MM-DD"); negative once it's passed. */
function daysToAnniversary(date: string, today: Date): { inDays: number; years: number } | null {
  const [y, mo, d] = date.split("-").map(Number);
  if (!y || !mo || !d) return null;
  const year = today.getFullYear();
  // 29 February is marked on 28 February in other years.
  const day = mo === 2 && d === 29 && new Date(year, 1, 29).getMonth() !== 1 ? 28 : d;
  const start = new Date(year, today.getMonth(), today.getDate());
  const inDays = Math.round((new Date(year, mo - 1, day).getTime() - start.getTime()) / DAY);
  return { inDays, years: year - y };
}

/**
 * The birthdays to mark around `today`: every milestone age this year from
 * the serial list, and every anniversary of getting it from `back` days ago
 * to `ahead` days on.
 */
export function birthdays(items: CollectionItem[], today: Date, ahead = 7, back = 1): Birthday[] {
  const out: Birthday[] = [];
  for (const item of items) {
    const made = madeYear(item.serialFacts?.year);
    if (made) {
      const years = today.getFullYear() - made.year;
      if (years > 0 && isMilestone(years)) out.push({ kind: "made", item, years, year: made.year, approx: made.approx });
    }
    if (item.acquired) {
      const a = daysToAnniversary(item.acquired, today);
      if (a && a.years > 0 && a.inDays >= -back && a.inDays <= ahead) out.push({ kind: "owned", item, years: a.years, date: item.acquired, inDays: a.inDays });
    }
  }
  // Anniversaries (today first) before the year's milestones, oldest cameras first.
  return out.sort((x, y) => (x.kind === y.kind ? (x.kind === "owned" ? Math.abs(x.inDays) - Math.abs((y as typeof x).inDays) : y.years - x.years) : x.kind === "owned" ? -1 : 1));
}

/** A stable id per birthday and year, for "seen it" dismissals. */
export const birthdayId = (b: Birthday, today: Date) => `${b.item.id}:${b.kind}:${today.getFullYear()}`;
