import { useMemo, useState } from "react";
import BokehPreview, { type PreviewSide } from "./components/BokehPreview";
import LensBarrel from "./components/LensBarrel";
import Readouts, { Details } from "./components/Readouts";
import SceneDiagram from "./components/SceneDiagram";
import Viewfinder from "./components/Viewfinder";
import Segmented from "./components/Segmented";
import {
  BODIES,
  DEFAULT_BODY_ID,
  DEFAULT_LENS_ID,
  apertureStops,
  findBody,
  findLens,
  isAdapted,
  lensesForBody,
  nearestStop,
  type Body,
  type Lens,
} from "./data/gear";
import { SHARPNESS_STANDARDS, computeShot, type SharpnessStandard, type Shot } from "./physics/model";
import { GENERIC_BLADES, apertureShape } from "./preview/aperture";
import { formatDistance, formatFNumber, formatLength, type Units } from "./utils/format";

const BACKGROUND_PRESETS: Record<Units, { mm: number; label: string }[]> = {
  metric: [
    { mm: 500, label: "+0.5 m" },
    { mm: 2000, label: "+2 m" },
    { mm: 10_000, label: "+10 m" },
    { mm: Infinity, label: "∞" },
  ],
  imperial: [
    { mm: 609.6, label: "+2′" },
    { mm: 1828.8, label: "+6′" },
    { mm: 9144, label: "+30′" },
    { mm: Infinity, label: "∞" },
  ],
};

function previewSide(lens: Lens, shot: Shot): PreviewSide {
  return {
    label: lens.name.replace(/ ASPH\.$/, ""),
    params: {
      focalMm: shot.focalMm,
      fNumber: shot.fNumber,
      focusMm: shot.focusMm,
      subjectMm: shot.subjectMm,
      backgroundMm: shot.backgroundMm,
      frameWidthMm: shot.frameWidthMm,
      horizontalAngleDeg: shot.horizontalAngle,
      shape: apertureShape(lens, shot.fNumber),
    },
  };
}

/** A second lens worth comparing against: same focal length if possible. */
function defaultComparisonLens(lenses: Lens[], current: Lens) {
  const others = lenses.filter((l) => l.id !== current.id);
  return others.find((l) => l.focalMm === current.focalMm) ?? others[0] ?? current;
}

/** M bodies: the ones with a coupled rangefinder. */
function isRangefinder(body: Body) {
  return body.mounts.includes("M") && !body.fixedLensId;
}

function LensOptions({ body, lenses }: { body: Body; lenses: Lens[] }) {
  const native = lenses.filter((l) => !isAdapted(body, l));
  const adapted = lenses.filter((l) => isAdapted(body, l));
  if (!adapted.length) return <>{lenses.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</>;
  return (
    <>
      <optgroup label="Native">
        {native.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
      </optgroup>
      <optgroup label="M lenses via adapter">
        {adapted.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
      </optgroup>
    </>
  );
}

export default function App() {
  const [bodyId, setBodyId] = useState(DEFAULT_BODY_ID);
  const [lensId, setLensId] = useState(DEFAULT_LENS_ID);
  // Opens on a portrait wide open against the street, where the preview shows most.
  const [fNumber, setFNumber] = useState(findLens(DEFAULT_LENS_ID).maxAperture);
  const [focusMm, setFocusMm] = useState(2000);
  const [backgroundOffsetMm, setBackgroundOffsetMm] = useState(Infinity);
  const [megapixels, setMegapixels] = useState<number | null>(60);
  const [cropFocalMm, setCropFocalMm] = useState<number | null>(null);
  const [standard, setStandard] = useState<SharpnessStandard>("engraved");
  const [units, setUnits] = useState<Units>("metric");
  const [compare, setCompare] = useState(false);
  const [lensBId, setLensBId] = useState("m-50-0.95");
  const [fNumberB, setFNumberB] = useState(1.4);
  // Focus challenge: the subject stands at a hidden distance instead of at the focus.
  const [challenge, setChallenge] = useState<{ subjectMm: number; shotTaken: boolean } | null>(null);

  const body = findBody(bodyId);
  const lens = findLens(lensId);
  const lenses = lensesForBody(body);
  const stops = useMemo(() => apertureStops(lens), [lens]);

  const shot = computeShot({
    body,
    lens,
    fNumber,
    focusMm,
    subjectMm: challenge?.subjectMm,
    backgroundOffsetMm,
    megapixels,
    cropFocalMm,
    standard,
  });

  // Comparison lens: same body, focus and background as A.
  const lensB = lenses.find((l) => l.id === lensBId) ?? defaultComparisonLens(lenses, lens);
  const stopsB = apertureStops(lensB);
  const shotB = computeShot({
    body,
    lens: lensB,
    fNumber: nearestStop(stopsB, fNumberB),
    focusMm: Math.max(focusMm, lensB.minFocusMm),
    subjectMm: shot.subjectMm,
    backgroundOffsetMm,
    megapixels,
    cropFocalMm: cropFocalMm && lensB.id === lens.id ? cropFocalMm : null,
    standard,
  });

  function toggleCompare() {
    if (!compare) {
      const b = defaultComparisonLens(lenses, lens);
      setLensBId(b.id);
      setFNumberB(b.maxAperture);
    }
    setCompare(!compare);
  }

  function selectLens(id: string) {
    const next = findLens(id);
    setLensId(id);
    setFNumber((n) => nearestStop(apertureStops(next), n));
    setFocusMm((mm) => Math.max(mm, next.minFocusMm));
  }

  function selectBody(id: string) {
    const next = findBody(id);
    setBodyId(id);
    if (!isRangefinder(next)) setChallenge(null);
    setMegapixels(next.megapixels?.[0] ?? null);
    setCropFocalMm(null);
    const available = lensesForBody(next);
    if (!available.some((l) => l.id === lensId)) selectLens(available[0].id);
  }

  // Challenge range: from just past the lens's closest focus out to 6 m.
  const challengeMinMm = Math.max(lens.minFocusMm * 1.15, 800);
  const challengeMaxMm = 6000;
  function startChallenge() {
    const subject = challengeMinMm * (challengeMaxMm / challengeMinMm) ** Math.random();
    setChallenge({ subjectMm: Math.round(subject / 10) * 10, shotTaken: false });
    setFocusMm(subject < 2500 ? Infinity : lens.minFocusMm);
  }
  const challengeHidden = challenge !== null && !challenge.shotTaken;

  const shape = apertureShape(lens, fNumber);
  const standardInfo = SHARPNESS_STANDARDS.find((s) => s.id === shot.standard)!;
  const canHyperfocal = shot.dof.hyperfocalMm >= lens.minFocusMm;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <div>
            <h1>Rangefinder</h1>
            <p>Depth of field studio</p>
          </div>
        </div>
        <Segmented
          label="Units"
          value={units}
          onChange={setUnits}
          options={[
            { value: "metric", label: "m" },
            { value: "imperial", label: "ft" },
          ]}
        />
      </header>

      <main className="layout">
        <section className="panel stage-preview" aria-label="Simulated photo">
          <div className="panel-head">
            <h2>Simulated photo</h2>
            {lenses.length > 1 && (
              <button type="button" className="btn btn-small" aria-pressed={compare} onClick={toggleCompare}>
                {compare ? "Close comparison" : "Compare lenses"}
              </button>
            )}
          </div>
          <BokehPreview
            veil={challengeHidden ? "The photo appears when you take the shot." : undefined}
            a={previewSide(lens, shot)}
            b={compare && lenses.length > 1 ? previewSide(lensB, shotB) : null}
            aspect={shot.frameWidthMm / shot.frameHeightMm}
          />
          {compare && lenses.length > 1 && (
            <div className="compare-row">
              <label className="field">
                <span>Lens B</span>
                <select
                  value={lensB.id}
                  onChange={(e) => {
                    const next = findLens(e.target.value);
                    setLensBId(next.id);
                    setFNumberB(next.maxAperture);
                  }}
                >
                  <LensOptions body={body} lenses={lenses} />
                </select>
              </label>
              <label className="field field-narrow">
                <span>Aperture B</span>
                <select value={shotB.fNumber} onChange={(e) => setFNumberB(Number(e.target.value))}>
                  {stopsB.map((n) => <option key={n} value={n}>{formatFNumber(n)}</option>)}
                </select>
              </label>
            </div>
          )}
          <p className="hint">
            {lens.apertureBlades
              ? `${shape.blades}-blade iris, as published for this lens.`
              : `Generic ${GENERIC_BLADES}-blade rounded iris; Leica doesn't publish this lens's blade count.`}{" "}
            Blur sizes are computed from the optics; the scene itself is illustrated.
            {compare && " Drag the divider to compare."}
          </p>
        </section>

        {isRangefinder(body) && (
          <section className="panel stage-finder" aria-label="Rangefinder">
            <div className="panel-head">
              <h2>Rangefinder · {body.name}</h2>
              {!challenge && (
                <button type="button" className="btn btn-small" onClick={startChallenge}>
                  Focus challenge
                </button>
              )}
            </div>
            <Viewfinder
              lens={lens}
              focusMm={focusMm}
              subjectMm={shot.subjectMm}
              backgroundMm={shot.backgroundMm}
              shape={shape}
              onFocusChange={setFocusMm}
            />
            {challenge && (
              <div className="challenge" role="status">
                {challenge.shotTaken ? (
                  <p>
                    <strong className={shot.subjectSharp ? "ok" : "miss"}>
                      {shot.subjectSharp ? "Sharp." : "Missed focus."}
                    </strong>{" "}
                    The subject was at {formatDistance(shot.subjectMm, units)}; you focused at{" "}
                    {formatDistance(focusMm, units)}
                    {Number.isFinite(focusMm) &&
                      ` (${formatLength(Math.abs(focusMm - shot.subjectMm), units)} ${focusMm > shot.subjectMm ? "behind" : "in front"})`}
                    . Depth of field at {formatFNumber(fNumber)}: {formatDistance(shot.dof.nearMm, units)} to{" "}
                    {formatDistance(shot.dof.farMm, units)}.
                  </p>
                ) : (
                  <p>
                    The subject is somewhere between {formatDistance(challengeMinMm, units)} and{" "}
                    {formatDistance(challengeMaxMm, units)}. Turn the focus ring, or drag across the finder, until the two
                    images of the scarf in the patch merge into one. Then take the shot.
                  </p>
                )}
                <div className="actions">
                  {challenge.shotTaken ? (
                    <>
                      <button type="button" className="btn btn-red" onClick={startChallenge}>Try again</button>
                      <button type="button" className="btn" onClick={() => setChallenge(null)}>Done</button>
                    </>
                  ) : (
                    <>
                      <button type="button" className="btn btn-red" onClick={() => setChallenge({ ...challenge, shotTaken: true })}>
                        Take the shot
                      </button>
                      <button type="button" className="btn" onClick={() => setChallenge(null)}>Cancel</button>
                    </>
                  )}
                </div>
              </div>
            )}
          </section>
        )}

        <section className="panel stage-scene" aria-label="Scene">
          <div className="panel-head">
            <h2>{body.name} · {lens.name}</h2>
            <span className="chip chip-red">{formatFNumber(fNumber)}</span>
          </div>
          <SceneDiagram
            shot={shot}
            minFocusMm={lens.minFocusMm}
            units={units}
            onFocusChange={setFocusMm}
            hideSubject={challengeHidden}
            onBackgroundChange={(mm) => setBackgroundOffsetMm(Number.isFinite(mm) ? mm - shot.subjectMm : Infinity)}
          />
          <p className="hint">Drag the figure to focus, or drag the tree to move the background.</p>
        </section>

        <section className="panel stage-barrel" aria-label="Lens">
          <div className="panel-head">
            <h2>Focus &amp; aperture rings</h2>
            <span className="muted small">Drag or tap the rings</span>
          </div>
          <LensBarrel
            lens={lens}
            stops={stops}
            fNumber={fNumber}
            focusMm={focusMm}
            cocMm={shot.cocMm}
            units={units}
            onFocusChange={setFocusMm}
            onApertureChange={setFNumber}
          />
          <div className="actions">
            <button
              type="button"
              className="btn btn-red"
              disabled={!canHyperfocal}
              onClick={() => setFocusMm(shot.dof.hyperfocalMm)}
            >
              Hyperfocal · {formatDistance(shot.dof.hyperfocalMm, units)}
            </button>
            <button type="button" className="btn" onClick={() => setFocusMm(Infinity)}>∞</button>
            <button type="button" className="btn" onClick={() => setFocusMm(lens.minFocusMm)}>
              Closest · {formatDistance(lens.minFocusMm, units)}
            </button>
          </div>
        </section>

        <Readouts shot={shot} units={units} />

        <section className="panel stage-setup" aria-label="Camera and lens">
          <div className="panel-head"><h2>Camera &amp; lens</h2></div>

          <label className="field">
            <span>Body</span>
            <select value={bodyId} onChange={(e) => selectBody(e.target.value)}>
              {BODIES.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Lens</span>
            <select value={lensId} onChange={(e) => selectLens(e.target.value)} disabled={lenses.length === 1}>
              <LensOptions body={body} lenses={lenses} />
            </select>
          </label>

          {body.megapixels && body.megapixels.length > 1 && (
            <div className="field">
              <span>Resolution</span>
              <Segmented
                label="Resolution"
                value={megapixels ?? body.megapixels[0]}
                onChange={setMegapixels}
                options={body.megapixels.map((mp) => ({ value: mp, label: `${mp} MP` }))}
              />
            </div>
          )}

          {body.cropFocalLengths && (
            <div className="field">
              <span>Framing</span>
              <Segmented
                label="Digital crop framing"
                value={cropFocalMm ?? body.cropFocalLengths[0]}
                onChange={(mm) => setCropFocalMm(mm === body.cropFocalLengths![0] ? null : mm)}
                options={body.cropFocalLengths.map((mm) => ({ value: mm, label: `${mm}` }))}
              />
            </div>
          )}

          <div className="field">
            <span>Background</span>
            <Segmented
              label="Background distance behind subject"
              value={backgroundOffsetMm}
              onChange={setBackgroundOffsetMm}
              options={BACKGROUND_PRESETS[units].map(({ mm, label }) => ({ value: mm, label }))}
            />
          </div>
        </section>

        <section className="panel stage-details" aria-label="Details">
          <div className="panel-head"><h2>Sharpness standard</h2></div>
          <Segmented
            label="Sharpness standard"
            value={shot.standard}
            onChange={setStandard}
            options={SHARPNESS_STANDARDS.filter((s) => s.id !== "pixel" || body.megapixels).map((s) => ({
              value: s.id,
              label: s.label,
            }))}
          />
          <p className="muted small standard-note">{standardInfo.description}</p>
          <Details shot={shot} />
        </section>
      </main>

      <footer className="footer">
        Independent tool, not affiliated with or endorsed by Leica Camera AG. Product names are
        trademarks of their owners. Lens specs come from public sources; check them against Leica's
        datasheets. Distances are measured from the lens (thin-lens model).
      </footer>
    </div>
  );
}
