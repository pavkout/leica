// Exploded camera view / mechanical education (feature #21). Pure and
// decoupled from the optical simulation: a generic film M body as simplified
// boxes (illustrative — no engineering drawings are used), an explode
// animation that provably never makes parts intersect, and a shutter-release
// state machine driven only by a scrub position and a shutter time.

export type PartId = "topPlate" | "rangefinder" | "finder" | "shutter" | "filmGate" | "pressurePlate" | "winding";

export type Vec3 = [number, number, number];

/** Axis-aligned box in body millimetres: x left→right seen from the front, y up, z back→front. */
export interface Box {
  min: Vec3;
  max: Vec3;
}

export interface Part {
  id: PartId;
  label: string;
  /** Simplified assembled position. Illustrative proportions of a generic M body (138 × 77 × 35 mm envelope). */
  box: Box;
  /** Offset at full explode, mm. */
  explode: Vec3;
  what: string;
  /** General, widely documented context only; omitted rather than guessed. */
  history?: string;
}

export const ANATOMY_PROVENANCE = {
  kind: "illustrative" as const,
  notes:
    "Simplified boxes, not engineering drawings: positions and sizes are generic and only show how the subsystems relate. The shutter timing uses an illustrative curtain travel time. Not service or repair information.",
};

export const BODY_ENVELOPE: Box = { min: [0, 0, 0], max: [138, 77, 35] };

export const PARTS: Part[] = [
  {
    id: "topPlate",
    label: "Top plate",
    box: { min: [0, 72, 0], max: [138, 77, 35] },
    explode: [0, 44, 0],
    what: "The cover over the finder and rangefinder. It carries the shutter-speed dial, the release button, the advance lever and the frame counter.",
  },
  {
    id: "rangefinder",
    label: "Rangefinder",
    box: { min: [6, 59, 8], max: [66, 72, 35] },
    explode: [-14, 24, 0],
    what: "Two windows a known distance apart (the base). A roller at the lens mount follows the focusing cam of the lens and swings a mirror or prism, moving the secondary image until it overlaps the main one. When they line up, the lens is focused at the subject's distance.",
    history: "The M3 (1954) combined the viewfinder and rangefinder in one eyepiece and introduced the M bayonet.",
  },
  {
    id: "finder",
    label: "Viewfinder",
    box: { min: [66, 59, 8], max: [132, 72, 35] },
    explode: [14, 24, 0],
    what: "A bright-line finder: you see the scene directly, life-size or slightly reduced, with illuminated framelines for the mounted lens. The framelines move as you focus to correct parallax, since the finder sits above and to the side of the lens.",
  },
  {
    id: "shutter",
    label: "Shutter",
    box: { min: [30, 12, 16], max: [108, 59, 30] },
    explode: [0, 0, 60],
    what: "A focal-plane shutter: two cloth curtains running horizontally just in front of the film. The exposure time is the delay between the first curtain opening and the second closing. At fast speeds the second starts before the first has finished, so a slit crosses the frame.",
  },
  {
    id: "filmGate",
    label: "Film gate",
    box: { min: [36, 18, 10], max: [102, 52, 16] },
    explode: [0, 0, 0],
    what: "The 36 × 24 mm opening that defines the frame. Rails either side hold the film at the right distance from the lens mount, so the focal plane is where the rangefinder expects it.",
  },
  {
    id: "pressurePlate",
    label: "Pressure plate",
    box: { min: [36, 18, 3], max: [102, 52, 9] },
    explode: [0, 0, -60],
    what: "A sprung plate behind the film that presses it flat against the gate rails, keeping the whole frame in the focal plane.",
  },
  {
    id: "winding",
    label: "Winding system",
    box: { min: [112, 8, 4], max: [134, 59, 30] },
    explode: [40, 0, 0],
    what: "One stroke of the advance lever turns a sprocket that moves the film one frame, winds it onto the take-up spool, re-tensions both shutter curtains and advances the frame counter. The shutter can't fire twice without a wind.",
  },
];

/** A part's box at explode amount `t` (0 assembled, 1 fully exploded). */
export function boxAt(part: Part, t: number): Box {
  const k = Math.min(1, Math.max(0, t));
  const add = (v: Vec3): Vec3 => [v[0] + part.explode[0] * k, v[1] + part.explode[1] * k, v[2] + part.explode[2] * k];
  return { min: add(part.box.min), max: add(part.box.max) };
}

/** True when two boxes share volume (touching faces don't count). */
export function intersects(a: Box, b: Box, eps = 1e-9): boolean {
  for (let i = 0; i < 3; i++) if (a.max[i] <= b.min[i] + eps || b.max[i] <= a.min[i] + eps) return false;
  return true;
}

/** Every pair of parts that intersects at explode amount `t`. */
export function collisions(t: number, parts: Part[] = PARTS): [PartId, PartId][] {
  const out: [PartId, PartId][] = [];
  for (let i = 0; i < parts.length; i++)
    for (let j = i + 1; j < parts.length; j++) if (intersects(boxAt(parts[i], t), boxAt(parts[j], t))) out.push([parts[i].id, parts[j].id]);
  return out;
}

/**
 * Painter's order for the oblique view, which looks from front-right-above
 * (it shows front, top and right faces). For two non-intersecting boxes the
 * first separating axis, in order depth, height, width, decides which lies
 * farther from the viewer; that one is drawn first.
 */
export function farther(a: Box, b: Box): -1 | 0 | 1 {
  for (const i of [2, 1, 0]) {
    if (a.max[i] <= b.min[i]) return -1;
    if (b.max[i] <= a.min[i]) return 1;
  }
  return 0;
}

export function drawOrder(boxes: { id: PartId; box: Box }[]): PartId[] {
  const rest = [...boxes];
  const out: PartId[] = [];
  while (rest.length) {
    // Next: a box that no remaining box must be drawn before.
    const i = rest.findIndex((c) => rest.every((o) => o === c || farther(o.box, c.box) !== -1));
    const [next] = rest.splice(Math.max(0, i), 1);
    out.push(next.id);
  }
  return out;
}

// --- Shutter release sequence -------------------------------------------------

/** Illustrative time for one curtain to cross the 36 mm gate. Not a measured value for any model. */
export const CURTAIN_TRAVEL_S = 0.018;

/** Share of the scrubber given to the (not-to-time) winding stroke at the end. */
export const WIND_SHARE = 0.2;

export type ShutterPhase = "ready" | "first-curtain" | "open" | "slit" | "second-curtain" | "closed" | "winding";

export interface ShutterState {
  phase: ShutterPhase;
  /** Real time since the release, seconds (null during the winding stroke, which isn't to time). */
  timeS: number | null;
  /** Fraction of the gate width the first curtain has uncovered (0–1), from the left. */
  firstEdge: number;
  /** Fraction of the gate width the second curtain has covered again (0–1). */
  secondEdge: number;
  /** Width of the exposing opening as a fraction of the gate (the slit when < 1). */
  openWidth: number;
  /** Fraction of the winding stroke completed (0 until the winding phase). */
  wind: number;
}

/** Real duration of the release, seconds: first curtain starts at 0, second at `shutterS`, both take the travel time. */
export function releaseDuration(shutterS: number) {
  return shutterS + CURTAIN_TRAVEL_S;
}

/** The shutter's state at scrub position `p` (0–1) for exposure time `shutterS`. */
export function shutterAt(p: number, shutterS: number): ShutterState {
  const q = Math.min(1, Math.max(0, p));
  const release = 1 - WIND_SHARE;
  if (q > release) {
    const wind = (q - release) / WIND_SHARE;
    return { phase: "winding", timeS: null, firstEdge: 1 - wind, secondEdge: 1 - wind, openWidth: 0, wind };
  }
  const timeS = (q / release) * releaseDuration(shutterS);
  const firstEdge = Math.min(1, timeS / CURTAIN_TRAVEL_S);
  const secondEdge = Math.min(1, Math.max(0, (timeS - shutterS) / CURTAIN_TRAVEL_S));
  const openWidth = Math.max(0, firstEdge - secondEdge);
  const slitMode = shutterS < CURTAIN_TRAVEL_S;
  let phase: ShutterPhase;
  if (timeS <= 0) phase = "ready";
  else if (secondEdge >= 1) phase = "closed";
  else if (slitMode && secondEdge > 0) phase = "slit";
  else if (secondEdge > 0) phase = "second-curtain";
  else if (firstEdge < 1) phase = slitMode && timeS > shutterS ? "slit" : "first-curtain";
  else phase = "open";
  return { phase, timeS, firstEdge, secondEdge, openWidth, wind: 0 };
}

/** How long a point at gate position `x` (0–1) is uncovered: always the shutter time, whatever the slit width. */
export function exposureAt(x: number, shutterS: number): number {
  const opens = x * CURTAIN_TRAVEL_S;
  const closes = shutterS + x * CURTAIN_TRAVEL_S;
  return closes - opens;
}

/** Scrub positions of the sequence's key moments, for step buttons. */
export function keyMoments(shutterS: number): { p: number; label: string }[] {
  const release = 1 - WIND_SHARE;
  const d = releaseDuration(shutterS);
  const at = (s: number) => (s / d) * release;
  const m = [
    { p: 0, label: "Release pressed" },
    { p: at(Math.min(shutterS, CURTAIN_TRAVEL_S) / 2), label: "First curtain moving" },
    shutterS >= CURTAIN_TRAVEL_S
      ? { p: at(CURTAIN_TRAVEL_S + (shutterS - CURTAIN_TRAVEL_S) / 2), label: "Fully open" }
      : { p: at(CURTAIN_TRAVEL_S / 2 + shutterS / 2), label: "Slit crossing" },
    { p: at(shutterS + CURTAIN_TRAVEL_S / 2), label: "Second curtain closing" },
    { p: release, label: "Closed" },
    { p: 1, label: "Wound on" },
  ];
  return m.filter((x, i) => i === 0 || x.p > m[i - 1].p);
}

export const PHASE_TEXT: Record<ShutterPhase, string> = {
  ready: "Wound and ready: both curtains are tensioned and the first covers the gate.",
  "first-curtain": "The first curtain runs across, uncovering the film.",
  open: "The whole frame is uncovered. The second curtain waits for the shutter time.",
  slit: "Faster than the curtain travel, the second curtain follows closely: a slit crosses the film. Every point still gets the same exposure time.",
  "second-curtain": "The second curtain runs across, covering the film again.",
  closed: "Exposure over: the second curtain covers the gate.",
  winding: "Winding on: both curtains return together (the film stays covered), the film moves one frame and the counter advances.",
};
