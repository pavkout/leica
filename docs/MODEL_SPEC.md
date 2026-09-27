# 3D model specification — Rangefinder

What a camera-body or lens model must contain to be used in the app's 3D view. Hand this to a 3D artist, or check a purchased model against it before buying.

The app animates named parts of the model from its camera settings (aperture, focus, shutter speed, film advance). A model that doesn't follow this spec is rejected automatically and the app shows its built-in stand-in instead, so nothing breaks — but the model won't be used.

## Files

- Format: **glTF 2.0 binary (`.glb`)**, one file per body and one per lens.
- File name: `body-<id>.glb` or `lens-<id>.glb`, where `<id>` is the app's catalogue id (e.g. `body-m6.glb`, `lens-m-50-1.4.glb`). Ask for the id list.
- Materials: PBR metallic-roughness (the glTF standard). Clearcoat is supported for lens glass.
- Units: **metres, real-world scale** (an M body is about 0.138 m wide). Y is up.
- Accuracy: built from real dimensions and reference photos, not estimated. Record your sources.

## Named parts (required)

Moving parts must be **separate objects with exactly these names**, each with its pivot (origin) on its real rotation axis, at rest pose (0° rotation):

| Model | Node name | What it is | Rotates about |
|---|---|---|---|
| Lens | `aperture-ring` | aperture ring | lens axis |
| Lens | `focus-ring` | focus ring (including any focusing tab) | lens axis |
| Lens | `iris-anchor` | **empty** node at the centre of the diaphragm plane | — |
| Body | `shutter-dial` | shutter-speed dial | dial axis |
| Body | `advance-lever` | film advance lever (film bodies only) | lever pivot |
| Body | `lens-mount` | **empty** node at the centre of the lens-mount flange | — |

- Rotating parts carry a custom property (glTF "extras") `axis` = `"x"`, `"y"` or `"z"`: the local axis they turn about. Lens rings normally turn about local **Y**.
- `iris-anchor` carries the custom property `radius`: the wide-open aperture radius in metres. The app draws the iris blades live at this point, so **don't model the iris blades**.
- Lens orientation: build the lens along its local **+Y** axis, origin at the mount flange, +Y pointing toward the subject. `lens-mount` on the body uses the same convention: its +Y points out of the camera front. That's how any lens fits any body.
- Don't merge the named parts into other meshes, and keep the two empty anchor nodes.

## Budgets (mobile phones are the target)

- Body: up to about **50,000 triangles**; lens: up to about **20,000**.
- Textures: **2048 px maximum**. Engravings (distance and aperture scales, dial speeds) go in textures or normal maps, legible up close.
- The app's build step makes the compressed and lower-detail versions itself; supply the full-quality file.

## Licence (required before a model can ship)

The app displays models in a web browser, where anyone can download the files. So the licence must:

- allow **real-time / interactive web use and distribution** in an app, not just rendered images;
- not be **"editorial use only"** if the project will ever be commercial or used in a retail/kiosk setting — models of trademarked products often are;
- come with the author's name and the date of purchase or commission.

Logos and trademarks (Leica red dot, the "Leica" word mark) should be left off the model unless the project has permission to use them.

## Adding a model to the app (developer steps)

1. Put the source file in `models-src/<group>/` (e.g. `models-src/licensed/body-m6.glb`).
2. Run `npm run models:build <group>`. It writes `public/models/<group>/<name>.glb` (full detail) and `<name>.base.glb` (lighter, loaded first). It also runs the official glTF validator and checks the named parts; it stops with an error if either fails.
3. Add an entry to `MODEL_ASSETS` in `src/three/models.ts` with the licence, author and date.
4. Open the 3D view with that body or lens and check the rings, dial and lever turn about the right axes.

To try the pipeline without a real model, open the app with `?models=fixtures`. The M6 and M11 bodies and the 50/1.4 and 35/2 lenses then load test models generated from the stand-ins.
