import { describe, expect, it } from "vitest";
import { BODY_SERIALS, MODEL_NOTES, bodyBlock, bodyNotes } from "./bodySerials";

describe("body serials", () => {
  it("rows are ordered, well-formed and never overlap", () => {
    for (let i = 0; i < BODY_SERIALS.length; i++) {
      const b = BODY_SERIALS[i];
      expect(b.to).toBeGreaterThanOrEqual(b.from);
      if (i > 0) expect(b.from).toBeGreaterThan(BODY_SERIALS[i - 1].to);
    }
  });

  it("every model has a one-line description", () => {
    for (const b of BODY_SERIALS) expect(MODEL_NOTES[b.model]).toBeTruthy();
  });

  it("agrees with the independent facts", () => {
    expect(bodyBlock(700001)?.model).toBe("M3");
    expect(bodyBlock(926001)?.model).toBe("M2");
    expect(bodyNotes(919250, bodyBlock(919250)!)[0]).toMatch(/Double-stroke/);
    expect(bodyNotes(919251, bodyBlock(919251)!)[0]).toMatch(/Single-stroke/);
    expect(bodyBlock(1300000)?.model).toBe("M5");
  });

  it("identifies the example: 756 098 is a 1955 M3", () => {
    const b = bodyBlock(756098)!;
    expect(b.model).toBe("M3");
    expect(b.year).toBe("1955");
    expect(b.bodyId).toBe("m3");
  });

  it("knows the variants and the gaps", () => {
    expect(bodyBlock(759800)?.variant).toMatch(/Canada/);
    expect(bodyBlock(1102600)?.model).toBe("MD");
    // Cut off in the copy, and past the list: unknown, never guessed.
    expect(bodyBlock(960300)).toBeNull();
    expect(bodyBlock(1200000)).toBeNull();
  });
});
