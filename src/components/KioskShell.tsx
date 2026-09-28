import { useEffect, useReducer, useRef, useState } from "react";
import Wordmark from "./app/Wordmark";
import { playMountClick } from "../audio/sounds";
import { BODIES, findBody, findLens, lensesForBody } from "../data/gear";
import { clearFrames } from "../services/db";
import { removeItem } from "../services/persistence";
import { KIOSK_HOME, emitKioskEvent, idlePhase, keysToClear, kioskReducer, type KioskConfig } from "../state/kiosk";
import BodyArt from "./gear/BodyArt";
import LensArt from "./gear/LensArt";

interface Props {
  config: KioskConfig;
  /** Puts the chosen body and lens into the shared simulator state. */
  onSelectBody: (id: string) => void;
  onSelectLens: (id: string) => void;
}

function prefersReducedMotion() {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Wipe the visitor's stored state and frames, then reload the kiosk URL: a clean home with a fresh heap. */
async function resetKiosk() {
  try {
    const keys = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i) ?? "");
    keysToClear(keys).forEach(removeItem);
  } catch {
    // Storage unavailable: nothing persisted to clear.
  }
  await Promise.all([clearFrames("film"), clearFrames("digital")]).catch(() => undefined);
  location.replace(`${location.pathname}${location.search}`);
}

/**
 * Kiosk mode (feature #20): a guided, large-target presentation layer over the
 * normal app. It drives the same state engine (body/lens selection) and, on
 * TRY IT, gets out of the way so the visitor uses the real simulator.
 */
export default function KioskShell({ config, onSelectBody, onSelectLens }: Props) {
  const [s, dispatch] = useReducer(kioskReducer, KIOSK_HOME);
  const [locking, setLocking] = useState(false);
  const [idle, setIdle] = useState<{ phase: "active" | "warning" | "reset"; secondsLeft: number }>({ phase: "active", secondsLeft: config.idleSec });
  const lastActivity = useRef(performance.now());
  const [drag, setDrag] = useState<{ lensId: string; x: number; y: number } | null>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const dragged = useRef(false);
  const resetting = useRef(false);

  // Idle watch: any input counts as activity. Home is already clean, so it never resets from there.
  useEffect(() => {
    const touch = () => (lastActivity.current = performance.now());
    // Browsers send pointermove to a parked cursor when content moves under it; only real movement counts.
    let last = { x: NaN, y: NaN };
    const move = (e: PointerEvent) => {
      if (Math.abs(e.clientX - last.x) < 2 && Math.abs(e.clientY - last.y) < 2) return;
      const first = Number.isNaN(last.x);
      last = { x: e.clientX, y: e.clientY };
      if (!first) touch();
    };
    const events = ["pointerdown", "keydown", "wheel", "touchstart"] as const;
    events.forEach((e) => window.addEventListener(e, touch, { passive: true, capture: true }));
    window.addEventListener("pointermove", move, { passive: true, capture: true });
    const id = window.setInterval(() => {
      const p = idlePhase(lastActivity.current, performance.now(), config.idleSec);
      setIdle((prev) => (prev.phase === p.phase && prev.secondsLeft === p.secondsLeft ? prev : p));
      if (p.phase === "reset" && s.step !== "home" && !resetting.current) {
        resetting.current = true;
        emitKioskEvent("idle_reset");
        void resetKiosk();
      }
    }, 250);
    return () => {
      events.forEach((e) => window.removeEventListener(e, touch, { capture: true }));
      window.removeEventListener("pointermove", move, { capture: true });
      window.clearInterval(id);
    };
  }, [config.idleSec, s.step]);

  // Offline cache for venues (production only: a worker would fight the dev server's hot reload).
  useEffect(() => {
    if (import.meta.env.PROD && "serviceWorker" in navigator) navigator.serviceWorker.register(`${import.meta.env.BASE_URL}kiosk-sw.js`).catch(() => undefined);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("kiosk", true);
    return () => document.documentElement.classList.remove("kiosk");
  }, []);

  function attach(lensId: string) {
    if (!s.bodyId) return;
    dispatch({ type: "attachLens", lensId });
    onSelectLens(lensId);
    emitKioskEvent("lens_attached", { bodyId: s.bodyId, lensId });
    playMountClick();
    if (!prefersReducedMotion()) {
      setLocking(true);
      window.setTimeout(() => setLocking(false), 450);
    }
  }

  function startOver() {
    if (resetting.current) return;
    resetting.current = true;
    emitKioskEvent("start_over");
    void resetKiosk();
  }

  const body = s.bodyId ? findBody(s.bodyId) : null;
  const lens = s.lensId ? findLens(s.lensId) : null;
  const lenses = body ? lensesForBody(body).filter((l) => body.fixedLensId || body.mounts.includes(l.mount)) : [];
  const warning = idle.phase === "warning" && s.step !== "home";

  const warningOverlay = warning && (
    <div className="kiosk-warning" role="alertdialog" aria-label="Still there?">
      <p className="kiosk-warning-title">Still there?</p>
      <p>Starting over in {idle.secondsLeft} s. Touch anywhere to keep going.</p>
    </div>
  );

  if (s.step === "try") {
    return (
      <>
        <div className="kiosk-bar" role="toolbar" aria-label="Kiosk">
          <span className="kiosk-bar-title">
            {body?.name} · {lens?.name}
          </span>
          <button type="button" className="btn btn-red kiosk-big" onClick={startOver}>
            Start over
          </button>
        </div>
        {warningOverlay}
      </>
    );
  }

  return (
    <div className="kiosk-shell" role="dialog" aria-modal="true" aria-label="leica.rt kiosk">
      {s.step === "home" && (
        <div className="kiosk-home">
          <h1 className="kiosk-title">
            <Wordmark />
          </h1>
          <p className="kiosk-sub">Build a camera, then try it.</p>
          <button
            type="button"
            className="btn btn-red kiosk-big kiosk-start"
            onClick={() => {
              dispatch({ type: "start" });
              emitKioskEvent("session_start");
            }}
          >
            Tap to start
          </button>
          {document.fullscreenEnabled && !document.fullscreenElement && (
            <button type="button" className="btn kiosk-big" onClick={() => document.documentElement.requestFullscreen?.().catch(() => undefined)}>
              Full screen
            </button>
          )}
          <p className="kiosk-fine">A simulator, not a shop: no prices or availability are shown.</p>
        </div>
      )}

      {s.step === "body" && (
        <div className="kiosk-step">
          <div className="kiosk-head">
            <button type="button" className="btn kiosk-big" onClick={() => dispatch({ type: "back" })}>
              Back
            </button>
            <h2>1 · Choose a camera</h2>
          </div>
          <div className="kiosk-grid" role="list">
            {BODIES.map((b) => (
              <button
                key={b.id}
                type="button"
                role="listitem"
                className="kiosk-card"
                onClick={() => {
                  dispatch({ type: "chooseBody", bodyId: b.id });
                  onSelectBody(b.id);
                  emitKioskEvent("body_selected", { bodyId: b.id });
                  if (b.fixedLensId) attachFixed(b.fixedLensId);
                }}
              >
                <BodyArt body={b} />
                <span className="kiosk-card-name">{b.name}</span>
                <span className="kiosk-card-meta">
                  {b.year} · {b.medium === "film" ? "Film" : "Digital"}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {s.step === "lens" && body && (
        <div className="kiosk-step">
          <div className="kiosk-head">
            <button type="button" className="btn kiosk-big" onClick={() => dispatch({ type: "back" })}>
              Back
            </button>
            <h2>2 · {body.fixedLensId ? "Its lens" : "Drag or tap a lens onto the camera"}</h2>
          </div>
          <div ref={dropRef} className={`kiosk-drop${drag ? " kiosk-drop-armed" : ""}`} aria-live="polite">
            <div className={locking ? "kiosk-lock" : undefined}>
              <BodyArt body={body} lens={lens ?? undefined} />
            </div>
            <p className="kiosk-drop-text">{lens ? `${lens.name} locked on` : "No lens yet"}</p>
          </div>
          {!body.fixedLensId && (
            <div className="kiosk-lenses" role="list">
              {lenses.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  role="listitem"
                  className={`kiosk-lens${l.id === s.lensId ? " kiosk-lens-on" : ""}`}
                  aria-pressed={l.id === s.lensId}
                  onClick={() => {
                    // A drag ends with a click on the same card; the drop already handled it.
                    if (dragged.current) {
                      dragged.current = false;
                      return;
                    }
                    attach(l.id);
                  }}
                  onPointerDown={(e) => {
                    if (e.pointerType === "mouse" && e.button !== 0) return;
                    dragStart.current = { x: e.clientX, y: e.clientY };
                    dragged.current = false;
                    e.currentTarget.setPointerCapture?.(e.pointerId);
                  }}
                  onPointerMove={(e) => {
                    const st = dragStart.current;
                    if (!st) return;
                    if (drag || Math.hypot(e.clientX - st.x, e.clientY - st.y) > 8) setDrag({ lensId: l.id, x: e.clientX, y: e.clientY });
                  }}
                  onPointerUp={(e) => {
                    dragStart.current = null;
                    if (!drag) return;
                    dragged.current = true;
                    setDrag(null);
                    const r = dropRef.current?.getBoundingClientRect();
                    if (r && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) attach(l.id);
                  }}
                  onPointerCancel={() => {
                    dragStart.current = null;
                    setDrag(null);
                  }}
                >
                  <LensArt lens={l} />
                  <span className="kiosk-card-name">{l.name}</span>
                </button>
              ))}
            </div>
          )}
          <button type="button" className="btn btn-red kiosk-big kiosk-try" disabled={!s.lensId} onClick={() => { dispatch({ type: "tryIt" }); emitKioskEvent("try_it", { bodyId: s.bodyId ?? undefined, lensId: s.lensId ?? undefined }); window.scrollTo(0, 0); }}>
            TRY IT
          </button>
        </div>
      )}
      {drag && (
        <div className="kiosk-ghost" style={{ left: drag.x, top: drag.y }} aria-hidden="true">
          <LensArt lens={findLens(drag.lensId)} />
        </div>
      )}
      {warningOverlay}
    </div>
  );

  function attachFixed(lensId: string) {
    dispatch({ type: "attachLens", lensId });
    onSelectLens(lensId);
  }
}
