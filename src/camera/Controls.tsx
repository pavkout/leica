import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { playDialClick } from "../audio/sounds";
import { EV_STEPS, evLabel } from "./controlMath";
import { beginInteraction, haptic } from "./interaction";

const THUMB_STEP = 22;

/** The thumb wheel, seen edge-on: drag it up or down; each third of a stop clicks. */
export function ThumbWheel({ ev, onChange, disabled }: { ev: number; onChange: (ev: number) => void; disabled?: boolean }) {
  const index = EV_STEPS.findIndex((v) => Math.abs(v - ev) < 1e-3);
  const drag = useRef<{ y: number; acc: number; cur: number; release: () => void } | null>(null);
  const go = (i: number, from: number) => {
    const next = Math.min(EV_STEPS.length - 1, Math.max(0, i));
    if (next === from) return from;
    playDialClick();
    haptic(4);
    onChange(EV_STEPS[next]);
    return next;
  };
  return (
    <div
      className={`thumbwheel${disabled ? " thumbwheel-off" : ""}`}
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-label="Exposure compensation"
      aria-valuemin={-3}
      aria-valuemax={3}
      aria-valuenow={ev}
      aria-valuetext={`${evLabel(ev)} EV`}
      aria-disabled={disabled || undefined}
      onPointerDown={(e: PointerEvent<HTMLDivElement>) => {
        if (disabled) return;
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          // Capture refused: the wheel still follows while the pointer stays on it.
        }
        drag.current = { y: e.clientY, acc: 0, cur: index, release: beginInteraction() };
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d) return;
        // Rolling the wheel upward adds exposure.
        d.acc += d.y - e.clientY;
        d.y = e.clientY;
        const steps = Math.trunc(d.acc / THUMB_STEP);
        if (!steps) return;
        d.acc -= steps * THUMB_STEP;
        d.cur = go(d.cur + steps, d.cur);
      }}
      onPointerUp={() => {
        drag.current?.release();
        drag.current = null;
      }}
      onPointerCancel={() => {
        drag.current?.release();
        drag.current = null;
      }}
      onKeyDown={(e: KeyboardEvent) => {
        const d = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1 }[e.key];
        if (d === undefined) return;
        e.preventDefault();
        go(index + d, index);
      }}
      onWheel={(e) => {
        if (!disabled && Math.abs(e.deltaY) >= 4) go(index + (e.deltaY < 0 ? 1 : -1), index);
      }}
    >
      <span className="thumbwheel-knurl" aria-hidden="true" style={{ backgroundPositionY: `${-index * THUMB_STEP * 0.5}px` }} />
      <span className="thumbwheel-value" aria-hidden="true">
        {evLabel(ev)}
      </span>
    </div>
  );
}

/**
 * The shutter release: pressing half-way (finger down) wakes the meter,
 * lifting off fires. Slide off the button to cancel, as a real release lets
 * you ease off before the break point.
 */
export function ReleaseButton({ onHalf, onFire, disabled, label = "Release the shutter" }: { onHalf: (pressed: boolean) => void; onFire: () => void; disabled?: boolean; label?: string }) {
  const [pressed, setPressed] = useState(false);
  const inside = useRef(false);
  return (
    <button
      type="button"
      className={`release${pressed ? " release-half" : ""}`}
      aria-label={label}
      disabled={disabled}
      onPointerDown={(e) => {
        if (disabled) return;
        inside.current = true;
        setPressed(true);
        onHalf(true);
        haptic(4);
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          // Capture refused: lifting over the button still fires.
        }
      }}
      onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        inside.current = e.clientX >= r.left - 12 && e.clientX <= r.right + 12 && e.clientY >= r.top - 12 && e.clientY <= r.bottom + 12;
      }}
      onPointerUp={() => {
        setPressed(false);
        onHalf(false);
        if (inside.current) onFire();
        inside.current = false;
      }}
      onPointerCancel={() => {
        setPressed(false);
        onHalf(false);
        inside.current = false;
      }}
      onClick={(e) => {
        // Keyboard activation (pointer presses are handled on pointer up).
        if (e.detail === 0) onFire();
      }}
    >
      <span className="release-cap" aria-hidden="true" />
    </button>
  );
}

/**
 * The film-advance lever: swing it out (drag right, or tap) to wind on. Until
 * it's wound, the shutter won't fire, as on a film M. It names itself, and
 * when it needs winding it shows the arc it swings through and makes a small
 * swing, so it reads as a lever to move, not a decoration.
 */
export function AdvanceLever({ wound, onWind, nudge = 0 }: { wound: boolean; onWind: () => void; nudge?: number }) {
  const [angle, setAngle] = useState(0);
  const start = useRef<number | null>(null);
  const full = 110;
  const finish = () => {
    if (angle > full * 0.6 && !wound) onWind();
    setAngle(0);
    start.current = null;
  };
  return (
    <div className={`lever-wrap${wound ? "" : " lever-wrap-due"}`}>
      <span className="lever-name" aria-hidden="true">
        Film advance
      </span>
      <button
        type="button"
        className={`lever${wound ? " lever-wound" : ""}`}
        aria-label={wound ? "Film advance lever: wound, ready to shoot" : "Film advance lever: wind on the film before the next shot"}
        aria-pressed={wound}
        onPointerDown={(e) => {
          if (wound) return;
          start.current = e.clientX;
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {
            // Capture refused.
          }
        }}
        onPointerMove={(e) => {
          if (start.current === null) return;
          setAngle(Math.min(full, Math.max(0, (e.clientX - start.current) * 1.4)));
        }}
        onPointerUp={finish}
        onPointerCancel={() => {
          setAngle(0);
          start.current = null;
        }}
        onClick={() => {
          // A tap winds too (dragging just shows the swing); winding twice is harmless.
          if (!wound) onWind();
        }}
      >
        {/* The path the lever swings through, shown only when it needs winding. */}
        {!wound && (
          <svg className="lever-arc" viewBox="0 0 30 30" width="30" height="30" aria-hidden="true">
            <path d="M6 26 A 22 22 0 0 0 24 8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 2.5" />
            <path d="M18 7 L25 7 L24 14" fill="none" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        )}
        <span className="lever-hub" aria-hidden="true" />
        {/* Keyed on the nudge count, so every press of the release replays the hint swing. */}
        <span key={nudge} className={`lever-arm${!wound && angle === 0 ? " lever-arm-hint" : ""}`} style={angle ? { transform: `rotate(${-angle}deg)` } : undefined} aria-hidden="true">
          <span className="lever-tip" />
        </span>
      </button>
      <span className="lever-label" aria-hidden="true">
        {wound ? "Wound · ready" : "Swing to wind on"}
      </span>
    </div>
  );
}
