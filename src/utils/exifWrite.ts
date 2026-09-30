// Writes a small EXIF block into a JPEG (#51), for scans of film that carry
// no settings: camera, lens, aperture, shutter, ISO, focal length, date and
// a description (film, place, note). Any EXIF already there is replaced;
// the image data itself isn't touched. Read back by utils/exif.ts.

export interface ExifFields {
  make?: string;
  model?: string;
  lens?: string;
  fNumber?: number;
  shutterSec?: number;
  iso?: number;
  focalMm?: number;
  /** "YYYY:MM:DD HH:MM:SS". */
  takenAt?: string;
  description?: string;
  artist?: string;
  /** Where it was taken, decimal degrees. */
  gps?: { lat: number; lon: number };
}

const enc = new TextEncoder();

/** One IFD entry: ASCII, BYTEs, SHORT, LONG pointer, or one or more RATIONALs. */
type Entry = { tag: number; type: 1 | 2 | 3 | 4 | 5; data: number[] | [number, number][] | Uint8Array };

function rational(x: number, den: number): [number, number] {
  return [Math.round(x * den), den];
}

/** 1/250 → 1/250 exactly; slower speeds in tenths. */
export function shutterRational(sec: number): [number, number] {
  if (sec < 1) {
    const d = Math.round(1 / sec);
    if (Math.abs(1 / d - sec) / sec < 0.01) return [1, d];
  }
  return rational(sec, 10);
}

const ascii = (s: string) => {
  const b = enc.encode(s);
  const out = new Uint8Array(b.length + 1);
  out.set(b);
  return out;
};

/** Decimal degrees → degrees, minutes, seconds (to 1/10000 s) as three rationals. */
export function dms(deg: number): [number, number][] {
  const a = Math.abs(deg);
  const d = Math.floor(a);
  const mFull = (a - d) * 60;
  const m = Math.floor(mFull);
  const sec = (mFull - m) * 60;
  return [
    [d, 1],
    [m, 1],
    [Math.round(sec * 10000), 10000],
  ];
}

/** The TIFF block (big-endian): IFD0, with pointers to the Exif IFD and, if there's a position, the GPS IFD. */
function tiff(f: ExifFields): Uint8Array {
  const ifd0: Entry[] = [];
  const exif: Entry[] = [];
  const gps: Entry[] = [];
  if (f.description) ifd0.push({ tag: 0x010e, type: 2, data: ascii(f.description) });
  if (f.make) ifd0.push({ tag: 0x010f, type: 2, data: ascii(f.make) });
  if (f.model) ifd0.push({ tag: 0x0110, type: 2, data: ascii(f.model) });
  if (f.takenAt) ifd0.push({ tag: 0x0132, type: 2, data: ascii(f.takenAt) });
  if (f.artist) ifd0.push({ tag: 0x013b, type: 2, data: ascii(f.artist) });
  if (f.shutterSec) exif.push({ tag: 0x829a, type: 5, data: [shutterRational(f.shutterSec)] });
  if (f.fNumber) exif.push({ tag: 0x829d, type: 5, data: [rational(f.fNumber, 10)] });
  if (f.iso) exif.push({ tag: 0x8827, type: 3, data: [Math.min(65535, Math.round(f.iso))] });
  if (f.takenAt) exif.push({ tag: 0x9003, type: 2, data: ascii(f.takenAt) });
  if (f.focalMm) exif.push({ tag: 0x920a, type: 5, data: [rational(f.focalMm, 10)] });
  if (f.lens) exif.push({ tag: 0xa434, type: 2, data: ascii(f.lens) });
  if (f.gps) {
    gps.push({ tag: 0x0000, type: 1, data: [2, 3, 0, 0] });
    gps.push({ tag: 0x0001, type: 2, data: ascii(f.gps.lat >= 0 ? "N" : "S") });
    gps.push({ tag: 0x0002, type: 5, data: dms(f.gps.lat) });
    gps.push({ tag: 0x0003, type: 2, data: ascii(f.gps.lon >= 0 ? "E" : "W") });
    gps.push({ tag: 0x0004, type: 5, data: dms(f.gps.lon) });
  }

  const ifdSize = (n: number) => 2 + n * 12 + 4;
  const withPointers = [...ifd0, { tag: 0x8769, type: 4, data: [0] } as Entry, ...(gps.length ? [{ tag: 0x8825, type: 4, data: [0] } as Entry] : [])].sort((a, b) => a.tag - b.tag);
  exif.sort((a, b) => a.tag - b.tag);
  const ifd0At = 8;
  const exifAt = ifd0At + ifdSize(withPointers.length);
  const gpsAt = exifAt + ifdSize(exif.length);
  let dataAt = gpsAt + (gps.length ? ifdSize(gps.length) : 0);
  const bytes: number[] = [0x4d, 0x4d, 0, 42, 0, 0, 0, ifd0At];
  const tail: number[] = [];
  const u16 = (v: number) => [(v >> 8) & 255, v & 255];
  const u32 = (v: number) => [(v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255];

  const write = (list: Entry[]) => {
    bytes.push(...u16(list.length));
    for (const v of list) {
      let payload: number[];
      let count: number;
      if (v.tag === 0x8769 && v.type === 4) {
        payload = u32(exifAt);
        count = 1;
      } else if (v.tag === 0x8825 && v.type === 4) {
        payload = u32(gpsAt);
        count = 1;
      } else if (v.type === 1 || v.type === 2) {
        payload = [...(v.data as Uint8Array | number[])];
        count = payload.length;
      } else if (v.type === 3) {
        payload = u16((v.data as number[])[0]);
        count = 1;
      } else {
        const list5 = v.data as [number, number][];
        payload = list5.flatMap(([n, d]) => [...u32(n), ...u32(d)]);
        count = list5.length;
      }
      bytes.push(...u16(v.tag), ...u16(v.type), ...u32(count));
      if (payload.length <= 4) bytes.push(...payload, ...Array(4 - payload.length).fill(0));
      else {
        bytes.push(...u32(dataAt));
        tail.push(...payload);
        if (payload.length % 2) tail.push(0);
        dataAt += payload.length + (payload.length % 2);
      }
    }
    bytes.push(0, 0, 0, 0);
  };
  write(withPointers);
  write(exif);
  if (gps.length) write(gps);
  return Uint8Array.from([...bytes, ...tail]);
}

/** A copy of the JPEG with this EXIF block in place of any earlier one. Throws for a file that isn't a JPEG. */
export function writeExif(jpeg: ArrayBuffer, fields: ExifFields): Uint8Array<ArrayBuffer> {
  const src = new Uint8Array(jpeg);
  if (src[0] !== 0xff || src[1] !== 0xd8) throw new Error("not a JPEG");
  const block = tiff(fields);
  const app1Len = 2 + 6 + block.length;
  if (app1Len > 0xffff) throw new Error("EXIF too large");
  const app1 = new Uint8Array(2 + app1Len);
  app1.set([0xff, 0xe1, app1Len >> 8, app1Len & 255, 0x45, 0x78, 0x69, 0x66, 0, 0]);
  app1.set(block, 10);

  // Keep every segment before the image data except earlier EXIF blocks; put ours after JFIF (APP0) if there is one.
  const parts: Uint8Array[] = [src.subarray(0, 2)];
  let p = 2;
  let placed = false;
  while (p + 4 <= src.length) {
    if (src[p] !== 0xff) break;
    const marker = src[p + 1];
    if (marker === 0xda) break; // Start of scan: the rest is image data.
    const len = (src[p + 2] << 8) | src[p + 3];
    const seg = src.subarray(p, p + 2 + len);
    const isExif = marker === 0xe1 && seg[4] === 0x45 && seg[5] === 0x78 && seg[6] === 0x69 && seg[7] === 0x66;
    if (!placed && marker !== 0xe0) {
      parts.push(app1);
      placed = true;
    }
    if (!isExif) parts.push(seg);
    p += 2 + len;
  }
  if (!placed) parts.push(app1);
  parts.push(src.subarray(p));
  const out = new Uint8Array(parts.reduce((n, x) => n + x.length, 0));
  let o = 0;
  for (const x of parts) {
    out.set(x, o);
    o += x.length;
  }
  return out;
}

/** "2026-09-30T10:12:00.000Z" (the shot log's time) → "2026:09:30 10:12:00" in local time. */
export function exifDate(iso: string): string | undefined {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return undefined;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}:${p(d.getMonth() + 1)}:${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
