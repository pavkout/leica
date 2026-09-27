import { describe, expect, it } from "vitest";
import { BODIES, findBody, findLens } from "./gear";
import { NO_FILTER, TIMELINE_CONTENT, bodyForLens, canSimulate, decades, filterItems, timelineItems, timelineProblems, type TimelineContent } from "./timeline";

const items = timelineItems();

describe("content dataset", () => {
  it("is valid: versioned, and every note fully cited (acceptance)", () => {
    expect(timelineProblems()).toEqual([]);
    expect(TIMELINE_CONTENT.version).toBeGreaterThanOrEqual(1);
    for (const n of TIMELINE_CONTENT.notes) expect(n.provenance.url).toMatch(/^https:\/\//);
  });

  it("catches missing citations, unknown ids, years in linked notes and incomplete milestones", () => {
    const bad: TimelineContent = {
      version: 1,
      updated: "2026-09-27",
      about: "",
      notes: [
        { id: "a", bodyId: "m3", text: "Launched in 1954.", provenance: { kind: "reference", source: "x", url: "https://x", checked: "2026-09-27" } },
        { id: "b", bodyId: "nope", text: "t", provenance: { kind: "reference", source: "", url: "http://x", checked: "" } },
        { id: "c", text: "t", provenance: { kind: "reference", source: "x", url: "https://x", checked: "2026-09-27" } },
      ],
    };
    const p = timelineProblems(bad);
    expect(p).toContain("a: catalogue-linked notes must not state years");
    expect(p).toContain("b: incomplete provenance");
    expect(p).toContain("b: unknown body nope");
    expect(p).toContain("c: a standalone milestone needs a year and title");
  });
});

describe("items", () => {
  it("has every catalogue body at its catalogue year, in order", () => {
    for (const b of BODIES) expect(items.find((i) => i.id === `body:${b.id}`)?.year).toBe(b.year);
    for (let i = 1; i < items.length; i++) expect(items[i].year).toBeGreaterThanOrEqual(items[i - 1].year);
  });

  it("includes milestones outside the catalogue, which can't be simulated (acceptance)", () => {
    const m8 = items.find((i) => i.title === "M8")!;
    expect(m8.kind).toBe("milestone");
    expect(canSimulate(m8)).toBe(false);
    expect(canSimulate(items.find((i) => i.id === "body:m3")!)).toBe(true);
    expect(canSimulate(items.find((i) => i.id === "lens:m-50-2-rigid")!)).toBe(true);
  });

  it("attaches notes to catalogue items", () => {
    expect(items.find((i) => i.id === "body:m6")!.notes.map((n) => n.id)).toEqual(["m6-meter"]);
    expect(items.find((i) => i.id === "lens:m-50-0.95")!.notes).toHaveLength(1);
  });
});

describe("filters", () => {
  it("hides lens milestones unless asked", () => {
    expect(filterItems(items, NO_FILTER).some((i) => i.kind === "lens")).toBe(false);
    expect(filterItems(items, { ...NO_FILTER, lenses: true }).some((i) => i.kind === "lens")).toBe(true);
  });

  it("by era, medium, finder and mount", () => {
    expect(filterItems(items, { ...NO_FILTER, decade: 1950 }).map((i) => i.title)).toEqual(["M3"]);
    expect(filterItems(items, { ...NO_FILTER, medium: "film" }).every((i) => i.medium === "film")).toBe(true);
    const dig = filterItems(items, { ...NO_FILTER, medium: "digital", finder: "rangefinder" }).map((i) => i.title);
    expect(dig).toContain("M8");
    expect(dig).toContain("M11");
    expect(dig).not.toContain("Q3");
    expect(filterItems(items, { ...NO_FILTER, finder: "reflex" }).map((i) => i.body?.id)).toEqual(["s3"]);
    expect(filterItems(items, { ...NO_FILTER, mount: "fixed" }).every((i) => i.body?.fixedLensId)).toBe(true);
    expect(decades(items)[0]).toBe(1950);
  });
});

describe("simulate this", () => {
  it("keeps the current body when it takes the lens, else picks one that does", () => {
    expect(bodyForLens(findLens("m-50-2"), findBody("m6"))!.id).toBe("m6");
    const b = bodyForLens(findLens("m-50-2"), findBody("q3"))!;
    expect(b.mounts).toContain("M");
  });
});
