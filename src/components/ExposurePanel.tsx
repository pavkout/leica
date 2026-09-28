import { useState } from "react";
import { ISO_STEPS, formatShutter, shutterSpeeds, type Body } from "../data/gear";
import { FILM_STOCKS, type FilmLook } from "../preview/film";
import { DEVELOP_LEVELS, eiStops, nearestDevelopLevel } from "../physics/pushPull";
import FilmArt from "./gear/FilmArt";
import GearPicker from "./gear/GearPicker";
import Segmented from "./Segmented";


interface Props {
  body: Body;
  look: FilmLook;
  onFilm: (id: string) => void;
  iso: number;
  onIso: (iso: number) => void;
  auto: boolean;
  onAuto: (auto: boolean) => void;
  shutterSec: number;
  onShutter: (sec: number) => void;
  errorStops: number;
  tripod: boolean;
  onTripod: (tripod: boolean) => void;
  shakeLikely: boolean;
  sceneLabel: string;
  /** Film loaded mid-roll can't be swapped without rewinding. */
  filmLocked: boolean;
  savedFilmIds?: Set<string>;
  onToggleSavedFilm?: (id: string) => void;
  /** The loaded stock's own box speed — `iso` above may differ from it (rated at a different EI). */
  boxIso: number;
  onFilmEI: (ei: number | null) => void;
  pushPullStops: number;
  onPushPull: (stops: number) => void;
}

function developmentEffectText(stops: number): string {
  if (stops === 0) return "Normal development: no contrast or grain change.";
  const magnitude = Math.abs(stops);
  const direction = stops > 0 ? "Push" : "Pull";
  const contrast = stops > 0 ? "more contrast, less latitude" : "flatter, more forgiving highlights";
  return `${direction} ${magnitude}: ${contrast}, coarser grain.`;
}

function formatStops(e: number) {
  const r = Math.round(e * 3) / 3;
  if (Math.abs(r) < 0.17) return "Correct exposure";
  const a = Math.abs(r);
  const whole = Math.floor(a + 1e-6);
  const third = Math.round((a - whole) * 3);
  const amount = `${whole > 0 ? whole : ""}${third === 1 ? "⅓" : third === 2 ? "⅔" : ""}`;
  return `${amount} stop${a > 1 ? "s" : ""} ${r > 0 ? "over" : "under"}`;
}

export default function ExposurePanel(p: Props) {
  const [picking, setPicking] = useState(false);
  const film = p.body.medium === "film";
  const speeds = shutterSpeeds(p.body);
  const isos = ISO_STEPS.filter((i) => p.body.isoRange && i >= p.body.isoRange[0] && i <= p.body.isoRange[1]);
  const latitude = p.look.latitude;
  const clipped = p.errorStops > latitude[1] || p.errorStops < -latitude[0];
  const markerPct = 50 + Math.max(-3, Math.min(3, p.errorStops)) * (50 / 3);
  const eiChoices = ISO_STEPS.filter((i) => Math.abs(Math.log2(i / p.boxIso)) <= 3.1);
  const eiStopsValue = eiStops(p.boxIso, p.iso);
  const currentDevelopLevel = nearestDevelopLevel(p.pushPullStops);

  return (
    <section className="panel stage-exposure" aria-label="Exposure and film">
      <div className="panel-head">
        <h2>{film ? "Film & exposure" : "Sensor & exposure"}</h2>
        <span className="muted small">{p.sceneLabel}</span>
      </div>

      <div className="stock">
        {film ? <FilmArt film={p.look} className="stock-art" /> : <div className="stock-sensor" aria-hidden="true">{p.look.mono ? "B&W" : "RGB"}</div>}
        <div className="stock-text">
          <span className="gear-name">{p.look.name}</span>
          <span className="gear-meta">
            {film ? `ISO ${p.look.iso} · ` : ""}latitude −{latitude[0]} / +{latitude[1]} stops
          </span>
          <span className="stock-desc">{p.look.description}</span>
        </div>
        {film && (
          <button type="button" className="btn btn-small" onClick={() => setPicking(true)} disabled={p.filmLocked} title={p.filmLocked ? "Rewind the roll to load another film" : undefined}>
            Load film
          </button>
        )}
      </div>

      {!film && isos.length > 0 && (
        <div className="field">
          <span>ISO</span>
          <div className="dial" role="radiogroup" aria-label="ISO">
            {isos.map((i) => (
              <button key={i} type="button" role="radio" aria-checked={i === p.iso} className={i === p.iso ? "dial-step dial-on" : "dial-step"} onClick={() => p.onIso(i)}>
                {i}
              </button>
            ))}
          </div>
        </div>
      )}

      {film && (
        <div className="field">
          <span>Exposure index (box ISO {p.boxIso})</span>
          <div className="dial" role="radiogroup" aria-label="Exposure index">
            {eiChoices.map((ei) => (
              <button
                key={ei}
                type="button"
                role="radio"
                aria-checked={ei === p.iso}
                className={ei === p.iso ? "dial-step dial-on" : "dial-step"}
                onClick={() => p.onFilmEI(ei === p.boxIso ? null : ei)}
              >
                {ei}
              </button>
            ))}
          </div>
          <p className="muted small">
            {p.iso === p.boxIso
              ? "Metering at box speed."
              : `Metering at EI ${p.iso} on ISO ${p.boxIso} film: ${Math.abs(eiStopsValue).toFixed(1).replace(/\.0$/, "")} EV ${
                  eiStopsValue > 0 ? "under" : "over"
                } a normal box-speed capture, before push/pull development.`}
          </p>
        </div>
      )}

      {film && (
        <div className="field">
          <span>Development</span>
          <Segmented
            label="Development"
            value={currentDevelopLevel.id}
            onChange={(id) => p.onPushPull(DEVELOP_LEVELS.find((l) => l.id === id)!.stops)}
            options={DEVELOP_LEVELS.map((l) => ({ value: l.id, label: l.label }))}
          />
          <p className="muted small">{developmentEffectText(p.pushPullStops)}</p>
        </div>
      )}

      {p.body.autoExposure && (
        <div className="field">
          <span>Mode</span>
          <Segmented
            label="Exposure mode"
            value={p.auto ? "auto" : "manual"}
            onChange={(v) => p.onAuto(v === "auto")}
            options={[
              { value: "auto", label: "A · aperture priority" },
              { value: "manual", label: "Manual" },
            ]}
          />
        </div>
      )}

      <div className="field">
        <span>Shutter speed{p.auto ? " (set by the camera)" : ""}</span>
        <div className="dial" role="radiogroup" aria-label="Shutter speed">
          {speeds.map((t) => {
            const on = Math.abs(Math.log2(t / p.shutterSec)) < 0.17;
            return (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={on}
                disabled={p.auto}
                className={on ? "dial-step dial-on" : "dial-step"}
                onClick={() => p.onShutter(t)}
              >
                {formatShutter(t)}
              </button>
            );
          })}
        </div>
        {p.auto && <span className="muted small">Metered: {formatShutter(p.shutterSec)} s</span>}
      </div>

      <div className="meter" aria-label={`Meter: ${formatStops(p.errorStops)}`}>
        <div className="meter-scale">
          {[-3, -2, -1, 0, 1, 2, 3].map((v) => (
            <span key={v} style={{ left: `${50 + v * (50 / 3)}%` }}>{v > 0 ? `+${v}` : v}</span>
          ))}
          <i className="meter-latitude" style={{ left: `${50 - latitude[0] * (50 / 3)}%`, width: `${(latitude[0] + latitude[1]) * (50 / 3)}%` }} />
          <b className="meter-marker" style={{ left: `${markerPct}%` }} />
        </div>
        <p className={clipped ? "meter-text warn" : "meter-text"}>
          {formatStops(p.errorStops)}
          {clipped && (p.errorStops > 0 ? " · highlights will blow out" : " · shadows will block up")}
        </p>
      </div>

      <div className="actions">
        <button type="button" className="btn btn-small" aria-pressed={p.tripod} onClick={() => p.onTripod(!p.tripod)}>
          {p.tripod ? "On tripod" : "Hand-held"}
        </button>
        {p.shakeLikely && !p.tripod && <span className="small warn-text">Slower than 1/focal length: expect camera shake.</span>}
      </div>

      <GearPicker
        open={picking}
        title="Load a roll of film"
        selectedId={p.look.id}
        onSelect={p.onFilm}
        onClose={() => setPicking(false)}
        saved={p.savedFilmIds}
        onToggleSaved={p.onToggleSavedFilm}
        items={FILM_STOCKS.map((f) => ({
          id: f.id,
          name: f.name,
          group: f.mono ? "Black & white" : f.kind === "slide" ? "Slide" : "Colour negative",
          meta: `ISO ${f.iso} · ${f.description}`,
          art: <FilmArt film={f} />,
        }))}
      />
    </section>
  );
}
