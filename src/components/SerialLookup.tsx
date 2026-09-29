import { useState, type CSSProperties, type ReactNode } from "react";
import { BODIES, LENSES, formatShutter } from "../data/gear";
import { BODY_LIST_RANGE, BODY_SERIALS, BODY_SERIAL_SOURCES, MODEL_NOTES, bodyBlock, bodyNotes } from "../data/bodySerials";
import BodyArt from "./gear/BodyArt";
import GearImage from "./gear/GearImage";
import LensArt from "./gear/LensArt";
import Segmented from "./Segmented";
import { LENS_SERIALS, LENS_SERIAL_SOURCES, lensYear, parseSerial } from "../data/lensSerials";

const fmt = (n: number) => n.toLocaleString("en-GB");

/**
 * When was my lens made? The serial engraved on the front ring, looked up in
 * the published Leitz/Leica serial tables. The answer lands on a year scale
 * engraved like a lens barrel's distance scale, with the ledger rows around it.
 */
interface Props {
  /** Put a catalogue body (or lens) on the camera. */
  onUseBody: (bodyId: string) => void;
  onUseLens: (lensId: string) => void;
}

export default function SerialLookup(props: Props) {
  const [kind, setKind] = useState<"body" | "lens">("body");
  return (
    <section className="panel stage-serial" aria-label="Serial number lookup">
      <Segmented
        label="What's the number on?"
        value={kind}
        onChange={setKind}
        options={[
          { value: "body", label: "A camera" },
          { value: "lens", label: "A lens" },
        ]}
      />
      <p className="muted small sn-why">Leitz numbered cameras and lenses in separate series, so the same number can be both.</p>
      {kind === "body" ? <BodyLookup onUse={props.onUseBody} /> : <LensLookup onUse={props.onUseLens} />}
    </section>
  );
}

/** Where a number lands on the scale: a band of years [from, to) and the index inside it. */
interface ScaleMark {
  from: number;
  to: number;
  at: number;
  label: string;
}

/**
 * Years engraved like a lens barrel's distance scale. The table's coverage is
 * the bright part of the rule; the index and the year numeral slide to the mark.
 * Decorative: the readout beside it says the same thing in words.
 */
function YearScale({ from, to, covered, mark, prompt }: { from: number; to: number; covered: [number, number][]; mark: ScaleMark | null; prompt: ReactNode }) {
  const span = to + 1 - from;
  const pos = (y: number) => `${((y - from) / span) * 100}%`;
  const step = span <= 30 ? 5 : 10;
  const inCover = (y: number) => covered.some(([a, b]) => y >= a && y < b);
  const years = Array.from({ length: span + 1 }, (_, i) => from + i);
  const p = mark ? Math.min(1, Math.max(0, (mark.at - from) / span)) : 0;

  return (
    <div className="sn-scale">
      <div className="sn-flag-zone">
        {mark ? (
          <p className="sn-flag" style={{ "--p": p } as CSSProperties} aria-hidden="true">
            {mark.label}
          </p>
        ) : (
          <p className="sn-prompt">{prompt}</p>
        )}
      </div>
      <div className="sn-rule" aria-hidden="true">
        {covered.map(([a, b]) => (
          <span key={a} className="sn-cover" style={{ left: pos(a), width: `${((b - a) / span) * 100}%` }} />
        ))}
        {mark && <span className="sn-band" style={{ left: pos(mark.from), width: `${((mark.to - mark.from) / span) * 100}%` }} />}
        {years.map((y) => (
          <span
            key={y}
            className={`sn-tick${y % 10 === 0 ? " sn-tick-10" : y % 5 === 0 ? " sn-tick-5" : ""}${inCover(y) ? "" : " sn-tick-out"}`}
            style={{ left: pos(y) }}
          />
        ))}
        {mark && <span className="sn-index" style={{ left: `${p * 100}%` }} />}
      </div>
      <div className="sn-scale-labels" aria-hidden="true">
        {years
          .filter((y) => y % step === 0 && y <= to)
          .map((y) => (
            <span key={y} style={{ left: pos(y) }}>
              {y}
            </span>
          ))}
      </div>
    </div>
  );
}

/** "1954", "1954/55", "1957/58", "1971–1975" → first and last year. */
function yearSpan(year: string): [number, number] {
  const m = year.match(/^(\d{4})(?:\s*[/–-]\s*(\d{2,4}))?/);
  if (!m) return [NaN, NaN];
  const a = Number(m[1]);
  const b = m[2] ? Number(m[2].length === 2 ? m[1].slice(0, 2) + m[2] : m[2]) : a;
  return [a, b];
}

function Sources({ list }: { list: { label: string; url: string }[] }) {
  return (
    <>
      {list.map((s, i) => (
        <span key={s.url}>
          {i > 0 && "; "}
          <a href={s.url} target="_blank" rel="noreferrer">
            {s.label}
          </a>
        </span>
      ))}
    </>
  );
}

/** The number, typed as it is engraved. */
function SerialInput({ label, placeholder, help, value, onChange }: { label: string; placeholder: string; help: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="field sn-field">
      <span>{label}</span>
      <span className="sn-input">
        <span className="sn-no" aria-hidden="true">
          No.
        </span>
        <input type="text" inputMode="numeric" autoComplete="off" spellCheck={false} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      </span>
      <span className="muted small">{help}</span>
    </label>
  );
}

const BODY_COVERED: [number, number][] = [
  [1954, 1966],
  [1971, 1976],
];

/** A camera body: its model, variant and year from the Leitz list. */
function BodyLookup({ onUse }: { onUse: (id: string) => void }) {
  const [text, setText] = useState("");
  const serial = parseSerial(text);
  const block = serial === null ? null : bodyBlock(serial);
  const idx = block ? BODY_SERIALS.indexOf(block) : -1;
  const rows = idx < 0 ? [] : BODY_SERIALS.slice(Math.max(0, idx - 2), idx + 3);
  const body = block?.bodyId ? BODIES.find((b) => b.id === block.bodyId) : undefined;

  let mark: ScaleMark | null = null;
  if (block && serial !== null) {
    const [a, b] = yearSpan(block.year);
    if (Number.isFinite(a)) {
      const frac = (serial - block.from) / Math.max(1, block.to - block.from);
      mark = { from: a, to: b + 1, at: a + (b + 1 - a) * frac, label: block.year };
    }
  }

  return (
    <>
      <div className="sn-entry">
        <SerialInput
          label="Camera serial number"
          placeholder="756 098"
          help="On the top plate, beside the accessory shoe. Covers 1954–1965 (M3, M2, M1, MD and the last screw-mount models) and the M5."
          value={text}
          onChange={setText}
        />
      </div>

      <div className="sn-readout" aria-live="polite">
        <YearScale from={1954} to={1975} covered={BODY_COVERED} mark={mark} prompt="Type the number and the camera's year lands on this scale." />
        <div className="sn-say">
          {text.trim() === "" ? null : serial === null ? (
            <p className="muted">A camera serial is a number of 4 to 8 digits.</p>
          ) : block ? (
            <div className="sn-body">
              <p className="sn-model">
                Leica {block.model}
                {block.variant && <span className="sn-variant">{block.variant}</span>}
              </p>
              <p>
                No. {fmt(serial)}, numbered in {block.year}. {MODEL_NOTES[block.model]}
              </p>
              {bodyNotes(serial, block).length > 0 && (
                <ul className="sn-notes">
                  {bodyNotes(serial, block).map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              )}
            </div>
          ) : serial < BODY_LIST_RANGE.from ? (
            <p className="muted">Before 700,001: a screw-mount Leica from before 1954. Those numbers aren&apos;t in this table yet.</p>
          ) : (
            <p className="muted">
              {serial > BODY_LIST_RANGE.to ? "After the 1965 list ends, " : "In a stretch the source copy doesn't show legibly, "}and not in the M5 block: this number isn&apos;t in the table, so the
              model isn&apos;t named rather than guessed.
            </p>
          )}
        </div>
      </div>

      {rows.length > 0 && (
        <div className="sn-detail">
          <table className="sn-ledger" aria-label="Serial blocks around that number">
            <thead>
              <tr>
                <th scope="col">Model</th>
                <th scope="col">First number</th>
                <th scope="col">Last number</th>
                <th scope="col">Year</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.from} className={r === block ? "sn-hit" : undefined}>
                  <th scope="row">
                    {r.model}
                    {r.variant && <span className="sn-row-variant">{r.variant}</span>}
                  </th>
                  <td>{fmt(r.from)}</td>
                  <td>{fmt(r.to)}</td>
                  <td>{r.year}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {body && (
            <div className="sn-card">
              <GearImage kind="bodies" id={body.id} alt="" className="sn-art">
                <BodyArt body={body} />
              </GearImage>
              <dl className="gen-specs">
                <dt>Shutter</dt>
                <dd>
                  {formatShutter(body.shutter.slowest)} to {formatShutter(body.shutter.fastest)}
                </dd>
                {body.rangefinder && (
                  <>
                    <dt>Finder</dt>
                    <dd>
                      {body.rangefinder.magnification}×, frames {body.rangefinder.frameSets.map((f) => f.join("/")).join(", ")} mm
                    </dd>
                  </>
                )}
                <dt>Meter</dt>
                <dd>{body.meter === "none" ? "None" : "Built in"}</dd>
              </dl>
              <button type="button" className="btn btn-red" onClick={() => onUse(body.id)}>
                Shoot with an {body.name}
              </button>
            </div>
          )}
        </div>
      )}

      <p className="hint sn-sources">
        The 1954–1965 blocks are transcribed from a scan of a poor photocopy of Leitz&apos;s list; a few digits were hard to read, so check a
        rare variant with a specialist before buying on it. Sources: <Sources list={BODY_SERIAL_SOURCES} />.
      </p>
    </>
  );
}

const LENS_FIRST = LENS_SERIALS[0].year;
const LENS_LAST = LENS_SERIALS[LENS_SERIALS.length - 1].year;

/** A lens: the year from its serial, and, once you say which lens it is, that lens. */
function LensLookup({ onUse }: { onUse: (id: string) => void }) {
  const [text, setText] = useState("");
  const [lensId, setLensId] = useState("");
  const lens = LENSES.find((l) => l.id === lensId);
  const serial = parseSerial(text);
  const answer = serial === null ? null : lensYear(serial);
  const hitYears = answer?.kind === "years" ? answer.ranges.map((r) => r.year) : [];
  const focusYear = hitYears[0] ?? (answer?.kind === "gap" ? answer.before.year : null);
  const idx = focusYear === null ? -1 : LENS_SERIALS.findIndex((r) => r.year === focusYear);
  const rows = idx < 0 ? [] : LENS_SERIALS.slice(Math.max(0, idx - 2), idx + 4);

  const hit = answer?.kind === "years" ? answer.ranges[0] : null;
  // Where the number sits inside that year's allocation: 0 at its first number, 1 at its last.
  const within = hit && serial !== null ? (serial - hit.from) / Math.max(1, hit.to - hit.from) : null;

  let mark: ScaleMark | null = null;
  if (answer?.kind === "years") {
    const lo = Math.min(...hitYears);
    const hi = Math.max(...hitYears);
    mark = { from: lo, to: hi + 1, at: hitYears.length === 1 ? lo + within! : (lo + hi + 1) / 2, label: hitYears.join(" or ") };
  } else if (answer?.kind === "gap") {
    const { before, after } = answer;
    mark = { from: before.year, to: after.year + 1, at: (before.year + after.year + 1) / 2, label: `${before.year}–${after.year}` };
  }

  return (
    <>
      <div className="sn-entry sn-entry-lens">
        <SerialInput label="Lens serial number" placeholder="2 254 401" help="Engraved on the front ring or the barrel. Spaces and commas are fine." value={text} onChange={setText} />
        <label className="field sn-field sn-which">
          <span>Which lens is it? (optional)</span>
          <select value={lensId} onChange={(e) => setLensId(e.target.value)}>
            <option value="">I don&apos;t know</option>
            {LENSES.filter((l) => l.mount === "M" || l.mount === "L").map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
          <span className="muted small">The serial dates the lens but doesn&apos;t say which lens it is: Leitz gave numbers to many lenses in turn.</span>
        </label>
      </div>

      <div className="sn-readout" aria-live="polite">
        <YearScale
          from={LENS_FIRST}
          to={LENS_LAST}
          covered={[[LENS_FIRST, LENS_LAST + 1]]}
          mark={mark}
          prompt={`Type the number and its year, ${LENS_FIRST} to ${LENS_LAST}, lands on this scale.`}
        />
        <div className="sn-say">
          {text.trim() === "" ? null : serial === null ? (
            <p className="muted">A lens serial is a number of 4 to 8 digits.</p>
          ) : answer?.kind === "years" ? (
            <p>
              {hitYears.length > 1
                ? `No. ${fmt(serial)} falls where the published ranges for ${hitYears.join(" and ")} overlap, so either year is possible.`
                : `No. ${fmt(serial)} was numbered in ${hit!.year}, ${within! < 0.34 ? "early" : within! < 0.67 ? "midway" : "late"} in that year's run of ${fmt(hit!.from)} to ${fmt(hit!.to)}.`}
            </p>
          ) : answer?.kind === "gap" ? (
            <p>
              No. {fmt(serial)} falls in a gap between the published ranges for {answer.before.year} and {answer.after.year}.
            </p>
          ) : answer?.kind === "before" ? (
            <p className="muted">That&apos;s earlier than the table ({LENS_FIRST}). Early Leitz lenses were numbered with the cameras; a collector&apos;s reference will know more.</p>
          ) : answer?.kind === "after" ? (
            <p className="muted">That&apos;s after {LENS_LAST} ({fmt(answer.last.to)}), where the published table stops. Leica can tell you the date of a newer lens.</p>
          ) : null}
        </div>
      </div>

      {(rows.length > 0 || lens) && (
        <div className="sn-detail">
          {rows.length > 0 && (
            <table className="sn-ledger" aria-label="Lens serial numbers around that year">
              <thead>
                <tr>
                  <th scope="col">Year</th>
                  <th scope="col">First number</th>
                  <th scope="col">Last number</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.year} className={hitYears.includes(r.year) ? "sn-hit" : undefined}>
                    <th scope="row">{r.year}</th>
                    <td>{fmt(r.from)}</td>
                    <td>{fmt(r.to)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {lens && (
            <div className="sn-card">
              <GearImage kind="lenses" id={lens.id} alt="" className="sn-art">
                <LensArt lens={lens} />
              </GearImage>
              <dl className="gen-specs">
                <dt>Lens</dt>
                <dd>{lens.name}</dd>
                <dt>Design from</dt>
                <dd>{lens.year}</dd>
                <dt>Aperture</dt>
                <dd>
                  f/{lens.maxAperture} to f/{lens.minAperture}
                </dd>
                {hitYears.length > 0 && (
                  <>
                    <dt>Your number</dt>
                    <dd className={Math.max(...hitYears) < lens.year ? "warn-text" : undefined}>
                      {Math.max(...hitYears) < lens.year
                        ? `Numbered ${hitYears.join("/")}, before this design came out in ${lens.year}: probably an earlier version of the lens.`
                        : `Numbered ${hitYears.join("/")}, which fits this design (${lens.year} on).`}
                    </dd>
                  </>
                )}
              </dl>
              <button type="button" className="btn btn-red" onClick={() => onUse(lens.id)}>
                Shoot with this lens
              </button>
            </div>
          )}
        </div>
      )}

      <p className="hint sn-sources">
        Lenses only: camera bodies have their own numbering. The year is when the number was allocated, which is usually, not always, the year
        the lens was made. Tables: <Sources list={LENS_SERIAL_SOURCES} />.
      </p>
    </>
  );
}
