// Procedural stand-in lens (feature #2). Built along its local +Y axis — 0 at
// the mount flange, +Y toward the subject — so rings rotate about Y. Named
// parts follow RIG_PARTS, with the rotation axis in userData.axis, which is
// also what a GLB would carry (glTF "extras" become userData).

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { Lens } from "../data/gear";
import { apertureShape, irisOutline } from "../preview/aperture";
import { AXIS_Y, RIG_PARTS, apertureRingMarks, focusRingMarks, irisOpening, lensProfile } from "./rig";
import { finishMaterial, type Materials } from "./materials";

interface Props {
  lens: Lens;
  fNumber: number;
  materials: Materials;
  /** Ring being turned in 3D, drawn with a highlight band. */
  active: "aperture" | "focus" | null;
}

const RADIAL = 64;
/** Front-element sphere radius as a multiple of its rim radius, and the cap's polar half-angle. */
const CAP_CURVE = 2.4;
const CAP_THETA = Math.asin(1 / CAP_CURVE);

/** Engraved marks around a ring, placed so the set value sits under the top index. */
function useRingTexture(marks: { label: string; angle: number }[], dark: boolean) {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 64;
    const g = canvas.getContext("2d")!;
    g.fillStyle = dark ? "#141414" : "#c9c9c9";
    g.fillRect(0, 0, canvas.width, canvas.height);
    g.fillStyle = dark ? "#e8e8e8" : "#1a1a1a";
    g.font = "600 26px system-ui, sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    for (const { label, angle } of marks) {
      // CylinderGeometry's u runs with the angle about Y starting at +Z; the
      // top of the lens (local -Z) is at π. See rig.apertureRingAngle.
      const u = ((((Math.PI + angle) / (2 * Math.PI)) % 1) + 1) % 1;
      g.fillText(label, u * canvas.width, canvas.height / 2);
    }
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }, [marks, dark]);
  useEffect(() => () => texture.dispose(), [texture]);
  return texture;
}

function useIrisGeometry(lens: Lens, fNumber: number, radius: number) {
  const geometry = useMemo(() => {
    const outer = new THREE.Shape().absarc(0, 0, radius, 0, Math.PI * 2, false);
    const r = radius * 0.94 * irisOpening(lens, fNumber);
    // Same outline as the 2D iris panel and the bokeh kernel.
    const pts = irisOutline(apertureShape(lens, fNumber), 72).map(([x, y]) => new THREE.Vector2(x * r, y * r));
    outer.holes.push(new THREE.Path(pts.reverse()));
    return new THREE.ShapeGeometry(outer, 24);
  }, [lens, fNumber, radius]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return geometry;
}

function Highlight({ from, to, radius, material }: { from: number; to: number; radius: number; material: THREE.Material }) {
  return (
    <mesh position={[0, (from + to) / 2, 0]} material={material} raycast={() => null}>
      <cylinderGeometry args={[radius * 1.06, radius * 1.06, to - from + 0.002, RADIAL, 1, true]} />
    </mesh>
  );
}

export default function ProceduralLens({ lens, fNumber, materials, active }: Props) {
  const p = useMemo(() => lensProfile(lens), [lens]);
  const dark = lens.look.finish === "black";
  const barrel = finishMaterial(materials, lens.look.finish);
  const apertureMarks = useMemo(() => apertureRingMarks(lens), [lens]);
  const distanceMarks = useMemo(() => focusRingMarks(lens), [lens]);
  const ringTexture = useRingTexture(apertureMarks, dark);
  const focusTexture = useRingTexture(distanceMarks, dark);
  const iris = useIrisGeometry(lens, fNumber, p.frontRadius);
  const [f0, f1] = p.focusRing;
  const [a0, a1] = p.apertureRing;
  const barrelStart = f1;
  const barrelEnd = a0;

  return (
    <group name="lens">
      {/* Bayonet mount */}
      <mesh position={[0, 0.003, 0]} material={materials.chrome}>
        <cylinderGeometry args={[p.mountRadius, p.mountRadius, 0.006, RADIAL]} />
      </mesh>

      {/* Focus ring, with the focusing tab where the lens has one */}
      <group name={RIG_PARTS.focusRing} userData={AXIS_Y}>
        {/* Knurled grip toward the mount, engraved distance scale toward the front */}
        <mesh position={[0, f0 + (f1 - f0) * 0.3, 0]} material={barrel}>
          <cylinderGeometry args={[p.radius, p.radius, (f1 - f0) * 0.6, RADIAL]} />
        </mesh>
        <mesh position={[0, f0 + (f1 - f0) * 0.8, 0]}>
          <cylinderGeometry args={[p.radius, p.radius, (f1 - f0) * 0.4, RADIAL, 1, true]} />
          <meshStandardMaterial map={focusTexture} metalness={dark ? 0.3 : 0.9} roughness={dark ? 0.5 : 0.3} side={THREE.DoubleSide} />
        </mesh>
        {lens.look.tab && (
          <mesh position={[0, f0 + 0.004, p.radius + 0.004]} material={barrel}>
            <boxGeometry args={[0.009, 0.006, 0.009]} />
          </mesh>
        )}
      </group>

      {/* Barrel between the rings */}
      {barrelEnd > barrelStart && (
        <mesh position={[0, (barrelStart + barrelEnd) / 2, 0]} material={barrel}>
          <cylinderGeometry args={[p.radius * 0.96, p.radius * 0.96, barrelEnd - barrelStart, RADIAL]} />
        </mesh>
      )}
      {/* Index marks on the barrel, at the top of the lens (local -Z): distance, then aperture */}
      <mesh position={[0, barrelStart + 0.0015, -p.radius * 0.965]} material={materials.index}>
        <boxGeometry args={[0.0012, 0.0025, 0.0006]} />
      </mesh>
      <mesh position={[0, barrelEnd - 0.0015, -p.radius * 0.965]} material={materials.index}>
        <boxGeometry args={[0.0012, 0.0025, 0.0006]} />
      </mesh>

      {/* Aperture ring with engraved stops */}
      <mesh name={RIG_PARTS.apertureRing} userData={AXIS_Y} position={[0, (a0 + a1) / 2, 0]}>
        <cylinderGeometry args={[p.radius, p.radius, a1 - a0, RADIAL, 1, true]} />
        <meshStandardMaterial map={ringTexture} metalness={dark ? 0.3 : 0.9} roughness={dark ? 0.5 : 0.3} side={THREE.DoubleSide} />
      </mesh>

      {active === "aperture" && <Highlight from={a0} to={a1} radius={p.radius} material={materials.highlight} />}
      {active === "focus" && <Highlight from={f0} to={f1} radius={p.radius} material={materials.highlight} />}

      {/* Front bezel */}
      <mesh position={[0, p.length - 0.0015, 0]} material={barrel}>
        <cylinderGeometry args={[p.radius * 0.98, p.radius, 0.003, RADIAL, 1, true]} />
      </mesh>
      <mesh position={[0, p.length, 0]} rotation={[-Math.PI / 2, 0, 0]} material={materials.paint}>
        <ringGeometry args={[p.frontRadius, p.radius * 0.98, RADIAL]} />
      </mesh>

      {/* Iris behind the front element: blades with the opening cut out, dark interior behind */}
      <mesh name={RIG_PARTS.iris} geometry={iris} position={[0, p.length - 0.006, 0]} rotation={[-Math.PI / 2, 0, 0]} material={materials.blades} />
      <mesh position={[0, p.length - 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]} material={materials.interior}>
        <circleGeometry args={[p.frontRadius, RADIAL]} />
      </mesh>

      {/* Front element: a shallow glass cap */}
      <mesh position={[0, p.length - 0.004 - CAP_CURVE * p.frontRadius * Math.cos(CAP_THETA), 0]} material={materials.glass}>
        <sphereGeometry args={[CAP_CURVE * p.frontRadius, RADIAL, 8, 0, Math.PI * 2, 0, CAP_THETA]} />
      </mesh>
    </group>
  );
}
