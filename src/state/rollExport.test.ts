import { describe, expect, it } from "vitest";
import { type ExportableFrame, framesToCsv, framesToJson } from "./rollExport";

const frame1: ExportableFrame = {
  number: 1,
  fileName: "rangefinder-01.jpg",
  meta: { body: "M11", lens: "Summilux-M 50 f/1.4 ASPH.", focalMm: 50, fNumber: 1.4, shutterSec: 1 / 500, focusMm: 2000, iso: 400, filmOrSensor: "ISO 400", evOffset: 0 },
  note: "sharp",
};

const frame2: ExportableFrame = {
  number: 2,
  fileName: "rangefinder-02.jpg",
  meta: { body: "M3", lens: 'Summicron 35 f/2 (8 elements)', focalMm: 35, fNumber: 2, shutterSec: 1 / 60, focusMm: Infinity, iso: 400, filmOrSensor: "Tri-X 400", evOffset: -0.3 },
};

describe("framesToCsv", () => {
  it("has a header row and one row per frame, in order", () => {
    const csv = framesToCsv([frame1, frame2]);
    const lines = csv.split("\r\n");
    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe("frame,body,lens,aperture,shutter_s,focus_mm,iso,film_or_sensor,note,file");
    expect(lines[1]).toContain("M11");
    expect(lines[2]).toContain("M3");
  });

  it("represents infinity focus as 'inf', not a huge number or blank", () => {
    const csv = framesToCsv([frame2]);
    expect(csv.split("\r\n")[1].split(",")).toContain("inf");
  });

  it("quotes and escapes fields containing commas or quotes", () => {
    const withComma: ExportableFrame = { ...frame1, meta: { ...frame1.meta, lens: 'Lens, "special"' } };
    const csv = framesToCsv([withComma]);
    expect(csv).toContain('"Lens, ""special"""');
  });

  it("leaves an absent note as an empty field, not 'undefined'", () => {
    const csv = framesToCsv([frame2]);
    const cols = csv.split("\r\n")[1].split(",");
    const noteIndex = framesToCsv([frame2]).split("\r\n")[0].split(",").indexOf("note");
    expect(cols[noteIndex]).toBe("");
  });

  it("produces an empty-but-headered CSV for no frames", () => {
    expect(framesToCsv([]).split("\r\n")).toHaveLength(1);
  });
});

describe("framesToJson", () => {
  it("preserves frame order and all fields, with infinity as null", () => {
    const parsed = JSON.parse(framesToJson([frame1, frame2]));
    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toMatchObject({ frame: 1, body: "M11", note: "sharp" });
    expect(parsed[1]).toMatchObject({ frame: 2, body: "M3", focusMm: null, note: null });
  });

  it("round-trips through JSON.parse without throwing", () => {
    expect(() => JSON.parse(framesToJson([frame1, frame2]))).not.toThrow();
  });
});
