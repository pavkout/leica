import { describe, expect, it } from "vitest";
import { fieldAtDistance } from "./lensTrial";
import {
  PATTERNS,
  PATTERN_FILL,
  REFERENCE_LIGHT,
  cyclesRecorded,
  pathLength,
  patternPoint,
  phaseAt,
  suggestSettings,
  suggestedDistanceMm,
  trailStops,
} from "./longExposure";

const STOPS = [2, 2.8, 4, 5.6, 8, 11, 16];

describe("patterns", () => {
  it("stay inside the unit box and close on themselves each cycle", () => {
    for (const { id } of PATTERNS) {
      for (let i = 0; i <= 200; i++) {
        const q = patternPoint(id, i / 200);
        expect(Math.abs(q.x)).toBeLessThanOrEqual(1 + 1e-9);
        expect(Math.abs(q.y)).toBeLessThanOrEqual(1 + 1e-9);
      }
      if (id === "spiral") continue; // grows outwards; the loop restarts at the centre
      const a = patternPoint(id, 0);
      const b = patternPoint(id, 1);
      expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeLessThan(1e-9);
    }
  });

  it("measures path length (unit circle ≈ 2π; a sweep out and back = 4)", () => {
    expect(pathLength("circle")).toBeCloseTo(2 * Math.PI, 3);
    expect(pathLength("hsweep")).toBeCloseTo(4, 6);
  });
});

describe("timing (acceptance: a cycle lasts its duration within one frame)", () => {
  // Simulate frames: find the first frame at which the cycle counter wraps.
  function wrapTimes(cycleMs: number, frameMs: number, drops: Set<number>, runMs: number) {
    const wraps: number[] = [];
    let last = 0;
    for (let i = 0, t = 0; t <= runMs; i++, t = i * frameMs) {
      if (drops.has(i)) continue;
      const { cycle } = phaseAt(t, cycleMs, true);
      if (cycle > last) wraps.push(t);
      last = cycle;
    }
    return wraps;
  }

  for (const [label, frameMs] of [["60 Hz", 1000 / 60], ["120 Hz", 1000 / 120]] as const) {
    it(`${label}, with dropped frames`, () => {
      const drops = new Set([10, 11, 12, 240, 241, 480]);
      const wraps = wrapTimes(4000, frameMs, drops, 12500);
      expect(wraps).toHaveLength(3);
      wraps.forEach((t, k) => {
        expect(t - 4000 * (k + 1)).toBeGreaterThanOrEqual(0);
        // A dropped frame can delay the visible wrap, but position is never late: it is computed from time.
        expect(t - 4000 * (k + 1)).toBeLessThanOrEqual(frameMs * 4);
      });
    });
  }

  it("position depends on time only, not on how many frames were drawn", () => {
    expect(phaseAt(1000, 4000, true).phase).toBe(0.25);
    expect(phaseAt(9000, 4000, true)).toEqual({ phase: 0.25, cycle: 2, done: false });
  });

  it("a one-shot run is done after one cycle and stays done", () => {
    expect(phaseAt(3999, 4000, false).done).toBe(false);
    expect(phaseAt(4000, 4000, false).done).toBe(true);
    expect(phaseAt(60000, 4000, false).done).toBe(true);
  });
});

describe("what the shutter records", () => {
  it("1 s → partial, cycle → one, 2× → repeated (loop), per the plan's example", () => {
    expect(cyclesRecorded(1, 4, true).expect).toBe("partial");
    expect(cyclesRecorded(4, 4, true).expect).toBe("one");
    expect(cyclesRecorded(8, 4, true)).toEqual({ cycles: 2, expect: "repeated" });
  });

  it("a one-shot run records at most one pattern however long the shutter", () => {
    expect(cyclesRecorded(30, 4, false)).toEqual({ cycles: 1, expect: "one" });
  });
});

describe("trail brightness (dwell time, not shutter time)", () => {
  it("the reference run is 0 stops", () => {
    expect(trailStops(REFERENCE_LIGHT)).toBeCloseTo(0, 9);
  });

  it("a faster cycle or a smaller or dimmer point darkens the trail", () => {
    expect(trailStops({ ...REFERENCE_LIGHT, cycleSec: 2 })).toBeCloseTo(-1, 6);
    expect(trailStops({ ...REFERENCE_LIGHT, sizePx: 6 })).toBeCloseTo(-1, 6);
    expect(trailStops({ ...REFERENCE_LIGHT, brightness: 0.5 })).toBeCloseTo(-1, 6);
  });
});

describe("suggested settings", () => {
  it("reproduces the plan's example: infinity, 4 s → ISO 100, f/8, 4 s", () => {
    expect(suggestSettings(REFERENCE_LIGHT, 100, STOPS, 8)).toMatchObject({ iso: 100, fNumber: 8, shutterSec: 4, useBulb: false, provenance: "approximate" });
  });

  it("stops down two stops at ISO 400, and opens up for a dimmer light", () => {
    expect(suggestSettings(REFERENCE_LIGHT, 400, STOPS, 8).fNumber).toBe(16);
    expect(suggestSettings({ ...REFERENCE_LIGHT, brightness: 0.25 }, 100, STOPS, 8).fNumber).toBe(4);
  });

  it("reports what the lens can't reach, and asks for B beyond the slowest speed", () => {
    const s = suggestSettings(REFERENCE_LIGHT, 3200, STOPS, 1);
    expect(s.fNumber).toBe(16);
    expect(s.residualStops).toBeCloseTo(3, 6);
    expect(s.useBulb).toBe(true);
  });
});

describe("screen distance", () => {
  it("fills about two-thirds of the frame's short side with the pattern", () => {
    const d = suggestedDistanceMm(50, 24, 380, 700);
    const field = fieldAtDistance(50, d, 36, 24).h;
    expect((380 * PATTERN_FILL) / field).toBeCloseTo(2 / 3, 6);
  });

  it("never closer than the lens focuses", () => {
    expect(suggestedDistanceMm(28, 24, 65, 700)).toBe(700);
  });
});

describe("light colour", () => {
  it("dims in linear light: half brightness of white is sRGB 188, not 128", async () => {
    const { dimmedCss } = await import("./longExposure");
    expect(dimmedCss([255, 255, 255], 1)).toBe("rgb(255, 255, 255)");
    expect(dimmedCss([255, 255, 255], 0.5)).toBe("rgb(188, 188, 188)");
    expect(dimmedCss([255, 255, 255], 0)).toBe("rgb(0, 0, 0)");
  });
});

describe("drawn and text patterns (#36 later enhancements)", () => {
  it("strokes play at constant speed and jump between strokes", async () => {
    const { strokeSample, pathLength } = await import("./longExposure");
    const strokes = [[{ x: -1, y: 0 }, { x: 0, y: 0 }], [{ x: 0, y: 1 }, { x: 0, y: 0 }]];
    expect(strokeSample(strokes, 0)).toEqual({ x: -1, y: 0, stroke: 0 });
    expect(strokeSample(strokes, 0.25)).toEqual({ x: -0.5, y: 0, stroke: 0 });
    expect(strokeSample(strokes, 0.75)).toEqual({ x: 0, y: 0.5, stroke: 1 });
    expect(strokeSample(strokes, 1)).toEqual({ x: 0, y: 0, stroke: 1 });
    expect(pathLength("drawn", { turns: 3, a: 3, b: 2, strokes })).toBeCloseTo(2, 9);
  });

  it("tidies a hand drawing: drops dots, jitter and out-of-box points", async () => {
    const { tidyStrokes } = await import("./longExposure");
    const t = tidyStrokes([[{ x: 0, y: 0 }], [{ x: 0, y: 0 }, { x: 0.001, y: 0 }, { x: 2, y: 0 }]]);
    expect(t).toEqual([[{ x: 0, y: 0 }, { x: 1, y: 0 }]]);
  });

  it("an empty drawing doesn't break the exposure suggestion", async () => {
    const { suggestSettings } = await import("./longExposure");
    const s = suggestSettings({ ...REFERENCE_LIGHT, pattern: "drawn", params: { turns: 3, a: 3, b: 2, strokes: [] } }, 100, STOPS, 8);
    expect(Number.isFinite(s.fNumber)).toBe(true);
  });
});

describe("multi-light and the predicted exposure", () => {
  it("a light's head start shifts its phase", async () => {
    const { lightPhase } = await import("./longExposure");
    expect(lightPhase(0.25, 0.5)).toBe(0.75);
    expect(lightPhase(0.75, 0.5)).toBe(0.25);
  });

  it("the trace covers part of the path for a short exposure and repeats for a long one", async () => {
    const { exposureTrace } = await import("./longExposure");
    const light = { pattern: "circle" as const, params: { turns: 3, a: 3, b: 2 }, offset: 0 };
    const len = (tr: { x: number; y: number }[][]) => tr.reduce((s, pl) => s + pl.slice(1).reduce((a, q, i) => a + Math.hypot(q.x - pl[i].x, q.y - pl[i].y), 0), 0);
    expect(len(exposureTrace(light, 4, true, 1))).toBeCloseTo((2 * Math.PI) / 4, 1);
    expect(len(exposureTrace(light, 4, true, 8))).toBeCloseTo(4 * Math.PI, 1);
    // Once: a longer shutter records no more than one pattern.
    expect(len(exposureTrace(light, 4, false, 8))).toBeCloseTo(2 * Math.PI, 1);
  });

  it("the trace splits where the light jumps between letters", async () => {
    const { exposureTrace } = await import("./longExposure");
    const { textStrokes } = await import("./strokeFont");
    const strokes = textStrokes("HI");
    const tr = exposureTrace({ pattern: "text", params: { turns: 3, a: 3, b: 2, strokes }, offset: 0 }, 5, false, 5);
    expect(tr.length).toBe(strokes.length);
  });
});

describe("single-stroke font", () => {
  it("lays text out centred inside the box, skipping unknown characters", async () => {
    const { textStrokes, unsupportedChars } = await import("./strokeFont");
    const s = textStrokes("f/8");
    const pts = s.flat();
    expect(Math.min(...pts.map((p) => p.x))).toBeCloseTo(-Math.max(...pts.map((p) => p.x)), 9);
    for (const p of pts) {
      expect(Math.abs(p.x)).toBeLessThanOrEqual(0.9 + 1e-9);
      expect(Math.abs(p.y)).toBeLessThanOrEqual(0.55 + 1e-9);
    }
    expect(unsupportedChars("héllo ✓")).toEqual(["É", "✓"]);
    expect(textStrokes("✓✓")).toEqual([]);
  });

  it("has every letter and digit", async () => {
    const { GLYPHS } = await import("./strokeFont");
    for (const c of "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789") expect(GLYPHS[c].length).toBeGreaterThan(0);
  });
});
