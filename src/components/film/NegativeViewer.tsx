import { useEffect, useRef, useState, type PointerEvent } from "react";
import { t, useLang } from "../../i18n";
import { applyLuts, histograms, negativeLuts, sampleAt, type NegKind, type RGB } from "../../physics/negative";
import { useCameraStream } from "../../state/useCameraStream";
import { useWakeLock } from "../../utils/useWakeLock";
import { downloadBlob } from "../collector/passportCard";

const WIDTH = 720;
/** Levels are re-measured this often (frames), not every frame, so the picture doesn't pump. */
const LEVEL_EVERY = 15;

/**
 * Negative viewer (#47): point the phone at a negative on a light and see the
 * positive, live; or open a photo of one. Tap the clear film edge to set the
 * base; freeze and save a frame. A second device can be the light table.
 */
export default function NegativeViewer() {
  useLang();
  const cam = useCameraStream();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [kind, setKind] = useState<NegKind>("colour");
  const [base, setBase] = useState<RGB | null>(null);
  const [frozen, setFrozen] = useState(false);
  const [still, setStill] = useState<HTMLImageElement | null>(null);
  const [lightTable, setLightTable] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const settings = useRef({ kind, base, frozen });
  settings.current = { kind, base, frozen };
  const raw = useRef<ImageData | null>(null);
  const live = cam.status === "streaming";
  useWakeLock(live || lightTable);

  // The live loop: grab a frame, keep the raw pixels (for tapping the base), convert, draw.
  useEffect(() => {
    if (!live) return;
    const video = videoRef.current!;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    video.srcObject = cam.streamRef.current;
    void video.play().catch(() => undefined);
    let raf = 0;
    let n = 0;
    let luts: ReturnType<typeof negativeLuts> | null = null;
    let lastKey = "";
    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (settings.current.frozen || video.readyState < 2 || !video.videoWidth) return;
      const w = Math.min(WIDTH, video.videoWidth);
      const h = Math.round((w / video.videoWidth) * video.videoHeight);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      ctx.drawImage(video, 0, 0, w, h);
      const img = ctx.getImageData(0, 0, w, h);
      raw.current = new ImageData(new Uint8ClampedArray(img.data), w, h);
      const key = `${settings.current.kind}|${settings.current.base?.join(",")}`;
      if (!luts || n++ % LEVEL_EVERY === 0 || key !== lastKey) {
        luts = negativeLuts(histograms(img.data, 8), settings.current.kind, settings.current.base);
        lastKey = key;
      }
      applyLuts(img.data, luts, settings.current.kind === "bw");
      ctx.putImageData(img, 0, 0);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [live, cam.streamRef]);

  // A photo of a negative: converted once, again whenever the settings change.
  useEffect(() => {
    if (!still || live) return;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    const w = Math.min(1600, still.naturalWidth);
    const h = Math.round((w / still.naturalWidth) * still.naturalHeight);
    canvas.width = w;
    canvas.height = h;
    ctx.drawImage(still, 0, 0, w, h);
    const img = ctx.getImageData(0, 0, w, h);
    raw.current = new ImageData(new Uint8ClampedArray(img.data), w, h);
    applyLuts(img.data, negativeLuts(histograms(img.data, 4), kind, base), kind === "bw");
    ctx.putImageData(img, 0, 0);
  }, [still, kind, base, live]);

  function tapBase(e: PointerEvent<HTMLCanvasElement>) {
    const r = raw.current;
    if (!r || kind === "slide") return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * r.width);
    const y = Math.round(((e.clientY - rect.top) / rect.height) * r.height);
    setBase(sampleAt(r.data, r.width, r.height, x, y, 6));
  }

  async function openPhoto(file: File | undefined) {
    if (!file) return;
    setProblem(null);
    cam.stop();
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setStill(img);
      setBase(null);
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      setProblem(t("lab.photoError"));
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }

  function save() {
    canvasRef.current?.toBlob((b) => b && downloadBlob(b, `positive-${Date.now()}.png`), "image/png");
  }

  if (lightTable)
    return (
      <div className="neg-light" role="dialog" aria-label={t("neg.lightTable")} onClick={() => setLightTable(false)}>
        <p>{t("neg.lightTableExit")}</p>
      </div>
    );

  return (
    <section className="panel stage-negative cx" aria-label={t("tool.negative")}>
      <p className="cx-summary">{t("neg.intro")}</p>
      <div className="cx-actions" role="group" aria-label={t("neg.kind")}>
        {(["colour", "bw", "slide"] as NegKind[]).map((k) => (
          <button key={k} type="button" className={`cx-pick${kind === k ? " cx-pick-on" : ""}`} aria-pressed={kind === k} onClick={() => (setKind(k), setBase(null))}>
            {t(`neg.kind.${k}`)}
          </button>
        ))}
      </div>

      <div className="neg-stage">
        <video ref={videoRef} playsInline muted className="neg-video" aria-hidden="true" />
        <canvas ref={canvasRef} className="neg-canvas" onPointerDown={tapBase} aria-label={t("neg.canvas")} hidden={!live && !still} />
        {!live && !still && <p className="neg-placeholder">{t("neg.placeholder")}</p>}
      </div>

      {(live || still) && kind !== "slide" && <p className="cx-quiet">{base ? t("neg.baseSet") : t("neg.tapBase")}</p>}
      {cam.message && <p className="cx-problem">{cam.message}</p>}
      {problem && <p className="cx-problem">{problem}</p>}

      <div className="cx-actions">
        {!live ? (
          <button type="button" className="btn btn-red" onClick={() => (setStill(null), setFrozen(false), void cam.start())} disabled={cam.status === "requesting"}>
            {t("neg.useCamera")}
          </button>
        ) : (
          <button type="button" className="btn btn-red" onClick={() => setFrozen((f) => !f)}>
            {frozen ? t("neg.unfreeze") : t("neg.freeze")}
          </button>
        )}
        <label className="btn pp-file">
          {t("neg.openPhoto")}
          <input type="file" accept="image/*" onChange={(e) => openPhoto(e.target.files?.[0])} />
        </label>
        {(frozen || still) && (
          <button type="button" className="btn" onClick={save}>
            {t("neg.save")}
          </button>
        )}
        {base && (
          <button type="button" className="btn" onClick={() => setBase(null)}>
            {t("neg.autoBase")}
          </button>
        )}
        {live && (
          <button type="button" className="btn" onClick={() => cam.stop()}>
            {t("neg.stopCamera")}
          </button>
        )}
      </div>

      <div className="cx-block">
        <h2 className="pp-h3">{t("neg.howTitle")}</h2>
        <ol className="hc-how">
          <li>{t("neg.how.1")}</li>
          <li>{t("neg.how.2")}</li>
          <li>{t("neg.how.3")}</li>
        </ol>
        <button type="button" className="btn" onClick={() => setLightTable(true)}>
          {t("neg.lightTable")}
        </button>
      </div>
      <p className="cx-quiet cx-footnote">{t("neg.honest")}</p>
    </section>
  );
}
