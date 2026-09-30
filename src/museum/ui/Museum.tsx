import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as RPointerEvent } from "react";
import { playDialClick } from "../../audio/sounds";
import Wordmark from "../../components/app/Wordmark";
import { loadCollection } from "../../state/collectionStorage";
import { ATTRACT_IDLE_MS, attractSequence, museumHash, parseMuseumPath, step } from "../deck";
import { buildRooms, findExhibit, type Exhibit, type Room, type RoomId } from "../exhibits";
import { leaveFullscreen, requestFullscreen } from "../fullscreen";
import InfoLabel from "./InfoLabel";
import Showpiece from "./Showpiece";
import { useIdle } from "../../utils/useIdle";
import { hearShutter } from "./sound";
import Story from "./Story";
import "./museum.css";

/** How long each piece stays up in the display loop, and how long an idle visitor keeps control. */
const LOOP_MS = 9000;
const IDLE_MS = 30_000;
const HOLD_MS = 3000;

type View = { kind: "lobby" } | { kind: "room"; room: RoomId; index: number; story: boolean; dir: -1 | 0 | 1 } | { kind: "display"; index: number };

interface Props {
  /** Leave the museum (back to the app). */
  onExit: () => void;
  /** Put this camera/lens on the simulator and go to the camera. */
  onSimulate: (target: { bodyId?: string; lensId?: string }) => void;
}

const reducedMotion = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/** The exhibit name without the maker, set huge behind the piece: "M3", "Summilux-M 35 f/1.4 ASPH." → "Summilux 35". */
function watermark(e: Exhibit): string {
  const t = e.title.replace(/^Leica /, "").replace(/ \(.*\)$/, "");
  const lens = /^(.+?) (\d+) f\//.exec(t);
  return lens ? `${lens[1].replace(/-M$/, "")} ${lens[2]}` : t;
}

/** The watermark, sized so a long name still fits across the screen. */
function Watermark({ e }: { e: Exhibit }) {
  const text = watermark(e);
  return (
    <p className="mu-watermark" aria-hidden="true" style={{ "--mu-wm": Math.max(3, text.length) } as CSSProperties}>
      {text}
    </p>
  );
}

function initialView(rooms: Room[]): View {
  const p = parseMuseumPath(location.hash);
  if (p.display) return { kind: "display", index: 0 };
  const found = findExhibit(rooms, p.room, p.exhibit);
  if (found) return { kind: "room", room: found.room.id, index: found.index, story: p.story, dir: 0 };
  return { kind: "lobby" };
}

/**
 * The museum (#39): full screen, a night gallery. A lobby of rooms; in a room,
 * one piece at a time under a spotlight; "Explore" opens its story. Display
 * mode runs it unattended: a slow loop of pieces, touch to explore, back to
 * the loop when left alone.
 */
export default function Museum({ onExit, onSimulate }: Props) {
  const collection = useMemo(() => loadCollection(), []);
  const rooms = useMemo(() => buildRooms(collection), [collection]);
  const loop = useMemo(() => attractSequence(rooms), [rooms]);
  const [view, setView] = useState<View>(() => initialView(rooms));
  // Display mode stays on while a visitor explores; idle time brings the loop back.
  const [displayMode, setDisplayMode] = useState(view.kind === "display");
  const [focusRoom, setFocusRoom] = useState<RoomId>("cameras");
  const rootRef = useRef<HTMLDivElement>(null);

  // Keep the address in step without a page transition per swipe.
  useEffect(() => {
    const hash =
      view.kind === "display"
        ? museumHash({ display: true, story: false })
        : view.kind === "lobby"
          ? museumHash({ display: false, story: false })
          : museumHash({ display: false, room: view.room, exhibit: rooms.find((r) => r.id === view.room)?.exhibits[view.index]?.id, story: view.story });
    if (location.hash !== hash) history.replaceState(null, "", hash);
  }, [view, rooms]);

  useEffect(() => {
    rootRef.current?.focus();
  }, []);

  // A display left running shouldn't let the screen sleep.
  useEffect(() => {
    if (!displayMode) return;
    let lock: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } };
    nav.wakeLock
      ?.request("screen")
      .then((l) => (lock = l))
      .catch(() => {});
    return () => void lock?.release().catch(() => {});
  }, [displayMode]);

  // The loop: next piece every few seconds.
  useEffect(() => {
    if (view.kind !== "display" || loop.length === 0) return;
    const t = setTimeout(() => setView({ kind: "display", index: (view.index + 1) % loop.length }), LOOP_MS);
    return () => clearTimeout(t);
  }, [view, loop.length]);

  // In display mode, half a minute without a touch returns to the loop; browsing
  // normally, two minutes starts it.
  useIdle(
    displayMode ? IDLE_MS : ATTRACT_IDLE_MS,
    () => {
      setDisplayMode(true);
      setView({ kind: "display", index: 0 });
    },
    view.kind !== "display"
  );

  const exit = useCallback(() => {
    leaveFullscreen();
    onExit();
  }, [onExit]);

  const openRoom = (room: RoomId, index = 0) => setView({ kind: "room", room, index, story: false, dir: 0 });

  const go = useCallback(
    (dir: 1 | -1) =>
      setView((v) => {
        if (v.kind !== "room") return v;
        const count = rooms.find((r) => r.id === v.room)?.exhibits.length ?? 0;
        const index = step(v.index, count, dir);
        if (index === v.index) return v;
        playDialClick();
        return { ...v, index, story: false, dir };
      }),
    [rooms]
  );

  // Keys: arrows move, Enter opens the story, Escape steps back out.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (view.kind === "display") {
        if (e.key === "Escape") {
          setDisplayMode(false);
          leaveFullscreen();
          setView({ kind: "lobby" });
        } else if (e.key === "Enter" || e.key === " ") explore();
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        if (view.kind === "room" && view.story) setView({ ...view, story: false });
        else if (view.kind === "room") setView({ kind: "lobby" });
        else exit();
      } else if (view.kind === "room" && !view.story && (e.key === "ArrowRight" || e.key === "ArrowLeft")) {
        e.preventDefault();
        go(e.key === "ArrowRight" ? 1 : -1);
      } else if (view.kind === "room" && !view.story && e.key === "Enter" && (e.target as HTMLElement)?.tagName !== "BUTTON") {
        setView({ ...view, story: true });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Swipe between pieces.
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const onDown = (e: RPointerEvent) => {
    swipe.current = { x: e.clientX, y: e.clientY };
  };
  const onUp = (e: RPointerEvent) => {
    const s = swipe.current;
    swipe.current = null;
    if (!s) return;
    const dx = e.clientX - s.x;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(e.clientY - s.y) * 1.3) go(dx < 0 ? 1 : -1);
  };

  function explore() {
    if (view.kind !== "display") return;
    const e = loop[view.index];
    const found = findExhibit(rooms, e.room, e.id);
    if (found) setView({ kind: "room", room: found.room.id, index: found.index, story: false, dir: 0 });
  }

  function startDisplay() {
    requestFullscreen();
    setDisplayMode(true);
    setView({ kind: "display", index: 0 });
  }

  // Hidden exit for an unattended display: hold the top-left corner for three seconds.
  const [holding, setHolding] = useState(false);
  const holdTimer = useRef(0);
  const holdStart = () => {
    setHolding(true);
    holdTimer.current = window.setTimeout(() => {
      setHolding(false);
      setDisplayMode(false);
      leaveFullscreen();
      setView({ kind: "lobby" });
    }, HOLD_MS);
  };
  const holdEnd = () => {
    clearTimeout(holdTimer.current);
    setHolding(false);
  };

  const motion = !reducedMotion();

  // ── Display ─────────────────────────────────────────
  if (view.kind === "display") {
    const e = loop[view.index];
    const room = rooms.find((r) => r.id === e?.room);
    return (
      <div className="mu mu-display" ref={rootRef} tabIndex={-1} role="region" aria-label="Museum display" onClick={explore}>
        <button
          type="button"
          className={`mu-hold${holding ? " mu-hold-on" : ""}`}
          aria-label="Hold for three seconds to leave display mode"
          onPointerDown={(ev) => (ev.stopPropagation(), holdStart())}
          onPointerUp={holdEnd}
          onPointerLeave={holdEnd}
          onClick={(ev) => ev.stopPropagation()}
        />
        <div className="mu-display-mark">
          <Wordmark /> <span>Museum</span>
        </div>
        {e ? (
          <div key={`${e.room}-${e.id}-${view.index}`} className={`mu-stage mu-stage-display${motion ? " mu-drift" : ""}`}>
            <div className="mu-spot" aria-hidden="true" />
            <Watermark e={e} />
            <div className="mu-art">
              <Showpiece exhibit={e} collection={collection} />
            </div>
            <div className="mu-caption mu-caption-label">
              <InfoLabel exhibit={e} roomTitle={room?.title} />
            </div>
          </div>
        ) : (
          <p className="mu-empty">Nothing to show yet.</p>
        )}
        <p className="mu-touch">Touch to explore</p>
        <div key={`bar-${view.index}`} className={`mu-loopbar${motion ? " mu-loopbar-run" : ""}`} style={{ animationDuration: `${LOOP_MS}ms` }} aria-hidden="true" />
      </div>
    );
  }

  // ── Lobby ───────────────────────────────────────────
  if (view.kind === "lobby") {
    const focus = rooms.find((r) => r.id === focusRoom) ?? rooms[0];
    const preview = focus.exhibits.find((x) => x.hero) ?? focus.exhibits[0];
    return (
      <div className="mu mu-lobby" ref={rootRef} tabIndex={-1} role="region" aria-label="Museum">
        <header className="mu-top">
          <div className="mu-brand">
            <Wordmark /> <span>Museum</span>
          </div>
          <div className="mu-top-actions">
            <button type="button" className="mu-ghost" onClick={startDisplay}>
              Display mode
            </button>
            <button type="button" className="mu-round" onClick={exit} aria-label="Leave the museum">
              <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
                <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </header>
        <div className="mu-lobby-grid">
          <nav className="mu-rooms" aria-label="Rooms">
            <p className="mu-intro">Seventy years of the rangefinder, one piece at a time.</p>
            <ol>
              {rooms.map((r) => {
                const empty = r.exhibits.length === 0;
                return (
                  <li key={r.id}>
                    <button
                      type="button"
                      className={`mu-room${r.id === focus.id ? " mu-room-on" : ""}`}
                      disabled={empty}
                      onMouseEnter={() => setFocusRoom(r.id)}
                      onFocus={() => setFocusRoom(r.id)}
                      onClick={() => openRoom(r.id)}
                    >
                      <span className="mu-room-title">{r.title}</span>
                      <span className="mu-room-meta">
                        {empty ? (r.id === "collection" ? "Add pieces in My collection" : "Being researched") : `${r.exhibits.length} ${r.exhibits.length === 1 ? "piece" : "pieces"}`}
                        <span className="mu-room-line"> · {r.line}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </nav>
          <div className="mu-stage mu-stage-lobby" aria-hidden="true">
            <div className="mu-spot" />
            {preview && (
              <div key={preview.id} className={`mu-art${motion ? " mu-fade" : ""}`}>
                <Showpiece exhibit={preview} collection={collection} />
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Room ────────────────────────────────────────────
  const room = rooms.find((r) => r.id === view.room)!;
  const e = room.exhibits[view.index];
  if (!e) return null;
  const count = room.exhibits.length;
  const nextRoom = rooms.slice(rooms.indexOf(room) + 1).find((r) => r.exhibits.length > 0);

  return (
    <div className="mu mu-room-view" ref={rootRef} tabIndex={-1} role="region" aria-label={`${room.title}, piece ${view.index + 1} of ${count}`}>
      <header className="mu-top">
        <button type="button" className="mu-back" onClick={() => setView({ kind: "lobby" })}>
          <svg viewBox="0 0 10 16" width="9" height="15" aria-hidden="true">
            <path d="M8 1L2 8l6 7" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Museum
        </button>
        <p className="mu-room-name">{room.title}</p>
        <div className="mu-top-actions">
          <span className="mu-count" aria-hidden="true">
            {String(view.index + 1).padStart(2, "0")} / {String(count).padStart(2, "0")}
          </span>
          <button type="button" className="mu-round" onClick={exit} aria-label="Leave the museum">
            <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
              <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </header>

      <div className="mu-swipe" onPointerDown={onDown} onPointerUp={onUp} onPointerCancel={() => (swipe.current = null)}>
        <div key={e.id} className={`mu-stage mu-stage-room${motion && view.dir ? (view.dir > 0 ? " mu-in-next" : " mu-in-prev") : motion ? " mu-fade" : ""}`}>
          <div className="mu-spot" aria-hidden="true" />
          <Watermark e={e} />
          <div className="mu-art">
            <Showpiece exhibit={e} collection={collection} />
          </div>
          <div className="mu-caption mu-caption-label" aria-live="polite">
            <InfoLabel exhibit={e} />
            <div className="mu-actions">
              <button type="button" className="mu-cta" onClick={() => setView({ ...view, story: true })}>
                Explore
              </button>
              {e.soundBodyId && (
                <button type="button" className="mu-ghost" onClick={() => hearShutter(e.soundBodyId!)}>
                  Hear the shutter
                </button>
              )}
            </div>
          </div>
        </div>

        <button type="button" className="mu-arrow mu-arrow-prev" onClick={() => go(-1)} disabled={view.index === 0} aria-label="Previous piece">
          <svg viewBox="0 0 12 20" width="12" height="20" aria-hidden="true">
            <path d="M10 2L2 10l8 8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        {view.index < count - 1 ? (
          <button type="button" className="mu-arrow mu-arrow-next" onClick={() => go(1)} aria-label="Next piece">
            <svg viewBox="0 0 12 20" width="12" height="20" aria-hidden="true">
              <path d="M2 2l8 8-8 8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        ) : (
          nextRoom && (
            <button type="button" className="mu-next-room" onClick={() => openRoom(nextRoom.id)}>
              Next room: {nextRoom.title}
            </button>
          )
        )}
      </div>

      <div className="mu-rail" aria-hidden="true">
        <span style={{ width: `${((view.index + 1) / count) * 100}%` }} />
      </div>

      {view.story && <Story exhibit={e} roomTitle={room.title} collection={collection} onClose={() => setView({ ...view, story: false })} onSimulate={onSimulate} />}
    </div>
  );
}
