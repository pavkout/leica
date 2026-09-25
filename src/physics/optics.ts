// Thin-lens optics. All lengths are in millimetres; object distances are
// measured from the lens and may be `Infinity`.

/** Green light, the usual reference wavelength for diffraction. */
export const WAVELENGTH_MM = 0.00055;

/** Diagonal of the 36×24 mm frame; the reference for "full-frame equivalent". */
export const FULL_FRAME_DIAGONAL_MM = Math.hypot(36, 24);

export function hyperfocal(focalMm: number, fNumber: number, cocMm: number) {
  return (focalMm * focalMm) / (fNumber * cocMm) + focalMm;
}

export interface DepthOfField {
  hyperfocalMm: number;
  nearMm: number;
  /** `Infinity` once focus reaches the hyperfocal distance. */
  farMm: number;
  /**
   * Far limit continued past infinity: negative when focus is beyond the
   * hyperfocal distance. The lens-barrel scale uses it to place the far
   * bracket beyond the ∞ mark, just as an engraved scale shows it.
   */
  farSignedMm: number;
  totalMm: number;
}

export function depthOfField(
  focalMm: number,
  fNumber: number,
  cocMm: number,
  focusMm: number
): DepthOfField {
  const H = hyperfocal(focalMm, fNumber, cocMm);
  if (!Number.isFinite(focusMm)) {
    return { hyperfocalMm: H, nearMm: H - focalMm, farMm: Infinity, farSignedMm: -(H - focalMm), totalMm: Infinity };
  }
  const s = focusMm;
  const nearMm = (s * (H - focalMm)) / (H + s - 2 * focalMm);
  const farSignedMm = (s * (H - focalMm)) / (H - s);
  const farMm = s >= H ? Infinity : farSignedMm;
  return { hyperfocalMm: H, nearMm, farMm, farSignedMm, totalMm: farMm - nearMm };
}

/** Image-scale ratio (0.1 means 1:10). */
export function magnification(focalMm: number, focusMm: number) {
  if (!Number.isFinite(focusMm)) return 0;
  return focalMm / (focusMm - focalMm);
}

/**
 * Diameter on the sensor of the blur disc for a point at `objectMm` when the
 * lens is focused at `focusMm`.
 */
export function blurDiscMm(
  focalMm: number,
  fNumber: number,
  focusMm: number,
  objectMm: number
) {
  const aperture = focalMm / fNumber;
  if (!Number.isFinite(focusMm)) {
    return Number.isFinite(objectMm) ? (aperture * focalMm) / objectMm : 0;
  }
  const m = magnification(focalMm, focusMm);
  const defocus = Number.isFinite(objectMm)
    ? Math.abs(objectMm - focusMm) / objectMm
    : 1;
  return aperture * m * defocus;
}

/** Airy disc diameter, using the effective (bellows-corrected) f-number. */
export function airyDiscMm(fNumber: number, magnificationRatio = 0) {
  return 2.44 * WAVELENGTH_MM * fNumber * (1 + magnificationRatio);
}

/** f-number above which the Airy disc exceeds the circle of confusion. */
export function diffractionLimitedFNumber(cocMm: number, magnificationRatio = 0) {
  return cocMm / (2.44 * WAVELENGTH_MM * (1 + magnificationRatio));
}

/** Angle of view in degrees across a sensor dimension, focused at infinity. */
export function angleOfView(focalMm: number, sensorDimensionMm: number) {
  return (2 * Math.atan(sensorDimensionMm / (2 * focalMm)) * 180) / Math.PI;
}

/**
 * Focusing extension for a lens focused at `distanceMm` — how far the
 * helicoid has moved the optics from the infinity position. The focus ring's
 * rotation is proportional to it, which is why engraved distance scales
 * crowd together toward ∞. Negative for the "beyond infinity" signed far
 * limit, which places it past the ∞ mark.
 */
export function focusExtension(focalMm: number, distanceMm: number) {
  if (!Number.isFinite(distanceMm)) return 0;
  return (focalMm * focalMm) / (distanceMm - focalMm);
}

export function distanceFromExtension(focalMm: number, extensionMm: number) {
  if (extensionMm <= 0) return Infinity;
  return focalMm + (focalMm * focalMm) / extensionMm;
}
