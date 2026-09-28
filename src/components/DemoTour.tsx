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

  const steps = DEMO_STEPS.length - 1;
  const stepAction =
    step.id === "mount" ? (
      <button type="button" className="btn btn-small btn-red" onClick={() => actions.selectLens(DEMO.lensId)} disabled={state.lensFocalMm === 50}>
        Mount the 50 mm
      </button>
    ) : step.id === "live" ? (
      <button type="button" className="btn btn-small btn-red" onClick={actions.openLive}>
        Open LIVE
      </button>
    ) : null;

  return (
    <section className="demo-tour" role="region" aria-label="60-second tour">
      <div className="demo-tour-head">
        {/* Progress as a scale: one tick per step, the current one on the red index. */}
        <span className="demo-tour-ticks" aria-hidden="true">
          {Array.from({ length: steps }, (_, i) => (
            <i key={i} className={finished || i < index ? "demo-tick-done" : i === index ? "demo-tick-on" : undefined} />
          ))}
        </span>
        <span className="demo-tour-meta">
          {finished ? "Done" : `Step ${index + 1} of ${steps}`} · {formatSec(finished ? summary.totalSec : elapsed)}
        </span>
        <button type="button" className="demo-tour-exit" onClick={onExit} aria-label="Exit the tour">
          <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
            <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.6" />
          </svg>
        </button>
      </div>
      <div className="demo-tour-body" aria-live="polite">
        <h2 ref={heading} tabIndex={-1} className="demo-tour-title">
          {step.title}
        </h2>
        <p className="demo-tour-text">{step.instruction}</p>
      </div>

      {finished ? (
        <>
          <p className="demo-tour-card">{setupSummary}</p>
          <dl className="demo-tour-times">
            {timings.map((t) => (
              <div key={t.id}>
                <dt>{DEMO_STEPS.find((s) => s.id === t.id)!.title}</dt>
                <dd>{t.skipped ? "Skipped" : `${t.seconds.toFixed(1)} s`}</dd>
              </div>
            ))}
            <div className="demo-tour-total">
              <dt>{summary.underBudget ? "Under a minute" : "Over the one-minute budget"}</dt>
              <dd>{summary.totalSec.toFixed(0)} s</dd>
            </div>
          </dl>
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
          {stepAction}
          <button
            type="button"
            className="btn btn-small demo-tour-skip"
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
