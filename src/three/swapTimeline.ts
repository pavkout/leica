// Cinematic lens swap timeline (feature #33). Pure and deterministic: the pose
// of the outgoing and incoming lens is a function of elapsed time only, so an
// interrupted swap can jump straight to the end. The app's state has already
// changed when this runs — the animation never gates it.
//
// Poses are in the lens-mount frame (lens axis +Y): `y` slides along the axis
// (toward the subject), `rot` turns about it. The bayonet travel is illustrative.

/** Scene-graph names of the two lens groups during a swap. */
export const SWAP_GROUP = { incoming: "lens-swap-new", outgoing: "lens-swap-old" } as const;

/** Bayonet turn to unlock/lock, radians (illustrative). */
export const BAYONET_RAD = (40 * Math.PI) / 180;
/** How far a lens floats off the mount, metres. */
export const FLOAT_M = 0.07;

/** Phase boundaries, seconds. */
export const SWAP_PHASES = {
  unlock: [0, 0.22],
  away: [0.22, 0.5],
  arrive: [0.5, 0.8],
  lock: [0.8, 1.0],
} as const;
export const SWAP_DURATION_S = SWAP_PHASES.lock[1];

export interface LensPose {
  y: number;
  rot: number;
  visible: boolean;
}

export interface SwapPose {
  outgoing: LensPose;
  incoming: LensPose;
  done: boolean;
}

const ease = (t: number) => t * t * (3 - 2 * t);
const progress = ([a, b]: readonly [number, number], t: number) => ease(Math.min(1, Math.max(0, (t - a) / (b - a))));

/** Where both lenses are `t` seconds into a swap. At or past the end, the new lens is locked on and the old one gone. */
export function swapPose(t: number): SwapPose {
  if (t >= SWAP_DURATION_S) return { outgoing: { y: FLOAT_M, rot: -BAYONET_RAD, visible: false }, incoming: { y: 0, rot: 0, visible: true }, done: true };
  const unlock = progress(SWAP_PHASES.unlock, t);
  const away = progress(SWAP_PHASES.away, t);
  const arrive = progress(SWAP_PHASES.arrive, t);
  const lock = progress(SWAP_PHASES.lock, t);
  return {
    outgoing: { y: FLOAT_M * away, rot: -BAYONET_RAD * unlock, visible: t < SWAP_PHASES.away[1] },
    incoming: { y: FLOAT_M * (1 - arrive), rot: -BAYONET_RAD * (1 - lock), visible: t >= SWAP_PHASES.arrive[0] },
    done: false,
  };
}

const SETTING_KEY = "rangefinder-immersive-transitions";

/** Whether the user wants the lens-swap animation (on unless turned off; reduced motion always wins). */
export function immersiveSetting(read: (key: string) => string | null): boolean {
  return read(SETTING_KEY) !== "0";
}

export function saveImmersiveSetting(write: (key: string, value: string) => void, on: boolean) {
  write(SETTING_KEY, on ? "1" : "0");
}
