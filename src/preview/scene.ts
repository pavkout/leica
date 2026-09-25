// The preview's world: a dusk street seen from eye height. Units are metres;
// the camera sits at the origin looking down +z, lens 1.5 m above the ground.
// Every object is a flat layer at one distance, which is what lets each one
// get its own physically correct blur.

import type { SpriteId } from "./sprites";

export const CAMERA_HEIGHT_M = 1.5;

export interface Light {
  x: number;
  y: number;
  z: number;
  color: [number, number, number];
  /** Relative brightness; 1 is a typical street lamp. */
  power: number;
}

interface LayerBase {
  /** Distance used for the layer's blur. */
  z: number;
  lights: Light[];
}

export interface SpriteLayer extends LayerBase {
  kind: "sprite";
  sprite: SpriteId;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

export interface GroundLayer extends LayerBase {
  kind: "ground";
  zNear: number;
  zFar: number;
}

export type Layer = SpriteLayer | GroundLayer;

const WARM: [number, number, number] = [1, 0.72, 0.42];
const FAIRY: [number, number, number] = [1, 0.84, 0.58];
const TAIL: [number, number, number] = [1, 0.08, 0.06];
const HEAD: [number, number, number] = [0.9, 0.93, 1];

export const LAMP_POSTS: { x: number; z: number }[] = [
  { x: -3.8, z: 6 },
  { x: 3.8, z: 11 },
  { x: -3.8, z: 18 },
  { x: 3.8, z: 30 },
  { x: -3.8, z: 50 },
  { x: 3.8, z: 85 },
  { x: -3.8, z: 140 },
];

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

function lamp(x: number, z: number): SpriteLayer {
  // The arm reaches toward the street, so mirror it on the right-hand side.
  const w = 0.8;
  const [x0, x1] = x < 0 ? [x - 0.15, x - 0.15 + w] : [x + 0.15 - w, x + 0.15];
  const headX = x < 0 ? x0 + 0.61 * w : x1 - 0.61 * w;
  return {
    kind: "sprite",
    sprite: "lamp",
    z,
    x0: x < 0 ? x0 : x1,
    x1: x < 0 ? x1 : x0,
    y0: 0,
    y1: 4.4,
    lights: [{ x: headX, y: 4.05, z, color: WARM, power: 2.2 }],
  };
}

function car(x: number, z: number, facing: "away" | "toward"): SpriteLayer {
  const lights: Light[] =
    facing === "away"
      ? [
          { x: x - 0.68, y: 0.9, z, color: TAIL, power: 0.8 },
          { x: x + 0.68, y: 0.9, z, color: TAIL, power: 0.8 },
        ]
      : [
          { x: x - 0.62, y: 0.75, z, color: HEAD, power: 3 },
          { x: x + 0.62, y: 0.75, z, color: HEAD, power: 3 },
        ];
  return { kind: "sprite", sprite: "car", z, x0: x - 0.9, x1: x + 0.9, y0: 0, y1: 1.4, lights };
}

function facade(z: number): SpriteLayer {
  const rand = seeded(99);
  const lights: Light[] = [];
  // Fairy lights hung in the café window (x −4…4, y 0.4…2.4 on the facade).
  for (let i = 0; i < 64; i++) {
    lights.push({
      x: -3.8 + rand() * 7.6,
      y: 0.5 + rand() * 1.9,
      z: z - 0.05,
      color: FAIRY,
      power: 0.25 + rand() * 0.3,
    });
  }
  // A string of bulbs under the awning.
  for (let i = 0; i <= 28; i++) {
    const t = i / 28;
    const x = -9 + t * 18;
    lights.push({ x, y: 3.3 - Math.sin(t * Math.PI * 3) ** 2 * 0.25, z: z - 0.3, color: WARM, power: 0.35 });
  }
  return { kind: "sprite", sprite: "facade", z, x0: -18, x1: 18, y0: 0, y1: 13, lights };
}

export const GROUND_SLICES: [number, number][] = (() => {
  const slices: [number, number][] = [];
  const edges = [0.3];
  while (edges[edges.length - 1] < 400) edges.push(edges[edges.length - 1] * 1.42);
  for (let i = 0; i < edges.length - 1; i++) slices.push([edges[i], edges[i + 1]]);
  slices.push([edges[edges.length - 1], Infinity]);
  return slices;
})();

/**
 * Builds the scene, far to near. The subject stands at the focus distance and
 * the café facade at `backgroundM` (both may be `Infinity`).
 */
export function buildScene(focusM: number, backgroundM: number): Layer[] {
  const layers: Layer[] = [];

  const skylineZ = 1500;
  const skylineRand = seeded(5);
  const skylineLights: Light[] = [];
  for (let i = 0; i < 40; i++) {
    skylineLights.push({
      x: (skylineRand() - 0.5) * 3000,
      y: 8 + skylineRand() * 60,
      z: skylineZ,
      color: skylineRand() < 0.2 ? TAIL : WARM,
      power: 0.6,
    });
  }
  layers.push({ kind: "sprite", sprite: "skyline", z: skylineZ, x0: -2500, x1: 2500, y0: 0, y1: 140, lights: skylineLights });

  for (const [zNear, zFar] of GROUND_SLICES) {
    const z = Number.isFinite(zFar) ? Math.sqrt(zNear * zFar) : zNear * 2;
    layers.push({ kind: "ground", z, zNear, zFar, lights: [] });
  }

  for (const p of LAMP_POSTS) layers.push(lamp(p.x, p.z));
  layers.push(
    { kind: "sprite", sprite: "tree", z: 14, x0: -8.5, x1: -4.5, y0: 0, y1: 6, lights: [] },
    { kind: "sprite", sprite: "tree", z: 26, x0: 4.8, x1: 8.8, y0: 0, y1: 6, lights: [] },
    { kind: "sprite", sprite: "tree", z: 45, x0: -9, x1: -5, y0: 0, y1: 6, lights: [] },
    car(1.6, 22, "away"),
    car(-1.5, 38, "toward"),
    car(1.7, 64, "away"),
  );

  if (Number.isFinite(backgroundM) && backgroundM < 400) layers.push(facade(backgroundM));

  if (Number.isFinite(focusM) && focusM < 400) {
    layers.push({ kind: "sprite", sprite: "person", z: focusM, x0: -0.08, x1: 0.48, y0: 0, y1: 1.76, lights: [] });
  }

  layers.push({ kind: "sprite", sprite: "branch", z: 0.65, x0: -0.78, x1: -0.08, y0: 1.52, y1: 2.32, lights: [] });

  // Far to near. A ground slice is ordered by its far edge so it's drawn
  // before anything standing on it.
  const order = (l: Layer) => (l.kind === "ground" ? l.zFar : l.z);
  return layers.sort((a, b) => order(b) - order(a));
}
