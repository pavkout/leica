// The museum's display stand (#39) as real boxes, seen from the front and a
// little above. One projection draws everything, so the base, the frame tier
// and the leather stay consistent with each other.
//
// The step between the base and the frame tier is set once, in screen terms,
// so it reads as the same gap on every side. A strict projection would
// foreshorten the front and back of the ledge into a hairline; the eye reads
// that as uneven, so the depth-wise gap is scaled to match the sides.

export const STAND = {
  /** World width and depth of the base (width 1000 = the drawing's width). */
  width: 1000,
  depth: 620,
  /** Screen pixels per unit of depth (how much of the top we see). */
  depthScale: 0.22,
  /** How much the far edge narrows, per unit of depth. */
  narrowing: 0.00016,
  /** Screen y of the base's top front edge; the base front runs from here down. */
  topFront: 230,
  bottom: 330,
  /** The visible step around the frame tier, in screen pixels, on every side. */
  gap: 13,
  /** Height of the frame tier. */
  tierHeight: 17,
  /** The black rim around the leather, in screen pixels. */
  rim: 20,
};

type Pt = [number, number];

/** World (x across, z into the scene, y up) → screen. */
export function project(x: number, z: number, y = 0, s = STAND): Pt {
  const k = 1 - z * s.narrowing;
  return [s.width / 2 + (x - s.width / 2) * k, s.topFront - z * s.depthScale - y];
}

const pts = (p: Pt[]) => p.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");

/** A horizontal rectangle at height y, inset by (sideInset, depthInset) from the base's edges. */
function top(sideInset: number, depthInset: number, y: number, s = STAND): Pt[] {
  const x0 = sideInset;
  const x1 = s.width - sideInset;
  const z0 = depthInset;
  const z1 = s.depth - depthInset;
  return [project(x0, z0, y, s), project(x1, z0, y, s), project(x1, z1, y, s), project(x0, z1, y, s)];
}

export interface StandShapes {
  viewBox: string;
  baseFront: string;
  baseTop: string;
  tierFront: string;
  tierTop: string;
  leather: string;
  /** Where the tier's shadow falls on the ledge in front of it. */
  tierShadow: string;
  /** Edge highlights: [x1, y1, x2, y2]. */
  edges: [number, number, number, number][];
  /** For seating a piece: the leather's front and back edge, as fractions of the drawing's width from its top. */
  leatherFront: number;
  leatherBack: number;
  /** The base front's vertical middle, as a fraction of the drawing's height (for the mark). */
  frontMiddle: number;
  /** The visible gaps, in screen pixels: [front, sides, back]. */
  gaps: [number, number, number];
}

export function standShapes(s = STAND): StandShapes {
  // The same screen gap on every side: sides directly, front and back through the depth scale.
  const side = s.gap;
  const depthGap = s.gap / s.depthScale;
  const rimSide = s.rim;
  const rimDepth = s.rim / s.depthScale;
  const h = s.tierHeight;

  const baseTop = top(0, 0, 0, s);
  const tierBase = top(side, depthGap, 0, s);
  const tierTop = top(side, depthGap, h, s);
  const leather = top(side + rimSide, depthGap + rimDepth, h, s);
  const tierFront: Pt[] = [tierBase[0], tierBase[1], tierTop[1], tierTop[0]];

  const minY = Math.min(...tierTop.map((p) => p[1]), ...baseTop.map((p) => p[1])) - 6;
  const height = s.bottom - minY;
  const [lf] = [leather[0][1]];
  const lb = leather[3][1];

  return {
    viewBox: `0 ${minY.toFixed(1)} ${s.width} ${height.toFixed(1)}`,
    baseFront: pts([
      [0, s.topFront],
      [s.width, s.topFront],
      [s.width, s.bottom],
      [0, s.bottom],
    ]),
    baseTop: pts(baseTop),
    tierFront: pts(tierFront),
    tierTop: pts(tierTop),
    leather: pts(leather),
    tierShadow: pts([tierBase[0], tierBase[1], [tierBase[1][0] + 6, tierBase[1][1] + 9], [tierBase[0][0] - 6, tierBase[0][1] + 9]]),
    edges: [
      [0, s.topFront + 0.5, s.width, s.topFront + 0.5],
      [tierTop[0][0], tierTop[0][1] + 0.5, tierTop[1][0], tierTop[1][1] + 0.5],
      [baseTop[3][0], baseTop[3][1] + 0.5, baseTop[2][0], baseTop[2][1] + 0.5],
      [tierTop[3][0], tierTop[3][1] + 0.5, tierTop[2][0], tierTop[2][1] + 0.5],
    ],
    leatherFront: (lf - minY) / s.width,
    leatherBack: (lb - minY) / s.width,
    frontMiddle: ((s.topFront + s.bottom) / 2 - minY) / height,
    gaps: [
      baseTop[0][1] - tierBase[0][1],
      tierBase[0][0] - project(0, depthGap, 0, s)[0],
      tierBase[3][1] - baseTop[3][1],
    ],
  };
}
