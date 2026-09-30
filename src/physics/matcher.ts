// Which Leica for me? (#45). A few plain questions → a camera and one or two
// lenses from the catalogue, each with the reasons behind it. Only facts the
// catalogue holds are used (medium, finder magnification, frame lines,
// mounts, launch year, maximum aperture, size, ISO range), plus one
// well-known fact written down here: which families focus automatically.
// The catalogue has no prices or weights, so budget and weight aren't asked;
// the page says so and points to a dealer.

import { BODIES, framelinesFor, lensesForBody, findLens, isAdapted, type Body, type Lens } from "../data/gear";

export type Use = "street" | "portrait" | "travel" | "night" | "family" | "architecture";
export const USES: Use[] = ["street", "portrait", "travel", "night", "family", "architecture"];

export interface Answers {
  medium: "film" | "digital" | "either";
  focus: "manual" | "auto" | "either";
  uses: Use[];
  glasses: boolean;
  mono: "only" | "never" | "either";
  era: "classic" | "current" | "either";
}

export const DEFAULT_ANSWERS: Answers = { medium: "either", focus: "either", uses: [], glasses: false, mono: "either", era: "either" };

/** The M10-D and M11-D have no screen on the back, by design (Leica's "D" models); only the M11-D is in the catalogue. */
const NO_REAR_SCREEN = new Set(["m11-d"]);

/** Q, SL, CL and S cameras focus automatically; M cameras are focused by hand with the rangefinder. */
const AUTOFOCUS_FAMILIES = new Set(["Q", "SL", "CL", "S"]);
export const hasAutofocus = (b: Body) => AUTOFOCUS_FAMILIES.has(b.family);

/** The focal lengths each kind of picture usually wants, best first. */
const FOCALS: Record<Use, number[]> = {
  street: [35, 28, 50],
  portrait: [75, 90, 50],
  travel: [35, 28, 50],
  night: [35, 50, 28],
  family: [35, 50, 28],
  architecture: [21, 24, 28],
};

export interface Reason {
  key: string;
  vars?: Record<string, string | number>;
  good: boolean;
}

export interface Pick<T> {
  item: T;
  score: number;
  reasons: Reason[];
}

export interface Match {
  body: Pick<Body>;
  lenses: Pick<Lens>[];
  alternatives: Pick<Body>[];
}

/** How much each focal length is wanted, from the uses (first choices weigh most). */
export function wantedFocals(uses: Use[]): Map<number, number> {
  const w = new Map<number, number>();
  for (const u of uses.length ? uses : (["street", "family"] as Use[])) FOCALS[u].forEach((f, i) => w.set(f, (w.get(f) ?? 0) + (3 - i)));
  return w;
}

function focalFit(focal: number, wanted: Map<number, number>): number {
  let best = 0;
  for (const [f, weight] of wanted) {
    const ratio = Math.abs(Math.log2(focal / f));
    if (ratio < 0.25) best = Math.max(best, weight * (1 - ratio * 2));
  }
  return best;
}

export function eligible(b: Body, a: Answers): boolean {
  if (b.family === "S") return false; // Medium format: a studio system, not a first Leica.
  if (a.medium === "film" && b.medium !== "film") return false;
  if (a.medium === "digital" && b.medium === "film") return false;
  if (a.focus === "auto" && !hasAutofocus(b)) return false;
  if (a.focus === "manual" && hasAutofocus(b)) return false;
  if (a.mono === "only" && b.medium !== "mono" && b.medium !== "film") return false;
  if (a.mono === "never" && b.medium === "mono") return false;
  if (a.era === "classic" && b.year >= 2000) return false;
  if (a.era === "current" && b.year < 2000) return false;
  return true;
}

export function scoreBody(b: Body, a: Answers): Pick<Body> {
  const reasons: Reason[] = [];
  let score = 0;
  const wanted = wantedFocals(a.uses);
  const uses = new Set(a.uses);

  if (b.rangefinder) {
    const m = b.rangefinder.magnification;
    if (a.glasses && m >= 0.85) {
      score -= 3;
      reasons.push({ key: "match.r.glassesHigh", vars: { m }, good: false });
    } else if (a.glasses && m <= 0.73) {
      score += 1;
      reasons.push({ key: "match.r.glassesOk", vars: { m }, good: true });
    }
    // Frame lines for the focal lengths wanted.
    const missing = [...wanted.keys()].filter((f) => (wanted.get(f) ?? 0) >= 3 && f >= 28 && !framelinesFor(b, f));
    if (missing.length) {
      score -= missing.length * 1.5;
      reasons.push({ key: "match.r.noFrames", vars: { focals: missing.sort((x, y) => x - y).join(", ") }, good: false });
    } else reasons.push({ key: "match.r.frames", good: true });
    if (a.focus !== "auto") reasons.push({ key: "match.r.rangefinder", good: true });
  }

  if (b.fixedLensId) {
    const lens = findLens(b.fixedLensId);
    // One lens for everything: it has to be the focal length wanted, not merely near one.
    const fit = focalFit(lens.focalMm, wanted);
    const good = fit >= 2;
    score += good ? fit - 1 : -2;
    reasons.push({ key: good ? "match.r.fixedFits" : "match.r.fixedMisses", vars: { mm: lens.focalMm }, good });
    // One camera, no lens changes: what travel and family pictures reward most.
    if (uses.has("travel") || uses.has("family")) {
      score += 2;
      reasons.push({ key: "match.r.oneBox", good: true });
    }
  }

  if (hasAutofocus(b)) reasons.push({ key: "match.r.autofocus", good: true });
  if (NO_REAR_SCREEN.has(b.id)) {
    score -= 1.5;
    reasons.push({ key: "match.r.noScreen", good: false });
  }
  if (b.medium === "mono") {
    score += a.mono === "only" ? 3 : -1;
    reasons.push({ key: "match.r.mono", good: a.mono === "only" });
  }
  if (b.medium === "film") reasons.push({ key: b.meter === "none" ? "match.r.filmNoMeter" : "match.r.filmMeter", good: b.meter !== "none" || a.era === "classic" });
  if (b.medium === "film" && b.meter === "none" && a.era !== "classic") score -= 1;
  if (uses.has("night") && b.isoRange && b.isoRange[1] >= 50000) {
    score += 1;
    reasons.push({ key: "match.r.highIso", vars: { iso: b.isoRange[1] }, good: true });
  }
  if (b.sensorWidthMm < 30) {
    score -= 1;
    reasons.push({ key: "match.r.apsc", good: false });
  }
  // A little for newer designs, so ties go to the one still easier to service and find.
  score += Math.min(1, (b.year - 1950) / 75);
  return { item: b, score, reasons };
}

export function scoreLens(l: Lens, body: Body, a: Answers): Pick<Lens> {
  const wanted = wantedFocals(a.uses);
  const uses = new Set(a.uses);
  const reasons: Reason[] = [];
  let score = focalFit(l.focalMm, wanted) * 2;
  if (score > 0) reasons.push({ key: "match.l.focal", vars: { mm: l.focalMm }, good: true });
  if (uses.has("night") || uses.has("portrait")) {
    if (l.maxAperture <= 1.4) {
      score += 2;
      reasons.push({ key: uses.has("night") ? "match.l.fastNight" : "match.l.fastPortrait", vars: { f: l.maxAperture }, good: true });
    } else if (l.maxAperture >= 2.8) score -= 1;
  }
  if ((uses.has("travel") || uses.has("street")) && l.look.lengthMm <= 40) {
    score += 1;
    reasons.push({ key: "match.l.small", vars: { mm: l.look.lengthMm }, good: true });
  }
  if (body.rangefinder && !framelinesFor(body, l.focalMm)) {
    score -= 3;
    reasons.push({ key: "match.l.noFrame", vars: { mm: l.focalMm }, good: false });
  }
  // Discontinued lenses lead only for someone after a classic; for others a current one is easier to buy and service.
  if (l.classic) score += a.era === "classic" ? 0.5 : -0.75;
  return { item: l, score, reasons };
}

function lensesFor(body: Body, a: Answers): Pick<Lens>[] {
  const native = lensesForBody(body).filter((l) => !isAdapted(body, l));
  return native.map((l) => scoreLens(l, body, a)).sort((x, y) => y.score - x.score);
}

export function match(a: Answers): Match | null {
  // A camera is only as good a match as the lenses it can take: a quarter of its best lens's score counts (a fixed lens is already in its own score).
  const picks = BODIES.filter((b) => eligible(b, a))
    .map((b) => {
      const p = scoreBody(b, a);
      const best = b.fixedLensId ? 0 : (lensesFor(b, a)[0]?.score ?? 0);
      return { ...p, score: p.score + best / 4 };
    })
    .sort((x, y) => y.score - x.score);
  if (!picks.length) return null;
  const body = picks[0];
  const ranked = lensesFor(body.item, a);
  const lenses: Pick<Lens>[] = [];
  for (const l of ranked) {
    // The second lens should do something the first doesn't.
    if (lenses.length && Math.abs(Math.log2(l.item.focalMm / lenses[0].item.focalMm)) < 0.4) continue;
    lenses.push(l);
    if (lenses.length === (body.item.fixedLensId ? 1 : 2)) break;
  }
  // Alternatives from other families first, so the choice is real.
  const alternatives = picks.slice(1).filter((p) => p.item.family !== body.item.family || p.item.medium !== body.item.medium);
  const rest = picks.slice(1).filter((p) => !alternatives.includes(p));
  return { body, lenses, alternatives: [...alternatives, ...rest].slice(0, 2) };
}
