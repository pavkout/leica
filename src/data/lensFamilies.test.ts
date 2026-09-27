import { describe, expect, it } from "vitest";
import { LENSES } from "./gear";
import { LENS_FAMILIES, familyDataProblems, familyOf, findByAlias, lensOf, type LensFamily } from "./lensFamilies";

describe("lens family data", () => {
  it("is valid: known lenses, one focal length and mount per family, launch order, unique ids and aliases", () => {
    expect(familyDataProblems()).toEqual([]);
  });

  it("catches inconsistent spec units across revisions", () => {
    const bad: LensFamily = {
      lensFamilyId: "bad",
      name: "Bad",
      aliases: [],
      revisions: [
        { lensId: "m-35-2", revisionId: "a", label: "a", aliases: [] },
        { lensId: "m-50-2", revisionId: "b", label: "b", aliases: [] },
      ],
    };
    expect(familyDataProblems([bad])).toContain("bad: revisions have different focal lengths");
  });

  it("catches a lens listed in two families, unknown lenses and single-revision families", () => {
    const f1: LensFamily = { lensFamilyId: "x", name: "X", aliases: [], revisions: [{ lensId: "m-35-2", revisionId: "x1", label: "", aliases: [] }] };
    const f2: LensFamily = { lensFamilyId: "y", name: "Y", aliases: [], revisions: [{ lensId: "m-35-2", revisionId: "y1", label: "", aliases: [] }, { lensId: "nope", revisionId: "y2", label: "", aliases: [] }] };
    const p = familyDataProblems([f1, f2]);
    expect(p).toContain("x: a family needs at least two revisions");
    expect(p).toContain("m-35-2 is in both x and y");
    expect(p).toContain("y2: unknown lens nope");
  });

  it("draws every revision's specs from the catalogue (no data of its own)", () => {
    for (const f of LENS_FAMILIES) for (const r of f.revisions) expect(LENSES).toContain(lensOf(r));
    for (const f of LENS_FAMILIES) for (const r of f.revisions) expect(Object.keys(r).sort()).toEqual(["aliases", "label", "lensId", "revisionId"]);
  });
});

describe("family vs revision (acceptance)", () => {
  it("revisions of one family can differ in geometric specs despite the shared name", () => {
    const cron50 = LENS_FAMILIES.find((f) => f.lensFamilyId === "summicron-50")!;
    const mfds = new Set(cron50.revisions.map((r) => lensOf(r).minFocusMm));
    expect(mfds.size).toBeGreaterThan(1);
  });

  it("finds a lens's family, and families/revisions by colloquial name", () => {
    expect(familyOf("m-50-2-rigid")?.name).toBe("50 mm Summicron");
    expect(familyOf("m-21-1.4")).toBeUndefined();
    expect(findByAlias("king of bokeh")?.revision?.lensId).toBe("m-35-2-8e");
    expect(findByAlias("Nocti")?.family.lensFamilyId).toBe("noctilux-50");
    expect(findByAlias("Summilux-M 50 f/1.4 ASPH.")?.revision?.revisionId).toBe("summilux-50-asph");
  });
});
