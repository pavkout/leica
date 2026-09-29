import { describe, expect, it } from "vitest";
import { compatibility } from "../physics/compatibility";
import { FAMOUS_FRAMES } from "./famousFrames";
import { BODIES, LENSES } from "./gear";

describe("famous frames", () => {
  it("every frame is sourced, and its stand-in exists and fits", () => {
    for (const f of FAMOUS_FRAMES) {
      expect(f.sources.length).toBeGreaterThan(0);
      for (const s of f.sources) expect(s.url).toMatch(/^https:\/\//);
      const body = BODIES.find((b) => b.id === f.standIn.bodyId);
      const lens = LENSES.find((l) => l.id === f.standIn.lensId);
      expect(body && lens).toBeTruthy();
      expect(compatibility(body!, lens!).verdict).not.toBe("no");
    }
  });

  it("never records settings the sources don't give", () => {
    for (const f of FAMOUS_FRAMES) expect(Object.keys(f.gear).every((k) => ["camera", "lens", "film"].includes(k))).toBe(true);
  });
});
