import { describe, expect, it } from "vitest";
import { DEFAULT_TOOL, HOME, MODES, TOOLS, parseRoute, routeHash, toolForStage, toolsFor } from "./tools";

describe("tool registry", () => {
  it("every mode has tools, and its default tool belongs to it", () => {
    for (const m of MODES) {
      expect(toolsFor(m.id).length).toBeGreaterThan(0);
      expect(TOOLS.find((t) => t.id === DEFAULT_TOOL[m.id])?.mode).toBe(m.id);
    }
  });

  it("ids and section classes are unique", () => {
    expect(new Set(TOOLS.map((t) => t.id)).size).toBe(TOOLS.length);
    const stages = TOOLS.flatMap((t) => t.stages);
    expect(new Set(stages).size).toBe(stages.length);
  });

  it("finds the tool for a section", () => {
    expect(toolForStage("stage-trainer")?.id).toBe("sunny16");
    expect(toolForStage("stage-setup")?.id).toBe("studio");
    expect(toolForStage("nope")).toBeUndefined();
  });
});

describe("routes", () => {
  it("round-trips", () => {
    for (const t of TOOLS) expect(parseRoute(routeHash({ mode: t.mode, tool: t.id }))).toEqual({ mode: t.mode, tool: t.id });
  });

  it("falls back sensibly", () => {
    expect(parseRoute("")).toEqual(HOME);
    expect(parseRoute("#/nowhere/x")).toEqual(HOME);
    expect(parseRoute("#/learn")).toEqual({ mode: "learn", tool: DEFAULT_TOOL.learn });
    // A tool from another mode doesn't leak across.
    expect(parseRoute("#/learn/studio")).toEqual({ mode: "learn", tool: DEFAULT_TOOL.learn });
  });
});
