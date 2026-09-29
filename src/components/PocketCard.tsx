import { formatShutter, type Body, type Lens } from "../data/gear";
import { pocketCard } from "../physics/pocketCard";
import { formatDistance, lensEngraving, type Units } from "../utils/format";

interface Props {
  body: Body;
  lens: Lens;
  /** Film name, or "ISO n" on a digital body. */
  filmLabel: string;
  iso: number;
  stops: number[];
  speeds: number[];
  cocMm: number;
  units: Units;
}

/**
 * A pocket card for the exact kit: zone focus, Sunny 16 at this speed, and the
 * hand-held limit. Printed on its own (everything else is hidden in print),
 * two card-sized faces to fold or cut.
 */
export default function PocketCard({ body, lens, filmLabel, iso, stops, speeds, cocMm, units }: Props) {
  const card = pocketCard({ focalMm: lens.focalMm, stops, speeds, iso, cocMm });
  const d = (mm: number) => formatDistance(mm, units);
  const kit = (
    <p className="pc-kit">
      <span>{body.name}</span>
      <span>{lensEngraving(lens.name)}</span>
      <span>{filmLabel}</span>
    </p>
  );

  return (
    <section className="panel stage-card" aria-label="Pocket card">
      <div className="panel-head">
        <h2>Pocket card</h2>
        <button type="button" className="btn btn-small btn-red" onClick={() => window.print()}>
          Print the card
        </button>
      </div>
      <p className="muted small">
        For the camera in your hands. Print it, cut along the border and keep it in the bag. It changes with the camera, lens and film you
        choose here.
      </p>

      <div className="pc-sheet">
        <article className="pc-face" aria-label="Zone focus">
          <header className="pc-head">
            <h3>Zone focus</h3>
            {kit}
          </header>
          {card.zones.length === 0 ? (
            <p className="pc-note">This lens doesn't stop down to f/5.6–16, the usual zone-focus apertures.</p>
          ) : (
            <table className="pc-table">
              <thead>
                <tr>
                  <th scope="col">Stop</th>
                  <th scope="col">Set to</th>
                  <th scope="col">Sharp</th>
                  {card.zones[0].zones.map((z) => (
                    <th key={z.focusMm} scope="col">
                      At {d(z.focusMm)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {card.zones.map((row) => (
                  <tr key={row.fNumber}>
                    <th scope="row">f/{row.fNumber}</th>
                    <td>{d(row.hyperfocalMm)}</td>
                    <td>{d(row.nearMm)}–∞</td>
                    {row.zones.map((z) => (
                      <td key={z.focusMm}>
                        {d(z.nearMm)}–{d(z.farMm)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="pc-note">&ldquo;Set to&rdquo; is the hyperfocal distance: focus there and everything from the next column to infinity is sharp.</p>
        </article>

        <article className="pc-face" aria-label="Exposure without a meter">
          <header className="pc-head">
            <h3>No meter? At ISO {iso}</h3>
            {kit}
          </header>
          <table className="pc-table pc-table-light">
            <tbody>
              {card.light.map((l) => (
                <tr key={l.id}>
                  <th scope="row">{l.label}</th>
                  <td>f/{l.fNumber}</td>
                  <td>
                    {formatShutter(l.shutterSec)}
                    {l.needsSupport && <span className="pc-support"> brace</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="pc-note">
            Hand-held: {formatShutter(card.slowestHandheldSec)} or faster with the {lens.focalMm} mm; &ldquo;brace&rdquo; means slower than that, so lean
            on something or use a tripod. Light from the standard EV guide; real scenes vary, so bracket when it matters.
          </p>
        </article>
      </div>
    </section>
  );
}
