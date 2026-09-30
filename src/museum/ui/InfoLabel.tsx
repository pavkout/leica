import { useEffect, useState, type CSSProperties } from "react";
import { useElementWidth } from "../../utils/useElementWidth";
import { infoStandImage, type InfoStandImage } from "../infoStand3d";
import { quadMatrix3d } from "../quad";
import { standLogo } from "../standLogo";
import type { Exhibit } from "../exhibits";

/** The paper's text is laid out on a page this wide (CSS px), then mapped onto the paper in the render. */
const PAGE_W = 1000;

/** Until the render is ready (or without WebGL): a flat drawn label of similar proportions. */
const FALLBACK: Pick<InfoStandImage, "aspect" | "paper" | "paperRatio"> = {
  aspect: 0.66,
  paper: [
    [0.06, 0.04],
    [0.94, 0.04],
    [0.94, 0.66],
    [0.06, 0.66],
  ],
  paperRatio: 0.88 / 0.62 / (1 / 0.66),
};

/** Names like "Summicron-M" shouldn't break at their hyphen. */
const nobreak = (t: string) => t.replace(/-/g, "‑");

function useInfoStand(): { image: InfoStandImage | null; logo: string | null; ready: boolean } {
  const [state, setState] = useState<{ image: InfoStandImage | null; logo: string | null; ready: boolean }>({ image: null, logo: null, ready: false });
  useEffect(() => {
    let live = true;
    standLogo()
      .then(async (logo) => {
        const image = await infoStandImage(logo);
        if (live) setState({ image, logo, ready: true });
      })
      .catch(() => live && setState({ image: null, logo: null, ready: true }));
    return () => {
      live = false;
    };
  }, []);
  return state;
}

/**
 * The info stand beside a piece: a clear acrylic block, seen three-quarters
 * on, with a black band and the mark, holding a paper label. The paper's words
 * are live text, laid out flat and mapped onto the paper's perspective.
 */
export default function InfoLabel({ exhibit, roomTitle }: { exhibit: Exhibit; roomTitle?: string }) {
  const { image, logo, ready } = useInfoStand();
  const [ref, width] = useElementWidth<HTMLDivElement>(260);
  const geo = image ?? FALLBACK;
  const height = width / geo.aspect;
  const pageH = PAGE_W / geo.paperRatio;
  const quad = geo.paper.map(([x, y]) => [x * width, y * height]) as InfoStandImage["paper"];
  const style: CSSProperties = { width: PAGE_W, height: pageH, transform: quadMatrix3d(PAGE_W, pageH, quad) };

  return (
    <div ref={ref} className={`mu-info${image ? " mu-info-3d" : ready ? " mu-info-drawn" : " mu-info-drawn mu-info-pending"}`} style={{ aspectRatio: String(geo.aspect) }}>
      {image ? (
        <img className="mu-info-img" src={image.src} alt="" aria-hidden="true" />
      ) : (
        <div className="mu-info-block" aria-hidden="true">
          <span className="mu-info-clear" />
          <span className="mu-info-band">{logo && <img src={logo} alt="" />}</span>
        </div>
      )}
      <div className="mu-info-paper" style={style}>
        {roomTitle && <p className="mu-info-kicker">{roomTitle}</p>}
        {exhibit.year && <p className="mu-info-year">{exhibit.year}</p>}
        <h1 className="mu-info-title">{nobreak(exhibit.title)}</h1>
        <p className="mu-info-line">{exhibit.line}</p>
      </div>
    </div>
  );
}
