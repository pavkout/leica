import { useEffect, useRef, useState } from "react";
import { EXERCISES, LEVELS, TO_UNLOCK, checkRules, exercisesIn, openLevels, parseShutter, predictionsFor, type Exercise, type Field, type RealShot } from "../data/labCourse";
import { formatShutter } from "../data/gear";
import { t, tn, useLang } from "../i18n";
import { handIn, useLabWork } from "../state/labStore";
import { scanThumbnail } from "../state/shotLogStore";
import { readExif } from "../utils/exif";

const num = (text: string) => {
  const n = Number(text.trim().replace(",", ".").replace(/^f\//i, ""));
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

/**
 * Photography Lab (#43): the course for your own camera. Four levels of
 * three exercises; each one says what to shoot, predicts what the picture
 * will show, and checks the settings in the photo you hand in.
 */
export default function PhotoLab() {
  useLang();
  const work = useLabWork();
  const passed = new Set([...work.values()].filter((w) => w.passed).map((w) => w.id));
  const open = openLevels(passed);
  const [level, setLevel] = useState(() => open[open.length - 1]);
  const [exId, setExId] = useState<string | null>(null);
  const ex = EXERCISES.find((e) => e.id === exId);

  // Loading the saved work may open more levels: follow the furthest one until the user picks.
  const picked = useRef(false);
  useEffect(() => {
    if (!picked.current) setLevel(open[open.length - 1]);
  }, [open.length]); // eslint-disable-line react-hooks/exhaustive-deps

  if (ex) return <ExerciseView ex={ex} onBack={() => setExId(null)} />;

  return (
    <section className="panel stage-lab cx" aria-label={t("tool.lab")}>
      <p className="cx-summary">{t("lab.intro")}</p>
      <p className="lab-progress">
        <span className="lab-progress-n">{tn("lab.progress", passed.size, { total: EXERCISES.length })}</span>
        <span className="lab-bar" aria-hidden="true">
          <span style={{ transform: `scaleX(${passed.size / EXERCISES.length})` }} />
        </span>
      </p>

      <div className="lab-levels" role="tablist" aria-label={t("lab.levels")}>
        {LEVELS.map((l) => {
          const isOpen = open.includes(l);
          return (
            <button
              key={l}
              type="button"
              role="tab"
              aria-selected={l === level}
              className={`lab-level${l === level ? " lab-level-on" : ""}`}
              disabled={!isOpen}
              title={isOpen ? undefined : t("lab.locked", { n: TO_UNLOCK, level: l - 1 })}
              onClick={() => ((picked.current = true), setLevel(l))}
            >
              <span className="lab-level-n">{t("lab.level", { n: l })}</span>
              <span className="lab-level-name">{t(`lab.level.${l}`)}</span>
              {!isOpen && <span className="lab-lock">{t("lab.lockedShort")}</span>}
            </button>
          );
        })}
      </div>
      {!open.includes(level + 1) && level < LEVELS.length && <p className="cx-quiet">{t("lab.locked", { n: TO_UNLOCK, level })}</p>}

      <ul className="lab-list">
        {exercisesIn(level).map((e) => {
          const w = work.get(e.id);
          return (
            <li key={e.id}>
              <button type="button" className="cx-way lab-card" onClick={() => setExId(e.id)}>
                {w?.photo && <img src={w.photo} alt="" className="lab-card-photo" />}
                <span className="cx-way-title">
                  {w?.passed && (
                    <span className="lab-done" aria-label={t("lab.passed")}>
                      ✓{" "}
                    </span>
                  )}
                  {t(`lab.ex.${e.id}`)}
                </span>
                <span className="cx-way-text">{t(`lab.ex.${e.id}.brief`)}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="cx-quiet cx-footnote">{t("lab.privacy")}</p>
    </section>
  );
}

const FIELDS: { f: Field; label: string; placeholder: string }[] = [
  { f: "fNumber", label: "common.aperture", placeholder: "5.6" },
  { f: "shutterSec", label: "common.shutter", placeholder: "1/250" },
  { f: "iso", label: "common.iso", placeholder: "400" },
  { f: "focalMm", label: "lab.field.focal", placeholder: "35" },
  { f: "focusM", label: "lab.field.focus", placeholder: "3" },
];

function show(f: Field, v: number | undefined): string {
  if (v === undefined) return "";
  if (f === "shutterSec") return formatShutter(v).replace(/s$/, "");
  if (f === "focusM") return Number.isFinite(v) ? String(v) : "∞";
  return String(Math.round(v * 10) / 10);
}

function ExerciseView({ ex, onBack }: { ex: Exercise; onBack: () => void }) {
  const work = useLabWork();
  const prev = work.get(ex.id);
  const [photo, setPhoto] = useState<string | undefined>();
  const [meta, setMeta] = useState<{ camera?: string; lens?: string; source: "exif" | "typed"; found: number } | null>(null);
  const [text, setText] = useState<Partial<Record<Field, string>>>({});
  const [looks, setLooks] = useState<boolean | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.scrollIntoView?.({ block: "start" });
  }, []);

  const shot: RealShot = {};
  for (const { f } of FIELDS) {
    const raw = text[f];
    if (raw === undefined || raw.trim() === "") continue;
    const v = f === "shutterSec" ? parseShutter(raw) : f === "focusM" && /^(∞|inf)/i.test(raw.trim()) ? Infinity : num(raw);
    if (v !== undefined) shot[f] = v;
  }
  const results = checkRules(ex, shot);
  const predictions = predictionsFor(ex, shot);
  const allChecked = results.every((r) => r.pass !== null);
  const settingsPass = allChecked && results.every((r) => r.pass);

  async function choose(file: File | undefined) {
    if (!file) return;
    setProblem(null);
    setSaved(null);
    try {
      const [thumb, exif] = await Promise.all([scanThumbnail(file, 480), file.arrayBuffer().then(readExif)]);
      setPhoto(thumb);
      const next: Partial<Record<Field, string>> = { ...text };
      let found = 0;
      const put = (f: Field, v: number | undefined) => {
        if (v === undefined || !ex.needs.includes(f)) return;
        next[f] = show(f, v);
        found++;
      };
      put("fNumber", exif.fNumber);
      put("shutterSec", exif.shutterSec);
      put("iso", exif.iso);
      put("focalMm", exif.focalMm);
      put("focusM", exif.subjectDistanceM);
      setText(next);
      setMeta({ camera: [exif.make, exif.model].filter(Boolean).join(" ") || undefined, lens: exif.lens, source: found ? "exif" : "typed", found });
    } catch {
      setProblem(t("lab.photoError"));
    }
  }

  async function submit() {
    const passed = settingsPass && looks === true;
    const ok = await handIn({
      id: ex.id,
      passed,
      looksRight: looks === true,
      shot,
      source: meta?.source ?? "typed",
      photo,
      camera: meta?.camera,
      lens: meta?.lens,
      at: new Date().toISOString(),
    });
    setSaved(ok ? (passed ? t("lab.saved.pass") : settingsPass ? t("lab.saved.tryLook") : t("lab.saved.trySettings")) : t("passport.storageFull"));
  }

  return (
    <section className="panel stage-lab cx" aria-label={t(`lab.ex.${ex.id}`)}>
      <div ref={ref}>
        <button type="button" className="cx-link" onClick={onBack}>
          ← {t("lab.back")}
        </button>
        <h2 className="cx-editor-title">
          {prev?.passed && <span className="lab-done">✓ </span>}
          {t(`lab.ex.${ex.id}`)}
        </h2>
        <p className="lab-brief">{t(`lab.ex.${ex.id}.brief`)}</p>
        <p className="cx-tip">{t(`lab.ex.${ex.id}.why`)}</p>

        <h3 className="pp-h3">{t("lab.targets")}</h3>
        <ul className="lab-rules">
          {results.map(({ rule, pass }) => (
            <li key={rule.key + JSON.stringify(rule.vars)} className={pass === null ? "" : pass ? "lab-pass" : "lab-fail"}>
              <span aria-hidden="true">{pass === null ? "○" : pass ? "✓" : "✗"}</span> {t(rule.key, rule.vars)}
            </li>
          ))}
        </ul>

        <ol className="cx-flow">
          <li>
            <h3 className="cx-h">{t("lab.step.shoot")}</h3>
            <p>{t("lab.shootHint")}</p>
          </li>
          <li>
            <h3 className="cx-h">{t("lab.step.handIn")}</h3>
            <label className="btn btn-red pp-file">
              {photo ? t("lab.otherPhoto") : t("lab.choosePhoto")}
              <input type="file" accept="image/jpeg,image/*" onChange={(e) => choose(e.target.files?.[0])} />
            </label>
            {problem && <p className="cx-problem">{problem}</p>}
            {photo && <img src={photo} alt={t("lab.yourPhoto")} className="lab-photo" />}
            {meta && (
              <p className="cx-quiet">
                {meta.found ? t("lab.readFrom", { n: meta.found, camera: meta.camera ?? t("lab.theFile") }) : t("lab.noExif")}
                {meta.lens ? ` · ${meta.lens}` : ""}
              </p>
            )}
            {meta?.camera && /leica/i.test(meta.camera) && ex.needs.includes("fNumber") && <p className="cx-tip">{t("lab.leicaAperture")}</p>}
            <p className="cx-quiet">{t("lab.typeHint")}</p>
            <div className="cx-grid">
              {FIELDS.filter(({ f }) => ex.needs.includes(f)).map(({ f, label, placeholder }) => (
                <label key={f} className="field">
                  <span>{t(label)}</span>
                  <input type="text" inputMode={f === "shutterSec" || f === "focusM" ? "text" : "decimal"} value={text[f] ?? ""} placeholder={placeholder} onChange={(e) => setText((x) => ({ ...x, [f]: e.target.value }))} />
                </label>
              ))}
            </div>
          </li>
          <li>
            <h3 className="cx-h">{t("lab.step.compare")}</h3>
            {predictions ? (
              <>
                <p className="lab-predict-h">{t("lab.predicted")}</p>
                <ul className="lab-predict">
                  {predictions.map((p) => (
                    <li key={p.key}>{t(p.key, p.vars)}</li>
                  ))}
                </ul>
                <p>
                  <strong>{t("lab.lookAt")}</strong> {t(`lab.ex.${ex.id}.check`)}
                </p>
                <div className="cx-actions" role="group" aria-label={t("lab.lookAt")}>
                  <button type="button" className={`cx-pick${looks === true ? " cx-pick-on" : ""}`} aria-pressed={looks === true} onClick={() => setLooks(true)}>
                    {t("lab.looks.yes")}
                  </button>
                  <button type="button" className={`cx-pick${looks === false ? " cx-pick-on" : ""}`} aria-pressed={looks === false} onClick={() => setLooks(false)}>
                    {t("lab.looks.no")}
                  </button>
                </div>
                {looks === false && <p className="cx-tip">{t(`lab.ex.${ex.id}.fix`)}</p>}
              </>
            ) : (
              <p className="cx-quiet">{t("lab.needSettings")}</p>
            )}
            {saved && (
              <p className="cx-ok" role="status">
                {saved}
              </p>
            )}
            <div className="cx-actions">
              <button type="button" className="btn btn-red" onClick={submit} disabled={!predictions || looks === null} title={!predictions ? t("lab.needSettings") : looks === null ? t("lab.needLook") : undefined}>
                {t("lab.handIn")}
              </button>
            </div>
            {predictions && looks === null && <p className="cx-quiet">{t("lab.needLook")}</p>}
          </li>
        </ol>
      </div>
    </section>
  );
}
