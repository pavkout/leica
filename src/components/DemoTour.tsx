import { useEffect, useRef, useState } from "react";
import { DEMO, DEMO_STEPS, demoSummary, type DemoActions, type DemoState, type StepTiming } from "../state/demoScript";

interface Props {
  state: DemoState;
  actions: DemoActions;
  /** One-line summary of the setup for the final card. */
  setupSummary: string;
  saved: boolean;
  onSaveToBag: () => void;
  onExit: () => void;
}

/** After a step is done, pause briefly so its effect (e.g. the lens locking on) is seen before moving on. */
const LINGER_MS: Partial<Record<(typeof DEMO_STEPS)[number]["id"], number>> = { mount: 1400, focus: 600, aperture: 700, live: 300 };

function formatSec(s: number) {
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}

/** Signature 60-second demo (feature #35): runs DEMO_STEPS over the app's real components. */
export default function DemoTour({ state, actions, setupSummary, saved, onSaveToBag, onExit }: Props) {
  const [index, setIndex] = useState(0);
  const [timings, setTimings] = useState<StepTiming[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const started = useRef(performance.now());
  const stepStarted = useRef(performance.now());
  const advancing = useRef(-1);
  const heading = useRef<HTMLHeadingElement>(null);
  const actionsRef = useRef(actions);
  actionsRef.current = actions;
  const step = DEMO_STEPS[index];
  const finished = step.id === "finish";

  // Enter a step: set the app up, bring its panel into view, move focus to the card.
  // The completion check skips the commit the step was entered in (its state is from before
  // the step's own setup), and re-checks once that setup has applied.
  const justEntered = useRef(-1);
  const [recheck, setRecheck] = useState(0);
  useEffect(() => {
    justEntered.current = index;
    const t = window.setTimeout(() => {
      justEntered.current = -1;
      setRecheck((n) => n + 1);
    }, 0);
    stepStarted.current = performance.now();
    performance.mark(`demo:${step.id}:start`);
    step.enter(actionsRef.current);
    actionsRef.current.reveal(step.panel);
    heading.current?.focus({ preventScroll: true });
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  useEffect(() => {
    if (finished) return;
    const id = window.setInterval(() => setElapsed((performance.now() - started.current) / 1000), 250);
    return () => window.clearInterval(id);
  }, [finished]);

  const advance = (skipped: boolean) => {
    if (advancing.current === index) return;
    advancing.current = index;
    performance.mark(`demo:${step.id}:end`);
    performance.measure(`demo:${step.id}`, `demo:${step.id}:start`, `demo:${step.id}:end`);
    setTimings((t) => [...t, { id: step.id, seconds: (performance.now() - stepStarted.current) / 1000, skipped }]);
    setIndex((i) => Math.min(i + 1, DEMO_STEPS.length - 1));
  };

  // A step finishes itself when the app's real state says it's done. Once achieved it stays
  // achieved: turning a little past the aligned patch during the pause mustn't cancel the advance.
  const achieved = useRef(-1);
  useEffect(() => {
    if (finished || justEntered.current === index || achieved.current === index || !step.done(state)) return;
    achieved.current = index;
    window.setTimeout(() => advance(false), LINGER_MS[step.id] ?? 400);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, index, recheck]);

  const summary = demoSummary(timings);

  return (
    <section className="demo-tour" role="region" aria-label="60-second tour">
      <div className="demo-tour-head">
        <span className="muted small">
          {finished ? "Done" : `Step ${index + 1} of ${DEMO_STEPS.length - 1}`} · {formatSec(finished ? summary.totalSec : elapsed)}
        </span>
        <button type="button" className="demo-tour-exit" onClick={onExit} aria-label="Exit the tour">
          ×
        </button>
      </div>
      <div aria-live="polite">
        <h2 ref={heading} tabIndex={-1} className="demo-tour-title">
          {step.title}
        </h2>
        <p className="small">{step.instruction}</p>
      </div>

      {step.id === "mount" && (
        <button type="button" className="btn btn-small btn-red" onClick={() => actions.selectLens(DEMO.lensId)} disabled={state.lensFocalMm === 50}>
          Mount the 50 mm
        </button>
      )}
      {step.id === "live" && (
        <button type="button" className="btn btn-small btn-red" onClick={actions.openLive}>
          Open LIVE
        </button>
      )}

      {finished ? (
        <>
          <p className="gear-name demo-tour-card">{setupSummary}</p>
          <ul className="demo-tour-times small">
            {timings.map((t) => (
              <li key={t.id}>
                {DEMO_STEPS.find((s) => s.id === t.id)!.title}: {t.seconds.toFixed(1)} s{t.skipped ? " (skipped)" : ""}
              </li>
            ))}
          </ul>
          <p className="small">
            {summary.underBudget ? `Under a minute: ${summary.totalSec.toFixed(0)} s.` : `${summary.totalSec.toFixed(0)} s — over the one-minute budget.`}
          </p>
          <div className="demo-tour-actions">
            <button type="button" className="btn btn-small" onClick={onSaveToBag} disabled={saved}>
              {saved ? "Saved to My Leica Bag" : "Save to My Leica Bag"}
            </button>
            <button type="button" className="btn btn-small btn-red" onClick={onExit}>
              Finish
            </button>
          </div>
        </>
      ) : (
        <div className="demo-tour-actions">
          <button
            type="button"
            className="btn btn-small"
            onClick={() => {
              step.skip(actions);
              advance(true);
            }}
          >
            Skip
          </button>
        </div>
      )}
    </section>
  );
}
