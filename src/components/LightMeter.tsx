import { useEffect, useRef, useState, type RefObject } from "react";
import { formatShutter } from "../data/gear";
import { correctShutter } from "../physics/exposure";
import { equivalents, exposureEv, meteredEv100, regionLuminance, settingsEv100, stabilize, stopsBetween, WHOLE_FRAME, type Lock, type MeterMode, type Region, type Stabilizer } from "../physics/meter";
import { getString, setString } from "../services/persistence";
import { formatFNumber } from "../utils/format";
import Segmented from "./Segmented";

interface Props {
  /** The live camera video, or a still image standing in for it. */
  sourceRef: RefObject<HTMLVideoElement | HTMLImageElement | null>;
  /** The camera track, for exposure metadata where the browser exposes it. */
  track: MediaStreamTrack | null;
  active: boolean;
  /** Tapped spot (normalised), or null for the whole frame. */
  region: Region | null;
  /** The light the user set: the base when the browser hides exposure data. */
  baseEv100: number;
  iso: number;
  apertures: number[];
  speeds: number[];
  fNumber: number;
  /** Feed the reading to Live View's exposure. */
  onUseReading: (ev100: number) => void;
}

const OFFSET_KEY = "rangefinder-meter-offset";
const BIAS_KEY = "rangefinder-meter-bias";
/** Phones rarely report their lens's f-number to the browser; most main cameras are around f/1.5–f/2. Calibration absorbs the difference. */
const PHONE_F_NUMBER = 1.8;

function readNumber(key: string) {
  const v = Number(getString(key));
  return Number.isFinite(v) ? v : 0;
}

/** Exposure time and ISO from the camera track, if the browser exposes them (Image Capture: exposureTime is in 100 µs units). */
function trackExposure(track: MediaStreamTrack | null): { exposureSec: number; iso: number } | null {
  const s = (track?.getSettings?.() ?? {}) as { exposureTime?: number; iso?: number };
  if (typeof s.exposureTime === "number" && s.exposureTime > 0 && typeof s.iso === "number" && s.iso > 0) return { exposureSec: s.exposureTime / 10000, iso: s.iso };
  return null;
}

const fmtEv = (ev: number) => (Math.round(ev * 3) / 3).toFixed(1);

/** Real-world light meter (feature #13). */
export default function LightMeter({ sourceRef, track, active, region, baseEv100, iso, apertures, speeds, fNumber, onUseReading }: Props) {
  const [mode, setMode] = useState<MeterMode>("average");
  const [lockKind, setLockKind] = useState<"none" | "aperture" | "shutter">("none");
  const [lockedShutter, setLockedShutter] = useState<number | null>(null);
  const [offset, setOffset] = useState(() => readNumber(OFFSET_KEY));
  const [bias, setBias] = useState(() => readNumber(BIAS_KEY));
  const [reading, setReading] = useState<{ frameEv: number; spotEv: number; spotStops: number; measured: boolean } | null>(null);
  const stab = useRef<Stabilizer>({ smoothed: null, shown: null });
  const stabSpot = useRef<Stabilizer>({ smoothed: null, shown: null });
  const canvas = useRef<HTMLCanvasElement | null>(null);

  // Sample a small copy of the frame four times a second.
  useEffect(() => {
    if (!active) return;
    canvas.current ??= document.createElement("canvas");
    const c = canvas.current;
    c.width = 64;
    c.height = 48;
    const g = c.getContext("2d", { willReadFrequently: true });
    const id = window.setInterval(() => {
      const src = sourceRef.current;
      const ready = src instanceof HTMLVideoElement ? src.readyState >= 2 && src.videoWidth > 0 : src instanceof HTMLImageElement ? src.complete && src.naturalWidth > 0 : false;
      if (!g || !src || !ready) return;
      g.drawImage(src, 0, 0, c.width, c.height);
      const { data } = g.getImageData(0, 0, c.width, c.height);
      const mean = regionLuminance(data, c.width, c.height, WHOLE_FRAME);
      const spot = region ? regionLuminance(data, c.width, c.height, region) : mean;
      const exp = trackExposure(track);
      // Measured when the camera's settings are known; otherwise the user's light is the frame's average.
      const frameEv = (exp ? meteredEv100(settingsEv100(PHONE_F_NUMBER, exp.exposureSec, exp.iso), mean) : baseEv100) + offset;
      const spotStops = stopsBetween(spot, mean);
      stab.current = stabilize(stab.current, frameEv);
      stabSpot.current = stabilize(stabSpot.current, frameEv + spotStops);
      // Show the spot's offset from the two stabilised values, so the label holds steady like the EV does.
      setReading({ frameEv: stab.current.shown!, spotEv: stabSpot.current.shown!, spotStops: stabSpot.current.shown! - stab.current.shown!, measured: !!exp });
    }, 250);
    return () => window.clearInterval(id);
  }, [active, sourceRef, track, region, baseEv100, offset]);

  // A new spot or base starts a fresh average rather than drifting from the old one.
  useEffect(() => {
    stab.current = { smoothed: null, shown: null };
    stabSpot.current = { smoothed: null, shown: null };
  }, [region, baseEv100, offset]);

  const saveOffset = (v: number) => {
    const r = Math.round(v * 3) / 3;
    setOffset(r);
    setString(OFFSET_KEY, String(r));
  };
  const saveBias = (v: number) => {
    setBias(v);
    setString(BIAS_KEY, String(v));
  };

  if (!reading) return <p className="muted small">Metering…</p>;

  const target = exposureEv(region || mode !== "average" ? reading.spotEv : reading.frameEv, mode, undefined, bias);
  const lock: Lock = lockKind === "aperture" ? { kind: "aperture", fNumber } : lockKind === "shutter" && lockedShutter ? { kind: "shutter", shutterSec: lockedShutter } : null;
  const rows = equivalents(target, iso, apertures, speeds, lock);
  const rec = rows.reduce((best, r) => (Math.abs(Math.log(r.fNumber / fNumber)) < Math.abs(Math.log(best.fNumber / fNumber)) ? r : best));
  const recShutter = speeds.reduce((best, t) => (Math.abs(Math.log(t / correctShutter(target, fNumber, iso))) < Math.abs(Math.log(best / correctShutter(target, fNumber, iso))) ? t : best));

  return (
    <div className="light-meter" aria-label="Light meter">
      <p className="small">
        <span className={`dna-badge ${reading.measured ? "dna-calculated" : "dna-approximate"}`}>{reading.measured ? "Measured" : "Estimated"}</span>{" "}
        {reading.measured
          ? "From the camera's exposure data and the frame's brightness (phone lens assumed f/1.8 — calibrate for precision)."
          : "This browser hides the camera's exposure, so the scene light you set is the base; spot readings are measured relative to it."}
      </p>
      <p className="gear-name light-meter-ev" aria-live="polite">
        Scene EV {fmtEv(reading.frameEv)}
        {region && ` · spot ${reading.spotStops >= 0 ? "+" : ""}${reading.spotStops.toFixed(1)} stops`}
      </p>
      <p className="small">
        Expose for EV {fmtEv(target)}: <strong>{formatFNumber(fNumber)} · {formatShutter(recShutter)} s</strong> at ISO {iso}
        {bias !== 0 && ` (film preference ${bias > 0 ? "+" : ""}${bias} stop)`}
        {Math.abs(rec.errorStops) > 0.4 && lock?.kind !== "shutter" && ` — ${Math.abs(rec.errorStops).toFixed(1)} stops ${rec.errorStops > 0 ? "over" : "under"}: out of the shutter's range`}
      </p>
      <button type="button" className="btn btn-small" onClick={() => onUseReading(target)}>
        Use this reading
      </button>

      <div className="light-meter-row">
        <Segmented
          label="Metering priority"
          value={mode}
          onChange={setMode}
          options={[
            { value: "average", label: "Average" },
            { value: "highlight", label: "Highlights" },
            { value: "shadow", label: "Shadows" },
          ]}
        />
      </div>
      <p className="muted small">{region ? "Metering the spot you tapped. Tap again to move it." : "Tap the picture to meter a spot."} Highlights places the spot 2.5 stops above middle grey; Shadows, 2 below.</p>

      <div className="light-meter-row">
        <Segmented
          label="Lock"
          value={lockKind}
          onChange={(v) => {
            setLockKind(v);
            if (v === "shutter") setLockedShutter(recShutter);
          }}
          options={[
            { value: "none", label: "Free" },
            { value: "aperture", label: "Lock f/" },
            { value: "shutter", label: "Lock speed" },
          ]}
        />
      </div>
      <table className="light-meter-table">
        <caption className="muted small">Equivalent exposures at ISO {iso}</caption>
        <tbody>
          {rows.map((r) => (
            <tr key={r.fNumber} className={r.locked ? "meter-locked" : undefined}>
              <td>{formatFNumber(r.fNumber)}</td>
              <td>{formatShutter(r.shutterSec)} s</td>
              <td className="muted">{Math.abs(r.errorStops) < 0.17 ? "" : `${r.errorStops > 0 ? "+" : ""}${r.errorStops.toFixed(1)}`}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="light-meter-row light-meter-prefs">
        <label className="field">
          <span>Film preference</span>
          <select value={bias} onChange={(e) => saveBias(Number(e.target.value))}>
            <option value={0}>None</option>
            <option value={1}>+1 stop (colour negative likes light)</option>
            <option value={0.5}>+½ stop</option>
            <option value={-0.33}>−⅓ stop (slide film protects highlights)</option>
          </select>
        </label>
        <div className="field">
          <span>Calibration {offset === 0 ? "" : `(${offset > 0 ? "+" : ""}${offset.toFixed(1)} EV)`}</span>
          <div className="light-meter-cal">
            <button type="button" className="btn btn-small" aria-label="Calibration down a third of a stop" onClick={() => saveOffset(offset - 1 / 3)}>
              −⅓
            </button>
            <button type="button" className="btn btn-small" aria-label="Calibration up a third of a stop" onClick={() => saveOffset(offset + 1 / 3)}>
              +⅓
            </button>
            <button type="button" className="btn btn-small" onClick={() => saveOffset(0)} disabled={offset === 0}>
              Reset
            </button>
          </div>
        </div>
      </div>
      <p className="muted small">Calibrate against a meter you trust: meter the same scene with both and nudge until they agree. Stored on this device only.</p>
    </div>
  );
}
