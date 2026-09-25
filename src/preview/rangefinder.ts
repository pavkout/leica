// Leica M rangefinder geometry.

/** Distance between the viewfinder and rangefinder windows on M bodies. */
export const RANGEFINDER_BASE_M = 0.06925;

/** Standard M viewfinder magnification (M6 0.72×, M10/M11 0.73×). */
export const VIEWFINDER_MAGNIFICATION = 0.73;

/** Leica's accessory viewfinder magnifier. */
export const MAGNIFIER = 1.4;

/**
 * Approximate offset of the viewfinder window from the lens axis, seen from
 * behind the camera: to the left and above. It causes the parallax that the
 * framelines correct for at close range.
 */
export const FINDER_OFFSET_M = { x: 0.038, y: 0.016 };

/** Half the horizontal field the 0.73× finder shows, just wider than the 28 mm frame. */
const FINDER_HALF_ANGLE_DEG = 35.5;

/** Horizontal field of view through the finder, in degrees. */
export function finderFieldDeg(magnifier = 1) {
  const half = (FINDER_HALF_ANGLE_DEG * Math.PI) / 180;
  return (2 * Math.atan(Math.tan(half) / magnifier) * 180) / Math.PI;
}

/**
 * Framelines appear in pairs; the lens brings up the pair containing its
 * focal length. Null when the lens is wider than the finder shows.
 */
export function framelinePair(focalMm: number): [number, number] | null {
  const pairs: [number, number][] = [
    [28, 90],
    [35, 135],
    [50, 75],
  ];
  return pairs.find((pair) => pair.includes(focalMm)) ?? null;
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
