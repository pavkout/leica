import { useEffect, useRef, useState } from "react";
import { t, useLang } from "../../i18n";
import { FILM_STOCKS, findFilm } from "../../preview/film";
import { applyFilmLook } from "../../preview/filmLookCpu";
import { shareOrDownload } from "../collector/passportCard";

/** Long edge of the picture worked on: sharp on a phone, quick to redo. */
const PREVIEW = 1400;
const SAVE = 3000;
const FILMS = FILM_STOCKS.filter((f) => f.kind !== "digital");

function drawScaled(img: HTMLImageElement, canvas: HTMLCanvasElement, edge: number) {
  const s = Math.min(1, edge / Math.max(img.naturalWidth, img.naturalHeight));
  canvas.width = Math.round(img.naturalWidth * s);
  canvas.height = Math.round(img.naturalHeight * s);
  const g = canvas.getContext("2d", { willReadFrequently: true })!;
  g.drawImage(img, 0, 0, canvas.width, canvas.height);
  return g;
}

/**
 * See your photo on film (#61): one of your own pictures through the same
 * film looks the simulator uses, side by side with the original.
 */
export default function OnFilm() {
  useLang();
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [filmId, setFilmId] = useState("portra400");
  const [stops, setStops] = useState(0);
  const [grain, setGrain] = useState(true);
  const [split, setSplit] = useState(50);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const before = useRef<HTMLCanvasElement>(null);
  const after = useRef<HTMLCanvasElement>(null);
  const film = findFilm(filmId);

  useEffect(() => {
    if (!img || !before.current || !after.current) return;
    drawScaled(img, before.current, PREVIEW);
    const g = drawScaled(img, after.current, PREVIEW);
    const { width: w, height: h } = after.current;
    const data = g.getImageData(0, 0, w, h);
    applyFilmLook(data.data, w, h, film, { exposureStops: stops, grain });
    g.putImageData(data, 0, 0);
  }, [img, film, stops, grain]);

  function open(file: File | undefined) {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const i = new Image();
    i.onload = () => {
      setImg(i);
      setNote("");
      URL.revokeObjectURL(url);
    };
    i.onerror = () => setNote(t("of.cantOpen"));
    i.src = url;
  }

  async function save() {
    if (!img) return;
    setBusy(true);
    // Let the button show it's working before the big picture is done.
    await new Promise((r) => setTimeout(r, 30));
    const c = document.createElement("canvas");
    const g = drawScaled(img, c, SAVE);
    const data = g.getImageData(0, 0, c.width, c.height);
    applyFilmLook(data.data, c.width, c.height, film, { exposureStops: stops, grain });
    g.putImageData(data, 0, 0);
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/jpeg", 0.92));
    setBusy(false);
    if (!blob) return;
    const name = `on-${film.id}.jpg`;
    const how = await shareOrDownload(blob, name, film.name);
    if (how !== "cancelled") setNote(how === "shared" ? t("of.shared") : t("of.saved", { name }));
  }

  return (
    <section className="panel stage-onfilm cx" aria-label={t("tool.onfilm")}>
      <p className="cx-summary">{t("of.intro")}</p>
      <div className="cx-actions">
        <label className="btn btn-red pp-file">
          {img ? t("of.another") : t("of.open")}
          <input type="file" accept="image/*" onChange={(e) => open(e.target.files?.[0])} />
        </label>
      </div>
      {note && <p className="cx-quiet">{note}</p>}

      <div className="of-compare" hidden={!img}>
        <canvas ref={after} className="of-canvas" aria-label={t("of.afterAlt", { film: film.name })} />
        <canvas ref={before} className="of-canvas of-before" style={{ clipPath: `inset(0 ${100 - split}% 0 0)` }} aria-label={t("of.beforeAlt")} />
        <span className="of-line" style={{ left: `${split}%` }} aria-hidden="true" />
        <span className="of-tag of-tag-left">{t("of.original")}</span>
        <span className="of-tag of-tag-right">{film.name}</span>
      </div>
      {img && (
        <>
          <label className="field">
            <span>{t("of.compare")}</span>
            <input type="range" min={0} max={100} value={split} onChange={(e) => setSplit(Number(e.target.value))} />
          </label>
          <div className="cx-grid">
            <label className="field">
              <span>{t("of.film")}</span>
              <select value={filmId} onChange={(e) => setFilmId(e.target.value)}>
                {FILMS.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>{t("of.exposure", { n: stops > 0 ? `+${stops}` : String(stops) })}</span>
              <input type="range" min={-2} max={3} step={1} value={stops} onChange={(e) => setStops(Number(e.target.value))} />
            </label>
          </div>
          <p className="cx-quiet">{film.description}</p>
          {stops !== 0 && <p className="cx-quiet">{t(Math.abs(stops) <= (stops > 0 ? film.latitude[1] : film.latitude[0]) ? "of.withinLatitude" : "of.pastLatitude")}</p>}
          <div className="cx-actions">
            <label className="cx-check">
              <input type="checkbox" checked={grain} onChange={(e) => setGrain(e.target.checked)} /> {t("of.grain")}
            </label>
            <button type="button" className="btn btn-red" disabled={busy} onClick={save}>
              {busy ? t("of.saving") : t("of.save")}
            </button>
          </div>
          <p className="cx-quiet">
            <a className="cx-link" href="#/film/filmstock">
              {t("tool.filmstock")}
            </a>
            {" · "}
            <a className="cx-link" href="#/shoot/filmfinder">
              {t("tool.filmfinder")}
            </a>
          </p>
        </>
      )}
      <p className="cx-quiet cx-footnote">{t("of.honest")}</p>
    </section>
  );
}
