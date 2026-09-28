// The screen-transition iris: a regular N-blade diaphragm. Each side of the
// opening, extended past its end, is a blade's leading edge; the extended
// sides split everything outside the opening into N congruent blades.

export type Point = readonly [number, number];

/** The opening's corners: a regular polygon with inradius `r`, first corner at angle `rotation`. */
export function irisCorners(blades: number, r: number, rotation: number, cx = 0, cy = 0): Point[] {
  const rc = r / Math.cos(Math.PI / blades);
  return Array.from({ length: blades }, (_, k) => {
    const a = rotation + (2 * Math.PI * k) / blades;
    return [cx + rc * Math.cos(a), cy + rc * Math.sin(a)] as const;
  });
}

/**
 * Blade `k` as a quadrilateral: the opening's side k+1, plus the extensions of
 * sides k and k+1, cut off at distance `reach`. With `reach` past the screen's
 * corners the blades cover everything outside the opening, and at `r` = 0
 * they close to N sectors meeting in the centre.
 */
export function irisBlades(blades: number, r: number, rotation: number, reach: number, cx = 0, cy = 0): Point[][] {
  const v = irisCorners(blades, r, rotation, cx, cy);
  // Side directions, from the angle of each side (defined even when r = 0).
  const dir = (k: number): Point => {
    const a = rotation + (2 * Math.PI * (k + 0.5)) / blades + Math.PI / 2;
    return [Math.cos(a), Math.sin(a)];
  };
  return v.map((_, k) => {
    const a = v[(k + 1) % blades];
    const b = v[(k + 2) % blades];
    const da = dir(k);
    const db = dir(k + 1);
    return [a, [a[0] + da[0] * reach, a[1] + da[1] * reach], [b[0] + db[0] * reach, b[1] + db[1] * reach], b];
  });
}

/** Inradius that leaves a `w`×`h` screen fully uncovered. */
export function openRadius(w: number, h: number) {
  return Math.hypot(w, h) / 2 + 2;
}
