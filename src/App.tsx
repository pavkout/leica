import { useMemo, useRef, useState } from "react";
import { isMuted, playAdvance, playApertureClick, playDialClick, playRewind, playShutter, setMuted } from "./audio/sounds";
import BokehPreview, { type PreviewHandle, type PreviewSide } from "./components/BokehPreview";
import ContactSheet, { type Frame } from "./components/ContactSheet";
import ExposurePanel from "./components/ExposurePanel";
import ScenePicker from "./components/ScenePicker";
import LensBarrel from "./components/LensBarrel";
import Readouts, { Details } from "./components/Readouts";
import SceneDiagram from "./components/SceneDiagram";
import Viewfinder from "./components/Viewfinder";
import BodyArt from "./components/gear/BodyArt";
import GearPicker, { type PickerItem } from "./components/gear/GearPicker";
import LensArt from "./components/gear/LensArt";
import Segmented from "./components/Segmented";
import {
  BODIES,
  DEFAULT_BODY_ID,
  DEFAULT_LENS_ID,
  apertureStops,
  findBody,
  findLens,
  isAdapted,
  lensesForBody,
  formatShutter,
  nearestStop,
  shutterSpeeds,
  type Body,
  type Lens,
} from "./data/gear";
import { correctShutter, exposureError, shakeBlurMm } from "./physics/exposure";
import { SHARPNESS_STANDARDS, computeShot, type SharpnessStandard, type Shot } from "./physics/model";
import { GENERIC_BLADES, apertureShape, stopsDown } from "./preview/aperture";
import { grainStrength, lookFor, type FilmLook } from "./preview/film";
import type { DevelopParams } from "./preview/renderer";
import {
  SAMPLE_SCENES,
  distanceAt,
  frameToPhoto,
  loadSampleScene,
  sceneFromCanvases,
  type PhotoScene,
} from "./preview/photoScene";
import { estimateDepth } from "./preview/depthEstimator";
import { formatDistance, formatFNumber, formatLength, type Units } from "./utils/format";

const BACKGROUND_PRESETS: Record<Units, { mm: number; label: string }[]> = {
  metric: [
    { mm: 500, label: "+0.5 m" },
    { mm: 2000, label: "+2 m" },
    { mm: 10_000, label: "+10 m" },
    { mm: Infinity, label: "∞" },
  ],
  imperial: [
    { mm: 609.6, label: "+2′" },
    { mm: 1828.8, label: "+6′" },
    { mm: 9144, label: "+30′" },
    { mm: Infinity, label: "∞" },
  ],
};

/** The illustrated night street: a lit city street after dark. */
const STREET_EV = 5;
/** Phone main cameras see roughly this wide (about a 26 mm equivalent). */
const PHONE_FOV_DEG = 69;
const sampleCache = new Map<string, Promise<PhotoScene>>();
const ROLL_LENGTH = 36;

/** Corner falloff in stops: strong on fast lenses wide open, gone about 3 stops down. */
function vignetteStops(lens: Lens, fNumber: number, digital: boolean) {
  const wideOpen = lens.maxAperture <= 1 ? 2 : lens.maxAperture <= 1.4 ? 1.6 : lens.maxAperture <= 2 ? 1.2 : lens.maxAperture <= 2.8 ? 0.9 : 0.6;
  // Digital Ms read the lens code and correct most of it.
  return wideOpen * Math.max(0, 1 - stopsDown(lens, fNumber) / 3) * (digital ? 0.35 : 1);
}

function previewSide(lens: Lens, shot: Shot, develop?: DevelopParams, photo?: PhotoScene | null): PreviewSide {
  return {
    label: lens.name.replace(/ ASPH\.$/, ""),
    params: {
      focalMm: shot.focalMm,
      fNumber: shot.fNumber,
      focusMm: shot.focusMm,
      subjectMm: shot.subjectMm,
      backgroundMm: shot.backgroundMm,
      frameWidthMm: shot.frameWidthMm,
      horizontalAngleDeg: shot.horizontalAngle,
      shape: apertureShape(lens, shot.fNumber),
      develop,
      photo: photo ?? undefined,
    },
  };
}

/** A second lens worth comparing against: same focal length if possible. */
function defaultComparisonLens(lenses: Lens[], current: Lens) {
  const others = lenses.filter((l) => l.id !== current.id);
  return others.find((l) => l.focalMm === current.focalMm) ?? others[0] ?? current;
}

function bodyMeta(b: Body) {
  const capture = b.medium === "film" ? "35 mm film" : `${b.megapixels![0]} MP${b.medium === "mono" ? " mono" : ""}`;
  const meter = b.medium === "film" ? (b.meter === "leds" ? " · meter" : " · no meter") : "";
  return `${b.year} · ${capture}${meter}`;
}

function lensGroup(body: Body, l: Lens) {
  if (isAdapted(body, l)) return "Via adapter";
  if (l.focalMm <= 28) return "Wide";
  if (l.focalMm <= 43) return "35–43";
  if (l.focalMm <= 60) return "50";
  return "Tele";
}

/** M bodies: the ones with a coupled rangefinder. */
function isRangefinder(body: Body) {
  return body.rangefinder !== undefined;
}

function LensOptions({ body, lenses }: { body: Body; lenses: Lens[] }) {
  const native = lenses.filter((l) => !isAdapted(body, l));
  const adapted = lenses.filter((l) => isAdapted(body, l));
  if (!adapted.length) return <>{lenses.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</>;
  return (
    <>
      <optgroup label="Native">
        {native.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
      </optgroup>
      <optgroup label="M lenses via adapter">
        {adapted.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
      </optgroup>
    </>
  );
}

export default function App() {
  const [bodyId, setBodyId] = useState(DEFAULT_BODY_ID);
  const [lensId, setLensId] = useState(DEFAULT_LENS_ID);
  // Opens on a portrait wide open against the street, where the preview shows most.
  const [fNumber, setFNumber] = useState(findLens(DEFAULT_LENS_ID).maxAperture);
  const [focusMm, setFocusMm] = useState(2000);
  const [backgroundOffsetMm, setBackgroundOffsetMm] = useState(Infinity);
  const [megapixels, setMegapixels] = useState<number | null>(60);
  const [cropFocalMm, setCropFocalMm] = useState<number | null>(null);
  const [standard, setStandard] = useState<SharpnessStandard>("engraved");
  const [units, setUnits] = useState<Units>("metric");
  const [compare, setCompare] = useState(false);
  const [lensBId, setLensBId] = useState("m-50-0.95");
  const [fNumberB, setFNumberB] = useState(1.4);
  // Focus challenge: the subject stands at a hidden distance instead of at the focus.
  const [picker, setPicker] = useState<"body" | "lens" | null>(null);
  const [challenge, setChallenge] = useState<{ subjectMm: number; shotTaken: boolean } | null>(null);
  // Exposure and capture.
  const [filmId, setFilmId] = useState("portra400");
  const [isoDigital, setIsoDigital] = useState(400);
  const [autoExposure, setAutoExposure] = useState(true);
  const [manualShutter, setManualShutter] = useState(1 / 60);
  const [tripod, setTripod] = useState(false);
  const [muted, setMutedState] = useState(isMuted);
  const [rollFrames, setRollFrames] = useState<Frame[]>([]);
  const [cardFrames, setCardFrames] = useState<Frame[]>([]);
  const [flash, setFlash] = useState(0);
  const previewRef = useRef<PreviewHandle>(null);
  // Scene: the illustrated street, a sample photo, or the user's own photo.
  const [sceneId, setSceneId] = useState("street");
  const [samplePhoto, setSamplePhoto] = useState<PhotoScene | null>(null);
  const [sceneStatus, setSceneStatus] = useState<{ message: string; fraction: number | null; error?: boolean } | null>(null);
  const [upload, setUpload] = useState<{
    key: string;
    photo: HTMLCanvasElement;
    depth: HTMLCanvasElement | OffscreenCanvas;
    anchor: { u: number; v: number };
    distanceM: number;
    ev100: number;
  } | null>(null);

  const body = findBody(bodyId);
  const lens = findLens(lensId);
  const lenses = lensesForBody(body);
  const stops = useMemo(() => apertureStops(lens), [lens]);

  const uploadScene = useMemo(
    () => (upload ? sceneFromCanvases(upload.key, upload.photo, upload.depth, PHONE_FOV_DEG, { ...upload.anchor, distanceM: upload.distanceM }) : null),
    [upload]
  );
  const photo = sceneId === "upload" ? uploadScene : sceneId === "street" ? null : samplePhoto;
  const sampleInfo = SAMPLE_SCENES.find((s) => s.id === sceneId);
  const sceneEv = sceneId === "upload" ? upload?.ev100 ?? 12 : sampleInfo?.ev100 ?? STREET_EV;
  const sceneLabel = `${sceneId === "street" ? "Night street" : sceneId === "upload" ? "Your photo" : sampleInfo?.name ?? ""} · EV ${sceneEv}`;
  // In a photo the subject is the calibration anchor; the background is whatever the photo holds.
  const photoSubjectMm = sampleInfo ? sampleInfo.anchor.distanceM * 1000 : upload && sceneId === "upload" ? upload.distanceM * 1000 : undefined;

  const shot = computeShot({
    body,
    lens,
    fNumber,
    focusMm,
    subjectMm: photo ? photoSubjectMm : challenge?.subjectMm,
    backgroundOffsetMm: photo ? Infinity : backgroundOffsetMm,
    megapixels,
    cropFocalMm,
    standard,
  });

  // Comparison lens: same body, focus and background as A.
  const lensB = lenses.find((l) => l.id === lensBId) ?? defaultComparisonLens(lenses, lens);
  const stopsB = apertureStops(lensB);
  const shotB = computeShot({
    body,
    lens: lensB,
    fNumber: nearestStop(stopsB, fNumberB),
    focusMm: Math.max(focusMm, lensB.minFocusMm),
    subjectMm: shot.subjectMm,
    backgroundOffsetMm: photo ? Infinity : backgroundOffsetMm,
    megapixels,
    cropFocalMm: cropFocalMm && lensB.id === lens.id ? cropFocalMm : null,
    standard,
  });

  function toggleCompare() {
    if (!compare) {
      const b = defaultComparisonLens(lenses, lens);
      setLensBId(b.id);
      setFNumberB(b.maxAperture);
    }
    setCompare(!compare);
  }

  function selectLens(id: string) {
    const next = findLens(id);
    setLensId(id);
    setFNumber((n) => nearestStop(apertureStops(next), n));
    setFocusMm((mm) => Math.max(mm, next.minFocusMm));
  }

  function selectBody(id: string) {
    const next = findBody(id);
    setBodyId(id);
    if (!isRangefinder(next)) setChallenge(null);
    setMegapixels(next.megapixels?.[0] ?? null);
    setCropFocalMm(null);
    const available = lensesForBody(next);
    if (!available.some((l) => l.id === lensId)) selectLens(available[0].id);
  }

  // Challenge range: from just past the lens's closest focus out to 6 m.
  const challengeMinMm = Math.max(lens.minFocusMm * 1.15, 800);
  const challengeMaxMm = 6000;
  function startChallenge() {
    const subject = challengeMinMm * (challengeMaxMm / challengeMinMm) ** Math.random();
    setChallenge({ subjectMm: Math.round(subject / 10) * 10, shotTaken: false });
    setFocusMm(subject < 2500 ? Infinity : lens.minFocusMm);
  }
  const challengeHidden = challenge !== null && !challenge.shotTaken;

  // Exposure: the film's speed or the sensor's ISO, and aperture priority where the body has it.
  const isFilm = body.medium === "film";
  const look: FilmLook = lookFor(body, filmId, isoDigital);
  const iso = look.iso;
  const auto = body.autoExposure && autoExposure;
  const speeds = shutterSpeeds(body);
  const clampShutter = (t: number) => Math.min(Math.max(t, body.shutter.fastest), body.shutter.slowest);
  const shutterSec = auto
    ? clampShutter(correctShutter(sceneEv, fNumber, iso))
    : speeds.reduce((best, t) => (Math.abs(Math.log(t / manualShutter)) < Math.abs(Math.log(best / manualShutter)) ? t : best));
  const errorStops = exposureError(sceneEv, fNumber, shutterSec, iso);
  const shakeLikely = shutterSec > 1 / lens.focalMm;

  function developFor(l: Lens, n: number, frameWidthMm: number, seed: number, angle: number): DevelopParams {
    const t = auto ? clampShutter(correctShutter(sceneEv, n, iso)) : shutterSec;
    return {
      exposureStops: exposureError(sceneEv, n, t, iso),
      look,
      grain: grainStrength(look, body),
      vignetteStops: vignetteStops(l, n, !isFilm),
      shake: tripod ? 0 : shakeBlurMm(t, l.focalMm) / frameWidthMm,
      shakeAngle: angle,
      seed,
    };
  }

  const frames = isFilm ? rollFrames : cardFrames;
  const rollFull = isFilm && rollFrames.length >= ROLL_LENGTH;

  function changeAperture(n: number) {
    if (n !== fNumber) playApertureClick();
    setFNumber(n);
  }

  function changeShutter(t: number) {
    playDialClick();
    setManualShutter(t);
  }

  function fireShutter() {
    if (rollFull) return;
    const seed = Math.floor(Math.random() * 100000);
    const angle = Math.random() * Math.PI;
    playShutter(shutterSec, !isFilm);
    setFlash((f) => f + 1);
    const side = previewSide(lens, shot, developFor(lens, fNumber, shot.frameWidthMm, seed, angle), photo);
    const url = previewRef.current?.capture(side.params);
    if (url) {
      const number = frames.length + 1;
      const frame: Frame = {
        id: seed,
        number,
        url,
        caption: `${body.name} · ${lens.name} · ${formatFNumber(fNumber)} · ${formatShutter(shutterSec)} · ${isFilm ? look.name : `ISO ${iso}`}`,
        fileName: `rangefinder-${String(number).padStart(2, "0")}.jpg`,
      };
      (isFilm ? setRollFrames : setCardFrames)((list) => [...list, frame]);
    }
    if (isFilm && rollFrames.length + 1 < ROLL_LENGTH) setTimeout(playAdvance, Math.min(shutterSec, 2) * 1000 + 200);
  }

  async function selectScene(id: string) {
    setSceneId(id);
    setChallenge(null);
    if (id === "street" || id === "upload") {
      setSceneStatus(null);
      return;
    }
    const info = SAMPLE_SCENES.find((s) => s.id === id)!;
    if (!sampleCache.has(id)) sampleCache.set(id, loadSampleScene(info));
    setSceneStatus({ message: "Loading photo…", fraction: null });
    try {
      const scene = await sampleCache.get(id)!;
      setSamplePhoto(scene);
      setFocusMm(Math.max(info.anchor.distanceM * 1000, lens.minFocusMm));
      setSceneStatus(null);
    } catch {
      sampleCache.delete(id);
      setSceneStatus({ message: "Couldn't load that photo. Check your connection and try again.", fraction: null, error: true });
    }
  }

  async function uploadPhoto(file: File) {
    try {
      const { photo: image, depth } = await estimateDepth(file, (message, fraction) => setSceneStatus({ message, fraction }));
      const anchor = { u: 0.5, v: 0.55 };
      setUpload({ key: `upload-${Date.now()}`, photo: image, depth, anchor, distanceM: 2, ev100: 12 });
      setSceneId("upload");
      setChallenge(null);
      setFocusMm(Math.max(2000, lens.minFocusMm));
      setSceneStatus({ message: "Depth ready. Tap your subject in the photo, then set how far away it was.", fraction: null });
    } catch (e) {
      setSceneStatus({ message: `Couldn't estimate depth: ${e instanceof Error ? e.message : String(e)}`, fraction: null, error: true });
    }
  }

  /** Tap to focus: in a photo, focus on whatever is at that point. */
  function tapToFocus(x: number, y: number) {
    if (!photo) return;
    const { u, v } = frameToPhoto(photo, shot.frameWidthMm / shot.frameHeightMm, shot.horizontalAngle, x, y);
    if (u < 0 || u > 1 || v < 0 || v > 1) return;
    if (sceneId === "upload" && upload) {
      // The tapped point becomes the calibrated subject.
      setUpload({ ...upload, anchor: { u, v } });
      setFocusMm(Math.max(upload.distanceM * 1000, lens.minFocusMm));
      return;
    }
    setFocusMm(Math.max(distanceAt(photo, u, v) * 1000, lens.minFocusMm));
  }

  function rewind() {
    playRewind();
    setRollFrames([]);
  }

  const shape = apertureShape(lens, fNumber);
  const standardInfo = SHARPNESS_STANDARDS.find((s) => s.id === shot.standard)!;
  const canHyperfocal = shot.dof.hyperfocalMm >= lens.minFocusMm;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <div>
            <h1>Rangefinder</h1>
            <p>Depth of field studio</p>
          </div>
        </div>
        <div className="topbar-tools">
          <button
            type="button"
            className="icon-button"
            aria-pressed={!muted}
            aria-label={muted ? "Turn sounds on" : "Turn sounds off"}
            onClick={() => {
              setMuted(!muted);
              setMutedState(!muted);
              if (muted) playApertureClick();
            }}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" />
              {muted ? (
                <path d="M16 9l5 6M21 9l-5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              ) : (
                <path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
              )}
            </svg>
          </button>
          <Segmented
            label="Units"
            value={units}
            onChange={setUnits}
            options={[
              { value: "metric", label: "m" },
              { value: "imperial", label: "ft" },
            ]}
          />
        </div>
      </header>

      <main className="layout">
        <div className="col-main">
          <section className="panel stage-preview" aria-label="Simulated photo">
            <div className="panel-head">
              <h2>Simulated photo</h2>
              {lenses.length > 1 && (
                <button type="button" className="btn btn-small" aria-pressed={compare} onClick={toggleCompare}>
                  {compare ? "Close comparison" : "Compare lenses"}
                </button>
              )}
            </div>
            <ScenePicker
              sceneId={sceneId}
              onSelect={selectScene}
              onUpload={uploadPhoto}
              status={sceneStatus}
              hasUpload={upload !== null}
              units={units}
              upload={
                upload
                  ? {
                      distanceM: upload.distanceM,
                      ev100: upload.ev100,
                      onDistance: (m) => {
                        setUpload({ ...upload, distanceM: m });
                        setFocusMm(Math.max(m * 1000, lens.minFocusMm));
                      },
                      onLight: (ev) => setUpload({ ...upload, ev100: ev }),
                    }
                  : undefined
              }
            />
            <BokehPreview
              veil={challengeHidden ? "The photo appears when you take the shot." : undefined}
              ref={previewRef}
              a={previewSide(lens, shot, developFor(lens, fNumber, shot.frameWidthMm, 7, 0.35), photo)}
              b={compare && lenses.length > 1 ? previewSide(lensB, shotB, developFor(lensB, shotB.fNumber, shotB.frameWidthMm, 7, 0.35), photo) : null}
              onTap={photo ? tapToFocus : undefined}
              aspect={shot.frameWidthMm / shot.frameHeightMm}
            />
            <div className="shutter-row">
              <div className="shutter-info">
                <span className="gear-name">
                  {formatFNumber(fNumber)} · {formatShutter(shutterSec)} · {isFilm ? look.name : `ISO ${iso}`}
                </span>
                <span className="gear-meta">
                  {isFilm ? (rollFull ? "Roll finished: rewind to load a new one" : `Frame ${rollFrames.length + 1} of ${ROLL_LENGTH}`) : `${cardFrames.length} on the card`}
                </span>
              </div>
              <button
                type="button"
                className="shutter-button"
                onClick={() => {
                  fireShutter();
                  if (challenge && !challenge.shotTaken) setChallenge({ ...challenge, shotTaken: true });
                }}
                disabled={rollFull}
                aria-label="Release the shutter"
              >
                <span key={flash} className={flash ? "shutter-blink" : undefined} />
              </button>
            </div>

            {compare && lenses.length > 1 && (
              <div className="compare-row">
                <label className="field">
                  <span>Lens B</span>
                  <select
                    value={lensB.id}
                    onChange={(e) => {
                      const next = findLens(e.target.value);
                      setLensBId(next.id);
                      setFNumberB(next.maxAperture);
                    }}
                  >
                    <LensOptions body={body} lenses={lenses} />
                  </select>
                </label>
                <label className="field field-narrow">
                  <span>Aperture B</span>
                  <select value={shotB.fNumber} onChange={(e) => setFNumberB(Number(e.target.value))}>
                    {stopsB.map((n) => <option key={n} value={n}>{formatFNumber(n)}</option>)}
                  </select>
                </label>
              </div>
            )}
            <p className="hint">
              {lens.apertureBlades
                ? `${shape.blades}-blade iris, as published for this lens.`
                : `Generic ${GENERIC_BLADES}-blade rounded iris; Leica doesn't publish this lens's blade count.`}{" "}
              {photo
              ? `Blur, exposure and grain are computed from the optics and an AI depth map, so edges can be imperfect. ${sampleInfo ? sampleInfo.credit + "." : ""} Tap the photo to focus.`
              : "Blur, exposure and grain are computed; the scene itself is illustrated."}
              {compare && " Drag the divider to compare."}
            </p>
          </section>

          {isRangefinder(body) && (
            <section className="panel stage-finder" aria-label="Rangefinder">
              <div className="panel-head">
                <h2>Rangefinder · {body.name}</h2>
                {!challenge && !photo && (
                  <button type="button" className="btn btn-small" onClick={startChallenge}>
                    Focus challenge
                  </button>
                )}
              </div>
              <Viewfinder
                body={body}
                lens={lens}
                focusMm={focusMm}
                subjectMm={shot.subjectMm}
                backgroundMm={shot.backgroundMm}
                shape={shape}
                photo={photo}
                meter={body.meter === "none" ? undefined : { kind: body.meter, errorStops, shutterLabel: formatShutter(shutterSec).replace("1/", ""), auto }}
                onFocusChange={setFocusMm}
              />
              {challenge && (
                <div className="challenge" role="status">
                  {challenge.shotTaken ? (
                    <p>
                      <strong className={shot.subjectSharp ? "ok" : "miss"}>
                        {shot.subjectSharp ? "Sharp." : "Missed focus."}
                      </strong>{" "}
                      The subject was at {formatDistance(shot.subjectMm, units)}; you focused at{" "}
                      {formatDistance(focusMm, units)}
                      {Number.isFinite(focusMm) &&
                        ` (${formatLength(Math.abs(focusMm - shot.subjectMm), units)} ${focusMm > shot.subjectMm ? "behind" : "in front"})`}
                      . Depth of field at {formatFNumber(fNumber)}: {formatDistance(shot.dof.nearMm, units)} to{" "}
                      {formatDistance(shot.dof.farMm, units)}.
                    </p>
                  ) : (
                    <p>
                      The subject is somewhere between {formatDistance(challengeMinMm, units)} and{" "}
                      {formatDistance(challengeMaxMm, units)}. Turn the focus ring, or drag across the finder, until the two
                      images of the scarf in the patch merge into one. Then take the shot.
                    </p>
                  )}
                  <div className="actions">
                    {challenge.shotTaken ? (
                      <>
                        <button type="button" className="btn btn-red" onClick={startChallenge}>Try again</button>
                        <button type="button" className="btn" onClick={() => setChallenge(null)}>Done</button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="btn btn-red"
                          onClick={() => {
                            fireShutter();
                            setChallenge({ ...challenge, shotTaken: true });
                          }}
                        >
                          Take the shot
                        </button>
                        <button type="button" className="btn" onClick={() => setChallenge(null)}>Cancel</button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </section>
          )}

          <section className="panel stage-barrel" aria-label="Lens">
            <div className="panel-head">
              <h2>Focus &amp; aperture rings</h2>
              <span className="muted small">Drag or tap the rings</span>
            </div>
            <LensBarrel
              lens={lens}
              stops={stops}
              fNumber={fNumber}
              focusMm={focusMm}
              cocMm={shot.cocMm}
              units={units}
              onFocusChange={setFocusMm}
              onApertureChange={changeAperture}
            />
            <div className="actions">
              <button
                type="button"
                className="btn btn-red"
                disabled={!canHyperfocal}
                onClick={() => setFocusMm(shot.dof.hyperfocalMm)}
              >
                Hyperfocal · {formatDistance(shot.dof.hyperfocalMm, units)}
              </button>
              <button type="button" className="btn" onClick={() => setFocusMm(Infinity)}>∞</button>
              <button type="button" className="btn" onClick={() => setFocusMm(lens.minFocusMm)}>
                Closest · {formatDistance(lens.minFocusMm, units)}
              </button>
            </div>
          </section>

          <ContactSheet
            frames={frames}
            capacity={isFilm ? ROLL_LENGTH : null}
            filmName={isFilm ? look.name : null}
            base={isFilm ? (look.mono ? "bw" : look.kind === "slide" ? "slide" : "color") : "digital"}
            onRewind={rewind}
          />

          <section className="panel stage-scene" aria-label="Scene">
            <div className="panel-head">
              <h2>{body.name} · {lens.name}</h2>
              <span className="chip chip-red">{formatFNumber(fNumber)}</span>
            </div>
            <SceneDiagram
              shot={shot}
              minFocusMm={lens.minFocusMm}
              units={units}
              onFocusChange={setFocusMm}
              hideSubject={challengeHidden}
              onBackgroundChange={(mm) => setBackgroundOffsetMm(Number.isFinite(mm) ? mm - shot.subjectMm : Infinity)}
            />
            <p className="hint">Drag the figure to focus, or drag the tree to move the background.</p>
          </section>
        </div>

        <div className="col-side">
          <Readouts shot={shot} units={units} />

          <ExposurePanel
            body={body}
            look={look}
            onFilm={setFilmId}
            iso={iso}
            onIso={(i) => {
              playDialClick();
              setIsoDigital(i);
            }}
            auto={auto}
            onAuto={setAutoExposure}
            shutterSec={shutterSec}
            onShutter={changeShutter}
            errorStops={errorStops}
            tripod={tripod}
            onTripod={setTripod}
            shakeLikely={shakeLikely}
            sceneLabel={sceneLabel}
            filmLocked={rollFrames.length > 0}
          />

          <section className="panel stage-setup" aria-label="Camera and lens">
            <div className="panel-head"><h2>Camera &amp; lens</h2></div>

            <div className="kit">
              <BodyArt body={body} lens={lens} className="kit-body" />
            </div>

            <div className="gear-buttons">
              <button type="button" className="gear-button" onClick={() => setPicker("body")}>
                <BodyArt body={body} className="gear-thumb" />
                <span className="gear-text">
                  <span className="gear-label">Camera</span>
                  <span className="gear-name">{body.name}</span>
                  <span className="gear-meta">{bodyMeta(body)}</span>
                </span>
              </button>
              <button type="button" className="gear-button" onClick={() => setPicker("lens")} disabled={lenses.length === 1}>
                <LensArt lens={lens} className="gear-thumb" />
                <span className="gear-text">
                  <span className="gear-label">Lens{isAdapted(body, lens) ? " · via adapter" : ""}</span>
                  <span className="gear-name">{lens.name}</span>
                  <span className="gear-meta">
                    {lens.year} · closest {formatDistance(lens.minFocusMm, units)}
                    {lens.nickname ? ` · ${lens.nickname}` : ""}
                  </span>
                </span>
              </button>
            </div>

            <GearPicker
              open={picker === "body"}
              title="Choose a camera"
              selectedId={bodyId}
              onSelect={selectBody}
              onClose={() => setPicker(null)}
              items={BODIES.map<PickerItem>((b) => ({
                id: b.id,
                name: b.name,
                group: b.family,
                meta: bodyMeta(b),
                badge: b.medium === "film" ? "Film" : b.medium === "mono" ? "Monochrom" : undefined,
                art: <BodyArt body={b} />,
              }))}
            />
            <GearPicker
              open={picker === "lens"}
              title={`Lenses for the ${body.name}`}
              selectedId={lensId}
              onSelect={selectLens}
              onClose={() => setPicker(null)}
              items={lenses.map<PickerItem>((l) => ({
                id: l.id,
                name: l.name,
                group: lensGroup(body, l),
                meta: `${l.year} · f/${l.maxAperture} · closest ${formatDistance(l.minFocusMm, units)}`,
                badge: l.classic ? "Classic" : l.nickname,
                art: <LensArt lens={l} />,
              }))}
            />

            {body.megapixels && body.megapixels.length > 1 && (
              <div className="field">
                <span>Resolution</span>
                <Segmented
                  label="Resolution"
                  value={megapixels ?? body.megapixels[0]}
                  onChange={setMegapixels}
                  options={body.megapixels.map((mp) => ({ value: mp, label: `${mp} MP` }))}
                />
              </div>
            )}

            {body.cropFocalLengths && (
              <div className="field">
                <span>Framing</span>
                <Segmented
                  label="Digital crop framing"
                  value={cropFocalMm ?? body.cropFocalLengths[0]}
                  onChange={(mm) => setCropFocalMm(mm === body.cropFocalLengths![0] ? null : mm)}
                  options={body.cropFocalLengths.map((mm) => ({ value: mm, label: `${mm}` }))}
                />
              </div>
            )}

            {!photo && <div className="field">
              <span>Background</span>
              <Segmented
                label="Background distance behind subject"
                value={backgroundOffsetMm}
                onChange={setBackgroundOffsetMm}
                options={BACKGROUND_PRESETS[units].map(({ mm, label }) => ({ value: mm, label }))}
              />
            </div>}
          </section>

          <section className="panel stage-details" aria-label="Details">
            <div className="panel-head"><h2>Sharpness standard</h2></div>
            <Segmented
              label="Sharpness standard"
              value={shot.standard}
              onChange={setStandard}
              options={SHARPNESS_STANDARDS.filter((s) => s.id !== "pixel" || body.megapixels).map((s) => ({
                value: s.id,
                label: s.label,
              }))}
            />
            <p className="muted small standard-note">{standardInfo.description}</p>
            <Details shot={shot} />
          </section>
        </div>
      </main>

      <footer className="footer">
        Independent tool, not affiliated with or endorsed by Leica Camera AG. Product names are
        trademarks of their owners. Lens specs come from public sources; check them against Leica's
        datasheets. Distances are measured from the lens (thin-lens model).
      </footer>
    </div>
  );
}
