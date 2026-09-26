// Procedural stand-in M body (feature #2). Generic M proportions — not any
// model's drawing — with the finish from the catalogue. Origin at the body's
// centre, +Z out of the front (lens side), +Y up; seen from the front, the
// photographer's right hand is at -X. Only film bodies get the advance lever
// and rewind knob.

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { shutterSpeeds, type Body } from "../data/gear";
import { AXIS_Y, BODY, MOUNT_CENTER, RIG_PARTS, dialDetents, dialStep } from "./rig";
import { finishMaterial, type Materials } from "./materials";

function roundedSlab(width: number, depth: number, height: number) {
  const r = depth * 0.46;
  const w = width / 2 - r;
  const d = depth / 2;
  const s = new THREE.Shape();
  s.moveTo(-w, -d);
  s.lineTo(w, -d);
  s.absarc(w, 0, d, -Math.PI / 2, Math.PI / 2, false);
  s.lineTo(-w, d);
  s.absarc(-w, 0, d, Math.PI / 2, (3 * Math.PI) / 2, false);
  const g = new THREE.ExtrudeGeometry(s, { depth: height, bevelEnabled: true, bevelSize: 0.0006, bevelThickness: 0.0006, bevelSegments: 2, curveSegments: 24 });
  // Extrusion runs along +Z; stand it up so it runs along +Y.
  g.rotateX(-Math.PI / 2);
  return g;
}

const DIAL_R = 0.0095;

/**
 * Speeds engraved on the dial's top face. A cylinder cap maps direction θ
 * (x = sin θ, z = cos θ) to uv (0.5 + 0.5 cos θ, 0.5 + 0.5 sin θ); the index
 * sits at +Z (θ = 0), so detent i is drawn at θ = -i·step.
 */
function useDialTexture(body: Body, dark: boolean) {
  const texture = useMemo(() => {
    const size = 512;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const g = canvas.getContext("2d")!;
    g.fillStyle = dark ? "#151515" : "#c8c8c8";
    g.fillRect(0, 0, size, size);
    const detents = dialDetents(shutterSpeeds(body), body.autoExposure);
    const step = dialStep(detents.length);
    g.fillStyle = dark ? "#ececec" : "#161616";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.font = `600 ${detents.length > 14 ? 30 : 38}px system-ui, sans-serif`;
    detents.forEach(({ label }, i) => {
      const theta = -i * step;
      const x = (0.5 + 0.5 * Math.cos(theta) * 0.7) * size;
      const y = (1 - (0.5 + 0.5 * Math.sin(theta) * 0.7)) * size;
      g.save();
      g.translate(x, y);
      // Radial, reading outward from the centre, as on a real dial — tangential labels don't fit 19 positions.
      g.rotate(-theta);
      if (label === "A") g.fillStyle = "#e53935";
      g.fillText(label, 0, 0);
      g.restore();
      g.fillStyle = dark ? "#ececec" : "#161616";
    });
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }, [body, dark]);
  useEffect(() => () => texture.dispose(), [texture]);
  return texture;
}

export default function ProceduralBody({ body, materials }: { body: Body; materials: Materials }) {
  const { width, height, depth, topPlate, basePlate } = BODY;
  const coverHeight = height - topPlate - basePlate;
  const shell = useMemo(
    () => ({ base: roundedSlab(width, depth, basePlate), cover: roundedSlab(width * 0.998, depth * 0.985, coverHeight), top: roundedSlab(width, depth, topPlate) }),
    [width, depth, basePlate, coverHeight, topPlate],
  );
  useEffect(() => () => Object.values(shell).forEach((g) => g.dispose()), [shell]);

  const metal = finishMaterial(materials, body.finish);
  const dialTexture = useDialTexture(body, body.finish === "black");
  const film = body.medium === "film";
  const bottom = -height / 2;
  const topY = height / 2;
  const front = depth / 2 + 0.0004;
  const plateMid = topY - topPlate / 2;

  return (
    <group name="body">
      <mesh geometry={shell.base} position={[0, bottom, 0]} material={metal} />
      <mesh geometry={shell.cover} position={[0, bottom + basePlate, 0]} material={materials.leather} />
      <mesh geometry={shell.top} position={[0, topY - topPlate, 0]} material={metal} />

      {/* Front windows: rangefinder (photographer's right), frosted illumination window on film bodies, viewfinder */}
      <mesh position={[-0.046, plateMid, front]} material={materials.window}>
        <boxGeometry args={[0.012, 0.008, 0.001]} />
      </mesh>
      {film && (
        <mesh position={[0.014, plateMid, front]} material={materials.frosted}>
          <boxGeometry args={[0.015, 0.009, 0.001]} />
        </mesh>
      )}
      <mesh position={[0.046, plateMid, front]} material={materials.window}>
        <boxGeometry args={[0.024, 0.013, 0.001]} />
      </mesh>

      {/* Lens mount flange */}
      <mesh position={[MOUNT_CENTER[0], MOUNT_CENTER[1], MOUNT_CENTER[2] + 0.001]} rotation={[Math.PI / 2, 0, 0]} material={materials.chrome}>
        <cylinderGeometry args={[0.0265, 0.0265, 0.002, 64]} />
      </mesh>

      {/* Top-plate controls */}
      {/* Shutter-speed dial: engraved top, read against an index on the top plate in front of it */}
      <mesh name={RIG_PARTS.shutterDial} userData={AXIS_Y} position={[-0.033, topY + 0.003, -0.002]}>
        <cylinderGeometry args={[DIAL_R, DIAL_R, 0.006, 48]} />
        <meshStandardMaterial attach="material-0" color={body.finish === "black" ? "#161616" : "#d4d4d4"} metalness={0.8} roughness={0.35} />
        <meshStandardMaterial attach="material-1" map={dialTexture} metalness={0.4} roughness={0.45} />
        <meshStandardMaterial attach="material-2" color="#161616" />
      </mesh>
      <mesh position={[-0.033, topY + 0.0004, -0.002 + DIAL_R + 0.0022]} material={materials.index}>
        <boxGeometry args={[0.0012, 0.0008, 0.0025]} />
      </mesh>
      <mesh position={[-0.052, topY + 0.004, -0.001]} material={materials.chrome}>
        <cylinderGeometry args={[0.0035, 0.0035, 0.008, 24]} />
      </mesh>
      {film && (
        <>
          {/* Advance lever: pivots on the release-button axis and rests folded along the back of the top plate */}
          <group name={RIG_PARTS.advanceLever} userData={AXIS_Y} position={[-0.052, topY + 0.0085, -0.001]}>
            <mesh position={[0.014, 0, -0.012]} rotation={[0, -0.25, 0]} material={metal}>
              <boxGeometry args={[0.03, 0.0015, 0.005]} />
            </mesh>
          </group>
          {/* Rewind knob */}
          <mesh position={[0.05, topY + 0.004, -0.002]} material={metal}>
            <cylinderGeometry args={[0.0085, 0.0085, 0.008, 36]} />
          </mesh>
        </>
      )}
    </group>
  );
}
