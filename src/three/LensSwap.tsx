// Cinematic lens swap (feature #33). The app's lens has already changed when
// this runs; it only animates the view. Both lenses stay mounted under their
// own key while their roles change, so nothing is rebuilt mid-swap. The new
// lens is rendered first so the Rig and picker always find its parts.

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { Group } from "three";
import type { Lens } from "../data/gear";
import type { ModelAsset } from "./models";
import { assetUrl } from "./models";
import { preloadModel } from "./glbCache";
import { SWAP_GROUP, swapPose } from "./swapTimeline";


interface Item {
  lens: Lens;
  asset: ModelAsset | null;
}

interface Props {
  lens: Lens;
  asset: ModelAsset | null;
  /** Immersive transitions on (and reduced motion off). Off: lens changes are instant. */
  enabled: boolean;
  /** Changes when the user interacts elsewhere (e.g. presses a key in the viewer): finishes a running swap. */
  interrupt: number;
  render: (lens: Lens, asset: ModelAsset | null) => ReactNode;
}

export default function LensSwap({ lens, asset, enabled, interrupt, render }: Props) {
  const { clock, invalidate, gl, scene, camera } = useThree();
  const [current, setCurrent] = useState<Item>({ lens, asset });
  const [outgoing, setOutgoing] = useState<Item | null>(null);
  const start = useRef<number | null>(null);
  const waiting = useRef(false);
  const generation = useRef(0);
  const groups = useRef(new Map<string, Group>());

  const finish = () => {
    generation.current++;
    start.current = null;
    waiting.current = false;
    setOutgoing(null);
    invalidate();
  };

  // A new lens: either switch instantly, or preload it and run the swap.
  useEffect(() => {
    if (lens.id === current.lens.id) {
      if (asset !== current.asset) setCurrent({ lens, asset });
      return;
    }
    const next = { lens, asset };
    if (!enabled) {
      finish();
      setCurrent(next);
      return;
    }
    // An unfinished swap resolves first: the lens on the mount now becomes the outgoing one.
    const gen = ++generation.current;
    start.current = null;
    waiting.current = true;
    setOutgoing(current);
    setCurrent(next);
    // Prepare before moving anything, so the new lens never pops in or stalls mid-animation:
    // load its model, then compile its shaders and upload its textures while it's still hidden.
    const ready = asset ? preloadModel(assetUrl(asset.base)) : Promise.resolve();
    void ready
      .then(() => new Promise((r) => requestAnimationFrame(r))) // let the incoming lens mount
      .then(() => {
        if (gen !== generation.current) return;
        const g = groups.current.get(next.lens.id);
        if (!g) return;
        // three.js only compiles visible objects, so show it to the compiler (not to the screen: no frame renders in between).
        // Synchronous compile, not compileAsync: compileAsync's background polling throws an uncaught
        // error if a faster second swap disposes these materials mid-compile.
        g.visible = true;
        try {
          gl.compile(g, camera, scene);
        } catch {
          // Compiling ahead is an optimisation; the first frame compiles anything left.
        }
        g.traverse((o) => {
          const mats = (o as { material?: unknown }).material;
          for (const m of (Array.isArray(mats) ? mats : mats ? [mats] : []) as Record<string, unknown>[]) {
            for (const v of Object.values(m)) if (v && typeof v === "object" && (v as { isTexture?: boolean }).isTexture) gl.initTexture(v as never);
          }
        });
        g.visible = false;
      })
      .then(() => {
        if (gen !== generation.current) return; // superseded by a later change or an interrupt
        waiting.current = false;
        start.current = clock.getElapsedTime();
        invalidate();
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs per lens change; `current` is read as of that change
  }, [lens, asset, enabled]);

  // Any pointer or wheel input on the canvas, or an interrupt from the page, skips to the end.
  useEffect(() => {
    if (!outgoing) return;
    const el = gl.domElement;
    const skip = () => finish();
    el.addEventListener("pointerdown", skip);
    el.addEventListener("wheel", skip, { passive: true });
    return () => {
      el.removeEventListener("pointerdown", skip);
      el.removeEventListener("wheel", skip);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outgoing, gl]);
  // Turning the setting off (or reduced motion coming on) resolves a running swap at once.
  useEffect(() => {
    if (!enabled && outgoing) finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);
  const firstInterrupt = useRef(interrupt);
  useEffect(() => {
    if (interrupt !== firstInterrupt.current && outgoing) finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interrupt]);

  useFrame(() => {
    if (!outgoing) return;
    const inc = groups.current.get(current.lens.id);
    const out = groups.current.get(outgoing.lens.id);
    const pose = start.current === null ? swapPose(0) : swapPose(clock.getElapsedTime() - start.current);
    if (inc) {
      inc.position.y = pose.incoming.y;
      inc.rotation.y = pose.incoming.rot;
      inc.visible = pose.incoming.visible;
    }
    if (out) {
      out.position.y = pose.outgoing.y;
      out.rotation.y = pose.outgoing.rot;
      out.visible = pose.outgoing.visible;
    }
    if (pose.done) finish();
    else if (!waiting.current) invalidate();
  });

  // Rest pose whenever no swap is running (also the final state of an interrupted one).
  useEffect(() => {
    if (outgoing) return;
    const g = groups.current.get(current.lens.id);
    if (g) {
      g.position.y = 0;
      g.rotation.y = 0;
      g.visible = true;
    }
    invalidate();
  }, [outgoing, current, invalidate]);

  const items: [Item, string][] = [[current, SWAP_GROUP.incoming], ...(outgoing ? ([[outgoing, SWAP_GROUP.outgoing]] as [Item, string][]) : [])];
  return (
    <>
      {items.map(([item, role]) => (
        <group
          key={item.lens.id}
          name={role}
          visible={role === SWAP_GROUP.outgoing || !outgoing}
          ref={(g) => {
            if (g) groups.current.set(item.lens.id, g);
            else groups.current.delete(item.lens.id);
          }}
        >
          {render(item.lens, item.asset)}
        </group>
      ))}
    </>
  );
}
