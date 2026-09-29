import { useEffect, useMemo, useState } from "react";
import { playApertureClick } from "../audio/sounds";
import type { Body, Lens } from "../data/gear";
import { computeShot } from "../physics/model";
import { APERTURE_BANDS, apertureBand, makeRound, scoreGuess, type ApertureBand, type Round, type Score } from "../physics/guessLens";
import { apertureShape } from "../preview/aperture";
import { SAMPLE_SCENES, loadSampleScene, type PhotoScene } from "../preview/photoScene";
import { getString, setString } from "../services/persistence";
import { formatFNumber } from "../utils/format";
import BokehPreview from "./BokehPreview";

interface Props {
  body: Body;
  lenses: Lens[];
  /** Put the round's lens on the camera, at its aperture. */
  onTry: (lensId: string, fNumber: number) => void;
}

const BEST_KEY = "rangefinder-guess-best";
const scenes = new Map<string, Promise<PhotoScene>>();
function scene(id: string) {
  const info = SAMPLE_SCENES.find((s) => s.id === id)!;
  if (!scenes.has(id)) scenes.set(id, loadSampleScene(info));
  return scenes.get(id)!;
}

/**
 * Guess the lens: a picture made through a hidden lens and aperture, from the
 * same renderer as the Studio. Name the focal length and how far it was
 * stopped down; the reveal says what to look for.
 */
export default function GuessLens({ body, lenses, onTry }: Props) {
  const photoIds = useMemo(() => SAMPLE_SCENES.map((s) => s.id), []);
  const [round, setRound] = useState<Round | null>(() => makeRound(lenses, photoIds));
  const [photo, setPhoto] = useState<PhotoScene | null>(null);
  const [loading, setLoading] = useState(false);
  const [focalGuess, setFocalGuess] = useState<number | null>(null);
  const [bandGuess, setBandGuess] = useState<ApertureBand | null>(null);
  const [result, setResult] = useState<Score | null>(null);
  const [tally, setTally] = useState({ rounds: 0, points: 0, streak: 0 });
  const [best, setBest] = useState(() => Number(getString(BEST_KEY) ?? 0) || 0);

  useEffect(() => {
    if (!round || round.sceneId === "street") {
      setPhoto(null);
      return;
    }
    let alive = true;
    setLoading(true);
    scene(round.sceneId)
      .then((p) => alive && setPhoto(p))
      .catch(() => alive && setRound((r) => (r ? { ...r, sceneId: "street" } : r)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [round]);

  const lens = round ? lenses.find((l) => l.id === round.lensId) : undefined;
  if (!round || !lens) {
    return (
      <section className="panel stage-guess" aria-label="Guess the lens">
        <p className="muted">The {body.name} has only one focal length to choose from. Pick a body with interchangeable lenses to play.</p>
      </section>
    );
  }

  const info = SAMPLE_SCENES.find((s) => s.id === round.sceneId);
  const subjectMm = info ? info.anchor.distanceM * 1000 : 3000;
  const shot = computeShot({
    body,
    lens,
    fNumber: round.fNumber,
    focusMm: Math.max(subjectMm, lens.minFocusMm),
    subjectMm,
    backgroundOffsetMm: info ? Infinity : 8000,
    megapixels: null,
    cropFocalMm: null,
    standard: "engraved",
  });
  const waiting = round.sceneId !== "street" && (!photo || photo.key !== round.sceneId);

  function reveal() {
    if (focalGuess === null || bandGuess === null || !round) return;
    const s = scoreGuess(round, focalGuess, bandGuess);
    setResult(s);
    setTally((t) => {
      const next = { rounds: t.rounds + 1, points: t.points + s.points, streak: s.points === 2 ? t.streak + 1 : 0 };
      if (next.streak > best) {
        setBest(next.streak);
        setString(BEST_KEY, String(next.streak));
      }
      return next;
    });
  }

  function next() {
    setRound(makeRound(lenses, photoIds));
    setFocalGuess(null);
    setBandGuess(null);
    setResult(null);
  }

  const band = apertureBand(round.fNumber);
  return (
    <section className="panel stage-guess" aria-label="Guess the lens">
      <div className="guess-score" aria-live="polite">
        <span>
          <b>{tally.points}</b> of {tally.rounds * 2} points
        </span>
        <span>
          Streak <b>{tally.streak}</b>
        </span>
        <span>
          Best streak <b>{best}</b>
        </span>
      </div>

      <div className="guess-picture">
        {waiting || loading ? (
          <div className="guess-loading" style={{ aspectRatio: String(shot.frameWidthMm / shot.frameHeightMm) }}>
            Developing the picture…
          </div>
        ) : (
          <BokehPreview
            a={{
              label: lens.name,
              params: {
                focalMm: shot.focalMm,
                fNumber: shot.fNumber,
                focusMm: shot.focusMm,
                subjectMm: shot.subjectMm,
                backgroundMm: shot.backgroundMm,
                frameWidthMm: shot.frameWidthMm,
                horizontalAngleDeg: shot.horizontalAngle,
                shape: apertureShape(lens, shot.fNumber),
                photo: photo ?? undefined,
              },
            }}
            b={null}
            aspect={shot.frameWidthMm / shot.frameHeightMm}
            hideTag={!result}
          />
        )}
      </div>

      <div className="field">
        <span>Focal length</span>
        <div className="dial" role="radiogroup" aria-label="Focal length guess">
          {round.focalChoices.map((f) => {
            const cls = result ? (f === round.focalMm ? " guess-right" : f === focalGuess ? " guess-wrong" : "") : "";
            return (
              <button
                key={f}
                type="button"
                role="radio"
                aria-checked={focalGuess === f}
                disabled={!!result}
                className={`dial-step${focalGuess === f ? " dial-on" : ""}${cls}`}
                onClick={() => {
                  playApertureClick();
                  setFocalGuess(f);
                }}
              >
                {f} mm
              </button>
            );
          })}
        </div>
      </div>

      <div className="field">
        <span>Aperture</span>
        <div className="guess-bands" role="radiogroup" aria-label="Aperture guess">
          {APERTURE_BANDS.map((b) => {
            const cls = result ? (b.id === band ? " guess-right" : b.id === bandGuess ? " guess-wrong" : "") : "";
            return (
              <button
                key={b.id}
                type="button"
                role="radio"
                aria-checked={bandGuess === b.id}
                disabled={!!result}
                className={`guess-band${bandGuess === b.id ? " guess-band-on" : ""}${cls}`}
                onClick={() => {
                  playApertureClick();
                  setBandGuess(b.id);
                }}
              >
                <span className="guess-band-label">{b.label}</span>
                <span className="guess-band-hint">{b.hint}</span>
              </button>
            );
          })}
        </div>
      </div>

      {result ? (
        <div className="guess-reveal">
          <p className="guess-answer">
            {lens.name} at {formatFNumber(round.fNumber)}
            <span>{result.points === 2 ? "Both right." : result.points === 1 ? (result.focal ? "Right lens, wrong aperture." : "Right aperture, wrong lens.") : "Neither this time."}</span>
          </p>
          <p className="muted">
            {round.focalMm <= 28
              ? "Wide: lots of scene, near things loom large, and even wide open the background stays fairly readable."
              : round.focalMm >= 75
                ? "Long: a narrow slice of the scene, the background pulled close and easy to throw out of focus."
                : "Normal: roughly what your eye takes in; the background blurs as much as the aperture lets it."}{" "}
            {band === "wide"
              ? "Wide open, out-of-focus lights turn into discs and the sharp zone is thin."
              : band === "middle"
                ? "In the middle, the background softens but keeps its shapes."
                : "Stopped down, nearly everything from near to far is sharp."}
          </p>
          <div className="guess-actions">
            <button type="button" className="btn btn-red" onClick={next}>
              Next picture
            </button>
            <button type="button" className="btn" onClick={() => onTry(lens.id, round.fNumber)}>
              Shoot with this lens
            </button>
          </div>
        </div>
      ) : (
        <div className="guess-actions">
          <button type="button" className="btn btn-red" disabled={focalGuess === null || bandGuess === null} onClick={reveal}>
            Reveal
          </button>
          <button type="button" className="btn" onClick={next}>
            Skip
          </button>
        </div>
      )}
      <p className="hint">
        Rendered with the Studio&apos;s optics from the lens&apos;s focal length and aperture. {SAMPLE_SCENES[0].credit}.
      </p>
    </section>
  );
}
