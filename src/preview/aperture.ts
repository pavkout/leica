// The shape of the lens opening, which is the shape of every out-of-focus
// highlight. All coordinates are in "aperture units": the fully round opening
// is the unit circle.

import type { Lens } from "../data/gear";

/** Used when a lens's blade count isn't published. */
export const GENERIC_BLADES = 9;

export interface ApertureShape {
  blades: number;
  /** 1 = perfectly round, 0 = straight-edged polygon. */
  roundness: number;
  /** Polygon rotation in radians. */
  rotation: number;
  /**
   * Mechanical vignetting ("cat's eye"): the opening seen from the frame
   * corner is clipped by the lens barrel. The clip circle's offset at the
   * frame corner, in aperture units; 0 disables it.
   */
  catEye: number;
}

/** Stops closed down from wide open. */
export function stopsDown(lens: Lens, fNumber: number) {
  return Math.max(0, 2 * Math.log2(fNumber / lens.maxAperture));
}

export function apertureShape(lens: Lens, fNumber: number): ApertureShape {
  const down = stopsDown(lens, fNumber);
  // Rounded blades form a circle wide open and a polygon with curved sides
  // once stopped down; the sides never become fully straight.
  const roundness = Math.max(0.35, 1 - down / 2.5);
  // Fast lenses vignette most at full aperture; it's gone ~2 stops down.
  const wideOpenCatEye = lens.maxAperture <= 1.0 ? 0.55 : lens.maxAperture <= 1.4 ? 0.42 : lens.maxAperture <= 2 ? 0.28 : 0.15;
  const catEye = wideOpenCatEye * Math.max(0, 1 - down / 2);
  return {
    blades: lens.apertureBlades ?? GENERIC_BLADES,
    roundness,
    rotation: Math.PI / 2,
    catEye,
  };
}

/** Distance from the centre to the opening's edge in direction `theta`. */
export function apertureRadius(theta: number, shape: Pick<ApertureShape, "blades" | "roundness" | "rotation">) {
  const sector = (2 * Math.PI) / shape.blades;
  const local = ((((theta - shape.rotation) % sector) + sector) % sector) - sector / 2;
  const polygon = Math.cos(sector / 2) / Math.cos(local);
  return polygon + (1 - polygon) * shape.roundness;
}

/**
 * Evenly spread sample points filling the opening (a golden-angle spiral
 * stretched to the aperture outline). Used as the blur kernel.
 */
export function kernelSamples(count: number, shape: ApertureShape): [number, number][] {
  const golden = Math.PI * (3 - Math.sqrt(5));
  const points: [number, number][] = [];
  for (let i = 0; i < count; i++) {
    const r = Math.sqrt((i + 0.5) / count);
    const theta = i * golden;
    const edge = apertureRadius(theta, shape);
    points.push([Math.cos(theta) * r * edge, Math.sin(theta) * r * edge]);
  }
  return points;
}
