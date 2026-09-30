import { BODIES, LENSES } from "../../data/gear";
import { PARTS, boxAt, drawOrder, type PartId } from "../../mechanics/anatomy";
import { ANATOMY_VIEWBOX, faces } from "../../mechanics/anatomyView";
import type { CollectionItem } from "../../state/collection";
import BodyArt from "../../components/gear/BodyArt";
import GearImage from "../../components/gear/GearImage";
import LensArt from "../../components/gear/LensArt";
import type { Exhibit } from "../exhibits";

/** The camera opened up, every part in graphite except the one on show, in chrome. */
function PartFigure({ partId }: { partId: PartId }) {
  const t = 0.55;
  const boxes = PARTS.map((p) => ({ id: p.id, box: boxAt(p, t) }));
  const order = drawOrder(boxes);
  const on = PARTS.find((p) => p.id === partId)!;
  return (
    <svg viewBox={ANATOMY_VIEWBOX} className="mu-part" role="img" aria-label={`Illustration: the ${on.label.toLowerCase()}, inside a generic film M camera`}>
      {order.map((id) => {
        const f = faces(boxes.find((b) => b.id === id)!.box);
        const lit = id === partId;
        return (
          <g key={id} className={lit ? "mu-part-on" : "mu-part-off"}>
            <polygon points={f.right} className="mu-part-right" />
            <polygon points={f.top} className="mu-part-top" />
            <polygon points={f.front} className="mu-part-front" />
          </g>
        );
      })}
    </svg>
  );
}

/** An accessory with no licensed picture: its name engraved on a machined plate. Honest, and still beautiful. */
function Plate({ title }: { title: string }) {
  return (
    <div className="mu-plate" aria-hidden="true">
      <span>{title}</span>
    </div>
  );
}

export default function ExhibitArt({ exhibit, collection }: { exhibit: Exhibit; collection: CollectionItem[] }) {
  const a = exhibit.art;
  if (a.kind === "body") {
    const body = BODIES.find((b) => b.id === a.bodyId);
    if (!body) return <Plate title={exhibit.title} />;
    return (
      <GearImage kind="bodies" id={body.id} alt={exhibit.title} className="mu-photo" sizes="80vw">
        <BodyArt body={body} className="mu-svg" />
      </GearImage>
    );
  }
  if (a.kind === "lens") {
    const lens = LENSES.find((l) => l.id === a.lensId);
    if (!lens) return <Plate title={exhibit.title} />;
    return (
      <GearImage kind="lenses" id={lens.id} alt={exhibit.title} className="mu-photo" sizes="80vw">
        <LensArt lens={lens} className="mu-svg" />
      </GearImage>
    );
  }
  if (a.kind === "part") return <PartFigure partId={a.partId} />;
  if (a.kind === "item") {
    const item = collection.find((i) => i.id === a.itemId);
    if (item?.photo) return <img src={item.photo} alt={exhibit.title} className="mu-owner-photo" />;
    const body = item?.kind === "body" ? BODIES.find((b) => b.id === item.catalogueId) : undefined;
    const lens = item?.kind === "lens" ? LENSES.find((l) => l.id === item.catalogueId) : undefined;
    if (body) return <BodyArt body={body} className="mu-svg" />;
    if (lens) return <LensArt lens={lens} className="mu-svg" />;
    return <Plate title={exhibit.title} />;
  }
  return <Plate title={exhibit.title} />;
}
