import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { clearFrames, loadFrames, saveFrame, updateFrameNote } from "./db";
import type { Frame } from "../state/rollExport";

const meta = { body: "M11", lens: "Summilux-M 50 f/1.4 ASPH.", focalMm: 50, fNumber: 1.4, shutterSec: 1 / 500, focusMm: 2000, iso: 400, filmOrSensor: "ISO 400", evOffset: 0 };

const frame1: Frame = { id: 1, number: 1, url: "data:image/jpeg;base64,AAA", caption: "c1", fileName: "f1.jpg", meta };
const frame2: Frame = { id: 2, number: 2, url: "data:image/jpeg;base64,BBB", caption: "c2", fileName: "f2.jpg", meta };

beforeEach(async () => {
  await clearFrames("film");
  await clearFrames("digital");
});

describe("loadFrames/saveFrame", () => {
  it("starts empty", async () => {
    expect(await loadFrames("film")).toEqual([]);
  });

  it("round-trips a saved frame", async () => {
    await saveFrame("film", frame1);
    expect(await loadFrames("film")).toEqual([frame1]);
  });

  it("returns frames sorted by frame number regardless of save order", async () => {
    await saveFrame("film", frame2);
    await saveFrame("film", frame1);
    expect((await loadFrames("film")).map((f) => f.number)).toEqual([1, 2]);
  });

  it("keeps film and digital frames in separate stores", async () => {
    await saveFrame("film", frame1);
    await saveFrame("digital", frame2);
    expect(await loadFrames("film")).toEqual([frame1]);
    expect(await loadFrames("digital")).toEqual([frame2]);
  });

  it("put with the same id overwrites rather than duplicating", async () => {
    await saveFrame("film", frame1);
    await saveFrame("film", { ...frame1, caption: "updated" });
    const frames = await loadFrames("film");
    expect(frames).toHaveLength(1);
    expect(frames[0].caption).toBe("updated");
  });
});

describe("updateFrameNote", () => {
  it("updates the note on an existing frame and leaves the rest alone", async () => {
    await saveFrame("film", frame1);
    expect(await updateFrameNote("film", 1, "sharp, good light")).toBe(true);
    const [loaded] = await loadFrames("film");
    expect(loaded.note).toBe("sharp, good light");
    expect(loaded.caption).toBe(frame1.caption);
  });

  it("returns false for a frame that isn't stored, without throwing", async () => {
    await expect(updateFrameNote("film", 999, "x")).resolves.toBe(false);
  });
});

describe("clearFrames", () => {
  it("removes all frames for one medium without touching the other", async () => {
    await saveFrame("film", frame1);
    await saveFrame("digital", frame2);
    await clearFrames("film");
    expect(await loadFrames("film")).toEqual([]);
    expect(await loadFrames("digital")).toEqual([frame2]);
  });
});
