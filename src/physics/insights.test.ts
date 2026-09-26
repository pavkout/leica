import { describe, expect, it } from "vitest";
import { computeInsights, MIN_SAMPLE } from "./insights";
import type { Frame, OutcomeTag } from "../state/rollExport";

let nextId = 1;

function frame(overrides: Partial<Frame["meta"]> & { outcome?: OutcomeTag } = {}): Frame {
  const { outcome, ...metaOverrides } = overrides;
  const id = nextId++;
  return {
    id,
    number: id,
    url: "data:image/jpeg;base64,AAA",
    caption: "c",
    fileName: `f${id}.jpg`,
    meta: {
      body: "M11",
      lens: "Summilux-M 50 f/1.4 ASPH.",
      focalMm: 50,
      fNumber: 1.4,
      shutterSec: 1 / 500,
      focusMm: 2000,
      iso: 400,
      filmOrSensor: "ISO 400",
      evOffset: 0,
      ...metaOverrides,
    },
    outcome,
  };
}

describe("computeInsights", () => {
  it("reports zero tag counts and no insights for untagged frames", () => {
    const report = computeInsights([frame(), frame(), frame()]);
    expect(report.insights).toEqual([]);
    expect(report.notEnoughData).toEqual([]);
    expect(report.tagCounts.good).toBe(0);
  });

  it("withholds a trend below MIN_SAMPLE and reports it as not-enough-data instead", () => {
    const frames = [frame({ outcome: "motion-blur" }), frame({ outcome: "motion-blur" })];
    expect(frames.length).toBeLessThan(MIN_SAMPLE);
    const report = computeInsights(frames);
    expect(report.insights.find((i) => i.id === "motion-blur")).toBeUndefined();
    expect(report.notEnoughData).toContainEqual({ tag: "motion-blur", label: "motion-blur", count: 2, needed: MIN_SAMPLE });
  });

  it("surfaces a shake trend clustered at one shutter speed and focal length, linking back to those frames", () => {
    const clustered = [
      frame({ outcome: "motion-blur", shutterSec: 1 / 30, focalMm: 50 }),
      frame({ outcome: "motion-blur", shutterSec: 1 / 30, focalMm: 50 }),
      frame({ outcome: "motion-blur", shutterSec: 1 / 30, focalMm: 50 }),
      frame({ outcome: "motion-blur", shutterSec: 1 / 250, focalMm: 35 }),
    ];
    const report = computeInsights(clustered);
    const insight = report.insights.find((i) => i.id === "motion-blur");
    expect(insight?.text).toContain("1/30s with a 50 mm lens");
    expect(insight?.frameNumbers).toEqual(clustered.slice(0, 3).map((f) => f.number));
  });

  it("reports the average EV offset for good-tagged frames", () => {
    const frames = [
      frame({ outcome: "good", evOffset: 0.5 }),
      frame({ outcome: "good", evOffset: 0.7 }),
      frame({ outcome: "good", evOffset: 0.9 }),
    ];
    const report = computeInsights(frames);
    const insight = report.insights.find((i) => i.id === "good-ev");
    expect(insight?.text).toContain("+0.7 EV");
  });

  it("clusters missed-focus tags by aperture", () => {
    const frames = [
      frame({ outcome: "missed-focus", fNumber: 1.4 }),
      frame({ outcome: "missed-focus", fNumber: 1.4 }),
      frame({ outcome: "missed-focus", fNumber: 1.4 }),
      frame({ outcome: "missed-focus", fNumber: 8 }),
    ];
    const report = computeInsights(frames);
    const insight = report.insights.find((i) => i.id === "missed-focus");
    expect(insight?.text).toContain("f/1.4");
    expect(insight?.frameNumbers).toHaveLength(3);
  });

  it("reports underexposed and overexposed trends independently", () => {
    const frames = [
      frame({ outcome: "underexposed", evOffset: -1.2 }),
      frame({ outcome: "underexposed", evOffset: -1.0 }),
      frame({ outcome: "underexposed", evOffset: -1.4 }),
      frame({ outcome: "overexposed", evOffset: 1.5 }),
      frame({ outcome: "overexposed", evOffset: 1.5 }),
      frame({ outcome: "overexposed", evOffset: 1.5 }),
    ];
    const report = computeInsights(frames);
    expect(report.insights.find((i) => i.id === "underexposed")?.text).toContain("-1.2 EV");
    expect(report.insights.find((i) => i.id === "overexposed")?.text).toContain("+1.5 EV");
  });

  it("never lets a frame with one tag contribute to another tag's bucket", () => {
    const frames = [frame({ outcome: "good" }), frame({ outcome: "motion-blur" }), frame({ outcome: "good" })];
    const report = computeInsights(frames);
    expect(report.tagCounts.good).toBe(2);
    expect(report.tagCounts["motion-blur"]).toBe(1);
  });
});
