import { useState } from "react";
import { t } from "../i18n";
import { lastBackup, readLocal } from "../services/backupIo";
import { shouldRemind } from "../state/backup";

const SNOOZE_KEY = "rangefinder-backup-snooze";

/** A quiet monthly nudge to back up, on the pages where records are kept. */
export default function BackupReminder() {
  const [hidden, setHidden] = useState(() => {
    try {
      const until = Number(localStorage.getItem(SNOOZE_KEY));
      return Number.isFinite(until) && until > Date.now();
    } catch {
      return false;
    }
  });
  if (hidden || !shouldRemind(readLocal(), lastBackup())) return null;
  return (
    <div className="cx-tip bk-remind" role="note">
      <p>{t("bk.remind")}</p>
      <div className="cx-actions">
        <a className="btn" href="#/collect/backup">
          {t("bk.remindGo")}
        </a>
        <button
          type="button"
          className="cx-link"
          onClick={() => {
            try {
              localStorage.setItem(SNOOZE_KEY, String(Date.now() + 7 * 86_400_000));
            } catch {
              // Not remembered: it may ask again next time.
            }
            setHidden(true);
          }}
        >
          {t("bk.later")}
        </button>
      </div>
    </div>
  );
}
