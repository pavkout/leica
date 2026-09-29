import { useState } from "react";
import { playMountClick } from "../audio/sounds";
import { BODIES, LENSES, findBody, type Body, type Lens } from "../data/gear";
import { compatibility, type Verdict } from "../physics/compatibility";

interface Props {
  body: Body;
  lens: Lens;
  onUse: (bodyId: string, lensId: string) => void;
}

const VERDICT: Record<Verdict, string> = {
  fits: "Fits",
  adapter: "Fits with an adapter",
  limited: "Fits, with care",
  no: "Doesn't fit",
};

/**
 * Will this lens work on that camera? The verdict as a lens meeting the mount
 * (turning home, or stopping short), then what to know: adapter, frame lines,
 * rangefinder coupling and Leica's published warnings, each with its source.
 */
export default function Compatibility({ body, lens, onUse }: Props) {
  const [bodyId, setBodyId] = useState(body.id);
  const [lensId, setLensId] = useState(lens.id);
  const b = findBody(bodyId);
  const l = LENSES.find((x) => x.id === lensId) ?? lens;
  const c = compatibility(b, l);
  const byMount = [...new Set(LENSES.map((x) => x.mount))];

  return (
    <section className="panel stage-compat" aria-label="Compatibility">
      <div className="cp-pick">
        <label className="field">
          <span>Camera</span>
          <select value={bodyId} onChange={(e) => setBodyId(e.target.value)}>
            {BODIES.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Lens</span>
          <select
            value={lensId}
            onChange={(e) => {
              setLensId(e.target.value);
              playMountClick();
            }}
          >
            {byMount.map((m) => (
              <optgroup key={m} label={m === "fixed" ? "Built-in lenses" : `${m} mount`}>
                {LENSES.filter((x) => x.mount === m).map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
      </div>

      <div className="cp-result">
        {/* The mount, seen from the side: the lens slides in and turns home, or stops short. Keyed so it replays on each choice. */}
        <svg key={`${bodyId}-${lensId}`} className={`cp-mount cp-mount-${c.verdict}`} viewBox="0 0 240 120" aria-hidden="true">
          <rect x="150" y="10" width="80" height="100" rx="6" className="cp-body" />
          <rect x="140" y="30" width="12" height="60" className="cp-flange" />
          <g className="cp-lens">
            <rect x="40" y="34" width="96" height="52" rx="3" className="cp-barrel" />
            <rect x="136" y="40" width="8" height="40" className="cp-rear" />
            {c.verdict === "adapter" && <rect x="130" y="36" width="10" height="48" className="cp-adapter" />}
          </g>
        </svg>
        <div>
          <p className={`cp-verdict cp-verdict-${c.verdict}`}>{VERDICT[c.verdict]}</p>
          <p className="muted">
            {l.name} on the {b.name}
          </p>
          {c.verdict !== "no" && (
            <button type="button" className="btn btn-small cp-use" onClick={() => onUse(b.id, l.id)}>
              Put this pair on the camera
            </button>
          )}
        </div>
      </div>

      <ul className="cp-notes">
        {c.notes.map((n) => (
          <li key={n.title} className={`cp-note cp-note-${n.level}`}>
            <p className="cp-note-title">{n.title}</p>
            <p className="cp-note-detail">{n.detail}</p>
            {n.source && (
              <p className="cp-source">
                Source:{" "}
                {n.source.url ? (
                  <a href={n.source.url} target="_blank" rel="noreferrer">
                    {n.source.label}
                  </a>
                ) : (
                  n.source.label
                )}
              </p>
            )}
          </li>
        ))}
      </ul>

      <h3 className="cp-h">The {l.name} on every body</h3>
      <ul className="cp-matrix">
        {BODIES.map((x) => {
          const v = compatibility(x, l).verdict;
          return (
            <li key={x.id}>
              <button type="button" className={`cp-cell cp-cell-${v}${x.id === bodyId ? " cp-cell-on" : ""}`} onClick={() => setBodyId(x.id)} aria-label={`${x.name}: ${VERDICT[v]}`}>
                <span className="cp-cell-name">{x.name}</span>
                <span className="cp-cell-v">{VERDICT[v]}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="hint">
        Mounts, adapters and frame lines from the catalogue&apos;s published specifications; lens warnings from Leica&apos;s instruction manuals, linked
        on each. When in doubt about a specific example, ask Leica Customer Care.
      </p>
    </section>
  );
}
