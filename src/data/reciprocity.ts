// Reciprocity failure (#53): how much longer than metered a film needs in
// long exposures, as the film makers publish it. Ilford gives a power law
// (corrected = metered^p, for metered times over one second); Kodak and
// Fujifilm give tables, followed here point to point in log time. Beyond the
// last published point the page says so instead of extrapolating. Check
// against the current datasheets before a critical exposure.

export type Reciprocity =
  | { kind: "power"; p: number; from: number; source: string }
  | { kind: "table"; points: [metered: number, corrected: number][]; upTo: number; source: string }
  | { kind: "none"; upTo: number; source: string };

/** By the app's film ids, plus other common films by name. */
export const RECIPROCITY: Record<string, { name: string; model: Reciprocity }> = {
  hp5: { name: "HP5 Plus", model: { kind: "power", p: 1.31, from: 1, source: "HARMAN technology (Ilford), Reciprocity law failure compensation" } },
  delta3200: { name: "Delta 3200", model: { kind: "power", p: 1.33, from: 1, source: "HARMAN technology (Ilford), Reciprocity law failure compensation" } },
  fp4: { name: "FP4 Plus", model: { kind: "power", p: 1.26, from: 1, source: "HARMAN technology (Ilford), Reciprocity law failure compensation" } },
  panf: { name: "Pan F Plus", model: { kind: "power", p: 1.33, from: 1, source: "HARMAN technology (Ilford), Reciprocity law failure compensation" } },
  delta100: { name: "Delta 100", model: { kind: "power", p: 1.26, from: 1, source: "HARMAN technology (Ilford), Reciprocity law failure compensation" } },
  delta400: { name: "Delta 400", model: { kind: "power", p: 1.41, from: 1, source: "HARMAN technology (Ilford), Reciprocity law failure compensation" } },
  trix400: {
    name: "Tri-X 400",
    model: {
      kind: "table",
      // Kodak: 1 s needs +1 stop (2 s), 10 s needs +2 stops (50 s), 100 s needs +3 stops (1,200 s); none at 1/10 s and faster.
      points: [
        [0.1, 0.1],
        [1, 2],
        [10, 50],
        [100, 1200],
      ],
      upTo: 100,
      source: "Kodak Alaris, TRI-X 320 and 400 technical data F-4017",
    },
  },
  velvia50: {
    name: "Velvia 50",
    model: {
      kind: "table",
      // Fujifilm: +1/3 stop at 4 s, +1/2 at 8 s, +2/3 at 16 s, +1 at 32 s; longer is not recommended.
      points: [
        [1, 1],
        [4, 4 * 2 ** (1 / 3)],
        [8, 8 * 2 ** (1 / 2)],
        [16, 16 * 2 ** (2 / 3)],
        [32, 64],
      ],
      upTo: 32,
      source: "Fujifilm, FUJICHROME Velvia 50 data sheet",
    },
  },
  portra400: { name: "Portra 400", model: { kind: "none", upTo: 1, source: "Kodak Alaris, PORTRA 400 technical data E-4050" } },
  ektar100: { name: "Ektar 100", model: { kind: "none", upTo: 1, source: "Kodak Alaris, EKTAR 100 technical data E-4046" } },
};

export type Correction = { ok: true; seconds: number; stops: number } | { ok: false; reason: "beyond" | "unknown"; upTo?: number };

/** The time to give for a metered time, on this film. */
export function correct(filmKey: string, metered: number): Correction {
  const entry = RECIPROCITY[filmKey];
  if (!entry) return { ok: false, reason: "unknown" };
  const m = entry.model;
  if (m.kind === "none") return metered <= m.upTo ? { ok: true, seconds: metered, stops: 0 } : { ok: false, reason: "beyond", upTo: m.upTo };
  if (m.kind === "power") {
    const s = metered <= m.from ? metered : metered ** m.p;
    return { ok: true, seconds: s, stops: Math.log2(s / metered) };
  }
  const pts = m.points;
  if (metered <= pts[0][0]) return { ok: true, seconds: metered, stops: 0 };
  if (metered > m.upTo) return { ok: false, reason: "beyond", upTo: m.upTo };
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    if (metered <= x1) {
      const f = Math.log(metered / x0) / Math.log(x1 / x0);
      const s = Math.exp(Math.log(y0) + f * Math.log(y1 / y0));
      return { ok: true, seconds: s, stops: Math.log2(s / metered) };
    }
  }
  return { ok: false, reason: "beyond", upTo: m.upTo };
}
