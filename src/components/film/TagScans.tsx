import { useState } from "react";
import { langTag, t, tn, useLang } from "../../i18n";
import { getString, setString } from "../../services/persistence";
import { rollsOf } from "../../state/shotLog";
import { useShotLog } from "../../state/shotLogStore";
import { writeExif } from "../../utils/exifWrite";
import { fieldsFor } from "../../state/scanTags";
import { locate } from "../../state/track";
import { deleteRoute, startRoute, stopRoute, useTracks } from "../../state/trackStore";
import { formatFNumber } from "../../utils/format";
import { formatShutter } from "../../data/gear";
import { downloadBlob } from "../collector/passportCard";

const ARTIST_KEY = "rangefinder-artist";

/**
 * Tag your scans (#51): the Shot log's settings for a roll, written into the
 * scanned files' EXIF, frame by frame, so Lightroom and photo apps show the
 * camera, lens, aperture, shutter, film and note.
 */
export default function TagScans() {
  useLang();
  const { log } = useShotLog();
  const { tracks, recording } = useTracks();
  const [useGps, setUseGps] = useState(true);
  const rolls = rollsOf(log);
  const [roll, setRoll] = useState(rolls[rolls.length - 1] ?? "");
  const [files, setFiles] = useState<File[]>([]);
  const [artist, setArtist] = useState(() => getString(ARTIST_KEY) ?? "");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const entries = log.filter((e) => e.roll === roll).sort((a, b) => a.frame - b.frame);
  const pairs = files.map((f, i) => ({ file: f, entry: entries[i] }));
  const jpegs = files.filter((f) => /jpe?g$/i.test(f.name) || f.type === "image/jpeg");

  async function write() {
    setBusy(true);
    setStatus(null);
    setString(ARTIST_KEY, artist);
    const out: File[] = [];
    let skipped = 0;
    for (const { file, entry } of pairs) {
      if (!entry) continue;
      try {
        const bytes = writeExif(await file.arrayBuffer(), fieldsFor(entry, artist, useGps ? tracks : []));
        out.push(new File([bytes], file.name, { type: "image/jpeg" }));
      } catch {
        skipped++;
      }
    }
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    try {
      if (out.length > 1 && nav.share && nav.canShare?.({ files: out })) await nav.share({ files: out, title: roll });
      else for (const f of out) downloadBlob(f, f.name);
      setStatus(tn("tag.done", out.length) + (skipped ? ` ${tn("tag.skipped", skipped)}` : ""));
    } catch {
      for (const f of out) downloadBlob(f, f.name);
      setStatus(tn("tag.done", out.length));
    }
    setBusy(false);
  }

  if (rolls.length === 0)
    return (
      <section className="panel stage-tagscans cx" aria-label={t("tool.tagscans")}>
        <p className="cx-summary">{t("tag.intro")}</p>
        <p className="cx-tip">{t("tag.noLog")}</p>
        <div className="cx-actions">
          <a className="btn btn-red" href="#/shoot/shotlog">
            {t("walk.toShotLog")}
          </a>
        </div>
        <Routes tracks={tracks} recording={recording} />
      </section>
    );

  return (
    <section className="panel stage-tagscans cx" aria-label={t("tool.tagscans")}>
      <p className="cx-summary">{t("tag.intro")}</p>
      <ol className="cx-flow">
        <li>
          <h2 className="cx-h">{t("tag.whichRoll")}</h2>
          <label className="field cx-narrow">
            <span>{t("tag.roll")}</span>
            <select value={roll} onChange={(e) => setRoll(e.target.value)}>
              {rolls.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </label>
          <p className="cx-quiet">{tn("tag.framesLogged", entries.length)}</p>
        </li>
        <li>
          <h2 className="cx-h">{t("tag.chooseScans")}</h2>
          <p className="cx-quiet">{t("tag.order")}</p>
          <label className="btn btn-red pp-file">
            {files.length ? t("tag.otherScans") : t("tag.choose")}
            <input type="file" accept="image/jpeg" multiple onChange={(e) => (setStatus(null), setFiles([...(e.target.files ?? [])].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))))} />
          </label>
          {files.length > 0 && jpegs.length < files.length && <p className="cx-problem">{t("tag.onlyJpeg")}</p>}
          {files.length > 0 && files.length !== entries.length && <p className="cx-warn">{t("tag.countDiffers", { files: files.length, frames: entries.length })}</p>}
        </li>
        {files.length > 0 && (
          <li>
            <h2 className="cx-h">{t("tag.check")}</h2>
            <div className="cl-table-wrap">
              <table className="hc-table">
                <thead>
                  <tr>
                    <th>{t("tag.file")}</th>
                    <th>{t("tag.frame")}</th>
                    <th>{t("tag.settings")}</th>
                    <th>{t("tag.place")}</th>
                  </tr>
                </thead>
                <tbody>
                  {pairs.map(({ file, entry }) => (
                    <tr key={file.name} className={entry ? undefined : "hc-attention"}>
                      <td className="tag-file">{file.name}</td>
                      <td>{entry ? entry.frame : "—"}</td>
                      <td>{entry ? `${formatFNumber(entry.fNumber)} · ${formatShutter(entry.shutterSec)} · ${entry.film}` : t("tag.noFrame")}</td>
                      <td>{entry && useGps && locate(tracks, Date.parse(entry.takenAt)) ? "✓" : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <label className="cx-check">
              <input type="checkbox" checked={useGps} onChange={(e) => setUseGps(e.target.checked)} /> {t("tag.addPlaces")}
            </label>
            <label className="field cx-narrow">
              <span>
                {t("tag.artist")} ({t("common.optional")})
              </span>
              <input type="text" value={artist} onChange={(e) => setArtist(e.target.value)} />
            </label>
            {status && (
              <p className="cx-ok" role="status">
                {status}
              </p>
            )}
            <div className="cx-actions">
              <button type="button" className="btn btn-red" disabled={busy || !pairs.some((p) => p.entry)} onClick={write}>
                {busy ? t("tag.writing") : t("tag.write", { n: pairs.filter((p) => p.entry).length })}
              </button>
            </div>
            <p className="cx-quiet">{t("tag.note")}</p>
          </li>
        )}
      </ol>
      <Routes tracks={tracks} recording={recording} />
    </section>
  );
}

function Routes({ tracks, recording }: { tracks: ReturnType<typeof useTracks>["tracks"]; recording: string | null }) {
  const fmt = (ms: number) => new Intl.DateTimeFormat(langTag(), { dateStyle: "medium", timeStyle: "short" }).format(new Date(ms));
  const [failed, setFailed] = useState(false);
  return (
    <div className="cx-block">
      <h2 className="pp-h3">{t("tag.routes")}</h2>
      <p className="cx-quiet">{t("tag.routesHint")}</p>
      <div className="cx-actions">
        {recording ? (
          <button type="button" className="btn btn-red" onClick={stopRoute}>
            {t("tag.stopRoute")}
          </button>
        ) : (
          <button type="button" className="btn" onClick={() => setFailed(!startRoute())}>
            {t("tag.startRoute")}
          </button>
        )}
      </div>
      {recording && <p className="cx-tip">{t("tag.recording")}</p>}
      {failed && <p className="cx-problem">{t("tag.noLocation")}</p>}
      {tracks.length > 0 && (
        <ul className="fs-list">
          {[...tracks].reverse().map((tr) => (
            <li key={tr.id}>
              <span className="fs-name">{fmt(tr.startedAt)}</span>
              <span className="cx-quiet">{tn("tag.fixes", tr.points.length)}</span>
              {tr.id !== recording && (
                <button type="button" className="cx-link" onClick={() => deleteRoute(tr.id)}>
                  {t("common.remove")}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
