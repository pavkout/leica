import { useRef, useState } from "react";
import { formatShutter, nearestStop, type Body, type Lens } from "../data/gear";
import { correctShutter, exposureError } from "../physics/exposure";
import { ASSUMED_PHONE_FOV_DEG, frameCropRatio } from "../physics/liveView";
import { angleOfView, depthOfField, FULL_FRAME_DIAGONAL_MM, hyperfocal } from "../physics/optics";
import { LIGHT_CONDITIONS, type LightCondition } from "../physics/sunny16";
import { formatDistance, formatFNumber, type Units } from "../utils/format";
import LiveScreen, { type LiveHandle } from "../camera/live/LiveScreen";
import { recipeEvRange, type Recipe } from "../data/recipes";
import { recipeLightMismatch } from "../physics/recipes";
import LensBarrel from "./LensBarrel";
import LightMeter from "./LightMeter";
import Segmented from "./Segmented";
import { logFrame } from "../state/shotLogStore";
import type { Region } from "../physics/meter";

interface Props {
  body: Body;
  lens: Lens;
  fNumber: number;
  focusMm: number;
  stops: number[];
  shutters: number[];
  iso: number;
  filmOrSensorLabel: string;
  frameStatusLabel: string;
  captureDisabled: boolean;
  units: Units;
  onFNumberChange: (n: number) => void;
  onFocusChange: (mm: number) => void;
  /** A captured frame as a JPEG data URL, sized to the real camera's resolution. */
  onCapture: (url: string) => void;
  onClose: () => void;
  /**
   * A still scene shown with the same overlays when the camera can't be used
   * (denied, unsupported, error) — e.g. for the demo, which must work without a camera.
   */
  syntheticSceneUrl?: string;
  /** The loaded photo recipe, if any: Live warns when the scene light set here is outside its range. */
  recipe?: Recipe;
  /** Black-and-white film or a Monochrom: the live picture is rendered in mono. */
  mono?: boolean;
  /** The sensor or film's base ISO, for the live picture's noise. */
  baseIso?: number;
}

const DEFAULT_CONDITION: LightCondition = LIGHT_CONDITIONS.find((c) => c.id === "cloudy-bright8")!;

export default function LiveView({
  body,
  lens,
  fNumber,
  focusMm,
  stops,
  shutters,
  iso,
  filmOrSensorLabel,
  frameStatusLabel,
  captureDisabled,
  units,
  onFNumberChange,
  onFocusChange,
  onCapture,
  onClose,
  syntheticSceneUrl,
  recipe,
  mono = false,
  baseIso,
}: Props) {
  // The picture is the simulated camera's live render (the same one as the camera's LIVE):
  // every setting here acts on it. It hands out its source so the spot meter reads the same frames.
  const liveRef = useRef<LiveHandle>(null);
  const meterSource = useRef<HTMLVideoElement | HTMLImageElement | null>(null);
  const [source, setSource] = useState<{ kind: "video" | "image"; track: MediaStreamTrack | null } | null>(null);
  // The scene's light (set by eye; the meter's base), and the light the settings are chosen for.
  // They differ once you expose for a reading (a highlight or a shadow): the picture shows the difference.
  const [sceneEv100, setSceneEv100Raw] = useState(DEFAULT_CONDITION.ev100);
  const [exposeForEv, setExposeForEv] = useState<number | null>(null);
  const setSceneEv100 = (ev: number) => {
    setSceneEv100Raw(ev);
    setExposeForEv(null);
  };
  const targetEv = exposeForEv ?? sceneEv100;
  const [flash, setFlash] = useState(0);
  const [tab, setTab] = useState<"meter" | "light" | "lens">("meter");
  const [logged, setLogged] = useState(0);
  // Light meter (feature #13): tapped spot, and the element being metered.
  const [meterRegion, setMeterRegion] = useState<Region | null>(null);
  const [spotMark, setSpotMark] = useState<{ x: number; y: number } | null>(null);

  /** A tap on the picture meters that spot: mapped back through the lens's crop to the source frame. */
  function meterAt(e: React.MouseEvent<HTMLDivElement>) {
    const pic = (e.target as HTMLElement).closest(".live");
    if (!pic || !source) return;
    const r = pic.getBoundingClientRect();
    const stage = e.currentTarget.getBoundingClientRect();
    const fx = (e.clientX - r.left) / r.width;
    const fy = (e.clientY - r.top) / r.height;
    if (fx < 0 || fx > 1 || fy < 0 || fy > 1) return;
    const [cx, cy] = liveRef.current?.crop() ?? [1, 1];
    const x = 0.5 + (fx - 0.5) * cx;
    const y = 0.5 + (fy - 0.5) * cy;
    setSpotMark({ x: (e.clientX - stage.left) / stage.width, y: (e.clientY - stage.top) / stage.height });
    const size = 0.12 * Math.max(cx, cy);
    setMeterRegion({ x: Math.min(Math.max(x - size / 2, 0), 1 - size), y: Math.min(Math.max(y - size / 2, 0), 1 - size), w: size, h: size });
  }

  function capture() {
    const url = liveRef.current?.capture();
    if (!url) return;
    setFlash((f) => f + 1);
    onCapture(url);
  }

  const frameDiagonalMm = Math.hypot(body.sensorWidthMm, body.sensorHeightMm);
  const cocMm = 0.03 * (frameDiagonalMm / FULL_FRAME_DIAGONAL_MM);
  const dof = depthOfField(lens.focalMm, fNumber, cocMm, focusMm);
  const shutterSec = nearestStop(shutters, correctShutter(targetEv, fNumber, iso));
  const errorStops = exposureError(sceneEv100, fNumber, shutterSec, iso);
  const shakeLikely = shutterSec > 1 / lens.focalMm;

  const lensFovDeg = angleOfView(lens.focalMm, body.sensorWidthMm);
  const cropRatio = frameCropRatio(lensFovDeg, ASSUMED_PHONE_FOV_DEG);
  const sensorAspect = body.sensorWidthMm / body.sensorHeightMm;
  const tooWide = cropRatio > 1;
  // Zone focus: set the hyperfocal distance and everything from half of it to infinity is sharp.
  const hyperfocalMm = hyperfocal(lens.focalMm, fNumber, cocMm);
  const recipeMismatch = recipe ? recipeLightMismatch(recipe, sceneEv100) : null;
  const liveOn = source?.kind === "video";
  const showing = source !== null;

  const meterNeedle = Math.max(-3, Math.min(3, errorStops));

  const scaleLight = (
    <div className="field">
      <span>Scene light: set it by eye, because a browser can't read your camera's real exposure</span>
      <div className="dial" role="radiogroup" aria-label="Scene light">
        {LIGHT_CONDITIONS.map((c) => (
          <button
            key={c.id}
            type="button"
            role="radio"
            aria-checked={c.ev100 === sceneEv100}
            className={c.ev100 === sceneEv100 ? "dial-step dial-on" : "dial-step"}
            onClick={() => setSceneEv100(c.ev100)}
          >
            {c.label}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="live-view" role="dialog" aria-label="Light meter" aria-modal="true">
      {/* The picture: always on screen, with the camera's readout and release on it, like a rear screen. */}
      <div className="lv-stage" style={{ ["--aspect" as string]: String(sensorAspect) }} onClick={meterAt}>
        <LiveScreen
          ref={liveRef}
          aspect={sensorAspect}
          focalMm={lens.focalMm}
          fNumber={fNumber}
          focusMm={focusMm}
          minFocusMm={lens.minFocusMm}
          frameWidthMm={body.sensorWidthMm}
          lensHFovDeg={lensFovDeg}
          shutterSec={shutterSec}
          exposureStops={errorStops}
          iso={iso}
          baseIso={baseIso ?? iso}
          film={body.medium === "film"}
          mono={mono}
          fallbackEv={sceneEv100}
          onSceneEv={() => undefined}
          onFocus={onFocusChange}
          onExit={onClose}
          exitLabel="Close the light meter"
          fallbackImageUrl={syntheticSceneUrl}
          onSource={(el, track) => {
            meterSource.current = el;
            setSource(el ? { kind: el instanceof HTMLVideoElement ? "video" : "image", track } : null);
          }}
        />
        {meterRegion && spotMark && showing && (
          <span className="live-view-spot" aria-hidden="true" style={{ left: `${spotMark.x * 100}%`, top: `${spotMark.y * 100}%` }} />
        )}

        <button type="button" className="lv-close" onClick={onClose} aria-label="Close the light meter">
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
            <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.6" />
          </svg>
        </button>

        {showing && (
          <>
            <div className="lv-hud" aria-label={`${formatFNumber(fNumber)}, ${formatShutter(shutterSec)}, ${filmOrSensorLabel}`}>
              <span>{formatFNumber(fNumber)}</span>
              <span>{formatShutter(shutterSec)}</span>
              <span>{filmOrSensorLabel}</span>
              <span className="cam-meter-scale" aria-hidden="true">
                {[-3, -2, -1, 0, 1, 2, 3].map((v) => (
                  <i key={v} className={v === 0 ? "cam-meter-zero" : undefined} />
                ))}
                <b style={{ left: `${((meterNeedle + 3) / 6) * 100}%` }} />
              </span>
              <span className="lv-hud-count">{frameStatusLabel}</span>
            </div>
            {/* Only a real camera can be captured; the stand-in scene has no release. */}
            {liveOn && (
              <button
                type="button"
                className="release lv-release"
                onClick={(e) => {
                  e.stopPropagation();
                  capture();
                }}
                disabled={captureDisabled}
                aria-label="Take the picture"
              >
                <span className="release-cap" aria-hidden="true" />
                <span key={flash} className={flash ? "shutter-blink" : undefined} />
              </button>
            )}
          </>
        )}
      </div>

      {/* The controls: their own scrolling panel beside (or under) the picture, split so nothing is a long scroll away. */}
      <aside className="lv-panel" aria-label="Light meter controls">
        <div className="lv-summary">
          <p className="lv-summary-main">
            Sharp {formatDistance(dof.nearMm, units)} to {formatDistance(dof.farMm, units)}
          </p>
          <p className="muted small">
            {exposeForEv !== null
              ? `Exposed for EV ${exposeForEv.toFixed(1)}: ${Math.abs(errorStops) < 0.2 ? "matches the scene" : `${Math.abs(errorStops).toFixed(1)} stops ${errorStops > 0 ? "brighter" : "darker"} than the scene's average`}`
              : Math.abs(errorStops) > 0.2
                ? `${Math.abs(errorStops).toFixed(1)} stops ${errorStops > 0 ? "over" : "under"} for this light`
                : "Correct for this light"}
            {shakeLikely && " · shake risk at this speed"}
          </p>
          {exposeForEv !== null && (
            <button type="button" className="btn btn-small lv-reset" onClick={() => setExposeForEv(null)}>
              Expose for the average again
            </button>
          )}
          <button
            type="button"
            className="btn btn-small lv-reset"
            onClick={() => {
              logFrame({ body: body.name, lens: lens.name, fNumber, shutterSec, film: filmOrSensorLabel, focusMm });
              setLogged((n) => n + 1);
            }}
          >
            {logged ? `Logged ${logged} to the shot log · log another` : "Log this frame to the shot log"}
          </button>
          <p className="muted small">
            {source?.kind === "image"
              ? "No camera: a stand-in photo goes through the simulated camera instead."
              : `Framing is approximate: it assumes a ~${ASSUMED_PHONE_FOV_DEG}° phone camera${tooWide ? ", and this lens sees wider than that" : ""}.`}
          </p>
          <p className="muted small">
            Zone focus at {formatFNumber(fNumber)}: set {formatDistance(hyperfocalMm, units)}, sharp from {formatDistance(hyperfocalMm / 2, units)} to ∞
          </p>
          {recipe && recipeMismatch && (
            <p className="warn-text small">
              This light is {recipeMismatch.stops.toFixed(0)} stops {recipeMismatch.direction} than the &ldquo;{recipe.title}&rdquo; recipe expects (EV {recipeEvRange(recipe).join("–")}).
            </p>
          )}
        </div>

        <Segmented
          label="Show"
          value={tab}
          onChange={setTab}
          options={[
            { value: "meter", label: "Meter" },
            { value: "light", label: "Light" },
            { value: "lens", label: "Lens" },
          ]}
        />

        <div className="lv-tab">
          {/* The meter stays mounted (it keeps sampling and its settings); hidden when another tab is up. */}
          <div hidden={tab !== "meter"}>
            <LightMeter
              sourceRef={meterSource}
              track={source?.track ?? null}
              active={showing}
              region={meterRegion}
              baseEv100={sceneEv100}
              iso={iso}
              apertures={stops}
              speeds={shutters}
              fNumber={fNumber}
              onUseReading={(ev) => setExposeForEv(Math.round(ev * 3) / 3)}
            />
          </div>
          {tab === "light" && scaleLight}
          {tab === "lens" && (
            <LensBarrel lens={lens} stops={stops} fNumber={fNumber} focusMm={focusMm} cocMm={cocMm} units={units} onFocusChange={onFocusChange} onApertureChange={onFNumberChange} />
          )}
        </div>
      </aside>
    </div>
  );
}
