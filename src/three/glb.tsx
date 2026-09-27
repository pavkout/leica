// GLB model loading for the 3D view (feature #2, slice 4). Lives in the lazy
// 3D chunk. Models follow the same named-parts contract as the procedural
// stand-ins (models.ts), so the Rig, the picker and the highlight don't care
// where a mesh came from.

import { Component, Suspense, useLayoutEffect, useMemo, type ReactNode } from "react";
import { createPortal } from "@react-three/fiber";
import * as THREE from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { useModel } from "./glbCache";
import type { Body, Lens } from "../data/gear";
import IrisAssembly from "./IrisAssembly";
import type { Materials } from "./materials";
import { ANCHORS, assetUrl, validateModel, type ModelAsset } from "./models";

// ── Instances ────────────────────────────────────────────────────────────

/** A per-use clone: its parts can be posed independently, while geometry/materials stay shared with the cache. */
function useInstance(gltf: GLTF, url: string, kind: ModelAsset["kind"], body?: Body) {
  const instance = useMemo(() => {
    const clone = gltf.scene.clone(true);
    clone.userData.source = url;
    return clone;
  }, [gltf, url]);
  const problems = useMemo(() => validateModel(instance, kind, body), [instance, kind, body]);
  if (problems.length) throw new Error(`Model doesn't meet the parts contract: ${problems.join("; ")}`);
  return instance;
}

/**
 * Per-instance material overrides for a loaded model: a red tint on the part
 * being turned, and (for lenses) the faded X-Ray shell. One effect owns both,
 * so they can't restore over each other. The overrides are instance-owned
 * copies; the cached originals are never touched. The live iris (procedural,
 * portalled in) is left alone.
 */
function useMaterialOverrides(root: THREE.Object3D, highlightPart: string | null, xray: boolean) {
  useLayoutEffect(() => {
    if (!highlightPart && !xray) return;
    const highlighted = new Set<THREE.Object3D>();
    root.getObjectByName(highlightPart ?? "")?.traverse((o) => highlighted.add(o));
    const restore: [THREE.Mesh, THREE.Material | THREE.Material[]][] = [];
    const copies: THREE.Material[] = [];
    root.traverse((o) => {
      if (!(o instanceof THREE.Mesh) || o.userData.procedural) return;
      const tint = highlighted.has(o);
      if (!tint && !xray) return;
      restore.push([o, o.material]);
      const override = (m: THREE.Material) => {
        const c = m.clone();
        if (tint && "emissive" in c && c.emissive instanceof THREE.Color) {
          c.emissive.set("#e53935");
          (c as THREE.MeshStandardMaterial).emissiveIntensity = 0.45;
        }
        if (xray) {
          c.transparent = true;
          c.opacity = tint ? 0.35 : 0.12;
          c.depthWrite = false;
        }
        copies.push(c);
        return c;
      };
      o.material = Array.isArray(o.material) ? o.material.map(override) : override(o.material);
    });
    return () => {
      for (const [mesh, original] of restore) mesh.material = original;
      copies.forEach((c) => c.dispose());
    };
  }, [root, highlightPart, xray]);
}

function BodyInstance({ url, body, highlight, children }: { url: string; body: Body; highlight: string | null; children?: ReactNode }) {
  const instance = useInstance(useModel(url), url, "body", body);
  useMaterialOverrides(instance, highlight, false);
  const mount = instance.getObjectByName(ANCHORS.lensMount)!;
  return (
    <>
      <primitive object={instance} />
      {createPortal(children, mount)}
    </>
  );
}

function LensInstance({ url, lens, fNumber, materials, highlight, xray }: { url: string; lens: Lens; fNumber: number; materials: Materials; highlight: string | null; xray: boolean }) {
  const instance = useInstance(useModel(url), url, "lens");
  useMaterialOverrides(instance, highlight, xray);
  const iris = instance.getObjectByName(ANCHORS.iris)!;
  return (
    <>
      <primitive object={instance} />
      {createPortal(<IrisAssembly lens={lens} fNumber={fNumber} radius={iris.userData.radius as number} materials={materials} />, iris)}
    </>
  );
}

// ── Public components: base first, detail after the first interaction ────

/** Reports why a model couldn't be used, and renders the procedural stand-in instead. */
export class ModelBoundary extends Component<{ fallback: ReactNode; onFail: (reason: string) => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    this.props.onFail(error instanceof Error ? error.message : String(error));
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export function GlbBody({ asset, body, wantDetail, highlight, children }: { asset: ModelAsset; body: Body; wantDetail: boolean; highlight: string | null; children?: ReactNode }) {
  const base = <BodyInstance url={assetUrl(asset.base)} body={body} highlight={highlight}>{children}</BodyInstance>;
  if (!wantDetail || !asset.detail) return base;
  // Keep showing the base model until the detail version has loaded.
  return (
    <Suspense fallback={base}>
      <BodyInstance url={assetUrl(asset.detail)} body={body} highlight={highlight}>{children}</BodyInstance>
    </Suspense>
  );
}

export function GlbLens({
  asset,
  lens,
  fNumber,
  materials,
  wantDetail,
  highlight,
  xray,
}: {
  asset: ModelAsset;
  lens: Lens;
  fNumber: number;
  materials: Materials;
  wantDetail: boolean;
  highlight: string | null;
  xray: boolean;
}) {
  const base = <LensInstance url={assetUrl(asset.base)} lens={lens} fNumber={fNumber} materials={materials} highlight={highlight} xray={xray} />;
  if (!wantDetail || !asset.detail) return base;
  return (
    <Suspense fallback={base}>
      <LensInstance url={assetUrl(asset.detail)} lens={lens} fNumber={fNumber} materials={materials} highlight={highlight} xray={xray} />
    </Suspense>
  );
}
