import { useState } from "react";
import { formatShutter } from "../data/gear";
import {
  LIGHT_CONDITIONS_PROVENANCE,
  TOLERANCE_LABELS,
  type Tolerance,
  equivalentCombos,
  pickCondition,
  scoreGuess,
} from "../physics/sunny16";
import { formatFNumber } from "../utils/format";
import Segmented from "./Segmented";

interface Props {
  apertures: number[];
  shutters: number[];
  iso: number;
}

export default function Sunny16Trainer({ apertures, shutters, iso }: Props) {
  const [condition, setCondition] = useState(() => pickCondition());
  const [guessF, setGuessF] = useState(apertures[Math.floor(apertures.length / 2)]);
  const [guessT, setGuessT] = useState(shutters[Math.floor(shutters.length / 2)]);
  const [tolerance, setTolerance] = useState<Tolerance>("standard");
  const [revealed, setRevealed] = useState(false);

  function newScene() {
    setCondition(pickCondition());
    setRevealed(false);
  }

  const guess = scoreGuess(condition.ev100, guessF, guessT, iso, tolerance);
  const combos = revealed ? equivalentCombos(condition.ev100, iso, tolerance, apertures, shutters) : [];

  return (
    <section className="panel stage-trainer" aria-label="Sunny 16 trainer">
      <div className="panel-head">
        <h2>Sunny 16 trainer</h2>
        <button type="button" className="btn btn-small" onClick={newScene}>
          New scene
        </button>
      </div>

      <p className="gear-name">{condition.label}</p>
      <p className="muted small">{condition.hint} At ISO {iso}, what aperture and shutter speed give a correct exposure?</p>

      <div className="field">
        <span>Aperture</span>
        <div className="dial" role="radiogroup" aria-label="Guessed aperture">
          {apertures.map((f) => (
            <button
              key={f}
              type="button"
              role="radio"
              aria-checked={f === guessF}
              className={f === guessF ? "dial-step dial-on" : "dial-step"}
              onClick={() => {
                setGuessF(f);
                setRevealed(false);
              }}
            >
              {formatFNumber(f)}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <span>Shutter speed</span>
        <div className="dial" role="radiogroup" aria-label="Guessed shutter speed">
          {shutters.map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={t === guessT}
              className={t === guessT ? "dial-step dial-on" : "dial-step"}
              onClick={() => {
                setGuessT(t);
                setRevealed(false);
              }}
            >
              {formatShutter(t)}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <span>Tolerance</span>
        <Segmented
          label="Tolerance"
          value={tolerance}
          onChange={(v) => {
            setTolerance(v);
            setRevealed(false);
          }}
          options={(Object.keys(TOLERANCE_LABELS) as Tolerance[]).map((t) => ({ value: t, label: TOLERANCE_LABELS[t] }))}
        />
      </div>

      <div className="actions">
        <button type="button" className="btn btn-red" onClick={() => setRevealed(true)}>
          Check exposure
        </button>
      </div>

      {revealed && (
        <div className="meter" role="status">
          <p className={guess.correct ? "meter-text" : "meter-text warn"}>
            {guess.correct ? "Correct." : `${Math.abs(guess.errorStops).toFixed(1)} stops ${guess.errorStops > 0 ? "over" : "under"}.`}
          </p>
          {combos.length > 0 && (
            <p className="muted small">
              Also correct: {combos.slice(0, 6).map((c) => `${formatFNumber(c.fNumber)} @ ${formatShutter(c.shutterSec)}`).join(", ")}
            </p>
          )}
        </div>
      )}

      <p className="hint">{LIGHT_CONDITIONS_PROVENANCE.notes} Scored with the same exposure equation as the rest of the app.</p>
    </section>
  );
}
