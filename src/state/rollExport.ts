// CSV/JSON export for a roll or memory card's frames. Pure string-building —
// no DOM, no Blob — so it's testable without a browser, and the download
// trigger (a Blob + temporary <a>) lives in the component that calls it.

export interface FrameMeta {
  body: string;
  lens: string;
  focalMm: number;
  fNumber: number;
  shutterSec: number;
  /** `Infinity` for focused at infinity. */
  focusMm: number;
  iso: number;
  /** Film stock name, or "ISO n" for a digital sensor. */
  filmOrSensor: string;
  /** Exposure deviation (stops) of the chosen settings from a metered exposure for the scene; +over, -under. */
  evOffset: number;
  /** Where the subject stood (the Studio's scene); absent for live and lab frames, and for frames saved before it was recorded. */
  subjectMm?: number;
  /** The circle of confusion the frame was judged by. */
  cocMm?: number;
  tripod?: boolean;
  /** When the frame was taken, ISO 8601. */
  takenAt?: string;
  /** What made the picture. */
  source?: "studio" | "live" | "lab";
}

export interface ExportableFrame {
  number: number;
  fileName: string;
  meta: FrameMeta;
  note?: string;
}

/** A user-tagged shooting outcome — the feedback half of the scan/negatives loop. */
export type OutcomeTag = "good" | "missed-focus" | "motion-blur" | "underexposed" | "overexposed";

export const OUTCOME_TAGS: { id: OutcomeTag; label: string }[] = [
  { id: "good", label: "Good" },
  { id: "missed-focus", label: "Missed focus" },
  { id: "motion-blur", label: "Motion blur" },
  { id: "underexposed", label: "Underexposed" },
  { id: "overexposed", label: "Overexposed" },
];

/** A captured frame: the domain model shared by the roll/card UI and its persistence. */
export interface Frame {
  id: number;
  number: number;
  url: string;
  caption: string;
  fileName: string;
  meta: FrameMeta;
  note?: string;
  outcome?: OutcomeTag;
}

const CSV_HEADERS = ["frame", "body", "lens", "aperture", "shutter_s", "focus_mm", "iso", "film_or_sensor", "note", "file"];

function csvField(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function csvRow(f: ExportableFrame): string[] {
  return [
    String(f.number),
    f.meta.body,
    f.meta.lens,
    String(f.meta.fNumber),
    String(f.meta.shutterSec),
    Number.isFinite(f.meta.focusMm) ? String(Math.round(f.meta.focusMm)) : "inf",
    String(f.meta.iso),
    f.meta.filmOrSensor,
    f.note ?? "",
    f.fileName,
  ];
}

/** CSV with a header row; frame order is preserved exactly as given. */
export function framesToCsv(frames: ExportableFrame[]): string {
  const rows = [CSV_HEADERS, ...frames.map(csvRow)];
  return rows.map((row) => row.map(csvField).join(",")).join("\r\n");
}

/** JSON array, one object per frame, in the given order. */
export function framesToJson(frames: ExportableFrame[]): string {
  return JSON.stringify(
    frames.map((f) => ({
      frame: f.number,
      body: f.meta.body,
      lens: f.meta.lens,
      fNumber: f.meta.fNumber,
      shutterSec: f.meta.shutterSec,
      focusMm: Number.isFinite(f.meta.focusMm) ? f.meta.focusMm : null,
      iso: f.meta.iso,
      filmOrSensor: f.meta.filmOrSensor,
      note: f.note ?? null,
      file: f.fileName,
    })),
    null,
    2
  );
}
