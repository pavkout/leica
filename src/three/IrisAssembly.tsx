// The live iris: blades with the opening cut out, and the dark interior behind
// it. Always procedural, because its shape follows the f-number — a GLB lens
// only marks where it goes (ANCHORS.iris). Drawn at the anchor's origin, in
// the plane perpendicular to the lens axis (+Y).

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { Lens } from "../data/gear";
import { apertureShape, irisOutline } from "../preview/aperture";
import { PROCEDURAL, RIG_PARTS, irisOpening } from "./rig";
import type { Materials } from "./materials";

export default function IrisAssembly({ lens, fNumber, radius, materials }: { lens: Lens; fNumber: number; radius: number; materials: Materials }) {
  const geometry = useMemo(() => {
    const outer = new THREE.Shape().absarc(0, 0, radius, 0, Math.PI * 2, false);
    const r = radius * 0.94 * irisOpening(lens, fNumber);
    // Same outline as the 2D iris panel and the bokeh kernel.
    const pts = irisOutline(apertureShape(lens, fNumber), 72).map(([x, y]) => new THREE.Vector2(x * r, y * r));
    outer.holes.push(new THREE.Path(pts.reverse()));
    return new THREE.ShapeGeometry(outer, 24);
  }, [lens, fNumber, radius]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <>
      <mesh name={RIG_PARTS.iris} userData={PROCEDURAL} geometry={geometry} rotation={[-Math.PI / 2, 0, 0]} material={materials.blades} />
      <mesh userData={PROCEDURAL} position={[0, -0.006, 0]} rotation={[-Math.PI / 2, 0, 0]} material={materials.interior}>
        <circleGeometry args={[radius, 64]} />
      </mesh>
    </>
  );
}
