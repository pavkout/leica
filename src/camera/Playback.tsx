import { useEffect, useState } from "react";
import { t } from "../i18n";
import type { Frame } from "../state/rollExport";

interface Props {
  frames: Frame[];
  onClose: () => void;
  /** Open the contact sheet (notes, outcomes, export). */
  onSheet: () => void;
}

/** PLAY: the rear screen in review, newest picture first; swipe or arrow through the card. */
export default function Playback({ frames, onClose, onSheet }: Props) {
  const [i, setI] = useState(frames.length - 1);
  const [touchX, setTouchX] = useState<number | null>(null);
  const f = frames[i];
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") setI((v) => Math.max(0, v - 1));
      if (e.key === "ArrowRight") setI((v) => Math.min(frames.length - 1, v + 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [frames.length, onClose]);

  return (
    <div className="play" role="dialog" aria-modal="true" aria-label={t("play.title")}>
      {f ? (
        <figure
          className="play-frame"
          onTouchStart={(e) => setTouchX(e.touches[0].clientX)}
          onTouchEnd={(e) => {
            if (touchX === null) return;
            const dx = e.changedTouches[0].clientX - touchX;
            if (dx > 40) setI((v) => Math.max(0, v - 1));
            if (dx < -40) setI((v) => Math.min(frames.length - 1, v + 1));
            setTouchX(null);
          }}
        >
          <img src={f.url} alt={f.caption} />
          <figcaption>
            <span className="play-count">
              {i + 1} / {frames.length}
            </span>
            <span>{f.caption}</span>
          </figcaption>
        </figure>
      ) : (
        <div className="play-empty">
          <p>{t("play.empty")}</p>
          <button type="button" className="cam-btn" onClick={onClose}>
            Take a picture
          </button>
        </div>
      )}
      <div className="play-bar">
        <button type="button" className="cam-btn" disabled={i <= 0} onClick={() => setI((v) => v - 1)} aria-label={t("play.prev")}>
          ‹
        </button>
        <button type="button" className="cam-btn" onClick={onSheet}>
          Contact sheet
        </button>
        <button type="button" className="cam-btn" onClick={onClose}>
          Camera
        </button>
        <button type="button" className="cam-btn" disabled={i >= frames.length - 1} onClick={() => setI((v) => v + 1)} aria-label={t("play.next")}>
          ›
        </button>
      </div>
    </div>
  );
}
