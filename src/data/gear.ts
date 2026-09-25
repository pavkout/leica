// Leica bodies and lenses.
//
// Specs come from public product information and should be checked against
// Leica's datasheets before relying on them. Physical sizes (used only for the
// illustrations) are approximate. Leica's datasheets don't list aperture
// blades, so `apertureBlades` is set only where the count is consistently
// published; other lenses render with a generic rounded iris.

export type Mount = "M" | "L" | "TL" | "S" | "fixed";
export type BodyFamily = "M film" | "M digital" | "Q" | "SL" | "CL" | "S";
export type Finish = "black" | "silver";

export interface Rangefinder {
  magnification: number;
  /**
   * Frameline sets. A lens brings up the first set containing its focal
   * length, and the whole set shows (e.g. 35 and 135 together).
   */
  frameSets: number[][];
}

export interface Body {
  id: string;
  name: string;
  year: number;
  family: BodyFamily;
  finish: Finish;
  sensorWidthMm: number;
  sensorHeightMm: number;
  /** Film, or a colour or monochrome sensor. */
  medium: "film" | "color" | "mono";
  /** Selectable output resolutions in megapixels; `null` for film. */
  megapixels: number[] | null;
  /** Digital ISO range; film bodies take the film's speed. */
  isoRange?: [number, number];
  /** Shutter-speed range on the dial, in seconds. */
  shutter: { slowest: number; fastest: number };
  /** Built-in metering: none, M6-style LED arrows, or a digital readout. */
  meter: "none" | "leds" | "display";
  /** Offers aperture-priority automatic exposure. */
  autoExposure: boolean;
  rangefinder?: Rangefinder;
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
  apertureBlades?: number;
  /** Launch year of this optical design. */
  year: number;
  /** No longer made. */
  classic?: boolean;
  nickname?: string;
  /** Approximate size and finish, for the illustration. */
  look: { lengthMm: number; diameterMm: number; finish: Finish; hood: "none" | "clip" | "builtin" | "screw"; tab?: boolean };
}

const M_FRAMES_MODERN: number[][] = [[28, 90], [35, 135], [50, 75]];
const M_FILM_SHUTTER = { slowest: 1, fastest: 1 / 1000 };

export const BODIES: Body[] = [
  // M film
  {
    id: "m3", name: "M3", year: 1954, family: "M film", finish: "silver", sensorWidthMm: 36, sensorHeightMm: 24,
    medium: "film", megapixels: null, shutter: M_FILM_SHUTTER, meter: "none", autoExposure: false,
    rangefinder: { magnification: 0.91, frameSets: [[50], [50, 90], [50, 135]] }, mounts: ["M"],
  },
  {
    id: "m4", name: "M4", year: 1967, family: "M film", finish: "black", sensorWidthMm: 36, sensorHeightMm: 24,
    medium: "film", megapixels: null, shutter: M_FILM_SHUTTER, meter: "none", autoExposure: false,
    rangefinder: { magnification: 0.72, frameSets: [[35, 135], [50], [90]] }, mounts: ["M"],
  },
  {
    id: "m6", name: "M6", year: 1984, family: "M film", finish: "black", sensorWidthMm: 36, sensorHeightMm: 24,
    medium: "film", megapixels: null, shutter: M_FILM_SHUTTER, meter: "leds", autoExposure: false,
    rangefinder: { magnification: 0.72, frameSets: M_FRAMES_MODERN }, mounts: ["M"],
  },
  {
    id: "m7", name: "M7", year: 2002, family: "M film", finish: "silver", sensorWidthMm: 36, sensorHeightMm: 24,
    medium: "film", megapixels: null, shutter: { slowest: 4, fastest: 1 / 1000 }, meter: "leds", autoExposure: true,
    rangefinder: { magnification: 0.72, frameSets: M_FRAMES_MODERN }, mounts: ["M"],
  },
  {
    id: "mp", name: "MP", year: 2003, family: "M film", finish: "black", sensorWidthMm: 36, sensorHeightMm: 24,
    medium: "film", megapixels: null, shutter: M_FILM_SHUTTER, meter: "leds", autoExposure: false,
    rangefinder: { magnification: 0.72, frameSets: M_FRAMES_MODERN }, mounts: ["M"],
  },
  {
    id: "m-a", name: "M-A", year: 2014, family: "M film", finish: "silver", sensorWidthMm: 36, sensorHeightMm: 24,
    medium: "film", megapixels: null, shutter: M_FILM_SHUTTER, meter: "none", autoExposure: false,
    rangefinder: { magnification: 0.72, frameSets: M_FRAMES_MODERN }, mounts: ["M"],
  },
  // M digital
  {
    id: "m9", name: "M9", year: 2009, family: "M digital", finish: "black", sensorWidthMm: 35.8, sensorHeightMm: 23.9,
    medium: "color", megapixels: [18], isoRange: [160, 2500], shutter: { slowest: 8, fastest: 1 / 4000 },
    meter: "display", autoExposure: true, rangefinder: { magnification: 0.68, frameSets: M_FRAMES_MODERN }, mounts: ["M"],
  },
  {
    id: "m240", name: "M (Typ 240)", year: 2012, family: "M digital", finish: "black", sensorWidthMm: 35.8, sensorHeightMm: 23.9,
    medium: "color", megapixels: [24], isoRange: [200, 6400], shutter: { slowest: 8, fastest: 1 / 4000 },
    meter: "display", autoExposure: true, rangefinder: { magnification: 0.68, frameSets: M_FRAMES_MODERN }, mounts: ["M"],
  },
  {
    id: "m10", name: "M10", year: 2017, family: "M digital", finish: "black", sensorWidthMm: 36, sensorHeightMm: 24,
    medium: "color", megapixels: [24], isoRange: [100, 50000], shutter: { slowest: 8, fastest: 1 / 4000 },
    meter: "display", autoExposure: true, rangefinder: { magnification: 0.73, frameSets: M_FRAMES_MODERN }, mounts: ["M"],
  },
  {
    id: "m10-r", name: "M10-R", year: 2020, family: "M digital", finish: "black", sensorWidthMm: 36, sensorHeightMm: 24,
    medium: "color", megapixels: [40], isoRange: [100, 50000], shutter: { slowest: 8, fastest: 1 / 4000 },
    meter: "display", autoExposure: true, rangefinder: { magnification: 0.73, frameSets: M_FRAMES_MODERN }, mounts: ["M"],
  },
  {
    id: "m10-mono", name: "M10 Monochrom", year: 2020, family: "M digital", finish: "black", sensorWidthMm: 36, sensorHeightMm: 24,
    medium: "mono", megapixels: [40], isoRange: [160, 100000], shutter: { slowest: 8, fastest: 1 / 4000 },
    meter: "display", autoExposure: true, rangefinder: { magnification: 0.73, frameSets: M_FRAMES_MODERN }, mounts: ["M"],
  },
  {
    id: "m11", name: "M11", year: 2022, family: "M digital", finish: "black", sensorWidthMm: 36, sensorHeightMm: 24,
    medium: "color", megapixels: [60, 36, 18], isoRange: [64, 50000], shutter: { slowest: 8, fastest: 1 / 16000 },
    meter: "display", autoExposure: true, rangefinder: { magnification: 0.73, frameSets: M_FRAMES_MODERN }, mounts: ["M"],
  },
  {
    id: "m11-p", name: "M11-P", year: 2023, family: "M digital", finish: "silver", sensorWidthMm: 36, sensorHeightMm: 24,
    medium: "color", megapixels: [60, 36, 18], isoRange: [64, 50000], shutter: { slowest: 8, fastest: 1 / 16000 },
    meter: "display", autoExposure: true, rangefinder: { magnification: 0.73, frameSets: M_FRAMES_MODERN }, mounts: ["M"],
  },
  {
    id: "m11-mono", name: "M11 Monochrom", year: 2023, family: "M digital", finish: "black", sensorWidthMm: 36, sensorHeightMm: 24,
    medium: "mono", megapixels: [60, 36, 18], isoRange: [125, 200000], shutter: { slowest: 8, fastest: 1 / 16000 },
    meter: "display", autoExposure: true, rangefinder: { magnification: 0.73, frameSets: M_FRAMES_MODERN }, mounts: ["M"],
  },
  {
    id: "m11-d", name: "M11-D", year: 2024, family: "M digital", finish: "black", sensorWidthMm: 36, sensorHeightMm: 24,
    medium: "color", megapixels: [60, 36, 18], isoRange: [64, 50000], shutter: { slowest: 8, fastest: 1 / 16000 },
    meter: "display", autoExposure: true, rangefinder: { magnification: 0.73, frameSets: M_FRAMES_MODERN }, mounts: ["M"],
  },
  // Q
  {
    id: "q2", name: "Q2", year: 2019, family: "Q", finish: "black", sensorWidthMm: 36, sensorHeightMm: 24,
    medium: "color", megapixels: [47], isoRange: [50, 50000], shutter: { slowest: 8, fastest: 1 / 16000 },
    meter: "display", autoExposure: true, mounts: ["fixed"], fixedLensId: "q-28", cropFocalLengths: [28, 35, 50, 75],
  },
  {
    id: "q2-mono", name: "Q2 Monochrom", year: 2020, family: "Q", finish: "black", sensorWidthMm: 36, sensorHeightMm: 24,
    medium: "mono", megapixels: [47], isoRange: [100, 100000], shutter: { slowest: 8, fastest: 1 / 16000 },
    meter: "display", autoExposure: true, mounts: ["fixed"], fixedLensId: "q-28", cropFocalLengths: [28, 35, 50, 75],
  },
  {
    id: "q3", name: "Q3", year: 2023, family: "Q", finish: "black", sensorWidthMm: 36, sensorHeightMm: 24,
    medium: "color", megapixels: [60, 36, 18], isoRange: [50, 100000], shutter: { slowest: 8, fastest: 1 / 16000 },
    meter: "display", autoExposure: true, mounts: ["fixed"], fixedLensId: "q-28", cropFocalLengths: [28, 35, 50, 75, 90],
  },
  {
    id: "q3-43", name: "Q3 43", year: 2024, family: "Q", finish: "black", sensorWidthMm: 36, sensorHeightMm: 24,
    medium: "color", megapixels: [60, 36, 18], isoRange: [50, 100000], shutter: { slowest: 8, fastest: 1 / 16000 },
    meter: "display", autoExposure: true, mounts: ["fixed"], fixedLensId: "q3-43", cropFocalLengths: [43, 60, 75, 150],
  },
  // SL, CL, S
  {
    id: "sl2", name: "SL2", year: 2019, family: "SL", finish: "black", sensorWidthMm: 36, sensorHeightMm: 24,
    medium: "color", megapixels: [47], isoRange: [50, 50000], shutter: { slowest: 8, fastest: 1 / 8000 },
    meter: "display", autoExposure: true, mounts: ["L"], adaptedMounts: ["M"],
  },
  {
    id: "sl2-s", name: "SL2-S", year: 2020, family: "SL", finish: "black", sensorWidthMm: 36, sensorHeightMm: 24,
    medium: "color", megapixels: [24], isoRange: [50, 100000], shutter: { slowest: 8, fastest: 1 / 8000 },
    meter: "display", autoExposure: true, mounts: ["L"], adaptedMounts: ["M"],
  },
  {
    id: "sl3", name: "SL3", year: 2024, family: "SL", finish: "black", sensorWidthMm: 36, sensorHeightMm: 24,
    medium: "color", megapixels: [60, 36, 18], isoRange: [50, 100000], shutter: { slowest: 8, fastest: 1 / 16000 },
    meter: "display", autoExposure: true, mounts: ["L"], adaptedMounts: ["M"],
  },
  {
    id: "cl", name: "CL (APS-C)", year: 2017, family: "CL", finish: "black", sensorWidthMm: 23.6, sensorHeightMm: 15.6,
    medium: "color", megapixels: [24], isoRange: [100, 50000], shutter: { slowest: 8, fastest: 1 / 16000 },
    meter: "display", autoExposure: true, mounts: ["TL", "L"], adaptedMounts: ["M"],
  },
  {
    id: "s3", name: "S3 (medium format)", year: 2020, family: "S", finish: "black", sensorWidthMm: 45, sensorHeightMm: 30,
    medium: "color", megapixels: [64], isoRange: [100, 12500], shutter: { slowest: 8, fastest: 1 / 4000 },
    meter: "display", autoExposure: true, mounts: ["S"],
  },
];

type LensSeed = Omit<Lens, "look"> & Partial<Pick<Lens, "look">>;

function m(seed: Omit<LensSeed, "mount">, look: Lens["look"]): Lens {
  return { mount: "M", ...seed, look };
}

export const LENSES: Lens[] = [
  // M: wide
  m({ id: "m-21-1.4", name: "Summilux-M 21 f/1.4 ASPH.", focalMm: 21, maxAperture: 1.4, minAperture: 16, minFocusMm: 700, year: 2008 }, { lengthMm: 66, diameterMm: 70, finish: "black", hood: "screw" }),
  m({ id: "m-21-3.4", name: "Super-Elmar-M 21 f/3.4 ASPH.", focalMm: 21, maxAperture: 3.4, minAperture: 16, minFocusMm: 700, year: 2011 }, { lengthMm: 44, diameterMm: 53, finish: "black", hood: "screw" }),
  m({ id: "m-24-1.4", name: "Summilux-M 24 f/1.4 ASPH.", focalMm: 24, maxAperture: 1.4, minAperture: 16, minFocusMm: 700, year: 2008 }, { lengthMm: 60, diameterMm: 62, finish: "black", hood: "screw" }),
  m({ id: "m-24-3.8", name: "Elmar-M 24 f/3.8 ASPH.", focalMm: 24, maxAperture: 3.8, minAperture: 16, minFocusMm: 700, year: 2008 }, { lengthMm: 36, diameterMm: 53, finish: "black", hood: "screw", tab: true }),
  m({ id: "m-28-1.4", name: "Summilux-M 28 f/1.4 ASPH.", focalMm: 28, maxAperture: 1.4, minAperture: 16, minFocusMm: 700, year: 2014 }, { lengthMm: 66, diameterMm: 61, finish: "black", hood: "screw" }),
  m({ id: "m-28-2", name: "Summicron-M 28 f/2 ASPH.", focalMm: 28, maxAperture: 2, minAperture: 16, minFocusMm: 700, year: 2000 }, { lengthMm: 40, diameterMm: 53, finish: "black", hood: "screw", tab: true }),
  m({ id: "m-28-2.8", name: "Elmarit-M 28 f/2.8 ASPH.", focalMm: 28, maxAperture: 2.8, minAperture: 16, minFocusMm: 700, year: 2006 }, { lengthMm: 30, diameterMm: 52, finish: "black", hood: "screw", tab: true }),
  m({ id: "m-28-5.6", name: "Summaron-M 28 f/5.6", focalMm: 28, maxAperture: 5.6, minAperture: 22, minFocusMm: 1000, year: 2016, nickname: "1955 design, reissued" }, { lengthMm: 22, diameterMm: 44, finish: "silver", hood: "clip" }),
  // M: 35
  m({ id: "m-35-3.5", name: "Summaron 35 f/3.5", focalMm: 35, maxAperture: 3.5, minAperture: 22, minFocusMm: 1000, year: 1954, classic: true }, { lengthMm: 26, diameterMm: 45, finish: "silver", hood: "clip" }),
  m({ id: "m-35-2-8e", name: "Summicron 35 f/2 (8 elements)", focalMm: 35, maxAperture: 2, minAperture: 16, minFocusMm: 700, year: 1958, classic: true, nickname: "King of bokeh" }, { lengthMm: 27, diameterMm: 51, finish: "silver", hood: "clip", tab: true }),
  m({ id: "m-35-1.4-pre", name: "Summilux 35 f/1.4 (pre-ASPH)", focalMm: 35, maxAperture: 1.4, minAperture: 16, minFocusMm: 700, year: 1961, classic: true, nickname: "Glowy wide open" }, { lengthMm: 30, diameterMm: 51, finish: "black", hood: "clip" }),
  m({ id: "m-35-2.4", name: "Summarit-M 35 f/2.4 ASPH.", focalMm: 35, maxAperture: 2.4, minAperture: 16, minFocusMm: 800, year: 2014 }, { lengthMm: 34, diameterMm: 51, finish: "black", hood: "screw" }),
  m({ id: "m-35-2", name: "Summicron-M 35 f/2 ASPH.", focalMm: 35, maxAperture: 2, minAperture: 16, minFocusMm: 700, year: 1997 }, { lengthMm: 34, diameterMm: 53, finish: "black", hood: "screw", tab: true }),
  m({ id: "m-35-2-apo", name: "APO-Summicron-M 35 f/2 ASPH.", focalMm: 35, maxAperture: 2, minAperture: 16, minFocusMm: 300, year: 2021 }, { lengthMm: 41, diameterMm: 53, finish: "black", hood: "screw" }),
  m({ id: "m-35-1.4", name: "Summilux-M 35 f/1.4 ASPH.", focalMm: 35, maxAperture: 1.4, minAperture: 16, minFocusMm: 400, year: 2022 }, { lengthMm: 46, diameterMm: 56, finish: "black", hood: "screw" }),
  // M: 50
  m({ id: "m-50-2.8", name: "Elmar-M 50 f/2.8 (collapsible)", focalMm: 50, maxAperture: 2.8, minAperture: 16, minFocusMm: 700, year: 1994, classic: true }, { lengthMm: 30, diameterMm: 52, finish: "silver", hood: "clip" }),
  m({ id: "m-50-2-rigid", name: "Summicron 50 f/2 (rigid)", focalMm: 50, maxAperture: 2, minAperture: 16, minFocusMm: 1000, year: 1956, classic: true }, { lengthMm: 41, diameterMm: 51, finish: "silver", hood: "clip" }),
  m({ id: "m-50-2.4", name: "Summarit-M 50 f/2.4", focalMm: 50, maxAperture: 2.4, minAperture: 16, minFocusMm: 800, year: 2014 }, { lengthMm: 36, diameterMm: 51, finish: "black", hood: "screw" }),
  m({ id: "m-50-2", name: "Summicron-M 50 f/2", focalMm: 50, maxAperture: 2, minAperture: 16, minFocusMm: 700, year: 1979 }, { lengthMm: 43, diameterMm: 53, finish: "black", hood: "builtin" }),
  m({ id: "m-50-2-apo", name: "APO-Summicron-M 50 f/2 ASPH.", focalMm: 50, maxAperture: 2, minAperture: 16, minFocusMm: 700, year: 2012, apertureBlades: 11 }, { lengthMm: 47, diameterMm: 53, finish: "black", hood: "builtin" }),
  m({ id: "m-50-1.4-pre", name: "Summilux 50 f/1.4 (pre-ASPH)", focalMm: 50, maxAperture: 1.4, minAperture: 16, minFocusMm: 1000, year: 1961, classic: true }, { lengthMm: 44, diameterMm: 53, finish: "black", hood: "builtin" }),
  m({ id: "m-50-1.4", name: "Summilux-M 50 f/1.4 ASPH.", focalMm: 50, maxAperture: 1.4, minAperture: 16, minFocusMm: 450, year: 2023 }, { lengthMm: 53, diameterMm: 54, finish: "black", hood: "builtin" }),
  m({ id: "m-50-1.2", name: "Noctilux-M 50 f/1.2 ASPH.", focalMm: 50, maxAperture: 1.2, minAperture: 16, minFocusMm: 1000, year: 2021, nickname: "1966 design, reissued" }, { lengthMm: 52, diameterMm: 61, finish: "silver", hood: "clip" }),
  m({ id: "m-50-1.0", name: "Noctilux-M 50 f/1.0", focalMm: 50, maxAperture: 1.0, minAperture: 16, minFocusMm: 1000, year: 1976, classic: true }, { lengthMm: 62, diameterMm: 69, finish: "black", hood: "builtin" }),
  m({ id: "m-50-0.95", name: "Noctilux-M 50 f/0.95 ASPH.", focalMm: 50, maxAperture: 0.95, minAperture: 16, minFocusMm: 1000, year: 2008, apertureBlades: 11 }, { lengthMm: 75, diameterMm: 73, finish: "black", hood: "builtin" }),
  // M: 75–135
  m({ id: "m-75-2.4", name: "Summarit-M 75 f/2.4", focalMm: 75, maxAperture: 2.4, minAperture: 16, minFocusMm: 700, year: 2014 }, { lengthMm: 61, diameterMm: 55, finish: "black", hood: "screw" }),
  m({ id: "m-75-2-apo", name: "APO-Summicron-M 75 f/2 ASPH.", focalMm: 75, maxAperture: 2, minAperture: 16, minFocusMm: 700, year: 2005 }, { lengthMm: 67, diameterMm: 55, finish: "black", hood: "builtin" }),
  m({ id: "m-75-1.4", name: "Summilux-M 75 f/1.4", focalMm: 75, maxAperture: 1.4, minAperture: 16, minFocusMm: 750, year: 1980, classic: true }, { lengthMm: 80, diameterMm: 67, finish: "black", hood: "builtin" }),
  m({ id: "m-75-1.25", name: "Noctilux-M 75 f/1.25 ASPH.", focalMm: 75, maxAperture: 1.25, minAperture: 16, minFocusMm: 850, year: 2018 }, { lengthMm: 91, diameterMm: 74, finish: "black", hood: "builtin" }),
  m({ id: "m-90-4-macro", name: "Macro-Elmar-M 90 f/4", focalMm: 90, maxAperture: 4, minAperture: 22, minFocusMm: 770, year: 2003 }, { lengthMm: 50, diameterMm: 52, finish: "black", hood: "screw" }),
  m({ id: "m-90-2.8", name: "Elmarit-M 90 f/2.8", focalMm: 90, maxAperture: 2.8, minAperture: 22, minFocusMm: 1000, year: 1990, classic: true }, { lengthMm: 76, diameterMm: 55, finish: "black", hood: "builtin" }),
  m({ id: "m-90-2.4", name: "Summarit-M 90 f/2.4", focalMm: 90, maxAperture: 2.4, minAperture: 16, minFocusMm: 1000, year: 2014 }, { lengthMm: 72, diameterMm: 55, finish: "black", hood: "screw" }),
  m({ id: "m-90-2-apo", name: "APO-Summicron-M 90 f/2 ASPH.", focalMm: 90, maxAperture: 2, minAperture: 16, minFocusMm: 1000, year: 1998 }, { lengthMm: 78, diameterMm: 64, finish: "black", hood: "builtin" }),
  m({ id: "m-90-1.5", name: "Summilux-M 90 f/1.5 ASPH.", focalMm: 90, maxAperture: 1.5, minAperture: 16, minFocusMm: 1000, year: 2022 }, { lengthMm: 88, diameterMm: 70, finish: "black", hood: "builtin" }),
  m({ id: "m-90-2.2", name: "Thambar-M 90 f/2.2", focalMm: 90, maxAperture: 2.2, minAperture: 25, minFocusMm: 1000, year: 2017, nickname: "1935 soft-focus design, reissued" }, { lengthMm: 91, diameterMm: 73, finish: "black", hood: "screw" }),
  m({ id: "m-135-3.4", name: "APO-Telyt-M 135 f/3.4", focalMm: 135, maxAperture: 3.4, minAperture: 22, minFocusMm: 1500, year: 1998 }, { lengthMm: 103, diameterMm: 58, finish: "black", hood: "builtin" }),
  // L (SL)
  { id: "sl-35-2", name: "APO-Summicron-SL 35 f/2 ASPH.", mount: "L", focalMm: 35, maxAperture: 2, minAperture: 22, minFocusMm: 270, year: 2019, look: { lengthMm: 102, diameterMm: 73, finish: "black", hood: "clip" } },
  { id: "sl-50-2", name: "APO-Summicron-SL 50 f/2 ASPH.", mount: "L", focalMm: 50, maxAperture: 2, minAperture: 22, minFocusMm: 350, year: 2018, look: { lengthMm: 102, diameterMm: 73, finish: "black", hood: "clip" } },
  { id: "sl-50-1.4", name: "Summilux-SL 50 f/1.4 ASPH.", mount: "L", focalMm: 50, maxAperture: 1.4, minAperture: 22, minFocusMm: 600, year: 2016, look: { lengthMm: 124, diameterMm: 88, finish: "black", hood: "clip" } },
  { id: "sl-75-2", name: "APO-Summicron-SL 75 f/2 ASPH.", mount: "L", focalMm: 75, maxAperture: 2, minAperture: 22, minFocusMm: 500, year: 2017, look: { lengthMm: 102, diameterMm: 73, finish: "black", hood: "clip" } },
  { id: "sl-90-2", name: "APO-Summicron-SL 90 f/2 ASPH.", mount: "L", focalMm: 90, maxAperture: 2, minAperture: 22, minFocusMm: 600, year: 2017, look: { lengthMm: 102, diameterMm: 73, finish: "black", hood: "clip" } },
  // TL (APS-C)
  { id: "tl-23-2", name: "Summicron-TL 23 f/2 ASPH.", mount: "TL", focalMm: 23, maxAperture: 2, minAperture: 16, minFocusMm: 300, year: 2014, look: { lengthMm: 36, diameterMm: 70, finish: "black", hood: "clip" } },
  { id: "tl-35-1.4", name: "Summilux-TL 35 f/1.4 ASPH.", mount: "TL", focalMm: 35, maxAperture: 1.4, minAperture: 16, minFocusMm: 410, year: 2016, look: { lengthMm: 77, diameterMm: 70, finish: "black", hood: "clip" } },
  { id: "tl-60-2.8", name: "APO-Macro-Elmarit-TL 60 f/2.8 ASPH.", mount: "TL", focalMm: 60, maxAperture: 2.8, minAperture: 22, minFocusMm: 160, year: 2014, look: { lengthMm: 64, diameterMm: 70, finish: "black", hood: "clip" } },
  // S (medium format)
  { id: "s-70-2.5", name: "Summarit-S 70 f/2.5 ASPH.", mount: "S", focalMm: 70, maxAperture: 2.5, minAperture: 22, minFocusMm: 500, year: 2009, look: { lengthMm: 90, diameterMm: 88, finish: "black", hood: "clip" } },
  { id: "s-100-2", name: "Summicron-S 100 f/2 ASPH.", mount: "S", focalMm: 100, maxAperture: 2, minAperture: 22, minFocusMm: 900, year: 2011, look: { lengthMm: 95, diameterMm: 88, finish: "black", hood: "clip" } },
  // Fixed (Q)
  { id: "q-28", name: "Summilux 28 f/1.7 ASPH.", mount: "fixed", focalMm: 28, maxAperture: 1.7, minAperture: 16, minFocusMm: 170, year: 2015, look: { lengthMm: 50, diameterMm: 62, finish: "black", hood: "screw" } },
  { id: "q3-43", name: "APO-Summicron 43 f/2 ASPH.", mount: "fixed", focalMm: 43, maxAperture: 2, minAperture: 16, minFocusMm: 260, year: 2024, look: { lengthMm: 58, diameterMm: 62, finish: "black", hood: "screw" } },
];

export const DEFAULT_BODY_ID = "m11";
export const DEFAULT_LENS_ID = "m-50-1.4";

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

/** The frameline set a lens brings up, or null when it's wider than the finder. */
export function framelinesFor(body: Body, focalMm: number): number[] | null {
  return body.rangefinder?.frameSets.find((set) => set.includes(focalMm)) ?? null;
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

// Marked shutter speeds, in seconds.
const SHUTTER_SPEEDS = [8, 4, 2, 1, 1 / 2, 1 / 4, 1 / 8, 1 / 15, 1 / 30, 1 / 60, 1 / 125, 1 / 250, 1 / 500, 1 / 1000, 1 / 2000, 1 / 4000, 1 / 8000, 1 / 16000];

export function shutterSpeeds(body: Body) {
  return SHUTTER_SPEEDS.filter((t) => t <= body.shutter.slowest * 1.001 && t >= body.shutter.fastest * 0.999);
}

export function formatShutter(t: number) {
  // Aperture priority picks stepless times; show the nearest marked speed
  // when close, otherwise a rounded value (1/8359 → 1/8400).
  const marked = SHUTTER_SPEEDS.find((m) => Math.abs(Math.log2(m / t)) < 1 / 6);
  const v = marked ?? t;
  if (v >= 1) return `${Math.round(v * 10) / 10}s`;
  const d = 1 / v;
  return `1/${marked ? Math.round(d) : Number(d.toPrecision(2))}`;
}
