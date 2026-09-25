// Leica bodies and lenses.
//
// Specs are taken from public product information and should be checked
// against Leica's current datasheets before relying on them. Aperture-blade
// counts are left out until the bokeh preview (which needs them) is built
// and they can be verified.

export type Mount = "M" | "L" | "TL" | "S" | "fixed";

export interface Body {
  id: string;
  name: string;
  sensorWidthMm: number;
  sensorHeightMm: number;
  /** Selectable output resolutions in megapixels; `null` for film. */
  megapixels: number[] | null;
  /** Lens mounts the body takes natively. */
  mounts: Mount[];
  /** Mounts usable through an adapter (e.g. M lenses on L-mount bodies). */
  adaptedMounts?: Mount[];
  /** For fixed-lens cameras. */
  fixedLensId?: string;
  /** Digital crop framings (as equivalent focal lengths) on fixed-lens bodies. */
  cropFocalLengths?: number[];
}

export interface Lens {
  id: string;
  name: string;
  mount: Mount;
  focalMm: number;
  maxAperture: number;
  minAperture: number;
  minFocusMm: number;
}

export const BODIES: Body[] = [
  { id: "m11", name: "M11", sensorWidthMm: 36, sensorHeightMm: 24, megapixels: [60, 36, 18], mounts: ["M"] },
  { id: "m11-mono", name: "M11 Monochrom", sensorWidthMm: 36, sensorHeightMm: 24, megapixels: [60, 36, 18], mounts: ["M"] },
  { id: "m10-r", name: "M10-R", sensorWidthMm: 36, sensorHeightMm: 24, megapixels: [40], mounts: ["M"] },
  { id: "m10", name: "M10", sensorWidthMm: 36, sensorHeightMm: 24, megapixels: [24], mounts: ["M"] },
  { id: "m6", name: "M6 (35mm film)", sensorWidthMm: 36, sensorHeightMm: 24, megapixels: null, mounts: ["M"] },
  {
    id: "q3", name: "Q3", sensorWidthMm: 36, sensorHeightMm: 24, megapixels: [60, 36, 18], mounts: ["fixed"],
    fixedLensId: "q3-28", cropFocalLengths: [28, 35, 50, 75, 90],
  },
  {
    id: "q3-43", name: "Q3 43", sensorWidthMm: 36, sensorHeightMm: 24, megapixels: [60, 36, 18], mounts: ["fixed"],
    fixedLensId: "q3-43", cropFocalLengths: [43, 60, 75, 150],
  },
  { id: "sl3", name: "SL3", sensorWidthMm: 36, sensorHeightMm: 24, megapixels: [60, 36, 18], mounts: ["L"], adaptedMounts: ["M"] },
  { id: "cl", name: "CL (APS-C)", sensorWidthMm: 23.6, sensorHeightMm: 15.6, megapixels: [24], mounts: ["TL", "L"], adaptedMounts: ["M"] },
  { id: "s3", name: "S3 (medium format)", sensorWidthMm: 45, sensorHeightMm: 30, megapixels: [64], mounts: ["S"] },
];

export const LENSES: Lens[] = [
  // M
  { id: "m-21-3.4", name: "Super-Elmar-M 21 f/3.4 ASPH.", mount: "M", focalMm: 21, maxAperture: 3.4, minAperture: 16, minFocusMm: 700 },
  { id: "m-28-5.6", name: "Summaron-M 28 f/5.6", mount: "M", focalMm: 28, maxAperture: 5.6, minAperture: 22, minFocusMm: 1000 },
  { id: "m-28-2.8", name: "Elmarit-M 28 f/2.8 ASPH.", mount: "M", focalMm: 28, maxAperture: 2.8, minAperture: 16, minFocusMm: 700 },
  { id: "m-28-2", name: "Summicron-M 28 f/2 ASPH.", mount: "M", focalMm: 28, maxAperture: 2, minAperture: 16, minFocusMm: 700 },
  { id: "m-35-2", name: "Summicron-M 35 f/2 ASPH.", mount: "M", focalMm: 35, maxAperture: 2, minAperture: 16, minFocusMm: 700 },
  { id: "m-35-2-apo", name: "APO-Summicron-M 35 f/2 ASPH.", mount: "M", focalMm: 35, maxAperture: 2, minAperture: 16, minFocusMm: 300 },
  { id: "m-35-1.4", name: "Summilux-M 35 f/1.4 ASPH.", mount: "M", focalMm: 35, maxAperture: 1.4, minAperture: 16, minFocusMm: 400 },
  { id: "m-50-2", name: "Summicron-M 50 f/2", mount: "M", focalMm: 50, maxAperture: 2, minAperture: 16, minFocusMm: 700 },
  { id: "m-50-2-apo", name: "APO-Summicron-M 50 f/2 ASPH.", mount: "M", focalMm: 50, maxAperture: 2, minAperture: 16, minFocusMm: 700 },
  { id: "m-50-1.4", name: "Summilux-M 50 f/1.4 ASPH.", mount: "M", focalMm: 50, maxAperture: 1.4, minAperture: 16, minFocusMm: 450 },
  { id: "m-50-0.95", name: "Noctilux-M 50 f/0.95 ASPH.", mount: "M", focalMm: 50, maxAperture: 0.95, minAperture: 16, minFocusMm: 1000 },
  { id: "m-75-2-apo", name: "APO-Summicron-M 75 f/2 ASPH.", mount: "M", focalMm: 75, maxAperture: 2, minAperture: 16, minFocusMm: 700 },
  { id: "m-90-2-apo", name: "APO-Summicron-M 90 f/2 ASPH.", mount: "M", focalMm: 90, maxAperture: 2, minAperture: 16, minFocusMm: 1000 },
  { id: "m-90-2.2", name: "Thambar-M 90 f/2.2", mount: "M", focalMm: 90, maxAperture: 2.2, minAperture: 25, minFocusMm: 1000 },
  // L (SL)
  { id: "sl-35-2", name: "APO-Summicron-SL 35 f/2 ASPH.", mount: "L", focalMm: 35, maxAperture: 2, minAperture: 22, minFocusMm: 270 },
  { id: "sl-50-2", name: "APO-Summicron-SL 50 f/2 ASPH.", mount: "L", focalMm: 50, maxAperture: 2, minAperture: 22, minFocusMm: 350 },
  { id: "sl-50-1.4", name: "Summilux-SL 50 f/1.4 ASPH.", mount: "L", focalMm: 50, maxAperture: 1.4, minAperture: 16, minFocusMm: 600 },
  { id: "sl-75-2", name: "APO-Summicron-SL 75 f/2 ASPH.", mount: "L", focalMm: 75, maxAperture: 2, minAperture: 22, minFocusMm: 500 },
  { id: "sl-90-2", name: "APO-Summicron-SL 90 f/2 ASPH.", mount: "L", focalMm: 90, maxAperture: 2, minAperture: 22, minFocusMm: 600 },
  // TL (APS-C)
  { id: "tl-23-2", name: "Summicron-TL 23 f/2 ASPH.", mount: "TL", focalMm: 23, maxAperture: 2, minAperture: 16, minFocusMm: 300 },
  { id: "tl-35-1.4", name: "Summilux-TL 35 f/1.4 ASPH.", mount: "TL", focalMm: 35, maxAperture: 1.4, minAperture: 16, minFocusMm: 410 },
  { id: "tl-60-2.8", name: "APO-Macro-Elmarit-TL 60 f/2.8 ASPH.", mount: "TL", focalMm: 60, maxAperture: 2.8, minAperture: 22, minFocusMm: 160 },
  // S (medium format)
  { id: "s-70-2.5", name: "Summarit-S 70 f/2.5 ASPH.", mount: "S", focalMm: 70, maxAperture: 2.5, minAperture: 22, minFocusMm: 500 },
  { id: "s-100-2", name: "Summicron-S 100 f/2 ASPH.", mount: "S", focalMm: 100, maxAperture: 2, minAperture: 22, minFocusMm: 900 },
  // Fixed (Q)
  { id: "q3-28", name: "Summilux 28 f/1.7 ASPH.", mount: "fixed", focalMm: 28, maxAperture: 1.7, minAperture: 16, minFocusMm: 170 },
  { id: "q3-43", name: "APO-Summicron 43 f/2 ASPH.", mount: "fixed", focalMm: 43, maxAperture: 2, minAperture: 16, minFocusMm: 260 },
];

export const DEFAULT_BODY_ID = "m11";
export const DEFAULT_LENS_ID = "m-35-2";

export function findBody(id: string) {
  return BODIES.find((b) => b.id === id) ?? BODIES[0];
}

export function findLens(id: string) {
  return LENSES.find((l) => l.id === id) ?? LENSES[0];
}

export function lensesForBody(body: Body): Lens[] {
  if (body.fixedLensId) return [findLens(body.fixedLensId)];
  // Native mounts first, adapted mounts after.
  return [...body.mounts, ...(body.adaptedMounts ?? [])].flatMap((mount) =>
    LENSES.filter((l) => l.mount === mount)
  );
}

/** True when the lens needs an adapter on this body (e.g. M lens on SL3). */
export function isAdapted(body: Body, lens: Lens) {
  return body.adaptedMounts?.includes(lens.mount) ?? false;
}

// Full and half stops, as clicked on Leica aperture rings.
const STANDARD_STOPS = [1.2, 1.4, 1.7, 2, 2.4, 2.8, 3.4, 4, 4.8, 5.6, 6.7, 8, 9.5, 11, 13, 16, 19, 22, 25, 32];

export function apertureStops(lens: Lens): number[] {
  const stops = STANDARD_STOPS.filter(
    (n) => n > lens.maxAperture * 1.03 && n <= lens.minAperture
  );
  return [lens.maxAperture, ...stops];
}

export function isFullStop(n: number) {
  return [0.95, 1, 1.4, 2, 2.8, 4, 5.6, 8, 11, 16, 22, 32].includes(n);
}

export function nearestStop(stops: number[], n: number) {
  return stops.reduce((best, s) =>
    Math.abs(Math.log(s / n)) < Math.abs(Math.log(best / n)) ? s : best
  );
}
