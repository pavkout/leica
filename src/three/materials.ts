// Shared PBR materials for the procedural models. Created once per 3D view
// and disposed with it; meshes reference them rather than owning copies, so a
// lens swap never allocates or leaks materials.

import * as THREE from "three";
import type { Finish } from "../data/gear";

export interface Materials {
  paint: THREE.MeshStandardMaterial;
  chrome: THREE.MeshStandardMaterial;
  leather: THREE.MeshStandardMaterial;
  glass: THREE.MeshPhysicalMaterial;
  blades: THREE.MeshStandardMaterial;
  interior: THREE.MeshBasicMaterial;
  index: THREE.MeshBasicMaterial;
  window: THREE.MeshStandardMaterial;
  frosted: THREE.MeshStandardMaterial;
  /** Band around the part being turned in 3D. */
  highlight: THREE.MeshBasicMaterial;
}

export function createMaterials(): Materials {
  return {
    paint: new THREE.MeshStandardMaterial({ color: "#161616", metalness: 0.35, roughness: 0.42 }),
    chrome: new THREE.MeshStandardMaterial({ color: "#d4d4d4", metalness: 1, roughness: 0.22 }),
    // Vulcanite covering: dark and matte.
    leather: new THREE.MeshStandardMaterial({ color: "#121212", metalness: 0, roughness: 0.92 }),
    glass: new THREE.MeshPhysicalMaterial({
      color: "#8fa7c7",
      metalness: 0,
      roughness: 0.04,
      transparent: true,
      opacity: 0.22,
      clearcoat: 1,
      depthWrite: false,
    }),
    blades: new THREE.MeshStandardMaterial({ color: "#1c1c1c", metalness: 0.6, roughness: 0.55, side: THREE.DoubleSide }),
    interior: new THREE.MeshBasicMaterial({ color: "#030303" }),
    index: new THREE.MeshBasicMaterial({ color: "#e53935" }),
    window: new THREE.MeshStandardMaterial({ color: "#1d2733", metalness: 0.2, roughness: 0.08 }),
    frosted: new THREE.MeshStandardMaterial({ color: "#8f8c84", metalness: 0, roughness: 0.9 }),
    highlight: new THREE.MeshBasicMaterial({ color: "#e53935", transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide }),
  };
}

export function disposeMaterials(m: Materials) {
  for (const mat of Object.values(m)) mat.dispose();
}

export function finishMaterial(m: Materials, finish: Finish) {
  return finish === "silver" ? m.chrome : m.paint;
}
