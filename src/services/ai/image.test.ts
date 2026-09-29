import { describe, expect, it } from "vitest";
import { scaledSize } from "./image";

describe("image preparation", () => {
  it("caps the long edge at 2576 px and never upscales", () => {
    expect(scaledSize(6000, 4000)).toEqual({ w: 2576, h: 1717 });
    expect(scaledSize(3000, 4500)).toEqual({ w: 1717, h: 2576 });
    expect(scaledSize(1200, 800)).toEqual({ w: 1200, h: 800 });
  });
});
