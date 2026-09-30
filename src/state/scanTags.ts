// Tag your scans (#51): a shot-log frame as the EXIF fields for its scan.

import { LENSES } from "../data/gear";
import { FILM_STOCKS } from "../preview/film";
import { exifDate, type ExifFields } from "../utils/exifWrite";
import type { LogEntry } from "./shotLog";

/** What the shot log knows, as EXIF. */
export function fieldsFor(e: LogEntry, artist: string): ExifFields {
  const lens = LENSES.find((l) => l.name === e.lens);
  const isoFromName = /ISO\s*(\d+)/i.exec(e.film)?.[1];
  const film = FILM_STOCKS.find((f) => f.name === e.film);
  const description = [e.film, e.place, e.note].filter(Boolean).join(" | ");
  return {
    make: "Leica Camera AG",
    model: e.body.startsWith("Leica") ? e.body : `Leica ${e.body}`,
    lens: e.lens,
    fNumber: e.fNumber,
    shutterSec: e.shutterSec,
    iso: isoFromName ? Number(isoFromName) : film?.iso,
    focalMm: lens?.focalMm,
    takenAt: exifDate(e.takenAt),
    description: description || undefined,
    artist: artist.trim() || undefined,
  };
}

