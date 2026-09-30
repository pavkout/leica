import { describe, expect, it } from "vitest";
import { BODIES, LENSES } from "../data/gear";
import { newItem } from "../state/collection";
import { accessoryProblems, type Accessory } from "./accessories";
import { attractSequence, museumHash, parseMuseumPath, step } from "./deck";
import { buildRooms, cameraExhibit, findExhibit, lensExhibit, partExhibits } from "./exhibits";

const find = <T extends { id: string }>(list: T[], id: string) => list.find((x) => x.id === id)!;

describe("museum exhibits", () => {
  it("builds every room from the catalogue, in date order", () => {
    const rooms = buildRooms();
    expect(rooms.map((r) => r.id)).toEqual(["cameras", "lenses", "inside", "accessories", "collection"]);
    const cams = rooms[0].exhibits;
    expect(cams).toHaveLength(BODIES.length);
    expect(cams[0].title).toBe("Leica M3");
    for (let i = 1; i < cams.length; i++) expect(cams[i].year!).toBeGreaterThanOrEqual(cams[i - 1].year!);
    expect(rooms[1].exhibits).toHaveLength(LENSES.filter((l) => l.mount !== "fixed").length);
    expect(rooms[2].exhibits).toHaveLength(7);
    expect(rooms[4].exhibits).toHaveLength(0);
  });

  it("derives a camera's line from its specs, and attaches its sourced notes", () => {
    const m3 = cameraExhibit(find(BODIES, "m3"));
    expect(m3.line).toBe("35 mm film · 0.91× rangefinder · no meter");
    expect(m3.facts.find((f) => f.label === "Frame lines")?.value).toBe("50, 90, 135 mm");
    expect(m3.story[0].source?.url).toMatch(/^https:\/\/en\.wikipedia\.org/);
    expect(m3.simulate).toEqual({ bodyId: "m3" });
    const m11 = cameraExhibit(find(BODIES, "m11"));
    expect(m11.line).toMatch(/^60 MP full frame · 0\.73× rangefinder/);
  });

  it("gives a lens its specs and its generations", () => {
    const cron = lensExhibit(find(LENSES, "m-35-2-8e"));
    expect(cron.line).toBe("35 mm · f/2 · King of bokeh");
    expect(cron.story.some((s) => /generations of the 35 mm Summicron/.test(s.text))).toBe(true);
    expect(cron.hero).toBe(true);
  });

  it("explains each part, marked as an illustration", () => {
    const parts = partExhibits();
    expect(parts.map((p) => p.id)).toContain("shutter");
    for (const p of parts) expect(p.story[p.story.length - 1].source?.label).toBe("Illustrative drawing");
  });

  it("shows the owner's items with their serial facts", () => {
    const item = newItem("body", "My father's M3", { serial: "959450", serialFacts: { kind: "body", model: "M3", variant: "black paint", year: "1959", batchSize: 100, source: "Leitz list", notes: [] } });
    const [room] = buildRooms([item]).filter((r) => r.id === "collection");
    expect(room.exhibits[0].line).toBe("No. 959450 · made 1959");
    expect(room.exhibits[0].facts.find((f) => f.label === "Batch")?.value).toBe("100 made");
  });

  it("finds an exhibit by room and id", () => {
    const rooms = buildRooms();
    expect(findExhibit(rooms, "cameras", "m6")?.room.exhibits[findExhibit(rooms, "cameras", "m6")!.index].id).toBe("m6");
    expect(findExhibit(rooms, "cameras", "nope")?.index).toBe(0);
    expect(findExhibit(rooms, "attic", "m6")).toBeNull();
  });
});

describe("museum deck", () => {
  it("steps through a room and stops at its ends", () => {
    expect(step(0, 5, -1)).toBe(0);
    expect(step(0, 5, 1)).toBe(1);
    expect(step(4, 5, 1)).toBe(4);
    expect(step(0, 0, 1)).toBe(0);
  });

  it("loops through rooms in turn, without the private collection", () => {
    const rooms = buildRooms([newItem("body", "Mine")]);
    const seq = attractSequence(rooms);
    expect(seq.slice(0, 3).map((e) => e.room)).toEqual(["cameras", "lenses", "inside"]);
    expect(seq.some((e) => e.room === "collection")).toBe(false);
    expect(seq.every((e) => e.hero)).toBe(true);
  });

  it("parses and writes museum links", () => {
    expect(parseMuseumPath("#/museum")).toEqual({ display: false, story: false });
    expect(parseMuseumPath("#/museum/display").display).toBe(true);
    const p = parseMuseumPath("#/museum/cameras/m3/story");
    expect(p).toEqual({ display: false, room: "cameras", exhibit: "m3", story: true });
    expect(museumHash(p)).toBe("#/museum/cameras/m3/story");
    expect(parseMuseumPath("#/museum/attic").room).toBeUndefined();
    expect(museumHash({ display: false, room: "lenses", exhibit: "m-50-0.95", story: false })).toBe("#/museum/lenses/m-50-0.95");
  });
});

describe("accessory data", () => {
  it("is complete and cited", () => {
    expect(accessoryProblems()).toEqual([]);
  });

  it("catches missing sources", () => {
    const bad: Accessory = { id: "x", name: "X", kind: "other", year: 1800, line: "", facts: [], story: [{ text: "t", source: "", url: "http://a", checked: "soon" }] };
    expect(accessoryProblems([bad, bad]).length).toBeGreaterThanOrEqual(5);
  });
});
