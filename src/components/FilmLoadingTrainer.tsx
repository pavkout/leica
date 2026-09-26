import { useState } from "react";
import { playAdvance, playShutter } from "../audio/sounds";
import { shutterVoiceFor } from "../audio/voices";
import { findBody } from "../data/gear";
import { LOADING_ACTIONS, LOADING_TUTORIALS, UNSOURCED_FILM_BODY_IDS, tutorialFor } from "../data/filmLoading";
import { attempt, paletteFor, stateAt, type MechState, type TutorialMode } from "../state/loadingTutorial";
import Segmented from "./Segmented";

interface Props {
  /** The body currently selected in the app; used as the default when it has a tutorial. */
  bodyId: string;
}

const SOURCED_BODY_IDS = [...new Set(LOADING_TUTORIALS.flatMap((t) => t.bodyIds))];

const READOUT: { key: string; label: string; values: Record<string, string>; onlyIf?: (s: MechState, bodyId: string) => boolean }[] = [
  { key: "camera", label: "Bottom cover", values: { closed: "Locked", unlocked: "Unlocked", open: "Off" } },
  { key: "back", label: "Rear panel", values: { closed: "Closed", open: "Open" } },
  { key: "spool", label: "Take-up spool", values: { in: "In camera", out: "Out" }, onlyIf: (_, id) => id === "m3" },
  { key: "cartridge", label: "Cartridge", values: { none: "—", hand: "In hand", half: "Half in", in: "In" } },
  { key: "lever", label: "Rewind lever", values: { A: "Upright", R: "R" } },
  { key: "cocked", label: "Shutter", values: { true: "Cocked", false: "Released" } },
];

type Feedback = { tone: "ok" | "warn"; text: string } | null;

export default function FilmLoadingTrainer({ bodyId: appBodyId }: Props) {
  const [bodyId, setBodyId] = useState(() => (SOURCED_BODY_IDS.includes(appBodyId) ? appBodyId : "m6"));
  const [mode, setMode] = useState<TutorialMode>("load");
  const [stepIndex, setStepIndex] = useState(0);
  const [feedback, setFeedback] = useState<Feedback>(null);

  const tutorial = tutorialFor(bodyId, mode)!;
  const palette = paletteFor(tutorial, LOADING_ACTIONS);
  const state = stateAt(tutorial, stepIndex);
  const done = stepIndex >= tutorial.steps.length;
  const current = tutorial.steps[stepIndex];
  const previous = tutorial.steps[stepIndex - 1];

  function restart(next?: { bodyId?: string; mode?: TutorialMode }) {
    if (next?.bodyId) setBodyId(next.bodyId);
    if (next?.mode) setMode(next.mode);
    setStepIndex(0);
    setFeedback(null);
  }

  function act(actionId: string) {
    const { outcome, stepIndex: next } = attempt(tutorial, LOADING_ACTIONS, stepIndex, actionId);
    if (outcome.kind === "advanced" || outcome.kind === "complete") {
      if (actionId === "wind") playAdvance();
      if (actionId === "release") playShutter(1 / 125, shutterVoiceFor(findBody(bodyId)));
      setStepIndex(next);
      setFeedback(outcome.kind === "complete" ? { tone: "ok", text: mode === "load" ? "Loaded and on frame 1." : "Cartridge out — roll unloaded." } : null);
    } else if (outcome.kind === "blocked") {
      setFeedback({ tone: "warn", text: `${outcome.reason} Next: ${LOADING_ACTIONS[outcome.expected.action].label.toLowerCase()}.` });
    } else {
      setFeedback({ tone: "warn", text: `Not yet — first: ${LOADING_ACTIONS[outcome.expected.action].label.toLowerCase()}.` });
    }
  }

  const body = findBody(bodyId);
  const unsourced = UNSOURCED_FILM_BODY_IDS.includes(appBodyId);

  return (
    <section className="panel stage-loading" aria-label="Film loading trainer">
      <div className="panel-head">
        <h2>Film loading</h2>
        <button type="button" className="btn btn-small" onClick={() => restart()} disabled={stepIndex === 0}>
          Restart
        </button>
      </div>

      <div className="loading-controls">
        <label className="field field-narrow">
          <span>Body</span>
          <select value={bodyId} onChange={(e) => restart({ bodyId: e.target.value })}>
            {SOURCED_BODY_IDS.map((id) => (
              <option key={id} value={id}>
                {findBody(id).name}
              </option>
            ))}
          </select>
        </label>
        <Segmented
          label="Tutorial"
          options={[
            { value: "load", label: "Load" },
            { value: "unload", label: "Unload" },
          ]}
          value={mode}
          onChange={(m) => restart({ mode: m })}
        />
      </div>
      {unsourced && (
        <p className="muted small">
          No sourced tutorial for the {findBody(appBodyId).name} yet — its manual hasn't been checked, so it isn't guessed at here.
        </p>
      )}

      <dl className="loading-state" aria-label={`${body.name} state`}>
        {READOUT.filter((r) => !r.onlyIf || r.onlyIf(state, bodyId)).map((r) => (
          <div key={r.key}>
            <dt>{r.label}</dt>
            <dd>{r.values[String(state[r.key])] ?? String(state[r.key])}</dd>
          </div>
        ))}
        <div>
          <dt>Counter</dt>
          <dd>{String(state.counter)}</dd>
        </div>
      </dl>

      <div className="loading-step" aria-live="polite">
        {done ? (
          <p className="gear-name">{mode === "load" ? `${body.name} loaded — ready to shoot.` : "Roll unloaded."}</p>
        ) : (
          <>
            <p className="muted small">
              Step {stepIndex + 1} of {tutorial.steps.length}
            </p>
            <p className="gear-name">{current.text}</p>
          </>
        )}
        {previous?.note && <p className="muted small">{previous.note}</p>}
        {feedback && <p className={feedback.tone === "warn" ? "warn-text small" : "small"}>{feedback.text}</p>}
      </div>

      {!done && (
        <div className="loading-actions" role="group" aria-label="Actions">
          {palette.map((a) => (
            <button key={a.id} type="button" className="btn btn-small" onClick={() => act(a.id)}>
              {a.label}
            </button>
          ))}
        </div>
      )}

      <div className="loading-nav">
        <button type="button" className="btn btn-small" onClick={() => { setStepIndex((i) => Math.max(0, i - 1)); setFeedback(null); }} disabled={stepIndex === 0}>
          Back a step
        </button>
      </div>

      <p className="hint">
        Source:{" "}
        <a href={tutorial.source.sourceUrl} target="_blank" rel="noreferrer">
          {tutorial.source.sourceName}
        </a>
        , {tutorial.source.pages}.{tutorial.source.notes ? ` ${tutorial.source.notes}` : ""} A rehearsal only — with real film, work in
        the shade of your body, never in direct sun.
      </p>
    </section>
  );
}
