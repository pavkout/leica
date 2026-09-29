import { FAMOUS_FRAMES, type FamousFrame } from "../data/famousFrames";
import { BODIES, LENSES } from "../data/gear";

interface Props {
  onTry: (frame: FamousFrame) => void;
}

/**
 * Famous frames, told as museum labels: the picture in words, the gear the
 * sources name, and a stand-in to go and try the same lens in the simulator.
 * No reproductions, and no settings the sources don't give.
 */
export default function FamousFrames({ onTry }: Props) {
  return (
    <section className="panel stage-famous" aria-label="Famous frames">
      <ol className="fm-list">
        {FAMOUS_FRAMES.map((f) => {
          const body = BODIES.find((b) => b.id === f.standIn.bodyId);
          const lens = LENSES.find((l) => l.id === f.standIn.lensId);
          return (
            <li key={f.id} className="fm-item">
              <p className="fm-year">{f.year}</p>
              <div className="fm-label">
                <h2 className="fm-title">{f.title}</h2>
                <p className="fm-by">
                  {f.photographer} · {f.place}
                </p>
                <p className="fm-scene">{f.scene}</p>
                <dl className="gen-specs fm-gear">
                  <dt>Camera</dt>
                  <dd>{f.gear.camera}</dd>
                  {f.gear.lens && (
                    <>
                      <dt>Lens</dt>
                      <dd>{f.gear.lens}</dd>
                    </>
                  )}
                  {f.gear.film && (
                    <>
                      <dt>Film</dt>
                      <dd>{f.gear.film}</dd>
                    </>
                  )}
                  <dt>Settings</dt>
                  <dd className="muted">Not recorded</dd>
                </dl>
                <p className="fm-sources">
                  {f.sources.map((s, i) => (
                    <span key={s.url}>
                      {i > 0 && " · "}
                      <a href={s.url} target="_blank" rel="noreferrer">
                        {s.label}
                      </a>
                    </span>
                  ))}
                </p>
                <div className="fm-try">
                  <button type="button" className="btn btn-small btn-red" onClick={() => onTry(f)}>
                    Try it: {body?.name} with the {lens?.name}
                  </button>
                  <p className="muted small">{f.standIn.note}</p>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
      <p className="hint">
        The pictures are described, not reproduced: they belong to their photographers and estates. Gear is only what the linked sources state;
        exposure settings for these frames weren&apos;t recorded, so none are shown.
      </p>
    </section>
  );
}
