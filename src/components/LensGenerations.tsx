import { useState } from "react";
import { isAdapted, type Body, type Lens } from "../data/gear";
import { LENS_FAMILIES, familyOf, findByAlias, lensOf, type LensFamily, type LensRevision } from "../data/lensFamilies";
import { LENS_CHARACTER_PROFILES } from "../physics/lensCharacter";
import { blurDiscMm } from "../physics/optics";
import { formatDistance, type Units } from "../utils/format";
import Segmented from "./Segmented";

interface Props {
  body: Body;
  lens: Lens;
  cocMm: number;
  /** Subject distance to start the comparison at (the simulator's focus). */
  focusMm: number;
  units: Units;
  /** Put a revision into the simulator (only offered when it fits the body). */
  onTry: (lensId: string) => void;
}

type Lock = "position" | "composition";

function fit(body: Body, lens: Lens): "native" | "adapted" | "no" {
  if (body.fixedLensId) return body.fixedLensId === lens.id ? "native" : "no";
  if (body.mounts.includes(lens.mount)) return "native";
  return isAdapted(body, lens) ? "adapted" : "no";
}

const fstop = (n: number) => `f/${n}`;

/** Lens generations / collector mode (feature #24): families vs revisions, from the catalogue only. */
export default function LensGenerations({ body, lens, cocMm, focusMm, units, onTry }: Props) {
  const [familyId, setFamilyId] = useState(() => (familyOf(lens.id) ?? LENS_FAMILIES[0]).lensFamilyId);
  const family = LENS_FAMILIES.find((f) => f.lensFamilyId === familyId) as LensFamily;
  const first = family.revisions[0];
  const last = family.revisions[family.revisions.length - 1];
  const [pair, setPair] = useState<[string, string]>(() => [first.revisionId, last.revisionId]);
  const [lock, setLock] = useState<Lock>("position");
  const [distanceMm, setDistanceMm] = useState(() => (Number.isFinite(focusMm) ? Math.min(Math.max(focusMm, 450), 10000) : 2000));
  const [query, setQuery] = useState("");
  const fmt = (mm: number) => formatDistance(mm, units);

  function chooseFamily(f: LensFamily, revisionId?: string) {
    setFamilyId(f.lensFamilyId);
    const a = f.revisions[0].revisionId;
    const b = f.revisions[f.revisions.length - 1].revisionId;
    // A found revision always takes part: against the oldest, or (if it is the oldest) against the newest.
    setPair(!revisionId || revisionId === a ? [a, b] : [a, revisionId]);
  }

  const found = query.trim() ? findByAlias(query) : undefined;
  const byId = (id: string) => family.revisions.find((r) => r.revisionId === id) ?? first;
  const compared = [byId(pair[0]), byId(pair[1])];
  const years = family.revisions.map((r) => lensOf(r).year);

  return (
    <section className="panel stage-generations" aria-label="Lens generations">
      <div className="panel-head">
        <h2>Lens generations</h2>
      </div>
      <p className="muted small">
        A family shares a name and focal length; each revision is its own optical design with its own specs. Everything below comes from the
        lens catalogue.
      </p>

      <div className="gen-pick">
        <label className="field">
          <span>Family</span>
          <select value={familyId} onChange={(e) => chooseFamily(LENS_FAMILIES.find((f) => f.lensFamilyId === e.target.value) as LensFamily)}>
            {LENS_FAMILIES.map((f) => (
              <option key={f.lensFamilyId} value={f.lensFamilyId}>
                {f.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Find by name or nickname</span>
          <input type="search" value={query} placeholder="e.g. King of bokeh" onChange={(e) => setQuery(e.target.value)} />
        </label>
      </div>
      {query.trim() && (
        <p className="small gen-found" role="status">
          {found ? (
            <>
              {found.revision ? `${lensOf(found.revision).name} — ${found.family.name}` : found.family.name}{" "}
              <button type="button" className="btn btn-small" onClick={() => { chooseFamily(found.family, found.revision?.revisionId); setQuery(""); }}>
                Show
              </button>
            </>
          ) : (
            "No family or revision by that name in the catalogue."
          )}
        </p>
      )}
      {!familyOf(lens.id) && <p className="muted small">Your current lens ({lens.name}) isn't part of a tracked family.</p>}

      <h3 className="gen-family-name">
        {family.name} <span className="muted small">· {Math.min(...years)}–{Math.max(...years)} · {family.revisions.length} revisions</span>
      </h3>
      {family.aliases.length > 0 && <p className="muted small">Also called: {family.aliases.join(", ")}</p>}

      <ol className="gen-list">
        {family.revisions.map((r) => (
          <RevisionRow key={r.revisionId} revision={r} body={body} current={r.lensId === lens.id} units={units} onTry={onTry} />
        ))}
      </ol>

      <h3>Compare two revisions</h3>
      <div className="gen-pick">
        {[0, 1].map((i) => (
          <label className="field" key={i}>
            <span>Revision {i === 0 ? "A" : "B"}</span>
            <select
              value={pair[i]}
              onChange={(e) => setPair((p) => (i === 0 ? [e.target.value, p[1]] : [p[0], e.target.value]))}
            >
              {family.revisions.map((r) => (
                <option key={r.revisionId} value={r.revisionId}>
                  {r.label} ({lensOf(r).year})
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <Segmented
        label="Lock photographer position or composition"
        value={lock}
        onChange={setLock}
        options={[
          { value: "position", label: "Position" },
          { value: "composition", label: "Composition" },
        ]}
      />
      <label className="field">
        <span>Subject distance · {fmt(distanceMm)}</span>
        <input type="range" min={450} max={10000} step={50} value={distanceMm} onChange={(e) => setDistanceMm(Number(e.target.value))} />
      </label>
      <p className="muted small">
        {lock === "position"
          ? `Both from the same spot, ${fmt(distanceMm)} from the subject, each wide open.`
          : `Same framing of the subject, each wide open. Revisions share the ${lensOf(first).focalMm} mm focal length, so the same framing means standing at the same ${fmt(distanceMm)}.`}
      </p>
      <table className="gen-compare">
        <thead>
          <tr>
            <th scope="col"></th>
            {compared.map((r, i) => (
              <th scope="col" key={i}>
                {i === 0 ? "A" : "B"} · {r.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">Launched</th>
            {compared.map((r, i) => <td key={i}>{lensOf(r).year}</td>)}
          </tr>
          <tr>
            <th scope="row">Widest aperture</th>
            {compared.map((r, i) => <td key={i}>{fstop(lensOf(r).maxAperture)}</td>)}
          </tr>
          <tr>
            <th scope="row">Focuses at {fmt(distanceMm)}</th>
            {compared.map((r, i) => {
              const l = lensOf(r);
              return <td key={i}>{distanceMm >= l.minFocusMm ? "Yes" : `No — closest ${fmt(l.minFocusMm)}`}</td>;
            })}
          </tr>
          <tr>
            <th scope="row">Background blur (∞), wide open</th>
            {compared.map((r, i) => {
              const l = lensOf(r);
              const d = Math.max(distanceMm, l.minFocusMm);
              const ratio = blurDiscMm(l.focalMm, l.maxAperture, d, Infinity) / cocMm;
              return (
                <td key={i}>
                  {ratio.toFixed(0)}× sharpness limit{d > distanceMm ? ` (at ${fmt(d)})` : ""}
                </td>
              );
            })}
          </tr>
        </tbody>
      </table>
      <p className="muted small">Background blur is calculated from focal length, aperture and distance; it doesn't model how each design renders out-of-focus areas.</p>
      <p className="muted small">
        Collector badges are informational only — this app doesn't estimate prices or investment value.
      </p>
    </section>
  );
}

function RevisionRow({ revision, body, current, units, onTry }: { revision: LensRevision; body: Body; current: boolean; units: Units; onTry: (id: string) => void }) {
  const l = lensOf(revision);
  const f = fit(body, l);
  const notes = LENS_CHARACTER_PROFILES[l.id]?.notes ?? [];
  return (
    <li className={`gen-row${current ? " gen-row-on" : ""}`}>
      <div className="gen-row-head">
        <strong className="gen-name">
          {revision.label} <span className="muted">· {l.year}</span>
        </strong>
        {l.classic && (
          <span className="gen-badge" title="From the catalogue: no longer made. Informational, not a value estimate.">
            Classic · collector
          </span>
        )}
        {current ? (
          <span className="gen-badge gen-badge-on">On camera</span>
        ) : (
          f !== "no" && (
            <button type="button" className="btn btn-small" onClick={() => onTry(l.id)}>
              Try
            </button>
          )
        )}
      </div>
      <p className="small">{l.name}</p>
      <dl className="gen-specs small">
        <dt>Aperture</dt>
        <dd>
          {fstop(l.maxAperture)}–{l.minAperture}
        </dd>
        <dt>Closest focus</dt>
        <dd>{formatDistance(l.minFocusMm, units)}</dd>
        <dt>Blades</dt>
        <dd>{l.apertureBlades ? `${l.apertureBlades} (${l.apertureBladesProvenance?.kind ?? "unsourced"})` : "not in the catalogue"}</dd>
        <dt>Filter size</dt>
        <dd>not in the catalogue</dd>
        <dt>Fits the {body.name}</dt>
        <dd>{f === "native" ? "Yes" : f === "adapted" ? "Through an adapter" : "No"}</dd>
        {l.nickname && (
          <>
            <dt>Known as</dt>
            <dd>{l.nickname}</dd>
          </>
        )}
      </dl>
      <p className="muted small">
        {notes.length
          ? notes.map((n) => `${n.text} (${n.provenance}: ${n.source})`).join(" ")
          : "Rendering notes: none sourced yet."}
      </p>
    </li>
  );
}
