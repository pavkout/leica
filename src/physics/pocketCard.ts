// The pocket card: what a photographer tapes inside a camera bag for one
// exact kit. Zone-focus distances per aperture, a Sunny 16 table at the
// film's speed, and the slowest safe hand-held speed. Everything comes from
// the same engines as the rest of the app (thin-lens DoF, the EV guide,
// the 1/focal-length rule), so the card never disagrees with the screen.

import { correctShutter } from "./exposure";
import { depthOfField, hyperfocal } from "./optics";
import { LIGHT_CONDITIONS } from "./sunny16";

export interface ZoneRow {
  fNumber: number;
  /** Set the distance scale here… */
  hyperfocalMm: number;
  /** …and everything from here to infinity is sharp. */
  nearMm: number;
  /** Sharp range when focused at each street distance. */
  zones: { focusMm: number; nearMm: number; farMm: number }[];
}

export interface LightRow {
  id: string;
  label: string;
  ev100: number;
  fNumber: number;
  shutterSec: number;
  /** Slower than this lens can be held by hand: brace the camera or use a tripod. */
  needsSupport: boolean;
}

export interface PocketCard {
  zones: ZoneRow[];
  light: LightRow[];
  /** Slowest shutter speed to hold by hand with this lens, from the camera's speeds. */
  slowestHandheldSec: number;
}

/** Street distances a zone-focuser sets by feel. */
export const STREET_DISTANCES_MM = [2000, 3000, 5000];
/** Apertures a zone-focuser uses; the card shows the ones the lens has. */
const ZONE_APERTURES = [5.6, 8, 11, 16];
/** Apertures to try for each light, most open first; the first with a speed in range wins. */
const LIGHT_APERTURES = [16, 11, 8, 5.6, 4, 2.8, 2, 1.4];

function nearestSpeed(speeds: number[], t: number) {
  return speeds.reduce((best, s) => (Math.abs(Math.log2(s / t)) < Math.abs(Math.log2(best / t)) ? s : best));
}

/**
 * Settings for a scene brightness: the smallest standard aperture that still
 * gives a hand-holdable speed, else the widest the lens has, and whether that
 * needs support. Shared by the pocket card and the light planner.
 */
export function lightSetting(ev100: number, opts: { stops: number[]; speeds: number[]; iso: number; slowestHandheldSec: number }): { fNumber: number; shutterSec: number; needsSupport: boolean } {
  const { stops, speeds, iso, slowestHandheldSec } = opts;
  const has = (n: number) => stops.some((s) => Math.abs(s - n) < 0.05);
  const fastest = Math.min(...speeds);
  const usable = LIGHT_APERTURES.filter(has);
  let pick = usable[usable.length - 1] ?? stops[0];
  for (const n of usable) {
    const t = correctShutter(ev100, n, iso);
    if (t >= fastest && t <= slowestHandheldSec * 1.001) {
      pick = n;
      break;
    }
  }
  const shutterSec = nearestSpeed(speeds, correctShutter(ev100, pick, iso));
  return { fNumber: pick, shutterSec, needsSupport: shutterSec > slowestHandheldSec * 1.001 };
}

/** 1/focal length, rounded to the next faster speed the camera has. */
export function handheldLimit(focalMm: number, speeds: number[]): number {
  const fastest = Math.min(...speeds);
  return speeds.filter((s) => s <= (1 / focalMm) * 1.001).reduce((a, b) => Math.max(a, b), fastest);
}

export function pocketCard(opts: { focalMm: number; stops: number[]; speeds: number[]; iso: number; cocMm: number }): PocketCard {
  const { focalMm, stops, speeds, iso, cocMm } = opts;
  const has = (n: number) => stops.some((s) => Math.abs(s - n) < 0.05);

  const zones = ZONE_APERTURES.filter(has).map((n) => {
    const H = hyperfocal(focalMm, n, cocMm);
    return {
      fNumber: n,
      hyperfocalMm: H,
      nearMm: H / 2,
      zones: STREET_DISTANCES_MM.map((d) => {
        const dof = depthOfField(focalMm, n, cocMm, d);
        return { focusMm: d, nearMm: dof.nearMm, farMm: dof.farMm };
      }),
    };
  });

  const slowestHandheldSec = handheldLimit(focalMm, speeds);

  const light = LIGHT_CONDITIONS.map((c) => ({ id: c.id, label: c.label, ev100: c.ev100, ...lightSetting(c.ev100, { stops, speeds, iso, slowestHandheldSec }) }));

  return { zones, light, slowestHandheldSec };
}
