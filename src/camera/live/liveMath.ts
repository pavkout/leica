// The live camera's physics (#37): what the phone's frames become through the
// simulated body and lens. Pure, so it can be tested; the renderer just
// evaluates these per frame or per pixel.

import { meteredEv100, settingsEv100 } from "../../physics/meter";

/** The phone lens's aperture assumed when the browser reports exposure time and ISO (as the light meter does). */
export const PHONE_F_NUMBER = 1.8;

/**
 * How much of each new frame to blend into the accumulated image: a real
 * shutter integrates light over its whole open time, so a frame lasting
 * `frameSec` is that fraction of a `shutterSec` exposure. Fast shutters
 * (shorter than a frame) show each frame as it is.
 */
export function accumulationAlpha(frameSec: number, shutterSec: number): number {
  if (!(shutterSec > 0) || !(frameSec > 0)) return 1;
  return Math.min(1, Math.max(0.01, frameSec / shutterSec));
}

/**
 * The scene's brightness (EV at ISO 100) behind a live frame: measured from
 * the phone's own exposure when the browser reports it, otherwise the
 * fallback the user chose (a labelled estimate).
 */
export function liveSceneEv(exposure: { exposureSec: number; iso: number } | null, meanLinear: number, fallbackEv: number): { ev: number; measured: boolean } {
  if (exposure && meanLinear > 0) return { ev: meteredEv100(settingsEv100(PHONE_F_NUMBER, exposure.exposureSec, exposure.iso), meanLinear), measured: true };
  return { ev: fallbackEv, measured: false };
}

/**
 * Relative depth from the depth model (0 far … 1 nearest) to inverse
 * distance in 1/m. The model gives no absolute scale, so the nearest thing in
 * view is assumed to be `nearestM` away, and tap-to-focus anchors the focus
 * plane on whatever you tap. Approximate by construction.
 */
export function relDepthToInvM(d: number, nearestM = 0.6): number {
  return Math.max(0, Math.min(1, d)) / nearestM;
}

/** Focus distance (mm) that puts the focus plane on a tapped point of relative depth `d`. */
export function focusForTap(d: number, minFocusMm: number, nearestM = 0.6): number {
  const inv = relDepthToInvM(d, nearestM);
  if (inv <= 1e-6) return Infinity;
  return Math.max(minFocusMm, 1000 / inv);
}

/**
 * Blur-disc diameter in frame pixels for a point at inverse distance `invZ`
 * (1/m) with the lens focused at `focusMm`: the thin-lens blur disc
 * (f²/N)·|1/z − 1/F| / (1 − f/F), the same optics as the still renderer,
 * written in inverse distances so depth maps plug straight in.
 */
export function blurPx(invZ: number, focusMm: number, focalMm: number, fNumber: number, frameWidthMm: number, widthPx: number): number {
  const invF = Number.isFinite(focusMm) ? 1 / focusMm : 0;
  const invZmm = invZ / 1000;
  const b = ((focalMm * focalMm) / fNumber) * Math.abs(invZmm - invF) / Math.max(1e-6, 1 - focalMm * invF);
  return (b / frameWidthMm) * widthPx;
}

/**
 * The same, as the shader's two numbers: blur(px) = |invZ·a − b|, with invZ
 * in 1/m. Lets the fragment shader do one multiply-add per pixel.
 */
export function blurCoefficients(focusMm: number, focalMm: number, fNumber: number, frameWidthMm: number, widthPx: number): { a: number; b: number } {
  const invF = Number.isFinite(focusMm) ? 1 / focusMm : 0;
  const k = ((focalMm * focalMm) / fNumber / Math.max(1e-6, 1 - focalMm * invF) / frameWidthMm) * widthPx;
  return { a: k / 1000, b: k * invF };
}

/**
 * Which part of the phone's frame to show, per axis (1 = all of it): first
 * cover-fit the video to the picture's shape, then narrow it to the lens's
 * field of view. The phone's field of view (`phoneFovDeg`) is along the
 * video's longer side, as the light meter and Live View assume. `wider` means
 * the lens sees more than the phone can: the whole phone frame is shown.
 */
export function liveCrop(videoW: number, videoH: number, frameW: number, frameH: number, lensHFovDeg: number, phoneFovDeg: number): { crop: [number, number]; wider: boolean } {
  const va = videoW / videoH;
  const fa = frameW / frameH;
  const [sx, sy] = va > fa ? [fa / va, 1] : [1, va / fa];
  const tanP = Math.tan((phoneFovDeg * Math.PI) / 360);
  const tanVisible = tanP * (videoW / Math.max(videoW, videoH)) * sx;
  const tanL = Math.tan((lensHFovDeg * Math.PI) / 360);
  const k = Math.min(1, tanL / tanVisible);
  return { crop: [sx * k, sy * k], wider: tanL > tanVisible * 1.001 };
}

/** Grain/noise strength for a sensitivity: grows with the square root of the gain above base. */
export function noiseFor(iso: number, baseIso: number, film: boolean): number {
  const g = Math.sqrt(Math.max(1, iso / Math.max(1, baseIso)));
  return (film ? 0.035 : 0.018) * g;
}
