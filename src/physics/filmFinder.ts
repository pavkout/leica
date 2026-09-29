// Film finder: from what you'll shoot, the light and the look you want, the
// stocks that suit. The scoring uses only the app's own film data (speed,
// latitude, saturation, contrast softness, grain), which is approximate by
// design and labelled so; the reasons it gives are those same numbers.

import { FILM_STOCKS, type FilmLook } from "../preview/film";

export type FilmKind = "any" | "colour" | "bw" | "slide";
export type Light = "bright" | "mixed" | "low";
export type Look = "soft" | "natural" | "vivid" | "gritty";

export interface FilmPick {
  film: FilmLook;
  score: number;
  reasons: string[];
}

/** The film speed each light wants, as a range of ISO. */
const SPEED: Record<Light, [number, number]> = { bright: [50, 200], mixed: [200, 400], low: [800, 3200] };

const kindOf = (f: FilmLook): FilmKind => (f.mono ? "bw" : f.kind === "slide" ? "slide" : "colour");

export function findFilms(opts: { kind: FilmKind; light: Light; look: Look }, stocks: FilmLook[] = FILM_STOCKS): FilmPick[] {
  const films = stocks.filter((f) => f.kind !== "digital" && (opts.kind === "any" || kindOf(f) === opts.kind));
  const [lo, hi] = SPEED[opts.light];
  return films
    .map((f) => {
      const reasons: string[] = [];
      let score = 0;
      // Speed: inside the range is right; each stop outside costs.
      const stopsOff = f.iso < lo ? Math.log2(lo / f.iso) : f.iso > hi ? Math.log2(f.iso / hi) : 0;
      score += 4 - Math.min(4, stopsOff * 1.5);
      if (stopsOff === 0) reasons.push(`ISO ${f.iso} suits ${opts.light === "bright" ? "bright light" : opts.light === "low" ? "low light" : "changing light"}`);
      else if (f.iso < lo) reasons.push(`ISO ${f.iso} is slow for this light: ${stopsOff.toFixed(0)} stop${stopsOff >= 1.5 ? "s" : ""} to find`);
      else reasons.push(`ISO ${f.iso} is faster than this light needs`);

      const lat = f.latitude[0] + f.latitude[1];
      if (opts.look === "soft") {
        score += (f.softness - 2.5) * 2 + (lat - 3) * 0.6;
        if (f.softness >= 3) reasons.push("soft, gentle contrast");
        if (lat >= 5) reasons.push(`forgiving: ${f.latitude[1]} stops of overexposure latitude`);
      } else if (opts.look === "vivid") {
        score += (f.saturation - 1) * 6 - f.grain;
        if (f.saturation >= 1.2) reasons.push("strong, saturated colour");
        if (f.grain <= 0.35) reasons.push("fine grain");
      } else if (opts.look === "gritty") {
        score += f.grain * 3 + (2.6 - f.softness) * 1.2 + f.halation * 4;
        if (f.grain >= 0.6) reasons.push("visible grain");
        if (f.softness <= 2.4) reasons.push("punchy contrast");
        if (f.halation >= 0.3) reasons.push("glow around lights (no anti-halation layer)");
      } else {
        // Natural: saturation near neutral, moderate contrast, and no strong warm or cool cast.
        const cast = Math.abs(f.balance[0] - f.balance[2]);
        score += 2 - Math.abs(f.saturation - 1) * 4 - Math.abs(f.softness - 2.7) - cast * 8;
        if (Math.abs(f.saturation - 1) <= 0.1 && cast <= 0.12) reasons.push("natural, true colour");
        else if (cast > 0.12) reasons.push(f.balance[0] > f.balance[2] ? "a warm cast, not neutral" : "a cool cast, not neutral");
      }
      if (f.kind === "slide") reasons.push(`slide film: only ${f.latitude[0]}/${f.latitude[1]} stops of latitude, so meter carefully`);
      return { film: f, score, reasons };
    })
    .sort((a, b) => b.score - a.score);
}
