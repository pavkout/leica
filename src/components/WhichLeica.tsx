import { useState } from "react";
import { t, useLang } from "../i18n";
import { DEFAULT_ANSWERS, USES, match, type Answers, type Pick, type Reason } from "../physics/matcher";
import { useBag } from "../state/bag";
import type { Body, Lens } from "../data/gear";
import BodyArt from "./gear/BodyArt";
import GearImage from "./gear/GearImage";
import LensArt from "./gear/LensArt";

interface Props {
  /** Put this camera and lens on the simulator and go to it. */
  onTry: (bodyId: string, lensId: string) => void;
}

type Choice<K extends keyof Answers> = { id: Answers[K]; key: string }[];

const MEDIUM: Choice<"medium"> = [
  { id: "film", key: "match.q.medium.film" },
  { id: "digital", key: "match.q.medium.digital" },
  { id: "either", key: "match.q.either" },
];
const FOCUS: Choice<"focus"> = [
  { id: "manual", key: "match.q.focus.manual" },
  { id: "auto", key: "match.q.focus.auto" },
  { id: "either", key: "match.q.either" },
];
const MONO: Choice<"mono"> = [
  { id: "only", key: "match.q.mono.only" },
  { id: "either", key: "match.q.mono.sometimes" },
  { id: "never", key: "match.q.mono.never" },
];
const ERA: Choice<"era"> = [
  { id: "current", key: "match.q.era.current" },
  { id: "classic", key: "match.q.era.classic" },
  { id: "either", key: "match.q.either" },
];

/**
 * Which Leica for me? (#45): six plain questions, one recommendation with
 * its reasons, two alternatives, and ways to try it before a shop: hold it
 * on the simulator, compare the finders, keep it in My Gear, or print it
 * for the dealer.
 */
export default function WhichLeica({ onTry }: Props) {
  useLang();
  const [a, setA] = useState<Answers>(DEFAULT_ANSWERS);
  const [shown, setShown] = useState(false);
  const { savedIds, toggle } = useBag();
  const result = match(a);
  const set = <K extends keyof Answers>(k: K, v: Answers[K]) => setA((x) => ({ ...x, [k]: v }));

  function picks<K extends "medium" | "focus" | "mono" | "era">(k: K, choices: Choice<K>) {
    return (
      <div className="cx-actions" role="group" aria-label={t(`match.q.${k}`)}>
        {choices.map((c) => (
          <button key={String(c.id)} type="button" className={`cx-pick${a[k] === c.id ? " cx-pick-on" : ""}`} aria-pressed={a[k] === c.id} onClick={() => set(k, c.id)}>
            {t(c.key)}
          </button>
        ))}
      </div>
    );
  }

  return (
    <section className="panel stage-matcher cx" aria-label={t("tool.matcher")}>
      <p className="cx-summary">{t("match.intro")}</p>
      <ol className="cx-flow">
        <li>
          <h2 className="cx-h">{t("match.q.medium")}</h2>
          {picks("medium", MEDIUM)}
        </li>
        <li>
          <h2 className="cx-h">{t("match.q.focus")}</h2>
          <p className="cx-quiet">{t("match.q.focus.hint")}</p>
          {picks("focus", FOCUS)}
        </li>
        <li>
          <h2 className="cx-h">{t("match.q.uses")}</h2>
          <div className="cx-actions" role="group" aria-label={t("match.q.uses")}>
            {USES.map((u) => {
              const on = a.uses.includes(u);
              return (
                <button key={u} type="button" className={`cx-pick${on ? " cx-pick-on" : ""}`} aria-pressed={on} onClick={() => set("uses", on ? a.uses.filter((x) => x !== u) : [...a.uses, u])}>
                  {t(`match.use.${u}`)}
                </button>
              );
            })}
          </div>
        </li>
        <li>
          <h2 className="cx-h">{t("match.q.glasses")}</h2>
          <div className="cx-actions" role="group" aria-label={t("match.q.glasses")}>
            {[true, false].map((g) => (
              <button key={String(g)} type="button" className={`cx-pick${a.glasses === g ? " cx-pick-on" : ""}`} aria-pressed={a.glasses === g} onClick={() => set("glasses", g)}>
                {g ? t("common.yes") : t("common.no")}
              </button>
            ))}
          </div>
        </li>
        <li>
          <h2 className="cx-h">{t("match.q.mono")}</h2>
          {picks("mono", MONO)}
        </li>
        <li>
          <h2 className="cx-h">{t("match.q.era")}</h2>
          {picks("era", ERA)}
          <div className="cx-actions">
            <button type="button" className="btn btn-red" onClick={() => setShown(true)}>
              {t("match.show")}
            </button>
          </div>
        </li>
      </ol>

      {shown &&
        (result ? (
          <div className="mt-result" aria-live="polite">
            <h2 className="cx-h">{t("match.for")}</h2>
            <BodyCard pick={result.body} />
            {result.lenses.map((l, i) => (
              <LensCard key={l.item.id} pick={l} first={i === 0} fixed={!!result.body.item.fixedLensId} />
            ))}
            <div className="cx-actions">
              {result.lenses[0] && (
                <button type="button" className="btn btn-red" onClick={() => onTry(result.body.item.id, result.lenses[0].item.id)}>
                  {t("match.hold")}
                </button>
              )}
              {result.body.item.rangefinder && (
                <a className="btn" href="#/learn/finders">
                  {t("match.finders")}
                </a>
              )}
              <button
                type="button"
                className="btn"
                onClick={() => {
                  if (!savedIds.body.has(result.body.item.id)) toggle("body", result.body.item.id);
                  for (const l of result.lenses) if (!savedIds.lens.has(l.item.id)) toggle("lens", l.item.id);
                }}
                disabled={savedIds.body.has(result.body.item.id) && result.lenses.every((l) => savedIds.lens.has(l.item.id))}
              >
                {savedIds.body.has(result.body.item.id) && result.lenses.every((l) => savedIds.lens.has(l.item.id)) ? t("match.saved") : t("match.save")}
              </button>
              <button type="button" className="btn" onClick={() => window.print()}>
                {t("match.print")}
              </button>
            </div>
            {result.alternatives.length > 0 && (
              <>
                <h3 className="pp-h3">{t("match.also")}</h3>
                <ul className="mt-alts">
                  {result.alternatives.map((p) => (
                    <li key={p.item.id}>
                      <strong>{p.item.name}</strong> · {p.item.year} · <Reasons reasons={distinct(p.reasons, result.body.reasons)} inline />
                    </li>
                  ))}
                </ul>
              </>
            )}
            <p className="cx-tip">{t("match.honest")}</p>
          </div>
        ) : (
          <p className="cx-problem">{t("match.none")}</p>
        ))}
    </section>
  );
}

/** What sets an alternative apart: its reasons the main pick doesn't share, then the rest. */
function distinct(reasons: Reason[], main: Reason[]): Reason[] {
  const shared = new Set(main.map((r) => r.key));
  return [...reasons.filter((r) => !shared.has(r.key)), ...reasons.filter((r) => shared.has(r.key))].slice(0, 2);
}

function Reasons({ reasons, inline }: { reasons: Reason[]; inline?: boolean }) {
  if (inline) return <span className="cx-quiet">{reasons.map((r) => t(r.key, r.vars)).join(" ")}</span>;
  return (
    <ul className="mt-reasons">
      {reasons.map((r) => (
        <li key={r.key} className={r.good ? "lab-pass" : "lab-fail"}>
          <span aria-hidden="true">{r.good ? "✓" : "!"}</span> {t(r.key, r.vars)}
        </li>
      ))}
    </ul>
  );
}

function BodyCard({ pick }: { pick: Pick<Body> }) {
  const b = pick.item;
  return (
    <div className="cx-plate mt-card">
      <div className="mt-art">
        <GearImage kind="bodies" id={b.id} alt="">
          <BodyArt body={b} />
        </GearImage>
      </div>
      <p className="pp-cert-label">{t("common.camera")}</p>
      <p className="cx-plate-no">{b.name}</p>
      <p className="cx-source">
        {b.year} · {b.medium === "film" ? t("match.film35") : t("match.mp", { mp: b.megapixels?.[0] ?? "" })}
        {b.rangefinder ? ` · ${t("match.finderMag", { m: b.rangefinder.magnification })}` : ""}
      </p>
      <Reasons reasons={pick.reasons} />
    </div>
  );
}

function LensCard({ pick, first, fixed }: { pick: Pick<Lens>; first: boolean; fixed: boolean }) {
  const l = pick.item;
  return (
    <div className="cx-block mt-card">
      <div className="mt-art mt-art-lens">
        <GearImage kind="lenses" id={l.id} alt="">
          <LensArt lens={l} />
        </GearImage>
      </div>
      <p className="pp-cert-label">{fixed ? t("match.builtIn") : first ? t("match.firstLens") : t("match.secondLens")}</p>
      <p className="cx-plate-what">{l.name}</p>
      <p className="cx-source">
        {l.year} · f/{l.maxAperture}
        {l.classic ? ` · ${t("match.discontinued")}` : ""}
      </p>
      <Reasons reasons={pick.reasons} />
    </div>
  );
}
