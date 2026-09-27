import { lazy, Suspense, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { apertureStops, formatShutter, type Body, type Lens } from "../data/gear";
import {
  DEFAULT_PATTERN_PARAMS,
  LIGHT_COLOURS,
  PATTERNS,
  cyclesRecorded,
  dimmedCss,
  guessScreenShortMm,
  patternPoint,
  suggestSettings,
  suggestedDistanceMm,
  type LightParams,
  type PatternId,
} from "../physics/longExposure";
import { formatDistance, type Units } from "../utils/format";
import Segmented from "./Segmented";

const LongExposureStage = lazy(() => import("./LongExposureStage"));

interface Props {
  body: Body;
  lens: Lens;
  frameShortMm: number;
  units: Units;
}

const CYCLES = [1, 2, 4, 8, 15, 30];
const ISOS = [50, 100, 200, 400, 800, 1600, 3200];
const COUNTDOWNS = [3, 5, 10];

function fullscreenAvailable() {
  const d = document as Document & { webkitFullscreenEnabled?: boolean };
  return !!(d.fullscreenEnabled || d.webkitFullscreenEnabled);
}

const shutterText = (t: number, bulb: boolean) => (bulb ? `B, held for ${t} s` : formatShutter(t));

/** Long Exposure Lab (feature #36): the screen moves a light, the user's own camera draws the trail. */
export default function LongExposureLab({ body, lens, frameShortMm, units }: Props) {
  const [pattern, setPattern] = useState<PatternId>("infinity");
  const [params, setParams] = useState(DEFAULT_PATTERN_PARAMS);
  const [cycleSec, setCycleSec] = useState(4);
  const [loop, setLoop] = useState(true);
  const [sizePx, setSizePx] = useState(12);
  const [brightnessPct, setBrightnessPct] = useState(100);
  const [colourId, setColourId] = useState("white");
  const [countdown, setCountdown] = useState(5);
  const [iso, setIso] = useState(100);
  const [screenCm, setScreenCm] = useState(() => guessScreenShortMm(Math.min(window.screen?.width || innerWidth, window.screen?.height || innerHeight)) / 10);
  const [running, setRunning] = useState(false);

  const light: LightParams = useMemo(
    () => ({ pattern, params, cycleSec, sizePx, brightness: brightnessPct / 100 }),
    [pattern, params, cycleSec, sizePx, brightnessPct],
  );
  const colour = dimmedCss(LIGHT_COLOURS.find((c) => c.id === colourId)!.rgb, light.brightness);
  const s = suggestSettings(light, iso, apertureStops(lens), body.shutter.slowest);
  const distanceMm = suggestedDistanceMm(lens.focalMm, frameShortMm, screenCm * 10, lens.minFocusMm);
  const canFullscreen = fullscreenAvailable();
  const canWakeLock = "wakeLock" in navigator;
  const expectations = [1, cycleSec, cycleSec * 2].filter((t, i, a) => a.indexOf(t) === i);

  const preview = useMemo(() => {
    const pts = Array.from({ length: 241 }, (_, i) => patternPoint(pattern, i / 240, params));
    return pts.map((p) => `${(50 + p.x * 40).toFixed(2)},${(50 - p.y * 40).toFixed(2)}`).join(" ");
  }, [pattern, params]);

  return (
    <section className="panel stage-longexp" aria-label="Long exposure lab">
      <div className="panel-head">
        <h2>Long exposure lab</h2>
      </div>
      <p className="muted small">
        Put your camera on a tripod facing this screen. The screen only ever shows the light where it is now; your exposure draws the trail.
      </p>

      <div className="lel-setup">
        <svg className="lel-preview" viewBox="0 0 100 100" role="img" aria-label={`${PATTERNS.find((p) => p.id === pattern)!.label} path`}>
          <polyline points={preview} fill="none" stroke={colour} strokeWidth={1.2} strokeLinejoin="round" />
        </svg>
        <div className="lel-controls">
          <label className="field">
            <span>Pattern</span>
            <select value={pattern} onChange={(e) => setPattern(e.target.value as PatternId)}>
              {PATTERNS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          {pattern === "spiral" && (
            <label className="field">
              <span>Turns · {params.turns}</span>
              <input type="range" min={1} max={8} step={1} value={params.turns} onChange={(e) => setParams({ ...params, turns: Number(e.target.value) })} />
            </label>
          )}
          {pattern === "lissajous" && (
            <>
              <label className="field">
                <span>Across · {params.a}</span>
                <input type="range" min={1} max={6} step={1} value={params.a} onChange={(e) => setParams({ ...params, a: Number(e.target.value) })} />
              </label>
              <label className="field">
                <span>Up and down · {params.b}</span>
                <input type="range" min={1} max={6} step={1} value={params.b} onChange={(e) => setParams({ ...params, b: Number(e.target.value) })} />
              </label>
            </>
          )}
          <label className="field">
            <span>One cycle takes</span>
            <select value={cycleSec} onChange={(e) => setCycleSec(Number(e.target.value))}>
              {CYCLES.map((c) => (
                <option key={c} value={c}>
                  {c} s
                </option>
              ))}
            </select>
          </label>
          <Segmented
            label="Repeat"
            value={loop ? "loop" : "once"}
            onChange={(v) => setLoop(v === "loop")}
            options={[
              { value: "loop", label: "Loop" },
              { value: "once", label: "Once" },
            ]}
          />
        </div>
      </div>

      <div className="lel-grid">
        <label className="field">
          <span>Point size · {sizePx} px</span>
          <input type="range" min={4} max={40} step={1} value={sizePx} onChange={(e) => setSizePx(Number(e.target.value))} />
        </label>
        <label className="field">
          <span>Brightness · {brightnessPct}%</span>
          <input type="range" min={10} max={100} step={5} value={brightnessPct} onChange={(e) => setBrightnessPct(Number(e.target.value))} />
        </label>
        <label className="field">
          <span>Colour</span>
          <select value={colourId} onChange={(e) => setColourId(e.target.value)}>
            {LIGHT_COLOURS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Countdown</span>
          <select value={countdown} onChange={(e) => setCountdown(Number(e.target.value))}>
            {COUNTDOWNS.map((c) => (
              <option key={c} value={c}>
                {c} s
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="lel-card" aria-label="Suggested starting settings">
        <h3>Starting point for the {lens.name}</h3>
        <label className="field lel-iso">
          <span>ISO</span>
          <select value={iso} onChange={(e) => setIso(Number(e.target.value))}>
            {ISOS.map((i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </select>
        </label>
        <ul className="lel-settings">
          <li>
            <strong>
              ISO {s.iso} · f/{s.fNumber} · {shutterText(s.shutterSec, s.useBulb)}
            </strong>
          </li>
          <li>Tripod; manual focus at {formatDistance(distanceMm, units)}, the camera's distance from the screen.</li>
          <li>
            Screen short side{" "}
            <input
              className="lel-screen"
              type="number"
              min={3}
              max={200}
              step={0.5}
              value={screenCm}
              aria-label="Screen short side in centimetres"
              onChange={(e) => {
                const v = Number(e.target.value);
                if (v > 0) setScreenCm(v);
              }}
            />{" "}
            cm (estimated; measure yours) → the pattern fills about two-thirds of the frame's height.
          </li>
          {Math.abs(s.residualStops) >= 0.5 && (
            <li>
              The lens stops at f/{s.fNumber}, so the trail may come out about {Math.abs(s.residualStops).toFixed(1)} stops{" "}
              {s.residualStops > 0 ? "brighter; lower the ISO or the brightness" : "darker; raise the ISO or the brightness"}.
            </li>
          )}
          {s.useBulb && <li>The {body.name}'s slowest marked speed is {formatShutter(body.shutter.slowest)}: use B and time it.</li>}
        </ul>
        <p className="muted small">
          <span className="dna-badge dna-approximate">Approximate</span> Screen brightness is unknown to the app. Take a test frame, then adjust.
        </p>
        <h3>What to expect</h3>
        <ul className="lel-expect">
          {expectations.map((t) => {
            const r = cyclesRecorded(t, cycleSec, loop);
            return (
              <li key={t}>
                <strong>{t} s</strong> ·{" "}
                {r.expect === "partial"
                  ? `part of the pattern (${Math.round(r.cycles * 100)}%)`
                  : r.expect === "one"
                    ? loop || t <= cycleSec
                      ? "about one complete pattern"
                      : "one pattern, then black (Once)"
                    : `${r.cycles.toFixed(r.cycles % 1 ? 1 : 0)} passes over the same path`}
              </li>
            );
          })}
        </ul>
        <p className="muted small">
          On a black screen the shutter time sets how much of the path is drawn, not how bright it is. Trail brightness comes from the light's
          brightness, its size and speed (how long it sits on each spot), the aperture and the ISO. Repeat passes overlap the same line.
        </p>
      </div>

      {(!canFullscreen || !canWakeLock) && (
        <ul className="lel-warn small" role="note">
          {!canFullscreen && <li>This browser can't make the stage fullscreen, so its bars may stay visible. Frame them out.</li>}
          {!canWakeLock && <li>This browser can't keep the screen awake. Make sure auto-lock or sleep is longer than your exposure.</li>}
        </ul>
      )}

      <button type="button" className="btn btn-red lel-start" onClick={() => setRunning(true)}>
        Start in {countdown} s
      </button>
      <p className="muted small">Tap the screen or press any key to stop.</p>

      <details className="lel-details">
        <summary>How the screen affects the photo</summary>
        <ul className="small">
          <li>
            <strong>OLED vs LCD:</strong> OLED black is off; an LCD's backlight leaks, and a long exposure records it as a glow.
          </li>
          <li>
            <strong>Brightness modulation (PWM):</strong> many screens flicker to dim, which can record as a dotted or segmented trail. Try full
            brightness.
          </li>
          <li>
            <strong>Refresh rate:</strong> the light jumps from one frame's position to the next; a fast, large pattern can show as separate
            dots.
          </li>
          <li>
            <strong>Motion smoothing, night modes, auto-brightness:</strong> turn them off so the light stays constant.
          </li>
          <li>
            <strong>Sleep and browser bars:</strong> see the notes above if this browser can't go fullscreen or stay awake.
          </li>
        </ul>
      </details>

      {running &&
        createPortal(
          <Suspense fallback={<div className="lel-stage" />}>
            <LongExposureStage light={light} loop={loop} colour={colour} countdownSec={countdown} onClose={() => setRunning(false)} />
          </Suspense>,
          document.body,
        )}
    </section>
  );
}
