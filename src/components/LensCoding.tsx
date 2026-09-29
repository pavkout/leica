import { useState } from "react";
import { playDialClick } from "../audio/sounds";
import type { Lens } from "../data/gear";
import { LENS_CODES, LENS_CODE_SOURCES, RETROFIT_SOURCE, codeForLensName, codeNumber, decode, retrofittable } from "../data/lensCodes";
import Segmented from "./Segmented";

interface Props {
  lens: Lens;
}

/** The six fields on the bayonet flange, drawn as an arc at 12 o'clock; tappable when reading a code. */
function Flange({ bits, onToggle }: { bits: string; onToggle?: (i: number) => void }) {
  const C = 160;
  const R = 130;
  const fields = bits.split("");
  // Six fields spread over about 50° either side of 12 o'clock, first field on the left (read clockwise).
  const start = -Math.PI / 2 - 0.42;
  const step = 0.168;
  return (
    <svg viewBox="0 -28 320 208" className="lc-flange" role={onToggle ? "group" : "img"} aria-label={onToggle ? "Tap the fields to match your lens" : `Code ${bits}`}>
      <path d={`M${C - 150} ${C + 10} A150 150 0 0 1 ${C + 150} ${C + 10}`} className="lc-ring" />
      <path d={`M${C - 108} ${C + 10} A108 108 0 0 1 ${C + 108} ${C + 10}`} className="lc-ring-inner" />
      {fields.map((b, i) => {
        const a0 = start + i * step;
        const a1 = a0 + step * 0.78;
        const p = (a: number, r: number) => `${C + r * Math.cos(a)} ${C + r * Math.sin(a)}`;
        const d = `M${p(a0, R - 14)} L${p(a0, R + 12)} A${R + 12} ${R + 12} 0 0 1 ${p(a1, R + 12)} L${p(a1, R - 14)} A${R - 14} ${R - 14} 0 0 0 ${p(a0, R - 14)} Z`;
        const label = `Field ${i + 1}: ${b === "1" ? "black" : "white"}`;
        return onToggle ? (
          <path key={i} d={d} className={`lc-field lc-field-${b} lc-field-tap`} role="switch" aria-checked={b === "1"} aria-label={label} tabIndex={0} onClick={() => onToggle(i)} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onToggle(i))} />
        ) : (
          <path key={i} d={d} className={`lc-field lc-field-${b}`} aria-label={label} />
        );
      })}
      <text x={C} y={C - R - 30} className="lc-note" textAnchor="middle">
        12 o&apos;clock · read clockwise →
      </text>
    </svg>
  );
}

/**
 * Leica's 6-bit lens coding: look up the dots for a lens, or tap in the dots
 * on a lens in your hand to identify it. Says whether Leica lists the lens for
 * retrofitting, and what to do on the camera when a lens has no code.
 */
export default function LensCoding({ lens }: Props) {
  const own = codeForLensName(lens.name);
  const [mode, setMode] = useState<"lookup" | "read">("lookup");
  const [pick, setPick] = useState(own?.bits ?? LENS_CODES[0].bits);
  const [bits, setBits] = useState("000000");
  const entry = LENS_CODES.find((c) => c.bits === pick)!;
  const found = decode(bits);
  const focals = [...new Set(LENS_CODES.map((c) => c.focalMm))];

  return (
    <section className="panel stage-coding" aria-label="Lens coding">
      <Segmented
        label="Mode"
        value={mode}
        onChange={setMode}
        options={[
          { value: "lookup", label: "Look up a lens" },
          { value: "read", label: "Read a lens in your hand" },
        ]}
      />

      {mode === "lookup" ? (
        <div className="lc-grid">
          <div>
            <label className="field">
              <span>Lens</span>
              <select value={pick} onChange={(e) => setPick(e.target.value)}>
                {focals.map((f) => (
                  <optgroup key={f} label={`${f} mm`}>
                    {LENS_CODES.filter((c) => c.focalMm === f).map((c) => (
                      <option key={c.bits} value={c.bits}>
                        {c.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
            {own ? <p className="muted small">The {lens.name} on your camera is preselected.</p> : <p className="muted small">The {lens.name} isn&apos;t in the code tables by that exact name.</p>}
          </div>
          <div className="lc-show">
            <Flange bits={entry.bits} />
            <p className="lc-code">
              <span>{entry.bits}</span>
              <span>code {codeNumber(entry.bits)}</span>
            </p>
            <p className="muted small">Order numbers {entry.orders.join(", ")}</p>
            <p className={retrofittable(entry) ? "lc-retro" : "muted small"}>
              {retrofittable(entry) ? "On Leica's retrofit list: an authorised dealer or Customer Care can add the code." : "Not on Leica's 2015 retrofit list (coded from the factory, or not offered)."}
            </p>
          </div>
        </div>
      ) : (
        <div className="lc-grid">
          <div>
            <p>Hold the lens with the six painted fields on its bayonet at 12 o&apos;clock. Tap each field here to match it: black or white.</p>
            <button type="button" className="btn btn-small" onClick={() => setBits("000000")}>
              Clear
            </button>
          </div>
          <div className="lc-show">
            <Flange
              bits={bits}
              onToggle={(i) => {
                playDialClick();
                setBits((b) => b.slice(0, i) + (b[i] === "1" ? "0" : "1") + b.slice(i + 1));
              }}
            />
            <p className="lc-code">
              <span>{bits}</span>
              <span>code {codeNumber(bits)}</span>
            </p>
            {bits === "000000" ? (
              <p className="muted">All white: no code, or not read yet.</p>
            ) : found.length ? (
              <p className="lc-found">{found.map((c) => c.name).join(" or ")}</p>
            ) : (
              <p className="muted">No lens in the tables has this code. Check the order you read the fields in.</p>
            )}
          </div>
        </div>
      )}

      <div className="lc-uncoded">
        <h3>A lens without a code</h3>
        <p className="muted">
          A digital M can&apos;t tell which uncoded lens is fitted. Pick it by hand in the camera&apos;s lens-detection menu (switch detection to
          manual and choose the lens), or pick the closest one listed for the focal length, so vignetting and colour corrections and the EXIF
          lens name are right.
        </p>
      </div>

      <p className="hint">
        Codes from community-compiled tables, which two published copies agree on:{" "}
        {LENS_CODE_SOURCES.map((s, i) => (
          <span key={s.url}>
            {i > 0 && ", "}
            <a href={s.url} target="_blank" rel="noreferrer">
              {s.label}
            </a>
          </span>
        ))}
        . Retrofit list:{" "}
        <a href={RETROFIT_SOURCE.url} target="_blank" rel="noreferrer">
          {RETROFIT_SOURCE.label}
        </a>
        . Check a code with Leica before painting it on a lens.
      </p>
    </section>
  );
}
