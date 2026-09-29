import { formatMoney, type Comparable, type PriceRange } from "../../state/market";

/** What similar items sold for, with every source linked. Or, plainly, that there weren't enough. */
export default function PriceView({ range, comparables, note }: { range: PriceRange | null; comparables: Comparable[]; note: string }) {
  const soldOnly = range ? comparables.filter((c) => c.kind === "sold" && c.currency === range.currency).length >= range.count : false;
  return (
    <>
      {range ? (
        <>
          <p className="cx-price">
            {formatMoney(range.low, range.currency)} to {formatMoney(range.high, range.currency)}
          </p>
          <p className="cx-quiet">
            What {range.count} similar items {soldOnly ? "sold for" : "sold or are listed for"}.
          </p>
        </>
      ) : (
        <p>We couldn't find enough similar sales to give a price range (we need at least 3). What we did find is below.</p>
      )}
      {note && <p>{note}</p>}
      {comparables.length > 0 && (
        <details className="cx-sources" open={!range}>
          <summary>Where these prices come from ({comparables.length})</summary>
          <ul>
            {comparables.map((c, i) => (
              <li key={i}>
                <span className="cx-src-price">{formatMoney(c.price, c.currency)}</span>
                <span className="cx-src-kind">{c.kind === "sold" ? "Sold" : "For sale"}</span>
                {c.date && <span className="cx-quiet">{c.date}</span>}
                <a href={c.url} target="_blank" rel="noreferrer noopener">
                  {c.title || c.url}
                </a>
                {c.condition && <span className="cx-quiet">Condition: {c.condition}</span>}
              </li>
            ))}
          </ul>
        </details>
      )}
      <p className="cx-quiet">A guide from public sales, not an official valuation.</p>
    </>
  );
}
