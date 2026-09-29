// Does this lens work on this camera, and how? Mount, adapter, rangefinder
// coupling, frame lines, and the specific warnings Leica publishes for some
// lenses on digital M bodies. Every warning carries its source; nothing here
// is guessed. Pure, so each rule is testable.

import { framelinesFor, isAdapted, type Body, type Lens } from "../data/gear";

export type Verdict = "fits" | "adapter" | "limited" | "no";

export interface CompatNote {
  level: "ok" | "info" | "caution" | "stop";
  title: string;
  detail: string;
  source?: { label: string; url?: string };
}

export interface Compat {
  verdict: Verdict;
  notes: CompatNote[];
}

const M10R_MANUAL = {
  label: "Leica M10-R instruction manual, “Lenses with limited compatibility; incompatible lenses”",
  url: "https://www.manualslib.com/manual/1941695/Leica-M10-R.html?page=34",
};
const APO35_COUPLING = {
  label: "Leica APO-Summicron-M 35 f/2 ASPH. launch coverage (rangefinder coupled to 0.7 m)",
  url: "https://www.reddotforum.com/content/2021/03/leica-apo-summicron-m-35mm-f-2-asph/",
};

/** The M rangefinder couples from infinity down to 0.7 m; closer focusing needs a screen. */
export const RANGEFINDER_COUPLING_MM = 700;

/** Lens-specific notes Leica publishes for digital M bodies, by catalogue id. */
const DIGITAL_M_NOTES: Record<string, CompatNote> = {
  "m-50-2.8": {
    level: "caution",
    title: "Never collapse it on the camera",
    detail: "A lens with a retractable tube may only be used extended: collapsing it while mounted pushes it into the body.",
    source: M10R_MANUAL,
  },
  "m-35-1.4-pre": {
    level: "caution",
    title: "Some examples need modifying",
    detail: "Some non-aspherical Summilux-M 35 f/1.4 lenses (1961–1995, made in Canada) need a modification by Leica Customer Care before use on a digital M.",
    source: M10R_MANUAL,
  },
  "m-135-3.4": {
    level: "info",
    title: "Stop down to focus with the rangefinder",
    detail: "Exact rangefinder focusing wide open at 135 mm isn't guaranteed because the depth of field is so shallow: stop down at least two stops, or focus in live view.",
    source: M10R_MANUAL,
  },
  "m-50-0.95": {
    level: "info",
    title: "Heavy lens: mind the tripod",
    detail: "On a tripod, lock the head so it can't tip suddenly: the weight can strain the bayonet.",
    source: M10R_MANUAL,
  },
};

export function compatibility(body: Body, lens: Lens): Compat {
  const notes: CompatNote[] = [];
  const native = body.mounts.includes(lens.mount);
  const adapted = !native && isAdapted(body, lens);

  if (!native && !adapted) {
    return {
      verdict: "no",
      notes: [
        {
          level: "stop",
          title: `No: ${lens.mount === "fixed" ? "a fixed lens" : `${lens.mount} mount`} on a ${body.mounts.join("/")}-mount body`,
          detail: body.mounts.includes("fixed") ? `The ${body.name}'s lens is built in.` : `The ${body.name} takes ${body.mounts.join(" or ")}-mount lenses${body.adaptedMounts?.length ? `, and ${body.adaptedMounts.join("/")} through an adapter` : ""}.`,
        },
      ],
    };
  }

  notes.push(
    adapted
      ? { level: "info", title: `Fits with an ${lens.mount}-mount adapter`, detail: `The lens mounts on the ${body.name} through an adapter and is focused on the screen or in the viewfinder, not with a rangefinder.` }
      : { level: "ok", title: "Mounts directly", detail: `A native ${lens.mount}-mount lens.` },
  );

  if (body.rangefinder && lens.mount === "M") {
    const frames = framelinesFor(body, lens.focalMm);
    notes.push(
      frames
        ? { level: "ok", title: `Frame lines: ${frames.join(" / ")} mm`, detail: `Mounting it brings up the ${frames.join("/")} mm frame lines in the ${body.name}'s finder.` }
        : {
            level: "caution",
            title: `No ${lens.focalMm} mm frame lines`,
            detail: `The ${body.name}'s finder has no ${lens.focalMm} mm frame lines: frame with an accessory viewfinder${body.medium === "film" ? "" : ", the screen or an electronic viewfinder"}.`,
          },
    );
    if (lens.minFocusMm < RANGEFINDER_COUPLING_MM - 1) {
      notes.push({
        level: "info",
        title: "Rangefinder couples to 0.7 m",
        detail:
          body.medium === "film"
            ? `The lens focuses to ${(lens.minFocusMm / 1000).toFixed(2)} m, but a rangefinder only couples down to 0.7 m: closer, you set the distance by scale.`
            : `The lens focuses to ${(lens.minFocusMm / 1000).toFixed(2)} m; the rangefinder couples down to 0.7 m, and closer you focus on the screen or in an electronic viewfinder.`,
        source: APO35_COUPLING,
      });
    }
  }

  // The published warnings are from the M10-generation manual; they're applied to the M10 and M11 bodies it covers.
  // Earlier digital Ms get a pointer to their own manual rather than a borrowed rule.
  const digitalM = body.family === "M digital";
  const specific = DIGITAL_M_NOTES[lens.id];
  if (digitalM && specific && body.year >= 2017) notes.push(specific);
  else if (digitalM && specific) {
    notes.push({
      level: "info",
      title: "Check this body's manual",
      detail: `Leica lists restrictions for this lens on later digital Ms (${specific.title.toLowerCase()}); see the ${body.name}'s own manual before using it.`,
      source: M10R_MANUAL,
    });
  }

  const limited = notes.some((n) => n.level === "caution");
  return { verdict: adapted ? "adapter" : limited ? "limited" : "fits", notes };
}
