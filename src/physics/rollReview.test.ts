import { describe, expect, it } from "vitest";
import { patterns, rollStats } from "./rollReview";
import type { LogEntry } from "../state/shotLog";

let n = 0;
const frame = (x: Partial<LogEntry>): LogEntry => ({ id: String(n++), roll: "Roll 1", frame: n, takenAt: "", body: "M6", lens: "Summicron 35", fNumber: 8, shutterSec: 1 / 125, film: "HP5", ...x });

describe("roll review", () => {
  it("counts keepers and problems", () => {
    const s = rollStats([frame({ pick: true }), frame({ issue: "blur" }), frame({})]);
    expect(s).toMatchObject({ frames: 3, reviewed: 2, picks: 1 });
    expect(s.issues.blur).toBe(1);
  });
  it("finds blur at slow speeds and points to the handheld exercise", () => {
    const slow = [1, 2, 3, 4, 5].map((i) => frame({ shutterSec: 1 / 15, issue: i <= 3 ? "blur" : undefined, pick: i > 3 }));
    const fast = [1, 2, 3, 4, 5, 6].map(() => frame({ shutterSec: 1 / 500, pick: true }));
    const p = patterns([...slow, ...fast]);
    expect(p[0]).toMatchObject({ group: "rr.g.slow", issue: "blur", count: 3, of: 5, lab: "limit" });
    // The overall blur rate isn't repeated when the slow-speed group explains it.
    expect(p.some((x) => x.group === "rr.g.all" && x.issue === "blur")).toBe(false);
  });
  it("stays quiet with too few frames or no pattern", () => {
    expect(patterns([frame({ issue: "focus" }), frame({ issue: "focus" })])).toEqual([]);
    expect(patterns([1, 2, 3, 4, 5, 6].map(() => frame({ pick: true })))).toEqual([]);
  });
});
