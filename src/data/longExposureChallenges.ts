// Guided challenges for the Long Exposure Lab (feature #36). Each sets the lab
// up and says what to try with the real camera. Deliberately no points,
// streaks or timers: the reward is the photograph (same rule as Sunny 16).

import type { LabLight, PatternId } from "../physics/longExposure";

export interface Challenge {
  id: string;
  title: string;
  /** What to do with the camera. */
  task: string;
  /** Lab settings the challenge starts from. */
  setup: {
    lights: Partial<LabLight>[];
    cycleSec: number;
    loop: boolean;
    text?: string;
    iso?: number;
    /** The exposure the task asks for, so the predicted photo can show it. */
    exposureSec?: number;
  };
}

const light = (pattern: PatternId, extra: Partial<LabLight> = {}): Partial<LabLight> => ({ pattern, ...extra });

export const CHALLENGES: Challenge[] = [
  {
    id: "one-infinity",
    title: "One complete infinity",
    task: "Set the shutter to the cycle time (4 s) and start both together, so the photo holds exactly one figure-eight.",
    setup: { lights: [light("infinity")], cycleSec: 4, loop: false, exposureSec: 4 },
  },
  {
    id: "three-circles",
    title: "Three circles, no clipping",
    task: "Expose for three cycles (6 s). The line is redrawn three times: keep it from blowing out by lowering the brightness or stopping down.",
    setup: { lights: [light("circle", { brightness: 0.4 })], cycleSec: 2, loop: true, exposureSec: 6 },
  },
  {
    id: "a-word",
    title: "A word in 10 seconds",
    task: "Write a short word in light. Hold the shutter open for the whole 10 s cycle; the word only exists in the photo.",
    setup: { lights: [light("text")], cycleSec: 10, loop: false, text: "f/8", exposureSec: 10 },
  },
  {
    id: "iso-100-800",
    title: "ISO 100 against ISO 800",
    task: "Take the same pattern twice, at ISO 100 and ISO 800, with the aperture the lab suggests for each. Compare how bright the two trails are.",
    setup: { lights: [light("lissajous")], cycleSec: 4, loop: true, iso: 100 },
  },
  {
    id: "f2-f8",
    title: "f/2 against f/8",
    task: "Shoot the same pattern at f/2 and at f/8, same ISO and shutter. The line is the same length; only its brightness changes: two stops, four times.",
    setup: { lights: [light("hsweep")], cycleSec: 4, loop: true },
  },
  {
    id: "two-colours",
    title: "Two lights, two colours",
    task: "Two lights chase each other round one circle, half a cycle apart. Expose for half a cycle (2 s): each draws the opposite half, so the photo shows one circle, half red and half blue.",
    setup: { lights: [light("circle", { colourId: "red" }), light("circle", { colourId: "blue", offset: 0.5 })], cycleSec: 4, loop: true, exposureSec: 2 },
  },
];
