import { describe, expect, it } from "vitest";
import { findFilm } from "../preview/film";
import {
  developedLook,
  developmentIntent,
  developmentResponse,
  exposureIndex,
  isCommonPractice,
  pushPullSupport,
} from "./pushPull";

describe("exposureIndex", () => {
  it("rating ISO 400 film at EI 1600 is +2 stops, i.e. -2 EV at capture", () => {
    const ei = exposureIndex(400, 2);
    expect(ei).toBe(1600);
    expect(Math.log2(400 / ei)).toBe(-2);
  });

  it("rating down (pull) lowers the exposure index", () => {
    expect(exposureIndex(400, -1)).toBe(200);
  });
});

describe("developmentIntent", () => {
  it("classifies stops as normal/push/pull", () => {
    expect(developmentIntent(0)).toBe("normal");
    expect(developmentIntent(2)).toBe("push");
    expect(developmentIntent(-1)).toBe("pull");
  });
});

describe("pushPullSupport", () => {
  it("gives black & white the widest range", () => {
    const trix = findFilm("trix400");
    expect(pushPullSupport(trix)).toEqual({ maxPush: 3, maxPull: 2 });
  });

  it("gives colour negative a narrow, push-only range", () => {
    const portra = findFilm("portra400");
    expect(pushPullSupport(portra).maxPull).toBe(0);
    expect(isCommonPractice(portra, -1)).toBe(false);
    expect(isCommonPractice(portra, 1)).toBe(true);
  });

  it("digital has no push/pull range", () => {
    const digital = { kind: "digital" } as Parameters<typeof pushPullSupport>[0];
    expect(pushPullSupport(digital)).toEqual({ maxPush: 0, maxPull: 0 });
  });
});

describe("developmentResponse", () => {
  it("normal rating is a no-op", () => {
    const hp5 = findFilm("hp5");
    const r = developmentResponse(hp5, 0);
    expect(r.softnessScale).toBe(1);
    expect(r.blackLiftDelta).toBe(0);
    expect(r.grainScale).toBe(1);
    expect(r.highlightLatitudeDelta).toBe(0);
  });

  it("pushing increases contrast, grain and shadow blocking, and shrinks highlight latitude", () => {
    const hp5 = findFilm("hp5");
    const r = developmentResponse(hp5, 2);
    expect(r.softnessScale).toBeLessThan(1);
    expect(r.blackLiftDelta).toBeGreaterThan(0);
    expect(r.grainScale).toBeGreaterThan(1);
    expect(r.highlightLatitudeDelta).toBeGreaterThan(0);
  });

  it("pulling decreases contrast and grain, deepens blacks, and extends highlight latitude", () => {
    const hp5 = findFilm("hp5");
    const r = developmentResponse(hp5, -1);
    expect(r.softnessScale).toBeGreaterThan(1);
    expect(r.blackLiftDelta).toBeLessThan(0);
    expect(r.grainScale).toBeLessThan(1);
    expect(r.highlightLatitudeDelta).toBeLessThan(0);
  });

  it("flags stops beyond a stock's common-practice range", () => {
    const portra = findFilm("portra400");
    expect(developmentResponse(portra, 1).commonPractice).toBe(true);
    expect(developmentResponse(portra, -1).commonPractice).toBe(false);
  });
});

describe("developedLook", () => {
  it("returns the same look unchanged at zero stops", () => {
    const hp5 = findFilm("hp5");
    expect(developedLook(hp5, 0)).toEqual(hp5);
  });

  it("applies the response to softness/blackLift/grain/latitude", () => {
    const hp5 = findFilm("hp5");
    const developed = developedLook(hp5, 2);
    expect(developed.softness).toBeLessThan(hp5.softness);
    expect(developed.blackLift).toBeGreaterThan(hp5.blackLift);
    expect(developed.grain).toBeGreaterThan(hp5.grain);
    expect(developed.latitude[1]).toBeLessThan(hp5.latitude[1]);
    expect(developed.latitude[0]).toBe(hp5.latitude[0]);
  });

  it("never returns a negative or absurdly clipped latitude", () => {
    const hp5 = findFilm("hp5");
    const developed = developedLook(hp5, 3);
    expect(developed.latitude[1]).toBeGreaterThanOrEqual(0.25);
  });
});
