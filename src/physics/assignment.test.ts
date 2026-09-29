import { describe, expect, it } from "vitest";
import { ASSIGNMENTS } from "../data/assignments";
import type { FrameMeta } from "../state/rollExport";
import { assignmentFor, dayNumber, gradeFrame, localDay, streak } from "./assignment";

const meta = (m: Partial<FrameMeta>): FrameMeta => ({
  body: "M6",
  lens: "Summicron-M 35 f/2 ASPH.",
  focalMm: 35,
  fNumber: 8,
  shutterSec: 1 / 250,
  focusMm: 3000,
  iso: 400,
  filmOrSensor: "HP5 Plus",
  evOffset: 0,
  cocMm: 0.03,
  ...m,
});

const find = (id: string) => ASSIGNMENTS.find((a) => a.id === id)!;

describe("daily assignment", () => {
  it("gives everyone the same brief on the same day, and a different one the next", () => {
    expect(assignmentFor("2026-09-29").id).toBe(assignmentFor("2026-09-29").id);
    expect(assignmentFor("2026-09-29").id).not.toBe(assignmentFor("2026-09-30").id);
  });

  it("formats local days and counts calendar days", () => {
    expect(localDay(new Date(2026, 0, 5, 23, 30))).toBe("2026-01-05");
    expect(dayNumber("2026-01-02") - dayNumber("2026-01-01")).toBe(1);
  });

  it("grades every rule separately", () => {
    const zone = find("zone-3m");
    expect(gradeFrame(zone, meta({})).complete).toBe(true);
    const g = gradeFrame(zone, meta({ fNumber: 2.8, focusMm: 5000 }));
    expect(g.complete).toBe(false);
    expect(g.passed).toBe(2);
  });

  it("judges hyperfocal focusing from the frame's own aperture and lens", () => {
    const h = find("hyperfocal");
    expect(gradeFrame(h, meta({ focusMm: (35 * 35) / (8 * 0.03) + 35 })).complete).toBe(true);
    expect(gradeFrame(h, meta({ focusMm: 2000 })).complete).toBe(false);
  });

  it("slow and steady passes a braced wide lens, not a hand-held long one", () => {
    const s = find("slow-steady");
    expect(gradeFrame(s, meta({ focalMm: 21, shutterSec: 1 / 15 })).complete).toBe(true);
    expect(gradeFrame(s, meta({ focalMm: 90, shutterSec: 1 / 15 })).complete).toBe(false);
    expect(gradeFrame(s, meta({ focalMm: 90, shutterSec: 1 / 15, tripod: true })).complete).toBe(true);
  });

  it("counts a streak through today, or through yesterday while today is still open", () => {
    expect(streak(["2026-09-27", "2026-09-28", "2026-09-29"], "2026-09-29")).toBe(3);
    expect(streak(["2026-09-27", "2026-09-28"], "2026-09-29")).toBe(2);
    expect(streak(["2026-09-26", "2026-09-28"], "2026-09-29")).toBe(1);
    expect(streak(["2026-09-20"], "2026-09-29")).toBe(0);
  });
});
