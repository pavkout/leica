// Lens X-Ray (feature #5): schematic glass groups, the calculated focus
// movement and a representative ray bundle, drawn in the lens-local frame
// (origin at the mount flange, +Y toward the subject). Rendered next to the
// lens inside the body's lens-mount anchor, so it works for procedural and
// GLB lenses alike.

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { Lens } from "../data/gear";
import { xrayLayout } from "./optics";

/** Node the Rig slides along +Y by the focus extension (with the iris anchor). */
export const OPTICS_BLOCK = "optics-block";

const RAY_COUNT = 5;

function biconvex(radius: number, thickness: number) {
  // Lathe profile: two shallow arcs meeting at the rim, as a generic positive group.
  const pts: THREE.Vector2[] = [];
  const n = 12;
  for (let i = 0; i <= n; i++) {
    const r = (radius * i) / n;
    pts.push(new THREE.Vector2(r, (thickness / 2) * (1 - (r / radius) ** 2)));
  }
  for (let i = n; i >= 0; i--) {
    const r = (radius * i) / n;
    pts.push(new THREE.Vector2(r, -(thickness / 2) * (1 - (r / radius) ** 2)));
  }
  return new THREE.LatheGeometry(pts, 48);
}

export default function SchematicOptics({ lens, focusMm, fNumber, rays }: { lens: Lens; focusMm: number; fNumber: number; rays: boolean }) {
  const { scene, invalidate } = useThree();
  const layout = useMemo(() => xrayLayout(lens, focusMm, fNumber, RAY_COUNT), [lens, focusMm, fNumber]);
  const infinity = useMemo(() => xrayLayout(lens, Infinity, fNumber, RAY_COUNT), [lens, fNumber]);

  const glassMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#7fb4ff", transparent: true, opacity: 0.35, roughness: 0.1, metalness: 0, depthWrite: false, side: THREE.DoubleSide }),
    [],
  );
  const groups = useMemo(() => layout.groups.map((g) => ({ y: g.y, geometry: biconvex(g.radius, g.thickness) })), [layout.groups]);
  useEffect(() => () => groups.forEach((g) => g.geometry.dispose()), [groups]);

  // Rays and the image-plane marker draw over the body: the image plane is inside it.
  const rayMaterial = useMemo(() => new THREE.LineBasicMaterial({ color: "#ffd54f", transparent: true, opacity: 0.9, depthTest: false }), []);
  const planeMaterial = useMemo(() => new THREE.MeshBasicMaterial({ color: "#ffd54f", transparent: true, opacity: 0.25, depthTest: false, side: THREE.DoubleSide }), []);
  const rayGeometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(RAY_COUNT * 2 * 2 * 3), 3));
    return g;
  }, []);
  useEffect(
    () => () => {
      glassMaterial.dispose();
      rayMaterial.dispose();
      planeMaterial.dispose();
      rayGeometry.dispose();
    },
    [glassMaterial, rayMaterial, planeMaterial, rayGeometry],
  );

  // Rays bend at the ideal-lens plane, which travels with the optical block as
  // it animates, so the drawing stays attached mid-animation.
  const lastOffset = useRef<number | null>(null);
  const lastLayout = useRef<typeof layout | null>(null);
  useFrame(() => {
    if (!rays) return;
    const block = scene.getObjectByName(OPTICS_BLOCK);
    const offset = block ? block.position.y : layout.extension;
    if (offset === lastOffset.current && lastLayout.current === layout) return;
    lastOffset.current = offset;
    lastLayout.current = layout;
    const bendY = infinity.thinLensY + offset;
    const pos = rayGeometry.getAttribute("position") as THREE.BufferAttribute;
    layout.rays.forEach((ray, i) => {
      const [[x0, y0], [x1], [x2, y2]] = ray.points;
      const k = i * 4;
      pos.setXYZ(k, x0, y0, 0);
      pos.setXYZ(k + 1, x1, bendY, 0);
      pos.setXYZ(k + 2, x1, bendY, 0);
      pos.setXYZ(k + 3, x2, y2, 0);
    });
    pos.needsUpdate = true;
    rayGeometry.computeBoundingSphere();
    invalidate();
  });

  return (
    <group name="xray">
      <group name={OPTICS_BLOCK}>
        {groups.map((g, i) => (
          <mesh key={i} geometry={g.geometry} material={glassMaterial} position={[0, g.y, 0]} raycast={() => null} />
        ))}
      </group>
      {rays && (
        <>
          <lineSegments geometry={rayGeometry} material={rayMaterial} renderOrder={10} raycast={() => null} />
          {/* Image plane: a 36 × 24 mm frame, perpendicular to the lens axis */}
          <mesh position={[0, layout.imagePlaneY, 0]} rotation={[Math.PI / 2, 0, 0]} material={planeMaterial} renderOrder={9} raycast={() => null}>
            <planeGeometry args={[0.036, 0.024]} />
          </mesh>
        </>
      )}
    </group>
  );
}
