import { Component, Suspense, lazy, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { Body, Lens } from "../data/gear";
import { MODEL_PROVENANCE } from "../three/rig";
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

export default function Leica3D({ body, lens, fNumber, focusMm, shutterSec, auto, advanceCount, fallback }: Props) {
  const tier = qualityTier();
  const reducedMotion = usePrefersReducedMotion();
  const [lost, setLost] = useState(false);
  const view = useRef<VirtualLeicaHandle>(null);
  const onContextLost = useCallback(() => setLost(true), []);

  const unavailable = (why: string) => (
    <>
      {fallback}
      <p className="muted small">{why}</p>
    </>
  );
  if (tier === "fallback") return unavailable("3D needs WebGL, which this browser doesn't provide — showing the 2D camera instead.");
  if (lost) return unavailable("The 3D view lost its graphics context — showing the 2D camera instead. Turn 3D off and on to retry.");

  return (
    <div className="leica3d">
      <div className="leica3d-stage" role="img" aria-label={`3D model: ${body.name} with ${lens.name}, set to f/${fNumber}. Drag to turn it, pinch or scroll to zoom.`}>
        <Boundary fallback={unavailable("The 3D view couldn't start — showing the 2D camera instead.")}>
          <Suspense fallback={<div className="leica3d-loading">{fallback}<p className="muted small">Loading 3D…</p></div>}>
            <VirtualLeica ref={view} body={body} lens={lens} fNumber={fNumber} focusMm={focusMm} shutterSec={shutterSec} auto={auto} advanceCount={advanceCount} tier={tier} reducedMotion={reducedMotion} onContextLost={onContextLost} />
          </Suspense>
        </Boundary>
      </div>
      <div className="leica3d-bar">
        <button type="button" className="btn btn-small" onClick={() => view.current?.resetView()}>
          Reset view
        </button>
        <span className="muted small">{tier === "full" ? "Full quality" : "Reduced quality"}</span>
      </div>
      <p className="hint">{MODEL_PROVENANCE.notes}</p>
    </div>
  );
}
