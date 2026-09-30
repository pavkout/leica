import { formatMoney, type Comparable, type PriceRange } from "../../state/market";
import { t } from "../../i18n";

/** What similar items sold for, with every source linked. Or, plainly, that there weren't enough. */
export default function PriceView({ range, comparables, note }: { range: PriceRange | null; comparables: Comparable[]; note: string }) {
  const soldOnly = range ? comparables.filter((c) => c.kind === "sold" && c.currency === range.currency).length >= range.count : false;
  return (
    <>
      {range ? (
        <>
          <p className="cx-price">
            {t("col.price.range", { low: formatMoney(range.low, range.currency), high: formatMoney(range.high, range.currency) })}
          </p>
          <p className="cx-quiet">
            {soldOnly ? t("col.price.sold", { n: range.count }) : t("col.price.soldOrListed", { n: range.count })}
          </p>
        </>
      ) : (
        <p>{t("col.price.notEnough")}</p>
      )}
      {note && <p>{note}</p>}
      {comparables.length > 0 && (
        <details className="cx-sources" open={!range}>
          <summary>{t("col.price.sources", { n: comparables.length })}</summary>
          <ul>
            {comparables.map((c, i) => (
              <li key={i}>
                <span className="cx-src-price">{formatMoney(c.price, c.currency)}</span>
                <span className="cx-src-kind">{c.kind === "sold" ? t("col.price.kindSold") : t("col.price.kindForSale")}</span>
                {c.date && <span className="cx-quiet">{c.date}</span>}
                <a href={c.url} target="_blank" rel="noreferrer noopener">
                  {c.title || c.url}
                </a>
                {c.condition && <span className="cx-quiet">{t("col.price.condition", { c: c.condition })}</span>}
              </li>
            ))}
          </ul>
        </details>
      )}
      <p className="cx-quiet">{t("col.price.guide")}</p>
    </>
  );
}
