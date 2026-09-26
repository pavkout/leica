import { useCallback, useEffect, useRef, useState } from "react";
import { formatShutter } from "../data/gear";
import {
  NOMINAL_HAND_DEG_PER_SEC,
  STABILITY_PROVENANCE,
  classifyStability,
  filterSpeeds,
  suggestHandheld,
  summarizeStability,
  type MotionSample,
  type StabilityLabel,
  type StabilitySummary,
} from "../physics/stability";
import { requestMotionAccess, subscribeMotion } from "../services/motionSensor";
import Segmented from "./Segmented";

interface Props {
  focalMm: number;
  cocMm: number;
  shutters: number[];
}

type Status = "idle" | "requesting" | "sampling" | "done" | "no-data" | "denied" | "unsupported" | "error";

/** No gyroscope event within this long after access is granted ⇒ this device has no usable sensor. */
const NO_DATA_TIMEOUT_MS = 1500;
/** Window for the live label while the test runs. */
const LIVE_WINDOW_MS = 1000;

const LABEL_TEXT: Record<StabilityLabel, string> = {
  stable: "Stable",
  marginal: "Marginal",
  unstable: "Unstable",
};

// Trace geometry (SVG units).
const W = 300;
const H = 80;

interface TracePoint {
  t: number;
  speed: number;
}

export default function StabilityTrainer({ focalMm, cocMm, shutters }: Props) {
  const [durationSec, setDurationSec] = useState<5 | 10>(5);
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [trace, setTrace] = useState<TracePoint[]>([]);
  const [liveLabel, setLiveLabel] = useState<StabilityLabel | null>(null);
  const [summary, setSummary] = useState<StabilitySummary | null>(null);

  // Raw samples live only in this ref for the length of one test, and are
  // dropped as soon as it ends — nothing is persisted.
  const samplesRef = useRef<MotionSample[]>([]);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const timerRef = useRef<number | null>(null);
  const frameRef = useRef<number | null>(null);
  const runDurationRef = useRef(durationSec);

  const release = useCallback(() => {
    unsubscribeRef.current?.();
    unsubscribeRef.current = null;
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    samplesRef.current = [];
  }, []);

  const cancel = useCallback(() => {
    release();
    setLiveLabel(null);
    setStatus((s) => (s === "sampling" || s === "requesting" ? "idle" : s));
  }, [release]);

  const finish = useCallback(() => {
    const samples = samplesRef.current;
    const result = summarizeStability(samples);
    if (samples.length > 0) {
      const t0 = samples[0].t;
      setTrace(filterSpeeds(samples).map((p) => ({ t: (p.t - t0) / 1000, speed: p.speed })));
    }
    release();
    setLiveLabel(null);
    if (result) {
      setSummary(result);
      setStatus("done");
    } else {
      setStatus("no-data");
      setMessage("Not enough motion data came through to judge. Try again on a phone.");
    }
  }, [release]);

  const redraw = useCallback(() => {
    frameRef.current = null;
    const samples = samplesRef.current;
    if (samples.length === 0) return;
    const filtered = filterSpeeds(samples);
    const t0 = samples[0].t;
    setTrace(filtered.map((p) => ({ t: (p.t - t0) / 1000, speed: p.speed })));
    const recent = filtered.filter((p) => p.dt > 0 && p.t >= samples[samples.length - 1].t - LIVE_WINDOW_MS);
    const span = recent.reduce((a, p) => a + p.dt, 0);
    if (span > 0) setLiveLabel(classifyStability(Math.sqrt(recent.reduce((a, p) => a + p.speed * p.speed * p.dt, 0) / span)));
  }, []);

  async function start() {
    release();
    setSummary(null);
    setTrace([]);
    setMessage(null);
    setStatus("requesting");
    // First await — the permission request itself — so iOS still sees this as
    // part of the tap.
    const access = await requestMotionAccess();
    if (access.status !== "granted") {
      setStatus(access.status);
      setMessage(access.message);
      return;
    }
    runDurationRef.current = durationSec;
    setStatus("sampling");
    unsubscribeRef.current = subscribeMotion((s) => {
      const samples = samplesRef.current;
      samples.push(s);
      if (samples.length === 1 && timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (s.t - samples[0].t >= runDurationRef.current * 1000) {
        finish();
        return;
      }
      if (frameRef.current === null) frameRef.current = requestAnimationFrame(redraw);
    });
    timerRef.current = window.setTimeout(() => {
      if (samplesRef.current.length > 0) return;
      release();
      setStatus("no-data");
      setMessage("This device isn't reporting gyroscope data. The trainer needs a phone or tablet with a gyroscope.");
    }, NO_DATA_TIMEOUT_MS);
  }

  // Leaving the mode stops sampling: unmount, or the page going to the
  // background mid-test.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden") cancel();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      release();
    };
  }, [cancel, release]);

  const running = status === "requesting" || status === "sampling";
  const suggestion = summary ? suggestHandheld(summary, focalMm, cocMm, shutters) : null;
  const shownLabel = running ? liveLabel : (summary?.label ?? null);

  const runSec = running ? runDurationRef.current : (trace.length ? trace[trace.length - 1].t : durationSec);
  const yMax = Math.max(4 * NOMINAL_HAND_DEG_PER_SEC, ...trace.map((p) => p.speed));
  const x = (t: number) => (Math.min(t, runSec) / Math.max(runSec, 0.001)) * W;
  const y = (v: number) => H - (Math.min(v, yMax) / yMax) * H;
  const points = trace.map((p) => `${x(p.t).toFixed(1)},${y(p.speed).toFixed(1)}`).join(" ");

  return (
    <section className="panel stage-stability" aria-label="Hand-stability trainer">
      <div className="panel-head">
        <h2>Hand stability</h2>
        {running ? (
          <button type="button" className="btn btn-small" onClick={cancel}>
            Stop
          </button>
        ) : (
          <button type="button" className="btn btn-small btn-red" onClick={start}>
            {summary ? "Test again" : "Start test"}
          </button>
        )}
      </div>

      <p className="muted small">
        Hold your phone the way you'd hold the camera and keep it as still as you can for {durationSec} seconds. The{" "}
        {focalMm} mm lens you have selected sets how much each wobble blurs.
      </p>

      <div className="field">
        <span>Test length</span>
        <Segmented
          label="Test length"
          options={[
            { value: 5, label: "5 s" },
            { value: 10, label: "10 s" },
          ]}
          value={durationSec}
          onChange={(v) => !running && setDurationSec(v)}
        />
      </div>

      <div className="stability-trace-wrap">
        <svg className="stability-trace" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="Angular movement over time">
          <line className="stability-limit" x1={0} x2={W} y1={y(NOMINAL_HAND_DEG_PER_SEC)} y2={y(NOMINAL_HAND_DEG_PER_SEC)} />
          <line className="stability-limit" x1={0} x2={W} y1={y(2 * NOMINAL_HAND_DEG_PER_SEC)} y2={y(2 * NOMINAL_HAND_DEG_PER_SEC)} />
          {points && <polyline className="stability-line" points={points} />}
        </svg>
        {shownLabel && (
          <span className={`chip stability-chip stability-${shownLabel}`} aria-live="polite">
            {LABEL_TEXT[shownLabel]}
          </span>
        )}
      </div>

      {status === "requesting" && <p className="muted small">Asking for motion access…</p>}
      {status === "sampling" && trace.length === 0 && <p className="muted small">Waiting for the gyroscope…</p>}
      {message && <p className="warn-text small">{message}</p>}

      {status === "done" && summary && suggestion && (
        <div className="stability-result">
          <p className="gear-name">
            Handheld at {formatShutter(suggestion.safeSec)} or faster
          </p>
          <p className="muted small">
            With the {focalMm} mm lens, your hand averaged {summary.rmsDegPerSec.toFixed(1)}°/s
            {suggestion.typicalSec > suggestion.safeSec
              ? ` — ${formatShutter(suggestion.typicalSec)} can work with care, but expect some soft frames.`
              : "."}
          </p>
        </div>
      )}

      <p className="hint">{STABILITY_PROVENANCE.notes} Motion readings stay on this device and are discarded after each test.</p>
    </section>
  );
}
