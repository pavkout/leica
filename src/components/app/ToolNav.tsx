import { useEffect, useRef } from "react";
import { MODES, type ModeId, type Tool, type ToolId } from "../../app/tools";

interface Props {
  mode: ModeId;
  tools: Tool[];
  active: ToolId;
  onSelect: (tool: ToolId) => void;
}

/** The tools in the current mode: a side rail on wide screens, a sideways strip on phones. */
export default function ToolNav({ mode, tools, active, onSelect }: Props) {
  const m = MODES.find((x) => x.id === mode)!;
  const listRef = useRef<HTMLUListElement>(null);

  // Keep the active tool in view in the phone strip.
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>('[aria-current="page"]');
    el?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }, [active, mode]);

  return (
    <nav className="tool-nav" aria-label={`${m.label} tools`}>
      <div className="tool-nav-head">
        <p className="tool-nav-mode">{m.label}</p>
        <p className="tool-nav-job">{m.job}</p>
      </div>
      <ul ref={listRef} className="tool-list">
        {tools.map((t) => (
          <li key={t.id}>
            <button
              type="button"
              className="tool-link"
              aria-current={t.id === active ? "page" : undefined}
              onClick={() => onSelect(t.id)}
            >
              <span className="tool-link-label">{t.label}</span>
              <span className="tool-link-blurb">{t.blurb}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
