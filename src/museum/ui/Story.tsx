import { useEffect, useRef } from "react";
import type { CollectionItem } from "../../state/collection";
import type { Exhibit } from "../exhibits";
import Showpiece from "./Showpiece";
import { hearShutter } from "./sound";
import { t } from "../../i18n";

interface Props {
  exhibit: Exhibit;
  roomTitle: string;
  collection: CollectionItem[];
  onClose: () => void;
  onSimulate?: (target: { bodyId?: string; lensId?: string }) => void;
}

/** The exhibit's story: the piece, its key facts engraved on a plate, and its history with sources. */
export default function Story({ exhibit, roomTitle, collection, onClose, onSimulate }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, [exhibit.id]);

  return (
    <div className="mu-story" role="dialog" aria-modal="true" aria-label={t("mu.story", { title: exhibit.title })} ref={ref} tabIndex={-1}>
      <button type="button" className="mu-round mu-story-close" onClick={onClose} aria-label={t("mu.backToExhibit")}>
        <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
          <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>
      <div className="mu-story-grid">
        <div className="mu-story-art">
          <div className="mu-spot mu-spot-small" aria-hidden="true" />
          <Showpiece exhibit={exhibit} collection={collection} />
        </div>
        <div className="mu-story-text">
          <p className="mu-kicker">{roomTitle}</p>
          <h2 className="mu-story-title">{exhibit.title.replace(/-/g, "\u2011")}</h2>
          {exhibit.year && <p className="mu-year">{exhibit.year}</p>}
          <p className="mu-line">{exhibit.line}</p>

          {exhibit.facts.length > 0 && (
            <dl className="mu-facts" aria-label={t("mu.keyFacts")}>
              {exhibit.facts.map((f) => (
                <div key={f.label}>
                  <dt>{f.label}</dt>
                  <dd>{f.value}</dd>
                </div>
              ))}
            </dl>
          )}

          {exhibit.story.length > 0 && (
            <div className="mu-prose">
              {exhibit.story.map((s, i) => (
                <p key={i}>
                  {s.text}
                  {s.source && " "}
                  {s.source && (
                    <span className="mu-source">
                      {s.source.url ? (
                        <a href={s.source.url} target="_blank" rel="noreferrer noopener">
                          {s.source.label}
                        </a>
                      ) : (
                        s.source.label
                      )}
                    </span>
                  )}
                </p>
              ))}
            </div>
          )}

          <div className="mu-actions">
            {exhibit.soundBodyId && (
              <button type="button" className="mu-ghost" onClick={() => hearShutter(exhibit.soundBodyId!)}>
                {t("mu.hear")}
              </button>
            )}
            {exhibit.simulate && onSimulate && (
              <button type="button" className="mu-cta" onClick={() => onSimulate(exhibit.simulate!)}>
                {t("mu.try")}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
