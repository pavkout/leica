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

## Phase 1 — M3 Film Companion vertical slice (partial)

Implemented, each as its own reviewable change, verified with
typecheck/lint/test/build after every slice:

1. **My Leica Bag** — `src/state/opticalState.ts` now restores the last-used
   body/lens/aperture/focus/film/ISO/exposure-mode on load (debounced write
   via `src/state/opticalStateStorage.ts`, which also fixes the "Infinity
   doesn't survive JSON" trap for focus-at-infinity/distant-background).
   `src/state/bag.ts` adds pinnable "My Gear" favorites; `GearPicker.tsx` now
   renders a star toggle per card (restructured from `<button>` containing
   only content to a wrapper `<div>` holding two sibling `<button>`s, since a
   `<button>` can't nest another one) and a synthetic "My Gear" tab that
   sorts pinned items first. Wired into the body, lens and film pickers.
2. **Zone Focus** — most of the spec was already delivered by the existing
   `SceneDiagram` (near/far/hyperfocal band) and `LensBarrel` (engraved DOF
   scale), so this added only the missing "2 m street / 3 m street" presets
   to the existing actions row, rather than a duplicate panel.
3. **Sunny 16 Trainer** — new `src/physics/sunny16.ts` (EV-guide scenarios,
   scoring via the existing `exposureError`) and `Sunny16Trainer.tsx`.
4. **Film Roll Companion** — scoped down from the spec's full "offline
   IndexedDB persistence" to what's safely testable now: structured CSV/JSON
   export (`src/state/rollExport.ts`) and a per-frame note field in
   `ContactSheet.tsx`'s lightbox. Frame images are `canvas.toDataURL()`
   JPEGs; persisting 36 of them across reloads risks localStorage quota and
   needs IndexedDB (the spec says so explicitly) with its own test
   infrastructure (e.g. `fake-indexeddb`) — not yet added, so **rolls still
   don't survive a reload**. This is the clearest remaining Phase 1 gap.
5. **Intent Assistant v1** — new `src/physics/intent.ts`, a deterministic
   solver (no model) for freeze-motion/shallow-background/maximum-depth/
   street-zone-focus over the existing exposure engine, with parameter
   locking. **Found and fixed a real bug during manual browser verification**:
   the "alternatives" for freeze-motion and maximum-depth were sliced from
   the raw sorted candidate array rather than sorted by distance from the
   primary pick, so a "slower alternative" could actually be a faster
   shutter speed than the recommendation. Fixed and covered by regression
   tests (`intent.test.ts`).

Deliberately not started: **Live View alpha** (camera permission UX and the
overlay design are real product decisions, not mechanical extensions of
existing code — needs its own focused pass) and **M3 viewfinder 50/90
toggle** (the finder/parallax/patch geometry already exists; only a
dedicated full-screen mode and an explicit 50/90 toggle are missing).

Verified manually in a real browser (Chrome via `claude-in-chrome`) at both
desktop and 390px-wide mobile viewport: My Gear pinning, Zone Focus presets,
Sunny 16 Trainer, Intent Assistant (including the bug above), and Roll
Companion notes/export all work as intended; no console errors at any point.

## Roll Companion: IndexedDB persistence (done)

Closed the gap noted above. `src/services/db.ts` — two IndexedDB object
stores (`filmFrames`/`digitalFrames`), separate from `services/persistence.ts`
because frame images (base64 JPEG `data:` URLs, ~100-300 kB each) are too
large/numerous for localStorage's quota; IndexedDB's browser-managed quota
is built for this. `Frame` moved from `ContactSheet.tsx` to
`state/rollExport.ts` (re-exported for compatibility) so the service layer
doesn't depend on a component file. Tests use `fake-indexeddb` (new dev
dependency, justified the same way as before — standard, dev-only, no
bundle impact): 8 tests covering round-tripping, per-medium isolation,
overwrite semantics and note updates.

**Manually verified the acceptance criterion that actually matters** ("Roll
survives offline reload"): shot a digital frame, reloaded the page, the
frame and its Export CSV/JSON buttons were still there. Shot a film frame,
clicked "Rewind & new roll," confirmed `filmFrames` cleared to 0 while
`digitalFrames` (from the earlier test) was untouched — the two media are
correctly isolated. No console errors.

## Live View alpha and M3 full-screen viewfinder (done, alpha scope)

**M3 full-screen viewfinder**: a "Full screen" button next to "Focus
challenge" on the Rangefinder panel opens the existing `Viewfinder`
component (unchanged) in a fixed, full-viewport, minimal-chrome overlay
instead of the embedded panel. The two are mutually exclusive — only one
`Viewfinder` (and its WebGL context) is ever mounted at a time, toggled via
`viewfinderProps` shared between the inline and full-screen render sites, to
avoid double GPU work. No new "50 vs 90 toggle" was built: switching lenses
already changes the frameline pair correctly (verified — M3 + 50mm shows
`[50]` or `[50,90]`/`[50,135]` depending on which 50mm/90mm lens is
mounted), so a separate toggle would just duplicate the existing lens
picker. Live camera feed inside the optical finder simulation (patch
double-image rendered over real video via a WebGL texture upload) was
explicitly **not** attempted — real complexity, not an alpha-scope task.

**Live View alpha**: new `src/state/useCameraStream.ts` (the
`CameraStreamService` capability adapter the spec asks for — permission
requested only on explicit user action, distinct `idle`/`requesting`/
`streaming`/`denied`/`unsupported`/`error` states, error classification
logic pulled into a pure `classifyStreamError` function so it's testable
without a browser) and `src/components/LiveView.tsx` (full-screen video +
overlay). Scene brightness for the exposure card is **manual** (reusing the
Sunny 16 trainer's `LIGHT_CONDITIONS` presets), not derived from webcam
pixel brightness: a `getUserMedia` feed is already auto-exposed by the
camera hardware, and the Web API doesn't reliably expose real shutter/ISO/
gain across browsers (especially iOS Safari) — pretending to compute a real
EV from pixel values would fabricate precision the browser can't actually
provide. This matches how the rest of the app already assigns EV to the
illustrated scene and sample photos, so it's not a rigor regression. The
frameline overlay is explicitly labeled "approximate framing" against an
assumed ~69° phone FOV (`ASSUMED_PHONE_FOV_DEG`, shared with the existing
uploaded-photo FOV assumption in `App.tsx`) via `frameCropRatio` in the new
`src/physics/liveView.ts`. Aperture/focus reuse `LensBarrel` directly inside
the shoot card (same component, same tested interaction, no new ring code).
**Not implemented in this pass**: capturing a Live View frame into the
roll/contact sheet — the spec's acceptance criteria for the alpha milestone
don't require it, and conflating a real captured photo with the simulator's
synthetic-render pipeline needs its own design pass.

**Verification**: 126 tests passing, 0 lint errors, clean typecheck/build.
Manually verified in Chrome: the M3 full-screen mode opens/closes cleanly
with no console errors and correct WebGL rendering (confirmed via
screenshot — framelines, patch, loupe all present). Live View: the actual
camera-streaming path could **not** be exercised — this sandbox has no
camera device and the native OS/browser permission prompt isn't reachable
through page-level browser automation, so a real "streaming" state was
never observed running end-to-end. What *was* verified by stubbing
`navigator.mediaDevices.getUserMedia` directly: the `denied` state (message
+ working "Try again" retry), the `unsupported` state (no-getUserMedia
case), and — most importantly — that the shoot card stays fully live and
correct throughout (tapping f/5.6 on the aperture ring instantly
recalculated the DOF band from "34.7 m – ∞" to "14.9 m – ∞" and the shutter
from 1/1000 to 1/500, with no page reload). This is a real, disclosed gap:
the actual `<video>` rendering path (object-fit, frameline math against a
live stream) has only been verified by code review, not by seeing a live
feed on screen. Worth a real-device pass before calling Live View
production-ready.

Not confirmed at a narrow mobile viewport in this pass — window resize
wasn't taking effect in that browser session — though the new CSS uses the
same fluid/percentage/`env()`-safe-area approach that already passed a
390px check for the other Phase 1 panels, so risk is judged low, not zero.

## Real-device Live View pass, frame capture, and a second narrow-viewport attempt

**Live View frame capture**: added. A shutter button now sits over the live
video in `LiveView.tsx`; pressing it draws the actual `<video>` frame to an
offscreen canvas (`canvas.toDataURL("image/jpeg", 0.92)`, matching the
simulator's existing capture quality) and hands the URL up to `App.tsx`.
Refactored `fireShutter`'s frame-construction/persistence logic into a
shared `addFrame(url, captionSuffix?)` so the simulated-render path and the
Live View path share the roll-full guard, film-advance sound and IndexedDB
write instead of duplicating them. Live View captures are tagged
`"· Live View"` in the caption so they're never confused with simulated
renders on the contact sheet — a real photo and a synthetic render are
different kinds of things, and conflating them in the UI would violate the
project's own "never silently fabricate" ethic.

**Real-device pass**: this environment can't grant camera permission itself
— the native prompt lives outside page-level browser automation, and
routing around it via `chrome://settings` is both technically blocked and
the kind of browser-security tampering this project's operating rules say
to stay out of. Asked the user to click "Allow" once in their own browser;
they did, and **Live View then streamed real, live camera video** end to
end: correct frameline overlay against the live feed, correct badge,
correct reactive shoot card. Captured a frame with the new shutter button —
it landed on the contact sheet as a real, sharp photo (not a placeholder),
with the exact expected caption (`M4 · APO-Telyt-M 135 f/3.4 · f/3.4 ·
1/30 · Gold 200 · Live View`) and correct metadata. No console errors
through the whole flow. This closes the gap the previous pass left open —
the actual `<video>`/frameline/capture path is now confirmed on real
hardware, not just by code review.

**Narrow-viewport check**: tried again (`resize_window` on a fresh tab, then
a CSS-zoom workaround) — neither worked in this session; `resize_window`
silently no-ops here, and `documentElement.style.zoom` turned out to be a
rendering scale that doesn't change `window.innerWidth` or affect
`@media` breakpoints at all, so it doesn't substitute for a real resize
either. Still unconfirmed at a literal narrow viewport; the CSS-review
reasoning from the previous pass stands unchanged. This is a tooling gap in
the current session, not something worth spending further effort routing
around — a real phone or a working DevTools device toolbar would settle it
in seconds whenever that's available.

**Verification**: 126 tests passing, 0 lint errors, clean typecheck/build,
plus the real-camera manual pass above.

## What remains before Phase 1 is complete

- A narrow-viewport (mobile) check specifically for the two new full-screen
  overlays — attempted twice this session, blocked by tooling, not by the
  app.
- The Phase 0 mobile audit still wants a dedicated real-device pass beyond
  the spot-checks done alongside Phase 1's manual testing (now includes one
  real webcam capture, but not a phone/orientation-change pass).
