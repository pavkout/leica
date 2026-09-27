// Model pipeline (feature #2): models-src/<group>/<name>.glb → public/models/<group>/
//   <name>.glb       detail version (meshopt geometry, WebP textures ≤1024 px)
//   <name>.base.glb  first-load version (also simplified to ~50% vertices, textures ≤512 px)
// then runs the Khronos glTF validator on both.
//
// Scene-graph flattening, mesh joining, instancing and texture palettes are
// all OFF: they would rename or merge the named parts the app animates
// (see docs/MODEL_SPEC.md and src/three/models.ts). Pruning runs separately
// with empty leaf nodes kept, because the lens-mount and iris anchors are
// empty by design. Each output is then checked for the parts contract.
// Files must be named body-<catalogue id>.glb or lens-<catalogue id>.glb.
//
// Usage: npm run models:build [group]

import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, statSync } from "node:fs";
import { join, basename } from "node:path";
import { rmSync } from "node:fs";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { MeshoptDecoder } from "meshoptimizer";

// Must match requiredParts() in src/three/models.ts.
const REQUIRED = {
  lens: ["aperture-ring", "focus-ring", "iris-anchor"],
  body: ["shutter-dial", "lens-mount"],
};

const SRC = "models-src";
const OUT = "public/models";
const groups = process.argv[2] ? [process.argv[2]] : readdirSync(SRC).filter((d) => statSync(join(SRC, d)).isDirectory());
const KEEP_STRUCTURE = ["--flatten", "false", "--join", "false", "--instance", "false", "--palette", "false", "--prune", "false"];

await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.decoder": MeshoptDecoder });

async function checkContract(file, kind) {
  const names = new Set((await io.read(file)).getRoot().listNodes().map((n) => n.getName()));
  const missing = REQUIRED[kind].filter((n) => !names.has(n));
  if (missing.length) throw new Error(`${file}: missing contract node(s) ${missing.join(", ")}`);
}

function run(args) {
  execFileSync("npx", ["gltf-transform", ...args], { stdio: ["ignore", "ignore", "inherit"] });
}

for (const group of groups) {
  mkdirSync(join(OUT, group), { recursive: true });
  for (const file of readdirSync(join(SRC, group)).filter((f) => f.endsWith(".glb"))) {
    const name = basename(file, ".glb");
    const kind = name.startsWith("body-") ? "body" : name.startsWith("lens-") ? "lens" : null;
    if (!kind) throw new Error(`${file}: name it body-<id>.glb or lens-<id>.glb`);
    const src = join(SRC, group, file);
    const detail = join(OUT, group, `${name}.glb`);
    const base = join(OUT, group, `${name}.base.glb`);
    // Prune first (keeping the empty anchor nodes), compress last: a later rewrite would drop Meshopt compression.
    const pruned = join(OUT, group, `${name}.pruned.tmp.glb`);
    run(["prune", src, pruned, "--keep-leaves", "true"]);
    run(["optimize", pruned, detail, "--compress", "meshopt", "--texture-compress", "webp", "--texture-size", "1024", "--simplify", "false", ...KEEP_STRUCTURE]);
    run(["optimize", pruned, base, "--compress", "meshopt", "--texture-compress", "webp", "--texture-size", "512", "--simplify", "true", "--simplify-ratio", "0.5", "--simplify-error", "0.001", ...KEEP_STRUCTURE]);
    rmSync(pruned);
    for (const out of [detail, base]) {
      await checkContract(out, kind);
      // The CLI prints tables; a clean file's ERRORS section reads "No errors found."
      const report = execFileSync("npx", ["gltf-transform", "validate", out], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
      if (!/No errors found\./.test(report)) throw new Error(`${out} failed glTF validation:\n${report}`);
      console.log(`${out}  ${(statSync(out).size / 1024).toFixed(1)} KB  (valid glTF, parts contract ok)`);
    }
  }
}
