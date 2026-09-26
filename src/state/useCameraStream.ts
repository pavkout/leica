// Capability adapter for the device camera (RANGEFINDER_MASTER_PLAN.md,
// "Capability adapters"): detects support, requests a stream only on
// explicit user action, and exposes distinct states so the UI can degrade
// gracefully — an unsupported browser or a denied permission is a labeled
// dead end, never a silently broken control.

import { useCallback, useEffect, useRef, useState } from "react";

export type CameraStatus = "idle" | "requesting" | "streaming" | "unsupported" | "denied" | "error";

export function cameraSupported(): boolean {
  return typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
}

/** Maps a getUserMedia failure to a user-facing status and message. Pure, so it's testable without a browser. */
export function classifyStreamError(e: unknown): { status: "denied" | "unsupported" | "error"; message: string } {
  const name = typeof e === "object" && e !== null && "name" in e ? String((e as { name: unknown }).name) : "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return { status: "denied", message: "Camera access was denied. Allow it in your browser's site settings to use Live View." };
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return { status: "unsupported", message: "No camera was found on this device." };
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    return { status: "error", message: "The camera couldn't be started — it may be in use by another app." };
  }
  if (name === "SecurityError") {
    return { status: "unsupported", message: "Camera access needs a secure connection (HTTPS)." };
  }
  return { status: "error", message: e instanceof Error ? e.message : "Couldn't start the camera." };
}

export function useCameraStream() {
  const [status, setStatus] = useState<CameraStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setStatus((s) => (s === "streaming" ? "idle" : s));
  }, []);

  const start = useCallback(async () => {
    if (!cameraSupported()) {
      setStatus("unsupported");
      setMessage("This browser doesn't support camera access here (it needs HTTPS or localhost, and getUserMedia support).");
      return null;
    }
    setStatus("requesting");
    setMessage(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      streamRef.current = stream;
      setStatus("streaming");
      return stream;
    } catch (e) {
      const { status: next, message: msg } = classifyStreamError(e);
      setStatus(next);
      setMessage(msg);
      return null;
    }
  }, []);

  // Release the camera if the component unmounts while streaming.
  useEffect(() => stop, [stop]);

  return { status, message, start, stop, streamRef };
}
