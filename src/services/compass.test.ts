import { describe, expect, it } from "vitest";
import { readOrientation } from "./compass";

describe("compass readings", () => {
  it("uses iOS's compass heading, and tilt from beta", () => {
    expect(readOrientation({ alpha: 10, beta: 100, webkitCompassHeading: 245 })).toEqual({ heading: 245, pitch: 10 });
  });
  it("uses Android's absolute alpha, turning it into a compass bearing", () => {
    expect(readOrientation({ alpha: 90, beta: 90, absolute: true })).toEqual({ heading: 270, pitch: 0 });
  });
  it("ignores a relative reading with no compass", () => {
    expect(readOrientation({ alpha: 90, beta: 90, absolute: false })).toBeNull();
  });
});
