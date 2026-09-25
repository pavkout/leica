import { useMemo, useState } from "react";
import LensBarrel from "./components/LensBarrel";
import Readouts, { Details } from "./components/Readouts";
import SceneDiagram from "./components/SceneDiagram";
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
} from "./data/gear";
import { SHARPNESS_STANDARDS, computeShot, type SharpnessStandard } from "./physics/model";
import { formatDistance, formatFNumber, type Units } from "./utils/format";

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

export default function App() {
  const [bodyId, setBodyId] = useState(DEFAULT_BODY_ID);
  const [lensId, setLensId] = useState(DEFAULT_LENS_ID);
  const [fNumber, setFNumber] = useState(5.6);
  const [focusMm, setFocusMm] = useState(3000);
  const [backgroundOffsetMm, setBackgroundOffsetMm] = useState(2000);
  const [megapixels, setMegapixels] = useState<number | null>(60);
  const [cropFocalMm, setCropFocalMm] = useState<number | null>(null);
  const [standard, setStandard] = useState<SharpnessStandard>("engraved");
  const [units, setUnits] = useState<Units>("metric");

  const body = findBody(bodyId);
  const lens = findLens(lensId);
  const lenses = lensesForBody(body);
  const stops = useMemo(() => apertureStops(lens), [lens]);

  const shot = computeShot({
    body,
    lens,
    fNumber,
    focusMm,
    backgroundOffsetMm,
    megapixels,
    cropFocalMm,
    standard,
  });

  function selectLens(id: string) {
    const next = findLens(id);
    setLensId(id);
    setFNumber((n) => nearestStop(apertureStops(next), n));
    setFocusMm((mm) => Math.max(mm, next.minFocusMm));
  }

  function selectBody(id: string) {
    const next = findBody(id);
    setBodyId(id);
    setMegapixels(next.megapixels?.[0] ?? null);
    setCropFocalMm(null);
    const available = lensesForBody(next);
    if (!available.some((l) => l.id === lensId)) selectLens(available[0].id);
  }

  const nativeLenses = lenses.filter((l) => !isAdapted(body, l));
  const adaptedLenses = lenses.filter((l) => isAdapted(body, l));
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
            onBackgroundChange={(mm) => setBackgroundOffsetMm(Number.isFinite(mm) ? mm - focusMm : Infinity)}
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
              {adaptedLenses.length ? (
                <>
                  <optgroup label="Native">
                    {nativeLenses.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </optgroup>
                  <optgroup label="M lenses via adapter">
                    {adaptedLenses.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </optgroup>
                </>
              ) : (
                lenses.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)
              )}
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
