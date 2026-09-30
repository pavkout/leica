// A small EXIF reader for the Photography Lab (#43): the few tags a
// photographer sets (aperture, shutter, ISO, focal length, lens, camera,
// time). JPEG only (what cameras and scanners hand over); no dependency.
// Anything unreadable comes back as an empty result, never an error.
//
// Leica M bodies estimate the aperture of an uncoded manual lens from the
// light, so FNumber on those files can be off; the Lab lets the owner
// correct any value and says why.

export interface ExifSettings {
  make?: string;
  model?: string;
  lens?: string;
  fNumber?: number;
  shutterSec?: number;
  iso?: number;
  focalMm?: number;
  /** Focal length in 35 mm terms, when the camera records it. */
  focal35Mm?: number;
  /** Metres; rarely recorded, and only as the camera's estimate. */
  subjectDistanceM?: number;
  /** "YYYY:MM:DD HH:MM:SS", as written by the camera. */
  takenAt?: string;
}

const TAGS = {
  make: 0x010f,
  model: 0x0110,
  exifPointer: 0x8769,
  exposureTime: 0x829a,
  fNumber: 0x829d,
  iso: 0x8827,
  takenAt: 0x9003,
  subjectDistance: 0x9206,
  focalLength: 0x920a,
  focal35: 0xa405,
  lensModel: 0xa434,
} as const;

const TYPE_SIZE: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 };

interface Entry {
  type: number;
  count: number;
  /** Offset of the value (or of the 4 inline bytes) within the TIFF block. */
  at: number;
}

function readIfd(view: DataView, tiff: number, offset: number, little: boolean): Map<number, Entry> {
  const out = new Map<number, Entry>();
  if (tiff + offset + 2 > view.byteLength) return out;
  const n = view.getUint16(tiff + offset, little);
  for (let i = 0; i < n; i++) {
    const e = tiff + offset + 2 + i * 12;
    if (e + 12 > view.byteLength) break;
    const tag = view.getUint16(e, little);
    const type = view.getUint16(e + 2, little);
    const count = view.getUint32(e + 4, little);
    const size = (TYPE_SIZE[type] ?? 1) * count;
    const at = size <= 4 ? e + 8 - tiff : view.getUint32(e + 8, little);
    out.set(tag, { type, count, at });
  }
  return out;
}

function ascii(view: DataView, tiff: number, e: Entry | undefined): string | undefined {
  if (!e || e.type !== 2) return undefined;
  let s = "";
  for (let i = 0; i < e.count && tiff + e.at + i < view.byteLength; i++) {
    const c = view.getUint8(tiff + e.at + i);
    if (c === 0) break;
    s += String.fromCharCode(c);
  }
  return s.trim() || undefined;
}

function number(view: DataView, tiff: number, e: Entry | undefined, little: boolean): number | undefined {
  if (!e) return undefined;
  const p = tiff + e.at;
  if (p + (TYPE_SIZE[e.type] ?? 1) > view.byteLength) return undefined;
  switch (e.type) {
    case 3:
      return view.getUint16(p, little);
    case 4:
      return view.getUint32(p, little);
    case 5:
    case 10: {
      const num = e.type === 5 ? view.getUint32(p, little) : view.getInt32(p, little);
      const den = e.type === 5 ? view.getUint32(p + 4, little) : view.getInt32(p + 4, little);
      return den ? num / den : undefined;
    }
    default:
      return undefined;
  }
}

/** Reads the settings from a JPEG's EXIF block. */
export function readExif(buffer: ArrayBuffer): ExifSettings {
  const view = new DataView(buffer);
  if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return {};
  let p = 2;
  while (p + 4 <= view.byteLength) {
    const marker = view.getUint16(p);
    if ((marker & 0xff00) !== 0xff00) return {};
    const len = view.getUint16(p + 2);
    // APP1 with "Exif\0\0".
    if (marker === 0xffe1 && p + 10 <= view.byteLength && view.getUint32(p + 4) === 0x45786966 && view.getUint16(p + 8) === 0) {
      return parseTiff(view, p + 10);
    }
    if (marker === 0xffda) return {}; // Start of the image data: no EXIF before it.
    p += 2 + len;
  }
  return {};
}

function parseTiff(view: DataView, tiff: number): ExifSettings {
  if (tiff + 8 > view.byteLength) return {};
  const order = view.getUint16(tiff);
  if (order !== 0x4949 && order !== 0x4d4d) return {};
  const little = order === 0x4949;
  const ifd0 = readIfd(view, tiff, view.getUint32(tiff + 4, little), little);
  const exifAt = number(view, tiff, ifd0.get(TAGS.exifPointer), little);
  const exif = exifAt ? readIfd(view, tiff, exifAt, little) : new Map<number, Entry>();
  const num = (tag: number) => number(view, tiff, exif.get(tag), little);
  const out: ExifSettings = {
    make: ascii(view, tiff, ifd0.get(TAGS.make)),
    model: ascii(view, tiff, ifd0.get(TAGS.model)),
    lens: ascii(view, tiff, exif.get(TAGS.lensModel)),
    fNumber: num(TAGS.fNumber),
    shutterSec: num(TAGS.exposureTime),
    iso: num(TAGS.iso),
    focalMm: num(TAGS.focalLength),
    focal35Mm: num(TAGS.focal35),
    subjectDistanceM: num(TAGS.subjectDistance),
    takenAt: ascii(view, tiff, exif.get(TAGS.takenAt)),
  };
  // Zero means "unknown" for these tags.
  for (const k of ["fNumber", "shutterSec", "iso", "focalMm", "focal35Mm", "subjectDistanceM"] as const) if (!out[k]) delete out[k];
  for (const k of Object.keys(out) as (keyof ExifSettings)[]) if (out[k] === undefined) delete out[k];
  return out;
}
