// Virtual Leica 3D view (feature #2). Lazy-loaded: nothing here, three.js
// included, reaches users who never open the 3D view. It's a *view* of the
// optical state — it reads body, lens and f-number and never writes them.

import { useEffect, useImperativeHandle, useMemo, useRef, forwardRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type { Body, Lens } from "../data/gear";
import ProceduralBody from "./ProceduralBody";
import ProceduralLens from "./ProceduralLens";
import { createMaterials, disposeMaterials, type Materials } from "./materials";
import { MOUNT_CENTER, RIG_PARTS, apertureRingAngle, type QualityTier } from "./rig";

export interface VirtualLeicaProps {
  body: Body;
  lens: Lens;
  fNumber: number;
  tier: Exclude<QualityTier, "fallback">;
  reducedMotion: boolean;
  onContextLost: () => void;
}

export interface VirtualLeicaHandle {
  resetView: () => void;
}

const HOME_POSITION = new THREE.Vector3(-0.13, 0.07, 0.27);
const TARGET = new THREE.Vector3(0, -0.004, 0.03);

function Studio({ tier }: { tier: VirtualLeicaProps["tier"] }) {
  const { gl, scene } = useThree();
  useEffect(() => {
    if (tier !== "full") return;
    // Procedural studio reflections — no HDR file to download.
    const pmrem = new THREE.PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const env = pmrem.fromScene(room, 0.04).texture;
    scene.environment = env;
    return () => {
      scene.environment = null;
      env.dispose();
      pmrem.dispose();
      room.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
        }
      });
    };
  }, [gl, scene, tier]);
  return (
    <>
      <hemisphereLight args={["#ffffff", "#303030", tier === "full" ? 0.5 : 1.4]} />
      <directionalLight position={[-0.3, 0.5, 0.6]} intensity={tier === "full" ? 1.6 : 2.4} />
      <directionalLight position={[0.4, 0.2, -0.3]} intensity={0.6} />
    </>
  );
}

/** Orbit with limits; demand rendering, so every camera change requests a frame. */
const Controls = forwardRef<VirtualLeicaHandle, { damping: boolean }>(function Controls({ damping }, ref) {
  const { camera, gl, invalidate } = useThree();
  const controls = useMemo(() => new OrbitControls(camera, gl.domElement), [camera, gl]);
  useEffect(() => {
    controls.target.copy(TARGET);
    controls.enablePan = false;
    controls.minDistance = 0.14;
    controls.maxDistance = 0.45;
    controls.enableDamping = damping;
    controls.dampingFactor = 0.12;
    controls.update();
    const onChange = () => invalidate();
    controls.addEventListener("change", onChange);
    return () => {
      controls.removeEventListener("change", onChange);
      controls.dispose();
    };
  }, [controls, damping, invalidate]);
  // Damping keeps easing after the pointer lifts; update() fires "change" until it settles.
  useFrame(() => {
    if (damping) controls.update();
  });
  useImperativeHandle(ref, () => ({
    resetView: () => {
      camera.position.copy(HOME_POSITION);
      controls.target.copy(TARGET);
      controls.update();
      invalidate();
    },
  }));
  return null;
});

/**
 * Drives named rig parts toward the pose the optical state implies. Works on
 * any model that follows RIG_PARTS, procedural or GLB.
 */
function Rig({ targets, snap }: { targets: Record<string, number>; snap: boolean }) {
  const { scene, invalidate } = useThree();
  useEffect(() => invalidate(), [targets, invalidate]);
  useFrame((_, delta) => {
    let moving = false;
    for (const [name, target] of Object.entries(targets)) {
      const part = scene.getObjectByName(name);
      if (!part) continue;
      const axis = (part.userData.axis ?? "y") as "x" | "y" | "z";
      const current = part.rotation[axis];
      const next = snap ? target : THREE.MathUtils.damp(current, target, 14, Math.min(delta, 0.05));
      part.rotation[axis] = Math.abs(next - target) < 1e-4 ? target : next;
      if (part.rotation[axis] !== target) moving = true;
    }
    if (moving) invalidate();
  });
  return null;
}

/** Development-only handle for browser checks (memory after lens swaps, ring pose). */
function DevProbe() {
  const { gl, scene, camera, invalidate } = useThree();
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const w = window as unknown as { __leica3d?: unknown };
    w.__leica3d = {
      memory: () => ({ ...gl.info.memory }),
      programs: () => gl.info.programs?.length ?? 0,
      apertureRing: () => scene.getObjectByName(RIG_PARTS.apertureRing)?.rotation.y ?? null,
      /** Fixed camera for visual fixtures. */
      lookFrom: (x: number, y: number, z: number, at: [number, number, number] = [TARGET.x, TARGET.y, TARGET.z]) => {
        camera.position.set(x, y, z);
        camera.lookAt(...at);
        invalidate();
      },
    };
    return () => {
      delete w.__leica3d;
    };
  }, [gl, scene, camera, invalidate]);
  return null;
}

function Scene({ body, lens, fNumber, materials }: { body: Body; lens: Lens; fNumber: number; materials: Materials }) {
  return (
    <group>
      <ProceduralBody body={body} materials={materials} />
      {/* Lens built along +Y; turn it so its axis points out of the front (+Z). */}
      <group position={MOUNT_CENTER} rotation={[Math.PI / 2, 0, 0]}>
        {/* Key by lens so a swap unmounts the old lens and its resources in one go. */}
        <ProceduralLens key={lens.id} lens={lens} fNumber={fNumber} materials={materials} />
      </group>
    </group>
  );
}

const VirtualLeica = forwardRef<VirtualLeicaHandle, VirtualLeicaProps>(function VirtualLeica(
  { body, lens, fNumber, tier, reducedMotion, onContextLost },
  ref,
) {
  const materials = useMemo(createMaterials, []);
  useEffect(() => () => disposeMaterials(materials), [materials]);
  const targets = useMemo(() => ({ [RIG_PARTS.apertureRing]: apertureRingAngle(lens, fNumber) }), [lens, fNumber]);
  const lostRef = useRef(onContextLost);
  lostRef.current = onContextLost;

  return (
    <Canvas
      frameloop="demand"
      dpr={tier === "full" ? [1, 2] : 1}
      gl={{ antialias: tier === "full", alpha: true, powerPreference: "default" }}
      camera={{ position: HOME_POSITION.toArray(), fov: 32, near: 0.01, far: 5 }}
      onCreated={({ gl }) => {
        gl.domElement.addEventListener("webglcontextlost", (e) => {
          e.preventDefault();
          lostRef.current();
        });
      }}
    >
      <Studio tier={tier} />
      <Scene body={body} lens={lens} fNumber={fNumber} materials={materials} />
      <Rig targets={targets} snap={reducedMotion} />
      <Controls ref={ref} damping={!reducedMotion} />
      <DevProbe />
    </Canvas>
  );
});

export default VirtualLeica;
