// Turns licensed product photos into app-ready thumbnails.
//
//   gear-images/bodies/<body-id>.(jpg|png|webp|tif)
//   gear-images/lenses/<lens-id>.(jpg|png|webp|tif)
//   gear-images/credits.json   optional: { "m11": "© Leica Camera AG" , "*": "default credit" }
//
// Each photo is trimmed of its plain background, centred on a white 3:2 tile
// and written as WebP at 320 and 640 px wide to public/gear/. The manifest
// src/data/gearImages.json tells the app which items have photos; everything
// else keeps its drawing. Run: npm run gear-images

import { readdir, readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(import.meta.dirname, "..");
const SRC = path.join(root, "gear-images");
const OUT = path.join(root, "public", "gear");
const MANIFEST = path.join(root, "src", "data", "gearImages.json");
const WIDTHS = [320, 640];
const PADDING = 0.06;
const EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".tif", ".tiff", ".avif"]);

// Catalog ids, read from the data file so this script needs no TypeScript.
const gearSource = await readFile(path.join(root, "src", "data", "gear.ts"), "utf8");
const [bodyPart, lensPart] = gearSource.split("export const LENSES");
const ids = (text) => new Set([...text.matchAll(/id: "([^"]+)"/g)].map((m) => m[1]));
const known = { bodies: ids(bodyPart), lenses: ids(lensPart) };

const credits = existsSync(path.join(SRC, "credits.json"))
  ? JSON.parse(await readFile(path.join(SRC, "credits.json"), "utf8"))
  : {};

await rm(OUT, { recursive: true, force: true });
const manifest = { bodies: {}, lenses: {}, credits: [] };
const usedCredits = new Set();
const problems = [];

for (const kind of ["bodies", "lenses"]) {
  const dir = path.join(SRC, kind);
  if (!existsSync(dir)) continue;
  await mkdir(path.join(OUT, kind), { recursive: true });
  for (const file of (await readdir(dir)).sort()) {
    const ext = path.extname(file).toLowerCase();
    if (!EXTENSIONS.has(ext)) continue;
    const id = path.basename(file, path.extname(file));
    if (!known[kind].has(id)) {
      problems.push(`${kind}/${file}: no ${kind === "bodies" ? "body" : "lens"} with id "${id}" (see gear-images/IDS.md)`);
      continue;
    }

    // Trim the plain studio background, then fit onto a white 3:2 tile.
    const trimmed = await sharp(path.join(dir, file)).rotate().flatten({ background: "#ffffff" }).trim({ threshold: 18 }).toBuffer({ resolveWithObject: true });
    const entry = {};
    for (const width of WIDTHS) {
      const height = Math.round((width * 2) / 3);
      const inner = { width: Math.round(width * (1 - 2 * PADDING)), height: Math.round(height * (1 - 2 * PADDING)) };
      const fitted = await sharp(trimmed.data).resize({ ...inner, fit: "inside", withoutEnlargement: false }).toBuffer();
      const out = `gear/${kind}/${id}-${width}.webp`;
      await sharp({ create: { width, height, channels: 3, background: "#ffffff" } })
        .composite([{ input: fitted, gravity: "center" }])
        .webp({ quality: 84 })
        .toFile(path.join(root, "public", out));
      entry[`w${width}`] = out;
    }
    const credit = credits[id] ?? credits["*"];
    if (credit) {
      entry.credit = credit;
      usedCredits.add(credit);
    }
    manifest[kind][id] = entry;
  }
}

manifest.credits = [...usedCredits];
await writeFile(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");

// Checklist of every id, so photos can be named correctly.
const lines = ["# Gear image ids", "", "Name each photo after its id, e.g. `bodies/m11.jpg`.", ""];
for (const [kind, set] of Object.entries(known)) {
  lines.push(`## ${kind}`, "");
  for (const id of set) lines.push(`- [${manifest[kind][id] ? "x" : " "}] \`${id}\``);
  lines.push("");
}
await writeFile(path.join(SRC, "IDS.md"), lines.join("\n"));

const count = (k) => Object.keys(manifest[k]).length;
console.log(`Bodies: ${count("bodies")}/${known.bodies.size} · Lenses: ${count("lenses")}/${known.lenses.size}`);
for (const p of problems) console.warn(`⚠ ${p}`);
