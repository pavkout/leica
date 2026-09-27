import { useState } from "react";
import { formatShutter, shutterSpeeds, type Body } from "../data/gear";
import { EI_STOP_RANGE, developmentIntent, exposureIndex, isCommonPractice } from "../physics/pushPull";
import { FILM_STOCKS, type FilmLook } from "../preview/film";
import FilmArt from "./gear/FilmArt";
import GearPicker from "./gear/GearPicker";
import Segmented from "./Segmented";

const ISO_STEPS = [50, 64, 100, 125, 160, 200, 400, 800, 1600, 3200, 6400, 12500, 25000, 50000, 100000, 200000];

interface Props {
  body: Body;
  look: FilmLook;
  onFilm: (id: string) => void;
  iso: number;
  onIso: (iso: number) => void;
  /** Exposure index rating relative to box speed, in stops (film only; 0 = box speed). */
  eiStops: number;
  onEiStops: (stops: number) => void;
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
          <span>Rate & develop</span>
          <Segmented
            label="Exposure index rating"
            value={p.eiStops}
            onChange={p.onEiStops}
            options={EI_STOP_RANGE.map((s) => ({
              value: s,
              label: s === 0 ? "Box" : `${s > 0 ? "Push" : "Pull"} ${Math.abs(s)}`,
            }))}
          />
          <p className="muted small">
            {p.eiStops === 0
              ? `Metering at box speed, ISO ${p.look.iso}.`
              : `Metering at EI ${exposureIndex(p.look.iso, p.eiStops)} — ${Math.abs(p.eiStops)} stop${Math.abs(p.eiStops) === 1 ? "" : "s"} ${
                  p.eiStops > 0 ? "less" : "more"
                } light reaches the negative, compensated by ${developmentIntent(p.eiStops)}-processing in development (not by the camera).`}
          </p>
          {p.eiStops !== 0 && !isCommonPractice(p.look, p.eiStops) && (
            <p className="small warn-text">
              Beyond typical {developmentIntent(p.eiStops)} range for this stock — a generic educational response, not
              this stock's real characteristic curve.
            </p>
          )}
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
