import { useMemo, useState } from "react";
import { formatShutter, type Body, type Mount } from "../data/gear";
import { NO_FILTER, TIMELINE_CONTENT, canSimulate, decades, filterItems, timelineItems, type Finder, type Medium, type TimelineFilter, type TimelineItem } from "../data/timeline";
import { formatDistance, type Units } from "../utils/format";
import BodyArt from "./gear/BodyArt";
import GearImage from "./gear/GearImage";
import LensArt from "./gear/LensArt";
import Segmented from "./Segmented";

interface Props {
  body: Body;
  units: Units;
  onSimulate: (item: TimelineItem) => void;
}

const ALL_ITEMS = timelineItems();
const DECADES = decades(ALL_ITEMS);
const CARD_W = 92;
/** Chronological order, evenly spaced, in two alternating rows: compact however dense the years get. */
const STEP = CARD_W / 2 + 6;
const LANE_H = 34;

const FINDER_LABEL: Record<Finder, string> = { rangefinder: "Rangefinder", electronic: "Electronic", reflex: "Optical reflex" };
const MOUNTS: Mount[] = ["M", "L", "TL", "S", "fixed"];
const mountLabel = (m: Mount) => (m === "fixed" ? "Fixed lens" : `${m} mount`);

/** Cards in order, alternating rows (same-row neighbours are CARD_W + 12 apart, so they never overlap); a tick where each decade starts. */
function layout(items: TimelineItem[]) {
  const placed = items.map((it, i) => ({ it, x: 8 + i * STEP, lane: i % 2 }));
  const ticks = placed.filter((p, i) => i === 0 || Math.floor(p.it.year / 10) !== Math.floor(placed[i - 1].it.year / 10)).map((p) => ({ decade: Math.floor(p.it.year / 10) * 10, x: p.x }));
  return { placed, ticks, width: 16 + (items.length - 1) * STEP + CARD_W };
}

/** Leica timeline / interactive museum (feature #23). */
export default function MuseumTimeline({ body, units, onSimulate }: Props) {
  const [filter, setFilter] = useState<TimelineFilter>(NO_FILTER);
  const [selectedId, setSelectedId] = useState(`body:${body.id}`);
  const visible = useMemo(() => filterItems(ALL_ITEMS, filter), [filter]);
  const { placed, ticks, width } = useMemo(() => layout(visible), [visible]);
  const lanes = Math.min(2, placed.length);
  const selected = ALL_ITEMS.find((i) => i.id === selectedId);
  const set = (patch: Partial<TimelineFilter>) => setFilter((f) => ({ ...f, ...patch }));

  return (
    <section className="panel stage-museum" aria-label="Leica timeline">
      <div className="panel-head">
        <h2>Timeline</h2>
      </div>
      <p className="muted small">Cameras and lenses from the catalogue, with sourced notes. Tap an item for details.</p>

      <div className="museum-filters">
        <label className="field">
          <span>Era</span>
          <select value={filter.decade ?? ""} onChange={(e) => set({ decade: e.target.value ? Number(e.target.value) : null })}>
            <option value="">All</option>
            {DECADES.map((d) => (
              <option key={d} value={d}>
                {d}s
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Finder</span>
          <select value={filter.finder ?? ""} onChange={(e) => set({ finder: (e.target.value || null) as Finder | null })}>
            <option value="">All</option>
            {(Object.keys(FINDER_LABEL) as Finder[]).map((f) => (
              <option key={f} value={f}>
                {FINDER_LABEL[f]}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Mount</span>
          <select value={filter.mount ?? ""} onChange={(e) => set({ mount: (e.target.value || null) as Mount | null })}>
            <option value="">All</option>
            {MOUNTS.map((m) => (
              <option key={m} value={m}>
                {mountLabel(m)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="museum-toggles">
        <Segmented
          label="Medium"
          value={filter.medium ?? "all"}
          onChange={(v) => set({ medium: v === "all" ? null : (v as Medium) })}
          options={[
            { value: "all", label: "All" },
            { value: "film", label: "Film" },
            { value: "digital", label: "Digital" },
          ]}
        />
        <label className="museum-check">
          <input type="checkbox" checked={filter.lenses} onChange={(e) => set({ lenses: e.target.checked })} /> Lens milestones
        </label>
      </div>

      {visible.length === 0 ? (
        <p className="muted small">Nothing matches these filters.</p>
      ) : (
        <div className="museum-strip" role="list" aria-label={`${visible.length} items, oldest first`} tabIndex={0}>
          <div className="museum-track" style={{ width, height: lanes * LANE_H + 26 }}>
            {ticks.map((t) => (
              <span key={t.decade} className="museum-tick" style={{ left: t.x }} aria-hidden="true">
                {t.decade}s
              </span>
            ))}
            {placed.map(({ it, x, lane }) => (
              <div key={it.id} role="listitem" className="museum-slot" style={{ left: x, top: 22 + lane * LANE_H }}>
                <button
                  type="button"
                  className={`museum-item museum-${it.kind}${it.id === selectedId ? " museum-item-on" : ""}`}
                  aria-pressed={it.id === selectedId}
                  aria-label={`${it.year} ${it.title}${it.kind === "lens" ? " (lens)" : it.kind === "milestone" ? " (not in the catalogue)" : ""}`}
                  onClick={() => setSelectedId(it.id)}
                >
                  <span className="museum-year">{it.year}</span> {it.kind === "lens" ? shortLens(it.title) : it.title}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {selected && <Detail item={selected} units={units} current={body} onSimulate={onSimulate} />}

      <p className="muted small">
        Notes are short original summaries with their sources (content v{TIMELINE_CONTENT.version}, checked {TIMELINE_CONTENT.updated}). Years
        and specs come from the simulator's catalogue.
      </p>
    </section>
  );
}

/** "APO-Summicron-M 50 f/2 ASPH." → "50 f/2" for the strip; the full name is in the detail card. */
function shortLens(name: string) {
  return name.match(/\d+ f\/[\d.]+/)?.[0] ?? name;
}

function Detail({ item, units, current, onSimulate }: { item: TimelineItem; units: Units; current: Body; onSimulate: (item: TimelineItem) => void }) {
  const b = item.body;
  const l = item.lens;
  const simulable = canSimulate(item);
  const isCurrent = b?.id === current.id;
  return (
    <article className="museum-detail" aria-label={`${item.title} details`}>
      <div className="museum-art">
        {b ? (
          <GearImage kind="bodies" id={b.id} alt={b.name}>
            <BodyArt body={b} />
          </GearImage>
        ) : l ? (
          <GearImage kind="lenses" id={l.id} alt={l.name}>
            <LensArt lens={l} />
          </GearImage>
        ) : (
          <div className="museum-card-fallback" aria-hidden="true">
            {item.year}
          </div>
        )}
      </div>
      <div className="museum-body">
        <h3>
          {item.title} <span className="muted">· {item.year}</span>
        </h3>
        {b && (
          <dl className="gen-specs small">
            <dt>Format</dt>
            <dd>
              {b.medium === "film" ? "Film" : b.medium === "mono" ? "Monochrome sensor" : "Colour sensor"}, {b.sensorWidthMm} × {b.sensorHeightMm} mm
              {b.megapixels ? `, ${b.megapixels[0]} MP` : ""}
            </dd>
            <dt>Finder</dt>
            <dd>{item.finder ? FINDER_LABEL[item.finder] : "—"}{b.rangefinder ? `, ${b.rangefinder.magnification}×` : ""}</dd>
            <dt>Mount</dt>
            <dd>{item.mount ? mountLabel(item.mount) : "—"}</dd>
            <dt>Shutter</dt>
            <dd>
              {formatShutter(b.shutter.slowest)} – {formatShutter(b.shutter.fastest)}
            </dd>
            <dt>Meter</dt>
            <dd>{b.meter === "none" ? "None" : b.meter === "leds" ? "LEDs in the finder" : "Digital readout"}</dd>
          </dl>
        )}
        {l && (
          <dl className="gen-specs small">
            <dt>Lens</dt>
            <dd>{l.name}</dd>
            <dt>Aperture</dt>
            <dd>
              f/{l.maxAperture}–{l.minAperture}
            </dd>
            <dt>Closest focus</dt>
            <dd>{formatDistance(l.minFocusMm, units)}</dd>
          </dl>
        )}
        {item.notes.length > 0 ? (
          item.notes.map((n) => (
            <p key={n.id} className="small museum-note">
              {n.text}{" "}
              <a href={n.provenance.url} target="_blank" rel="noreferrer" className="museum-source">
                {n.provenance.source}
              </a>
            </p>
          ))
        ) : (
          <p className="muted small">No historical note yet: specs above are from the catalogue.</p>
        )}
        {simulable ? (
          <button type="button" className="btn btn-small btn-red" disabled={isCurrent} onClick={() => onSimulate(item)}>
            {isCurrent ? "On the simulator" : "Simulate this"}
          </button>
        ) : (
          <p className="muted small">Not in the simulator's catalogue, so it can't be simulated.</p>
        )}
      </div>
    </article>
  );
}
