import { describe, expect, it } from "vitest";
import { backupName, buildBackup, daysSinceBackup, parseBackup, shouldRemind, summarize } from "./backup";

const local = {
  "rangefinder-collection": JSON.stringify([{ id: "a" }, { id: "b" }]),
  "rangefinder-shot-log": JSON.stringify([{ id: "1" }]),
  "rangefinder-film-stock": JSON.stringify({ stock: [{}], rolls: [{}, {}] }),
  "rangefinder-ai-key": "sk-ant-secret",
  "rangefinder-dev-run": "{}",
  "someone-else": "x",
};

describe("backup", () => {
  it("keeps the app's data, never the AI key or other sites' data", () => {
    const b = buildBackup(local, { passports: [{ itemId: "a" }], labWork: [], filmFrames: [{ id: 1 }] }, new Date(2026, 8, 30));
    expect(Object.keys(b.local).sort()).toEqual(["rangefinder-collection", "rangefinder-film-stock", "rangefinder-shot-log"]);
    expect(JSON.stringify(b)).not.toContain("sk-ant");
    expect(summarize(b)).toEqual({ items: 2, passports: 1, shotLog: 1, filmRolls: 2, lab: 0, frames: 1, walks: 0 });
  });
  it("round-trips through the file and rejects others", () => {
    const b = buildBackup(local, { passports: [] });
    const p = parseBackup(JSON.stringify(b));
    expect(p.ok).toBe(true);
    expect(parseBackup("nope")).toEqual({ ok: false, reason: "notBackup" });
    expect(parseBackup(JSON.stringify({ ...b, version: 2 }))).toEqual({ ok: false, reason: "newer" });
    expect(parseBackup(JSON.stringify({ ...b, local: { "rangefinder-ai-key": "x" } }))).toEqual({ ok: false, reason: "damaged" });
    expect(parseBackup(JSON.stringify({ ...b, local: { "evil-key": "x" } }))).toEqual({ ok: false, reason: "damaged" });
    expect(parseBackup(JSON.stringify({ ...b, idb: { passports: "x" } }))).toEqual({ ok: false, reason: "damaged" });
  });
  it("reminds monthly, only when there's something to keep", () => {
    const now = new Date(2026, 8, 30);
    expect(shouldRemind(local, null, now)).toBe(true);
    expect(shouldRemind(local, new Date(2026, 8, 20).toISOString(), now)).toBe(false);
    expect(shouldRemind(local, new Date(2026, 7, 1).toISOString(), now)).toBe(true);
    expect(shouldRemind({}, null, now)).toBe(false);
    expect(daysSinceBackup("garbage", now)).toBeNull();
    expect(backupName(new Date(Date.UTC(2026, 8, 30, 12)))).toBe("leica-rt-backup-2026-09-30.json");
  });
});
