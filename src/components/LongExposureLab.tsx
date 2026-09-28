import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { apertureStops, formatShutter, type Body, type Lens } from "../data/gear";
import { CHALLENGES, type Challenge } from "../data/longExposureChallenges";
import {
  DEFAULT_PATTERN_PARAMS,
  LIGHT_COLOURS,
  MAX_LIGHTS,
  PATTERNS,
  PATTERN_FILL,
  cyclesRecorded,
  dimmedCss,
  exposureTrace,
  guessScreenShortMm,
  patternPoint,
  suggestSettings,
  suggestedDistanceMm,
  type LabLight,
  type LightParams,
  type PatternId,
  type Pt,
} from "../physics/longExposure";
import { textStrokes, unsupportedChars } from "../physics/strokeFont";
import { getString, setString } from "../services/persistence";
import { formatDistance, type Units } from "../utils/format";
import PatternPad from "./PatternPad";
import Segmented from "./Segmented";

const LongExposureStage = lazy(() => import("./LongExposureStage"));

/** What a logged frame records: the settings suggested for the real camera, not the simulator's. */
export interface LongExposureLog {
  url: string;
  iso: number;
  fNumber: number;
  shutterSec: number;
  note: string;
}

interface Props {
  body: Body;
  lens: Lens;
  frameShortMm: number;
  units: Units;
  /** Put the predicted photo on the roll with the lab's settings. */
  onLog?: (log: LongExposureLog) => void;
  /** The roll is full: logging is off. */
  logDisabled?: boolean;
}

const CYCLES = [1, 2, 4, 8, 10, 15, 30];
const ISOS = [50, 100, 200, 400, 800, 1600, 3200];
const COUNTDOWNS = [3, 5, 10];
const DONE_KEY = "rangefinder-longexp-done";

function fullscreenAvailable() {
  const d = document as Document & { webkitFullscreenEnabled?: boolean };
  return !!(d.fullscreenEnabled || d.webkitFullscreenEnabled);
}

const shutterText = (t: number, bulb: boolean) => (bulb ? `B, held for ${t} s` : formatShutter(t));
const colourOf = (l: LabLight) => dimmedCss(LIGHT_COLOURS.find((c) => c.id === l.colourId)!.rgb, l.brightness);
const newLight = (patch: Partial<LabLight> = {}): LabLight => ({
  pattern: "infinity",
  params: DEFAULT_PATTERN_PARAMS,
  sizePx: 12,
  brightness: 1,
  colourId: "white",
  offset: 0,
  ...patch,
});

function readDone(): Set<string> {
  try {
    return new Set(JSON.parse(getString(DONE_KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

/** Long Exposure Lab (feature #36): the screen moves the lights, the user's own camera draws the trails. */
export default function LongExposureLab({ body, lens, frameShortMm, units, onLog, logDisabled }: Props) {
  const [lights, setLights] = useState<LabLight[]>([newLight()]);
  const [editing, setEditing] = useState(0);
  const [drawn, setDrawn] = useState<Pt[][]>([]);
  const [text, setText] = useState("f/8");
  const [cycleSec, setCycleSec] = useState(4);
  const [loop, setLoop] = useState(true);
  const [countdown, setCountdown] = useState(5);
  const [iso, setIso] = useState(100);
  const [screenCm, setScreenCm] = useState(() => guessScreenShortMm(Math.min(window.screen?.width || innerWidth, window.screen?.height || innerHeight)) / 10);
  const [running, setRunning] = useState(false);
  const [previewSec, setPreviewSec] = useState<number | null>(null);
  const [done, setDone] = useState<Set<string>>(readDone);
  const [logged, setLogged] = useState(false);

  // Drawn and text patterns share one path each, so every light using them follows it.
  const textPath = useMemo(() => textStrokes(text), [text]);
  const resolved: LabLight[] = useMemo(
    () =>
      lights.map((l) =>
        l.pattern === "drawn" ? { ...l, params: { ...l.params, strokes: drawn } } : l.pattern === "text" ? { ...l, params: { ...l.params, strokes: textPath } } : l,
      ),
    [lights, drawn, textPath],
  );
  // Stable while running: the stage restarts its clock if this changes identity.
  const stageLights = useMemo(
    () => resolved.map((l) => ({ pattern: l.pattern, params: l.params, sizePx: l.sizePx, colour: colourOf(l), offset: l.offset })),
    [resolved],
  );
  const cur = resolved[Math.min(editing, resolved.length - 1)];
  const setCur = (patch: Partial<LabLight>) => setLights((ls) => ls.map((l, i) => (i === editing ? { ...l, ...patch } : l)));

  const primary: LightParams = { pattern: resolved[0].pattern, params: resolved[0].params, cycleSec, sizePx: resolved[0].sizePx, brightness: resolved[0].brightness };
  const s = suggestSettings(primary, iso, apertureStops(lens), body.shutter.slowest);
  const distanceMm = suggestedDistanceMm(lens.focalMm, frameShortMm, screenCm * 10, lens.minFocusMm);
  const canFullscreen = fullscreenAvailable();
  const canWakeLock = "wakeLock" in navigator;
  const expectations = [1, cycleSec, cycleSec * 2].filter((t, i, a) => a.indexOf(t) === i);
  const exposure = previewSec ?? cycleSec;
  // Exposures the predicted photo offers: the usual three plus whatever a challenge asked for.
  const predictOptions = [...new Set([...expectations, exposure])].sort((a, b) => a - b);
  const bad = unsupportedChars(text);
  const empty = resolved.some((l) => (l.pattern === "drawn" || l.pattern === "text") && (l.params.strokes ?? []).length === 0);

  // A static preview of every light's path; built-in patterns as one 241-point line.
  const previews = useMemo(
    () =>
      resolved.map((l) =>
        l.pattern === "drawn" || l.pattern === "text"
          ? (l.params.strokes ?? []).map((st) => st.map((p) => `${(50 + p.x * 40).toFixed(2)},${(50 - p.y * 40).toFixed(2)}`).join(" "))
          : [Array.from({ length: 241 }, (_, i) => patternPoint(l.pattern, i / 240, l.params)).map((p) => `${(50 + p.x * 40).toFixed(2)},${(50 - p.y * 40).toFixed(2)}`).join(" ")],
      ),
    [resolved],
  );

  // The predicted photo: each light's trace during the exposure, added up in light.
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = canvasRef.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    const px = 320;
    c.width = px;
    c.height = px;
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, px, px);
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    // Point size on screen, relative to the pattern box the stage draws into.
    const box = PATTERN_FILL * Math.min(innerWidth, innerHeight);
    const half = (px * 0.8) / 2;
    for (const l of resolved) {
      ctx.strokeStyle = colourOf(l);
      ctx.globalAlpha = 0.6;
      ctx.lineWidth = Math.max(1, (l.sizePx / box) * px * 0.8);
      for (const pl of exposureTrace(l, cycleSec, loop, exposure)) {
        ctx.beginPath();
        pl.forEach((q, i) => (i ? ctx.lineTo(px / 2 + q.x * half, px / 2 - q.y * half) : ctx.moveTo(px / 2 + q.x * half, px / 2 - q.y * half)));
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    setLogged(false);
  }, [resolved, cycleSec, loop, exposure]);

  function applyChallenge(ch: Challenge) {
    setLights(ch.setup.lights.map((l) => newLight(l)));
    setEditing(0);
    setCycleSec(ch.setup.cycleSec);
    setLoop(ch.setup.loop);
    if (ch.setup.text !== undefined) setText(ch.setup.text);
    if (ch.setup.iso) setIso(ch.setup.iso);
    setPreviewSec(ch.setup.exposureSec ?? null);
  }

  function toggleDone(id: string) {
    setDone((d) => {
      const next = new Set(d);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      setString(DONE_KEY, JSON.stringify([...next]));
      return next;
    });
  }

  return (
    <section className="panel stage-longexp" aria-label="Long exposure lab">
      <div className="panel-head">
        <h2>Long exposure lab</h2>
      </div>
      <p className="muted small">
        Put your camera on a tripod facing this screen. The screen only ever shows the lights where they are now; your exposure draws the trails.
      </p>

      <div className="lel-setup">
        <svg className="lel-preview" viewBox="0 0 100 100" role="img" aria-label={`${resolved.map((l) => PATTERNS.find((p) => p.id === l.pattern)!.label).join(", ")} path`}>
          {previews.map((lines, i) =>
            lines.map((pts, k) => <polyline key={`${i}-${k}`} points={pts} fill="none" stroke={colourOf(resolved[i])} strokeWidth={1.2} strokeLinejoin="round" strokeLinecap="round" />),
          )}
        </svg>
        <div className="lel-controls">
          <Segmented
            label="Lights"
            value={lights.length}
            onChange={(n) => {
              setLights((ls) => (n > ls.length ? [...ls, ...Array.from({ length: n - ls.length }, (_, i) => newLight({ pattern: ls[0].pattern, colourId: ["red", "blue", "amber"][ls.length + i - 1] ?? "red", offset: (ls.length + i) / n }))] : ls.slice(0, n)));
              setEditing((e) => Math.min(e, n - 1));
            }}
            options={Array.from({ length: MAX_LIGHTS }, (_, i) => ({ value: i + 1, label: i ? `${i + 1} lights` : "1 light" }))}
          />
          {lights.length > 1 && (
            <Segmented label="Edit light" value={editing} onChange={setEditing} options={lights.map((_, i) => ({ value: i, label: `Light ${i + 1}` }))} />
          )}
          <label className="field">
            <span>Pattern</span>
            <select value={cur.pattern} onChange={(e) => setCur({ pattern: e.target.value as PatternId })}>
              {PATTERNS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          {cur.pattern === "spiral" && (
            <label className="field">
              <span>Turns · {cur.params.turns}</span>
              <input type="range" min={1} max={8} step={1} value={cur.params.turns} onChange={(e) => setCur({ params: { ...cur.params, turns: Number(e.target.value) } })} />
            </label>
          )}
          {cur.pattern === "lissajous" && (
            <>
              <label className="field">
                <span>Across · {cur.params.a}</span>
                <input type="range" min={1} max={6} step={1} value={cur.params.a} onChange={(e) => setCur({ params: { ...cur.params, a: Number(e.target.value) } })} />
              </label>
              <label className="field">
                <span>Up and down · {cur.params.b}</span>
                <input type="range" min={1} max={6} step={1} value={cur.params.b} onChange={(e) => setCur({ params: { ...cur.params, b: Number(e.target.value) } })} />
              </label>
            </>
          )}
          {cur.pattern === "text" && (
            <label className="field">
              <span>Words</span>
              <input type="text" maxLength={14} value={text} onChange={(e) => setText(e.target.value)} />
            </label>
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
      {cur.pattern === "text" && (
        <p className="muted small">
          Letters, digits and simple punctuation, one line. The light writes them left to right and goes dark between strokes; the words
          appear only in the photograph.
          {bad.length > 0 && ` Skipped: ${bad.join(" ")}.`}
        </p>
      )}
      {lights.some((l) => l.pattern === "drawn") && <PatternPad strokes={drawn} onChange={setDrawn} />}
      {empty && <p className="small lel-warn-line">Draw a path or type a word first: an empty pattern shows no light.</p>}

      <div className="lel-grid">
        <label className="field">
          <span>Point size · {cur.sizePx} px</span>
          <input type="range" min={4} max={40} step={1} value={cur.sizePx} onChange={(e) => setCur({ sizePx: Number(e.target.value) })} />
        </label>
        <label className="field">
          <span>Brightness · {Math.round(cur.brightness * 100)}%</span>
          <input type="range" min={10} max={100} step={5} value={Math.round(cur.brightness * 100)} onChange={(e) => setCur({ brightness: Number(e.target.value) / 100 })} />
        </label>
        <label className="field">
          <span>Colour</span>
          <select value={cur.colourId} onChange={(e) => setCur({ colourId: e.target.value })}>
            {LIGHT_COLOURS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        {lights.length > 1 && (
          <label className="field">
            <span>Head start · {Math.round(cur.offset * 100)}% of a cycle</span>
            <input type="range" min={0} max={95} step={5} value={Math.round(cur.offset * 100)} onChange={(e) => setCur({ offset: Number(e.target.value) / 100 })} />
          </label>
        )}
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
          {lights.length > 1 && <li>Settings are for light 1; dimmer or faster lights record fainter.</li>}
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

        <div className="lel-predict">
          <figure className="lel-predict-fig">
            <canvas ref={canvasRef} className="lel-predict-canvas" role="img" aria-label={`Predicted photo of a ${exposure} s exposure`} />
            <figcaption className="muted small">Predicted photo, {exposure} s exposure. Approximate: overlaps add up, brightness is relative.</figcaption>
          </figure>
          <div className="lel-predict-side">
            <Segmented
              label="Exposure to predict"
              value={exposure}
              onChange={setPreviewSec}
              options={predictOptions.map((t) => ({ value: t, label: `${t} s` }))}
            />
            {onLog && (
              <button
                type="button"
                className="btn btn-small"
                disabled={logDisabled || empty}
                onClick={() => {
                  const url = canvasRef.current?.toDataURL("image/jpeg", 0.85);
                  if (!url) return;
                  onLog({
                    url,
                    iso: s.iso,
                    fNumber: s.fNumber,
                    shutterSec: exposure,
                    note: `Long exposure lab: ${resolved.map((l) => PATTERNS.find((p) => p.id === l.pattern)!.label.toLowerCase()).join(" + ")}, ${cycleSec} s cycle, ${loop ? "loop" : "once"}${lights.some((l) => l.pattern === "text") ? `, “${text}”` : ""}. Predicted image; compare it with your photo.`,
                  });
                  setLogged(true);
                }}
              >
                {logged ? "Logged to the roll" : "Log this frame"}
              </button>
            )}
            <p className="muted small">Logging puts the prediction on your roll with these settings, so you can set your photo beside it.</p>
          </div>
        </div>
      </div>

      <details className="lel-details lel-challenges">
        <summary>Challenges</summary>
        <ul className="lel-challenge-list">
          {CHALLENGES.map((ch) => (
            <li key={ch.id} className="lel-challenge">
              <div className="lel-challenge-head">
                <strong>{ch.title}</strong>
                <label className="lel-challenge-done">
                  <input type="checkbox" checked={done.has(ch.id)} onChange={() => toggleDone(ch.id)} /> Done
                </label>
              </div>
              <p className="small">{ch.task}</p>
              <button type="button" className="btn btn-small" onClick={() => applyChallenge(ch)}>
                Set it up
              </button>
            </li>
          ))}
        </ul>
        <p className="muted small">No scores or streaks: the photo is the result. Ticks are kept on this device only.</p>
      </details>

      {(!canFullscreen || !canWakeLock) && (
        <ul className="lel-warn small" role="note">
          {!canFullscreen && <li>This browser can't make the stage fullscreen, so its bars may stay visible. Frame them out.</li>}
          {!canWakeLock && <li>This browser can't keep the screen awake. Make sure auto-lock or sleep is longer than your exposure.</li>}
        </ul>
      )}

      <button type="button" className="btn btn-red lel-start" disabled={empty} onClick={() => setRunning(true)}>
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
            <LongExposureStage
              lights={stageLights}
              cycleSec={cycleSec}
              loop={loop}
              countdownSec={countdown}
              onClose={() => setRunning(false)}
            />
          </Suspense>,
          document.body,
        )}
    </section>
  );
}
