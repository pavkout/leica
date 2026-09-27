import { describe, expect, it } from "vitest";
import { Group, Object3D } from "three";
import { BODIES, LENSES } from "../data/gear";
import { ANCHORS, FIXTURE_ASSETS, MODEL_ASSETS, assetUrl, fixturesEnabled, licenceProblems, modelFor, requiredParts, validateModel } from "./models";
import { RIG_PARTS } from "./rig";

function node(name: string, userData: Record<string, unknown> = {}) {
  const o = new Object3D();
  o.name = name;
  o.userData = userData;
  return o;
}

function lensModel(overrides: { radius?: unknown; drop?: string } = {}) {
  const root = new Group();
  for (const n of [RIG_PARTS.apertureRing, RIG_PARTS.focusRing]) if (n !== overrides.drop) root.add(node(n, { axis: "y" }));
  if (overrides.drop !== ANCHORS.iris) root.add(node(ANCHORS.iris, { radius: "radius" in overrides ? overrides.radius : 0.018 }));
  return root;
}

describe("model manifest", () => {
  it("uses the procedural stand-in when no model exists", () => {
    expect(modelFor("lens", "m-50-1.4", false)).toBeNull();
  });

  it("serves fixtures only when asked for", () => {
    expect(modelFor("lens", "m-50-1.4", true)?.id).toBe("fixture-lens-50-1.4");
    expect(modelFor("body", "m6", true)?.fixture).toBe(true);
    expect(fixturesEnabled("?models=fixtures")).toBe(true);
    expect(fixturesEnabled("")).toBe(false);
  });

  it("prefers a real model over a fixture for the same id", () => {
    const real = { ...FIXTURE_ASSETS[2], id: "real-50", fixture: false };
    expect(modelFor("lens", "m-50-1.4", true, [real])?.id).toBe("real-50");
  });

  it("points every entry at real catalogue ids", () => {
    for (const a of [...MODEL_ASSETS, ...FIXTURE_ASSETS]) {
      const ids = (a.kind === "body" ? BODIES : LENSES).map((x) => x.id);
      for (const id of a.appliesTo) expect(ids).toContain(id);
    }
  });

  it("requires a licence, author and date on every model", () => {
    for (const a of [...MODEL_ASSETS, ...FIXTURE_ASSETS]) expect(licenceProblems(a)).toEqual([]);
    expect(licenceProblems({ ...FIXTURE_ASSETS[0], provenance: { ...FIXTURE_ASSETS[0].provenance, licence: "" } })).toEqual(["fixture-body-m6: missing licence"]);
  });

  it("resolves paths against nested deploy bases", () => {
    expect(assetUrl("models/a.glb", "./")).toBe("./models/a.glb");
    expect(assetUrl("/models/a.glb", "/leica")).toBe("/leica/models/a.glb");
  });
});

describe("model contract", () => {
  it("requires the rings and iris anchor on a lens, and the lever only on film bodies", () => {
    expect(requiredParts("lens")).toEqual([RIG_PARTS.apertureRing, RIG_PARTS.focusRing, ANCHORS.iris]);
    expect(requiredParts("body", { medium: "film" })).toContain(RIG_PARTS.advanceLever);
    expect(requiredParts("body", { medium: "color" })).not.toContain(RIG_PARTS.advanceLever);
  });

  it("accepts a complete lens model", () => {
    expect(validateModel(lensModel(), "lens")).toEqual([]);
  });

  it("names each missing part and a bad iris radius", () => {
    expect(validateModel(lensModel({ drop: RIG_PARTS.focusRing }), "lens")).toEqual([`missing node "${RIG_PARTS.focusRing}"`]);
    expect(validateModel(lensModel({ radius: 18 }), "lens")[0]).toMatch(/radius in metres/);
    expect(validateModel(lensModel({ radius: undefined }), "lens")[0]).toMatch(/radius/);
  });

  it("rejects an unknown rotation axis", () => {
    const m = lensModel();
    m.getObjectByName(RIG_PARTS.apertureRing)!.userData.axis = "w";
    expect(validateModel(m, "lens")[0]).toMatch(/expected x, y or z/);
  });

  it("checks a film body for its advance lever", () => {
    const b = new Group();
    b.add(node(RIG_PARTS.shutterDial, { axis: "y" }), node(ANCHORS.lensMount));
    expect(validateModel(b, "body", { medium: "color" })).toEqual([]);
    expect(validateModel(b, "body", { medium: "film" })).toEqual([`missing node "${RIG_PARTS.advanceLever}"`]);
  });
});
