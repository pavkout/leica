import type { Body, Lens } from "../data/gear";
import {
  FULL_FRAME_DIAGONAL_MM,
  airyDiscMm,
  angleOfView,
  blurDiscMm,
  depthOfField,
  diffractionLimitedFNumber,
  magnification,
} from "./optics";

export type SharpnessStandard = "engraved" | "critical" | "pixel";

export const SHARPNESS_STANDARDS: {
  id: SharpnessStandard;
  label: string;
  description: string;
}[] = [
  {
    id: "engraved",
    label: "Lens scale",
    description: "0.03 mm on full frame, the standard behind engraved DoF scales. Good for normal prints and screens.",
  },
  {
    id: "critical",
    label: "Critical",
    description: "Twice as strict (frame diagonal ÷ 3000). For large prints viewed up close.",
  },
  {
    id: "pixel",
    label: "Pixel-level",
    description: "Two pixels at the selected resolution. What you see at 100% zoom.",
  },
];

export interface ShotSettings {
  body: Body;
  lens: Lens;
  fNumber: number;
  focusMm: number;
  /** Where the subject stands; defaults to the focus distance. */
  subjectMm?: number;
  /** Background distance behind the subject; `Infinity` for a distant background. */
  backgroundOffsetMm: number;
  megapixels: number | null;
  /** Framing on fixed-lens bodies with digital crop modes. */
  cropFocalMm: number | null;
  standard: SharpnessStandard;
}

export function computeShot(settings: ShotSettings) {
  const { body, lens, fNumber, focusMm, backgroundOffsetMm, megapixels, cropFocalMm, standard } = settings;
  const subjectMm = settings.subjectMm ?? focusMm;
  const focalMm = lens.focalMm;

  // A crop mode keeps the pixels but uses a smaller part of the sensor.
  const crop = cropFocalMm ? cropFocalMm / focalMm : 1;
  const frameWidthMm = body.sensorWidthMm / crop;
  const frameHeightMm = body.sensorHeightMm / crop;
  const frameDiagonalMm = Math.hypot(frameWidthMm, frameHeightMm);

  const pixelPitchMm = megapixels
    ? Math.sqrt((body.sensorWidthMm * body.sensorHeightMm) / (megapixels * 1e6))
    : null;

  const effectiveStandard: SharpnessStandard =
    standard === "pixel" && !pixelPitchMm ? "engraved" : standard;
  const cocMm =
    effectiveStandard === "pixel"
      ? 2 * pixelPitchMm!
      : effectiveStandard === "critical"
        ? frameDiagonalMm / 3000
        : 0.03 * (frameDiagonalMm / FULL_FRAME_DIAGONAL_MM);

  const dof = depthOfField(focalMm, fNumber, cocMm, focusMm);
  const mag = magnification(focalMm, focusMm);

  const backgroundMm = subjectMm + backgroundOffsetMm;
  const subjectBlurMm = blurDiscMm(focalMm, fNumber, focusMm, subjectMm);
  const backgroundBlurMm = blurDiscMm(focalMm, fNumber, focusMm, backgroundMm);

  const diffractionFNumber = diffractionLimitedFNumber(cocMm, mag);

  return {
    focalMm,
    fNumber,
    focusMm,
    frameWidthMm,
    frameHeightMm,
    cocMm,
    standard: effectiveStandard,
    pixelPitchMm,
    dof,
    magnification: mag,
    subjectMm,
    subjectBlurMm,
    subjectSharp: subjectBlurMm <= cocMm,
    backgroundMm,
    backgroundBlurMm,
    backgroundBlurFrameFraction: backgroundBlurMm / frameWidthMm,
    backgroundBlurPixels: pixelPitchMm ? backgroundBlurMm / pixelPitchMm : null,
    airyMm: airyDiscMm(fNumber, mag),
    diffractionFNumber,
    diffractionLimited: fNumber > diffractionFNumber,
    horizontalAngle: angleOfView(focalMm, frameWidthMm),
    diagonalAngle: angleOfView(focalMm, frameDiagonalMm),
    equivalentFocalMm: focalMm * (FULL_FRAME_DIAGONAL_MM / frameDiagonalMm),
  };
}

export type Shot = ReturnType<typeof computeShot>;
