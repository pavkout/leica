// Exposure: scene brightness (EV at ISO 100) against aperture, shutter and ISO.

/** Exposure value of a camera setting: log2(N² / t). */
export function settingEv(fNumber: number, shutterSec: number) {
  return Math.log2((fNumber * fNumber) / shutterSec);
}

/**
 * Stops of overexposure (positive) or underexposure (negative) for a scene of
 * brightness `sceneEv100` shot at the given setting and ISO.
 */
export function exposureError(sceneEv100: number, fNumber: number, shutterSec: number, iso: number) {
  return sceneEv100 + Math.log2(iso / 100) - settingEv(fNumber, shutterSec);
}

/** Shutter time that exposes correctly (what aperture priority picks). */
export function correctShutter(sceneEv100: number, fNumber: number, iso: number) {
  return (fNumber * fNumber) / 2 ** (sceneEv100 + Math.log2(iso / 100));
}

/**
 * Hand-held camera-shake blur on the sensor, in mm. Calibrated to the old
 * rule of thumb: at 1/focal-length seconds the blur is about 0.03 mm, one
 * full-frame circle of confusion.
 */
export function shakeBlurMm(shutterSec: number, focalMm: number) {
  return 0.03 * shutterSec * focalMm;
}

/** The M6-style meter LEDs: ▶ underexposed, ● correct, ◀ overexposed. */
export function meterLeds(errorStops: number): { under: boolean; ok: boolean; over: boolean } {
  const e = errorStops;
  return {
    under: e < -0.25,
    ok: Math.abs(e) <= 0.75,
    over: e > 0.25,
  };
}
