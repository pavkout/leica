import { describe, expect, it } from "vitest";
import { FORBIDDEN_ADVICE } from "../physics/rangefinderCalibration";
import {
  ANATOMY_PROVENANCE,
  BODY_ENVELOPE,
  CURTAIN_TRAVEL_S,
  PARTS,
  PHASE_TEXT,
  WIND_SHARE,
  boxAt,
  collisions,
  drawOrder,
  exposureAt,
  intersects,
  keyMoments,
  shutterAt,
} from "./anatomy";

describe("parts", () => {
  it("has the plan's labelled subsystems", () => {
    expect(PARTS.map((p) => p.label)).toEqual(["Top plate", "Rangefinder", "Viewfinder", "Shutter", "Film gate", "Pressure plate", "Winding system"]);
  });

  it("fit inside the body envelope when assembled", () => {
    for (const p of PARTS)
      for (let i = 0; i < 3; i++) {
        expect(p.box.min[i]).toBeGreaterThanOrEqual(BODY_ENVELOPE.min[i]);
        expect(p.box.max[i]).toBeLessThanOrEqual(BODY_ENVELOPE.max[i]);
      }
  });

  it("never intersect at any point of explode or reassemble (acceptance)", () => {
    for (let k = 0; k <= 1000; k++) expect(collisions(k / 1000)).toEqual([]);
  });

  it("the intersection test catches a real overlap", () => {
    expect(intersects({ min: [0, 0, 0], max: [2, 2, 2] }, { min: [1, 1, 1], max: [3, 3, 3] })).toBe(true);
    expect(intersects({ min: [0, 0, 0], max: [2, 2, 2] }, { min: [2, 0, 0], max: [3, 2, 2] })).toBe(false);
  });

  it("explode moves every part except the reference film gate", () => {
    for (const p of PARTS) {
      const moved = boxAt(p, 1).min.some((v, i) => v !== p.box.min[i]);
      expect(moved).toBe(p.id !== "filmGate");
    }
  });

  it("draws back to front: pressure plate, gate, shutter along the axis", () => {
    const order = drawOrder(PARTS.map((p) => ({ id: p.id, box: boxAt(p, 1) })));
    expect(order.indexOf("pressurePlate")).toBeLessThan(order.indexOf("filmGate"));
    expect(order.indexOf("filmGate")).toBeLessThan(order.indexOf("shutter"));
    expect(order).toHaveLength(PARTS.length);
  });

  it("is labelled illustrative and never gives repair or adjustment instructions (acceptance)", () => {
    expect(ANATOMY_PROVENANCE.kind).toBe("illustrative");
    const text = [ANATOMY_PROVENANCE.notes, ...PARTS.flatMap((p) => [p.what, p.history ?? ""]), ...Object.values(PHASE_TEXT)].join(" ");
    expect(FORBIDDEN_ADVICE.test(text)).toBe(false);
  });
});

describe("shutter sequence (decoupled from optics)", () => {
  it("starts ready and ends wound, with the film covered throughout the wind", () => {
    expect(shutterAt(0, 1 / 125).phase).toBe("ready");
    for (const p of [0.85, 0.9, 1]) {
      const s = shutterAt(p, 1 / 125);
      expect(s.phase).toBe("winding");
      expect(s.openWidth).toBe(0);
    }
    expect(shutterAt(1, 1 / 125).wind).toBeCloseTo(1, 12);
  });

  it("slow speeds open fully; fast speeds cross as a slit", () => {
    const slow = 1 / 15;
    const midOpen = keyMoments(slow).find((m) => m.label === "Fully open")!.p;
    expect(shutterAt(midOpen, slow)).toMatchObject({ phase: "open", openWidth: 1 });
    const fast = 1 / 1000;
    const slit = keyMoments(fast).find((m) => m.label === "Slit crossing")!.p;
    const s = shutterAt(slit, fast);
    expect(s.phase).toBe("slit");
    expect(s.openWidth).toBeCloseTo(fast / CURTAIN_TRAVEL_S, 6);
  });

  it("every point of the frame gets exactly the shutter time", () => {
    for (const t of [1 / 1000, 1 / 60, 1]) for (const x of [0, 0.3, 1]) expect(exposureAt(x, t)).toBeCloseTo(t, 12);
  });

  it("is closed after the second curtain finishes, before winding", () => {
    expect(shutterAt(1 - WIND_SHARE, 1 / 60)).toMatchObject({ phase: "closed", openWidth: 0 });
  });

  it("key moments are in order and scrubbable positions", () => {
    for (const t of [1 / 1000, 1 / 250, 1 / 30, 1]) {
      const m = keyMoments(t);
      expect(m[0].p).toBe(0);
      expect(m[m.length - 1].p).toBe(1);
      m.forEach((x, i) => i && expect(x.p).toBeGreaterThan(m[i - 1].p));
    }
  });
});
