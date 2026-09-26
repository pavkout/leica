// Geometry for the Live View frameline overlay: what fraction of the phone
// camera's own field of view the selected M lens would actually frame. The
// phone's real field of view isn't available from getUserMedia in any
// reliable cross-browser way, so this is always relative to an assumed
// reference FOV, never an absolute measurement — the UI must label it as
// approximate.

/** Phone main cameras see roughly this wide (about a 26 mm equivalent). Shared with the uploaded-photo FOV assumption in App.tsx. */
export const ASSUMED_PHONE_FOV_DEG = 69;

/**
 * Fraction of the reference camera's frame width a lens's field of view
 * covers: 1 at equal FOV, less than 1 when the lens is narrower (a tighter
 * frameline within the video), greater than 1 when the lens is wider than
 * the reference camera can even see (no frameline can be drawn — the whole
 * video frame undershoots the lens).
 */
export function frameCropRatio(lensHorizontalFovDeg: number, referenceHorizontalFovDeg: number): number {
  return Math.tan((lensHorizontalFovDeg * Math.PI) / 360) / Math.tan((referenceHorizontalFovDeg * Math.PI) / 360);
}
