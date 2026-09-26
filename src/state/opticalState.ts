// The canonical optical state (RANGEFINDER_MASTER_PLAN.md, "Single source of
// truth"): which body and lens are selected, and the aperture/focus/sensor/
// film/shutter values that every renderer should read instead of keeping its
// own copy. Scene content, capture flow (roll/contact sheet) and transient UI
// state (picker open, loading status) are deliberately kept out of this hook
// — they depend on more than the optical state and belong with the surface
// that owns them.

import { useMemo, useState } from "react";
import {
  DEFAULT_BODY_ID,
  DEFAULT_LENS_ID,
  apertureStops,
  findBody,
  findLens,
  lensesForBody,
  nearestStop,
  type Body,
  type Lens,
} from "../data/gear";
import type { SharpnessStandard } from "../physics/model";
import type { Units } from "../utils/format";

export interface OpticalState {
  bodyId: string;
  lensId: string;
  /** The body/lens rows for the current ids, and the lenses available on this body. */
  body: Body;
  lens: Lens;
  lenses: Lens[];
  /** Selectable aperture stops for the current lens. */
  stops: number[];
  fNumber: number;
  focusMm: number;
  /** Background distance behind the subject; `Infinity` for a distant background. */
  backgroundOffsetMm: number;
  megapixels: number | null;
  cropFocalMm: number | null;
  standard: SharpnessStandard;
  units: Units;
  filmId: string;
  isoDigital: number;
  autoExposure: boolean;
  manualShutter: number;
  tripod: boolean;
}

export interface OpticalStateActions {
  /** Switches body; falls back to the body's first lens if the current one isn't available on it. */
  selectBody: (id: string) => void;
  /** Switches lens; snaps aperture to the nearest stop and respects the new minimum focus distance. */
  selectLens: (id: string) => void;
  setFNumber: (n: number) => void;
  setFocusMm: (mm: number) => void;
  setBackgroundOffsetMm: (mm: number) => void;
  setMegapixels: (mp: number | null) => void;
  setCropFocalMm: (mm: number | null) => void;
  setStandard: (s: SharpnessStandard) => void;
  setUnits: (u: Units) => void;
  setFilmId: (id: string) => void;
  setIsoDigital: (iso: number) => void;
  setAutoExposure: (auto: boolean) => void;
  setManualShutter: (t: number) => void;
  setTripod: (v: boolean) => void;
}

export function useOpticalState(): OpticalState & OpticalStateActions {
  const [bodyId, setBodyId] = useState(DEFAULT_BODY_ID);
  const [lensId, setLensId] = useState(DEFAULT_LENS_ID);
  // Opens on a portrait wide open against the street, where the preview shows most.
  const [fNumber, setFNumber] = useState(findLens(DEFAULT_LENS_ID).maxAperture);
  const [focusMm, setFocusMm] = useState(2000);
  const [backgroundOffsetMm, setBackgroundOffsetMm] = useState(Infinity);
  const [megapixels, setMegapixels] = useState<number | null>(60);
  const [cropFocalMm, setCropFocalMm] = useState<number | null>(null);
  const [standard, setStandard] = useState<SharpnessStandard>("engraved");
  const [units, setUnits] = useState<Units>("metric");
  const [filmId, setFilmId] = useState("portra400");
  const [isoDigital, setIsoDigital] = useState(400);
  const [autoExposure, setAutoExposure] = useState(true);
  const [manualShutter, setManualShutter] = useState(1 / 60);
  const [tripod, setTripod] = useState(false);

  const body = findBody(bodyId);
  const lens = findLens(lensId);
  const lenses = lensesForBody(body);
  const stops = useMemo(() => apertureStops(lens), [lens]);

  function selectLens(id: string) {
    const next = findLens(id);
    setLensId(id);
    setFNumber((n) => nearestStop(apertureStops(next), n));
    setFocusMm((mm) => Math.max(mm, next.minFocusMm));
  }

  function selectBody(id: string) {
    const next = findBody(id);
    setBodyId(id);
    setMegapixels(next.megapixels?.[0] ?? null);
    setCropFocalMm(null);
    const available = lensesForBody(next);
    if (!available.some((l) => l.id === lensId)) selectLens(available[0].id);
  }

  return {
    bodyId,
    lensId,
    body,
    lens,
    lenses,
    stops,
    fNumber,
    focusMm,
    backgroundOffsetMm,
    megapixels,
    cropFocalMm,
    standard,
    units,
    filmId,
    isoDigital,
    autoExposure,
    manualShutter,
    tripod,
    selectBody,
    selectLens,
    setFNumber,
    setFocusMm,
    setBackgroundOffsetMm,
    setMegapixels,
    setCropFocalMm,
    setStandard,
    setUnits,
    setFilmId,
    setIsoDigital,
    setAutoExposure,
    setManualShutter,
    setTripod,
  };
}
