import { useRef, type KeyboardEvent, type PointerEvent, type WheelEvent } from "react";
import { playApertureClick, playDialClick } from "../audio/sounds";
import { IMPERIAL_SCALE_MM, METRIC_SCALE_MM, formatDistance, scaleLabel, type Units } from "../utils/format";
import { focusToRing, ringToFocus } from "./controlMath";
import { beginInteraction, haptic } from "./interaction";

interface Props {
  stops: number[];
  fNumber: number;
  onAperture: (n: number) => void;
  focusMm: number;
  minFocusMm: number;
  onFocus: (mm: number) => void;
  /** Depth-of-field limits for the band on the focus scale. */
  nearMm: number;
  farMm: number;
  units: Units;
}

/** Pixels of drag per full ring travel: a long throw, like the real lens. */
const FOCUS_THROW = 900;
const APERTURE_STEP = 46;

/**
 * The lens seen from above: an aperture ring and a focus ring whose engraved
 * scales slide under a fixed index as you turn them. The focus scale shows
 * the depth of field as a band, the way the engraved DOF scale does.
 */
export default function LensRings({ stops, fNumber, onAperture, focusMm, minFocusMm, onFocus, nearMm, farMm, units }: Props) {
  const apIndex = Math.max(0, stops.findIndex((s) => Math.abs(s - fNumber) < 1e-6));
  const t = focusToRing(focusMm, minFocusMm);
  const drag = useRef<{ ring: "ap" | "focus"; x: number; acc: number; ap: number; t: number; release: () => void } | null>(null);

  const marks = (units === "metric" ? METRIC_SCALE_MM : IMPERIAL_SCALE_MM).filter((mm) => mm >= minFocusMm * 0.999);

  function down(ring: "ap" | "focus", e: PointerEvent<HTMLDivElement>) {
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Capture refused: the ring still follows while the pointer stays on it.
    }
    drag.current = { ring, x: e.clientX, acc: 0, ap: apIndex, t, release: beginInteraction() };
  }

  function move(e: PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    d.x = e.clientX;
    if (d.ring === "ap") {
      // Scale slides with the finger: dragging left brings smaller apertures (higher f) under the index.
      d.acc -= dx;
      const steps = Math.trunc(d.acc / APERTURE_STEP);
      if (!steps) return;
      d.acc -= steps * APERTURE_STEP;
      const next = Math.min(stops.length - 1, Math.max(0, d.ap + steps));
      if (next !== d.ap) {
        d.ap = next;
        playApertureClick();
        haptic();
        onAperture(stops[next]);
      }
    } else {
      const before = d.t;
      d.t = Math.min(1, Math.max(0, d.t - dx / FOCUS_THROW));
      if (d.t !== before) {
        // The infinity hard stop clicks.
        if (d.t >= 0.995 && before < 0.995) {
          playDialClick();
          haptic(10);
        }
        onFocus(ringToFocus(d.t, minFocusMm));
      }
    }
  }

  function up() {
    drag.current?.release();
    drag.current = null;
  }

  function apKey(e: KeyboardEvent) {
    const d = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[e.key];
    if (d === undefined) return;
    e.preventDefault();
    const next = Math.min(stops.length - 1, Math.max(0, apIndex + d));
    if (next !== apIndex) {
      playApertureClick();
      onAperture(stops[next]);
    }
  }

  function focusKey(e: KeyboardEvent) {
    const d = { ArrowRight: 0.02, ArrowUp: 0.02, ArrowLeft: -0.02, ArrowDown: -0.02, PageUp: 0.1, PageDown: -0.1 }[e.key];
    if (e.key === "End") return (e.preventDefault(), onFocus(Infinity));
    if (e.key === "Home") return (e.preventDefault(), onFocus(minFocusMm));
    if (d === undefined) return;
    e.preventDefault();
    onFocus(ringToFocus(Math.min(1, Math.max(0, t + d)), minFocusMm));
  }

  function wheel(ring: "ap" | "focus", e: WheelEvent) {
    if (Math.abs(e.deltaY) < 4) return;
    const dir = e.deltaY > 0 ? 1 : -1;
    if (ring === "ap") {
      const next = Math.min(stops.length - 1, Math.max(0, apIndex + dir));
      if (next !== apIndex) {
        playApertureClick();
        onAperture(stops[next]);
      }
    } else onFocus(ringToFocus(Math.min(1, Math.max(0, t + dir * 0.02)), minFocusMm));
  }

  // Positions on the focus strip, in px from the index.
  const fx = (mm: number) => (focusToRing(mm, minFocusMm) - t) * FOCUS_THROW;
  const nearX = fx(Math.max(nearMm, minFocusMm));
  const farX = Number.isFinite(farMm) ? fx(farMm) : fx(Infinity) + 18;

  return (
    <div className="rings">
      <div
        className="ring ring-aperture"
        role="slider"
        tabIndex={0}
        aria-label="Aperture ring"
        aria-valuemin={0}
        aria-valuemax={stops.length - 1}
        aria-valuenow={apIndex}
        aria-valuetext={`f/${fNumber}`}
        onPointerDown={(e) => down("ap", e)}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onKeyDown={apKey}
        onWheel={(e) => wheel("ap", e)}
      >
        <span className="ring-knurl" aria-hidden="true" style={{ backgroundPositionX: `${-apIndex * APERTURE_STEP}px` }} />
        <div className="ring-scale" aria-hidden="true">
          {stops.map((s, i) => (
            <span key={s} className={`ring-mark${i === apIndex ? " ring-mark-on" : ""}`} style={{ transform: `translateX(${(i - apIndex) * APERTURE_STEP}px)` }}>
              {s}
            </span>
          ))}
        </div>
      </div>

      <div
        className="ring ring-focus"
        role="slider"
        tabIndex={0}
        aria-label="Focus ring"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(t * 100)}
        aria-valuetext={formatDistance(focusMm, units)}
        onPointerDown={(e) => down("focus", e)}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onKeyDown={focusKey}
        onWheel={(e) => wheel("focus", e)}
      >
        <span className="ring-knurl ring-knurl-fine" aria-hidden="true" style={{ backgroundPositionX: `${-t * FOCUS_THROW}px` }} />
        <div className="ring-scale" aria-hidden="true">
          <span className="ring-dof" style={{ transform: `translateX(${nearX}px)`, width: `${Math.max(2, farX - nearX)}px` }} />
          {marks.map((mm) => (
            <span key={mm} className="ring-mark ring-mark-dist" style={{ transform: `translateX(${fx(mm)}px)` }}>
              {scaleLabel(mm, units)}
            </span>
          ))}
          <span className="ring-mark ring-mark-dist ring-inf" style={{ transform: `translateX(${fx(Infinity)}px)` }}>
            ∞
          </span>
        </div>
      </div>
      <span className="rings-index" aria-hidden="true" />
    </div>
  );
}
