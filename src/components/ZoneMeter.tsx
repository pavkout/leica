import { useEffect, useRef, useState, type PointerEvent } from "react";
import { formatShutter, shutterSpeeds, BODIES } from "../data/gear";
import { t, useLang } from "../i18n";
import { equivalents, linearLuminance, meteredEv100, regionLuminance, settingsEv100, WHOLE_FRAME } from "../physics/meter";
import { development, exposureFor, roman, zoneColour, zoneOf, stops } from "../physics/zones";
import { getString } from "../services/persistence";
import { useCameraStream } from "../state/useCameraStream";
import { readExif } from "../utils/exif";
import { formatFNumber } from "../utils/format";
import { useWakeLock } from "../utils/useWakeLock";

const W = 320;
/** Phones rarely tell the browser their lens's f-number; the Light meter's calibration offset absorbs the difference. */
const PHONE_F_NUMBER = 1.8;
const OFFSET_KEY = "rangefinder-meter-offset";
const PRESETS = [15, 14, 13, 12, 10, 8, 6, 5];
const APERTURES = [1.4, 2, 2.8, 4, 5.6, 8, 11, 16];
const SPEEDS = shutterSpeeds(BODIES.find((b) => b.id === "m6") ?? BODIES[0]);
const ISOS = [50, 100, 200, 400, 800, 1600, 3200];

type Spot = { x: number; y: number; lum: number };

/** Exposure time and ISO from the camera track, where the browser reports them. */
function trackEv(track: MediaStreamTrack | undefined, meanLum: number): number | null {
  const s = (track?.getSettings?.() ?? {}) as { exposureTime?: number; iso?: number };
  if (!(s.exposureTime && s.exposureTime > 0 && s.iso && s.iso > 0)) return null;
  const offset = Number(getString(OFFSET_KEY)) || 0;
  return meteredEv100(settingsEv100(PHONE_F_NUMBER, s.exposureTime / 10000, s.iso), meanLum) + offset;
}

/**
 * Zone System meter (#60): tap the shadow you want to keep detail in, place
 * it on a zone, and read every other tone's zone; see the whole scene as a
 * zone map; get the exposure and, from the highlights, the development.
 */
export default function ZoneMeter() {
  useLang();
  const cam = useCameraStream();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const raw = useRef<ImageData | null>(null);
  const [photo, setPhoto] = useState<{ img: HTMLImageElement; ev: number | null } | null>(null);
  const [placeZone, setPlaceZone] = useState(3);
  const [placed, setPlaced] = useState<Spot | null>(null);
  const [check, setCheck] = useState<Spot | null>(null);
  const [mode, setMode] = useState<"place" | "check">("place");
  const [map, setMap] = useState(true);
  const [frameEv, setFrameEv] = useState<number | null>(null);
  const [preset, setPreset] = useState(12);
  const [iso, setIso] = useState(400);
  const live = cam.status === "streaming";
  useWakeLock(live);
  const opts = useRef({ map, placed, placeZone });
  opts.current = { map, placed, placeZone };

  /** Draws the frame (or its zone map) and remembers the raw pixels for measuring. */
  function render(src: CanvasImageSource, sw: number, sh: number) {
    const c = canvasRef.current;
    if (!c) return;
    const h = Math.round((W / sw) * sh);
    if (c.width !== W || c.height !== h) {
      c.width = W;
      c.height = h;
    }
    const g = c.getContext("2d", { willReadFrequently: true });
    if (!g) return;
    g.drawImage(src, 0, 0, W, h);
    const img = g.getImageData(0, 0, W, h);
    raw.current = new ImageData(new Uint8ClampedArray(img.data), W, h);
    const { map: showMap, placed: p, placeZone: z } = opts.current;
    if (showMap && p) {
      const d = img.data;
      for (let i = 0; i < d.length; i += 4) {
        const [r, gg, b] = zoneColour(linearLuminance(d[i], d[i + 1], d[i + 2]), p.lum, z);
        d[i] = r;
        d[i + 1] = gg;
        d[i + 2] = b;
      }
      g.putImageData(img, 0, 0);
    }
    return regionLuminance(raw.current.data, W, h, WHOLE_FRAME);
  }

  useEffect(() => {
    if (!live) return;
    const v = videoRef.current!;
    v.srcObject = cam.streamRef.current;
    void v.play().catch(() => undefined);
    let n = 0;
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (v.readyState < 2 || !v.videoWidth || n++ % 3) return;
      const mean = render(v, v.videoWidth, v.videoHeight);
      if (mean !== undefined && n % 30 === 1) setFrameEv(trackEv(cam.streamRef.current?.getVideoTracks()[0], mean));
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [live]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!photo || live) return;
    const mean = render(photo.img, photo.img.naturalWidth, photo.img.naturalHeight);
    if (mean !== undefined) setFrameEv(photo.ev === null ? null : meteredEv100(photo.ev, mean));
  }, [photo, map, placed, placeZone, live]);

  function sample(e: PointerEvent<HTMLCanvasElement>): Spot | null {
    const r = raw.current;
    if (!r) return null;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    return { x, y, lum: regionLuminance(r.data, r.width, r.height, { x: x - 0.02, y: y - 0.02, w: 0.04, h: 0.04 }) };
  }

  async function openPhoto(file: File | undefined) {
    if (!file) return;
    cam.stop();
    const [meta, url] = [readExif(await file.arrayBuffer()), URL.createObjectURL(file)];
    const img = new Image();
    img.onload = () => {
      setPhoto({ img, ev: meta.fNumber && meta.shutterSec && meta.iso ? settingsEv100(meta.fNumber, meta.shutterSec, meta.iso) : null });
      setPlaced(null);
      setCheck(null);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }

  const meanLum = raw.current ? regionLuminance(raw.current.data, raw.current.width, raw.current.height, WHOLE_FRAME) : null;
  const baseEv = frameEv ?? preset;
  const evAt = (s: Spot) => (meanLum ? baseEv + stops(s.lum, meanLum) : null);
  const placedEv = placed ? evAt(placed) : null;
  const checkZone = placed && check && placedEv !== null ? zoneOf(evAt(check)!, placedEv, placeZone) : null;
  const expEv = placedEv !== null ? exposureFor(placedEv, placeZone) : null;
  const combos = expEv !== null ? equivalents(expEv, iso, APERTURES, SPEEDS, null).filter((c) => Math.abs(c.errorStops) < 0.5) : [];
  // The main suggestion is the one nearest f/8; the others follow.
  const main = combos.find((c) => c.fNumber === 8) ?? combos[Math.floor(combos.length / 2)];

  return (
    <section className="panel stage-zones cx" aria-label={t("tool.zones")}>
      <p className="cx-summary">{t("zn.intro")}</p>
      <div className="neg-stage zn-stage">
        <video ref={videoRef} playsInline muted className="neg-video" aria-hidden="true" />
        <canvas
          ref={canvasRef}
          className="neg-canvas"
          hidden={!live && !photo}
          aria-label={t("zn.canvas")}
          onPointerDown={(e) => {
            const s = sample(e);
            if (!s) return;
            if (mode === "place") {
              setPlaced(s);
              setMode("check");
            } else setCheck(s);
          }}
        />
        {placed && <span className="zn-dot zn-dot-placed" style={{ left: `${placed.x * 100}%`, top: `${placed.y * 100}%` }} aria-hidden="true" />}
        {check && <span className="zn-dot" style={{ left: `${check.x * 100}%`, top: `${check.y * 100}%` }} aria-hidden="true" />}
        {!live && !photo && <p className="neg-placeholder">{t("zn.placeholder")}</p>}
      </div>
      {cam.message && <p className="cx-problem">{cam.message}</p>}
      <div className="cx-actions">
        {!live ? (
          <button type="button" className="btn btn-red" onClick={() => (setPhoto(null), void cam.start())}>
            {t("neg.useCamera")}
          </button>
        ) : (
          <button type="button" className="btn" onClick={() => cam.stop()}>
            {t("neg.stopCamera")}
          </button>
        )}
        <label className="btn pp-file">
          {t("zn.openPhoto")}
          <input type="file" accept="image/*" onChange={(e) => openPhoto(e.target.files?.[0])} />
        </label>
      </div>

      {(live || photo) && (
        <>
          <div className="cx-actions" role="group" aria-label={t("zn.tapDoes")}>
            <button type="button" className={`cx-pick${mode === "place" ? " cx-pick-on" : ""}`} aria-pressed={mode === "place"} onClick={() => setMode("place")}>
              {t("zn.mode.place")}
            </button>
            <button type="button" className={`cx-pick${mode === "check" ? " cx-pick-on" : ""}`} aria-pressed={mode === "check"} disabled={!placed} onClick={() => setMode("check")}>
              {t("zn.mode.check")}
            </button>
            <label className="cx-check">
              <input type="checkbox" checked={map} onChange={(e) => setMap(e.target.checked)} /> {t("zn.map")}
            </label>
          </div>
          <p className="cx-quiet">{placed ? (mode === "check" ? t("zn.hintCheck") : t("zn.hintPlace")) : t("zn.hintFirst")}</p>
        </>
      )}

      <div className="cx-grid">
        <label className="field">
          <span>{t("zn.placeOn")}</span>
          <select value={placeZone} onChange={(e) => setPlaceZone(Number(e.target.value))}>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((z) => (
              <option key={z} value={z}>
                {t("zn.zone", { z: roman(z) })} · {t(`zn.z.${z}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>{t("zn.filmIso")}</span>
          <select value={iso} onChange={(e) => setIso(Number(e.target.value))}>
            {ISOS.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        {frameEv === null && (live || photo) && (
          <label className="field">
            <span>{t("zn.light")}</span>
            <select value={preset} onChange={(e) => setPreset(Number(e.target.value))}>
              {PRESETS.map((p) => (
                <option key={p} value={p}>
                  EV {p} · {t(`zn.preset.${p}`)}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {frameEv === null && (live || photo) && <p className="cx-quiet">{t("zn.estimate")}</p>}

      {expEv !== null && (
        <div className="cx-plate">
          <p className="pp-cert-label">{t("zn.exposure", { z: roman(placeZone) })}</p>
          <p className="cx-plate-no">
            {main ? `${formatFNumber(main.fNumber)} · ${formatShutter(main.shutterSec)}` : `EV ${expEv.toFixed(1)}`}
          </p>
          <p className="cx-source">{combos.filter((c) => c !== main).map((c) => `${formatFNumber(c.fNumber)} · ${formatShutter(c.shutterSec)}`).join(", ")}</p>
        </div>
      )}
      {checkZone !== null && (
        <div className="cx-block">
          <p className="cx-plate-what">{t("zn.checked", { z: roman(checkZone) })}</p>
          <p className="cx-quiet">{checkZone <= 0.5 ? t("zn.clipShadow") : checkZone >= 9.5 ? t("zn.clipHigh") : t(`zn.z.${Math.round(checkZone)}`)}</p>
          {checkZone >= 6 && (
            <p className="cx-tip">
              <strong>{t(`zn.dev.${development(checkZone)}`)}</strong> {t("zn.devHow")}{" "}
              <a className="cx-link" href="#/film/develop">
                {t("tool.develop")}
              </a>
            </p>
          )}
        </div>
      )}
      <p className="cx-quiet cx-footnote">{t("zn.honest")}</p>
    </section>
  );
}
