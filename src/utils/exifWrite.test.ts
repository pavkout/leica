import { describe, expect, it } from "vitest";
import { readExif } from "./exif";
import { exifDate, shutterRational, writeExif } from "./exifWrite";

/** A minimal JPEG: SOI, JFIF APP0, an old EXIF APP1, then start of scan and some "image" bytes. */
function jpeg(): ArrayBuffer {
  const app0 = [0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0];
  const oldTiff = [0x4d, 0x4d, 0, 42, 0, 0, 0, 8, 0, 0, 0, 0, 0, 0];
  const oldExif = [0xff, 0xe1, 0, 2 + 6 + oldTiff.length, 0x45, 0x78, 0x69, 0x66, 0, 0, ...oldTiff];
  const scan = [0xff, 0xda, 0, 4, 1, 2, 9, 8, 7, 6, 5, 0xff, 0xd9];
  return new Uint8Array([0xff, 0xd8, ...app0, ...oldExif, ...scan]).buffer;
}

describe("writing EXIF into a scan", () => {
  it("round-trips the settings through the reader", () => {
    const out = writeExif(jpeg(), {
      make: "Leica Camera AG",
      model: "LEICA M6",
      lens: "Summicron-M 35 f/2",
      fNumber: 5.6,
      shutterSec: 1 / 250,
      iso: 400,
      focalMm: 35,
      takenAt: "2026:09:30 10:12:00",
      description: "HP5 Plus · Lisboa · tram at dusk",
      artist: "P. K.",
    });
    expect(readExif(out.buffer)).toEqual({
      make: "Leica Camera AG",
      model: "LEICA M6",
      lens: "Summicron-M 35 f/2",
      fNumber: 5.6,
      shutterSec: 1 / 250,
      iso: 400,
      focalMm: 35,
      takenAt: "2026:09:30 10:12:00",
    });
  });
  it("keeps the image data and JFIF, and replaces the old EXIF block", () => {
    const src = new Uint8Array(jpeg());
    const out = writeExif(src.buffer, { model: "M3" });
    const tail = [...src.subarray(src.length - 13)];
    expect([...out.subarray(out.length - 13)]).toEqual(tail);
    expect([out[2], out[3]]).toEqual([0xff, 0xe0]);
    const exifCount = [...out].filter((_, i) => out[i] === 0xff && out[i + 1] === 0xe1).length;
    expect(exifCount).toBe(1);
    expect(readExif(out.buffer).model).toBe("M3");
  });
  it("refuses what isn't a JPEG", () => {
    expect(() => writeExif(new Uint8Array([1, 2, 3]).buffer, {})).toThrow();
  });
  it("writes shutter speeds the way cameras do", () => {
    expect(shutterRational(1 / 125)).toEqual([1, 125]);
    expect(shutterRational(2)).toEqual([20, 10]);
    expect(shutterRational(0.4)).toEqual([4, 10]);
  });
  it("converts the log's time", () => {
    expect(exifDate("not a date")).toBeUndefined();
    expect(exifDate(new Date(2026, 8, 30, 10, 12, 5).toISOString())).toBe("2026:09:30 10:12:05");
  });
});
