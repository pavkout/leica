import { describe, expect, it } from "vitest";
import { DEVELOP_LEVELS, eiStops, grainMultiplier, nearestDevelopLevel, softnessForPush } from "./pushPull";

describe("eiStops", () => {
  it("matches the acceptance criterion: ISO 400 film rated at EI 1600 is +2 EI stops", () => {
    // Rating at 1600 on 400 film is +2 stops of EI (pushed), meaning the
    // capture itself is 2 stops under a normal box-speed exposure before
    // development compensates.
    expect(eiStops(400, 1600)).toBeCloseTo(2, 9);
  });

  it("is 0 when rated at box speed", () => {
    expect(eiStops(400, 400)).toBe(0);
  });

  it("is negative when rated slower than box speed (a pull)", () => {
    expect(eiStops(400, 200)).toBeCloseTo(-1, 9);
  });
});

describe("nearestDevelopLevel", () => {
  it("matches an exact level", () => {
    expect(nearestDevelopLevel(0).id).toBe("normal");
    expect(nearestDevelopLevel(2).id).toBe("push2");
    expect(nearestDevelopLevel(-1).id).toBe("pull1");
  });

  it("rounds to the closest level for an in-between value", () => {
    expect(nearestDevelopLevel(2.4).id).toBe("push2");
    expect(nearestDevelopLevel(2.6).id).toBe("push3");
  });

  it("clamps to the most extreme available level beyond the modeled range, without throwing", () => {
    expect(() => nearestDevelopLevel(-10)).not.toThrow();
    expect(nearestDevelopLevel(-10).id).toBe("pull1");
    expect(nearestDevelopLevel(10).id).toBe("push3");
  });

  it("only ever returns a level that's actually in DEVELOP_LEVELS", () => {
    for (const stops of [-3, -1.5, 0, 0.4, 1.9, 5]) {
      expect(DEVELOP_LEVELS).toContainEqual(nearestDevelopLevel(stops));
    }
  });
});

describe("softnessForPush", () => {
  it("leaves softness unchanged at normal (0 stops)", () => {
    expect(softnessForPush(2.3, 0)).toBeCloseTo(2.3, 9);
  });

  it("decreases (steepens, more contrast) for a push", () => {
    expect(softnessForPush(2.3, 2)).toBeLessThan(2.3);
  });

  it("increases (flattens, more latitude) for a pull", () => {
    expect(softnessForPush(2.3, -1)).toBeGreaterThan(2.3);
  });

  it("stays positive and bounded even at extreme stops", () => {
    expect(softnessForPush(2.3, 20)).toBeGreaterThan(0);
    expect(softnessForPush(2.3, -20)).toBeLessThan(2.3 * 3);
  });
});

describe("grainMultiplier", () => {
  it("is 1 (no change) at normal", () => {
    expect(grainMultiplier(0)).toBe(1);
  });

  it("increases with push stops", () => {
    expect(grainMultiplier(2)).toBeGreaterThan(grainMultiplier(1));
    expect(grainMultiplier(1)).toBeGreaterThan(grainMultiplier(0));
  });

  it("increases with pull stops too (symmetric in magnitude)", () => {
    expect(grainMultiplier(-2)).toBeCloseTo(grainMultiplier(2), 9);
  });
});
