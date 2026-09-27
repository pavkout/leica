// Virtual Leica 3D view (feature #2). Lazy-loaded: nothing here, three.js
// included, reaches users who never open the 3D view. It's a *view* of the
// optical state — it reads body, lens and f-number and never writes them.

import { Suspense, forwardRef, memo, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { shutterSpeeds, type Body, type Lens } from "../data/gear";
import ProceduralBody from "./ProceduralBody";
import ProceduralLens from "./ProceduralLens";
import SchematicOptics, { OPTICS_BLOCK } from "./SchematicOptics";
import LensSwap from "./LensSwap";
import { SWAP_GROUP } from "./swapTimeline";
import { xrayLayout } from "./optics";
import { GlbBody, GlbLens, ModelBoundary } from "./glb";
import { modelCacheInfo } from "./glbCache";
import { ANCHORS, type ModelAsset } from "./models";
import { createMaterials, disposeMaterials, type Materials } from "./materials";
import {
  RIG_PARTS,
  TAP_SLOP_PX,
  advanceLeverAngle,
  apertureRingAngle,
  focusRingAngle,
  shutterDialAngle,
  type QualityTier,
  type TurnablePart,
} from "./rig";

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
  /** Part being turned in 3D; orbiting is suspended while one is active. */
  activePart: TurnablePart | null;
  onPickPart: (part: TurnablePart) => void;
  /** Horizontal drag while a part is active, in CSS pixels since the last call; `start` marks a gesture's first move. */
  onTurnDrag: (dxPx: number, start: boolean) => void;
  onExitPart: () => void;
  /** GLB models for this body/lens, or null for the procedural stand-ins. */
  bodyAsset: ModelAsset | null;
  lensAsset: ModelAsset | null;
  /** Animate lens changes (immersive transitions); off = instant. */
  immersive: boolean;
  /** Bumped by the page on user input in the viewer: a running lens swap finishes at once. */
  interrupt: number;
  /** Lens X-Ray: fade the lens shell and show schematic optics; `rays` adds the ray layer. */
  xray: boolean;
  rays: boolean;
  /** A model couldn't be used (load error or broken parts contract); the stand-in is shown instead. */
  onModelFail: (kind: ModelAsset["kind"], reason: string) => void;
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
const Controls = forwardRef<VirtualLeicaHandle, { damping: boolean; enabled: boolean; onStart: () => void }>(function Controls({ damping, enabled, onStart }, ref) {
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
    controls.addEventListener("start", onStart);
    return () => {
      controls.removeEventListener("change", onChange);
      controls.removeEventListener("start", onStart);
      controls.dispose();
    };
  }, [controls, damping, invalidate, onStart]);
  // Suspended while a part owns the gesture; restored on every exit path, since
  // `enabled` follows activePart and the controls are disposed on unmount.
  useEffect(() => {
    controls.enabled = enabled;
  }, [controls, enabled]);
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
function Rig({ targets, slides, snap }: { targets: Record<string, number>; slides: Record<string, number>; snap: boolean }) {
  const { scene, invalidate } = useThree();
  useEffect(() => {
    // Published for the dev probe, so browser checks can wait for "pose reached target" instead of sleeping.
    scene.userData.rigTargets = targets;
    scene.userData.rigSlides = slides;
    invalidate();
  }, [scene, targets, slides, invalidate]);
  const seenSlides = useRef(new WeakSet<THREE.Object3D>());
  // A part seen for the first time (a new lens, a model swapped for its detail
  // version) takes its pose at once instead of spinning up from zero.
  const seen = useRef(new WeakSet<THREE.Object3D>());
  useFrame((_, delta) => {
    let moving = false;
    for (const [name, target] of Object.entries(targets)) {
      const part = scene.getObjectByName(name);
      if (!part) continue;
      const axis = (part.userData.axis ?? "y") as "x" | "y" | "z";
      const current = part.rotation[axis];
      const fresh = !seen.current.has(part);
      seen.current.add(part);
      const next = snap || fresh ? target : THREE.MathUtils.damp(current, target, 14, Math.min(delta, 0.05));
      part.rotation[axis] = Math.abs(next - target) < 1e-4 ? target : next;
      if (part.rotation[axis] !== target) moving = true;
    }
    // Slides move a part along its local +Y from its rest position (the optics' focus travel).
    for (const [name, offset] of Object.entries(slides)) {
      const part = scene.getObjectByName(name);
      if (!part) continue;
      if (typeof part.userData.restY !== "number") part.userData.restY = part.position.y;
      const target = part.userData.restY + offset;
      const fresh = !seenSlides.current.has(part);
      seenSlides.current.add(part);
      const next = snap || fresh ? target : THREE.MathUtils.damp(part.position.y, target, 14, Math.min(delta, 0.05));
      part.position.y = Math.abs(next - target) < 1e-6 ? target : next;
      if (part.position.y !== target) moving = true;
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

const PART_BY_NAME: Record<string, TurnablePart> = {
  [RIG_PARTS.apertureRing]: "aperture",
  [RIG_PARTS.focusRing]: "focus",
  [RIG_PARTS.shutterDial]: "shutter",
};

/**
 * Tap a ring or dial to pick it; while one is active, horizontal drags turn it
 * and a tap on empty space exits. Taps and drags are told apart by travel, and
 * the pointer is captured so a turn can continue past the canvas edge.
 */
function Turner({
  active,
  onPick,
  onDrag,
  onExit,
}: {
  active: TurnablePart | null;
  onPick: (p: TurnablePart) => void;
  onDrag: (dx: number, start: boolean) => void;
  onExit: () => void;
}) {
  const { gl, camera, scene } = useThree();
  const latest = useRef({ active, onPick, onDrag, onExit });
  latest.current = { active, onPick, onDrag, onExit };

  useEffect(() => {
    const el = gl.domElement;
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    let down: { id: number; x: number; y: number; lastX: number; moved: boolean; turning: boolean } | null = null;
    let hoverFrame = 0;

    const partAt = (clientX: number, clientY: number): TurnablePart | null => {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return null;
      ndc.set((2 * (clientX - r.left)) / r.width - 1, 1 - (2 * (clientY - r.top)) / r.height);
      ray.setFromCamera(ndc, camera);
      // Only the nearest surface counts, so a ring hidden behind the body can't be picked.
      const hit = ray.intersectObjects(scene.children, true)[0];
      for (let o: THREE.Object3D | null = hit?.object ?? null; o; o = o.parent) {
        const part = PART_BY_NAME[o.name];
        if (part) return part;
      }
      return null;
    };
    const setCursor = (x: number, y: number) => {
      el.style.cursor = partAt(x, y) ? "pointer" : latest.current.active ? "ew-resize" : "grab";
    };

    const onDown = (e: PointerEvent) => {
      down = { id: e.pointerId, x: e.clientX, y: e.clientY, lastX: e.clientX, moved: false, turning: false };
      if (latest.current.active) {
        try {
          el.setPointerCapture(e.pointerId);
        } catch {
          // The pointer is already gone (e.g. an interrupted gesture); the turn just ends at the canvas edge.
        }
      }
    };
    const onMove = (e: PointerEvent) => {
      if (!down || e.pointerId !== down.id) {
        if (!hoverFrame && e.pointerType === "mouse") {
          const { clientX, clientY } = e;
          hoverFrame = requestAnimationFrame(() => {
            hoverFrame = 0;
            setCursor(clientX, clientY);
          });
        }
        return;
      }
      if (!down.moved && Math.hypot(e.clientX - down.x, e.clientY - down.y) > TAP_SLOP_PX) down.moved = true;
      if (down.moved && latest.current.active) {
        latest.current.onDrag(e.clientX - down.lastX, !down.turning);
        down.turning = true;
        down.lastX = e.clientX;
      }
    };
    const end = (e: PointerEvent, tap: boolean) => {
      if (!down || e.pointerId !== down.id) return;
      const wasTap = tap && !down.moved;
      down = null;
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
      if (!wasTap) return;
      const part = partAt(e.clientX, e.clientY);
      if (part) latest.current.onPick(part);
      else if (latest.current.active) latest.current.onExit();
    };
    const onUp = (e: PointerEvent) => end(e, true);
    const onCancel = (e: PointerEvent) => end(e, false);

    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onCancel);
    el.addEventListener("lostpointercapture", onCancel);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onCancel);
      el.removeEventListener("lostpointercapture", onCancel);
      if (hoverFrame) cancelAnimationFrame(hoverFrame);
      el.style.cursor = "";
    };
  }, [gl, camera, scene]);
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
      /** Lens-swap state: the outgoing lens group (if a swap is running) and the incoming group's pose. */
      swap: () => {
        const inc = scene.getObjectByName(SWAP_GROUP.incoming);
        const out = scene.getObjectByName(SWAP_GROUP.outgoing);
        return {
          running: !!out,
          incoming: inc ? { y: inc.position.y, rot: inc.rotation.y, visible: inc.visible } : null,
          outgoing: out ? { y: out.position.y, rot: out.rotation.y, visible: out.visible } : null,
        };
      },
      /** Which model source each slot is showing: a GLB url, or "procedural". */
      sources: () => {
        const glb: string[] = [];
        scene.traverse((o) => typeof o.userData.source === "string" && glb.push(o.userData.source));
        return glb.length ? glb : ["procedural"];
      },
      modelCache: () => modelCacheInfo(),
      /** Whether the live iris is mounted inside a loaded GLB lens (at its iris anchor). */
      irisInGlb: () => {
        let found = false;
        scene.traverse((o) => {
          if (typeof o.userData.source === "string" && /lens-/.test(o.userData.source) && o.getObjectByName("iris-anchor")?.getObjectByName(RIG_PARTS.iris)) found = true;
        });
        return found;
      },
      /** Export the current body or lens (rest pose, no live iris) as GLB, base64, for building test fixtures. */
      exportGLB: async (kind: "body" | "lens") => {
        const { GLTFExporter } = await import("three/examples/jsm/exporters/GLTFExporter.js");
        const source = scene.getObjectByName(kind);
        if (!source) return null;
        const copy = source.clone(true);
        copy.position.set(0, 0, 0);
        copy.rotation.set(0, 0, 0);
        const drop: THREE.Object3D[] = [];
        copy.traverse((o) => {
          if (o.userData.procedural) drop.push(o);
          if (Object.values(RIG_PARTS).includes(o.name as never)) o.rotation.set(0, 0, 0);
          // Keep the anchor on the body, but not the lens mounted on it.
          if (kind === "body" && o.name === "lens-mount") o.children.slice().forEach((c) => drop.push(c));
        });
        drop.forEach((o) => o.removeFromParent());
        const glb = (await new GLTFExporter().parseAsync(copy, { binary: true })) as ArrayBuffer;
        let bin = "";
        new Uint8Array(glb).forEach((b) => (bin += String.fromCharCode(b)));
        return btoa(bin);
      },
      pose: (name: string) => scene.getObjectByName(name)?.rotation.y ?? null,
      /** Screen position (CSS px, page coordinates) of a named part's centre, for pointer tests. */
      screenOf: (name: string, surface: "centre" | "top" = "centre") => {
        const o = scene.getObjectByName(name);
        if (!o) return null;
        // Precise (per-vertex): a turned ring's transformed local box overshoots its real top by up to √2.
        const box = new THREE.Box3().setFromObject(o, true);
        const p = box.getCenter(new THREE.Vector3());
        // A ring's box centre lies on the lens axis (the glass); its top surface is what a finger lands on.
        if (surface === "top") p.y = box.max.y - 0.0008;
        const v = p.project(camera);
        const r = gl.domElement.getBoundingClientRect();
        return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height };
      },
      /** Names along the first-hit object's parent chain at a page point, as the tap picker sees it. */
      hitAt: (x: number, y: number) => {
        const r = gl.domElement.getBoundingClientRect();
        const ray = new THREE.Raycaster();
        ray.setFromCamera(new THREE.Vector2((2 * (x - r.left)) / r.width - 1, 1 - (2 * (y - r.top)) / r.height), camera);
        const hits = ray.intersectObjects(scene.children, true).slice(0, 3);
        return hits.map((h) => {
          const chain: string[] = [];
          for (let o: THREE.Object3D | null = h.object; o; o = o.parent) chain.push(o.name || o.type);
          return chain.join(" < ");
        });
      },
      /** X-Ray ray bundle half-width at the ideal-lens plane (metres), or null when no rays are drawn. */
      xrayRayHalfWidth: () => {
        let w: number | null = null;
        scene.getObjectByName("xray")?.traverse((o) => {
          if (!(o instanceof THREE.LineSegments)) return;
          const pos = o.geometry.getAttribute("position");
          w = 0;
          for (let i = 1; i < pos.count; i += 4) w = Math.max(w, Math.abs(pos.getX(i)));
        });
        return w;
      },
      /** How far a sliding part sits from its rest position, and where the Rig is taking it. */
      slide: (name: string) => {
        const o = scene.getObjectByName(name);
        return o && typeof o.userData.restY === "number" ? o.position.y - o.userData.restY : null;
      },
      slideTarget: (name: string) => (scene.userData.rigSlides as Record<string, number> | undefined)?.[name] ?? null,
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

const LENS_PART: Partial<Record<TurnablePart, string>> = { aperture: RIG_PARTS.apertureRing, focus: RIG_PARTS.focusRing };

function Scene({
  body,
  lens,
  fNumber,
  materials,
  active,
  bodyAsset,
  lensAsset,
  wantDetail,
  onModelFail,
  focusMm,
  xray,
  rays,
  immersive,
  interrupt,
}: {
  body: Body;
  lens: Lens;
  fNumber: number;
  materials: Materials;
  active: TurnablePart | null;
  bodyAsset: ModelAsset | null;
  lensAsset: ModelAsset | null;
  wantDetail: boolean;
  onModelFail: (kind: ModelAsset["kind"], reason: string) => void;
  focusMm: number;
  xray: boolean;
  rays: boolean;
  immersive: boolean;
  interrupt: number;
}) {
  // One lens (procedural, or a model with the procedural stand-in while it loads and if it fails).
  // Only the lens on the mount takes the turn highlight and X-Ray fade; an outgoing one keeps its plain look.
  const renderLens = (l: Lens, asset: ModelAsset | null) => {
    const mine = l.id === lens.id;
    const procedural = <ProceduralLens lens={l} fNumber={fNumber} materials={materials} active={mine && active !== "shutter" ? active : null} xray={mine && xray} />;
    return asset ? (
      <ModelBoundary key={asset.id} fallback={procedural} onFail={(r) => onModelFail("lens", r)}>
        <Suspense fallback={procedural}>
          <GlbLens asset={asset} lens={l} fNumber={fNumber} materials={materials} wantDetail={wantDetail} highlight={mine && active ? (LENS_PART[active] ?? null) : null} xray={mine && xray} />
        </Suspense>
      </ModelBoundary>
    ) : (
      procedural
    );
  };
  const mounted = (
    <>
      <LensSwap lens={lens} asset={lensAsset} enabled={immersive} interrupt={interrupt} render={renderLens} />
      {xray && <SchematicOptics key={`xray:${lens.id}`} lens={lens} focusMm={focusMm} fNumber={fNumber} rays={rays} />}
    </>
  );
  const proceduralBody = (
    <ProceduralBody body={body} materials={materials} dialActive={active === "shutter"}>
      {mounted}
    </ProceduralBody>
  );
  return (
    <group>
      {bodyAsset ? (
        <ModelBoundary key={`${body.id}:${bodyAsset.id}`} fallback={proceduralBody} onFail={(r) => onModelFail("body", r)}>
          <Suspense fallback={proceduralBody}>
            <GlbBody asset={bodyAsset} body={body} wantDetail={wantDetail} highlight={active === "shutter" ? RIG_PARTS.shutterDial : null}>
              {mounted}
            </GlbBody>
          </Suspense>
        </ModelBoundary>
      ) : (
        proceduralBody
      )}
    </group>
  );
}

const VirtualLeica = forwardRef<VirtualLeicaHandle, VirtualLeicaProps>(function VirtualLeica(
  { body, lens, fNumber, focusMm, shutterSec, auto, advanceCount, tier, reducedMotion, activePart, onPickPart, onTurnDrag, onExitPart, bodyAsset, lensAsset, onModelFail, xray, rays, immersive, interrupt, onContextLost },
  ref,
) {
  const materials = useMemo(createMaterials, []);
  // High-detail models load only once the user starts interacting (orbiting or picking a part).
  const [interacted, setInteracted] = useState(false);
  const markInteracted = useCallback(() => setInteracted(true), []);
  // Entering a turn mode from the HTML buttons counts too, so keyboard users also get the detail models.
  useEffect(() => {
    if (activePart) setInteracted(true);
  }, [activePart]);
  const pickPart = useCallback(
    (part: TurnablePart) => {
      setInteracted(true);
      onPickPart(part);
    },
    [onPickPart],
  );
  useEffect(() => () => disposeMaterials(materials), [materials]);
  const targets = useMemo(
    () => ({
      [RIG_PARTS.apertureRing]: apertureRingAngle(lens, fNumber),
      [RIG_PARTS.focusRing]: focusRingAngle(lens, focusMm),
      [RIG_PARTS.shutterDial]: shutterDialAngle(shutterSpeeds(body), shutterSec, auto, body.autoExposure),
    }),
    [lens, fNumber, focusMm, body, shutterSec, auto],
  );
  // Unit focusing: the optical block and the diaphragm move out together by the calculated extension.
  const slides = useMemo(() => {
    const extension = xrayLayout(lens, focusMm, fNumber, 0).extension;
    return { [OPTICS_BLOCK]: extension, [ANCHORS.iris]: extension };
  }, [lens, focusMm, fNumber]);
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
      <Scene
        body={body}
        lens={lens}
        fNumber={fNumber}
        materials={materials}
        active={activePart}
        bodyAsset={bodyAsset}
        lensAsset={lensAsset}
        wantDetail={interacted}
        onModelFail={onModelFail}
        focusMm={focusMm}
        xray={xray}
        rays={rays}
        immersive={immersive}
        interrupt={interrupt}
      />
      <Rig targets={targets} slides={slides} snap={reducedMotion} />
      <LeverStroke count={advanceCount} enabled={!reducedMotion && body.medium === "film"} />
      <Controls ref={ref} damping={!reducedMotion} enabled={activePart === null} onStart={markInteracted} />
      <Turner active={activePart} onPick={pickPart} onDrag={onTurnDrag} onExit={onExitPart} />
      <DevProbe />
    </Canvas>
  );
});

// Memoized: the app re-renders for many unrelated reasons, and each render of
// the scene tree can make R3F request a frame. Only real prop changes get through.
export default memo(VirtualLeica);
