import { describe, expect, it } from "vitest";
import { lookupSerialFacts, rarityNote, serialConflicts } from "./serialFacts";

function found(kind: "body" | "lens", text: string) {
  const r = lookupSerialFacts(kind, text);
  if (r.status !== "found") throw new Error(`expected found, got ${r.status}`);
  return r.facts;
}

describe("serial facts", () => {
  it("reads a body batch from the Leitz list", () => {
    const f = found("body", "700001");
    expect(f).toMatchObject({ kind: "body", model: "M3", year: "1954", batchFrom: 700001, batchTo: 710000, batchSize: 10000, bodyId: "m3" });
    expect(f.source).toMatch(/Leitz/);
  });

  it("reads a serial as people type it, with the model's notes", () => {
    const f = found("body", "No. 919 251");
    expect(f.model).toBe("M3");
    expect(f.notes.join(" ")).toMatch(/Single-stroke/);
  });

  it("knows the M5 block", () => {
    expect(found("body", "1300000").model).toBe("M5");
  });

  it("says unknown outside the lists and invalid for non-serials", () => {
    expect(lookupSerialFacts("body", "600000").status).toBe("unknown");
    expect(lookupSerialFacts("body", "abc").status).toBe("invalid");
    expect(lookupSerialFacts("lens", "").status).toBe("invalid");
  });

  it("gives a lens its year, with no batch", () => {
    const f = found("lens", "3000000");
    expect(f.year).toMatch(/^\d{4}$/);
    expect(f.batchSize).toBeUndefined();
    expect(f.model).toBeUndefined();
  });

  it("keeps both years where the published lens ranges overlap", () => {
    expect(found("lens", "3610500").year).toBe("1992/1993");
  });

  it("says unknown for lens gaps and numbers past the table", () => {
    expect(lookupSerialFacts("lens", "3584000").status).toBe("unknown");
    expect(lookupSerialFacts("lens", "9000000").status).toBe("unknown");
  });

  it("finds conflicts between the list and a claim", () => {
    const f = found("body", "700001");
    expect(serialConflicts(f, { model: "M2" })).toHaveLength(1);
    expect(serialConflicts(f, { model: "Leica M3" })).toHaveLength(0);
    expect(serialConflicts(f, { year: 1970 })).toHaveLength(1);
    expect(serialConflicts(f, { year: "1954" })).toHaveLength(0);
    expect(serialConflicts(found("body", "940000"), { year: 1958 })).toHaveLength(0);
  });

  it("states rarity as a fact: batch size and variant", () => {
    const note = rarityNote(found("body", "959450"));
    expect(note).toMatch(/100/);
    expect(note).toMatch(/black paint/);
    expect(rarityNote(found("lens", "3000000"))).toBeNull();
  });
});
