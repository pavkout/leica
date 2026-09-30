// Laying flat content onto a quadrilateral seen in perspective: the paper in
// the info stand's render (#39) is a rectangle in 3D, a quad on screen. The
// live text is mapped onto it with a projective transform (a homography),
// written as a CSS matrix3d with transform-origin at the top left.

export type Pt = [number, number];

/**
 * The homography taking the rectangle (0,0)–(w,h) to the quad [top-left,
 * top-right, bottom-right, bottom-left], as the nine terms of
 * X = (a x + b y + c) / (g x + h y + 1), Y = (d x + e y + f) / (g x + h y + 1).
 */
export function rectToQuad(w: number, h: number, quad: [Pt, Pt, Pt, Pt]) {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = quad;
  const dx1 = x1 - x2;
  const dx2 = x3 - x2;
  const dx3 = x0 - x1 + x2 - x3;
  const dy1 = y1 - y2;
  const dy2 = y3 - y2;
  const dy3 = y0 - y1 + y2 - y3;
  const den = dx1 * dy2 - dx2 * dy1;
  const g = den ? (dx3 * dy2 - dx2 * dy3) / den : 0;
  const hh = den ? (dx1 * dy3 - dx3 * dy1) / den : 0;
  // Unit square → quad, then scale the square to w × h.
  return {
    a: (x1 - x0 + g * x1) / w,
    b: (x3 - x0 + hh * x3) / h,
    c: x0,
    d: (y1 - y0 + g * y1) / w,
    e: (y3 - y0 + hh * y3) / h,
    f: y0,
    g: g / w,
    h: hh / h,
  };
}

export function applyQuad(m: ReturnType<typeof rectToQuad>, x: number, y: number): Pt {
  const z = m.g * x + m.h * y + 1;
  return [(m.a * x + m.b * y + m.c) / z, (m.d * x + m.e * y + m.f) / z];
}

/** CSS `matrix3d(…)` for the homography; use with `transform-origin: 0 0`. */
export function quadMatrix3d(w: number, h: number, quad: [Pt, Pt, Pt, Pt]): string {
  const m = rectToQuad(w, h, quad);
  const v = [m.a, m.d, 0, m.g, m.b, m.e, 0, m.h, 0, 0, 1, 0, m.c, m.f, 0, 1];
  return `matrix3d(${v.map((n) => +n.toFixed(8)).join(",")})`;
}
