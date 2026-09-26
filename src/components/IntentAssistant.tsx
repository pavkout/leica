import { useState } from "react";
import { formatShutter } from "../data/gear";
import { INTENT_CARDS, type IntentId, type IntentResult, type Lock, solveIntent } from "../physics/intent";
import { formatDistance, formatFNumber, type Units } from "../utils/format";

interface Props {
  sceneEv100: number;
  iso: number;
  apertures: number[];
  shutters: number[];
  focalMm: number;
  hyperfocalMm: number;
  units: Units;
  onApply: (result: { fNumber: number; shutterSec: number; focusMm?: number }) => void;
}

function ResultCard({ result, units, onApply }: { result: IntentResult; units: Units; onApply: Props["onApply"] }) {
  return (
    <div className={result.compromised ? "intent-card intent-card-warn" : "intent-card"}>
      <p className="gear-name">
        {formatFNumber(result.fNumber)} · {formatShutter(result.shutterSec)}
        {result.focusMm !== undefined && ` · focus ${formatDistance(result.focusMm, units)}`}
      </p>
      <p className="muted small">{result.reason}</p>
      <button type="button" className="btn btn-small" onClick={() => onApply(result)}>
        Use this
      </button>
    </div>
  );
}

export default function IntentAssistant({ sceneEv100, iso, apertures, shutters, focalMm, hyperfocalMm, units, onApply }: Props) {
  const [intentId, setIntentId] = useState<IntentId | null>(null);
  const [lock, setLock] = useState<Lock | null>(null);

  if (!intentId) {
    return (
      <section className="panel stage-intent" aria-label="Shooting intent">
        <div className="panel-head">
          <h2>What do you want?</h2>
        </div>
        <div className="intent-grid">
          {INTENT_CARDS.map((card) => (
            <button key={card.id} type="button" className="intent-pick" onClick={() => setIntentId(card.id)}>
              <span className="gear-name">{card.label}</span>
              <span className="muted small">{card.description}</span>
            </button>
          ))}
        </div>
      </section>
    );
  }

  const card = INTENT_CARDS.find((c) => c.id === intentId)!;
  const { primary, alternatives } = solveIntent(intentId, {
    sceneEv100,
    iso,
    apertures,
    shutters,
    focalMm,
    hyperfocalMm: intentId === "street-zone-focus" ? hyperfocalMm : undefined,
    lock: lock ?? undefined,
  });

  return (
    <section className="panel stage-intent" aria-label="Shooting intent">
      <div className="panel-head">
        <h2>{card.label}</h2>
        <button type="button" className="btn btn-small" onClick={() => { setIntentId(null); setLock(null); }}>
          Change goal
        </button>
      </div>

      <ResultCard result={primary} units={units} onApply={onApply} />

      <div className="field">
        <span>Lock a parameter</span>
        <div className="dial" role="radiogroup" aria-label="Lock">
          <button type="button" role="radio" aria-checked={lock === null} className={lock === null ? "dial-step dial-on" : "dial-step"} onClick={() => setLock(null)}>
            None
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={lock?.kind === "aperture"}
            className={lock?.kind === "aperture" ? "dial-step dial-on" : "dial-step"}
            onClick={() => setLock({ kind: "aperture", value: primary.fNumber })}
          >
            Aperture {formatFNumber(primary.fNumber)}
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={lock?.kind === "shutter"}
            className={lock?.kind === "shutter" ? "dial-step dial-on" : "dial-step"}
            onClick={() => setLock({ kind: "shutter", value: primary.shutterSec })}
          >
            Shutter {formatShutter(primary.shutterSec)}
          </button>
        </div>
        {lock && (
          <div className="dial" role="radiogroup" aria-label="Locked value">
            {(lock.kind === "aperture" ? apertures : shutters).map((v) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={v === lock.value}
                className={v === lock.value ? "dial-step dial-on" : "dial-step"}
                onClick={() => setLock({ kind: lock.kind, value: v } as Lock)}
              >
                {lock.kind === "aperture" ? formatFNumber(v) : formatShutter(v)}
              </button>
            ))}
          </div>
        )}
      </div>

      {alternatives.length > 0 && (
        <>
          <p className="muted small">Alternatives:</p>
          {alternatives.map((alt, i) => (
            <ResultCard key={i} result={alt} units={units} onApply={onApply} />
          ))}
        </>
      )}

      <p className="hint">
        Deterministic from the same exposure engine as the rest of the app — no model, just the constraint you picked
        {lock ? ", plus the parameter you locked." : "."}
      </p>
    </section>
  );
}
