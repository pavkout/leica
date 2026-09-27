// Signature 60-second demo (feature #35). A script over the app's production
// components: every step reads the app's real state to know it's done, and a
// skip drives the same real setters to the same end state. Pure, so the
// script itself is testable; DemoTour.tsx runs it.

export const DEMO = {
  bodyId: "m3",
  /** On the M3 when the demo opens, so mounting the 50 is a visible swap. */
  startLensId: "m-35-3.5",
  /** The M3-era 50 mm the user mounts. */
  lensId: "m-50-2-rigid",
  /** Where the subject stands for the rangefinder step (deterministic, no camera needed). */
  subjectMm: 3000,
  /** Focus starts here, so the rangefinder patch is visibly split. */
  startFocusMm: 1200,
  /** The aperture the user stops down to. */
  targetFNumber: 8,
  budgetSec: 60,
} as const;

export interface DemoState {
  bodyId: string;
  lensId: string;
  lensFocalMm: number;
  show3D: boolean;
  fNumber: number;
  subjectSharp: boolean;
  /** Live View has been opened during this step. */
  liveOpened: boolean;
}

export interface DemoActions {
  selectBody: (id: string) => void;
  selectLens: (id: string) => void;
  open3D: () => void;
  setFocusMm: (mm: number) => void;
  setAperture: (n: number) => void;
  setDemoSubject: (mm: number | null) => void;
  openLive: () => void;
  /** Bring a panel into view (by CSS selector). */
  reveal: (selector: string) => void;
}

export interface DemoStep {
  id: "mount" | "focus" | "aperture" | "live" | "finish";
  title: string;
  instruction: string;
  /** Panel the step happens in. */
  panel: string;
  /** Put the app in the step's starting state. */
  enter: (a: DemoActions) => void;
  done: (s: DemoState) => boolean;
  /** Reach the step's end state through the same real setters. */
  skip: (a: DemoActions) => void;
}

export const DEMO_STEPS: DemoStep[] = [
  {
    id: "mount",
    title: "An M3, in 3D",
    instruction: "Mount the 50 mm and watch it lock onto the bayonet.",
    panel: ".stage-setup",
    enter: (a) => {
      a.selectBody(DEMO.bodyId);
      a.selectLens(DEMO.startLensId);
      a.open3D();
    },
    done: (s) => s.bodyId === DEMO.bodyId && s.lensFocalMm === 50 && s.show3D,
    skip: (a) => {
      a.open3D();
      a.selectLens(DEMO.lensId);
    },
  },
  {
    id: "focus",
    title: "Focus like a rangefinder",
    instruction: "Turn the focus until the two images in the patch line up. The subject is 3 m away.",
    panel: ".stage-finder",
    enter: (a) => {
      a.setDemoSubject(DEMO.subjectMm);
      a.setFocusMm(DEMO.startFocusMm);
    },
    done: (s) => s.subjectSharp,
    skip: (a) => a.setFocusMm(DEMO.subjectMm),
  },
  {
    id: "aperture",
    title: "Stop down",
    instruction: "Close the aperture to f/8: hear the clicks, watch the iris close and the depth of field grow.",
    panel: ".stage-barrel",
    enter: () => {},
    done: (s) => s.fNumber >= DEMO.targetFNumber,
    skip: (a) => a.setAperture(DEMO.targetFNumber),
  },
  {
    id: "live",
    title: "Go LIVE",
    instruction: "Open Live View: M3 framelines over your phone's camera, with metering and a zone-focus setting. No camera? A sample scene stands in.",
    panel: ".stage-preview",
    enter: () => {},
    done: (s) => s.liveOpened,
    skip: () => {},
  },
  {
    id: "finish",
    title: "Take this setup outside",
    instruction: "Save the camera and lens to My Leica Bag, then go and shoot.",
    panel: ".stage-setup",
    enter: (a) => a.setDemoSubject(null),
    done: () => false,
    skip: () => {},
  },
];

export interface StepTiming {
  id: DemoStep["id"];
  seconds: number;
  skipped: boolean;
}

/** Total time and whether the demo fit its one-minute budget. */
export function demoSummary(timings: StepTiming[]): { totalSec: number; underBudget: boolean; skipped: number } {
  const totalSec = timings.reduce((a, t) => a + t.seconds, 0);
  return { totalSec, underBudget: totalSec <= DEMO.budgetSec, skipped: timings.filter((t) => t.skipped).length };
}
