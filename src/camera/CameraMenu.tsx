import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { MODES, type ModeId, type Tool, type ToolId } from "../app/tools";
import Wordmark from "../components/app/Wordmark";
import { LANGUAGES, languageOf, setLang, t, useLang } from "../i18n";

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

// "language" is Setup's language list: reached from its Language row, not a tab of its own.
type Section = ModeId | "setup" | "museum" | "language";

/**
 * MENU, in the manner of a Leica rear screen: black, a list of sections on
 * the left, the chosen section's entries on the right, the selection in red.
 * Arrow keys move, Enter opens, Escape (or MENU) returns to the camera.
 */
export default function CameraMenu({ tools, settings, museum, onOpenTool, onClose, initialSection = "simulate", footer }: Props) {
  const lang = useLang();
  const [section, setSection] = useState<Section>(initialSection);
  const [row, setRow] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);
  const sections: { id: Section; label: string }[] = [
    ...MODES.map((m) => ({ id: m.id as Section, label: t(`mode.${m.id}`) })),
    ...(museum?.length ? [{ id: "museum" as Section, label: t("menu.museum") }] : []),
    { id: "setup", label: t("menu.setup") },
  ];
  const languageRow = { id: "language", label: t("setup.language"), detail: languageOf(lang).native, go: () => setSection("language") };
  const entries: { id: string; label: string; detail: string; go: () => void; lang?: string }[] =
    section === "language"
      ? LANGUAGES.map((l) => ({
          id: `lang-${l.id}`,
          label: `${l.id === lang ? "● " : ""}${l.native}`,
          detail: l.english,
          lang: l.tag,
          go: () => {
            setLang(l.id).then(() => setSection("setup"));
          },
        }))
      : section === "setup"
        ? [languageRow, ...settings.map((s) => ({ id: s.id, label: s.label, detail: s.value, go: s.onActivate }))]
        : section === "museum"
          ? (museum ?? []).map((s) => ({ id: s.id, label: s.label, detail: s.value, go: s.onActivate }))
          : tools(section).map((tool) => ({ id: tool.id, label: t(`tool.${tool.id}`), detail: t(`tool.${tool.id}.blurb`), go: () => onOpenTool(tool.id) }));
  const tabSection: Section = section === "language" ? "setup" : section;

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
    const si = sections.findIndex((s) => s.id === tabSection);
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
    <div className="menu" role="dialog" aria-modal="true" aria-label={t("menu.label")} onKeyDown={onKey}>
      <div className="menu-head">
        <span className="menu-title">
          <Wordmark />
          <span className="menu-title-label">MENU</span>
        </span>
        <button type="button" className="cam-btn cam-btn-small" onClick={onClose} aria-label={t("menu.back")}>
          {t("common.camera")}
        </button>
      </div>
      <div className="menu-body">
        <ul className="menu-sections" role="tablist" aria-label={t("menu.sections")}>
          {sections.map((s) => (
            <li key={s.id}>
              <button type="button" role="tab" aria-selected={s.id === tabSection} className={`menu-section${s.id === tabSection ? " menu-section-on" : ""}`} onClick={() => setSection(s.id)}>
                {s.label}
              </button>
            </li>
          ))}
        </ul>
        <ul ref={listRef} className="menu-entries" aria-label={section === "language" ? t("lang.title") : sections.find((s) => s.id === section)!.label}>
          {section === "language" && (
            <li className="menu-note">
              <p>{t("lang.note")}</p>
              <p>{t("lang.auto")}</p>
            </li>
          )}
          {entries.map((en, i) => (
            <li key={en.id}>
              <button type="button" className={`menu-entry${i === row ? " menu-entry-on" : ""}`} onClick={en.go} onFocus={() => setRow(i)}>
                <span className="menu-entry-label" lang={en.lang}>{en.label}</span>
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
