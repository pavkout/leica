// "Understand the shot" (Studio, #37 follow-up): plain-language reading of
// the optics behind the current picture, and one concrete next step. Every
// sentence is computed from the shared optics; nothing is canned advice.

import { blurDiscMm } from "./optics";
import type { Shot } from "./model";

export type BackgroundLook = "sharp" | "slightly soft" | "soft" | "very soft";

/** How soft the background looks, by its blur disc in circles of confusion. */
export function backgroundLook(ratio: number): BackgroundLook {
  if (ratio <= 1) return "sharp";
  if (ratio <= 3) return "slightly soft";
  if (ratio <= 10) return "soft";
  return "very soft";
}

export interface Suggestion {
  text: string;
  /** Apply it with one tap. */
  action?: { label: string; fNumber?: number; focusMm?: number };
}

export interface ShotReading {
  /** Where the sharp zone is. */
  zone: string;
  /** How the subject reads. */
  subject: string;
  /** How the background reads, with the number. */
  background: string;
  backgroundRatio: number;
  look: BackgroundLook;
  suggestion: Suggestion;
}

type Fmt = (mm: number) => string;

const fstop = (n: number) => `f/${n}`;

/**
 * Reads the shot. `stops` are the lens's apertures, so a suggestion never
 * asks for one it doesn't have.
 */
export function explainShot(shot: Shot, stops: number[], fmt: Fmt): ShotReading {
  const { dof, cocMm, focalMm, fNumber, focusMm, subjectMm, backgroundMm } = shot;
  const bgAt = (n: number) => blurDiscMm(focalMm, n, focusMm, backgroundMm) / cocMm;
  const ratio = shot.backgroundBlurMm / cocMm;
  const look = backgroundLook(ratio);
  const depth = Number.isFinite(dof.farMm) ? `${fmt(dof.farMm - dof.nearMm)} deep` : "all the way to infinity";
  const zone = Number.isFinite(dof.farMm) ? `Sharp from ${fmt(dof.nearMm)} to ${fmt(dof.farMm)}: ${depth}.` : `Sharp from ${fmt(dof.nearMm)} to infinity.`;

  const subject = shot.subjectSharp
    ? `The subject at ${fmt(subjectMm)} is inside it.`
    : `The subject at ${fmt(subjectMm)} is outside it, ${subjectMm < dof.nearMm ? "in front" : "behind"}: it will look soft.`;

  const bgWhere = Number.isFinite(backgroundMm) ? `at ${fmt(backgroundMm)}` : "far away";
  const background =
    look === "sharp"
      ? `The background ${bgWhere} is sharp too.`
      : `The background ${bgWhere} is ${look}: blurred ${ratio >= 10 ? Math.round(ratio) : ratio.toFixed(1)}× past what reads as sharp.`;

  let suggestion: Suggestion;
  if (!shot.subjectSharp) {
    suggestion = {
      text: `Focus on the subject: set ${fmt(subjectMm)} on the focus ring (or drag the figure).`,
      action: { label: `Focus at ${fmt(subjectMm)}`, focusMm: subjectMm },
    };
  } else if (look === "very soft" || look === "soft") {
    // Wants more context? The smallest aperture that makes the background readable.
    const readable = stops.find((n) => n > fNumber && bgAt(n) <= 3);
    suggestion = readable
      ? {
          text: `To make the background readable, stop down to ${fstop(readable)}: it becomes ${bgAt(readable).toFixed(1)}× soft, and the sharp zone grows.`,
          action: { label: `Try ${fstop(readable)}`, fNumber: readable },
        }
      : {
          text: `Even ${fstop(stops[stops.length - 1])} leaves the background ${bgAt(stops[stops.length - 1]).toFixed(1)}× soft: step back or use a wider lens to show it.`,
        };
  } else {
    // Background nearly sharp: offer separation.
    const widest = stops[0];
    const at = bgAt(widest);
    suggestion =
      widest < fNumber && at > 3
        ? {
            text: `To separate the subject from the background, open up to ${fstop(widest)}: the background becomes ${at.toFixed(1)}× soft.`,
            action: { label: `Try ${fstop(widest)}`, fNumber: widest },
          }
        : {
            text: "For more separation, get closer to the subject or move it further from the background: aperture alone won't do much more here.",
          };
  }

  return { zone, subject, background, backgroundRatio: ratio, look, suggestion };
}
