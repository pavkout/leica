import { computeInsights } from "../physics/insights";
import type { Frame } from "../state/rollExport";

interface Props {
  frames: Frame[];
}

/** Learn from your negatives: trends over the user's own outcome tags, linked back to the frames that produced them. */
export default function Insights({ frames }: Props) {
  const tagged = frames.filter((f) => f.outcome);
  const { insights, notEnoughData, tagCounts } = computeInsights(frames);

  return (
    <section className="panel stage-insights" aria-label="Insights">
      <div className="panel-head">
        <h2>Insights</h2>
      </div>

      {tagged.length === 0 ? (
        <p className="muted small">
          Tag frames as good, missed focus, motion blur, under- or overexposed in the contact sheet above, and trends will appear here.
        </p>
      ) : (
        <>
          <p className="muted small">
            {tagged.length} of {frames.length} frame{frames.length === 1 ? "" : "s"} tagged: {" "}
            {Object.entries(tagCounts)
              .filter(([, count]) => count > 0)
              .map(([tag, count]) => `${count} ${tag}`)
              .join(", ")}
            .
          </p>

          {insights.length === 0 ? (
            <p className="muted small">Not enough data for a trend yet — tag a few more frames the same way to see one.</p>
          ) : (
            <ul className="insight-list">
              {insights.map((insight) => (
                <li key={insight.id} className="insight-item">
                  <p>{insight.text}</p>
                  <p className="muted small">Frames: {insight.frameNumbers.map((n) => `#${n}`).join(", ")}</p>
                </li>
              ))}
            </ul>
          )}

          {notEnoughData.length > 0 && (
            <p className="muted small">
              Not enough data yet for{" "}
              {notEnoughData.map((n) => `${n.label} (${n.count} of ${n.needed} needed)`).join(", ")}.
            </p>
          )}
        </>
      )}

      <p className="hint">
        Transparent statistics over your own tags and exposure settings only — no image analysis, and nothing is uploaded anywhere.
      </p>
    </section>
  );
}
