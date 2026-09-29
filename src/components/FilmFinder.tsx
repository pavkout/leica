import { useEffect, useState } from "react";
import type { Body, Lens } from "../data/gear";
import { findFilms, type FilmKind, type Light, type Look } from "../physics/filmFinder";
import { computeShot } from "../physics/model";
import { apertureShape } from "../preview/aperture";
import { SAMPLE_SCENES, loadSampleScene, type PhotoScene } from "../preview/photoScene";
import BokehPreview from "./BokehPreview";
import FilmArt from "./gear/FilmArt";
import Segmented from "./Segmented";

interface Props {
  body: Body;
  lens: Lens;
  fNumber: number;
  /** Load a stock into the camera (film bodies). */
  onLoad?: (filmId: string) => void;
  /** The roll in the camera has frames on it: finish or rewind it first. */
  loadLocked: boolean;
}

const cache = new Map<string, Promise<PhotoScene>>();
function scene(id: string) {
  const info = SAMPLE_SCENES.find((s) => s.id === id)!;
  if (!cache.has(id)) cache.set(id, loadSampleScene(info));
  return cache.get(id)!;
}

/**
 * Which film? Three questions (what, the light, the look), the stocks that
 * fit with the reasons why, and a sample picture developed in each look.
 */
export default function FilmFinder({ body, lens, fNumber, onLoad, loadLocked }: Props) {
  const [kind, setKind] = useState<FilmKind>("any");
  const [light, setLight] = useState<Light>("mixed");
  const [look, setLook] = useState<Look>("natural");
  const picks = findFilms({ kind, light, look }).slice(0, 3);
  const [chosen, setChosen] = useState(0);
  const pick = picks[Math.min(chosen, picks.length - 1)];

  // A night scene for low light, a daylight street otherwise.
  const sceneId = light === "low" ? "amsterdam-night" : "amsterdam-sun";
  const [photo, setPhoto] = useState<PhotoScene | null>(null);
  useEffect(() => {
    let alive = true;
    scene(sceneId)
      .then((p) => alive && setPhoto(p))
      .catch(() => alive && setPhoto(null));
    return () => {
      alive = false;
    };
  }, [sceneId]);
  useEffect(() => setChosen(0), [kind, light, look]);

  const info = SAMPLE_SCENES.find((s) => s.id === sceneId)!;
  const subjectMm = info.anchor.distanceM * 1000;
  // The sample photos were taken at about 50 mm-equivalent; a wider lens would show them small, so wide lenses sample at 50 mm.
  const sampleLens = lens.focalMm >= 35 ? lens : { ...lens, focalMm: 50 };
  const shot = computeShot({ body, lens: sampleLens, fNumber, focusMm: Math.max(subjectMm, lens.minFocusMm), subjectMm, backgroundOffsetMm: Infinity, megapixels: null, cropFocalMm: null, standard: "engraved" });

  return (
    <section className="panel stage-film" aria-label="Film finder">
      <div className="ff-questions">
        <div className="field">
          <span>What do you want to shoot on?</span>
          <Segmented
            label="Film type"
            value={kind}
            onChange={setKind}
            options={[
              { value: "any", label: "Anything" },
              { value: "colour", label: "Colour" },
              { value: "bw", label: "Black and white" },
              { value: "slide", label: "Slide" },
            ]}
          />
        </div>
        <div className="field">
          <span>The light</span>
          <Segmented
            label="Light"
            value={light}
            onChange={setLight}
            options={[
              { value: "bright", label: "Bright sun" },
              { value: "mixed", label: "A bit of everything" },
              { value: "low", label: "Indoors and night" },
            ]}
          />
        </div>
        <div className="field">
          <span>The look</span>
          <Segmented
            label="Look"
            value={look}
            onChange={setLook}
            options={[
              { value: "soft", label: "Soft and forgiving" },
              { value: "natural", label: "Natural" },
              { value: "vivid", label: "Vivid" },
              { value: "gritty", label: "Gritty" },
            ]}
          />
        </div>
      </div>

      {picks.length === 0 ? (
        <p className="muted">No film in the catalogue matches that combination.</p>
      ) : (
        <div className="ff-result">
          <ol className="ff-picks">
            {picks.map((p, i) => (
              <li key={p.film.id}>
                <button type="button" className={`ff-pick${i === chosen ? " ff-pick-on" : ""}`} aria-pressed={i === chosen} onClick={() => setChosen(i)}>
                  <FilmArt film={p.film} className="ff-art" />
                  <span className="ff-pick-body">
                    <span className="ff-name">{p.film.name}</span>
                    <span className="ff-reasons">{p.reasons.join(" · ")}</span>
                  </span>
                </button>
              </li>
            ))}
          </ol>

          <div className="ff-sample">
            {photo ? (
              <BokehPreview
                a={{
                  label: pick.film.name,
                  params: {
                    focalMm: shot.focalMm,
                    fNumber: shot.fNumber,
                    focusMm: shot.focusMm,
                    subjectMm: shot.subjectMm,
                    backgroundMm: shot.backgroundMm,
                    frameWidthMm: shot.frameWidthMm,
                    horizontalAngleDeg: shot.horizontalAngle,
                    shape: apertureShape(sampleLens, shot.fNumber),
                    photo,
                    develop: { exposureStops: 0, look: pick.film, grain: pick.film.grain, vignetteStops: 0, shake: 0, shakeAngle: 0, seed: 7 },
                  },
                }}
                b={null}
                aspect={shot.frameWidthMm / shot.frameHeightMm}
              />
            ) : (
              <div className="guess-loading" style={{ aspectRatio: "3 / 2" }}>
                Developing the sample…
              </div>
            )}
            <p className="ff-desc">{pick.film.description}</p>
            {onLoad &&
              (body.medium === "film" ? (
                <button type="button" className="btn btn-red ff-load" disabled={loadLocked} onClick={() => onLoad(pick.film.id)}>
                  {loadLocked ? "Rewind the roll in the camera first" : `Load ${pick.film.name} in the ${body.name}`}
                </button>
              ) : (
                <p className="muted small">The {body.name} is digital: pick a film M to load a roll.</p>
              ))}
          </div>
        </div>
      )}
      <p className="hint">
        Matched on the app&apos;s film looks (speed, latitude, colour, contrast and grain), which are approximations of each stock, not the
        manufacturer&apos;s data. {SAMPLE_SCENES[0].credit}.
      </p>
    </section>
  );
}
