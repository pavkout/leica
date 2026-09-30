import { describe, expect, it } from "vitest";
import { THEMES, cleanWalk, decodeWalk, encodeWalk, nextLight, promptsOf, trackMetres, walkFromTheme, walkLink, walkZone, type Walk } from "./walks";
import type { SunDay } from "../physics/sun";

const own: Walk = { v: 1, theme: "own", title: "Käse & Café — 東京", focalMm: 35, fNumber: 8, zoneM: 3, prompts: ["Ein Hund", "猫"], meet: "Bahnhof, Gleis 1", when: "2026-10-03T09:30", minutes: 90 };

describe("walk links", () => {
  it("round-trips, including non-Latin text", () => {
    expect(decodeWalk(encodeWalk(own))).toEqual(own);
    const link = walkLink(own, "https://example.org/app/#/camera");
    expect(link.startsWith("https://example.org/app/#/shoot/walks?w=")).toBe(true);
    expect(link.split("?w=")[1]).toMatch(/^[A-Za-z0-9_-]+$/);
  });
  it("rejects nonsense and bounds what it keeps", () => {
    expect(decodeWalk("!!!")).toBeNull();
    expect(cleanWalk({ ...own, focalMm: 9999 })).toBeNull();
    expect(cleanWalk({ ...own, theme: "nope" })).toBeNull();
    expect(cleanWalk({ ...own, prompts: [] })).toBeNull();
    const long = cleanWalk({ ...own, title: "x".repeat(500), prompts: Array(30).fill("p"), when: "tomorrow" })!;
    expect(long.title).toHaveLength(80);
    expect(long.prompts).toHaveLength(12);
    expect(long.when).toBeUndefined();
  });
});

describe("themes", () => {
  it("give their prompts as keys, and a sensible zone", () => {
    const w = walkFromTheme(THEMES[0]);
    expect(promptsOf(w)).toHaveLength(THEMES[0].prompts);
    expect(promptsOf(w)[0].key).toBe("walk.theme.decisive.p1");
    const z = walkZone(w);
    expect(z.nearM).toBeLessThan(3);
    expect(z.farM).toBeGreaterThan(3);
    expect(promptsOf(own).map((p) => p.text)).toEqual(["Ein Hund", "猫"]);
  });
});

describe("light", () => {
  const at = (h: number) => new Date(2026, 8, 30, h);
  const day: SunDay = {
    sunrise: at(7),
    sunset: at(19),
    spans: [
      { phase: "night", start: at(0), end: at(6) },
      { phase: "golden", start: at(6), end: at(8) },
      { phase: "day", start: at(8), end: at(18) },
      { phase: "golden", start: at(18), end: at(20) },
      { phase: "night", start: at(20), end: at(24) },
    ],
  };
  it("finds the next golden hour, skipping one nearly over", () => {
    expect(nextLight(day, "golden", at(5))?.start).toEqual(at(6));
    expect(nextLight(day, "golden", new Date(2026, 8, 30, 7, 45))?.start).toEqual(at(18));
    expect(nextLight(day, "golden", at(21))).toBeNull();
  });
  it("starts now when the light is already right", () => {
    expect(nextLight(day, "day", at(10))?.start).toEqual(at(10));
  });
});

describe("track distance", () => {
  it("adds real steps and ignores jitter, jumps and poor fixes", () => {
    const pts = [
      { lat: 52.37, lon: 4.89 },
      { lat: 52.37001, lon: 4.89 }, // ~1 m jitter
      { lat: 52.371, lon: 4.89 }, // ~111 m
      { lat: 52.38, lon: 4.89, accuracy: 200 }, // poor fix
      { lat: 52.372, lon: 4.89 }, // ~111 m
      { lat: 52.5, lon: 4.89 }, // jump
    ];
    expect(trackMetres(pts)).toBeGreaterThan(200);
    expect(trackMetres(pts)).toBeLessThan(240);
  });
});
