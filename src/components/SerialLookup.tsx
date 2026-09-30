import { useState, type CSSProperties, type ReactNode } from "react";
import { BODIES, LENSES, formatShutter } from "../data/gear";
import { BODY_LIST_RANGE, BODY_SERIALS, BODY_SERIAL_SOURCES, bodyBlock, bodyNotes } from "../data/bodySerials";
import BodyArt from "./gear/BodyArt";
import GearImage from "./gear/GearImage";
import LensArt from "./gear/LensArt";
import Segmented from "./Segmented";
import { LENS_SERIALS, LENS_SERIAL_SOURCES, lensYear, parseSerial } from "../data/lensSerials";
import { langTag, t } from "../i18n";

const fmt = (n: number) => n.toLocaleString(langTag() === "en" ? "en-GB" : langTag());

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
    <section className="panel stage-serial" aria-label={t("sn.aria")}>
      <Segmented
        label={t("sn.on")}
        value={kind}
        onChange={setKind}
        options={[
          { value: "body", label: t("col.kind.a.body") },
          { value: "lens", label: t("col.kind.a.lens") },
        ]}
      />
      <p className="muted small sn-why">{t("sn.why")}</p>
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
          label={t("sn.body.label")}
          placeholder="756 098"
          help={t("sn.body.help")}
          value={text}
          onChange={setText}
        />
      </div>

      <div className="sn-readout" aria-live="polite">
        <YearScale from={1954} to={1975} covered={BODY_COVERED} mark={mark} prompt={t("sn.body.prompt")} />
        <div className="sn-say">
          {text.trim() === "" ? null : serial === null ? (
            <p className="muted">{t("sn.body.digits")}</p>
          ) : block ? (
            <div className="sn-body">
              <p className="sn-model">
                Leica {block.model}
                {block.variant && <span className="sn-variant">{block.variant}</span>}
              </p>
              <p>
                {t("sn.body.numbered", { n: fmt(serial), year: block.year })} {t(`sn.model.${block.model}`)}
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
            <p className="muted">{t("sn.body.before")}</p>
          ) : (
            <p className="muted">
              {serial > BODY_LIST_RANGE.to ? t("sn.body.after") : t("sn.body.illegible")}
            </p>
          )}
        </div>
      </div>

      {rows.length > 0 && (
        <div className="sn-detail">
          <table className="sn-ledger" aria-label={t("sn.body.rows")}>
            <thead>
              <tr>
                <th scope="col">{t("sn.th.model")}</th>
                <th scope="col">{t("sn.th.first")}</th>
                <th scope="col">{t("sn.th.last")}</th>
                <th scope="col">{t("sn.th.year")}</th>
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
                <dt>{t("common.shutter")}</dt>
                <dd>{t("sn.range", { a: formatShutter(body.shutter.slowest), b: formatShutter(body.shutter.fastest) })}</dd>
                {body.rangefinder && (
                  <>
                    <dt>{t("sn.finder")}</dt>
                    <dd>{t("sn.finder.value", { m: body.rangefinder.magnification, frames: body.rangefinder.frameSets.map((f) => f.join("/")).join(", ") })}</dd>
                  </>
                )}
                <dt>{t("sn.meter")}</dt>
                <dd>{body.meter === "none" ? t("sn.meter.none") : t("sn.meter.built")}</dd>
              </dl>
              <button type="button" className="btn btn-red" onClick={() => onUse(body.id)}>
                {t("sn.shootWith", { name: body.name })}
              </button>
            </div>
          )}
        </div>
      )}

      <p className="hint sn-sources">
        {t("sn.body.sources")} <Sources list={BODY_SERIAL_SOURCES} />.
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
    mark = { from: lo, to: hi + 1, at: hitYears.length === 1 ? lo + within! : (lo + hi + 1) / 2, label: hitYears.join(t("col.or")) };
  } else if (answer?.kind === "gap") {
    const { before, after } = answer;
    mark = { from: before.year, to: after.year + 1, at: (before.year + after.year + 1) / 2, label: `${before.year}–${after.year}` };
  }

  return (
    <>
      <div className="sn-entry sn-entry-lens">
        <SerialInput label={t("sn.lens.label")} placeholder="2 254 401" help={t("sn.lens.help")} value={text} onChange={setText} />
        <label className="field sn-field sn-which">
          <span>{t("sn.lens.which")}</span>
          <select value={lensId} onChange={(e) => setLensId(e.target.value)}>
            <option value="">{t("sn.lens.dontKnow")}</option>
            {LENSES.filter((l) => l.mount === "M" || l.mount === "L").map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
          <span className="muted small">{t("sn.lens.whichNote")}</span>
        </label>
      </div>

      <div className="sn-readout" aria-live="polite">
        <YearScale
          from={LENS_FIRST}
          to={LENS_LAST}
          covered={[[LENS_FIRST, LENS_LAST + 1]]}
          mark={mark}
          prompt={t("sn.lens.prompt", { from: LENS_FIRST, to: LENS_LAST })}
        />
        <div className="sn-say">
          {text.trim() === "" ? null : serial === null ? (
            <p className="muted">{t("sn.lens.digits")}</p>
          ) : answer?.kind === "years" ? (
            <p>
              {hitYears.length > 1
                ? t("sn.lens.overlap", { n: fmt(serial), years: hitYears.join(t("col.or")) })
                : t(`sn.lens.in.${within! < 0.34 ? "early" : within! < 0.67 ? "mid" : "late"}`, { n: fmt(serial), year: hit!.year, from: fmt(hit!.from), to: fmt(hit!.to) })}
            </p>
          ) : answer?.kind === "gap" ? (
            <p>
              {t("serial.unknown.gap", { n: fmt(serial), before: answer.before.year, after: answer.after.year })}
            </p>
          ) : answer?.kind === "before" ? (
            <p className="muted">{t("sn.lens.before", { first: LENS_FIRST })}</p>
          ) : answer?.kind === "after" ? (
            <p className="muted">{t("sn.lens.after", { last: LENS_LAST, n: fmt(answer.last.to) })}</p>
          ) : null}
        </div>
      </div>

      {(rows.length > 0 || lens) && (
        <div className="sn-detail">
          {rows.length > 0 && (
            <table className="sn-ledger" aria-label={t("sn.lens.rows")}>
              <thead>
                <tr>
                  <th scope="col">{t("sn.th.year")}</th>
                  <th scope="col">{t("sn.th.first")}</th>
                  <th scope="col">{t("sn.th.last")}</th>
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
                <dt>{t("common.lens")}</dt>
                <dd>{lens.name}</dd>
                <dt>{t("sn.designFrom")}</dt>
                <dd>{lens.year}</dd>
                <dt>{t("common.aperture")}</dt>
                <dd>{t("sn.range", { a: `f/${lens.maxAperture}`, b: `f/${lens.minAperture}` })}</dd>
                {hitYears.length > 0 && (
                  <>
                    <dt>{t("sn.yourNumber")}</dt>
                    <dd className={Math.max(...hitYears) < lens.year ? "warn-text" : undefined}>
                      {Math.max(...hitYears) < lens.year
                        ? t("sn.lens.earlier", { years: hitYears.join("/"), year: lens.year })
                        : t("sn.lens.fits", { years: hitYears.join("/"), year: lens.year })}
                    </dd>
                  </>
                )}
              </dl>
              <button type="button" className="btn btn-red" onClick={() => onUse(lens.id)}>
                {t("sn.shootLens")}
              </button>
            </div>
          )}
        </div>
      )}

      <p className="hint sn-sources">
        {t("sn.lens.sources")} <Sources list={LENS_SERIAL_SOURCES} />.
      </p>
    </>
  );
}
