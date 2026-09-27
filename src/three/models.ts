// Model manifest and contract for the 3D view (feature #2, slice 4).
//
// A body or lens is drawn from a glTF/GLB model when the manifest has one for
// it, otherwise from the procedural stand-in. Every model must follow the same
// named-parts contract as the procedural meshes (RIG_PARTS + the anchors
// below), so the animator, picker and highlight work unchanged. Nothing here
// imports three.js' loaders: it's safe for the main bundle.

import type { Object3D } from "three";
import type { Body } from "../data/gear";
import type { Provenance } from "../data/provenance";
import { RIG_PARTS } from "./rig";

/** Empty nodes a model must carry so procedural pieces can attach to it. */
export const ANCHORS = {
  /** On a body: the lens-mount flange centre. The lens attaches here, its axis along the anchor's +Y. */
  lensMount: "lens-mount",
  /** On a lens: the diaphragm plane. The iris (driven live by the f-number) is drawn here; `userData.radius` = wide-open radius in metres. */
  iris: "iris-anchor",
} as const;

export interface ModelProvenance extends Provenance {
  /** Licence the model is used under. Required: an unlicensed file must not ship. */
  licence: string;
  author: string;
  /** Date the licence/purchase was recorded (ISO). */
  acquiredAt: string;
}

export interface ModelAsset {
  id: string;
  kind: "body" | "lens";
  /** Catalogue ids (bodies or lenses) this model represents. */
  appliesTo: string[];
  /** Loaded first, when the 3D view opens. Path relative to the app's base URL. */
  base: string;
  /** Higher-detail version, loaded after the user first interacts. */
  detail?: string;
  provenance: ModelProvenance;
  /** Project-generated test fixture rather than a real product model. */
  fixture?: boolean;
}

/**
 * Licensed/commissioned models. Empty until real models are supplied — see
 * docs/MODEL_SPEC.md for what a file must contain to be added here.
 */
export const MODEL_ASSETS: ModelAsset[] = [];

const FIXTURE_PROVENANCE: ModelProvenance = {
  kind: "illustrative",
  licence: "Project-generated; same terms as this repository",
  author: "Exported from the app's own procedural models",
  acquiredAt: "2026-09-27",
  notes: "Test fixture proving the GLB pipeline end to end (loading, compression, parts contract, detail swap, disposal). Looks identical to the procedural stand-in; not a product model.",
};

/** Pipeline test fixtures, enabled with `?models=fixtures`. */
export const FIXTURE_ASSETS: ModelAsset[] = [
  { id: "fixture-body-m6", kind: "body", appliesTo: ["m6"], base: "models/fixtures/body-m6.base.glb", detail: "models/fixtures/body-m6.glb", provenance: FIXTURE_PROVENANCE, fixture: true },
  { id: "fixture-body-m11", kind: "body", appliesTo: ["m11"], base: "models/fixtures/body-m11.base.glb", detail: "models/fixtures/body-m11.glb", provenance: FIXTURE_PROVENANCE, fixture: true },
  { id: "fixture-lens-50-1.4", kind: "lens", appliesTo: ["m-50-1.4"], base: "models/fixtures/lens-m-50-1.4.base.glb", detail: "models/fixtures/lens-m-50-1.4.glb", provenance: FIXTURE_PROVENANCE, fixture: true },
  { id: "fixture-lens-35-2", kind: "lens", appliesTo: ["m-35-2"], base: "models/fixtures/lens-m-35-2.base.glb", detail: "models/fixtures/lens-m-35-2.glb", provenance: FIXTURE_PROVENANCE, fixture: true },
];

export function fixturesEnabled(search = typeof location !== "undefined" ? location.search : ""): boolean {
  return new URLSearchParams(search).get("models") === "fixtures";
}

/** The model for a body or lens, or null to use the procedural stand-in. */
export function modelFor(kind: ModelAsset["kind"], id: string, useFixtures: boolean, assets = MODEL_ASSETS, fixtures = FIXTURE_ASSETS): ModelAsset | null {
  const pool = useFixtures ? [...assets, ...fixtures] : assets;
  return pool.find((a) => a.kind === kind && a.appliesTo.includes(id)) ?? null;
}

/** Resolve a manifest path against the build's base URL (the app is deployed under relative/sub paths). */
export function assetUrl(path: string, base: string = import.meta.env.BASE_URL): string {
  return `${base.endsWith("/") ? base : `${base}/`}${path.replace(/^\//, "")}`;
}

/** Parts each kind of model must provide. */
export function requiredParts(kind: ModelAsset["kind"], body?: Pick<Body, "medium">): string[] {
  if (kind === "lens") return [RIG_PARTS.apertureRing, RIG_PARTS.focusRing, ANCHORS.iris];
  return [RIG_PARTS.shutterDial, ANCHORS.lensMount, ...(body?.medium === "film" ? [RIG_PARTS.advanceLever] : [])];
}

/**
 * Problems that make a loaded model unusable (missing contract nodes, a
 * missing iris radius). Empty means it can replace the procedural model.
 */
export function validateModel(root: Object3D, kind: ModelAsset["kind"], body?: Pick<Body, "medium">): string[] {
  const problems: string[] = [];
  for (const name of requiredParts(kind, body)) {
    const node = root.getObjectByName(name);
    if (!node) {
      problems.push(`missing node "${name}"`);
      continue;
    }
    const axis = node.userData.axis;
    if (name !== ANCHORS.lensMount && name !== ANCHORS.iris && axis !== undefined && !["x", "y", "z"].includes(axis)) {
      problems.push(`"${name}" has userData.axis "${String(axis)}"; expected x, y or z`);
    }
  }
  if (kind === "lens") {
    const r = root.getObjectByName(ANCHORS.iris)?.userData.radius;
    if (root.getObjectByName(ANCHORS.iris) && !(typeof r === "number" && r > 0 && r < 0.1)) problems.push(`"${ANCHORS.iris}" needs userData.radius in metres (0–0.1)`);
  }
  return problems;
}

/** Every shipped model must carry a licence, author and date. */
export function licenceProblems(asset: ModelAsset): string[] {
  const p = asset.provenance;
  return [!p.licence && "licence", !p.author && "author", !p.acquiredAt && "acquiredAt"].filter(Boolean).map((f) => `${asset.id}: missing ${f}`);
}
