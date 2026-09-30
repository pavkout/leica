import { useEffect, useId, useState, type CSSProperties } from "react";
import type { CollectionItem } from "../../state/collection";
import type { Exhibit } from "../exhibits";
import ExhibitArt from "./ExhibitArt";
import { standLogo } from "../standLogo";
import { standShapes } from "../standGeometry";
import { standImage, type StandImage } from "../stand3d";

/** Cameras, lenses and accessories stand on the plinth; the opened-up parts float, and an owner's photo stays a photo. */
function onPlinth(e: Exhibit, collection: CollectionItem[]): boolean {
  const a = e.art;
  if (a.kind === "part") return false;
  if (a.kind === "item") return !collection.find((i) => i.id === a.itemId)?.photo;
  return true;
}

/**
 * The display stand, seen from the front and a little above: a matte black
 * block; on it a thinner black frame, stepped in; set in the frame, a panel of
 * pebbled red leather. The leather grain is an SVG lighting filter, and the
 * spotlight pools on the leather. The mark on
 * the front is the owner's official artwork, when it has been added (standLogo.ts).
 */
const SHAPES = standShapes();

function Plinth() {
  const uid = useId().replace(/:/g, "");
  const id = (n: string) => `${n}-${uid}`;
  const g = SHAPES;
  return (
    <svg className="mu-plinth-svg" viewBox={g.viewBox} aria-hidden="true" preserveAspectRatio="xMidYMax meet">
      <defs>
        {/* Pebbled leather: noise lit from above, multiplied into the red. */}
        <filter id={id("leather")} x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.34 0.5" numOctaves="2" seed="7" result="noise" />
          <feDiffuseLighting in="noise" surfaceScale="0.9" diffuseConstant="1.15" lightingColor="#ffffff" result="lit">
            <feDistantLight azimuth="250" elevation="52" />
          </feDiffuseLighting>
          <feComposite in="lit" in2="SourceGraphic" operator="arithmetic" k1="1" k2="0" k3="0" k4="0" result="grain" />
          <feComposite in="grain" in2="SourceAlpha" operator="in" />
        </filter>
        {/* One black for the base and the frame tier. */}
        <linearGradient id={id("front")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#262627" />
          <stop offset="0.3" stopColor="#1a1a1b" />
          <stop offset="1" stopColor="#131314" />
        </linearGradient>
        <linearGradient id={id("top")} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#1f1f20" />
          <stop offset="1" stopColor="#171718" />
        </linearGradient>
        <linearGradient id={id("tierFront")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#262627" />
          <stop offset="1" stopColor="#141415" />
        </linearGradient>
        <linearGradient id={id("red")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#d23a31" />
          <stop offset="1" stopColor="#e2463b" />
        </linearGradient>
        {/* The spotlight on the leather, and its falloff down the front. */}
        <radialGradient id={id("pool")} cx="0.5" cy="0.3" r="0.6">
          <stop offset="0" stopColor="#fff3e6" stopOpacity="0.32" />
          <stop offset="1" stopColor="#fff3e6" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={id("frontLight")} cx="0.5" cy="0" r="0.75">
          <stop offset="0" stopColor="#fff3e6" stopOpacity="0.05" />
          <stop offset="1" stopColor="#fff3e6" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={id("tierShadow")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#000" stopOpacity="0.6" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Base block: front, its light, then its top. */}
      <polygon points={g.baseFront} fill={`url(#${id("front")})`} />
      <polygon points={g.baseFront} fill={`url(#${id("frontLight")})`} />
      <polygon points={g.baseTop} fill={`url(#${id("top")})`} />
      {/* The frame tier's shadow falling forward on the ledge. */}
      <polygon points={g.tierShadow} fill={`url(#${id("tierShadow")})`} />

      {/* Frame tier. */}
      <polygon points={g.tierFront} fill={`url(#${id("tierFront")})`} />
      <polygon points={g.tierTop} fill="#181819" />

      {/* Leather, lit, then the spotlight pooling on it. */}
      <polygon points={g.leather} fill={`url(#${id("red")})`} filter={`url(#${id("leather")})`} />
      <polygon points={g.leather} fill={`url(#${id("pool")})`} />
      <polygon points={g.leather} fill="none" stroke="#000" strokeOpacity="0.45" strokeWidth="1.5" />

      {/* Edge highlights where the light catches the corners. */}
      {g.edges.map(([x1, y1, x2, y2], i) => (
        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#fff" strokeOpacity={[0.14, 0.12, 0.05, 0.06][i]} strokeWidth={i === 0 ? 1.2 : 1} />
      ))}
    </svg>
  );
}

/**
 * A piece on show: the object, standing on the display stand, drawn so it
 * takes the spotlight and scales with the screen.
 */
/**
 * The stand to show: the 3D render once it's ready ("3d"), the drawn stand
 * when WebGL isn't available ("svg"), nothing while the first render runs.
 */
function useStand(): { kind: "pending" } | { kind: "3d"; image: StandImage } | { kind: "svg"; logo: string | null } {
  const [state, setState] = useState<{ kind: "pending" } | { kind: "3d"; image: StandImage } | { kind: "svg"; logo: string | null }>({ kind: "pending" });
  useEffect(() => {
    let live = true;
    standLogo()
      .then(async (logo) => {
        const image = await standImage(logo);
        if (live) setState(image ? { kind: "3d", image } : { kind: "svg", logo });
      })
      .catch(() => live && setState({ kind: "svg", logo: null }));
    return () => {
      live = false;
    };
  }, []);
  return state;
}

export default function Showpiece({ exhibit, collection }: { exhibit: Exhibit; collection: CollectionItem[] }) {
  const plinth = onPlinth(exhibit, collection);
  const stand = useStand();
  const is3d = plinth && stand.kind === "3d";
  const style = is3d ? ({ "--mu-seat": `${(stand.image.seat * 100).toFixed(2)}%` } as CSSProperties) : undefined;
  return (
    <div
      className={`mu-show${plinth ? " mu-show-plinth" : ""}${is3d ? " mu-show-3d" : ""}${exhibit.art.kind === "lens" ? " mu-show-lens" : ""}`}
      style={style}
    >
      <div className="mu-piece">
        <ExhibitArt exhibit={exhibit} collection={collection} />
      </div>
      {!plinth ? (
        <div className="mu-floor" aria-hidden="true" />
      ) : stand.kind === "3d" ? (
        <div className="mu-plinth" aria-hidden="true">
          <img className="mu-plinth-img" src={stand.image.src} alt="" />
        </div>
      ) : stand.kind === "svg" ? (
        <div className="mu-plinth" aria-hidden="true" style={{ "--mu-mark-y": `${(SHAPES.frontMiddle * 100).toFixed(1)}%` } as CSSProperties}>
          <Plinth />
          {stand.logo && <img className="mu-plinth-logo" src={stand.logo} alt="" />}
          <span className="mu-plinth-shadow" />
        </div>
      ) : (
        <div className="mu-plinth mu-plinth-pending" aria-hidden="true" />
      )}
    </div>
  );
}
