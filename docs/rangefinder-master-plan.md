# Rangefinder — master plan tracking doc

This is the repository-specific companion to `RANGEFINDER_MASTER_PLAN.md` (the
product spec, kept at the repo root as given). It records what Phase 0 found
and did, so later phases don't have to re-derive it. Update it at the end of
each phase; don't let it drift into a second copy of the spec.

## Current architecture (as of Phase 0)

React 18 + TypeScript (strict) + Vite 5. Single-page app, no router, no
external state library. Test runner is Vitest.

- **Pure engines** — `src/physics/{optics,exposure,model}.ts`: thin-lens DOF,
  hyperfocal, magnification, EV/exposure equivalence, diffraction. No
  React/DOM imports. This is the "pure calculation engine" layer the spec
  asks for; it already existed before Phase 0.
- **Catalog** — `src/data/gear.ts`: 24 bodies, 48 lenses, real specs, honest
  gaps (aperture blade count only set where consistently published).
- **Rangefinder optics** — `src/preview/rangefinder.ts`: finder field of
  view, double-image parallax, frameline parallax shift.
- **Film/exposure model** — `src/preview/film.ts`: `FilmLook` (ISO, latitude,
  tone-curve softness/bias, colour balance, grain, halation) per stock.
- **Renderer** — `src/preview/renderer.ts`: hand-written WebGL2, depth-sliced
  bokeh, aperture-shaped kernel blur, film development pass. No Three.js.
- **`App.tsx`**: the UI coordinator. As of Phase 0 it wires panels and owns
  scene/capture/UI state; the optical state itself has been extracted (see
  below).

## What Phase 0 changed

Foundational scaffolding only — no visual or behavioral change to the app.

1. **`src/state/opticalState.ts`** — a `useOpticalState()` hook holding the
   canonical optical state the spec calls for: body, lens, aperture, focus
   distance, background distance, sensor/crop geometry, sharpness standard,
   units, film/ISO/shutter/tripod. `App.tsx` now reads/writes through this
   hook instead of declaring the same ~13 `useState` calls itself. Scene
   content (photo/upload), capture flow (roll/contact sheet/challenge) and
   transient UI state (picker open, loading status) deliberately stayed in
   `App.tsx` — they depend on more than the optical state and don't belong in
   a "single source of truth" for it. Any new surface (Zone Focus, Live View,
   My Bag) that needs body/lens/aperture/focus/units can now import this hook
   instead of prop-drilling through `App.tsx` or duplicating state.
2. **`src/data/provenance.ts`** — the `Provenance`/`ProvenanceKind` type from
   the spec. Adopted additively (new optional/required fields, no existing
   field's type changed) on `Lens.apertureBladesProvenance` (the two lenses
   with a published blade count) and `FilmLook.provenance` (all stocks, all
   tagged `"approximate"` or `"calculated"` since none are scan-calibrated).
   This proves the pattern on real data without a big migration; later
   features (Lens DNA, viewfinder geometry) can adopt the same type.
3. **`src/flags.ts`** — the six feature flags the spec names
   (`liveView`, `filmMode`, `motionSensors`, `audioHaptics`, `threeD`,
   `experimentalLensCharacter`), all off except the two already-shipped
   capabilities. Nothing reads them yet; they exist so Live View/3D/sensor
   work starts behind a flag from its first commit instead of retrofitting
   one later.
4. **`src/services/persistence.ts`** — a `localStorage` wrapper that never
   throws (reads fall back to a default, writes report success/failure) plus
   a versioned-JSON helper (`{version, value}` envelope with a `migrate`
   callback) for later features — My Leica Bag and Film Roll Companion will
   both need to evolve their stored shape without breaking old data.
   `src/audio/sounds.ts`'s mute flag now goes through it, both to prove the
   service end-to-end and so there's one storage pattern in the codebase, not
   two.
5. **`.github/workflows/ci.yml`** — runs typecheck, lint, test, build on
   every push/PR. There was no CI before Phase 0.
6. **ESLint** (`eslint.config.js`) — there was no linter at all before Phase
   0. Configured with `@typescript-eslint`'s recommended rules plus the
   *classic* `react-hooks` rules (`rules-of-hooks`, `exhaustive-deps`) only.
   `eslint-plugin-react-hooks`'s v7 "recommended" config also bundles
   experimental React-Compiler-oriented rules (purity, set-state-in-effect,
   immutability) that flag this app's existing, intentionally imperative
   WebGL/canvas sync code (`BokehPreview.tsx`, `Viewfinder.tsx`,
   `SceneDiagram.tsx`, the `fireShutter` RNG call in `App.tsx`). Adopting
   those is a real refactor to evaluate on its own merits later, not a Phase
   0 foundation task, so they're deliberately not enabled. Lint currently
   passes with 0 errors and 5 pre-existing warnings (missing-dependency and
   fast-refresh-export warnings in files Phase 0 didn't touch).
7. **New tests** — `src/data/gear.test.ts` (19 tests) covers catalog logic
   that had zero coverage before Phase 0: `apertureStops`, `nearestStop`,
   `isFullStop`, `formatShutter` (including its snap-to-marked-speed and
   round-to-2-significant-figures branches), `framelinesFor`, `isAdapted`,
   `lensesForBody`, and the `findBody`/`findLens` fallback-to-first-row
   behavior. `src/services/persistence.test.ts` (12 tests) covers the new
   service, including storage-throws and no-`window` paths.

Net: 69 tests passing (was 38), 0 lint errors, clean typecheck, clean build.
Main JS bundle: 264.92 kB (was 260 kB) — the ~5 kB growth is the new
state/services/flags/provenance modules.

## Mobile layout audit (static/code-level; no live-device pass yet)

Read from `src/styles.css` rather than a running browser session, since Phase
0 was scoped to structural changes, not UI work. This should still be
verified on a real phone before Phase 1 mobile-heavy features (Zone Focus
ruler, Live View) land.

Findings, more favorable than assumed in the original repository analysis:

- **The layout is already mobile-first in structure, not just in media-query
  direction.** `.layout` is a single grid column by default with every panel
  given an explicit `order` (`stage-preview` → `stage-setup` → `stage-finder`
  → `stage-exposure` → `stage-barrel` → `readouts` → `stage-roll` →
  `stage-scene` → `stage-details`), i.e. phones get one column in shooting
  order, not a reflowed desktop sidebar.
- **The gear picker is already a genuine bottom sheet on phones** (`.picker`:
  `margin: auto 0 0`, rounded top corners only, `max-height: 88dvh`, a
  `::backdrop`), becoming a centered modal at `min-width: 720px`. This is
  exactly the "sidebar → mobile sheet" pattern the spec asks for — it's just
  not written down anywhere, so it read as missing in the pre-Phase-0 audit.
- **Two breakpoints, not the "sidebar" one** the spec worries about: `720px`
  (tablet — 2-column grid, a few panels forced full-width) and `1080px`
  (desktop — sidebar appears: `minmax(0,1fr) 400px`, sticky right column).
  Below 720px there is no sidebar to translate; it's single-column already.
- **Gap found:** only 6 `@media`/`@container` breakpoint rules total across a
  1654-line stylesheet. That's consistent with the layout genuinely needing
  little adaptation (most components use `container-type: inline-size` and
  intrinsic sizing instead), but it hasn't been confirmed on an actual phone
  — safe area insets, the viewfinder canvas's aspect-ratio math at narrow
  widths, and the contact-sheet grid at very small widths (<360px) are the
  places most likely to need attention. Recommend a real-device pass (or the
  `claude-in-chrome`/Playwright route) as the first task of whichever Phase 1
  slice touches these panels, rather than as separate Phase 0 work.

## Performance baseline

From `npm run build` on this Phase 0 branch:

| Asset | Size | Notes |
|---|---|---|
| `index-*.js` (main bundle) | 264.92 kB (84.65 kB gzip) | Eagerly loaded |
| `index-*.css` | 27.21 kB (6.36 kB gzip) | Eagerly loaded |
| `transformers.web-*.js` | 582.12 kB (169.41 kB gzip) | Dynamically `import()`ed only when the user uploads a photo for depth estimation |
| `ort-wasm-simd-threaded...wasm` | 26.86 MB | Same lazy path as above; never fetched unless photo upload is used |

The main bundle is small and the one large dependency (in-browser depth
estimation) is already correctly deferred behind a user action — this is the
pattern any future 3D/Live-View asset loading (Phase 3) should follow.
Vite's chunk-size warning on the two large lazy chunks is expected and not a
regression to fix.

Not yet measured (needs a live device/Lighthouse pass, not just a build):
interaction latency on the lens-barrel drag, WebGL context creation time on
low-end mobile Safari, and Lighthouse mobile score. Recommend capturing these
once real-device mobile testing is set up, rather than estimating them here.

## Known pre-existing items, not introduced by Phase 0

- `npm audit` reports 5 advisories (3 moderate, 1 high, 1 critical), all in
  `vite`/`vitest`'s transitive dev-server dependencies (`esbuild`,
  `@vitest/mocker`), both already pinned before Phase 0. They affect the dev
  server only, not the production build or shipped app. Fixing them requires
  major-version bumps of `vite`/`vitest` (breaking changes) — left alone as
  out of scope for Phase 0; worth a deliberate upgrade pass later.
- 5 ESLint warnings (not errors) in `BokehPreview.tsx`, `Viewfinder.tsx`,
  `ScenePicker.tsx`, `GearImage.tsx` — pre-existing code Phase 0 didn't
  touch. Listed above; left as warnings, not fixed, per "keep UI behavior
  unchanged unless Phase 0 explicitly requires a change."

## What remains before Phase 1

See the chat response this doc accompanies for the full list; in short:
persistence is unused by any real feature yet (My Bag/Roll Companion are
Phase 1 work), the mobile audit above needs a live-device confirmation pass,
and `App.tsx` is still the owner of scene/capture/UI state (intentionally —
splitting that further should happen alongside the Phase 1 features that
actually need it, not speculatively).
