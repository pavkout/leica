// The canonical optical state (RANGEFINDER_MASTER_PLAN.md, "Single source of
// truth"): which body and lens are selected, and the aperture/focus/sensor/
// film/shutter values that every renderer should read instead of keeping its
// own copy. Scene content, capture flow (roll/contact sheet) and transient UI
// state (picker open, loading status) are deliberately kept out of this hook
// — they depend on more than the optical state and belong with the surface
// that owns them.

import { useEffect, useMemo, useState } from "react";
import {
  BODIES,
  DEFAULT_BODY_ID,
  DEFAULT_LENS_ID,
  LENSES,
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
import { decodeMaybeInfinite, encodeMaybeInfinite, loadLastUsed, saveLastUsed } from "./opticalStateStorage";

/** True when `id` is a real row in `rows`, so a stale/corrupt stored id can't leak in. */
function knownId<T extends { id: string }>(rows: T[], id: string | undefined): id is string {
  return id !== undefined && rows.some((r) => r.id === id);
}

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
  /** Exposure index the film is rated at; `null` means box speed (the film's own ISO). */
  filmEI: number | null;
  /** Push/pull development compensation, in stops; 0 = normal. */
  pushPullStops: number;
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
  /** Switches the loaded film; resets EI and push/pull to defaults for the new stock. */
  selectFilm: (id: string) => void;
  setIsoDigital: (iso: number) => void;
  setAutoExposure: (auto: boolean) => void;
  setManualShutter: (t: number) => void;
  setTripod: (v: boolean) => void;
  setFilmEI: (ei: number | null) => void;
  setPushPullStops: (stops: number) => void;
}

export function useOpticalState(): OpticalState & OpticalStateActions {
  // Read once per mount: the last configuration this browser saved, or {} if
  // there's none (first visit, storage unavailable, or corrupt data).
  const [stored] = useState(loadLastUsed);

  const initialBodyId = knownId(BODIES, stored.bodyId) ? stored.bodyId : DEFAULT_BODY_ID;
  const initialBody = findBody(initialBodyId);
  const availableForInitialBody = lensesForBody(initialBody);
  const initialLensId =
    knownId(LENSES, stored.lensId) && availableForInitialBody.some((l) => l.id === stored.lensId)
      ? stored.lensId
      : (availableForInitialBody[0]?.id ?? DEFAULT_LENS_ID);
  // Same invariant selectBody() maintains during normal use: megapixels/crop
  // only make sense for the body they were chosen on.
  const initialMegapixels =
    stored.megapixels != null && initialBody.megapixels?.includes(stored.megapixels) ? stored.megapixels : (initialBody.megapixels?.[0] ?? null);
  const initialCropFocalMm =
    stored.cropFocalMm != null && initialBody.cropFocalLengths?.includes(stored.cropFocalMm) ? stored.cropFocalMm : null;

  const [bodyId, setBodyId] = useState(initialBodyId);
  const [lensId, setLensId] = useState(initialLensId);
  // Opens on a portrait wide open against the street, where the preview shows most.
  const [fNumber, setFNumber] = useState(() =>
    typeof stored.fNumber === "number" ? nearestStop(apertureStops(findLens(lensId)), stored.fNumber) : findLens(lensId).maxAperture
  );
  const [focusMm, setFocusMm] = useState(() => Math.max(decodeMaybeInfinite(stored.focusMm, 2000), findLens(lensId).minFocusMm));
  const [backgroundOffsetMm, setBackgroundOffsetMm] = useState(() => decodeMaybeInfinite(stored.backgroundOffsetMm, Infinity));
  const [megapixels, setMegapixels] = useState<number | null>(initialMegapixels);
  const [cropFocalMm, setCropFocalMm] = useState<number | null>(initialCropFocalMm);
  const [standard, setStandard] = useState<SharpnessStandard>(stored.standard ?? "engraved");
  const [units, setUnits] = useState<Units>(stored.units ?? "metric");
  const [filmId, setFilmId] = useState(stored.filmId ?? "portra400");
  const [isoDigital, setIsoDigital] = useState(stored.isoDigital ?? 400);
  const [autoExposure, setAutoExposure] = useState(stored.autoExposure ?? true);
  const [manualShutter, setManualShutter] = useState(stored.manualShutter ?? 1 / 60);
  const [tripod, setTripod] = useState(stored.tripod ?? false);
  const [filmEI, setFilmEI] = useState<number | null>(stored.filmEI ?? null);
  const [pushPullStops, setPushPullStops] = useState(stored.pushPullStops ?? 0);

  useEffect(() => {
    // Debounced: focus/aperture change continuously while dragging, and
    // writing to storage on every intermediate value would be wasteful.
    const id = window.setTimeout(() => {
      saveLastUsed({
        bodyId,
        lensId,
        fNumber,
        focusMm: encodeMaybeInfinite(focusMm),
        backgroundOffsetMm: encodeMaybeInfinite(backgroundOffsetMm),
        megapixels,
        cropFocalMm,
        standard,
        units,
        filmId,
        isoDigital,
        autoExposure,
        manualShutter,
        tripod,
        filmEI,
        pushPullStops,
      });
    }, 400);
    return () => window.clearTimeout(id);
  }, [
    bodyId,
    lensId,
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
    filmEI,
    pushPullStops,
  ]);

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

  /** Loading a different film stock resets EI/push-pull — they were calibrated against the previous stock's box speed. */
  function selectFilm(id: string) {
    setFilmId(id);
    setFilmEI(null);
    setPushPullStops(0);
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
    filmEI,
    pushPullStops,
    selectBody,
    selectLens,
    selectFilm,
    setFNumber,
    setFocusMm,
    setBackgroundOffsetMm,
    setMegapixels,
    setCropFocalMm,
    setStandard,
    setUnits,
    setIsoDigital,
    setAutoExposure,
    setManualShutter,
    setTripod,
    setFilmEI,
    setPushPullStops,
  };
}
