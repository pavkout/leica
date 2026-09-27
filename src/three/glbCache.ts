// GLB source-model cache and loader for the 3D view (feature #2, slice 4).
// Lives in the lazy 3D chunk.

import { useEffect } from "react";
import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

// ── Cache ────────────────────────────────────────────────────────────────
// Immutable source models, shared by every instance (instances are clones
// that share geometry, materials and textures). Eviction is separate from
// unmount: an unused model stays warm for a quick swap back, and is only
// disposed once more than MAX_IDLE models sit unused.

const MAX_IDLE = 4;
/** A failed model is not re-requested on every render (that would loop); it may be retried after this long, on the next mount. */
export const RETRY_AFTER_MS = 30_000;

interface Entry {
  promise: Promise<GLTF>;
  gltf?: GLTF;
  error?: unknown;
  failedAt?: number;
  users: number;
  lastUsed: number;
}

const cache = new Map<string, Entry>();
let loader: GLTFLoader | null = null;

function getLoader() {
  if (!loader) {
    loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
  }
  return loader;
}

function entryFor(url: string): Entry {
  let e = cache.get(url);
  if (e?.error && performance.now() - e.failedAt! > RETRY_AFTER_MS) {
    cache.delete(url);
    e = undefined;
  }
  if (!e) {
    const entry: Entry = { promise: getLoader().loadAsync(url), users: 0, lastUsed: performance.now() };
    entry.promise.then(
      (g) => (entry.gltf = g),
      (err) => {
        // Kept, so the error reaches the error boundary instead of re-suspending forever.
        entry.error = err;
        entry.failedAt = performance.now();
      },
    );
    cache.set(url, entry);
    e = entry;
  }
  return e;
}

function disposeGltf(g: GLTF) {
  const textures = new Set<THREE.Texture>();
  g.scene.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    o.geometry.dispose();
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      for (const v of Object.values(m)) if (v instanceof THREE.Texture) textures.add(v);
      m.dispose();
    }
  });
  textures.forEach((t) => t.dispose());
}

function evictIdle() {
  const idle = [...cache.entries()].filter(([, e]) => e.users === 0 && e.gltf).sort((a, b) => a[1].lastUsed - b[1].lastUsed);
  while (idle.length > MAX_IDLE) {
    const [url, e] = idle.shift()!;
    cache.delete(url);
    disposeGltf(e.gltf!);
  }
}

/** Suspends until the model is loaded; throws its load error to the nearest boundary. */
export function useModel(url: string): GLTF {
  const e = entryFor(url);
  useEffect(() => {
    const entry = cache.get(url);
    if (!entry) return;
    entry.users++;
    return () => {
      entry.users--;
      entry.lastUsed = performance.now();
      evictIdle();
    };
  }, [url]);
  if (e.gltf) return e.gltf;
  if (e.error) throw e.error;
  throw e.promise;
}

/** Diagnostics for browser checks. */
export function modelCacheInfo() {
  return [...cache.entries()].map(([url, e]) => ({ url, users: e.users, loaded: !!e.gltf, failed: !!e.error }));
}


/** Start (or reuse) a model's download without mounting it; resolves when it's ready or has failed. */
export function preloadModel(url: string): Promise<void> {
  return entryFor(url).promise.then(
    () => undefined,
    () => undefined,
  );
}
