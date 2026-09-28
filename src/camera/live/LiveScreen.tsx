import { useEffect, useImperativeHandle, useRef, useState, forwardRef } from "react";
import { regionLuminance, WHOLE_FRAME } from "../../physics/meter";
import { ASSUMED_PHONE_FOV_DEG } from "../../physics/liveView";
import { useCameraStream } from "../../state/useCameraStream";
import { accumulationAlpha, blurCoefficients, focusForTap, liveCrop, liveSceneEv, noiseFor } from "./liveMath";
import { LiveRenderer, type LiveParams } from "./LiveRenderer";

/** Nearest thing in view, for scaling the depth model's relative depth (see liveMath.relDepthToInvM). */
const NEAREST_M = 0.6;
const DEPTH_WIDTH = 320;

export interface LiveHandle {
  /** The current frame, as a JPEG data URL (for the roll). */
  capture(): string | null;
  /** Share of the source frame shown on screen, per axis (to map a tap on the picture back to the source). */
  crop(): [number, number] | null;
}

interface Props {
  aspect: number;
  focalMm: number;
  fNumber: number;
  focusMm: number;
  minFocusMm: number;
  frameWidthMm: number;
  lensHFovDeg: number;
  shutterSec: number;
  /** Stops over/under the correct exposure for the metered scene (from the shared exposure engine). */
  exposureStops: number;
  iso: number;
  baseIso: number;
  film: boolean;
  mono: boolean;
  /** Scene light to assume when the phone doesn't report its exposure. */
  fallbackEv: number;
  onSceneEv: (ev: number, measured: boolean) => void;
  onFocus: (mm: number) => void;
  onExit: () => void;
  /** Hands out what's being rendered (the camera's video, or the stand-in photo), e.g. for a spot meter. */
  onSource?: (source: HTMLVideoElement | HTMLImageElement | null, track: MediaStreamTrack | null) => void;
  /** Without a camera, render this photo through the same simulated camera instead of stopping. */
  fallbackImageUrl?: string;
  /** Label for the way out when the camera isn't available. */
  exitLabel?: string;
}

type DepthState = { kind: "off" } | { kind: "loading"; message: string; fraction: number | null } | { kind: "on"; perSec: number } | { kind: "error"; message: string };

/**
 * The phone's camera through the simulated camera: the same controls, now on
 * a live picture. Exposure, ISO and the shutter act on every frame; depth of
 * field comes from an on-device depth model when switched on.
 */
const LiveScreen = forwardRef<LiveHandle, Props>(function LiveScreen(props, ref) {
  const { status, message, start, stop, streamRef } = useCameraStream();
  const videoRef = useRef<HTMLVideoElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderer = useRef<LiveRenderer | null>(null);
  const latest = useRef(props);
  latest.current = props;
  const [depth, setDepth] = useState<DepthState>({ kind: "off" });
  const depthOn = useRef(false);
  const depthMap = useRef<{ data: Uint8Array; w: number; h: number } | null>(null);
  const [wider, setWider] = useState(false);
  const [measured, setMeasured] = useState<boolean | null>(null);
  const lastParams = useRef<LiveParams | null>(null);

  useImperativeHandle(ref, () => ({
    capture() {
      const c = canvasRef.current;
      const v = videoRef.current;
      if (!c || !v || !renderer.current || !lastParams.current) return null;
      // Draw and read back in the same task: the drawing buffer isn't kept after compositing.
      renderer.current.render(v, lastParams.current);
      return c.toDataURL("image/jpeg", 0.9);
    },
    crop() {
      return lastParams.current?.crop ?? null;
    },
  }));

  // Camera on while this screen is shown.
  useEffect(() => {
    let cancelled = false;
    void start().then((stream) => {
      const v = videoRef.current;
      if (cancelled || !stream || !v) return;
      v.srcObject = stream;
      void v.play().catch(() => undefined);
      latest.current.onSource?.(v, stream.getVideoTracks()[0] ?? null);
    });
    return () => {
      cancelled = true;
      stop();
    };
  }, [start, stop]);

  // Render loop: every frame, straight from the latest control values.
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    try {
      renderer.current = new LiveRenderer(c);
    } catch {
      renderer.current = null;
      return;
    }
    let raf = 0;
    let last = performance.now();
    let seed = 0;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const r = renderer.current;
      // The camera's video, or (no camera) the stand-in photo, through the same pipeline.
      const img = standIn.current ? imgRef.current : null;
      const v = img && img.complete && img.naturalWidth ? img : videoRef.current;
      if (!v || !r) return;
      const srcW = v instanceof HTMLImageElement ? v.naturalWidth : v.videoWidth;
      const srcH = v instanceof HTMLImageElement ? v.naturalHeight : v.videoHeight;
      if (v instanceof HTMLVideoElement && (v.readyState < 2 || !srcW)) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.min(1280, Math.round(c.clientWidth * dpr));
      const h = Math.round(w / latest.current.aspect);
      if (c.width !== w || c.height !== h) {
        c.width = w;
        c.height = h;
      }
      const p = latest.current;
      const { crop, wider: w2 } = liveCrop(srcW, srcH, p.aspect, 1, p.lensHFovDeg, ASSUMED_PHONE_FOV_DEG);
      if (w2 !== wider) setWider(w2);
      const { a, b } = blurCoefficients(p.focusMm, p.focalMm, p.fNumber, p.frameWidthMm, w);
      const params: LiveParams = {
        alpha: accumulationAlpha(Math.min(0.1, (now - last) / 1000), p.shutterSec),
        exposureStops: p.exposureStops,
        noise: noiseFor(p.iso, p.baseIso, p.film),
        mono: p.mono,
        blurA: a,
        blurB: b,
        invNear: 1 / NEAREST_M,
        depthOn: depthOn.current && depthMap.current !== null,
        crop,
        seed: (seed = (seed + 7.13) % 1000),
      };
      last = now;
      lastParams.current = params;
      r.render(v, params);
      if (import.meta.env.DEV) {
        // Dev-only probe for tests: the last frame's parameters, and a way to read the picture back.
        const w = window as unknown as { __leicaLive?: unknown; __leicaLiveShot?: () => string | null };
        w.__leicaLive = { at: performance.now(), params };
        w.__leicaLiveShot = () => {
          r.render(v, params);
          return c.toDataURL("image/png");
        };
      }
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      renderer.current?.dispose();
      renderer.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Meter: a few times a second, from the phone's own exposure when the browser reports it.
  useEffect(() => {
    const probe = document.createElement("canvas");
    probe.width = 48;
    probe.height = 36;
    const ctx = probe.getContext("2d", { willReadFrequently: true })!;
    const id = window.setInterval(() => {
      const v = videoRef.current;
      if (!v || v.readyState < 2) return;
      ctx.drawImage(v, 0, 0, probe.width, probe.height);
      const mean = regionLuminance(ctx.getImageData(0, 0, probe.width, probe.height).data, probe.width, probe.height, WHOLE_FRAME);
      const track = streamRef.current?.getVideoTracks()[0];
      const s = (track?.getSettings?.() ?? {}) as { exposureTime?: number; iso?: number };
      const exp = typeof s.exposureTime === "number" && s.exposureTime > 0 && typeof s.iso === "number" && s.iso > 0 ? { exposureSec: s.exposureTime / 10000, iso: s.iso } : null;
      const m = liveSceneEv(exp, mean, latest.current.fallbackEv);
      setMeasured(m.measured);
      latest.current.onSceneEv(Math.round(m.ev * 3) / 3, m.measured);
    }, 300);
    return () => window.clearInterval(id);
  }, [streamRef]);

  // Depth: a worker, fed one frame at a time (the next goes when the last result is back).
  useEffect(() => {
    if (depth.kind === "off" || depth.kind === "error") return;
    let alive = true;
    const worker = new Worker(new URL("./depthWorker.ts", import.meta.url), { type: "module" });
    const times: number[] = [];
    const send = async () => {
      const v = videoRef.current;
      if (!alive || !v || v.readyState < 2 || !v.videoWidth) {
        window.setTimeout(send, 200);
        return;
      }
      const bitmap = await createImageBitmap(v, { resizeWidth: DEPTH_WIDTH, resizeHeight: Math.round((DEPTH_WIDTH * v.videoHeight) / v.videoWidth) });
      worker.postMessage({ type: "frame", bitmap }, [bitmap]);
    };
    worker.onmessage = (e) => {
      if (!alive) return;
      const m = e.data;
      if (m.type === "status") setDepth({ kind: "loading", message: m.message, fraction: m.fraction });
      else if (m.type === "error") setDepth({ kind: "error", message: "Depth isn't available here: everything else stays live." });
      else if (m.type === "depth") {
        depthMap.current = { data: m.data, w: m.width, h: m.height };
        renderer.current?.setDepth(m.data, m.width, m.height);
        times.push(performance.now());
        while (times.length > 5) times.shift();
        const perSec = times.length > 1 ? ((times.length - 1) * 1000) / (times[times.length - 1] - times[0]) : 0;
        setDepth({ kind: "on", perSec });
        void send();
      }
    };
    void send();
    return () => {
      alive = false;
      worker.terminate();
    };
    // Only (re)start on switching depth on/off, not on every status update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depth.kind === "off" || depth.kind === "error"]);

  function toggleDepth() {
    const on = depth.kind === "off" || depth.kind === "error";
    depthOn.current = on;
    if (!on) depthMap.current = null;
    setDepth(on ? { kind: "loading", message: "Starting the depth model", fraction: null } : { kind: "off" });
  }

  function tapFocus(e: React.MouseEvent<HTMLCanvasElement>) {
    const d = depthMap.current;
    if (!d) return;
    const r = e.currentTarget.getBoundingClientRect();
    const [cx, cy] = lastParams.current?.crop ?? [1, 1];
    const u = 0.5 + ((e.clientX - r.left) / r.width - 0.5) * cx;
    const v = 0.5 + ((e.clientY - r.top) / r.height - 0.5) * cy;
    const x = Math.min(d.w - 1, Math.max(0, Math.round(u * (d.w - 1))));
    const y = Math.min(d.h - 1, Math.max(0, Math.round(v * (d.h - 1))));
    latest.current.onFocus(focusForTap(d.data[y * d.w + x] / 255, latest.current.minFocusMm, NEAREST_M));
  }

  const blocked = status === "denied" || status === "unsupported" || status === "error";
  const standIn = useRef(false);
  standIn.current = blocked && !!props.fallbackImageUrl;
  const showStandIn = blocked && !!props.fallbackImageUrl;
  useEffect(() => {
    if (!showStandIn) return;
    const img = imgRef.current;
    const hand = () => latest.current.onSource?.(img, null);
    if (img?.complete && img.naturalWidth) hand();
    else img?.addEventListener("load", hand, { once: true });
  }, [showStandIn]);
  return (
    <div className="live" style={{ aspectRatio: String(props.aspect) }}>
      <video ref={videoRef} className="live-video" playsInline muted autoPlay aria-hidden="true" />
      {showStandIn && <img ref={imgRef} className="live-video" src={props.fallbackImageUrl} alt="" aria-hidden="true" />}
      <canvas ref={canvasRef} className="live-canvas" role="img" aria-label="Live picture through the simulated camera" onClick={tapFocus} />
      {blocked && !showStandIn && (
        <div className="live-blocked" role="alert">
          <p>{message ?? "The camera isn't available."}</p>
          <button type="button" className="cam-btn" onClick={props.onExit}>
            {props.exitLabel ?? "Back to the scene"}
          </button>
        </div>
      )}
      {status === "requesting" && <p className="live-note">Allow the camera to go live…</p>}
      <div className="live-chips">
        {showStandIn ? <span className="live-chip">Stand-in photo: no camera</span> : <span className="live-chip live-chip-rec">LIVE</span>}
        {measured !== null && <span className="live-chip">{measured ? "Metered" : "Light estimated"}</span>}
        {wider && <span className="live-chip">Lens wider than your phone: whole frame shown</span>}
        <button type="button" className={`live-chip live-chip-btn${depth.kind === "on" || depth.kind === "loading" ? " live-chip-on" : ""}`} aria-pressed={depth.kind === "on" || depth.kind === "loading"} onClick={toggleDepth}>
          Depth of field {depth.kind === "on" ? `· ${depth.perSec > 0 ? `${depth.perSec.toFixed(1)}/s` : "on"}` : depth.kind === "loading" ? `· ${depth.fraction !== null ? `${Math.round(depth.fraction * 100)}%` : "starting"}` : "off"}
        </button>
      </div>
      {depth.kind === "on" && <p className="live-note live-note-dof">Approximate depth of field: tap to focus on something.</p>}
      {depth.kind === "loading" && <p className="live-note live-note-dof">{depth.message}</p>}
      {depth.kind === "error" && <p className="live-note live-note-dof">{depth.message}</p>}
    </div>
  );
});

export default LiveScreen;
