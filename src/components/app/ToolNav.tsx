import { useEffect, useRef } from "react";
import { type ModeId, type Tool, type ToolId } from "../../app/tools";
import { t, useLang } from "../../i18n";

interface Props {
  mode: ModeId;
  tools: Tool[];
  active: ToolId;
  onSelect: (tool: ToolId) => void;
}

/** The tools in the current mode: a side rail on wide screens, a sideways strip on phones. */
export default function ToolNav({ mode, tools, active, onSelect }: Props) {
  useLang();
  const listRef = useRef<HTMLUListElement>(null);

  // Keep the active tool in view in the phone strip.
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>('[aria-current="page"]');
    el?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }, [active, mode]);

  return (
    <nav className="tool-nav" aria-label={t("tools.navAria", { mode: t(`mode.${mode}`) })}>
      <div className="tool-nav-head">
        <p className="tool-nav-mode">{t(`mode.${mode}`)}</p>
        <p className="tool-nav-job">{t(`mode.${mode}.job`)}</p>
      </div>
      <ul ref={listRef} className="tool-list">
        {tools.map((tool) => (
          <li key={tool.id}>
            <button
              type="button"
              className="tool-link"
              aria-current={tool.id === active ? "page" : undefined}
              onClick={() => onSelect(tool.id)}
            >
              <span className="tool-link-label">{t(`tool.${tool.id}`)}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
