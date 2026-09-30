// Exposure calculators (#53): neutral-density filters and flash guide
// numbers. Pure arithmetic from the definitions: an ND's optical density d
// cuts light by 10^d (0.3 per stop), its factor ×n by n; a guide number is
// distance × f-number at ISO 100.

export interface NdFilter {
  label: string;
  stops: number;
}

/** The common filters, by the names printed on them. */
export const ND_FILTERS: NdFilter[] = [
  { label: "ND2 · 0.3", stops: 1 },
  { label: "ND4 · 0.6", stops: 2 },
  { label: "ND8 · 0.9", stops: 3 },
  { label: "ND16 · 1.2", stops: 4 },
  { label: "ND32 · 1.5", stops: 5 },
  { label: "ND64 · 1.8", stops: 6 },
  { label: "ND1000 · 3.0", stops: 10 },
  { label: "ND32000 · 4.5", stops: 15 },
];

/** Optical density → stops (0.3 per stop). */
export const densityStops = (d: number) => d / Math.log10(2);
/** Filter factor ×n → stops. */
export const factorStops = (n: number) => Math.log2(n);

export function withNd(seconds: number, stops: number): number {
  return seconds * 2 ** stops;
}

/** The f-number for a flash at `distanceM`, with guide number `gn` (metres, ISO 100). */
export function flashAperture(gn: number, iso: number, distanceM: number): number {
  return (gn * Math.sqrt(iso / 100)) / distanceM;
}

/** The farthest distance the flash reaches at `fNumber`. */
export function flashReach(gn: number, iso: number, fNumber: number): number {
  return (gn * Math.sqrt(iso / 100)) / fNumber;
}

/** The marked full and third stops, to round a result onto the aperture ring. */
export const MARKED_APERTURES = [1, 1.1, 1.2, 1.4, 1.6, 1.8, 2, 2.2, 2.5, 2.8, 3.2, 3.5, 4, 4.5, 5, 5.6, 6.3, 7.1, 8, 9, 10, 11, 13, 14, 16, 18, 20, 22];

/** The marked aperture at or just above the exact one (smaller aperture = no overexposure). */
export function ringAperture(exact: number): number {
  return MARKED_APERTURES.find((f) => f >= exact - 1e-6) ?? MARKED_APERTURES[MARKED_APERTURES.length - 1];
}

/** "1/125", "30s", "2m", "1:30" → seconds. */
export function parseTime(text: string): number | null {
  const s = text.trim().toLowerCase().replace(",", ".");
  const frac = /^1\s*\/\s*(\d+(?:\.\d+)?)\s*s?$/.exec(s);
  if (frac) return 1 / Number(frac[1]);
  const mmss = /^(\d+):([0-5]\d)$/.exec(s);
  if (mmss) return Number(mmss[1]) * 60 + Number(mmss[2]);
  const min = /^(\d+(?:\.\d+)?)\s*(m|min)$/.exec(s);
  if (min) return Number(min[1]) * 60;
  const sec = /^(\d+(?:\.\d+)?)\s*s?$/.exec(s);
  if (sec && Number(sec[1]) > 0) return Number(sec[1]);
  return null;
}

/** "1/250 s", "4 s", "2 min 30 s", "1 h 05 min". */
export function formatLong(seconds: number): string {
  if (seconds < 1) return `1/${Math.round(1 / seconds)} s`;
  const s = Math.round(seconds);
  if (s < 60) return `${seconds < 10 ? Math.round(seconds * 10) / 10 : s} s`;
  if (s < 3600) return `${Math.floor(s / 60)} min${s % 60 ? ` ${s % 60} s` : ""}`;
  return `${Math.floor(s / 3600)} h ${String(Math.floor((s % 3600) / 60)).padStart(2, "0")} min`;
}
