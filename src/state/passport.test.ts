import { describe, expect, it } from "vitest";
import {
  GENESIS,
  addEvent,
  canonical,
  currentFingerprint,
  editable,
  fileName,
  newPassport,
  owners,
  parsePassport,
  receive,
  replaceEvent,
  resubject,
  serialFlags,
  serialize,
  serviceStatus,
  verify,
  type PassportEvent,
} from "./passport";
import { newItem } from "./collection";
import { lookupSerialFacts } from "./serialFacts";

const ev = (id: string, type: PassportEvent["type"], date: string, extra: Partial<PassportEvent> = {}): PassportEvent => ({
  id,
  type,
  date,
  title: `${type} ${date}`,
  recordedAt: `${date}T10:00:00.000Z`,
  ...extra,
});

async function sample() {
  const item = newItem("body", "Leica M3", { serial: "700123", catalogueId: "m3" }, 1);
  let p = newPassport(item);
  p = await addEvent(p, ev("a", "acquired", "2019-04-02", { by: "A dealer" }));
  p = await addEvent(p, ev("b", "service", "2021-06-10", { by: "A workshop" }));
  return p;
}

describe("canonical JSON", () => {
  it("orders keys and drops undefined", () => {
    expect(canonical({ b: 1, a: [2, { d: undefined, c: "x" }] })).toBe('{"a":[2,{"c":"x"}],"b":1}');
  });
});

describe("the seal chain", () => {
  it("verifies an untouched passport and gives a stable fingerprint", async () => {
    const p = await sample();
    const v = await verify(p);
    expect(v.ok).toBe(true);
    if (v.ok) expect(v.fingerprint).toMatch(/^[0-9A-F]{4}(-[0-9A-F]{4}){3}$/);
    expect(await currentFingerprint(p)).toBe(v.ok ? v.fingerprint : "");
    expect(await currentFingerprint(newPassport(newItem("lens", "x")))).toMatch(/^[0-9A-F]{4}-/);
    expect(GENESIS).toHaveLength(64);
  });
  it("finds an entry edited after sealing", async () => {
    const p = await sample();
    const tampered = structuredClone(p);
    tampered.entries[0].event.by = "Someone else";
    expect(await verify(tampered)).toEqual({ ok: false, brokenAt: 0 });
  });
  it("re-seals after an owner's own edit, and removes cleanly", async () => {
    const p = await sample();
    const edited = await replaceEvent(p, "b", { ...p.entries[1].event, cost: "€400" });
    expect((await verify(edited)).ok).toBe(true);
    expect(await currentFingerprint(edited)).not.toBe(await currentFingerprint(p));
    const removed = await replaceEvent(p, "a", null);
    expect(removed.entries.map((e) => e.event.id)).toEqual(["b"]);
    expect((await verify(removed)).ok).toBe(true);
  });
});

describe("the item is sealed too", () => {
  it("breaks when the serial is changed in the file", async () => {
    const p = await sample();
    const forged = { ...p, subject: { ...p.subject, serial: "700999" } };
    expect(await verify(forged)).toEqual({ ok: false, brokenAt: 0 });
  });
  it("re-seals the owner's own passport when the item changes, but not a received one", async () => {
    const p = await sample();
    const item = { ...newItem("body", "Leica M3", { serial: "700124", catalogueId: "m3" }), id: p.itemId };
    const moved = await resubject(p, item);
    expect(moved.subject.serial).toBe("700124");
    expect((await verify(moved)).ok).toBe(true);
    const locked = { ...p, lockedThrough: 1 };
    expect((await resubject(locked, item)).subject.serial).toBe("700123");
  });
});

describe("hand-over", () => {
  it("round-trips through the file and locks the received history", async () => {
    let p = await sample();
    p = await addEvent(p, ev("t", "transfer", "2026-09-01", { to: "Kim" }));
    const parsed = parsePassport(serialize(p));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const { item, passport } = receive(parsed.passport, "new-id");
    expect(item).toMatchObject({ id: "new-id", name: "Leica M3", serial: "700123", acquired: "2026-09-01" });
    expect(passport.lockedThrough).toBe(2);
    expect(editable(passport, 2)).toBe(false);
    expect(await replaceEvent(passport, "b", null)).toBe(passport);
    const added = await addEvent(passport, ev("n", "note", "2026-09-02"));
    expect(editable(added, 3)).toBe(true);
    expect((await verify(added)).ok).toBe(true);
  });
  it("rejects files that aren't passports", () => {
    expect(parsePassport("nope")).toEqual({ ok: false, reason: "notPassport" });
    expect(parsePassport('{"format":"x"}')).toEqual({ ok: false, reason: "notPassport" });
    expect(parsePassport('{"format":"leica.rt-passport","version":2}')).toEqual({ ok: false, reason: "newerVersion" });
    expect(parsePassport('{"format":"leica.rt-passport","version":1,"subject":{"name":"x"},"entries":[{"seal":"a"}]}')).toEqual({ ok: false, reason: "damaged" });
  });
  it("names the file after the item", async () => {
    expect(fileName(await sample())).toBe("leica-m3-700123.passport.json");
  });
});

describe("owners and service", () => {
  it("lists owners from purchases and hand-overs", async () => {
    let p = await sample();
    p = await addEvent(p, ev("t", "transfer", "2026-09-01", { to: "Kim" }));
    expect(owners(p)).toEqual([
      { name: "", from: "2019-04-02", to: "2026-09-01" },
      { name: "Kim", from: "2026-09-01" },
    ]);
  });
  it("counts the first owner even without a purchase entry", async () => {
    let p = newPassport(newItem("body", "M6"));
    p = await addEvent(p, ev("s", "service", "2020-01-01"));
    p = await addEvent(p, ev("t", "transfer", "2026-09-01", { to: "Kim" }));
    expect(owners(p).map((o) => o.name)).toEqual(["", "Kim"]);
  });
  it("reminds only when the owner asked", async () => {
    const p = await sample();
    const today = new Date(2026, 8, 30);
    expect(serviceStatus(p, today)).toMatchObject({ last: "2021-06-10", due: false });
    expect(serviceStatus({ ...p, remindYears: 5 }, today)).toMatchObject({ due: true, dueDate: "2026-06-10" });
    expect(serviceStatus({ ...p, remindYears: 10 }, today).due).toBe(false);
  });
});

describe("serial flags", () => {
  it("confirms a serial that matches its model, and flags one that doesn't", () => {
    const found = lookupSerialFacts("body", "700123");
    expect(found.status).toBe("found");
    if (found.status !== "found") return;
    const facts = found.facts;
    const ok = serialFlags({ kind: "body", name: "M3", serial: "700123", catalogueId: facts.bodyId, serialFacts: facts });
    expect(ok[0].level).toBe("ok");
    expect(facts.bodyId).toBe("m3");
    const bad = serialFlags({ kind: "body", name: "M6", serial: "700123", catalogueId: "m6", serialFacts: facts });
    expect(bad[0]).toMatchObject({ level: "warn", key: "passport.flag.mismatch" });
  });
  it("says so when there's nothing to check", () => {
    expect(serialFlags({ kind: "lens", name: "x" })[0].key).toBe("passport.flag.noSerial");
    expect(serialFlags({ kind: "lens", name: "x", serial: "1" })[0].key).toBe("passport.flag.unlisted");
    // Facts not saved with the item are looked up from the serial.
    expect(serialFlags({ kind: "body", name: "M3", serial: "700123", catalogueId: "m3" })[0].level).toBe("ok");
    expect(serialFlags({ kind: "accessory", name: "x" })).toEqual([]);
  });
});
