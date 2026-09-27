// Lens X-Ray layout (feature #5). Pure and three.js-free.
//
// What's calculated vs schematic:
// - calculated: focus extension (thin-lens f²/(d−f), assuming unit focusing),
//   entrance-pupil diameter (f/N), where the rays converge (the image plane).
// - published: the M-mount flange focal distance (27.80 mm).
// - schematic: the number, shape and placement of the glass groups. No
//   per-lens optical prescription is available, so none is inferred.
//
// Lens-local frame, metres: origin at the mount flange, +Y toward the subject
// (same as the 3D lens models). The image plane sits behind the flange, at -Y.

import type { Lens } from "../data/gear";
import type { Provenance } from "../data/provenance";
import { lensProfile } from "./rig";
import { focusExtension } from "../physics/optics";

/** Leica M bayonet flange focal distance (mount flange to film/sensor plane). */
export const M_FLANGE_FOCAL_MM = 27.8;

export const XRAY_PROVENANCE = {
  groups: {
    kind: "illustrative",
    notes: "Schematic glass groups — not this lens's optical prescription, which isn't available. Real designs have more elements and different spacing.",
  } satisfies Provenance,
  focus: {
    kind: "calculated",
    notes: "Focus movement is the thin-lens extension f²/(d−f), assuming the whole optical block moves (unit focusing). Some lenses use floating elements instead.",
  } satisfies Provenance,
  rays: {
    kind: "calculated",
    notes: "Rays enter through the entrance pupil (diameter f/N) and converge on the image plane, 27.80 mm behind the M-mount flange (published). Real rays refract at every surface; these are drawn as through an ideal thin lens.",
  } satisfies Provenance,
};

/** How far the optics move out from their infinity position to focus at `focusMm`: the shared engine's thin-lens extension. */
export const unitFocusExtensionMm = focusExtension;

export interface SchematicGroup {
  /** Centre of the group along the lens axis, metres (at infinity focus). */
  y: number;
  radius: number;
  thickness: number;
}

export interface Ray {
  /** Polyline in the lens-local frame (x, y), metres: enters from the front, bends at the thin-lens plane, reaches the image plane. */
  points: [number, number][];
}

export interface XrayLayout {
  groups: SchematicGroup[];
  /** Diaphragm position at infinity focus (the iris anchor), metres. */
  stopY: number;
  /** Optics movement for the current focus distance, metres. */
  extension: number;
  /** Image (sensor/film) plane, metres (negative: behind the flange, inside the body). */
  imagePlaneY: number;
  /** Where the ideal thin lens sits so an object at the focus distance images onto the image plane, metres. */
  thinLensY: number;
  /** Entrance-pupil radius, metres. */
  pupilRadius: number;
  rays: Ray[];
}

/**
 * Schematic X-Ray layout for a lens at a focus distance and f-number. The
 * group geometry is schematic (two groups either side of the stop); focus
 * movement, pupil size and ray convergence are calculated.
 */
export function xrayLayout(lens: Lens, focusMm: number, fNumber: number, rayCount = 5): XrayLayout {
  const p = lensProfile(lens);
  const f = lens.focalMm / 1000;
  const stopY = p.length - 0.006;
  const extension = unitFocusExtensionMm(lens.focalMm, focusMm) / 1000;
  const imagePlaneY = -M_FLANGE_FOCAL_MM / 1000;
  // Image distance v = f + extension; the ideal thin lens sits v in front of the image plane.
  const thinLensY = imagePlaneY + f + extension;
  const pupilRadius = f / fNumber / 2;

  const r = p.frontRadius * 0.92;
  // The stop sits 6 mm behind the front bezel, so the front group fits in that gap on every lens.
  const front = { y: stopY + 0.0028, radius: r, thickness: 0.004 };
  const rear = { y: Math.max(0.006, stopY - Math.min(0.016, p.length * 0.3)), radius: r * 0.85, thickness: Math.min(0.01, p.length * 0.18) };

  // A parallel-ish bundle from an on-axis object at the focus distance: rays
  // enter across the pupil, and all meet on-axis at the image plane.
  const enterY = p.length + 0.03;
  const rays: Ray[] = [];
  for (let i = 0; i < rayCount; i++) {
    const h = rayCount === 1 ? 0 : pupilRadius * (-1 + (2 * i) / (rayCount - 1));
    // Slope of the incoming ray from the object point (0, thinLensY + d) to height h at the lens plane.
    const d = Number.isFinite(focusMm) ? focusMm / 1000 : Infinity;
    const inSlope = Number.isFinite(d) ? h / d : 0; // Δx per metre travelled toward −Y
    const xEnter = h + inSlope * (enterY - thinLensY);
    rays.push({ points: [[xEnter, enterY], [h, thinLensY], [0, imagePlaneY]] });
  }

  return { groups: [front, rear], stopY, extension, imagePlaneY, thinLensY, pupilRadius, rays };
}
