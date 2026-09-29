// Leica M 6-bit lens codes: six fields on the bayonet, painted black or white,
// that a digital M reads to identify the lens. Read with the code at 12
// o'clock, clockwise; black is 1.
//
// Provenance
// - Codes: community-compiled tables. Two published copies were read on
//   2026-09-29 and agree on every entry below; they may descend from the same
//   original forum compilation, so this is "community" data, not Leica's.
//     https://lavidaleica.com/content/leica-lens-codes
//     https://www.devonbuy.com/how-to-6-bit-code-leica-m-lens/
// - Which lenses Leica will retrofit with a code: Leica Customer Care's
//   "List of 6-bit update capable M lenses for digital use" (April 2015).
//     https://leica-camera.com/sites/default/files/2021-08/6BIT_CODING_LIST_April2015_EN.pdf

export interface LensCode {
  name: string;
  focalMm: number;
  /** Leica order numbers this code covers (finishes and versions). */
  orders: string[];
  /** The six fields, first field first; "1" is black. */
  bits: string;
}

export const LENS_CODE_SOURCES = [
  { label: "La Vida Leica: Leica lens codes", url: "https://lavidaleica.com/content/leica-lens-codes" },
  { label: "Devonbuy: How to 6-bit code a Leica M lens", url: "https://www.devonbuy.com/how-to-6-bit-code-leica-m-lens/" },
];

export const RETROFIT_SOURCE = {
  label: "Leica Customer Care: List of 6-bit update capable M lenses for digital use (April 2015)",
  url: "https://leica-camera.com/sites/default/files/2021-08/6BIT_CODING_LIST_April2015_EN.pdf",
};

/** Order numbers on Leica's retrofit list: Customer Care can add the code to these. */
export const RETROFIT_ORDERS = new Set([
  "11604", "11879", "11882", "11891", "11892", "11826", "11637", "11884", "11889", "11807", "11816", "11633", "11634", "14409", "11135",
  "11874", "11878", "11625", "11831", "11823", "11810", "11822", "11134", "11897", "11898", "11804", "11809", "11890", "11894", "11883",
  "11310", "11311", "11821", "11868", "11856", "11817", "11819", "11825", "11814", "11815", "11136", "11137", "11885", "11800", "11808",
]);

export const LENS_CODES: LensCode[] = [
  { name: "Tri-Elmar-M 16-18-21 f/4 ASPH.", focalMm: 16, orders: ["11626"], bits: "010000" },
  { name: "Super-Elmar-M 18 f/3.8 ASPH.", focalMm: 18, orders: ["11649"], bits: "110100" },
  { name: "Super-Elmar-M 21 f/3.4 ASPH.", focalMm: 21, orders: ["11145"], bits: "110011" },
  { name: "Elmarit-M 21 f/2.8", focalMm: 21, orders: ["11134"], bits: "000001" },
  { name: "Elmarit-M 21 f/2.8 ASPH.", focalMm: 21, orders: ["11135", "11897"], bits: "011000" },
  { name: "Summilux-M 21 f/1.4 ASPH.", focalMm: 21, orders: ["11647"], bits: "101111" },
  { name: "Elmar-M 24 f/3.8 ASPH.", focalMm: 24, orders: ["11648"], bits: "110010" },
  { name: "Elmarit-M 24 f/2.8 ASPH.", focalMm: 24, orders: ["11878", "11898"], bits: "011001" },
  { name: "Summilux-M 24 f/1.4 ASPH.", focalMm: 24, orders: ["11601"], bits: "110000" },
  { name: "Tri-Elmar-M 28-35-50 f/4 ASPH.", focalMm: 28, orders: ["11890", "11625", "11894"], bits: "101010" },
  { name: "Elmarit-M 28 f/2.8 (version III)", focalMm: 28, orders: ["11804"], bits: "000011" },
  { name: "Elmarit-M 28 f/2.8 (version IV)", focalMm: 28, orders: ["11809"], bits: "011011" },
  { name: "Elmarit-M 28 f/2.8 ASPH.", focalMm: 28, orders: ["11606"], bits: "011100" },
  { name: "Summicron-M 28 f/2 ASPH.", focalMm: 28, orders: ["11604"], bits: "011010" },
  { name: "Summarit-M 35 f/2.5", focalMm: 35, orders: ["11643"], bits: "101011" },
  { name: "Summicron-M 35 f/2 (version IV)", focalMm: 35, orders: ["11310", "11311"], bits: "000110" },
  { name: "Summicron-M 35 f/2 ASPH.", focalMm: 35, orders: ["11879", "11882"], bits: "011110" },
  { name: "Summilux-M 35 f/1.4 ASPH. (before the floating element)", focalMm: 35, orders: ["11874", "11883"], bits: "011101" },
  { name: "Elmar-M 50 f/2.8", focalMm: 50, orders: ["11831", "11824", "11823"], bits: "100010" },
  { name: "Summarit-M 50 f/2.5", focalMm: 50, orders: ["11644"], bits: "101100" },
  { name: "Summicron-M 50 f/2 (version III)", focalMm: 50, orders: ["11817"], bits: "010111" },
  { name: "Summicron-M 50 f/2 (versions IV and V)", focalMm: 50, orders: ["11819", "11826", "11825", "11816"], bits: "100001" },
  { name: "APO-Summicron-M 50 f/2 ASPH.", focalMm: 50, orders: ["11141"], bits: "101001" },
  { name: "Summilux-M 50 f/1.4 (version II)", focalMm: 50, orders: ["11868", "11856"], bits: "000101" },
  { name: "Summilux-M 50 f/1.4 ASPH.", focalMm: 50, orders: ["11891", "11892"], bits: "100000" },
  { name: "Noctilux-M 50 f/1", focalMm: 50, orders: ["11821", "11822"], bits: "011111" },
  { name: "Noctilux-M 50 f/0.95 ASPH.", focalMm: 50, orders: ["11602"], bits: "110001" },
  { name: "Summarit-M 75 f/2.5", focalMm: 75, orders: ["11645"], bits: "101101" },
  { name: "APO-Summicron-M 75 f/2 ASPH.", focalMm: 75, orders: ["11637"], bits: "100100" },
  { name: "Summilux-M 75 f/1.4", focalMm: 75, orders: ["11810", "11814", "11815"], bits: "100011" },
  { name: "Macro-Elmar-M 90 f/4", focalMm: 90, orders: ["11633", "11634"], bits: "100111" },
  { name: "Macro-Adapter-M", focalMm: 90, orders: ["14409"], bits: "101000" },
  { name: "Tele-Elmarit-M 90 f/2.8 (version II)", focalMm: 90, orders: ["11800"], bits: "000100" },
  { name: "Elmarit-M 90 f/2.8", focalMm: 90, orders: ["11807", "11808"], bits: "100110" },
  { name: "Summarit-M 90 f/2.5", focalMm: 90, orders: ["11646"], bits: "101110" },
  { name: "Summicron-M 90 f/2 (version II)", focalMm: 90, orders: ["11136", "11137"], bits: "000111" },
  { name: "APO-Summicron-M 90 f/2 ASPH.", focalMm: 90, orders: ["11884", "11885"], bits: "100101" },
  { name: "Elmarit-M 135 f/2.8 (versions I and II)", focalMm: 135, orders: ["11829"], bits: "001001" },
  { name: "APO-Telyt-M 135 f/3.4", focalMm: 135, orders: ["11889"], bits: "110101" },
];

/** The code as a number, as tables print it (the bits read left to right). */
export const codeNumber = (bits: string) => parseInt(bits, 2);

/** Lenses carrying this pattern (more than one only if the tables disagree with themselves). */
export function decode(bits: string): LensCode[] {
  return LENS_CODES.filter((c) => c.bits === bits);
}

/** Can Leica Customer Care add the code to this lens (any of its order numbers on the retrofit list)? */
export function retrofittable(c: LensCode): boolean {
  return c.orders.some((o) => RETROFIT_ORDERS.has(o));
}

/**
 * The code entry for a catalogue lens: only on an exact name match (versions
 * in brackets included), and only when exactly one entry matches. Several
 * versions share a family name with different codes, so a looser match would
 * show the wrong one; no answer is better than a wrong answer.
 */
export function codeForLensName(name: string): LensCode | undefined {
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  const hits = LENS_CODES.filter((c) => norm(c.name) === norm(name));
  return hits.length === 1 ? hits[0] : undefined;
}
