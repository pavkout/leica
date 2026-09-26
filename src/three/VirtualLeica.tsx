// Virtual Leica 3D view (feature #2). Lazy-loaded: nothing here, three.js
// included, reaches users who never open the 3D view. It's a *view* of the
// optical state — it reads body, lens and f-number and never writes them.

import { forwardRef, memo, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { shutterSpeeds, type Body, type Lens } from "../data/gear";
import ProceduralBody from "./ProceduralBody";
import ProceduralLens from "./ProceduralLens";
import { createMaterials, disposeMaterials, type Materials } from "./materials";
import { MOUNT_CENTER, RIG_PARTS, advanceLeverAngle, apertureRingAngle, focusRingAngle, shutterDialAngle, type QualityTier } from "./rig";

export interface VirtualLeicaProps {
  body: Body;
  lens: Lens;
  fNumber: number;
  focusMm: number;
  shutterSec: number;
  /** Automatic exposure engaged (the dial then sits at A). */
  auto: boolean;
  /** Increments each time a film body winds on; each change plays one lever stroke. */
  advanceCount: number;
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
  useEffect(() => {
    // Published for the dev probe, so browser checks can wait for "pose reached target" instead of sleeping.
    scene.userData.rigTargets = targets;
    invalidate();
  }, [scene, targets, invalidate]);
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

/**
 * One advance-lever stroke per film wind-on. An event, not a pose, so it's
 * time-driven rather than a Rig target. The stroke's clock starts on the first
 * frame actually drawn after the trigger, so a busy main thread (e.g. the shot
 * being saved) delays the stroke instead of swallowing it.
 */
function LeverStroke({ count, enabled }: { count: number; enabled: boolean }) {
  const { scene, clock, invalidate } = useThree();
  const start = useRef<number | null>(null);
  const pending = useRef(false);
  // Compare against the last count seen, so mounting, StrictMode's double
  // effect run, or switching to a film body never plays a stroke by itself.
  const seen = useRef(count);
  useEffect(() => {
    if (count === seen.current) return;
    seen.current = count;
    if (!enabled) return;
    pending.current = true;
    invalidate();
  }, [count, enabled, invalidate]);
  useFrame(() => {
    const now = clock.getElapsedTime();
    if (pending.current) {
      pending.current = false;
      start.current = now;
    }
    if (start.current === null) return;
    const lever = scene.getObjectByName(RIG_PARTS.advanceLever);
    const angle = advanceLeverAngle(now - start.current);
    if (lever) lever.rotation.y = angle;
    if (angle === 0 && now > start.current) start.current = null;
    else invalidate();
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
      /** Frames the 3D view has actually rendered (demand mode: should stay flat while nothing moves). */
      frames: () => gl.info.render.frame,
      apertureRing: () => scene.getObjectByName(RIG_PARTS.apertureRing)?.rotation.y ?? null,
      pose: (name: string) => scene.getObjectByName(name)?.rotation.y ?? null,
      target: (name: string) => (scene.userData.rigTargets as Record<string, number> | undefined)?.[name] ?? null,
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
  { body, lens, fNumber, focusMm, shutterSec, auto, advanceCount, tier, reducedMotion, onContextLost },
  ref,
) {
  const materials = useMemo(createMaterials, []);
  useEffect(() => () => disposeMaterials(materials), [materials]);
  const targets = useMemo(
    () => ({
      [RIG_PARTS.apertureRing]: apertureRingAngle(lens, fNumber),
      [RIG_PARTS.focusRing]: focusRingAngle(lens, focusMm),
      [RIG_PARTS.shutterDial]: shutterDialAngle(shutterSpeeds(body), shutterSec, auto, body.autoExposure),
    }),
    [lens, fNumber, focusMm, body, shutterSec, auto],
  );
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
      <LeverStroke count={advanceCount} enabled={!reducedMotion && body.medium === "film"} />
      <Controls ref={ref} damping={!reducedMotion} />
      <DevProbe />
    </Canvas>
  );
});

// Memoized: the app re-renders for many unrelated reasons, and each render of
// the scene tree can make R3F request a frame. Only real prop changes get through.
export default memo(VirtualLeica);
