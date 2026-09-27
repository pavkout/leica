import { useEffect, useRef, useState } from "react";
import { formatShutter, nearestStop, type Body, type Lens } from "../data/gear";
import { correctShutter, exposureError } from "../physics/exposure";
import { ASSUMED_PHONE_FOV_DEG, frameCropRatio } from "../physics/liveView";
import { angleOfView, depthOfField, FULL_FRAME_DIAGONAL_MM, hyperfocal } from "../physics/optics";
import { LIGHT_CONDITIONS, type LightCondition } from "../physics/sunny16";
import { formatDistance, formatFNumber, type Units } from "../utils/format";
import { useCameraStream } from "../state/useCameraStream";
import { recipeEvRange, type Recipe } from "../data/recipes";
import { recipeLightMismatch } from "../physics/recipes";
import LensBarrel from "./LensBarrel";

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
}: Props) {
  const { status, message, start, stop, streamRef } = useCameraStream();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [sceneEv100, setSceneEv100] = useState(DEFAULT_CONDITION.ev100);
  const [videoReady, setVideoReady] = useState(false);
  const [flash, setFlash] = useState(0);

  useEffect(() => {
    void start();
    return stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (video && streamRef.current && video.srcObject !== streamRef.current) video.srcObject = streamRef.current;
    if (status !== "streaming") setVideoReady(false);
  }, [status, streamRef]);

  function capture() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    setFlash((f) => f + 1);
    onCapture(canvas.toDataURL("image/jpeg", 0.92));
  }

  const frameDiagonalMm = Math.hypot(body.sensorWidthMm, body.sensorHeightMm);
  const cocMm = 0.03 * (frameDiagonalMm / FULL_FRAME_DIAGONAL_MM);
  const dof = depthOfField(lens.focalMm, fNumber, cocMm, focusMm);
  const shutterSec = nearestStop(shutters, correctShutter(sceneEv100, fNumber, iso));
  const errorStops = exposureError(sceneEv100, fNumber, shutterSec, iso);
  const shakeLikely = shutterSec > 1 / lens.focalMm;

  const lensFovDeg = angleOfView(lens.focalMm, body.sensorWidthMm);
  const cropRatio = frameCropRatio(lensFovDeg, ASSUMED_PHONE_FOV_DEG);
  const sensorAspect = body.sensorWidthMm / body.sensorHeightMm;
  const tooWide = cropRatio > 1;
  const frameWidthPct = Math.min(cropRatio, 1) * 100;
  // Zone focus: set the hyperfocal distance and everything from half of it to infinity is sharp.
  const hyperfocalMm = hyperfocal(lens.focalMm, fNumber, cocMm);
  const recipeMismatch = recipe ? recipeLightMismatch(recipe, sceneEv100) : null;
  const synthetic = !!syntheticSceneUrl && status !== "streaming" && status !== "idle" && status !== "requesting";
  const framelines = !tooWide ? (
    <div className="live-view-frameline" style={{ width: `${frameWidthPct}%`, aspectRatio: String(sensorAspect) }} aria-hidden="true" />
  ) : (
    <div className="live-view-frameline live-view-frameline-full" aria-hidden="true" />
  );

  return (
    <div className="live-view" role="dialog" aria-label="Live View" aria-modal="true">
      <button type="button" className="live-view-close" onClick={onClose} aria-label="Close Live View">
        ×
      </button>

      <div className="live-view-stage">
        {status === "streaming" ? (
          <>
            <video ref={videoRef} className="live-view-video" autoPlay playsInline muted onLoadedMetadata={() => setVideoReady(true)} />
            {!tooWide ? (
              <div
                className="live-view-frameline"
                style={{ width: `${frameWidthPct}%`, aspectRatio: String(sensorAspect) }}
                aria-hidden="true"
              />
            ) : (
              <div className="live-view-frameline live-view-frameline-full" aria-hidden="true" />
            )}
            <span className="live-view-badge">
              Approximate framing — assumes a ~{ASSUMED_PHONE_FOV_DEG}° phone camera field of view
              {tooWide && "; this lens is wider than that, so the true frame extends past what you see"}
            </span>
            <div className="live-view-capture">
              <span className="muted small">{frameStatusLabel}</span>
              <button
                type="button"
                className="shutter-button"
                onClick={capture}
                disabled={!videoReady || captureDisabled}
                aria-label="Capture this frame"
              >
                <span key={flash} className={flash ? "shutter-blink" : undefined} />
              </button>
            </div>
          </>
        ) : synthetic ? (
          <>
            <img className="live-view-video" src={syntheticSceneUrl} alt="Synthetic street scene standing in for the camera" />
            {framelines}
            <span className="live-view-badge">Synthetic scene — no camera available. Framelines, exposure and zone focus work the same.</span>
          </>
        ) : (
          <div className="live-view-permission">
            {status === "idle" || status === "requesting" ? (
              <p>{status === "requesting" ? "Requesting camera access…" : "Starting the camera…"}</p>
            ) : (
              <>
                <p>{message}</p>
                <button type="button" className="btn" onClick={() => void start()}>
                  Try again
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <div className="live-view-sheet">
        <div className="live-view-readout">
          <span className="gear-name">
            {formatFNumber(fNumber)} · {formatShutter(shutterSec)} · {filmOrSensorLabel}
          </span>
          <span className="muted small">
            Sharp {formatDistance(dof.nearMm, units)} – {formatDistance(dof.farMm, units)}
            {Math.abs(errorStops) > 0.2 && ` · ${Math.abs(errorStops).toFixed(1)} stops ${errorStops > 0 ? "over" : "under"} for this light`}
            {shakeLikely && " · shake risk at this shutter speed"}
          </span>
          {recipe && recipeMismatch && (
            <span className="warn-text small live-view-recipe">
              This light is {recipeMismatch.stops.toFixed(0)} stops {recipeMismatch.direction} than the &ldquo;{recipe.title}&rdquo; recipe expects (EV {recipeEvRange(recipe).join("–")}).
            </span>
          )}
          <span className="muted small live-view-zone">
            Zone focus at {formatFNumber(fNumber)}: set {formatDistance(hyperfocalMm, units)} — sharp from {formatDistance(hyperfocalMm / 2, units)} to ∞
          </span>
        </div>

        <div className="live-view-ev">
          <span className="muted small">Scene light (set manually — a browser can't read your camera's real exposure)</span>
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

        <LensBarrel lens={lens} stops={stops} fNumber={fNumber} focusMm={focusMm} cocMm={cocMm} units={units} onFocusChange={onFocusChange} onApertureChange={onFNumberChange} />
      </div>
    </div>
  );
}
