import { lookupSerialFacts, rarityNote, serialConflicts } from "../../state/serialFacts";
import type { AiFindings } from "../../state/collection";
import { t } from "../../i18n";

interface Props {
  kind: "body" | "lens";
  serial: string;
  /** What the owner, a seller or an AI called it, to check against the list. */
  claim?: { model?: string | null; year?: string | number | null };
  ai?: AiFindings;
  /** Offered when the list names a model: fill the item's name with it. */
  onUseName?: (name: string, bodyId?: string) => void;
}

/**
 * What the factory serial lists say about a number, shown like an engraving:
 * the number, then the camera it belongs to. Sourced facts only. A claim that
 * disagrees (the seller's, the AI's) is flagged, never quietly corrected.
 */
export default function SerialFactsCard({ kind, serial, claim, ai, onUseName }: Props) {
  const r = lookupSerialFacts(kind, serial);
  if (r.status === "invalid")
    return serial.trim() ? <p className="cx-quiet">{t("col.serial.invalid")}</p> : null;
  if (r.status === "unknown")
    return (
      <p className="cx-quiet" role="status">
        {r.reason} {t("col.serial.cantTell")}
      </p>
    );

  const f = r.facts;
  const rarity = rarityNote(f);
  const conflicts = [...new Set([...serialConflicts(f, claim ?? {}), ...(ai ? serialConflicts(f, { model: ai.model }) : [])])];
  const n = serial.replace(/\D/g, "");
  return (
    <div className="cx-plate" role="status" aria-label={t("col.serial.says")}>
      <p className="cx-plate-no" aria-hidden="true">
        No. {Number(n).toLocaleString("en-GB").replace(/,/g, " ")}
      </p>
      <p className="cx-plate-what">
        {f.model ? (
          <>
            {t("col.serial.body", { model: `${f.model}${f.variant ? `, ${f.variant}` : ""}`, year: f.year })}
          </>
        ) : (
          <>{t("col.serial.lens", { year: f.year.includes("/") ? f.year.replace("/", t("col.or")) : f.year })}</>
        )}
      </p>
      {rarity && (
        <p>
          {rarity} {t("col.serial.rarityNote")}
        </p>
      )}
      {f.notes.map((note) => (
        <p key={note}>{note}</p>
      ))}
      {conflicts.map((c) => (
        <p key={c} className="cx-warn">
          <span aria-hidden="true">⚠ </span>
          {c}
        </p>
      ))}
      <p className="cx-source">{t("col.serial.source", { source: f.source })}</p>
      {f.model && onUseName && (
        <button type="button" className="btn btn-small" onClick={() => onUseName(`Leica ${f.model}${f.variant ? ` (${f.variant})` : ""}`, f.bodyId)}>
          {t("col.serial.useName")}
        </button>
      )}
    </div>
  );
}
