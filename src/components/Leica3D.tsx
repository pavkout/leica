import { Component, Suspense, lazy, useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { formatShutter, shutterSpeeds, type Body, type Lens } from "../data/gear";
import { formatDistance, formatFNumber, type Units } from "../utils/format";
import {
  FOCUS_RAD_PER_PX,
  FOCUS_THROW_RAD,
  MODEL_PROVENANCE,
  detentsFromDrag,
  focusFromRingAngle,
  focusRingAngle,
  stepAperture,
  stepShutter,
  type TurnablePart,
} from "../three/rig";
import { qualityTier } from "../three/capabilities";
import type { VirtualLeicaHandle } from "../three/VirtualLeica";

// The only import of the 3D chunk: three.js loads when this view first opens.
const VirtualLeica = lazy(() => import("../three/VirtualLeica"));

interface Props {
  body: Body;
  lens: Lens;
  fNumber: number;
  focusMm: number;
  shutterSec: number;
  auto: boolean;
  advanceCount: number;
  units: Units;
  /** The app's own setters: turning a part in 3D writes through these, exactly like the HTML controls. */
  onAperture: (fNumber: number) => void;
  onFocus: (mm: number) => void;
  onShutter: (next: { auto: boolean; sec: number }) => void;
  /** The 2D art, shown while loading and whenever 3D can't run. */
  fallback: ReactNode;
}

class Boundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function usePrefersReducedMotion() {
  const query = typeof window !== "undefined" && window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  const [reduced, setReduced] = useState(query?.matches ?? false);
  useEffect(() => {
    if (!query) return;
    const onChange = () => setReduced(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, [query]);
  return reduced;
}

const PART_LABEL: Record<TurnablePart, string> = { aperture: "Aperture ring", focus: "Focus ring", shutter: "Shutter dial" };
const PART_BUTTON: Record<TurnablePart, string> = { aperture: "Aperture", focus: "Focus", shutter: "Speed" };
/** One −/+ press on the smooth focus ring. */
const FOCUS_BUTTON_RAD = FOCUS_THROW_RAD / 20;

export default function Leica3D(props: Props) {
  const { body, lens, fNumber, focusMm, shutterSec, auto, advanceCount, units, fallback } = props;
  const tier = qualityTier();
  const reducedMotion = usePrefersReducedMotion();
  const [lost, setLost] = useState(false);
  const [active, setActive] = useState<TurnablePart | null>(null);
  const view = useRef<VirtualLeicaHandle>(null);
  const onContextLost = useCallback(() => setLost(true), []);

  // Several drag events can land between renders, so each step builds on the
  // value it just requested rather than on a prop that hasn't updated yet.
  const latest = useRef({ ...props });
  const seenProps = useRef(props);
  if (seenProps.current !== props) {
    seenProps.current = props;
    latest.current = { ...props };
  }
  const carry = useRef(0);

  const turn = useCallback((part: TurnablePart, steps: number, focusRad = 0) => {
    const s = latest.current;
    if (part === "aperture" && steps) {
      const next = stepAperture(s.lens, s.fNumber, steps);
      if (next !== s.fNumber) {
        s.fNumber = next;
        s.onAperture(next);
      }
    } else if (part === "shutter" && steps) {
      const next = stepShutter(shutterSpeeds(s.body), s.shutterSec, s.auto, s.body.autoExposure, steps);
      if (next.auto !== s.auto || next.sec !== s.shutterSec) {
        s.auto = next.auto;
        s.shutterSec = next.sec;
        s.onShutter(next);
      }
    } else if (part === "focus" && focusRad) {
      const next = Math.max(focusFromRingAngle(s.lens, focusRingAngle(s.lens, s.focusMm) + focusRad), s.lens.minFocusMm);
      if (next !== s.focusMm) {
        s.focusMm = next;
        s.onFocus(next);
      }
    }
  }, []);

  const onTurnDrag = useCallback(
    (dx: number, start: boolean) => {
      if (!active) return;
      if (active === "focus") return turn("focus", 0, dx * FOCUS_RAD_PER_PX);
      // Each gesture starts clean: a half-click left over from the last drag doesn't carry into this one.
      if (start) carry.current = 0;
      const { steps, remainderPx } = detentsFromDrag(carry.current + dx);
      carry.current = remainderPx;
      turn(active, steps);
    },
    [active, turn],
  );
  const pick = useCallback((part: TurnablePart) => {
    carry.current = 0;
    setActive(part);
  }, []);
  const exit = useCallback(() => setActive(null), []);

  const nudge = (dir: 1 | -1) => {
    if (!active) return;
    if (active === "focus") turn("focus", 0, dir * FOCUS_BUTTON_RAD);
    else turn(active, dir);
  };
  // Keys are handled only while focus is inside the viewer, so page keys are never hijacked.
  const onKeyDown = (e: KeyboardEvent) => {
    if (!active) return;
    if (e.key === "Escape") {
      e.preventDefault();
      setActive(null);
    } else if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      nudge(e.key === "ArrowRight" ? 1 : -1);
    }
  };

  const value =
    active === "aperture"
      ? formatFNumber(fNumber)
      : active === "focus"
        ? formatDistance(focusMm, units)
        : active === "shutter"
          ? auto
            ? "A (automatic)"
            : `${formatShutter(shutterSec)} s`
          : "";

  const unavailable = (why: string) => (
    <>
      {fallback}
      <p className="muted small">{why}</p>
    </>
  );
  if (tier === "fallback") return unavailable("3D needs WebGL, which this browser doesn't provide — showing the 2D camera instead.");
  if (lost) return unavailable("The 3D view lost its graphics context — showing the 2D camera instead. Turn 3D off and on to retry.");

  return (
    <div className="leica3d" onKeyDown={onKeyDown}>
      <div
        className="leica3d-stage"
        role="img"
        aria-label={`3D model: ${body.name} with ${lens.name}, set to ${formatFNumber(fNumber)}, focused at ${formatDistance(focusMm, units)}. Drag to turn the camera, pinch or scroll to zoom; tap a ring or the dial to turn it.`}
      >
        <Boundary fallback={unavailable("The 3D view couldn't start — showing the 2D camera instead.")}>
          <Suspense fallback={<div className="leica3d-loading">{fallback}<p className="muted small">Loading 3D…</p></div>}>
            <VirtualLeica
              ref={view}
              body={body}
              lens={lens}
              fNumber={fNumber}
              focusMm={focusMm}
              shutterSec={shutterSec}
              auto={auto}
              advanceCount={advanceCount}
              tier={tier}
              reducedMotion={reducedMotion}
              activePart={active}
              onPickPart={pick}
              onTurnDrag={onTurnDrag}
              onExitPart={exit}
              onContextLost={onContextLost}
            />
          </Suspense>
        </Boundary>
      </div>

      {active ? (
        <div className="leica3d-turn" role="group" aria-label={`Turning the ${PART_LABEL[active].toLowerCase()}`}>
          <button type="button" className="btn btn-small" onClick={() => nudge(-1)} aria-label={`${PART_LABEL[active]}: turn back one step`}>
            −
          </button>
          <p className="leica3d-turn-value" aria-live="polite">
            <span className="muted small">{PART_LABEL[active]}</span> <strong>{value}</strong>
          </p>
          <button type="button" className="btn btn-small" onClick={() => nudge(1)} aria-label={`${PART_LABEL[active]}: turn forward one step`}>
            +
          </button>
          <button type="button" className="btn btn-small btn-red" onClick={exit}>
            Done
          </button>
        </div>
      ) : (
        <div className="leica3d-bar">
          <div className="leica3d-parts" role="group" aria-label="Turn a part">
            {(Object.keys(PART_LABEL) as TurnablePart[]).map((part) => (
              <button key={part} type="button" className="btn btn-small" onClick={() => pick(part)}>
                {PART_BUTTON[part]}
              </button>
            ))}
          </div>
          <button type="button" className="btn btn-small" onClick={() => view.current?.resetView()}>
            Reset view
          </button>
        </div>
      )}
      <p className="hint">
        {active ? "Drag sideways, or use − and +, to turn it. Tap empty space, press Esc or Done to finish. " : "Tap a ring or the dial to turn it. "}
        {tier === "full" ? "" : "Reduced quality. "}
        {MODEL_PROVENANCE.notes}
      </p>
    </div>
  );
}
