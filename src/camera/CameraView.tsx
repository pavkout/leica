import { useEffect, useState, type ReactNode } from "react";
import { t } from "../i18n";
import { prepareAudio } from "../audio/sounds";
import type { Body, Lens } from "../data/gear";
import { formatShutter } from "../data/gear";
import { formatDistance, formatFNumber, lensEngraving, type Units } from "../utils/format";
import { ReleaseButton, ThumbWheel } from "./Controls";
import { evLabel } from "./controlMath";
import { useInteracting } from "./interaction";
import LensRings from "./LensRings";
import RotaryDial, { type DialStop } from "./RotaryDial";
import "./camera.css";

export interface CameraProps {
  body: Body;
  lens: Lens;
  units: Units;
  isFilm: boolean;
  /** Film name, or null on a digital body. */
  filmName: string | null;

  stops: number[];
  fNumber: number;
  onAperture: (n: number) => void;
  focusMm: number;
  onFocus: (mm: number) => void;
  nearMm: number;
  farMm: number;

  speeds: number[];
  shutterSec: number;
  /** Aperture priority is engaged (the dial is on A). */
  auto: boolean;
  onShutterDial: (next: { auto: boolean; sec: number }) => void;

  iso: number;
  isoChoices: number[];
  onIso: (iso: number) => void;
  evComp: number;
  onEvComp: (ev: number) => void;
  /** Meter reading: stops from the compensated target (+ over, − under). */
  meterStops: number;

  frameStatus: string;
  frames: number;
  canShoot: boolean;
  onShoot: () => void;

  /** Frame width ÷ height, so the screen can fit the picture. */
  aspect: number;
  /** Rendered image (the simulated photo), sized by the screen. */
  image: (quality: number) => ReactNode;
  /** The rangefinder view, for film bodies. */
  finder: ReactNode;
  /** Scene picker, shown from FN. */
  scenes: ReactNode;

  liveAvailable: boolean;
  /** The phone's camera is the image source. */
  liveOn: boolean;
  onLive: () => void;
  onMenu: () => void;
  onPlay: () => void;
  /** From FN while LIVE: the handheld light meter (spot readings, equivalents) for a real camera. */
  onOpenMeter?: () => void;
  /** The engraved body and lens names open their choosers. */
  onPickBody: () => void;
  onPickLens: () => void;
}

const shutterStops = (speeds: number[], hasAuto: boolean): DialStop[] => [
  ...(hasAuto ? [{ key: "A", label: "A", spoken: "A, aperture priority", red: true }] : []),
  // Fastest first, as engraved: the dial turns towards slower speeds.
  ...[...speeds].reverse().map((t) => ({
    key: String(t),
    label: t >= 1 ? `${t}` : 1 / t >= 8000 ? `${Math.round(1 / t / 1000)}k` : String(Math.round(1 / t)),
    spoken: formatShutter(t),
    red: Math.abs(t - 1 / 60) < 1e-9 || Math.abs(t - 1 / 50) < 1e-9,
  })),
];

/**
 * The app as a camera: the picture fills the middle, the controls sit where
 * an M has them. Digital bodies show the rear screen with an info line; film
 * bodies look through the rangefinder and wind on by themselves after each shot.
 */
export default function CameraView(p: CameraProps) {
  const interacting = useInteracting();
  const [half, setHalf] = useState(false);
  const [fnOpen, setFnOpen] = useState(false);
  const [previewHeld, setPreviewHeld] = useState(false);
  // Viewfinder mode: the picture and the release, nothing else. Escape (or the corner key) brings the controls back.
  const [immersed, setImmersed] = useState(false);
  useEffect(() => {
    if (!immersed) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") setImmersed(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [immersed]);
  // Dials scale with the screen: thumb-sized on a phone, generous on a desktop.
  const [short, setShort] = useState(() => Math.min(innerWidth, innerHeight));
  useEffect(() => {
    const onResize = () => setShort(Math.min(innerWidth, innerHeight));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const dialSize = Math.round(Math.min(150, Math.max(96, short * 0.22)));
  // Get the sound engine ready while idle, so the first detent clicks without a delay.
  useEffect(() => {
    const id = (window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 300)))(() => prepareAudio());
    return () => (window.cancelIdleCallback ?? window.clearTimeout)(id);
  }, []);

  const dial = shutterStops(p.speeds, p.body.autoExposure);
  const dialIndex = p.auto ? 0 : Math.max(0, dial.findIndex((s) => s.key !== "A" && Math.abs(Number(s.key) - p.shutterSec) < 1e-9));
  const isoStops: DialStop[] = p.isoChoices.map((i) => ({ key: String(i), label: i >= 1000 ? `${i / 1000}k` : String(i), spoken: `ISO ${i}` }));
  const isoIndex = Math.max(0, p.isoChoices.indexOf(p.iso));
  const meterLit = half || interacting;
  const clampedMeter = Math.max(-3, Math.min(3, p.meterStops));
  // Film winds on by itself after each shot (the app plays the advance), so the camera is always ready.
  const ready = p.canShoot;

  function shoot() {
    if (!ready) return;
    p.onShoot();
  }

  // The simulated image is always rendered (the shutter captures it); on a film body the rangefinder sits over it
  // until you hold the preview.
  const screen = (
    <>
      <div className="cam-lcd">
        {p.image(interacting ? 0.5 : 1)}
        {p.isFilm && previewHeld && !p.liveOn && <span className="cam-sim-tag">{t("cam.simulated")}</span>}
      </div>
      {/* Live, a film body shows the simulated picture: a rangefinder's second image would need a second camera. */}
      {p.isFilm && !previewHeld && !p.liveOn && <div className="cam-finder">{p.finder}</div>}
    </>
  );

  return (
    <div className={`camera ${p.isFilm ? "camera-film" : "camera-digital"}${immersed ? " camera-immersed" : ""}`} aria-label={t("cam.withLens", { body: p.body.name, lens: p.lens.name })} role="region">
      {/* Left of the screen: ISO dial (digital) and the back buttons. */}
      <div className="cam-left">
        {!p.isFilm && isoStops.length > 0 ? (
          <RotaryDial label={t("cam.isoDial")} stops={isoStops} index={isoIndex} onChange={(i) => p.onIso(p.isoChoices[i])} size={Math.round(dialSize * 0.86)} step={32} className="dial-iso" />
        ) : (
          <div className="cam-film-window" aria-label={`Film: ${p.filmName ?? ""}`}>
            <span className="cam-film-name">{p.filmName}</span>
            <span className="cam-film-count">{p.frameStatus}</span>
          </div>
        )}
        <div className="cam-buttons">
          <button type="button" className="cam-btn" onClick={p.onPlay} aria-label={p.isFilm ? t("cam.roll") : t("cam.play")}>
            {p.isFilm ? "ROLL" : "PLAY"}
          </button>
          <button type="button" className="cam-btn" aria-expanded={fnOpen} onClick={() => setFnOpen((v) => !v)} aria-label={t("cam.fn")}>
            FN
          </button>
          <button type="button" className="cam-btn" onClick={p.onMenu} aria-label={t("cam.menu")}>
            MENU
          </button>
          {p.liveAvailable && (
            <button
              type="button"
              className={`cam-btn cam-btn-live${p.liveOn ? " cam-btn-live-on" : ""}`}
              onClick={p.onLive}
              aria-pressed={p.liveOn}
              aria-label={p.liveOn ? t("cam.liveOn") : t("cam.liveOff")}
            >
              LIVE
            </button>
          )}
        </div>
      </div>

      <div className="cam-center">
        <div className={`cam-screen${meterLit ? " cam-screen-lit" : ""}`} style={{ ["--aspect" as string]: String(p.aspect) }}>
          {screen}
          {!p.isFilm && (
            <div className="cam-info" aria-live="off">
              <span className="cam-info-mode">{p.auto ? "A" : "M"}</span>
              <span>{formatShutter(p.shutterSec)}</span>
              <span>{formatFNumber(p.fNumber)}</span>
              <span>ISO {p.iso}</span>
              <span className="cam-info-meter" aria-label={`Meter ${clampedMeter >= 0 ? "+" : "−"}${Math.abs(clampedMeter).toFixed(1)} stops`}>
                <span className="cam-meter-scale" aria-hidden="true">
                  {[-3, -2, -1, 0, 1, 2, 3].map((v) => (
                    <i key={v} className={v === 0 ? "cam-meter-zero" : undefined} />
                  ))}
                  <b style={{ left: `${((clampedMeter + 3) / 6) * 100}%` }} />
                </span>
              </span>
              <span>{evLabel(p.evComp)}</span>
              <span className="cam-info-count">{p.frames}</span>
            </div>
          )}
          {fnOpen && (
            <div className="cam-fn" role="dialog" aria-label={p.liveOn ? t("cam.sceneLight") : t("cam.scene")}>
              <div className="cam-fn-head">
                <span>{p.liveOn ? t("cam.sceneLight") : t("cam.scene")}</span>
                <button type="button" className="cam-btn cam-btn-small" onClick={() => setFnOpen(false)}>
                  Done
                </button>
              </div>
              {p.scenes}
              {p.liveOn && p.onOpenMeter && (
                <div className="cam-fn-meter">
                  <p>{t("cam.meterHint")}</p>
                  <button
                    type="button"
                    className="cam-btn"
                    onClick={() => {
                      setFnOpen(false);
                      p.onOpenMeter?.();
                    }}
                  >
                    Open the light meter
                  </button>
                </div>
              )}
            </div>
          )}
          <button
            type="button"
            className="cam-vf"
            aria-pressed={immersed}
            aria-label={immersed ? t("cam.showControls") : t("cam.hideControls")}
            onClick={() => setImmersed((v) => !v)}
          >
            <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
              {immersed ? (
                <path d="M7 2v5H2M13 2v5h5M7 18v-5H2M13 18v-5h5" fill="none" stroke="currentColor" strokeWidth="1.5" />
              ) : (
                <path d="M2 7V2h5M18 7V2h-5M2 13v5h5M18 13v5h-5" fill="none" stroke="currentColor" strokeWidth="1.5" />
              )}
            </svg>
          </button>
        </div>
        {/* Remounted on a lens change, so the scales twist in like a bayonet lens locking home. */}
        <div className="cam-lens" key={p.lens.id}>
          <LensRings
            stops={p.stops}
            fNumber={p.fNumber}
            onAperture={p.onAperture}
            focusMm={p.focusMm}
            minFocusMm={p.lens.minFocusMm}
            onFocus={p.onFocus}
            nearMm={p.nearMm}
            farMm={p.farMm}
            units={p.units}
          />
        </div>
        <div className="cam-plates">
          <button type="button" className="cam-plate" onClick={p.onPickBody} aria-label={t("cam.pickBody", { name: p.body.name })}>
            {p.body.name}
          </button>
          <button type="button" className="cam-plate cam-plate-lens" onClick={p.onPickLens} aria-label={t("cam.pickLens", { name: p.lens.name })}>
            {lensEngraving(p.lens.name)}
          </button>
          <p className="cam-caption" aria-live="polite">
            <span className="visually-hidden">{p.lens.name}, </span>
            focused at {formatDistance(p.focusMm, p.units)} · sharp {formatDistance(p.nearMm, p.units)} to {formatDistance(p.farMm, p.units)}
          </p>
        </div>
      </div>

      {/* Right: the top-plate shutter dial, the release, then the back's thumb wheel (digital) or the preview key (film). */}
      <div className="cam-right">
        <RotaryDial
          label={t("cam.shutterDial")}
          stops={dial}
          index={dialIndex}
          onChange={(i) => {
            const s = dial[i];
            p.onShutterDial(s.key === "A" ? { auto: true, sec: p.shutterSec } : { auto: false, sec: Number(s.key) });
          }}
          size={dialSize}
          step={30}
          className="dial-shutter"
        />
        <ReleaseButton onHalf={setHalf} onFire={shoot} disabled={!p.canShoot} label={t("cam.release")} />
        {p.isFilm ? (
          <button
            type="button"
            className="cam-btn cam-btn-preview"
            aria-pressed={previewHeld}
            onPointerDown={() => setPreviewHeld(true)}
            onPointerUp={() => setPreviewHeld(false)}
            onPointerLeave={() => setPreviewHeld(false)}
            onKeyDown={(e) => (e.key === " " || e.key === "Enter") && setPreviewHeld(true)}
            onKeyUp={() => setPreviewHeld(false)}
          >
            Hold to preview
          </button>
        ) : (
          <ThumbWheel ev={p.evComp} onChange={p.onEvComp} />
        )}
      </div>
    </div>
  );
}
