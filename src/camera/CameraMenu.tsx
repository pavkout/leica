import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { MODES, type ModeId, type Tool, type ToolId } from "../app/tools";
import Wordmark from "../components/app/Wordmark";

export interface MenuSetting {
  id: string;
  label: string;
  value: string;
  onActivate: () => void;
}

interface Props {
  tools: (mode: ModeId) => Tool[];
  settings: MenuSetting[];
  onOpenTool: (tool: ToolId) => void;
  onClose: () => void;
  /** The Museum section's entries (#39): enter it, or start the unattended display. */
  museum?: MenuSetting[];
  /** Section to open on (the last one used). */
  initialSection?: ModeId | "setup" | "museum";
  footer?: ReactNode;
}

type Section = ModeId | "setup" | "museum";

/**
 * MENU, in the manner of a Leica rear screen: black, a list of sections on
 * the left, the chosen section's entries on the right, the selection in red.
 * Arrow keys move, Enter opens, Escape (or MENU) returns to the camera.
 */
export default function CameraMenu({ tools, settings, museum, onOpenTool, onClose, initialSection = "simulate", footer }: Props) {
  const [section, setSection] = useState<Section>(initialSection);
  const [row, setRow] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);
  const sections: { id: Section; label: string }[] = [
    ...MODES.map((m) => ({ id: m.id as Section, label: m.label })),
    ...(museum?.length ? [{ id: "museum" as Section, label: "Museum" }] : []),
    { id: "setup", label: "Setup" },
  ];
  const entries: { id: string; label: string; detail: string; go: () => void }[] =
    section === "setup"
      ? settings.map((s) => ({ id: s.id, label: s.label, detail: s.value, go: s.onActivate }))
      : section === "museum"
        ? (museum ?? []).map((s) => ({ id: s.id, label: s.label, detail: s.value, go: s.onActivate }))
        : tools(section).map((t) => ({ id: t.id, label: t.label, detail: t.blurb, go: () => onOpenTool(t.id) }));

  useEffect(() => setRow(0), [section]);
  // Escape (like pressing MENU again) returns to the camera wherever focus is.
  useEffect(() => {
    const onEsc = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [onClose]);
  useEffect(() => {
    listRef.current?.querySelectorAll<HTMLElement>(".menu-entry")[row]?.focus({ preventScroll: false });
  }, [row, section]);

  function onKey(e: KeyboardEvent) {
    const si = sections.findIndex((s) => s.id === section);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setRow((r) => Math.min(entries.length - 1, r + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setRow((r) => Math.max(0, r - 1));
    } else if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      const next = sections[(si + (e.key === "ArrowRight" ? 1 : -1) + sections.length) % sections.length];
      setSection(next.id);
    }
  }

  return (
    <div className="menu" role="dialog" aria-modal="true" aria-label="Menu" onKeyDown={onKey}>
      <div className="menu-head">
        <span className="menu-title">
          <Wordmark />
          <span className="menu-title-label">MENU</span>
        </span>
        <button type="button" className="cam-btn cam-btn-small" onClick={onClose} aria-label="Back to the camera">
          Camera
        </button>
      </div>
      <div className="menu-body">
        <ul className="menu-sections" role="tablist" aria-label="Menu sections">
          {sections.map((s) => (
            <li key={s.id}>
              <button type="button" role="tab" aria-selected={s.id === section} className={`menu-section${s.id === section ? " menu-section-on" : ""}`} onClick={() => setSection(s.id)}>
                {s.label}
              </button>
            </li>
          ))}
        </ul>
        <ul ref={listRef} className="menu-entries" aria-label={sections.find((s) => s.id === section)!.label}>
          {entries.map((en, i) => (
            <li key={en.id}>
              <button type="button" className={`menu-entry${i === row ? " menu-entry-on" : ""}`} onClick={en.go} onFocus={() => setRow(i)}>
                <span className="menu-entry-label">{en.label}</span>
                <span className="menu-entry-detail">{en.detail}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      {footer}
    </div>
  );
}
