import { useEffect, useRef, useState } from "react";
import { playApertureClick, playDialClick } from "../audio/sounds";
import type { Lens } from "../data/gear";
import { depthOfField, hyperfocal } from "../physics/optics";
import { formatDistance, formatFNumber, type Units } from "../utils/format";
import Segmented from "./Segmented";

interface Props {
  lens: Lens;
  stops: number[];
  fNumber: number;
  onAperture: (n: number) => void;
  cocMm: number;
  units: Units;
}

type Mode = "hyperfocal" | "2000" | "3000" | "5000";

/** Keeps the screen on while the coach is up, where the browser allows it. */
function useWakeLock(on: boolean) {
  const lock = useRef<{ release: () => Promise<void> } | null>(null);
  const [held, setHeld] = useState(false);
  useEffect(() => {
    if (!on) return;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } };
    let alive = true;
    const request = () =>
      nav.wakeLock
        ?.request("screen")
        .then((l) => {
          if (!alive) return void l.release();
          lock.current = l;
          setHeld(true);
        })
        .catch(() => setHeld(false));
    void request();
    // A wake lock is dropped when the page is hidden; take it again on return.
    const onVisible = () => document.visibilityState === "visible" && void request();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      document.removeEventListener("visibilitychange", onVisible);
      void lock.current?.release().catch(() => undefined);
      lock.current = null;
      setHeld(false);
    };
  }, [on]);
  return held;
}

/**
 * The zone coach: for a walk with a film camera. Big engraved figures you can
 * read in the sun: what to set on the distance scale and what will be sharp,
 * for the aperture you're using. Full screen keeps the phone awake.
 */
export default function ZoneCoach({ lens, stops, fNumber, onAperture, cocMm, units }: Props) {
  const [mode, setMode] = useState<Mode>("hyperfocal");
  const [full, setFull] = useState(false);
  const awake = useWakeLock(full);

  const H = hyperfocal(lens.focalMm, fNumber, cocMm);
  const setMm = mode === "hyperfocal" ? H : Math.max(Number(mode), lens.minFocusMm);
  const dof = depthOfField(lens.focalMm, fNumber, cocMm, setMm);
  const d = (mm: number) => formatDistance(mm, units);

  useEffect(() => {
    if (!full) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setFull(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [full]);

  const readout = (
    <div className="zc-readout" aria-live="polite">
      <p className="zc-label">Set the distance scale to</p>
      <p className="zc-big">{d(setMm)}</p>
      <p className="zc-label">Sharp from</p>
      <p className="zc-range">
        {d(dof.nearMm)} <span>to</span> {d(dof.farMm)}
      </p>
      <p className="zc-meta">
        {formatFNumber(fNumber)} · {lens.focalMm} mm
      </p>
    </div>
  );

  const controls = (
    <div className="zc-controls">
      <div className="field">
        <span>Aperture</span>
        <div className="dial" role="radiogroup" aria-label="Aperture">
          {stops.map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={n === fNumber}
              className={n === fNumber ? "dial-step dial-on" : "dial-step"}
              onClick={() => {
                if (n !== fNumber) playApertureClick();
                onAperture(n);
              }}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
      <div className="field">
        <span>Focus</span>
        <Segmented
          label="Focus"
          value={mode}
          onChange={(m) => {
            playDialClick();
            setMode(m);
          }}
          options={[
            { value: "hyperfocal", label: "Hyperfocal" },
            { value: "2000", label: units === "metric" ? "2 m" : "6½′" },
            { value: "3000", label: units === "metric" ? "3 m" : "10′" },
            { value: "5000", label: units === "metric" ? "5 m" : "16′" },
          ]}
        />
      </div>
    </div>
  );

  return (
    <section className="panel stage-zone" aria-label="Zone coach">
      {readout}
      {controls}
      <button type="button" className="btn btn-red zc-go" onClick={() => setFull(true)}>
        Go out: full screen
      </button>
      <p className="hint">
        Depth of field from the {lens.name} at the sharpness of the engraved scale. Full screen keeps the phone awake while you walk
        {typeof navigator !== "undefined" && !("wakeLock" in navigator) ? " where the browser allows it (this one doesn't)" : ""}.
      </p>

      {full && (
        <div className="zc-full" role="dialog" aria-modal="true" aria-label="Zone coach, full screen">
          <button type="button" className="lv-close zc-close" onClick={() => setFull(false)} aria-label="Leave full screen">
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.6" />
            </svg>
          </button>
          {readout}
          {controls}
          <p className="zc-awake">{awake ? "Screen stays on" : "Screen may sleep: this browser can't keep it awake"}</p>
        </div>
      )}
    </section>
  );
}
