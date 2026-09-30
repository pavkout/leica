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
  it("round-trips tool pages, the menu and the camera", () => {
    for (const t of TOOLS) expect(parseRoute(routeHash({ screen: "tool", mode: t.mode, tool: t.id }))).toEqual({ screen: "tool", mode: t.mode, tool: t.id });
    expect(parseRoute(routeHash({ ...HOME, screen: "menu" })).screen).toBe("menu");
    expect(parseRoute(routeHash(HOME))).toEqual(HOME);
  });

  it("opens on the camera, and falls back sensibly", () => {
    expect(parseRoute("")).toEqual(HOME);
    expect(HOME.screen).toBe("camera");
    expect(parseRoute("#/nowhere/x")).toEqual(HOME);
    expect(parseRoute("#/learn")).toEqual({ screen: "tool", mode: "learn", tool: DEFAULT_TOOL.learn });
    // A tool from another mode doesn't leak across.
    expect(parseRoute("#/learn/studio")).toEqual({ screen: "tool", mode: "learn", tool: DEFAULT_TOOL.learn });
  });

  it("opens the museum, wherever inside it the link points", () => {
    expect(parseRoute("#/museum").screen).toBe("museum");
    expect(parseRoute("#/museum/cameras/m3/story").screen).toBe("museum");
    expect(routeHash({ ...HOME, screen: "museum" })).toBe("#/museum");
  });

  it("keeps old links to tools that moved to Collectors", () => {
    expect(parseRoute("#/explore/collection")).toEqual({ screen: "tool", mode: "collect", tool: "collection" });
    expect(parseRoute("#/explore/serial")).toEqual({ screen: "tool", mode: "collect", tool: "serial" });
    expect(parseRoute("#/collect")).toEqual({ screen: "tool", mode: "collect", tool: "collection" });
  });
});
