import { describe, expect, it } from "vitest";
import { EMPTY, addStock, countFrame, developed, expiry, finishRoll, inCamera, loadRoll, loadedCameras, markDeveloped, pushStops, setCount, sortedStock, toDevelop, totalRolls } from "./filmStock";

const today = new Date(2026, 8, 30); // September 2026
const hp5 = { film: "HP5 Plus", filmId: "hp5", format: "135" as const, exposures: 36, iso: 400, count: 5, expires: "2027-06" };

describe("the fridge", () => {
  it("adds to the pile for the same film and expiry", () => {
    let s = addStock(EMPTY, hp5);
    s = addStock(s, { ...hp5, count: 3 });
    s = addStock(s, { ...hp5, count: 2, expires: "2026-11" });
    expect(s.stock).toHaveLength(2);
    expect(totalRolls(s)).toBe(10);
  });
  it("knows what's expired and what's expiring", () => {
    expect(expiry({ expires: "2026-08" }, today)).toBe("expired");
    expect(expiry({ expires: "2026-09" }, today)).toBe("soon");
    expect(expiry({ expires: "2026-12" }, today)).toBe("soon");
    expect(expiry({ expires: "2027-06" }, today)).toBe("ok");
    expect(expiry({}, today)).toBe("unknown");
    expect(expiry({ expires: "june" }, today)).toBe("unknown");
  });
  it("sorts expired first", () => {
    let s = addStock(EMPTY, hp5);
    s = addStock(s, { ...hp5, film: "Tri-X 400", expires: "2025-01" });
    expect(sortedStock(s, today)[0].film).toBe("Tri-X 400");
  });
  it("drops a line at zero", () => {
    const s = addStock(EMPTY, hp5);
    expect(setCount(s, s.stock[0].id, 0).stock).toEqual([]);
  });
});

describe("a roll's life", () => {
  it("loads from the fridge, counts frames, finishes and gets developed", () => {
    let s = addStock(EMPTY, hp5);
    s = loadRoll(s, s.stock[0], "M6", 800, today);
    expect(s.stock[0].count).toBe(4);
    expect(inCamera(s)).toHaveLength(1);
    expect(loadedCameras(s).has("m6")).toBe(true);
    const id = s.rolls[0].id;
    for (let i = 0; i < 40; i++) s = countFrame(s, id);
    expect(s.rolls[0].frames).toBe(38); // 36 plus the two a careful loader can squeeze out.
    expect(pushStops(s.rolls[0])).toBe(1);
    s = finishRoll(s, id, today);
    expect(toDevelop(s)).toHaveLength(1);
    s = markDeveloped(s, id, today);
    expect(developed(s)).toHaveLength(1);
    expect(inCamera(s)).toHaveLength(0);
  });
  it("loads a roll bought outside the fridge without touching the stock", () => {
    const s = loadRoll(EMPTY, { film: "Portra 400", format: "120", exposures: 12, iso: 400 }, "Hasselblad", 400, today);
    expect(s.stock).toEqual([]);
    expect(s.rolls[0].exposures).toBe(12);
  });
});
