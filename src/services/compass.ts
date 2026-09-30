// Compass and tilt for the sun finder (#50). iOS gives a compass heading
// directly (webkitCompassHeading) after a permission asked from a tap;
// Android gives an absolute alpha on `deviceorientationabsolute`. The phone
// is held upright, camera out the back: its tilt above the horizon is
// beta − 90°. Good to a few degrees once the compass is calibrated.

export interface Orientation {
  /** Compass bearing the camera faces, degrees from north. */
  heading: number;
  /** Camera tilt above the horizon, degrees. */
  pitch: number;
}

type OrientationLike = { alpha: number | null; beta: number | null; absolute?: boolean; webkitCompassHeading?: number };

/** Heading and tilt from an orientation event, or null when it has no compass reading. */
export function readOrientation(e: OrientationLike): Orientation | null {
  const beta = e.beta ?? 90;
  const pitch = Math.max(-90, Math.min(90, beta - 90));
  if (typeof e.webkitCompassHeading === "number" && Number.isFinite(e.webkitCompassHeading)) return { heading: e.webkitCompassHeading, pitch };
  if (e.absolute && typeof e.alpha === "number") return { heading: (360 - e.alpha) % 360, pitch };
  return null;
}

interface PermissionCapable {
  requestPermission?: () => Promise<"granted" | "denied" | "default">;
}

export function compassSupported(): boolean {
  return typeof window !== "undefined" && "DeviceOrientationEvent" in window;
}

/** Asks for access (iOS; must run inside a tap) and listens. Returns a stop function, or null if refused. */
export async function listenCompass(on: (o: Orientation) => void): Promise<(() => void) | null> {
  if (!compassSupported()) return null;
  const ctor = window.DeviceOrientationEvent as typeof DeviceOrientationEvent & PermissionCapable;
  if (typeof ctor.requestPermission === "function") {
    try {
      if ((await ctor.requestPermission()) !== "granted") return null;
    } catch {
      return null;
    }
  }
  let smoothed: Orientation | null = null;
  const handler = (ev: Event) => {
    const o = readOrientation(ev as unknown as OrientationLike);
    if (!o) return;
    // A little smoothing, taking the short way round north.
    if (smoothed) {
      const d = ((((o.heading - smoothed.heading) % 360) + 540) % 360) - 180;
      smoothed = { heading: (smoothed.heading + d * 0.25 + 360) % 360, pitch: smoothed.pitch + (o.pitch - smoothed.pitch) * 0.25 };
    } else smoothed = o;
    on(smoothed);
  };
  const type = "ondeviceorientationabsolute" in window ? "deviceorientationabsolute" : "deviceorientation";
  window.addEventListener(type, handler);
  return () => window.removeEventListener(type, handler);
}
