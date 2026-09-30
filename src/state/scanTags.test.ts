import { describe, expect, it } from "vitest";
import { fieldsFor } from "./scanTags";
import type { LogEntry } from "./shotLog";

const e: LogEntry = { id: "1", roll: "Roll 1", frame: 3, takenAt: new Date(2026, 8, 30, 18, 5).toISOString(), body: "M6", lens: "Summicron-M 35 f/2 ASPH.", fNumber: 2.8, shutterSec: 1 / 60, film: "HP5 Plus", place: "Lisboa", note: "tram" };

describe("scan tags", () => {
  it("turns a logged frame into EXIF fields", () => {
    const f = fieldsFor(e, " P. K. ");
    expect(f).toMatchObject({ make: "Leica Camera AG", model: "Leica M6", fNumber: 2.8, shutterSec: 1 / 60, iso: 400, takenAt: "2026:09:30 18:05:00", description: "HP5 Plus | Lisboa | tram", artist: "P. K." });
  });
  it("reads ISO from a digital frame and leaves out what it doesn't know", () => {
    const f = fieldsFor({ ...e, body: "Leica M11", film: "ISO 1600", lens: "Unknown", place: undefined, note: undefined }, "");
    expect(f.iso).toBe(1600);
    expect(f.model).toBe("Leica M11");
    expect(f.focalMm).toBeUndefined();
    expect(f.artist).toBeUndefined();
    expect(f.description).toBe("ISO 1600");
  });
});

describe("locations from routes", () => {
  it("places a frame where the phone was when it was logged", () => {
    const t = Date.parse(e.takenAt);
    const tracks = [{ id: "r", startedAt: t - 60_000, points: [{ t: t - 60_000, lat: 38.7, lon: -9.14 }, { t: t + 60_000, lat: 38.71, lon: -9.13 }] }];
    const f = fieldsFor(e, "", tracks);
    expect(f.gps!.lat).toBeCloseTo(38.705, 5);
    expect(fieldsFor(e, "", []).gps).toBeUndefined();
  });
});
