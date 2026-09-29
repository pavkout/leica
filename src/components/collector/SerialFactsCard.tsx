import { lookupSerialFacts, rarityNote, serialConflicts } from "../../state/serialFacts";
import type { AiFindings } from "../../state/collection";

interface Props {
  kind: "body" | "lens";
  serial: string;
  /** What the owner or an AI called it, to check against the list. */
  claim?: { model?: string | null; year?: string | number | null };
  ai?: AiFindings;
  /** Offered when the list names a model: fill the item's name with it. */
  onUseName?: (name: string, bodyId?: string) => void;
}

/**
 * What the published serial lists say about the number being typed, with the
 * list named. Sourced facts only; an AI reading, when there is one, sits under
 * its own label and any disagreement is shown, never resolved silently.
 */
export default function SerialFactsCard({ kind, serial, claim, ai, onUseName }: Props) {
  const r = lookupSerialFacts(kind, serial);
  if (r.status === "invalid") return serial.trim() ? <p className="muted small cl-facts-none">Type the number as engraved (4–8 digits) to look it up in the serial lists.</p> : null;
  if (r.status === "unknown")
    return (
      <p className="muted small cl-facts-none" role="status">
        {r.reason} Nothing is guessed.
      </p>
    );

  const f = r.facts;
  const rarity = rarityNote(f);
  const conflicts = [...serialConflicts(f, claim ?? {}), ...(ai ? serialConflicts(f, { model: ai.model }) : [])];
  const unique = [...new Set(conflicts)];
  return (
    <div className="cl-facts" role="status" aria-label="From the serial lists">
      <p className="cl-label">From the serial lists</p>
      <p className="cl-facts-main">
        {f.model ? (
          <>
            <strong>{f.model}</strong>
            {f.variant && <>, {f.variant}</>} · {f.year}
          </>
        ) : (
          <>
            Made in <strong>{f.year}</strong>
            {f.year.includes("/") && " (the published ranges overlap here)"}
          </>
        )}
      </p>
      {rarity && <p className="small">{rarity} That counts cameras made, not cameras surviving.</p>}
      {f.notes.map((n) => (
        <p key={n} className="small">
          {n}
        </p>
      ))}
      {unique.map((c) => (
        <p key={c} className="cl-conflict">
          ⚠ {c}
        </p>
      ))}
      <p className="muted small">Source: {f.source}</p>
      {f.model && onUseName && (
        <button type="button" className="btn btn-small" onClick={() => onUseName(`Leica ${f.model}${f.variant ? ` (${f.variant})` : ""}`, f.bodyId)}>
          Use as the name
        </button>
      )}
    </div>
  );
}
