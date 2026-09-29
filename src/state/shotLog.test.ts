import { describe, expect, it } from "vitest";
import { addEntry, attachScans, logToCsv, nextFrame, rollsOf, type LogEntry, type NewEntry } from "./shotLog";

const frame = (roll: string, extra: Partial<NewEntry> = {}): NewEntry => ({
  roll,
  body: "M6",
  lens: "Summicron-M 35 f/2 ASPH.",
  fNumber: 8,
  shutterSec: 1 / 250,
  film: "HP5 Plus",
  ...extra,
});

function build(...entries: NewEntry[]): LogEntry[] {
  return entries.reduce<LogEntry[]>((log, e) => addEntry(log, e, new Date(2026, 8, 29)), []);
}

describe("shot log", () => {
  it("numbers frames per roll", () => {
    const log = build(frame("Roll 1"), frame("Roll 1"), frame("Roll 2"));
    expect(log.map((e) => e.frame)).toEqual([1, 2, 1]);
    expect(nextFrame(log, "Roll 1")).toBe(3);
    expect(rollsOf(log)).toEqual(["Roll 1", "Roll 2"]);
  });

  it("attaches scans in frame order, skipping frames that already have one", () => {
    let log = build(frame("Roll 1"), frame("Roll 1"), frame("Roll 1"));
    log = log.map((e) => (e.frame === 1 ? { ...e, scan: "old" } : e));
    const r = attachScans(log, "Roll 1", ["a", "b", "c"]);
    expect(r.log.map((e) => e.scan)).toEqual(["old", "a", "b"]);
    expect(r.unmatched).toBe(1);
  });

  it("only touches the chosen roll", () => {
    const log = build(frame("Roll 1"), frame("Roll 2"));
    const r = attachScans(log, "Roll 2", ["x"]);
    expect(r.log.find((e) => e.roll === "Roll 1")!.scan).toBeUndefined();
    expect(r.log.find((e) => e.roll === "Roll 2")!.scan).toBe("x");
  });

  it("exports CSV, quoting commas and writing infinity plainly", () => {
    const log = build(frame("Roll 1", { note: "Dam square, rain", focusMm: Infinity }));
    const csv = logToCsv(log);
    expect(csv.split("\r\n")[0]).toMatch(/^roll,frame,/);
    expect(csv).toContain('"Dam square, rain"');
    expect(csv).toContain(",inf,");
  });
});
