import { describe, expect, it } from "vitest";
import { BODIES, LENSES, findBody } from "../data/gear";
import { compatibility } from "./compatibility";

const lens = (id: string) => LENSES.find((l) => l.id === id)!;

describe("compatibility", () => {
  it("mounts an M lens on an M body and names its frame lines", () => {
    const c = compatibility(findBody("m6"), lens("m-50-2-rigid"));
    expect(c.verdict).toBe("fits");
    expect(c.notes.some((n) => n.title.startsWith("Frame lines"))).toBe(true);
  });

  it("warns about collapsing the collapsible Elmar, on digital Ms only, with a source", () => {
    const digital = compatibility(findBody("m11"), lens("m-50-2.8"));
    const note = digital.notes.find((n) => n.title.includes("collapse"))!;
    expect(note.source?.url).toMatch(/^https:/);
    expect(compatibility(findBody("m6"), lens("m-50-2.8")).notes.some((n) => n.title.includes("collapse"))).toBe(false);
  });

  it("says the rangefinder couples to 0.7 m for close-focusing lenses", () => {
    const close = LENSES.find((l) => l.mount === "M" && l.minFocusMm < 700)!;
    expect(compatibility(findBody("m11"), close).notes.some((n) => n.title.includes("0.7 m"))).toBe(true);
  });

  it("refuses lenses that can't mount at all, and every body/lens pair gets a verdict", () => {
    const q = BODIES.find((b) => b.mounts.includes("fixed"))!;
    expect(compatibility(q, lens("m-50-2-rigid")).verdict).toBe("no");
    for (const b of BODIES) for (const l of LENSES) expect(["fits", "adapter", "limited", "no"]).toContain(compatibility(b, l).verdict);
  });

  it("uses an adapter where the body allows it", () => {
    const adaptable = BODIES.find((b) => b.adaptedMounts?.includes("M"))!;
    expect(compatibility(adaptable, lens("m-50-2-rigid")).verdict).toBe("adapter");
  });
});
