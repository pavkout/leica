// How the illustrative anatomy boxes (anatomy.ts) are drawn: an oblique
// projection where depth recedes up and to the right. Shared by the anatomy
// tool (#21) and the museum's "Inside the camera" room (#39).

import { PARTS, boxAt, type Box } from "./anatomy";

const KX = 0.45 * Math.cos(Math.PI / 5);
const KY = 0.45 * Math.sin(Math.PI / 5);

export const proj = (x: number, y: number, z: number): [number, number] => [x - z * KX, -(y - z * KY)];

const pts = (p: [number, number][]) => p.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");

/** The three visible faces of a box as SVG polygon points, and a label anchor on its top. */
export function faces(b: Box) {
  const [x0, y0, z0] = b.min;
  const [x1, y1, z1] = b.max;
  return {
    front: pts([proj(x0, y0, z1), proj(x1, y0, z1), proj(x1, y1, z1), proj(x0, y1, z1)]),
    top: pts([proj(x0, y1, z1), proj(x1, y1, z1), proj(x1, y1, z0), proj(x0, y1, z0)]),
    right: pts([proj(x1, y0, z1), proj(x1, y0, z0), proj(x1, y1, z0), proj(x1, y1, z1)]),
    label: proj((x0 + x1) / 2, y1, (z0 + z1) / 2),
  };
}

/** A fixed view box covering both the assembled and fully exploded layouts, so nothing rescales while animating. */
export const ANATOMY_VIEWBOX = (() => {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const t of [0, 1])
    for (const p of PARTS) {
      const b = boxAt(p, t);
      for (const x of [b.min[0], b.max[0]])
        for (const y of [b.min[1], b.max[1]])
          for (const z of [b.min[2], b.max[2]]) {
            const [sx, sy] = proj(x, y, z);
            xs.push(sx);
            ys.push(sy);
          }
    }
  const pad = 8;
  const minX = Math.min(...xs) - pad;
  const minY = Math.min(...ys) - pad;
  return `${minX.toFixed(0)} ${minY.toFixed(0)} ${(Math.max(...xs) - minX + pad).toFixed(0)} ${(Math.max(...ys) - minY + pad).toFixed(0)}`;
})();
