// Serialization for the optical state's "last used" persistence. Pulled out
// of opticalState.ts so the tricky bit — Infinity doesn't survive
// JSON.stringify/parse (it becomes `null`) — is a small, pure, tested unit
// instead of buried in a React hook.

import type { SharpnessStandard } from "../physics/model";
import type { Units } from "../utils/format";
import { getVersioned, setVersioned } from "../services/persistence";

export const OPTICAL_STORAGE_KEY = "rangefinder-last-used";
export const OPTICAL_STORAGE_VERSION = 1;

/** A number that might legitimately be `Infinity` (focused/background at infinity), JSON-safe. */
type MaybeInfinite = number | "inf";

export interface StoredOpticalState {
  bodyId: string;
  lensId: string;
  fNumber: number;
  focusMm: MaybeInfinite;
  backgroundOffsetMm: MaybeInfinite;
  megapixels: number | null;
  cropFocalMm: number | null;
  standard: SharpnessStandard;
  units: Units;
  filmId: string;
  isoDigital: number;
  autoExposure: boolean;
  manualShutter: number;
  tripod: boolean;
  eiStops: number;
}

export function encodeMaybeInfinite(n: number): MaybeInfinite {
  return Number.isFinite(n) ? n : "inf";
}

export function decodeMaybeInfinite(n: MaybeInfinite | undefined, fallback: number): number {
  if (n === "inf") return Infinity;
  return typeof n === "number" && Number.isFinite(n) ? n : fallback;
}

export function loadLastUsed(): Partial<StoredOpticalState> {
  return getVersioned<Partial<StoredOpticalState>>(OPTICAL_STORAGE_KEY, OPTICAL_STORAGE_VERSION, {});
}

export function saveLastUsed(state: StoredOpticalState) {
  setVersioned(OPTICAL_STORAGE_KEY, OPTICAL_STORAGE_VERSION, state);
}
