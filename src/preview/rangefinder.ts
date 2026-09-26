// Leica M rangefinder geometry.

/** Distance between the viewfinder and rangefinder windows on M bodies. */
export const RANGEFINDER_BASE_M = 0.06925;

/** Leica's accessory viewfinder magnifier. */
export const MAGNIFIER = 1.4;

/**
 * Approximate offset of the viewfinder window from the lens axis, seen from
 * behind the camera: to the left and above. It causes the parallax that the
 * framelines correct for at close range.
 */
export const FINDER_OFFSET_M = { x: 0.038, y: 0.016 };

/**
 * Horizontal field through a finder, in degrees. A 0.72–0.73× finder shows
 * just more than the 28 mm frame; higher magnification shows less.
 */
export function finderFieldDeg(magnification: number, magnifier = 1) {
  const halfAt073 = (35.5 * Math.PI) / 180;
  const tanHalf = (Math.tan(halfAt073) * 0.73) / (magnification * magnifier);
  return (2 * Math.atan(tanHalf) * 180) / Math.PI;
}

/**
 * Sideways offset (radians) between the two rangefinder images of an object
 * at `objectM` with the lens focused at `focusM`. Zero means "in focus".
 */
export function doubleImageOffset(objectM: number, focusM: number) {
  const inv = (m: number) => (Number.isFinite(m) ? 1 / m : 0);
  return RANGEFINDER_BASE_M * (inv(objectM) - inv(focusM));
}

/** Frameline shift (radians right and down) from viewfinder parallax. */
export function framelineParallax(focusM: number) {
  if (!Number.isFinite(focusM)) return { x: 0, y: 0 };
  return { x: FINDER_OFFSET_M.x / focusM, y: FINDER_OFFSET_M.y / focusM };
}

/**
 * How much of the finder's width/height a lens's bright-line frame occupies,
 * as a fraction — independent of any pixel size, so it works equally for a
 * live-rendered canvas or a plain CSS overlay. `frameWidthMm`/`frameHeightMm`
 * default to the 36×24mm full-frame format every M body's finder is built
 * around, regardless of the body's actual sensor/film gate.
 */
export function frameLineFraction(fieldDeg: number, focalMm: number, frameWidthMm = 36, frameHeightMm = 24) {
  const halfTan = Math.tan(((fieldDeg / 2) * Math.PI) / 180);
  return {
    halfWidthFrac: frameWidthMm / 2 / focalMm / (2 * halfTan),
    halfHeightFrac: frameHeightMm / 2 / focalMm / (2 * halfTan),
  };
}
