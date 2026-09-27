// Lens generations / collector mode (feature #24). Families group catalogue
// lenses that are generations of the same line. Everything shown per
// revision comes from the lens catalogue (gear.ts); this file only groups and
// labels — it adds no specs, dates or history. A revision label is taken from
// the catalogue name and launch year; aliases are colloquial names people
// actually use for a lens or family.

import { LENSES, type Lens } from "./gear";

export interface LensRevision {
  /** Catalogue lens id — the revision's specs come from the catalogue entry. */
  lensId: string;
  revisionId: string;
  /** Short label, from the catalogue name. */
  label: string;
  aliases: string[];
}

export interface LensFamily {
  lensFamilyId: string;
  name: string;
  aliases: string[];
  /** Oldest first. */
  revisions: LensRevision[];
}

export const LENS_FAMILIES: LensFamily[] = [
  {
    lensFamilyId: "summicron-35",
    name: "35 mm Summicron",
    aliases: ["Summicron 35", "Cron 35"],
    revisions: [
      { lensId: "m-35-2-8e", revisionId: "summicron-35-8e", label: "8 elements", aliases: ["8-element", "King of bokeh"] },
      { lensId: "m-35-2", revisionId: "summicron-35-asph", label: "ASPH.", aliases: ["Summicron 35 ASPH"] },
      { lensId: "m-35-2-apo", revisionId: "summicron-35-apo", label: "APO ASPH.", aliases: ["APO 35"] },
    ],
  },
  {
    lensFamilyId: "summilux-35",
    name: "35 mm Summilux",
    aliases: ["Summilux 35", "Lux 35"],
    revisions: [
      { lensId: "m-35-1.4-pre", revisionId: "summilux-35-pre", label: "pre-ASPH", aliases: ["pre-ASPH 35 Lux"] },
      { lensId: "m-35-1.4", revisionId: "summilux-35-asph", label: "ASPH.", aliases: ["Summilux 35 ASPH"] },
    ],
  },
  {
    lensFamilyId: "summicron-50",
    name: "50 mm Summicron",
    aliases: ["Summicron 50", "Cron 50"],
    revisions: [
      { lensId: "m-50-2-rigid", revisionId: "summicron-50-rigid", label: "rigid", aliases: ["Rigid Summicron"] },
      { lensId: "m-50-2", revisionId: "summicron-50-m", label: "Summicron-M", aliases: ["Summicron-M 50"] },
      { lensId: "m-50-2-apo", revisionId: "summicron-50-apo", label: "APO ASPH.", aliases: ["APO 50"] },
    ],
  },
  {
    lensFamilyId: "summilux-50",
    name: "50 mm Summilux",
    aliases: ["Summilux 50", "Lux 50"],
    revisions: [
      { lensId: "m-50-1.4-pre", revisionId: "summilux-50-pre", label: "pre-ASPH", aliases: ["pre-ASPH 50 Lux"] },
      { lensId: "m-50-1.4", revisionId: "summilux-50-asph", label: "ASPH.", aliases: ["Summilux 50 ASPH"] },
    ],
  },
  {
    lensFamilyId: "noctilux-50",
    name: "50 mm Noctilux",
    aliases: ["Noctilux", "Nocti"],
    revisions: [
      { lensId: "m-50-1.0", revisionId: "noctilux-50-f1", label: "f/1.0", aliases: ["Nocti f/1"] },
      { lensId: "m-50-0.95", revisionId: "noctilux-50-f095", label: "f/0.95 ASPH.", aliases: ["Nocti 0.95"] },
      { lensId: "m-50-1.2", revisionId: "noctilux-50-f12", label: "f/1.2 ASPH. (reissue)", aliases: ["Nocti 1.2"] },
    ],
  },
];

export function lensOf(revision: LensRevision): Lens {
  const l = LENSES.find((x) => x.id === revision.lensId);
  if (!l) throw new Error(`Lens family revision ${revision.revisionId}: unknown lens ${revision.lensId}`);
  return l;
}

/** The family a catalogue lens belongs to, if any. */
export function familyOf(lensId: string): LensFamily | undefined {
  return LENS_FAMILIES.find((f) => f.revisions.some((r) => r.lensId === lensId));
}

/** Find a family or revision by an alias or name, case-insensitively. */
export function findByAlias(query: string): { family: LensFamily; revision?: LensRevision } | undefined {
  const q = query.trim().toLowerCase();
  for (const family of LENS_FAMILIES) {
    const rev = family.revisions.find((r) => r.aliases.some((a) => a.toLowerCase() === q) || lensOf(r).name.toLowerCase() === q);
    if (rev) return { family, revision: rev };
    if (family.name.toLowerCase() === q || family.aliases.some((a) => a.toLowerCase() === q)) return { family };
  }
  return undefined;
}

/**
 * Data problems that would make revisions incomparable: unknown lens ids,
 * mixed focal lengths or mounts within a family (inconsistent spec units),
 * a lens in two families, duplicate ids or aliases, revisions out of order.
 */
export function familyDataProblems(families: LensFamily[] = LENS_FAMILIES): string[] {
  const problems: string[] = [];
  const seenLens = new Map<string, string>();
  const seenIds = new Set<string>();
  const seenAliases = new Set<string>();
  for (const f of families) {
    if (seenIds.has(f.lensFamilyId)) problems.push(`duplicate family id ${f.lensFamilyId}`);
    seenIds.add(f.lensFamilyId);
    if (f.revisions.length < 2) problems.push(`${f.lensFamilyId}: a family needs at least two revisions`);
    const lenses = f.revisions.map((r) => LENSES.find((l) => l.id === r.lensId));
    f.revisions.forEach((r, i) => {
      if (!lenses[i]) problems.push(`${r.revisionId}: unknown lens ${r.lensId}`);
      if (seenIds.has(r.revisionId)) problems.push(`duplicate revision id ${r.revisionId}`);
      seenIds.add(r.revisionId);
      const other = seenLens.get(r.lensId);
      if (other) problems.push(`${r.lensId} is in both ${other} and ${f.lensFamilyId}`);
      seenLens.set(r.lensId, f.lensFamilyId);
      for (const a of r.aliases) {
        const k = a.toLowerCase();
        if (seenAliases.has(k)) problems.push(`duplicate alias "${a}"`);
        seenAliases.add(k);
      }
    });
    for (const a of f.aliases) {
      const k = a.toLowerCase();
      if (seenAliases.has(k)) problems.push(`duplicate alias "${a}"`);
      seenAliases.add(k);
    }
    const known = lenses.filter((l): l is Lens => !!l);
    if (new Set(known.map((l) => l.focalMm)).size > 1) problems.push(`${f.lensFamilyId}: revisions have different focal lengths`);
    if (new Set(known.map((l) => l.mount)).size > 1) problems.push(`${f.lensFamilyId}: revisions have different mounts`);
    for (let i = 1; i < known.length; i++) if (known[i].year < known[i - 1].year) problems.push(`${f.lensFamilyId}: revisions not in launch order`);
  }
  return problems;
}
