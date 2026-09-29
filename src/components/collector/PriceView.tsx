import { formatMoney } from "../../state/market";
import type { Comparable, PriceRange } from "../../state/market";

/** A price range with every comparable it came from, each linked. Or "not enough data". */
export default function PriceView({ range, comparables, note }: { range: PriceRange | null; comparables: Comparable[]; note: string }) {
  return (
    <>
      {range ? (
        <p className="cl-range">
          {formatMoney(range.low, range.currency)}–{formatMoney(range.high, range.currency)}{" "}
          <span className="cl-tag">
            from {range.count} {comparables.filter((c) => c.kind === "sold" && c.currency === range.currency).length >= range.count ? "sold" : "sold and asking"} prices
          </span>
        </p>
      ) : (
        <p>Not enough cited comparables for a range (needs 3 in one currency). The ones found are listed below.</p>
      )}
      {note && <p className="small">{note}</p>}
      {comparables.length > 0 && (
        <ul className="cl-comps">
          {comparables.map((c, i) => (
            <li key={i}>
              <strong>{formatMoney(c.price, c.currency)}</strong>
              <span className="cl-tag">{c.kind}</span>
              {c.date && <span className="muted">{c.date}</span>}
              <a href={c.url} target="_blank" rel="noreferrer noopener">
                {c.title || c.url}
              </a>
              {c.condition && <span className="muted small">{c.condition}</span>}
            </li>
          ))}
        </ul>
      )}
      <p className="muted small">Market context from public listings and sales, not an appraisal or a prediction. Check the sources.</p>
    </>
  );
}
