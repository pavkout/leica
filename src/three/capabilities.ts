// Browser capability probe for the 3D mode. Deliberately three.js-free so the
// main bundle can decide whether to offer 3D without loading the 3D chunk.

import { chooseQualityTier, type DeviceCaps, type QualityTier } from "./rig";

let cached: QualityTier | null = null;

export function detectCaps(): DeviceCaps {
  if (typeof document === "undefined") return { webgl: false, webgl2: false };
  const canvas = document.createElement("canvas");
  let webgl2 = false;
  let webgl: boolean;
  try {
    const gl2 = canvas.getContext("webgl2");
    webgl2 = !!gl2;
    webgl = webgl2 || !!canvas.getContext("webgl");
    // Hand the probe context back right away; mobile Safari caps live contexts.
    gl2?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    webgl = false;
  }
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  return { webgl, webgl2, deviceMemory: nav.deviceMemory, hardwareConcurrency: nav.hardwareConcurrency, saveData: nav.connection?.saveData };
}

/** True when this device can show the 3D view at all (WebGL available). */
export function threeDAvailable() {
  return qualityTier() !== "fallback";
}

export function qualityTier(): QualityTier {
  cached ??= chooseQualityTier(detectCaps());
  return cached;
}

/** Fetch the 3D chunk ahead of use (e.g. when the tour starts), so a later step never waits on the network. */
export function preload3D() {
  return import("./VirtualLeica");
}
