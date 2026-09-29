import { useState } from "react";
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
 * the published Leitz/Leica lens-serial tables, shown as a page in a ledger:
 * the year's row with the rows around it.
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

/** A camera body: its model, variant and year from the Leitz list. */
function BodyLookup({ onUse }: { onUse: (id: string) => void }) {
  const [text, setText] = useState("");
  const serial = parseSerial(text);
  const block = serial === null ? null : bodyBlock(serial);
  const idx = block ? BODY_SERIALS.indexOf(block) : -1;
  const rows = idx < 0 ? [] : BODY_SERIALS.slice(Math.max(0, idx - 2), idx + 3);
  const body = block?.bodyId ? BODIES.find((b) => b.id === block.bodyId) : undefined;

  return (
    <>
      <div className="sn-top">
        <label className="field sn-field">
          <span>Camera serial number</span>
          <span className="sn-input">
            <span className="sn-no" aria-hidden="true">
              No.
            </span>
            <input type="text" inputMode="numeric" value={text} placeholder="756 098" onChange={(e) => setText(e.target.value)} />
          </span>
          <span className="muted small">On the top plate, beside the accessory shoe. Covers 1954–1965 (M3, M2, M1, MD and the last screw-mount models) and the M5.</span>
        </label>

        <div className="sn-result" aria-live="polite">
          {text.trim() === "" ? (
            <p className="sn-empty">The camera will appear here.</p>
          ) : serial === null ? (
            <p className="muted">A camera serial is a number of 4 to 8 digits.</p>
          ) : block ? (
            <div className="sn-body">
              <p className="sn-label">{block.year}</p>
              <p className="sn-model">Leica {block.model}</p>
              {block.variant && <p className="sn-variant">{block.variant[0].toUpperCase() + block.variant.slice(1)}</p>}
              <p className="muted">{MODEL_NOTES[block.model]}</p>
              <ul className="sn-notes">
                {bodyNotes(serial, block).map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
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

      {block && body && (
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
                  {body.rangefinder.magnification}× · frames {body.rangefinder.frameSets.map((f) => f.join("/")).join(", ")} mm
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

      {rows.length > 0 && (
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
                  {r.variant && <span className="sn-row-variant"> · {r.variant}</span>}
                </th>
                <td>{fmt(r.from)}</td>
                <td>{fmt(r.to)}</td>
                <td>{r.year}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <p className="hint">
        The 1954–1965 blocks are transcribed from a scan of a poor photocopy of Leitz&apos;s list; a few digits were hard to read, so check a
        rare variant with a specialist before buying on it. Sources:{" "}
        {BODY_SERIAL_SOURCES.map((s, i) => (
          <span key={s.url}>
            {i > 0 && "; "}
            <a href={s.url} target="_blank" rel="noreferrer">
              {s.label}
            </a>
          </span>
        ))}
        .
      </p>
    </>
  );
}

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

  return (
    <>
      <div className="sn-top">
        <label className="field sn-field">
          <span>Lens serial number</span>
          <span className="sn-input">
            <span className="sn-no" aria-hidden="true">
              No.
            </span>
            <input type="text" inputMode="numeric" value={text} placeholder="2 254 401" onChange={(e) => setText(e.target.value)} />
          </span>
          <span className="muted small">Engraved on the front ring or the barrel. Spaces and commas are fine.</span>
        </label>
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
          <span className="muted small">A lens serial dates the lens but doesn&apos;t say which lens it is: Leitz gave numbers to many lenses in turn.</span>
        </label>

        <div className="sn-result" aria-live="polite">
          {text.trim() === "" ? (
            <p className="sn-empty">A year from 1933 to 2011 will appear here.</p>
          ) : serial === null ? (
            <p className="muted">A lens serial is a number of 4 to 8 digits.</p>
          ) : answer?.kind === "years" ? (
            <>
              <p className="sn-label">Numbered in</p>
              <p className="sn-year">{hitYears.join(" or ")}</p>
              {within !== null && hitYears.length === 1 && (
                <div className="sn-within" aria-label={`${Math.round(within * 100)}% of the way through ${hit!.year}'s numbers`}>
                  <span className="sn-within-bar">
                    <i style={{ left: `${within * 100}%` }} />
                  </span>
                  <span className="sn-within-ends">
                    <span>{fmt(hit!.from)}</span>
                    <span>{fmt(hit!.to)}</span>
                  </span>
                </div>
              )}
              <p className="muted">
                {hitYears.length > 1
                  ? `No. ${fmt(serial)} falls where the published ranges for ${hitYears.join(" and ")} overlap, so either year is possible.`
                  : `No. ${fmt(serial)} is ${within! < 0.34 ? "early" : within! < 0.67 ? "midway" : "late"} in ${hit!.year}'s numbers.`}
              </p>
            </>
          ) : answer?.kind === "gap" ? (
            <>
              <p className="sn-label">Between</p>
              <p className="sn-year">
                {answer.before.year}–{answer.after.year}
              </p>
              <p className="muted">
                No. {fmt(serial)} falls in a gap between the published ranges for {answer.before.year} and {answer.after.year}.
              </p>
            </>
          ) : answer?.kind === "before" ? (
            <p className="muted">That&apos;s earlier than the table (1933). Early Leitz lenses were numbered with the cameras; a collector&apos;s reference will know more.</p>
          ) : answer?.kind === "after" ? (
            <p className="muted">That&apos;s after 2011 ({fmt(answer.last.to)}), where the published table stops. Leica can tell you the date of a newer lens.</p>
          ) : null}
        </div>
      </div>

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

      <p className="hint">
        Lenses only: camera bodies have their own numbering. The year is when the number was allocated, which is usually, not always, the year
        the lens was made. Tables:{" "}
        {LENS_SERIAL_SOURCES.map((s, i) => (
          <span key={s.url}>
            {i > 0 && "; "}
            <a href={s.url} target="_blank" rel="noreferrer">
              {s.label}
            </a>
          </span>
        ))}
        .
      </p>
    </>
  );
}
