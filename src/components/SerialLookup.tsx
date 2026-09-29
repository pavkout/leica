import { useState } from "react";
import { LENS_SERIALS, LENS_SERIAL_SOURCES, lensYear, parseSerial } from "../data/lensSerials";

const fmt = (n: number) => n.toLocaleString("en-GB");

/**
 * When was my lens made? The serial engraved on the front ring, looked up in
 * the published Leitz/Leica lens-serial tables, shown as a page in a ledger:
 * the year's row with the rows around it.
 */
export default function SerialLookup() {
  const [text, setText] = useState("");
  const serial = parseSerial(text);
  const answer = serial === null ? null : lensYear(serial);
  const hitYears = answer?.kind === "years" ? answer.ranges.map((r) => r.year) : [];
  const focusYear = hitYears[0] ?? (answer?.kind === "gap" ? answer.before.year : null);
  const idx = focusYear === null ? -1 : LENS_SERIALS.findIndex((r) => r.year === focusYear);
  const rows = idx < 0 ? [] : LENS_SERIALS.slice(Math.max(0, idx - 2), idx + 4);

  return (
    <section className="panel stage-serial" aria-label="Serial number lookup">
      <label className="field sn-field">
        <span>Lens serial number, as engraved on the front ring or barrel</span>
        <input type="text" inputMode="numeric" value={text} placeholder="e.g. 2 254 401" onChange={(e) => setText(e.target.value)} />
      </label>

      <div className="sn-result" aria-live="polite">
        {text.trim() === "" ? (
          <p className="muted">Type the number (spaces and commas are fine). Lens serials from 1933 to 2011 are covered.</p>
        ) : serial === null ? (
          <p className="muted">A lens serial is a number of 4 to 8 digits.</p>
        ) : answer?.kind === "years" ? (
          <>
            <p className="sn-year">{hitYears.join(" or ")}</p>
            <p className="muted">
              No. {fmt(serial)} falls in the {hitYears.length > 1 ? "overlapping published ranges" : "published range"} for {hitYears.join(" and ")}.
              {hitYears.length > 1 && " The published tables overlap here, so either year is possible."}
            </p>
          </>
        ) : answer?.kind === "gap" ? (
          <>
            <p className="sn-year">
              {answer.before.year}–{answer.after.year}
            </p>
            <p className="muted">
              No. {fmt(serial)} falls in a gap between the published ranges for {answer.before.year} and {answer.after.year}.
            </p>
          </>
        ) : answer?.kind === "before" ? (
          <p className="muted">That's earlier than the table (1933). Early Leitz lenses were numbered with the cameras; a collector's reference will know more.</p>
        ) : answer?.kind === "after" ? (
          <p className="muted">That's after 2011 ({fmt(answer.last.to)}), where the published table stops. Leica can tell you the date of a newer lens.</p>
        ) : null}
      </div>

      {rows.length > 0 && (
        <table className="sn-ledger" aria-label="Lens serial numbers around that year">
          <thead>
            <tr>
              <th scope="col">Year</th>
              <th scope="col">From</th>
              <th scope="col">To</th>
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
    </section>
  );
}
