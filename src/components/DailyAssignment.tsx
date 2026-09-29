import { useMemo, useState } from "react";
import { assignmentFor, gradeFrame, localDay, streak } from "../physics/assignment";
import { ASSIGNMENTS } from "../data/assignments";
import { getString, setString } from "../services/persistence";
import type { Frame } from "../state/rollExport";

interface Props {
  /** The frames on the current roll or card; today's are graded. */
  frames: Frame[];
  /** Go to the camera to shoot the brief. */
  onShoot: () => void;
}

interface HandedIn {
  day: string;
  assignmentId: string;
  caption: string;
  /** A small JPEG of the frame, so the answer survives rewinding the roll. */
  thumb: string;
}

const KEY = "rangefinder-assignments";
const KEEP = 60;

function load(): HandedIn[] {
  try {
    const list = JSON.parse(getString(KEY) ?? "[]") as HandedIn[];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

/** A thumbnail of a frame's image, for the answers roll. */
function thumbnail(url: string, width = 280): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = width;
      c.height = Math.round((width * img.naturalHeight) / img.naturalWidth);
      c.getContext("2d")?.drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL("image/jpeg", 0.72));
    };
    img.onerror = () => resolve("");
    img.src = url;
  });
}

/**
 * One brief a day, the same for everyone. Frames taken today are graded
 * against its rules from their saved settings; hand in one that passes to
 * keep the streak going.
 */
export default function DailyAssignment({ frames, onShoot }: Props) {
  const today = localDay(new Date());
  const brief = assignmentFor(today);
  const [handedIn, setHandedIn] = useState<HandedIn[]>(load);
  const doneToday = handedIn.find((h) => h.day === today);
  const days = streak(
    handedIn.map((h) => h.day),
    today,
  );

  const todays = useMemo(
    () =>
      frames
        .filter((f) => f.meta.takenAt && localDay(new Date(f.meta.takenAt)) === today)
        .map((f) => ({ frame: f, grade: gradeFrame(brief, f.meta) }))
        .sort((a, b) => b.grade.passed - a.grade.passed || b.frame.number - a.frame.number),
    [frames, brief, today],
  );

  async function handIn(f: Frame) {
    const entry: HandedIn = { day: today, assignmentId: brief.id, caption: f.caption, thumb: await thumbnail(f.url) };
    const next = [entry, ...handedIn.filter((h) => h.day !== today)].slice(0, KEEP);
    setHandedIn(next);
    setString(KEY, JSON.stringify(next));
  }

  return (
    <section className="panel stage-assignment" aria-label="Today's assignment">
      <div className="as-head">
        <p className="as-date">{new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}</p>
        <p className="as-streak" aria-label={`Streak: ${days} day${days === 1 ? "" : "s"}`}>
          <b>{days}</b> day{days === 1 ? "" : "s"} in a row
        </p>
      </div>

      <h2 className="as-title">{brief.title}</h2>
      <p className="as-brief">{brief.brief}</p>
      <p className="muted">{brief.lesson}</p>

      <ul className="as-rules" aria-label="What counts">
        {brief.rules.map((r) => (
          <li key={r.label}>{r.label}</li>
        ))}
      </ul>

      {doneToday ? (
        <div className="as-done">
          {doneToday.thumb && <img src={doneToday.thumb} alt="" />}
          <div>
            <p className="as-done-title">Handed in. Come back tomorrow for the next brief.</p>
            <p className="muted small">{doneToday.caption}</p>
          </div>
        </div>
      ) : (
        <button type="button" className="btn btn-red as-shoot" onClick={onShoot}>
          Go and shoot it
        </button>
      )}

      {todays.length > 0 && (
        <div className="as-today">
          <h3>Today&apos;s frames</h3>
          <ul className="as-frames">
            {todays.map(({ frame, grade }) => (
              <li key={frame.id} className={grade.complete ? "as-frame-pass" : undefined}>
                <img src={frame.url} alt={`Frame ${frame.number}`} />
                <div className="as-frame-body">
                  <p className="as-frame-caption">
                    #{frame.number} · {frame.caption}
                  </p>
                  <ul className="as-checks">
                    {grade.checks.map((c) => (
                      <li key={c.label} className={c.pass ? "as-pass" : "as-fail"}>
                        <span aria-hidden="true">{c.pass ? "✓" : "✕"}</span> {c.label}
                        <span className="visually-hidden">{c.pass ? ": passed" : ": not yet"}</span>
                      </li>
                    ))}
                  </ul>
                  {grade.complete && !doneToday && (
                    <button type="button" className="btn btn-small btn-red" onClick={() => void handIn(frame)}>
                      Hand this one in
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {handedIn.length > 0 && (
        <div className="as-history">
          <h3>Your answers</h3>
          <ul className="as-roll">
            {handedIn.map((h) => (
              <li key={h.day}>
                {h.thumb ? <img src={h.thumb} alt="" /> : <span className="as-roll-blank" />}
                <span className="as-roll-day">{h.day}</span>
                <span className="as-roll-title">{ASSIGNMENTS.find((a) => a.id === h.assignmentId)?.title ?? h.assignmentId}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="hint">
        Graded from the settings saved with each frame (aperture, distance, speed, lens, exposure), not from what&apos;s in the picture. Answers are
        kept on this device.
      </p>
    </section>
  );
}
