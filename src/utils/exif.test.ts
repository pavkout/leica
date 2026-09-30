import { describe, expect, it } from "vitest";
import { readExif } from "./exif";

/** Builds a minimal JPEG with an EXIF block, in either byte order. */
function jpeg(little: boolean, entries: { ifd0: [number, number, unknown][]; exif: [number, number, unknown][] }) {
  const bytes: number[] = [];
  const u16 = (v: number) => (little ? [v & 255, v >> 8] : [v >> 8, v & 255]);
  const u32 = (v: number) => (little ? [v & 255, (v >> 8) & 255, (v >> 16) & 255, v >>> 24] : [v >>> 24, (v >> 16) & 255, (v >> 8) & 255, v & 255]);

  // Lay out: header (8), IFD0, Exif IFD, then value data.
  const ifdSize = (n: number) => 2 + n * 12 + 4;
  const ifd0At = 8;
  const exifAt = ifd0At + ifdSize(entries.ifd0.length + 1);
  let dataAt = exifAt + ifdSize(entries.exif.length);
  const data: number[] = [];
  const encode = (type: number, value: unknown): { count: number; inline: number[] | null; blob: number[] } => {
    if (type === 2) {
      const s = [...String(value)].map((c) => c.charCodeAt(0)).concat(0);
      return s.length <= 4 ? { count: s.length, inline: [...s, 0, 0, 0, 0].slice(0, 4), blob: [] } : { count: s.length, inline: null, blob: s };
    }
    if (type === 3) return { count: 1, inline: [...u16(value as number), 0, 0], blob: [] };
    if (type === 4) return { count: 1, inline: u32(value as number), blob: [] };
    const [n, d] = value as [number, number];
    return { count: 1, inline: null, blob: [...u32(n), ...u32(d)] };
  };
  const ifd = (list: [number, number, unknown][], next: [number, number, unknown][] = []) => {
    const all = [...list, ...next].sort((a, b) => a[0] - b[0]);
    const out = [...u16(all.length)];
    for (const [tag, type, value] of all) {
      const enc = encode(type, value);
      out.push(...u16(tag), ...u16(type), ...u32(enc.count));
      if (enc.inline) out.push(...enc.inline);
      else {
        out.push(...u32(dataAt));
        data.push(...enc.blob);
        dataAt += enc.blob.length;
      }
    }
    out.push(...u32(0));
    return out;
  };
  const tiff = [...(little ? [0x49, 0x49] : [0x4d, 0x4d]), ...u16(42), ...u32(ifd0At), ...ifd(entries.ifd0, [[0x8769, 4, exifAt]]), ...ifd(entries.exif)];
  tiff.push(...data);
  const app1 = [0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff];
  bytes.push(0xff, 0xd8, 0xff, 0xe1, (app1.length + 2) >> 8, (app1.length + 2) & 255, ...app1, 0xff, 0xda, 0, 2);
  return new Uint8Array(bytes).buffer;
}

const sample = {
  ifd0: [
    [0x010f, 2, "Leica Camera AG"],
    [0x0110, 2, "LEICA M11"],
  ] as [number, number, unknown][],
  exif: [
    [0x829a, 5, [1, 250]],
    [0x829d, 5, [56, 10]],
    [0x8827, 3, 400],
    [0x920a, 5, [35, 1]],
    [0xa434, 2, "Summicron-M 1:2/35 ASPH."],
    [0x9003, 2, "2026:09:30 10:12:00"],
  ] as [number, number, unknown][],
};

describe("readExif", () => {
  it.each([true, false])("reads the settings (little-endian: %s)", (little) => {
    expect(readExif(jpeg(little, sample))).toEqual({
      make: "Leica Camera AG",
      model: "LEICA M11",
      lens: "Summicron-M 1:2/35 ASPH.",
      fNumber: 5.6,
      shutterSec: 1 / 250,
      iso: 400,
      focalMm: 35,
      takenAt: "2026:09:30 10:12:00",
    });
  });
  it("drops zero values the camera writes for unknown", () => {
    const r = readExif(jpeg(true, { ifd0: [], exif: [[0x829d, 5, [0, 1]], [0x8827, 3, 200]] }));
    expect(r).toEqual({ iso: 200 });
  });
  it("returns nothing for a file without EXIF or that isn't a JPEG", () => {
    expect(readExif(new Uint8Array([0xff, 0xd8, 0xff, 0xda, 0, 2]).buffer)).toEqual({});
    expect(readExif(new Uint8Array([1, 2, 3, 4, 5]).buffer)).toEqual({});
    expect(readExif(new ArrayBuffer(0))).toEqual({});
  });
  it("survives a truncated block", () => {
    const full = new Uint8Array(jpeg(true, sample));
    expect(() => readExif(full.slice(0, 40).buffer)).not.toThrow();
  });
});
