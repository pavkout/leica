// Capability adapter for the gyroscope (RANGEFINDER_MASTER_PLAN.md,
// "Capability adapters" → MotionSensorService). Detects support, asks for
// permission only from a user action (iOS requires the request to happen
// inside the tap handler), and hands out an unsubscribe function so the
// caller can guarantee sampling stops. Nothing here stores readings.

import type { MotionSample } from "../physics/stability";

export type MotionAccess = "granted" | "denied" | "unsupported" | "error";

interface PermissionCapable {
  requestPermission?: () => Promise<"granted" | "denied" | "default">;
}

function motionEventCtor(): (typeof DeviceMotionEvent & PermissionCapable) | undefined {
  return typeof window !== "undefined" && "DeviceMotionEvent" in window
    ? (window.DeviceMotionEvent as typeof DeviceMotionEvent & PermissionCapable)
    : undefined;
}

/** True if the browser exposes DeviceMotionEvent at all. (Desktop browsers often do but never fire it — see `subscribeMotion`'s caller for the no-data timeout.) */
export function motionSupported(): boolean {
  return !!motionEventCtor();
}

/** True on browsers (iOS Safari 13+) that gate motion behind an explicit permission prompt. */
export function motionNeedsPermission(): boolean {
  return typeof motionEventCtor()?.requestPermission === "function";
}

/** Maps a permission outcome to a user-facing status and message. Pure, so it's testable without a device. */
export function classifyMotionAccess(result: unknown): { status: MotionAccess; message: string | null } {
  if (result === "granted") return { status: "granted", message: null };
  if (result === "denied" || result === "default") {
    return {
      status: "denied",
      message: "Motion access was declined. On iPhone, close and reopen the page to be asked again (or allow Motion & Orientation Access in Safari's settings).",
    };
  }
  const name = typeof result === "object" && result !== null && "name" in result ? String((result as { name: unknown }).name) : "";
  if (name === "NotAllowedError") {
    return { status: "denied", message: "Motion access has to be requested from a tap. Try the Start button again." };
  }
  if (name === "SecurityError") {
    return { status: "unsupported", message: "Motion sensors need a secure connection (HTTPS)." };
  }
  return { status: "error", message: result instanceof Error ? result.message : "Couldn't access the motion sensors." };
}

/**
 * Requests motion access. Must be called directly from a user gesture
 * handler, before any other await, or iOS rejects it.
 */
export async function requestMotionAccess(): Promise<{ status: MotionAccess; message: string | null }> {
  const ctor = motionEventCtor();
  if (!ctor) {
    return { status: "unsupported", message: "This browser doesn't expose motion sensors. Try it on a phone." };
  }
  if (typeof ctor.requestPermission !== "function") return { status: "granted", message: null };
  try {
    return classifyMotionAccess(await ctor.requestPermission());
  } catch (e) {
    return classifyMotionAccess(e);
  }
}

/** Extracts a sample from a devicemotion event, or null if the event carries no gyroscope data. */
export function sampleFromEvent(e: Pick<DeviceMotionEvent, "rotationRate" | "timeStamp">): MotionSample | null {
  const r = e.rotationRate;
  if (!r || r.beta == null || r.gamma == null) return null;
  return { t: e.timeStamp, beta: r.beta, gamma: r.gamma };
}

/** Starts listening; returns the function that stops it. */
export function subscribeMotion(onSample: (s: MotionSample) => void, target: Pick<Window, "addEventListener" | "removeEventListener"> = window): () => void {
  const handler = (e: Event) => {
    const s = sampleFromEvent(e as DeviceMotionEvent);
    if (s) onSample(s);
  };
  target.addEventListener("devicemotion", handler);
  return () => target.removeEventListener("devicemotion", handler);
}
