import { useRef, type KeyboardEvent, type PointerEvent, type WheelEvent } from "react";
import { playDialClick } from "../audio/sounds";
import { beginInteraction, haptic } from "./interaction";

export interface DialStop {
  key: string;
  /** Engraved text. */
  label: string;
  /** Screen-reader value. */
  spoken: string;
  /** Engraved in red (e.g. A, or the flash-sync speed). */
  red?: boolean;
}

interface Props {
  label: string;
  stops: DialStop[];
  index: number;
  onChange: (index: number) => void;
  /** Diameter, px. */
  size: number;
  /** Degrees between engravings. */
  step?: number;
  className?: string;
  disabled?: boolean;
}

/**
 * A knurled top-plate dial seen from above: values engraved round the rim, a
 * fixed index, detents. Turn it like the real one — grab and rotate — or with
 * the wheel, arrow keys, Home/End. Each detent clicks (sound + haptic).
 */
export default function RotaryDial({ label, stops, index, onChange, size, step = 24, className, disabled }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ lastAngle: number; acc: number; cur: number; release: () => void } | null>(null);
  const last = stops.length - 1;
  const clamp = (i: number) => Math.min(last, Math.max(0, i));

  /** `from` is where the dial is now: during a fast turn the `index` prop can be a render behind. */
  function go(i: number, from = index) {
    const next = clamp(i);
    if (next === from) return;
    playDialClick();
    haptic();
    onChange(next);
  }

  function angleOf(e: PointerEvent) {
    const r = ref.current!.getBoundingClientRect();
    return (Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180) / Math.PI;
  }

  function onDown(e: PointerEvent<HTMLDivElement>) {
    if (disabled) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Capture refused: the turn still follows while the pointer stays on the dial.
    }
    drag.current = { lastAngle: angleOf(e), acc: 0, cur: index, release: beginInteraction() };
  }

  function onMove(e: PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d) return;
    const a = angleOf(e);
    // Accumulate the turn (wrapped to ±180° per move, so long turns keep counting).
    d.acc += ((((a - d.lastAngle + 180) % 360) + 360) % 360) - 180;
    d.lastAngle = a;
    // One detent per engraving's worth of turn (`arc` is set below from the dial's size).
    const steps = Math.trunc(d.acc / arc);
    if (!steps) return;
    d.acc -= steps * arc;
    // The rotor turns with the finger: clockwise brings the lower engravings under the index.
    const next = clamp(d.cur - steps);
    if (next !== d.cur) {
      go(next, d.cur);
      d.cur = next;
    }
  }

  function onUp() {
    drag.current?.release();
    drag.current = null;
  }

  function onKey(e: KeyboardEvent) {
    const d = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1, PageUp: 3, PageDown: -3 }[e.key];
    if (d !== undefined) {
      e.preventDefault();
      go(index + d);
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      go(e.key === "Home" ? 0 : last);
    }
  }

  function onWheel(e: WheelEvent) {
    if (disabled || Math.abs(e.deltaY) < 4) return;
    go(index + (e.deltaY > 0 ? 1 : -1));
  }

  const r = size / 2;
  // Engravings sit just inside the knurl; the spacing is wide enough that the longest one never touches its neighbour.
  const fontSize = Math.round(Math.max(10, Math.min(15, size * 0.085)));
  const markR = r - Math.max(15, size * 0.15);
  const longest = Math.max(...stops.map((s) => s.label.length));
  const arc = Math.max(step, ((longest * fontSize * 0.58 + 8) / markR) * (180 / Math.PI));
  return (
    <div
      ref={ref}
      className={`rdial${disabled ? " rdial-off" : ""}${className ? ` ${className}` : ""}`}
      style={{ width: size, height: size }}
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={last}
      aria-valuenow={index}
      aria-valuetext={stops[index]?.spoken}
      aria-disabled={disabled || undefined}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onKeyDown={onKey}
      onWheel={onWheel}
    >
      <div className="rdial-rotor" style={{ transform: `rotate(${-index * arc}deg)` }}>
        <span className="rdial-knurl" aria-hidden="true" />
        <span className="rdial-face" aria-hidden="true" />
        {stops.map((s, i) => {
          // Only the arc near the index is engraved legibly, as on a real dial; farther values fade out.
          const away = Math.abs(i - index) * arc;
          if (away > 115) return null;
          return (
            <span
              key={s.key}
              className={`rdial-mark${s.red ? " rdial-red" : ""}${i === index ? " rdial-mark-on" : ""}`}
              style={{ transform: `rotate(${i * arc}deg) translateY(${-markR}px)`, opacity: away > 75 ? 0.35 : 1, fontSize }}
              aria-hidden="true"
            >
              {s.label}
            </span>
          );
        })}
      </div>
      <span className="rdial-index" aria-hidden="true" />
    </div>
  );
}
