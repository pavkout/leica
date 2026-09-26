import { describe, expect, it } from "vitest";
import { BODIES } from "../data/gear";
import { LOADING_ACTIONS, LOADING_TUTORIALS, UNSOURCED_FILM_BODY_IDS, tutorialFor } from "../data/filmLoading";
import { attempt, blockingReason, paletteFor, stateAt } from "./loadingTutorial";

describe("film loading tutorial data", () => {
  it("covers every film body with a sourced tutorial or lists it as unsourced", () => {
    for (const body of BODIES.filter((b) => b.medium === "film")) {
      const covered = !!tutorialFor(body.id, "load") && !!tutorialFor(body.id, "unload");
      expect(covered || UNSOURCED_FILM_BODY_IDS.includes(body.id), body.id).toBe(true);
      expect(covered && UNSOURCED_FILM_BODY_IDS.includes(body.id), body.id).toBe(false);
    }
  });

  it("cites a published source, with pages and a URL, for every tutorial", () => {
    for (const t of LOADING_TUTORIALS) {
      expect(t.source.kind).toBe("published");
      expect(t.source.sourceName).toBeTruthy();
      expect(t.source.pages).toMatch(/^pp?\. /);
      expect(t.source.sourceUrl).toMatch(/^https:\/\//);
    }
  });

  it("only uses actions from the catalog", () => {
    for (const t of LOADING_TUTORIALS) for (const s of t.steps) expect(LOADING_ACTIONS[s.action], s.action).toBeDefined();
  });

  it("every scripted step is mechanically possible in the state it runs from", () => {
    for (const t of LOADING_TUTORIALS) {
      t.steps.forEach((s, i) => {
        expect(blockingReason(LOADING_ACTIONS[s.action], stateAt(t, i)), `${t.bodyIds[0]} ${t.mode} step ${i} (${s.action})`).toBeNull();
      });
    }
  });

  it("loading ends closed, loaded, on frame 1; unloading ends with the cartridge out", () => {
    for (const t of LOADING_TUTORIALS) {
      const end = stateAt(t, t.steps.length);
      if (t.mode === "load") expect(end).toMatchObject({ camera: "closed", back: "closed", cartridge: "in", film: "loaded", counter: "1" });
      else expect(end).toMatchObject({ cartridge: "none", film: "none", camera: "open" });
    }
  });

  it("the M3 is taught with its removable take-up spool; the M6 isn't", () => {
    expect(tutorialFor("m3", "load")!.steps.map((s) => s.action)).toContain("remove-spool");
    expect(tutorialFor("m6", "load")!.steps.map((s) => s.action)).not.toContain("remove-spool");
  });
});

describe("film loading tutorial engine", () => {
  const t = tutorialFor("m6", "load")!;

  it("advances only on the expected action", () => {
    const r = attempt(t, LOADING_ACTIONS, 0, t.steps[0].action);
    expect(r).toEqual({ outcome: { kind: "advanced" }, stepIndex: 1 });
  });

  it("explains why a physically impossible action is blocked, without advancing", () => {
    // Winding the film with the bottom cover off.
    const i = t.steps.findIndex((s) => s.action === "insert-cartridge");
    const r = attempt(t, LOADING_ACTIONS, i, "wind");
    expect(r.stepIndex).toBe(i);
    expect(r.outcome.kind).toBe("blocked");
    if (r.outcome.kind === "blocked") {
      expect(r.outcome.reason).toMatch(/bottom cover/);
      expect(r.outcome.expected).toBe(t.steps[i]);
    }
  });

  it("points to the right next step for a possible-but-out-of-order action", () => {
    // Closing the rear panel before the film is in is possible, but not next.
    const i = t.steps.findIndex((s) => s.action === "insert-cartridge");
    const r = attempt(t, LOADING_ACTIONS, i, "close-back");
    expect(r).toEqual({ outcome: { kind: "out-of-order", expected: t.steps[i] }, stepIndex: i });
  });

  it("can't reach an impossible state however the user taps", () => {
    // Fuzz: random taps across the palette; the derived state must always
    // equal a state on the scripted path.
    const palette = paletteFor(t, LOADING_ACTIONS).map((a) => a.id);
    const legal = t.steps.map((_, i) => JSON.stringify(stateAt(t, i))).concat(JSON.stringify(stateAt(t, t.steps.length)));
    let i = 0;
    let seed = 7;
    for (let n = 0; n < 2000 && i < t.steps.length; n++) {
      seed = (seed * 16807) % 2147483647;
      i = attempt(t, LOADING_ACTIONS, i, palette[seed % palette.length]).stepIndex;
      expect(legal).toContain(JSON.stringify(stateAt(t, i)));
    }
  });

  it("supports back-step and restart by index, deriving the same state", () => {
    let i = 0;
    for (const s of t.steps.slice(0, 5)) i = attempt(t, LOADING_ACTIONS, i, s.action).stepIndex;
    expect(stateAt(t, i - 1)).toEqual(stateAt(t, 4));
    expect(stateAt(t, 0)).toEqual(t.initial);
  });

  it("reports completion on the last step and stays complete", () => {
    const last = t.steps.length - 1;
    expect(attempt(t, LOADING_ACTIONS, last, t.steps[last].action).outcome.kind).toBe("complete");
    expect(attempt(t, LOADING_ACTIONS, t.steps.length, "wind")).toEqual({ outcome: { kind: "complete" }, stepIndex: t.steps.length });
  });

  it("palette lists each used action once, in catalog order rather than step order", () => {
    const palette = paletteFor(t, LOADING_ACTIONS).map((a) => a.id);
    expect(new Set(palette).size).toBe(palette.length);
    const catalogOrder = Object.keys(LOADING_ACTIONS).filter((id) => palette.includes(id));
    expect(palette).toEqual(catalogOrder);
  });
});
