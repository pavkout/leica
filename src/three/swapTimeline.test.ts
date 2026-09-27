import { describe, expect, it } from "vitest";
import { BAYONET_RAD, FLOAT_M, SWAP_DURATION_S, SWAP_PHASES, immersiveSetting, saveImmersiveSetting, swapPose } from "./swapTimeline";

describe("lens swap timeline", () => {
  it("starts with the old lens locked on and the new one not yet shown", () => {
    const p = swapPose(0);
    expect(p.outgoing).toEqual({ y: 0, rot: -0, visible: true });
    expect(p.incoming.visible).toBe(false);
  });

  it("unlocks, floats the old lens off, brings the new one in, and locks it", () => {
    expect(swapPose(SWAP_PHASES.unlock[1]).outgoing.rot).toBeCloseTo(-BAYONET_RAD);
    expect(swapPose(SWAP_PHASES.away[1] - 1e-6).outgoing.y).toBeCloseTo(FLOAT_M, 4);
    const arriving = swapPose(SWAP_PHASES.arrive[0] + 0.01);
    expect(arriving.incoming).toMatchObject({ visible: true, rot: -BAYONET_RAD });
    expect(arriving.incoming.y).toBeGreaterThan(FLOAT_M * 0.9);
    expect(swapPose(SWAP_PHASES.lock[0]).incoming.y).toBeCloseTo(0);
  });

  it("ends in the valid final state, and stays there", () => {
    for (const t of [SWAP_DURATION_S, SWAP_DURATION_S + 5]) {
      expect(swapPose(t)).toEqual({ outgoing: { y: FLOAT_M, rot: -BAYONET_RAD, visible: false }, incoming: { y: 0, rot: 0, visible: true }, done: true });
    }
  });

  it("is deterministic and moves continuously", () => {
    for (let t = 0; t < SWAP_DURATION_S; t += 0.01) {
      expect(swapPose(t)).toEqual(swapPose(t));
      const a = swapPose(t);
      const b = swapPose(t + 0.001);
      expect(Math.abs(a.incoming.y - b.incoming.y)).toBeLessThan(0.002);
      expect(Math.abs(a.outgoing.rot - b.outgoing.rot)).toBeLessThan(0.02);
    }
  });

  it("never shows neither lens", () => {
    for (let t = 0; t <= SWAP_DURATION_S + 0.01; t += 0.005) {
      const p = swapPose(t);
      expect(p.outgoing.visible || p.incoming.visible).toBe(true);
    }
  });
});

describe("immersive transitions setting", () => {
  it("is on unless the user turned it off, and round-trips", () => {
    const store = new Map<string, string>();
    expect(immersiveSetting((k) => store.get(k) ?? null)).toBe(true);
    saveImmersiveSetting((k, v) => store.set(k, v), false);
    expect(immersiveSetting((k) => store.get(k) ?? null)).toBe(false);
  });
});
