import { useEffect, useState } from "react";
import { langTag, t, useLang } from "../i18n";
import { lastBackup, makeBackup, markBackedUp, restoreBackup } from "../services/backupIo";
import { backupName, daysSinceBackup, parseBackup, summarize, type Backup, type Summary } from "../state/backup";
import { downloadBlob, shareOrDownload } from "./collector/passportCard";

function SummaryList({ s }: { s: Summary }) {
  const rows: [string, number][] = [
    ["bk.s.items", s.items],
    ["bk.s.passports", s.passports],
    ["bk.s.shotLog", s.shotLog],
    ["bk.s.filmRolls", s.filmRolls],
    ["bk.s.lab", s.lab],
    ["bk.s.frames", s.frames],
    ["bk.s.walks", s.walks],
  ];
  return (
    <ul className="fs-list">
      {rows.map(([k, n]) => (
        <li key={k}>
          <span className="fs-name">{t(k)}</span>
          <span className="cx-mono">{n}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Backup and restore (#56): everything the app keeps on this device, saved
 * as one file (to Files, iCloud Drive, Google Drive or a computer), and put
 * back on this or another device.
 */
export default function BackupPage() {
  useLang();
  const [last, setLast] = useState(lastBackup);
  const [current, setCurrent] = useState<Summary | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [incoming, setIncoming] = useState<Backup | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const days = daysSinceBackup(last);

  useEffect(() => {
    void makeBackup().then((b) => setCurrent(summarize(b)));
  }, []);

  async function save() {
    setBusy(true);
    setStatus(null);
    const b = await makeBackup();
    const blob = new Blob([JSON.stringify(b)], { type: "application/json" });
    const how = await shareOrDownload(blob, backupName(), t("bk.title"));
    if (how !== "cancelled") {
      markBackedUp();
      setLast(new Date().toISOString());
      setStatus(t(how === "shared" ? "bk.shared" : "bk.saved", { name: backupName() }));
    }
    setBusy(false);
  }

  async function choose(file: File | undefined) {
    if (!file) return;
    setProblem(null);
    const parsed = parseBackup(await file.text());
    if (!parsed.ok) return setProblem(t(`bk.err.${parsed.reason}`));
    setIncoming(parsed.backup);
  }

  async function restore() {
    if (!incoming) return;
    setBusy(true);
    // A copy of what's here first, so a restore can always be undone.
    const before = await makeBackup();
    downloadBlob(new Blob([JSON.stringify(before)], { type: "application/json" }), `before-restore-${backupName()}`);
    const ok = await restoreBackup(incoming);
    setBusy(false);
    if (!ok) return setProblem(t("bk.err.restore"));
    location.reload();
  }

  const fmt = (iso: string) => new Intl.DateTimeFormat(langTag(), { dateStyle: "long", timeStyle: "short" }).format(new Date(iso));

  return (
    <section className="panel stage-backup cx" aria-label={t("tool.backup")}>
      <p className="cx-summary">{t("bk.intro")}</p>
      <p className={days === null || days >= 30 ? "cx-problem" : "cx-ok"}>{days === null ? t("bk.never") : t("bk.last", { date: fmt(last!), n: days })}</p>

      <h2 className="cx-h">{t("bk.onDevice")}</h2>
      {current ? <SummaryList s={current} /> : <p className="cx-quiet">…</p>}
      <div className="cx-actions">
        <button type="button" className="btn btn-red" onClick={save} disabled={busy}>
          {t("bk.save")}
        </button>
      </div>
      {status && (
        <p className="cx-ok" role="status">
          {status}
        </p>
      )}
      <p className="cx-quiet">{t("bk.where")}</p>
      <p className="cx-tip">{t("bk.noKey")}</p>

      <h2 className="cx-h">{t("bk.restoreTitle")}</h2>
      <p className="cx-quiet">{t("bk.restoreHint")}</p>
      <label className="btn pp-file">
        {t("bk.choose")}
        <input type="file" accept=".json,application/json" onChange={(e) => choose(e.target.files?.[0])} />
      </label>
      {problem && <p className="cx-problem">{problem}</p>}
      {incoming && (
        <div className="cx-block">
          <p>
            <strong>{t("bk.fromDate", { date: fmt(incoming.createdAt) })}</strong>
          </p>
          <SummaryList s={summarize(incoming)} />
          <p className="cx-warn">{t("bk.replaceWarn")}</p>
          <div className="cx-actions">
            <button type="button" className="btn btn-red" onClick={restore} disabled={busy}>
              {t("bk.restore")}
            </button>
            <button type="button" className="btn" onClick={() => setIncoming(null)}>
              {t("common.cancel")}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
