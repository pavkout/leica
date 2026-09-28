import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { isMuted, playAdvance, playApertureClick, playDialClick, playMountClick, playRewind, playShutter, setMuted } from "./audio/sounds";
import { shutterVoiceFor } from "./audio/voices";
import BokehPreview, { type PreviewHandle, type PreviewSide } from "./components/BokehPreview";
import ContactSheet, { type Frame } from "./components/ContactSheet";
import type { OutcomeTag } from "./state/rollExport";
import ExposurePanel from "./components/ExposurePanel";
import ScenePicker from "./components/ScenePicker";
import LensBarrel from "./components/LensBarrel";
import { Details } from "./components/Readouts";
import ShotReading from "./components/ShotReading";
import SceneDiagram from "./components/SceneDiagram";
import Viewfinder from "./components/Viewfinder";
import BodyArt from "./components/gear/BodyArt";
import GearImage, { GEAR_IMAGE_CREDITS, hasGearImage } from "./components/gear/GearImage";
import GearPicker, { type PickerItem } from "./components/gear/GearPicker";
import LensArt from "./components/gear/LensArt";
import Segmented from "./components/Segmented";
import DistanceInput from "./components/DistanceInput";
import Iris from "./components/Iris";
import Sunny16Trainer from "./components/Sunny16Trainer";
import IntentAssistant from "./components/IntentAssistant";
import PortraitTrainer from "./components/PortraitTrainer";
import StabilityTrainer from "./components/StabilityTrainer";
import FilmLoadingTrainer from "./components/FilmLoadingTrainer";
import Leica3D from "./components/Leica3D";
import LensDNA from "./components/LensDNA";
import FlareLab from "./components/FlareLab";
import { preload3D, threeDAvailable } from "./three/capabilities";
import DemoTour from "./components/DemoTour";
import RecipesPanel from "./components/RecipesPanel";
import MotionSimulator from "./components/MotionSimulator";
import LensTrial from "./components/LensTrial";
import LensGenerations from "./components/LensGenerations";
import LongExposureLab from "./components/LongExposureLab";
import CameraAnatomy from "./components/CameraAnatomy";
import MuseumTimeline from "./components/MuseumTimeline";
import Darkroom from "./components/Darkroom";
import KioskShell from "./components/KioskShell";
import CameraView from "./camera/CameraView";
import CameraMenu from "./camera/CameraMenu";
import Playback from "./camera/Playback";
import LiveScreen, { type LiveHandle } from "./camera/live/LiveScreen";
import LightPresets from "./camera/live/LightPresets";
import IrisTransition from "./components/app/IrisTransition";
import { PAGE_TRANSITION_MS, irisBlink, setIrisBlades } from "./components/app/iris";
import ToolNav from "./components/app/ToolNav";
import Wordmark from "./components/app/Wordmark";
import ToolBoundary from "./components/app/ToolBoundary";
import { useRoute } from "./components/app/useRoute";
import { TOOLS, findTool, toolForStage, toolsFor, type Tool, type ToolId } from "./app/tools";
import { parseKiosk } from "./state/kiosk";
import { describeRecord, parseRecord, type DevelopmentRecord } from "./physics/darkroom";
import { bodyForLens } from "./data/timeline";
import PerspectiveLab from "./components/PerspectiveLab";
import RangefinderCalibration from "./components/RangefinderCalibration";
import { parseTrial } from "./physics/lensTrial";
import { findRecipe, type Recipe } from "./data/recipes";
import { recipePlan } from "./physics/recipes";
import { findFilm } from "./preview/film";
import { getString, setString } from "./services/persistence";
import type { DemoActions } from "./state/demoScript";
import Insights from "./components/Insights";
import FinderCompare from "./components/FinderCompare";
import LiveView from "./components/LiveView";
import { FLAGS } from "./flags";
import {
  BODIES,
  apertureStops,
  findBody,
  findLens,
  isAdapted,
  lensesForBody,
  formatShutter,
  nearestStop,
  shutterSpeeds,
  isoSettings,
  type Body,
  type Lens,
} from "./data/gear";
import { correctShutter, exposureError, shakeBlurMm } from "./physics/exposure";
import { ASSUMED_PHONE_FOV_DEG } from "./physics/liveView";
import { eiStops, nearestDevelopLevel } from "./physics/pushPull";
import { SHARPNESS_STANDARDS, computeShot, type Shot } from "./physics/model";
import { useOpticalState } from "./state/opticalState";
import { vignetteStops } from "./physics/lensCharacter";
import { hyperfocal } from "./physics/optics";
import { useBag } from "./state/bag";
import {
  clearFrames as clearStoredFrames,
  loadFrames as loadStoredFrames,
  saveFrame as saveStoredFrame,
  updateFrameNote as saveStoredFrameNote,
} from "./services/db";
import { GENERIC_BLADES, apertureShape } from "./preview/aperture";
import { developedLook, grainStrength, lookFor, type FilmLook } from "./preview/film";
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
const PHONE_FOV_DEG = ASSUMED_PHONE_FOV_DEG;
const sampleCache = new Map<string, Promise<PhotoScene>>();
const ROLL_LENGTH = 36;
/** The current roll's recorded development (Darkroom mode), cleared on rewind. */
const DEV_RECORD_KEY = "rangefinder-roll-development";

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
  const optical = useOpticalState();
  const {
    bodyId,
    lensId,
    body,
    lens,
    lenses,
    stops,
    fNumber,
    focusMm,
    backgroundOffsetMm,
    megapixels,
    cropFocalMm,
    standard,
    units,
    filmId,
    isoDigital,
    autoExposure,
    manualShutter,
    tripod,
    filmEI,
    pushPullStops,
    evComp,
    setEvComp,
    selectLens: selectLensState,
    selectFilm,
    setFNumber,
    setFocusMm,
    setBackgroundOffsetMm,
    setMegapixels,
    setCropFocalMm,
    setStandard,
    setUnits,
    setIsoDigital,
    setAutoExposure,
    setManualShutter,
    setTripod,
    setFilmEI,
    setPushPullStops,
  } = optical;
  const { savedIds, toggle: toggleBag } = useBag();
  const [compare, setCompare] = useState(false);
  // Studio: dim everything outside the depth of field over the photo.
  const [showSharp, setShowSharp] = useState(true);
  // Dev-only test hook: the feature suites predate the tool structure and drive several tools at once,
  // so a test run can mount every tool at once. Stripped from production builds.
  const testAll = import.meta.env.DEV && (window as unknown as { __LEICA_ALL__?: boolean }).__LEICA_ALL__ === true;

  const [lensBId, setLensBId] = useState("m-50-0.95");
  const [fNumberB, setFNumberB] = useState(1.4);
  // Focus challenge: the subject stands at a hidden distance instead of at the focus.
  const [picker, setPicker] = useState<"body" | "lens" | null>(null);
  const [challenge, setChallenge] = useState<{ subjectMm: number; shotTaken: boolean } | null>(null);
  const [liveViewOpen, setLiveViewOpen] = useState(false);
  // Kiosk mode (feature #20): `?kiosk[=idleSeconds]` puts a guided shell over the same app.
  const [kiosk] = useState(() => (typeof location !== "undefined" ? parseKiosk(location.search) : parseKiosk("")));
  // 60-second tour (feature #35): `?demo` starts it on load (event/kiosk use).
  const [demoActive, setDemoActive] = useState(() => typeof location !== "undefined" && new URLSearchParams(location.search).has("demo"));
  // The tour's rangefinder step puts the subject at a fixed distance, so the patch can be split and aligned.
  const [demoSubjectMm, setDemoSubjectMm] = useState<number | null>(null);
  const [demoLiveOpened, setDemoLiveOpened] = useState(false);
  // Photo Recipes (feature #28): the loaded recipe (for light warnings) and the viewer's saved ones.
  const [activeRecipe, setActiveRecipe] = useState<{ id: string; notes: string[] } | null>(null);
  const [savedRecipes, setSavedRecipes] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(getString("rangefinder-saved-recipes") ?? "[]") as string[]);
    } catch {
      return new Set();
    }
  });
  const [fullScreenFinder, setFullScreenFinder] = useState(false);
  // Capture.
  const [muted, setMutedState] = useState(isMuted);
  const [rollFrames, setRollFrames] = useState<Frame[]>([]);
  const [devRecord, setDevRecordState] = useState<DevelopmentRecord | null>(() => parseRecord(getString(DEV_RECORD_KEY)));
  function setDevRecord(r: DevelopmentRecord | null) {
    setDevRecordState(r);
    setString(DEV_RECORD_KEY, r ? JSON.stringify(r) : "");
  }
  const [cardFrames, setCardFrames] = useState<Frame[]>([]);
  useEffect(() => {
    loadStoredFrames("film").then(setRollFrames);
    loadStoredFrames("digital").then(setCardFrames);
  }, []);
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

  const uploadScene = useMemo(
    () => (upload ? sceneFromCanvases(upload.key, upload.photo, upload.depth, PHONE_FOV_DEG, { ...upload.anchor, distanceM: upload.distanceM }) : null),
    [upload]
  );
  const photo = sceneId === "upload" ? uploadScene : sceneId === "street" ? null : samplePhoto;
  const sampleInfo = SAMPLE_SCENES.find((s) => s.id === sceneId);
  // Live camera (#37): the meter reads the real scene; without the phone's exposure data, the light the user picked.
  const [liveOn, setLiveOn] = useState(false);
  const [liveEv, setLiveEv] = useState<number | null>(null);
  const [liveFallbackEv, setLiveFallbackEv] = useState(12);
  const liveRef = useRef<LiveHandle>(null);
  const staticEv = sceneId === "upload" ? upload?.ev100 ?? 12 : sampleInfo?.ev100 ?? STREET_EV;
  const sceneEv = liveOn && liveEv !== null ? liveEv : staticEv;
  const sceneLabel = `${sceneId === "street" ? "Night street" : sceneId === "upload" ? "Your photo" : sampleInfo?.name ?? ""} · EV ${sceneEv}`;
  // In a photo the subject is the calibration anchor; the background is whatever the photo holds.
  const photoSubjectMm = sampleInfo ? sampleInfo.anchor.distanceM * 1000 : upload && sceneId === "upload" ? upload.distanceM * 1000 : undefined;

  const shot = computeShot({
    body,
    lens,
    fNumber,
    focusMm,
    subjectMm: photo ? photoSubjectMm : (demoSubjectMm ?? challenge?.subjectMm),
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

  function selectBody(id: string) {
    if (!isRangefinder(findBody(id))) setChallenge(null);
    optical.selectBody(id);
  }

  function selectLens(id: string) {
    playMountClick();
    selectLensState(id);
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
  const baseLook: FilmLook = lookFor(body, filmId, isoDigital);
  const boxIso = baseLook.iso;
  // EI is a metering decision (what the meter/auto-exposure sees); push/pull
  // is a development decision (contrast/grain only) — kept as two separate
  // parameters, per the master plan, not one derived from the other.
  const iso = isFilm && filmEI !== null ? filmEI : boxIso;
  const look: FilmLook = isFilm ? developedLook(baseLook, pushPullStops) : baseLook;
  const auto = body.autoExposure && autoExposure;
  const speeds = shutterSpeeds(body);
  const clampShutter = (t: number) => Math.min(Math.max(t, body.shutter.fastest), body.shutter.slowest);
  // Exposure compensation (the thumb wheel) moves what auto exposure aims for: +1 meters as if the scene were a stop darker.
  const shutterSec = auto
    ? clampShutter(correctShutter(sceneEv - evComp, fNumber, iso))
    : speeds.reduce((best, t) => (Math.abs(Math.log(t / manualShutter)) < Math.abs(Math.log(best / manualShutter)) ? t : best));
  const errorStops = exposureError(sceneEv, fNumber, shutterSec, iso);
  /** What the meter shows: the error from the compensated target. */
  const meterStops = errorStops - evComp;
  const shakeLikely = shutterSec > 1 / lens.focalMm;

  function developFor(l: Lens, n: number, frameWidthMm: number, seed: number, angle: number): DevelopParams {
    const t = auto ? clampShutter(correctShutter(sceneEv - evComp, n, iso)) : shutterSec;
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
  const frameStatusLabel = isFilm
    ? rollFull
      ? "Roll finished: rewind to load a new one"
      : `Frame ${rollFrames.length + 1} of ${ROLL_LENGTH}`
    : `${cardFrames.length} on the card`;

  // App structure: the camera is home (#37); MENU opens the four modes of tools, routed by the URL hash (app/tools.ts).
  const { route, navigate } = useRoute();
  const toolAvailable = (t: Tool) =>
    (t.id !== "stability" || FLAGS.motionSensors) && ((t.id !== "character" && t.id !== "flare") || FLAGS.experimentalLensCharacter);
  const modeTools = toolsFor(route.mode, toolAvailable);
  const activeTool: ToolId = modeTools.some((t) => t.id === route.tool) ? route.tool : modeTools[0].id;
  const onTools = route.screen === "tool";
  // Tools stay mounted once visited, so their settings survive switching; the 3D view is the exception
  // and is released when left, to give back the GPU.
  const [visited, setVisited] = useState<Set<ToolId>>(() => new Set([activeTool]));
  useEffect(() => {
    setVisited((v) => (v.has(activeTool) ? v : new Set(v).add(activeTool)));
  }, [activeTool]);
  const goTool = (id: ToolId) => {
    const t = findTool(id);
    if (t) navigate({ screen: "tool", mode: t.mode, tool: t.id });
  };
  const goCamera = () => navigate({ ...route, screen: "camera" });
  const [playOpen, setPlayOpen] = useState(false);
  const cameraPreviewRef = useRef<PreviewHandle>(null);
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (window as unknown as { __leicaNav?: unknown }).__leicaNav = { go: goTool };
  });

  // The screen-transition iris has the chosen lens's blades.
  useEffect(() => setIrisBlades(lens.apertureBlades ?? GENERIC_BLADES), [lens.apertureBlades]);

  // 3D view (feature #2): the procedural model is an M body, so it's offered for M rangefinders only.
  const show3D = onTools && activeTool === "camera3d";
  // Counts film wind-ons so the 3D advance lever strokes in time with the advance sound.
  const [advanceCount, setAdvanceCount] = useState(0);
  const can3D = FLAGS.threeD && !!body.rangefinder && lens.mount === "M" && threeDAvailable();

  function changeAperture(n: number) {
    if (n !== fNumber) playApertureClick();
    setFNumber(n);
  }

  /** The 3D dial: turning onto A engages auto exposure, turning off it sets that speed manually. */
  function turnShutterDial(next: { auto: boolean; sec: number }) {
    playDialClick();
    if (next.auto) setAutoExposure(true);
    else {
      if (body.autoExposure) setAutoExposure(false);
      setManualShutter(next.sec);
    }
  }

  function changeShutter(t: number) {
    playDialClick();
    setManualShutter(t);
  }

  /** Adds a captured image (however it was rendered) to the current roll/card, and persists it. */
  /** `settings` records another tool's settings (e.g. the Long Exposure Lab's) instead of the simulator's. */
  function addFrame(url: string, captionSuffix?: string, settings?: { fNumber: number; shutterSec: number; iso: number; note?: string }, manualWind = false) {
    const number = frames.length + 1;
    const n = settings?.fNumber ?? fNumber;
    const t = settings?.shutterSec ?? shutterSec;
    const i = settings?.iso ?? iso;
    const frame: Frame = {
      id: Math.floor(Math.random() * 100000),
      number,
      url,
      caption: `${body.name} · ${lens.name} · ${formatFNumber(n)} · ${formatShutter(t)} · ${isFilm && !settings ? look.name : `ISO ${i}`}${captionSuffix ? ` · ${captionSuffix}` : ""}`,
      fileName: `rangefinder-${String(number).padStart(2, "0")}.jpg`,
      meta: { body: body.name, lens: lens.name, focalMm: lens.focalMm, fNumber: n, shutterSec: t, focusMm, iso: i, filmOrSensor: isFilm ? look.name : `ISO ${i}`, evOffset: settings ? 0 : errorStops },
      note: settings?.note,
    };
    (isFilm ? setRollFrames : setCardFrames)((list) => [...list, frame]);
    void saveStoredFrame(isFilm ? "film" : "digital", frame);
    // In the camera the lever winds on (and plays the advance); elsewhere the app winds for you.
    if (isFilm && !manualWind && rollFrames.length + 1 < ROLL_LENGTH) setTimeout(() => {
        playAdvance();
        setAdvanceCount((n) => n + 1);
      }, Math.min(shutterSec, 2) * 1000 + 200);
  }

  /** `fromCamera`: fired from the camera view, whose own preview captures and whose lever winds on. */
  function fireShutter(fromCamera = false) {
    if (rollFull) return;
    if (fromCamera && liveOn) {
      // Live: the frame on the screen, as the simulated camera renders it.
      const live = liveRef.current?.capture();
      if (!live) return;
      playShutter(shutterSec, shutterVoiceFor(body));
      setFlash((f) => f + 1);
      irisBlink();
      addFrame(live, "Live", undefined, true);
      return;
    }
    const seed = Math.floor(Math.random() * 100000);
    const angle = Math.random() * Math.PI;
    playShutter(shutterSec, shutterVoiceFor(body));
    setFlash((f) => f + 1);
    irisBlink();
    const side = previewSide(lens, shot, developFor(lens, fNumber, shot.frameWidthMm, seed, angle), photo);
    const url = (fromCamera ? cameraPreviewRef : previewRef).current?.capture(side.params);
    if (url) addFrame(url, undefined, undefined, fromCamera);
  }

  /** Same roll/card, but the image is a real captured Live View frame, not a simulated render. */
  function captureLiveFrame(url: string) {
    if (rollFull) return;
    playShutter(shutterSec, shutterVoiceFor(body));
    irisBlink();
    addFrame(url, "Live View");
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
    void clearStoredFrames("film");
    setDevRecord(null);
  }

  function updateFrameNote(id: number, note: string) {
    (isFilm ? setRollFrames : setCardFrames)((list) => list.map((f) => (f.id === id ? { ...f, note } : f)));
    void saveStoredFrameNote(isFilm ? "film" : "digital", id, note);
  }

  function updateFrameOutcome(id: number, outcome: OutcomeTag | undefined) {
    const existing = frames.find((f) => f.id === id);
    if (!existing) return;
    const updated: Frame = { ...existing, outcome };
    if (!outcome) delete updated.outcome;
    (isFilm ? setRollFrames : setCardFrames)((list) => list.map((f) => (f.id === id ? updated : f)));
    void saveStoredFrame(isFilm ? "film" : "digital", updated);
  }

  // Memoised: the viewfinder repaints (expensively) whenever this object changes identity.
  const shape = useMemo(() => apertureShape(lens, fNumber), [lens, fNumber]);
  const standardInfo = SHARPNESS_STANDARDS.find((s) => s.id === shot.standard)!;
  const canHyperfocal = shot.dof.hyperfocalMm >= lens.minFocusMm;
  const viewfinderProps = {
    body,
    lens,
    focusMm,
    subjectMm: shot.subjectMm,
    backgroundMm: shot.backgroundMm,
    shape,
    photo,
    meter: body.meter === "none" ? undefined : { kind: body.meter, errorStops, shutterLabel: formatShutter(shutterSec).replace("1/", ""), auto },
    onFocusChange: setFocusMm,
  };


  function openLive() {
    setLiveViewOpen(true);
    if (demoActive) setDemoLiveOpened(true);
  }

  function startDemo() {
    setDemoLiveOpened(false);
    setDemoActive(true);
  }
  // Fetch what the tour needs as soon as it starts (the 3D chunk, the stand-in Live scene), so no later step waits on the network.
  const demoLiveSceneUrl = `${import.meta.env.BASE_URL}scenes/sun.jpg`;
  useEffect(() => {
    if (!demoActive) return;
    void preload3D();
    new Image().src = demoLiveSceneUrl;
  }, [demoActive, demoLiveSceneUrl]);
  const demoHyperfocalMm = hyperfocal(lens.focalMm, fNumber, shot.cocMm);
  /** Load a recipe through the same setters the controls use, so every control shows it. */
  function loadRecipe(r: Recipe) {
    const lockedFilm = isFilm && rollFrames.length > 0 ? { id: filmId, name: baseLook.name, iso: boxIso } : null;
    const plan = recipePlan(r, { body, lens, lenses, lockedFilm, cocMm: shot.cocMm }, (id) => findFilm(id).iso);
    if (plan.lensId !== lens.id) selectLens(plan.lensId);
    if (isFilm) {
      if (plan.filmId) {
        selectFilm(plan.filmId);
        if (r.ei) {
          setFilmEI(r.ei);
          setPushPullStops(nearestDevelopLevel(eiStops(findFilm(plan.filmId).iso, r.ei)).stops);
        }
      }
    } else setIsoDigital(plan.iso);
    changeAperture(plan.fNumber);
    if (body.autoExposure) setAutoExposure(false);
    setManualShutter(plan.shutterSec);
    setFocusMm(plan.focusMm);
    setActiveRecipe({ id: r.id, notes: plan.notes });
  }
  // A shared trial link (?try=1&body=…&lens=…&d=…&scene=…&f=…) recreates that setup once on open.
  // Every id is checked against the catalogue first, so a bad link can't break the app.
  const trialFromLink = useRef(typeof location !== "undefined" ? parseTrial(location.search) : null);
  useEffect(() => {
    const t = trialFromLink.current;
    trialFromLink.current = null;
    if (!t) return;
    const trialBody = BODIES.find((b) => b.id === t.bodyId);
    const trialLens = trialBody && lensesForBody(trialBody).find((l) => l.id === t.lensId);
    if (!trialBody || !trialLens) return;
    selectBody(trialBody.id);
    selectLens(trialLens.id);
    setFocusMm(Math.max(t.distanceMm, trialLens.minFocusMm));
    if (t.fNumber && t.fNumber >= trialLens.maxAperture && t.fNumber <= trialLens.minAperture) changeAperture(t.fNumber);
    if (t.sceneId === "street" || SAMPLE_SCENES.some((sc) => sc.id === t.sceneId)) void selectScene(t.sceneId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // A shared recipe link (?recipe=<id>) loads that recipe once on open.
  const recipeFromLink = useRef(typeof location !== "undefined" ? new URLSearchParams(location.search).get("recipe") : null);
  useEffect(() => {
    const r = findRecipe(recipeFromLink.current);
    recipeFromLink.current = null;
    if (r) loadRecipe(r);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  function toggleSavedRecipe(id: string) {
    setSavedRecipes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      setString("rangefinder-saved-recipes", JSON.stringify([...next]));
      return next;
    });
  }

  const demoActions: DemoActions = {
    selectBody,
    selectLens,
    open3D: () => goTool("camera3d"),
    setFocusMm,
    setAperture: changeAperture,
    setDemoSubject: setDemoSubjectMm,
    openLive,
    reveal: (selector) => {
      const reduce = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
      const t = toolForStage(selector.replace(/^\./, ""));
      if (t && (t.id !== activeTool || !onTools)) navigate({ screen: "tool", mode: t.mode, tool: t.id });
      // Scroll once the tool is on screen (after the iris has opened).
      window.setTimeout(
        () => document.querySelector(selector)?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" }),
        reduce ? 60 : PAGE_TRANSITION_MS + 60,
      );
    },
  };

  const needsRangefinder = (what: string) => (
    <section className="panel tool-empty" aria-label={`${what} needs a rangefinder`}>
      <p>
        The {body.name} has no rangefinder. {what} works with an M body.
      </p>
      <button type="button" className="btn btn-red" onClick={() => setPicker("body")}>
        Choose a camera
      </button>
    </section>
  );

  /** The scene choice: shown in the Studio and from the camera's FN button. */
  const scenePicker = () => (
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
  );

  const previewSection = (
    <section className="panel stage-preview" aria-label="Simulated photo">
      <div className="panel-head">
        <h2>Simulated photo</h2>
        <span className="row-actions">
          <button
            type="button"
            className="btn btn-small"
            aria-pressed={showSharp}
            onClick={() => setShowSharp((v) => !v)}
            disabled={compare}
          >
            What&apos;s sharp
          </button>
          {FLAGS.liveView && (
            <button type="button" className="btn btn-small" onClick={openLive}>
              Light meter
            </button>
          )}
          {lenses.length > 1 && (
            <button type="button" className="btn btn-small" aria-pressed={compare} onClick={toggleCompare}>
              {compare ? "Close comparison" : "Compare lenses"}
            </button>
          )}
        </span>
      </div>
      <BokehPreview
        veil={challengeHidden ? "The photo appears when you take the shot." : undefined}
        ref={previewRef}
        a={previewSide(lens, shot, developFor(lens, fNumber, shot.frameWidthMm, 7, 0.35), photo)}
        b={compare && lenses.length > 1 ? previewSide(lensB, shotB, developFor(lensB, shotB.fNumber, shotB.frameWidthMm, 7, 0.35), photo) : null}
        onTap={photo ? tapToFocus : undefined}
        aspect={shot.frameWidthMm / shot.frameHeightMm}
        sharpZone={showSharp && !challengeHidden ? shot.cocMm : undefined}
      />
      {showSharp && !compare && !challengeHidden && (
        <p className="sharp-legend">
          <span className="sharp-legend-key" aria-hidden="true" /> Bright: sharp. Dimmed: outside the depth of field.
        </p>
      )}
      <div className="shutter-row">
        <div className="shutter-info">
          <span className="gear-name">
            {formatFNumber(fNumber)} · {formatShutter(shutterSec)} · {isFilm ? look.name : `ISO ${iso}`}
          </span>
          <span className="gear-meta">{frameStatusLabel}</span>
        </div>
        <button
          type="button"
          className="release"
          onClick={() => {
            fireShutter();
            if (challenge && !challenge.shotTaken) setChallenge({ ...challenge, shotTaken: true });
          }}
          disabled={rollFull}
          aria-label="Release the shutter"
        >
          <span className="release-cap" aria-hidden="true" />
          <span key={flash} className={flash ? "shutter-blink" : undefined} />
        </button>
      </div>
      {scenePicker()}

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
              {stopsB.map((n) => (
                <option key={n} value={n}>
                  {formatFNumber(n)}
                </option>
              ))}
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
  );

  const finderSection = (
    <section className="panel stage-finder" aria-label="Rangefinder">
      <div className="panel-head">
        <h2>Rangefinder · {body.name}</h2>
        <span className="row-actions">
          <button type="button" className="btn btn-small" onClick={() => setFullScreenFinder(true)}>
            Full screen
          </button>
          {!challenge && !photo && (
            <button type="button" className="btn btn-small" onClick={startChallenge}>
              Focus challenge
            </button>
          )}
        </span>
      </div>
      {!fullScreenFinder && <Viewfinder {...viewfinderProps} />}
      {challenge && (
        <div className="challenge" role="status">
          {challenge.shotTaken ? (
            <p>
              <strong className={shot.subjectSharp ? "ok" : "miss"}>{shot.subjectSharp ? "Sharp." : "Missed focus."}</strong> The subject was at{" "}
              {formatDistance(shot.subjectMm, units)}; you focused at {formatDistance(focusMm, units)}
              {Number.isFinite(focusMm) &&
                ` (${formatLength(Math.abs(focusMm - shot.subjectMm), units)} ${focusMm > shot.subjectMm ? "behind" : "in front"})`}
              . Depth of field at {formatFNumber(fNumber)}: {formatDistance(shot.dof.nearMm, units)} to {formatDistance(shot.dof.farMm, units)}.
            </p>
          ) : (
            <p>
              The subject is somewhere between {formatDistance(challengeMinMm, units)} and {formatDistance(challengeMaxMm, units)}. Turn the
              focus ring, or drag across the finder, until the two images of the scarf in the patch merge into one. Then take the shot.
            </p>
          )}
          <div className="actions">
            {challenge.shotTaken ? (
              <>
                <button type="button" className="btn btn-red" onClick={startChallenge}>
                  Try again
                </button>
                <button type="button" className="btn" onClick={() => setChallenge(null)}>
                  Done
                </button>
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
                <button type="button" className="btn" onClick={() => setChallenge(null)}>
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );

  const barrelSection = (
    <section className="panel stage-barrel" aria-label="Lens">
      <div className="panel-head">
        <h2>Focus &amp; aperture rings</h2>
        <span className="muted small">Drag or tap the rings</span>
      </div>
      <DistanceInput mm={focusMm} units={units} minMm={lens.minFocusMm} onChange={setFocusMm} />
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
        <button type="button" className="btn" disabled={lens.minFocusMm > 2000} onClick={() => setFocusMm(2000)}>
          2 m street
        </button>
        <button type="button" className="btn" disabled={lens.minFocusMm > 3000} onClick={() => setFocusMm(3000)}>
          3 m street
        </button>
        <button type="button" className="btn btn-red" disabled={!canHyperfocal} onClick={() => setFocusMm(shot.dof.hyperfocalMm)}>
          Hyperfocal · {formatDistance(shot.dof.hyperfocalMm, units)}
        </button>
        <button type="button" className="btn" onClick={() => setFocusMm(Infinity)}>
          ∞
        </button>
        <button type="button" className="btn" onClick={() => setFocusMm(lens.minFocusMm)}>
          Closest · {formatDistance(lens.minFocusMm, units)}
        </button>
      </div>
      <p className="hint">
        Copy to a real lens: set the distance scale to {formatDistance(focusMm, units)} and the aperture ring to {formatFNumber(fNumber)}, then
        match the {formatFNumber(fNumber)} marks on the engraved DOF scale against the distance index. Everything from{" "}
        {formatDistance(shot.dof.nearMm, units)} to {formatDistance(shot.dof.farMm, units)} will be sharp.
      </p>
    </section>
  );

  const sceneSection = (
    <section className="panel stage-scene" aria-label="Scene">
      <div className="panel-head">
        <h2>
          {body.name} · {lens.name}
        </h2>
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
  );

  const exposurePanel = (
    <ExposurePanel
      body={body}
      look={look}
      onFilm={selectFilm}
      iso={iso}
      boxIso={boxIso}
      onFilmEI={(ei) => {
        playDialClick();
        setFilmEI(ei);
        setPushPullStops(ei === null ? 0 : nearestDevelopLevel(eiStops(boxIso, ei)).stops);
      }}
      pushPullStops={pushPullStops}
      onPushPull={(stops) => {
        playDialClick();
        setPushPullStops(stops);
      }}
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
      savedFilmIds={savedIds.film}
      onToggleSavedFilm={(id) => toggleBag("film", id)}
    />
  );

  const setupSection = (
    <section className="panel stage-setup" aria-label="Camera and lens">
      <div className="panel-head">
        <h2>Camera &amp; lens</h2>
        <span className="panel-head-actions">
          {!demoActive && (
            <button type="button" className="btn btn-small" onClick={startDemo} aria-label="Start the 60-second tour">
              Tour
            </button>
          )}
          {can3D && (
            <button type="button" className="btn btn-small" onClick={() => goTool("camera3d")}>
              3D
            </button>
          )}
        </span>
      </div>

      {hasGearImage("bodies", body.id) || hasGearImage("lenses", lens.id) ? (
        <div className="kit kit-photos">
          <GearImage kind="bodies" id={body.id} alt={body.name} sizes="(min-width: 1080px) 180px, 45vw">
            <BodyArt body={body} className="gear-photo-fallback" />
          </GearImage>
          <GearImage kind="lenses" id={lens.id} alt={lens.name} sizes="(min-width: 1080px) 180px, 45vw">
            <LensArt lens={lens} className="gear-photo-fallback" />
          </GearImage>
        </div>
      ) : (
        <div className="kit">
          <BodyArt body={body} lens={lens} className="kit-body" />
        </div>
      )}

      <div className="gear-buttons">
        <button type="button" className="gear-button" onClick={() => setPicker("body")}>
          <GearImage kind="bodies" id={body.id} alt="" sizes="84px" className="gear-thumb">
            <BodyArt body={body} className="gear-thumb" />
          </GearImage>
          <span className="gear-text">
            <span className="gear-label">Camera</span>
            <span className="gear-name">{body.name}</span>
            <span className="gear-meta">{bodyMeta(body)}</span>
          </span>
        </button>
        <button type="button" className="gear-button" onClick={() => setPicker("lens")} disabled={lenses.length === 1}>
          <GearImage kind="lenses" id={lens.id} alt="" sizes="84px" className="gear-thumb">
            <LensArt lens={lens} className="gear-thumb" />
          </GearImage>
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

      {!photo && (
        <div className="field">
          <span>Background</span>
          <Segmented
            label="Background distance behind subject"
            value={backgroundOffsetMm}
            onChange={setBackgroundOffsetMm}
            options={BACKGROUND_PRESETS[units].map(({ mm, label }) => ({ value: mm, label }))}
          />
        </div>
      )}
    </section>
  );

  const detailsSection = (
    <section className="panel stage-details" aria-label="Details">
      <div className="panel-head">
        <h2>Sharpness standard</h2>
      </div>
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
  );

  const camera3dSection = (
    <section className="panel stage-camera3d" aria-label="Virtual camera">
      {can3D ? (
        <Leica3D
          body={body}
          lens={lens}
          fNumber={fNumber}
          focusMm={focusMm}
          shutterSec={shutterSec}
          auto={auto}
          advanceCount={advanceCount}
          units={units}
          onAperture={changeAperture}
          onFocus={(mm) => setFocusMm(Math.max(mm, lens.minFocusMm))}
          onShutter={turnShutterDial}
          fallback={
            <div className="kit">
              <BodyArt body={body} lens={lens} className="kit-body" />
            </div>
          }
        />
      ) : (
        <div className="camera3d-off">
          <div className="kit">
            <BodyArt body={body} lens={lens} className="kit-body" />
          </div>
          <p>
            {!FLAGS.threeD || !threeDAvailable()
              ? "This browser can't show the 3D camera (it needs WebGL). Everything else works without it."
              : `The 3D camera is an M rangefinder with an M lens. The ${body.name} with the ${lens.name} is shown as a drawing.`}
          </p>
          {FLAGS.threeD && threeDAvailable() && (
            <button type="button" className="btn btn-red" onClick={() => setPicker("body")}>
              Choose an M camera
            </button>
          )}
        </div>
      )}
    </section>
  );

  const liveSection = (
    <section className="panel stage-live" aria-label="Light meter">
      <p className="live-intro">
        A handheld meter for the camera in your hands. Point your phone at the scene: meter a spot, place a highlight or a shadow, and read
        off the equivalent settings and the zone-focus distance. The picture shows the result through the {body.name} with the {lens.name}.
      </p>
      {FLAGS.liveView ? (
        <button type="button" className="btn btn-red live-open" onClick={openLive}>
          Open the light meter
        </button>
      ) : (
        <p className="muted">The light meter isn&apos;t available in this build.</p>
      )}
      <p className="muted small">The camera only runs while the meter is open, and nothing leaves your device.</p>
    </section>
  );

  const views: Partial<Record<ToolId, ReactNode>> = {
    // Studio: understand the shot. The picture, what's sharp in it, and why, with the lens right there;
    // camera settings folded away below (the camera itself is where you shoot).
    studio: (
      <>
      <div className="bench">
        <div className="bench-main">
          {previewSection}
          {sceneSection}
        </div>
        <div className="bench-side">
          <ShotReading shot={shot} stops={stops} units={units} onAperture={changeAperture} onFocus={(mm) => setFocusMm(Math.max(mm, lens.minFocusMm))} />
          {barrelSection}
        </div>
      </div>
      {/* Outside the bench, so the sticky reading column can't slide over it. Each fold shows what it's set to while closed. */}
      <div className="bench-more">
        <details className="bench-fold" open={testAll || undefined}>
          <summary>
            <span className="bench-fold-title">Exposure and film</span>
            <span className="bench-fold-value">
              {isFilm ? look.name : `ISO ${iso}`} · {auto ? "A" : "M"} {formatShutter(shutterSec)}
            </span>
          </summary>
          {exposurePanel}
        </details>
        <details className="bench-fold" open={testAll || undefined}>
          <summary>
            <span className="bench-fold-title">Camera and lens</span>
            <span className="bench-fold-value">
              {body.name} · {lens.name}
            </span>
          </summary>
          {setupSection}
        </details>
        <details className="bench-fold" open={testAll || undefined}>
          <summary>
            <span className="bench-fold-title">Sharpness standard</span>
            <span className="bench-fold-value">{standardInfo.label}</span>
          </summary>
          {detailsSection}
        </details>
      </div>
      </>
    ),
    motion: (
      <MotionSimulator
        focalMm={lens.focalMm}
        cocMm={shot.cocMm}
        shutters={speeds}
        shutterSec={shutterSec}
        onShutter={(t) => {
          if (body.autoExposure) setAutoExposure(false);
          changeShutter(t);
        }}
        tripod={tripod}
        units={units}
      />
    ),
    character: FLAGS.experimentalLensCharacter ? (
      <LensDNA
        lens={lens}
        lenses={lenses}
        fNumber={fNumber}
        cocMm={shot.cocMm}
        frameWidthMm={shot.frameWidthMm}
        frameHeightMm={shot.frameHeightMm}
        digital={!isFilm}
        units={units}
        onAperture={changeAperture}
      />
    ) : null,
    flare: FLAGS.experimentalLensCharacter ? (
      <FlareLab lens={lens} fNumber={fNumber} frameWidthMm={shot.frameWidthMm} frameHeightMm={shot.frameHeightMm} onAperture={changeAperture} />
    ) : null,
    perspective: <PerspectiveLab key={lens.id} lens={lens} frameWidthMm={shot.frameWidthMm} frameHeightMm={shot.frameHeightMm} focusMm={focusMm} units={units} />,
    iris: <Iris lens={lens} fNumber={fNumber} stops={stops} onAperture={setFNumber} />,

    finder: isRangefinder(body) ? finderSection : needsRangefinder("Rangefinder focusing"),
    finders: <FinderCompare lens={lens} sceneImageUrl={sampleInfo?.image} />,
    calibration: body.rangefinder ? <RangefinderCalibration lens={lens} fNumber={fNumber} cocMm={shot.cocMm} units={units} /> : needsRangefinder("Calibration"),
    sunny16: <Sunny16Trainer apertures={stops} shutters={speeds} iso={iso} />,
    portrait: <PortraitTrainer lens={lens} frameWidthMm={shot.frameWidthMm} frameHeightMm={shot.frameHeightMm} units={units} />,
    stability: FLAGS.motionSensors ? <StabilityTrainer focalMm={lens.focalMm} cocMm={shot.cocMm} shutters={speeds} /> : null,
    loading: <FilmLoadingTrainer bodyId={body.id} />,
    anatomy: <CameraAnatomy shutterSec={shutterSec} />,

    live: liveSection,
    intent: (
      <IntentAssistant
        sceneEv100={sceneEv}
        iso={iso}
        apertures={stops}
        shutters={speeds}
        focalMm={lens.focalMm}
        hyperfocalMm={shot.dof.hyperfocalMm}
        units={units}
        onApply={(result) => {
          changeAperture(result.fNumber);
          changeShutter(result.shutterSec);
          if (body.autoExposure) setAutoExposure(false);
          if (result.focusMm !== undefined) setFocusMm(result.focusMm);
        }}
      />
    ),
    recipes: (
      <RecipesPanel
        body={body}
        lens={lens}
        lenses={lenses}
        lockedFilm={isFilm && rollFrames.length > 0 ? { id: filmId, name: baseLook.name, iso: boxIso } : null}
        cocMm={shot.cocMm}
        sceneEv100={sceneEv}
        sceneLabel={sceneLabel}
        units={units}
        active={activeRecipe}
        saved={savedRecipes}
        onToggleSaved={toggleSavedRecipe}
        onLoad={loadRecipe}
      />
    ),
    roll: (
      <>
        <ContactSheet
          frames={frames}
          capacity={isFilm ? ROLL_LENGTH : null}
          filmName={isFilm ? look.name : null}
          base={isFilm ? (look.mono ? "bw" : look.kind === "slide" ? "slide" : "color") : "digital"}
          onRewind={rewind}
          onShoot={goCamera}
          onUpdateNote={updateFrameNote}
          onUpdateOutcome={updateFrameOutcome}
          development={isFilm && devRecord ? describeRecord(devRecord) : null}
        />
        <Insights frames={frames} />
      </>
    ),
    darkroom: (
      <Darkroom
        rollFilm={isFilm ? baseLook : null}
        rollFrames={rollFrames.length}
        boxIso={boxIso}
        rollEi={isFilm ? filmEI : null}
        pushPullStops={pushPullStops}
        onPushPull={(stops) => {
          playDialClick();
          setPushPullStops(stops);
        }}
        recorded={devRecord ? describeRecord(devRecord) : null}
        onRecord={(id, choice) =>
          setDevRecord({ filmId: id, filmName: baseLook.name, frames: rollFrames.length, choice, recordedAt: new Date().toISOString().slice(0, 10) })
        }
      />
    ),
    longexp: (
      <LongExposureLab
        body={body}
        lens={lens}
        frameShortMm={shot.frameHeightMm}
        units={units}
        logDisabled={rollFull}
        onLog={(log) => addFrame(log.url, "Long exposure lab (predicted)", { fNumber: log.fNumber, shutterSec: log.shutterSec, iso: log.iso, note: log.note })}
      />
    ),

    camera3d: camera3dSection,
    timeline: (
      <MuseumTimeline
        body={body}
        units={units}
        onSimulate={(item) => {
          if (item.body) selectBody(item.body.id);
          else if (item.lens) {
            const target = bodyForLens(item.lens, body);
            if (!target) return;
            if (target.id !== body.id) selectBody(target.id);
            selectLens(item.lens.id);
          }
          // The camera is the simulator: go and shoot with it.
          navigate({ ...route, screen: "camera" });
        }}
      />
    ),
    generations: (
      <LensGenerations
        body={body}
        lens={lens}
        cocMm={shot.cocMm}
        focusMm={focusMm}
        units={units}
        onTry={(lensId) => {
          selectLens(lensId);
          const l = lenses.find((x) => x.id === lensId);
          if (l && Number.isFinite(focusMm) && focusMm < l.minFocusMm) setFocusMm(l.minFocusMm);
        }}
      />
    ),
    trial: (
      <LensTrial
        body={body}
        lens={lens}
        lenses={lenses}
        frameWidthMm={shot.frameWidthMm}
        frameHeightMm={shot.frameHeightMm}
        focusMm={focusMm}
        sceneId={sceneId}
        fNumber={fNumber}
        units={units}
        onTry={(lensId, distanceMm) => {
          if (lensId !== lens.id) selectLens(lensId);
          const l = lenses.find((x) => x.id === lensId) ?? lens;
          setFocusMm(Math.max(distanceMm, l.minFocusMm));
        }}
      />
    ),
  };

  const mounted = TOOLS.filter((t) => toolAvailable(t) && (t.id === activeTool || (t.id !== "camera3d" && (testAll || visited.has(t.id)))));

  return (
    <div className="app">
      {/* Home: the camera (#37). Kept mounted while you're in MENU pages, hidden (so it stops rendering). */}
      {!testAll && (
        <div className="camera-host" hidden={onTools}>
          <CameraView
            body={body}
            lens={lens}
            units={units}
            isFilm={isFilm}
            filmName={isFilm ? look.name : null}
            stops={stops}
            fNumber={fNumber}
            onAperture={setFNumber}
            focusMm={focusMm}
            onFocus={(mm) => setFocusMm(Number.isFinite(mm) ? Math.max(mm, lens.minFocusMm) : mm)}
            nearMm={shot.dof.nearMm}
            farMm={shot.dof.farMm}
            speeds={speeds}
            shutterSec={shutterSec}
            auto={auto}
            onShutterDial={(next) => {
              if (next.auto) setAutoExposure(true);
              else {
                if (body.autoExposure) setAutoExposure(false);
                setManualShutter(next.sec);
              }
            }}
            iso={iso}
            isoChoices={isoSettings(body)}
            onIso={setIsoDigital}
            evComp={evComp}
            onEvComp={setEvComp}
            meterStops={meterStops}
            frameStatus={frameStatusLabel}
            frames={frames.length}
            aspect={shot.frameWidthMm / shot.frameHeightMm}
            canShoot={!rollFull}
            onShoot={() => fireShutter(true)}
            onWind={() => {
              playAdvance();
              setAdvanceCount((n) => n + 1);
            }}
            image={(quality) =>
              liveOn ? (
                <LiveScreen
                  ref={liveRef}
                  aspect={shot.frameWidthMm / shot.frameHeightMm}
                  focalMm={lens.focalMm}
                  fNumber={fNumber}
                  focusMm={focusMm}
                  minFocusMm={lens.minFocusMm}
                  frameWidthMm={shot.frameWidthMm}
                  lensHFovDeg={shot.horizontalAngle}
                  shutterSec={shutterSec}
                  exposureStops={errorStops}
                  iso={iso}
                  baseIso={body.isoRange?.[0] ?? boxIso}
                  film={isFilm}
                  mono={look.mono}
                  fallbackEv={liveFallbackEv}
                  onSceneEv={(ev) => setLiveEv((prev) => (prev === ev ? prev : ev))}
                  onFocus={(mm) => setFocusMm(Number.isFinite(mm) ? Math.max(mm, lens.minFocusMm) : mm)}
                  onExit={() => {
                    setLiveOn(false);
                    setLiveEv(null);
                  }}
                />
              ) : (
                <BokehPreview
                  ref={cameraPreviewRef}
                  a={previewSide(lens, shot, developFor(lens, fNumber, shot.frameWidthMm, 7, 0.35), photo)}
                  b={null}
                  aspect={shot.frameWidthMm / shot.frameHeightMm}
                  onTap={photo ? tapToFocus : undefined}
                  quality={quality}
                />
              )
            }
            finder={<Viewfinder {...viewfinderProps} />}
            scenes={
              liveOn ? (
                <LightPresets
                  value={liveFallbackEv}
                  onChange={(ev) => {
                    playDialClick();
                    setLiveFallbackEv(ev);
                  }}
                />
              ) : (
                scenePicker()
              )
            }
            liveAvailable={FLAGS.liveView}
            liveOn={liveOn}
            onLive={() => {
              setLiveOn((on) => !on);
              setLiveEv(null);
            }}
            onMenu={() => navigate({ ...route, screen: "menu" })}
            onPlay={() => (isFilm ? goTool("roll") : setPlayOpen(true))}
            onOpenMeter={() => {
              setLiveOn(false);
              setLiveEv(null);
              openLive();
            }}
            onPickBody={() => setPicker("body")}
            onPickLens={() => lenses.length > 1 && setPicker("lens")}
          />
        </div>
      )}

      <div className="pages" hidden={!onTools && !testAll}>
      {/* The top plate: back to the camera, what's mounted and set, MENU. Nothing else competes with the tool. */}
      <header className="topbar">
        <button type="button" className="plate-back" onClick={goCamera} aria-label="Back to the camera">
          <svg viewBox="0 0 12 20" width="8" height="14" aria-hidden="true">
            <path d="M10 2 2 10l8 8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" />
          </svg>
          <span>Camera</span>
        </button>

        <div className="rig" role="group" aria-label="Camera on the simulator">
          <button type="button" className="rig-part" onClick={() => setPicker("body")} aria-label={`Camera: ${body.name}, change`}>
            <span className="rig-name">{body.name}</span>
          </button>
          <button type="button" className="rig-part rig-lens" onClick={() => setPicker("lens")} disabled={lenses.length === 1} aria-label={`Lens: ${lens.name}, change`}>
            <span className="rig-name">{lens.name}</span>
          </button>
          <span className="rig-window" aria-label={`${formatFNumber(fNumber)}, ${formatShutter(shutterSec)}, ${isFilm ? look.name : `ISO ${iso}`}`}>
            <span className="rig-val">{formatFNumber(fNumber)}</span>
            <span className="rig-val">{formatShutter(shutterSec)}</span>
            <span className="rig-val">{isFilm ? `${iso}` : `ISO ${iso}`}</span>
          </span>
        </div>

        <button type="button" className="cam-btn plate-menu" onClick={() => navigate({ ...route, screen: "menu" })}>
          MENU
        </button>
      </header>

      <div className={`shell shell-${route.mode}`}>
        <ToolNav mode={route.mode} tools={modeTools} active={activeTool} onSelect={goTool} />

        <main className="tool-stage" id="main">
          {mounted.map((t) => {
            const solo = t.id !== "studio" && t.id !== "roll";
            return (
              <div key={t.id} className={`tool-view${solo ? " tool-solo" : ""}`} hidden={!testAll && t.id !== activeTool} data-tool={t.id}>
                <header className="tool-head">
                  <h1 className="tool-title">{t.label}</h1>
                  <p className="tool-blurb">{t.blurb}</p>
                </header>
                <ToolBoundary label={t.label}>{views[t.id]}</ToolBoundary>
              </div>
            );
          })}

          <footer className="footer">
            <Wordmark className="footer-mark" />
            Independent tool, not affiliated with or endorsed by Leica Camera AG. Product names are trademarks of their owners.
            {GEAR_IMAGE_CREDITS.length > 0 && ` Product photos: ${GEAR_IMAGE_CREDITS.join("; ")}.`} Lens specs come from public sources; check
            them against Leica&apos;s datasheets. Distances are measured from the lens (thin-lens model).
          </footer>
        </main>
      </div>

      </div>

      {route.screen === "menu" && (
        <CameraMenu
          tools={(m) => toolsFor(m, toolAvailable)}
          initialSection={route.mode}
          onOpenTool={goTool}
          onClose={goCamera}
          settings={[
            { id: "units", label: "Distance units", value: units === "metric" ? "Metres" : "Feet", onActivate: () => setUnits(units === "metric" ? "imperial" : "metric") },
            {
              id: "sound",
              label: "Sounds",
              value: muted ? "Off" : "On",
              onActivate: () => {
                setMuted(!muted);
                setMutedState(!muted);
                if (muted) playApertureClick();
              },
            },
            {
              id: "camera",
              label: "Camera and lens",
              value: `${body.name} · ${lens.name}`,
              // Back to the camera, with the camera chooser open: you'll want to hold the new one.
              onActivate: () => {
                goCamera();
                setPicker("body");
              },
            },
            { id: "tour", label: "60-second tour", value: "Start", onActivate: startDemo },
          ]}
        />
      )}
      {playOpen && <Playback frames={frames} onClose={() => setPlayOpen(false)} onSheet={() => (setPlayOpen(false), goTool("roll"))} />}

      <IrisTransition />

      <GearPicker
        open={picker === "body"}
        title="Choose a camera"
        selectedId={bodyId}
        onSelect={selectBody}
        onClose={() => setPicker(null)}
        saved={savedIds.body}
        onToggleSaved={(id) => toggleBag("body", id)}
        items={BODIES.map<PickerItem>((b) => ({
          id: b.id,
          name: b.name,
          group: b.family,
          meta: bodyMeta(b),
          badge: b.medium === "film" ? "Film" : b.medium === "mono" ? "Monochrom" : undefined,
          art: (
            <GearImage kind="bodies" id={b.id} alt="">
              <BodyArt body={b} />
            </GearImage>
          ),
        }))}
      />
      <GearPicker
        open={picker === "lens"}
        title={`Lenses for the ${body.name}`}
        selectedId={lensId}
        onSelect={selectLens}
        onClose={() => setPicker(null)}
        saved={savedIds.lens}
        onToggleSaved={(id) => toggleBag("lens", id)}
        items={lenses.map<PickerItem>((l) => ({
          id: l.id,
          name: l.name,
          group: lensGroup(body, l),
          meta: `${l.year} · f/${l.maxAperture} · closest ${formatDistance(l.minFocusMm, units)}`,
          badge: l.classic ? "Classic" : l.nickname,
          art: (
            <GearImage kind="lenses" id={l.id} alt="">
              <LensArt lens={l} />
            </GearImage>
          ),
        }))}
      />

      {fullScreenFinder && (
        <div className="finder-fullscreen" role="dialog" aria-modal="true" aria-label={`${body.name} viewfinder, full screen`}>
          <button type="button" className="live-view-close" onClick={() => setFullScreenFinder(false)} aria-label="Close full screen">
            ×
          </button>
          <Viewfinder {...viewfinderProps} />
        </div>
      )}

      {liveViewOpen && (
        <LiveView
          body={body}
          lens={lens}
          fNumber={fNumber}
          focusMm={focusMm}
          stops={stops}
          shutters={speeds}
          iso={iso}
          filmOrSensorLabel={isFilm ? look.name : `ISO ${iso}`}
          frameStatusLabel={frameStatusLabel}
          captureDisabled={rollFull}
          units={units}
          onFNumberChange={changeAperture}
          onFocusChange={setFocusMm}
          onCapture={captureLiveFrame}
          onClose={() => setLiveViewOpen(false)}
          syntheticSceneUrl={demoActive ? demoLiveSceneUrl : undefined}
          recipe={findRecipe(activeRecipe?.id)}
          mono={look.mono}
          baseIso={body.isoRange?.[0] ?? boxIso}
        />
      )}

      {kiosk.enabled && <KioskShell config={kiosk} onSelectBody={selectBody} onSelectLens={selectLens} />}

      {demoActive && (
        <div hidden={liveViewOpen}>
          <DemoTour
            state={{
              bodyId: body.id,
              lensId: lens.id,
              lensFocalMm: lens.focalMm,
              show3D: show3D && can3D,
              fNumber,
              subjectSharp: shot.subjectSharp,
              liveOpened: demoLiveOpened,
            }}
            actions={demoActions}
            setupSummary={`${body.name} · ${lens.name} · ${formatFNumber(fNumber)} · focused at ${formatDistance(focusMm, units)} · zone focus: set ${formatDistance(demoHyperfocalMm, units)} for ${formatDistance(demoHyperfocalMm / 2, units)} to ∞`}
            saved={savedIds.body.has(body.id) && savedIds.lens.has(lens.id)}
            onSaveToBag={() => {
              if (!savedIds.body.has(body.id)) toggleBag("body", body.id);
              if (!savedIds.lens.has(lens.id)) toggleBag("lens", lens.id);
            }}
            onExit={() => {
              setDemoActive(false);
              setDemoSubjectMm(null);
            }}
          />
        </div>
      )}
    </div>
  );
}
