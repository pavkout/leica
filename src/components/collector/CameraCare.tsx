import { t, useLang, langTag } from "../../i18n";
import { useCollection } from "../../state/collectionStorage";
import { serviceStatus, timeline } from "../../state/passport";
import { usePassports } from "../../state/passportStore";

// Leica's own pages, checked 2026-09-30: manuals and data sheets (including
// heritage cameras), repair and maintenance worldwide, and contact.
const LEICA_DOWNLOADS = "https://leica-camera.com/en-int/downloads";
const LEICA_REPAIR = "https://leica-camera.com/en-int/service-support/repair-maintenance";
const LEICA_CONTACT = "https://leica-camera.com/en-int/service-contact";

const CARE = ["store", "exercise", "batteries", "lenses", "clean", "film"] as const;

/**
 * Manuals and care (#55): where each piece's manual is (Leica's own
 * downloads), when it was last serviced (from its passport), the workshops
 * the owner has used, and plain care habits that keep old cameras working.
 */
export default function CameraCare() {
  useLang();
  const items = useCollection().filter((i) => i.kind !== "accessory");
  const passports = usePassports();
  const today = new Date();
  const fmt = (iso: string) => new Intl.DateTimeFormat(langTag(), { year: "numeric", month: "long" }).format(new Date(iso));

  // The workshops the owner named in their passports' service and repair entries.
  const workshops = new Map<string, { last: string; count: number }>();
  for (const p of passports.values())
    for (const e of timeline(p))
      if ((e.type === "service" || e.type === "repair") && e.by) {
        const w = workshops.get(e.by);
        workshops.set(e.by, { last: !w || e.date > w.last ? e.date : w.last, count: (w?.count ?? 0) + 1 });
      }

  return (
    <section className="panel stage-care cx" aria-label={t("tool.care")}>
      <p className="cx-summary">{t("care.intro")}</p>

      <h2 className="cx-h">{t("care.yours")}</h2>
      {items.length === 0 ? (
        <p className="cx-tip">{t("passport.empty")}</p>
      ) : (
        <ul className="pp-list">
          {items.map((i) => {
            const p = passports.get(i.id);
            const svc = p ? serviceStatus(p, today) : null;
            return (
              <li key={i.id} className="care-item">
                <p className="pp-row-name">{i.name}</p>
                <p className={svc?.due ? "fs-exp-warn" : "cx-quiet"}>
                  {svc?.last ? (svc.due ? t("care.due", { date: fmt(svc.last) }) : t("care.last", { date: fmt(svc.last) })) : t("care.noService")}
                </p>
                <div className="cx-actions">
                  <a className="btn" href={LEICA_DOWNLOADS} target="_blank" rel="noreferrer">
                    {t("care.manual")}
                  </a>
                  <a className="btn" href="#/collect/passport">
                    {t("care.record")}
                  </a>
                  {i.kind === "body" && (
                    <a className="btn" href={`#/collect/health?item=${encodeURIComponent(i.id)}`}>
                      {t("passport.add.health")}
                    </a>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <p className="cx-quiet">{t("care.manualNote")}</p>

      <h2 className="cx-h">{t("care.workshops")}</h2>
      {workshops.size === 0 ? (
        <p className="cx-quiet">{t("care.noWorkshops")}</p>
      ) : (
        <ul className="fs-list">
          {[...workshops.entries()].map(([name, w]) => (
            <li key={name}>
              <span className="fs-name">{name}</span>
              <span className="cx-quiet">{t("care.workshopLine", { n: w.count, date: fmt(w.last) })}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="cx-actions">
        <a className="btn" href={LEICA_REPAIR} target="_blank" rel="noreferrer">
          {t("care.leicaRepair")}
        </a>
        <a className="btn" href={LEICA_CONTACT} target="_blank" rel="noreferrer">
          {t("care.leicaContact")}
        </a>
      </div>

      <h2 className="cx-h">{t("care.habits")}</h2>
      <ul className="care-habits">
        {CARE.map((c) => (
          <li key={c}>
            <p className="hc-check-title">{t(`care.h.${c}`)}</p>
            <p className="cx-quiet">{t(`care.h.${c}.how`)}</p>
          </li>
        ))}
      </ul>
      <p className="cx-quiet cx-footnote">{t("care.honest")}</p>
    </section>
  );
}
