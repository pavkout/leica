import { useRef, type KeyboardEvent } from "react";
import { MODES, type ModeId } from "../../app/tools";

interface Props {
  mode: ModeId;
  onChange: (mode: ModeId) => void;
}

/** Degrees between engravings on the dial. */
const STEP = 22;
const angleOf = (i: number) => (i - (MODES.length - 1) / 2) * STEP;

/**
 * The mode switcher, drawn as the top of a knurled camera dial: the modes are
 * engraved around the rim and the dial turns to bring the chosen one under
 * the red index. Semantically it's a plain tab list (arrow keys move).
 */
export default function ModeDial({ mode, onChange }: Props) {
  const index = MODES.findIndex((m) => m.id === mode);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function onKey(e: KeyboardEvent) {
    const d = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    const to = e.key === "Home" ? 0 : e.key === "End" ? MODES.length - 1 : d ? (index + d + MODES.length) % MODES.length : -1;
    if (to < 0) return;
    e.preventDefault();
    onChange(MODES[to].id);
    refs.current[to]?.focus();
  }

  return (
    <nav className="mode-dial" aria-label="Modes">
      <div className="dial-rotor" style={{ transform: `rotate(${-angleOf(index)}deg)` }}>
        {/* On first load the dial body spins in and settles; after that only the rotor turns. */}
        <div className="dial-body">
          <div className="dial-face" aria-hidden="true" />
          <div role="tablist" aria-label="Mode" aria-orientation="horizontal" className="dial-marks" onKeyDown={onKey}>
            {MODES.map((m, i) => (
              <button
                key={m.id}
                ref={(el) => (refs.current[i] = el)}
                type="button"
                role="tab"
                id={`mode-${m.id}`}
                aria-selected={m.id === mode}
                tabIndex={m.id === mode ? 0 : -1}
                className={`dial-mark${m.id === mode ? " dial-mark-on" : ""}`}
                style={{ transform: `rotate(${angleOf(i)}deg)` }}
                onClick={() => onChange(m.id)}
              >
                <span>{m.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
      <span className="dial-index" aria-hidden="true" />
    </nav>
  );
}
