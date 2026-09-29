// Daily assignments: one brief a day, graded from the settings saved with a
// frame (never from the picture's content, which the app can't judge). Each
// rule is something a photographer sets deliberately: aperture, distance,
// speed, lens, exposure. The briefs are this app's own teaching exercises.

import type { FrameMeta } from "../state/rollExport";
import { hyperfocal } from "../physics/optics";
import { shakeBlurMm } from "../physics/exposure";

export interface AssignmentRule {
  label: string;
  test: (m: FrameMeta) => boolean;
}

export interface Assignment {
  id: string;
  title: string;
  /** What to go and do, in one or two sentences. */
  brief: string;
  /** Why it's worth practising. */
  lesson: string;
  rules: AssignmentRule[];
}

const between = (x: number, lo: number, hi: number) => x >= lo - 1e-9 && x <= hi + 1e-9;
const exposed = (m: FrameMeta) => Math.abs(m.evOffset) <= 1;
const steady = (m: FrameMeta) => m.tripod === true || shakeBlurMm(m.shutterSec, m.focalMm) / (m.cocMm ?? 0.03) <= 1.5;

const EXPOSED: AssignmentRule = { label: "Exposure within a stop of the meter", test: exposed };
const STEADY: AssignmentRule = { label: "No camera shake", test: steady };

export const ASSIGNMENTS: Assignment[] = [
  {
    id: "zone-3m",
    title: "Zone focus at 3 m",
    brief: "Set 3 m on the distance scale, stop down to f/8 or smaller, and shoot without refocusing.",
    lesson: "Street photographers pre-set a zone so they can shoot the moment it happens.",
    rules: [
      { label: "Focused between 2.7 and 3.3 m", test: (m) => between(m.focusMm, 2700, 3300) },
      { label: "f/8 or smaller", test: (m) => m.fNumber >= 8 - 1e-9 },
      { label: "1/250 s or faster", test: (m) => m.shutterSec <= 1 / 250 + 1e-9 },
      EXPOSED,
    ],
  },
  {
    id: "wide-open-portrait",
    title: "Wide-open portrait",
    brief: "Get close, open up fully and put the eyes exactly on the sharp plane.",
    lesson: "At f/2 and 1.5 m the sharp zone is a few centimetres deep: focus is the whole picture.",
    rules: [
      { label: "f/2 or wider", test: (m) => m.fNumber <= 2 + 1e-9 },
      { label: "Focused at 2 m or closer", test: (m) => m.focusMm <= 2000 },
      EXPOSED,
    ],
  },
  {
    id: "freeze",
    title: "Freeze the moment",
    brief: "Something is moving fast: a cyclist, a jump, a splash. Stop it dead.",
    lesson: "Fast shutter speeds cost light: you'll trade aperture or ISO for them.",
    rules: [{ label: "1/500 s or faster", test: (m) => m.shutterSec <= 1 / 500 + 1e-9 }, EXPOSED],
  },
  {
    id: "hyperfocal",
    title: "Everything from here to infinity",
    brief: "Focus at the hyperfocal distance for your aperture, so the whole street is sharp.",
    lesson: "Hyperfocal focusing buys the most depth of field there is for a given stop.",
    rules: [
      {
        label: "Focused within 15% of the hyperfocal distance",
        test: (m) => Number.isFinite(m.focusMm) && between(m.focusMm / hyperfocal(m.focalMm, m.fNumber, m.cocMm ?? 0.03), 0.85, 1.15),
      },
      { label: "f/5.6 or smaller", test: (m) => m.fNumber >= 5.6 - 1e-9 },
      EXPOSED,
    ],
  },
  {
    id: "slow-steady",
    title: "Slow and steady",
    brief: "Shoot at 1/15 s or slower and keep it sharp: brace yourself, go wide, or use a tripod.",
    lesson: "The 1/focal-length rule: a wide lens forgives slow speeds a long one never would.",
    rules: [{ label: "1/15 s or slower", test: (m) => m.shutterSec >= 1 / 15 - 1e-9 }, STEADY, EXPOSED],
  },
  {
    id: "fifty-day",
    title: "The 50 mm day",
    brief: "A 50 mm at f/5.6, focused somewhere between 2 and 5 m. Nothing else.",
    lesson: "One lens and one setting make you move your feet instead of your settings.",
    rules: [
      { label: "A 50 mm lens", test: (m) => m.focalMm === 50 },
      { label: "f/5.6", test: (m) => Math.abs(m.fNumber - 5.6) < 0.05 },
      { label: "Focused between 2 and 5 m", test: (m) => between(m.focusMm, 2000, 5000) },
      EXPOSED,
    ],
  },
  {
    id: "long-and-soft",
    title: "Long lens, soft background",
    brief: "Use 75 mm or longer at f/4 or wider and separate your subject from what's behind it.",
    lesson: "Longer lenses at the same framing blur the background more.",
    rules: [
      { label: "75 mm or longer", test: (m) => m.focalMm >= 75 },
      { label: "f/4 or wider", test: (m) => m.fNumber <= 4 + 1e-9 },
      STEADY,
      EXPOSED,
    ],
  },
  {
    id: "wide-close",
    title: "Wide and close",
    brief: "35 mm or wider, focused at 1.2 m or nearer: be part of the scene, not a spectator.",
    lesson: "Getting close with a wide lens makes near things loom large: perspective, not zoom.",
    rules: [
      { label: "35 mm or wider", test: (m) => m.focalMm <= 35 },
      { label: "Focused at 1.2 m or closer", test: (m) => m.focusMm <= 1200 },
      EXPOSED,
    ],
  },
  {
    id: "silhouette",
    title: "Silhouette",
    brief: "Expose for the bright background and let the subject fall to black: 1.5 to 3 stops under.",
    lesson: "Underexposure on purpose: the meter isn't the picture, you are.",
    rules: [{ label: "1.5 to 3 stops under the meter", test: (m) => between(m.evOffset, -3, -1.5) }, STEADY],
  },
  {
    id: "high-key",
    title: "Bright and airy",
    brief: "Give it about a stop more than the meter says, for a light, open picture.",
    lesson: "Film and faces often look better slightly overexposed than under.",
    rules: [{ label: "0.7 to 1.7 stops over the meter", test: (m) => between(m.evOffset, 0.7, 1.7) }, STEADY],
  },
  {
    id: "deep-sharp",
    title: "Front to back",
    brief: "Stop down to f/11 or f/16 and keep everything from near to far sharp.",
    lesson: "Small apertures buy depth of field but cost shutter speed.",
    rules: [{ label: "f/11 or f/16", test: (m) => between(m.fNumber, 11, 16) }, STEADY, EXPOSED],
  },
];
