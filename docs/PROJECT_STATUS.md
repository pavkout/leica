# Rangefinder — Project Status

Last updated: 2026-09-27

## Current state

| Phase | Status |
|---|---|
| Phase 0 — Repository Audit & Foundation | ✅ COMPLETE |
| Phase 1 — M3 Film Companion | ✅ COMPLETE |
| Phase 2 — Tactile Learning | ✅ COMPLETE |
| Phase 3 — “WTF” / 3D Layer | 🟡 IN PROGRESS |
| Phase 4 — Explore / Kiosk / Museum | ⬜ NOT STARTED |

> Phase 0 and Phase 1 were verified directly against the repository (typecheck/lint/test/build all clean, 126 tests passing before this session's work) before Phase 2 began.

## Current phase

**Phase 3 — "WTF" / 3D Layer**, started 2026-09-27 at the user's request, after Phase 2 was closed.

## Current task

**None in progress.**
- **Phase 3:** every feature is COMPLETE except **#2**, which is code complete and waits only for the real-phone check.
- **Also done in the overnight run:** two unscheduled Priority 1 briefs, #28 Photo Recipes and #8 Motion Simulator.
- **Next needs a decision from the user:** Phase 4's contents aren't defined in the Master Plan, and the last unscheduled Priority 1 brief (#13, real-world light meter) needs scoping, because browsers can't meter.

**Feature #2 — Virtual Leica, full 3D camera and lens**

Status: **PARTIAL — code complete, awaiting a real-phone check.** Slices 1–4 are done:
- A lazy-loaded 3D view.
- Every control is bound to the app's state.
- Rings and dial can be turned in 3D.
- The GLB model pipeline is proven with generated fixtures.

The only acceptance criterion left is "<2.5 s interactive on a modern phone", which needs the user's phone. Photoreal models are an asset task, not missing code: see `docs/MODEL_SPEC.md`.

> **Overnight autonomous run (2026-09-27, from 04:32 Amsterdam):** the user asked Claude to keep going feature after feature without asking, and to verify manually in the morning. Each feature below records what was built and checked. Nothing was committed.

## Phase 3 checklist

- [ ] **#2 — Virtual Leica, full 3D camera and lens** — PARTIAL (slices 1–4 done; code complete; real-phone check pending)
- [x] **#5 — Lens X-Ray / optical path** — COMPLETE
- [x] **#4 — Lens DNA** — COMPLETE
- [x] **#25 — Flare Lab** — COMPLETE
- [x] **#33 — Cinematic virtual lens swap** — COMPLETE
- [x] **#35 — Signature 60-second "WOW" demo** — COMPLETE

## Unscheduled Priority 1 items (no milestone in the Master Plan)

Picked during the overnight run, after Phase 3's last feature. The Master Plan defines no Phase 4 contents; these Priority 1 briefs belong to no milestone.

- [x] **#28 — Photo Recipes** — COMPLETE
- [x] **#8 — Motion Simulator** — COMPLETE
- [ ] #13 — Real-world light meter — NOT STARTED

## Phase 2 checklist

- [x] **#3 — Physical Aperture / Iris Visualization** — COMPLETE
- [x] **#16 — Interactive Focusing Ring / DOF Scale Trainer** — COMPLETE
- [x] **#11 — Push / Pull Simulation** — COMPLETE
- [x] **#27 — Portrait Distance Trainer** — COMPLETE
- [x] **#31 — Learn From Negatives / Scan Feedback Loop** — COMPLETE
- [x] **#18 — Cross-body Leica Viewfinder Comparison** — COMPLETE
- [x] **#32 — Mechanical Audio + Haptics** — COMPLETE
- [x] **#9 — Phone Gyroscope Hand-Stability Trainer** — COMPLETE
- [x] **#22 — Film Loading Trainer** — COMPLETE

## Recommended Phase 2 order (resequenced — see reasoning below)

1. #3 — Physical Aperture / Iris Visualization
2. #16 — Interactive Focusing Ring / DOF Scale Trainer
3. #11 — Push / Pull Simulation
4. #27 — Portrait Distance Trainer
5. #31 — Learn From Negatives / Scan Feedback Loop
6. #18 — Cross-body Leica Viewfinder Comparison
7. #32 — Mechanical Audio + Haptics
8. #9 — Phone Gyroscope Hand-Stability Trainer
9. #22 — Film Loading Trainer

**Why reordered from the original list** (original had #9 third): #9 needs `DeviceMotionEvent`, and this development environment has no accelerometer/gyroscope exposed to the browser at all — unlike Live View's camera (which streamed real video once permission was granted), there is no path to observing real motion data here, only the "unsupported" fallback. Verifying it meaningfully needs a real phone. Moved it — and #22 (Film Loading Trainer, which needs verified manufacturer-manual sourcing for real mechanical accuracy before writing instructions for someone's real camera) — toward the end, and promoted #11/#27/#31 (all fully implementable and verifiable with existing tooling and existing Phase 1 infrastructure) ahead of them. #18 sits in the middle: achievable, but a real design decision (either multiple simultaneous WebGL viewfinder instances or a new lighter comparison renderer), not a mechanical extension — give it a focused pass on its own. This order may change again if a later feature turns out to have its own dependency issue; Claude must explain and update this file if so.

## Morning checklist (overnight run, 2026-09-27 04:32 → ~08:00 Amsterdam)

Things to try by hand. Nothing is committed; everything below is in the working tree.

1. **#2 3D view:** open **3D** in Camera & lens.
   - Turn it; tap a ring or the dial to turn it (Aperture / Focus / Speed buttons do the same); try **X-Ray** and **Rays**.
   - With **Animate lens changes** on, switch lenses and watch the bayonet swap.
   - Add `?models=fixtures` to the URL to see the GLB pipeline (M6/M11 bodies, 50/1.4 and 35/2 lenses).
   - **On your phone** (`npm run dev:phone`): the remaining #2 check is load time (<2.5 s), finger turning, haptics and pinch.
2. **#4 Lens DNA** and **#25 Flare Lab** panels, in the main column after the Iris panel. Drag the light in Flare Lab, toggle the hood, and change aperture from either panel.
3. **#35 Tour:** the **Tour** button in Camera & lens, or open with `?demo`. Try it with the camera denied to see the synthetic Live scene.
4. **#28 Photo recipes:** Load a few, switch scenes to see the light warning, save with ☆, and open a **Share link**.
5. **#8 Motion simulator** (next to the Sunny 16 trainer): pick a subject, drag the shutter slider, and toggle subject motion and camera shake independently.
6. Review `docs/MODEL_SPEC.md` (the spec for a 3D artist or model purchase).
7. **Two app-wide fixes to know about:**
   - Sounds and haptics now wait for real user interaction on every path.
   - A new dev-only dependency, `@gltf-transform/cli`, provides `npm run models:build`.

---

## Last completed

**Feature #8 — Motion Simulator** (unscheduled Priority 1) — **COMPLETE** (2026-09-27, overnight run)

Implemented:
- `physics/motion.ts` (pure):
  - **Calculated:** image-plane subject blur = speed × shutter time × magnification (shared `magnification`), for motion across the frame; custom angular speed as f × ω × t.
  - Camera shake straight from the shared `shakeBlurMm`. The two are computed **independently** (`motionResult`), so switching one off can never change the other.
  - `blurBand` describes the freeze → streak **continuum** (frozen / slightly soft / visibly blurred / streaked) as multiples of the circle of confusion, not a sharp/blurred verdict.
  - `trailSamples` budgets samples, using fewer while dragging.
  - Archetype speeds (walking 1.4 m/s, cyclist 5.5, car 50 km/h, train 80 km/h) are labelled **approximate** typical values.
- `components/MotionSimulator.tsx`:
  - A 2D canvas that **accumulates the exposure**: each camera-shake offset redraws the scene, and within it each subject position. Posts in the background make shake visible; the subject shows motion.
  - Redrawn only on change; fewer samples while the shutter slider is dragged.
  - Subject picker (four archetypes plus custom angular speed), a shutter slider over the body's marked speeds, a distance or angular-speed slider, and independent **Subject moves** / **Camera shake** toggles (shake off and disabled on a tripod).
  - A readout per blur (mm on the sensor, × circle of confusion, band) with a log-scale continuum bar, and an accessible canvas description.
  - It shares the camera's shutter speed (switching to manual on auto bodies, like the Intent Assistant).
- Honest scaling: at true scale across a full 36 mm frame, a clearly blurred walker (13× the CoC) is only ~4 px on a phone. The CoC is defined for a viewed print, not a thumbnail. So streaks are drawn **relative to the circle of confusion, enlarged** (one CoC ≈ 1/120 of the picture), and the panel says so; the millimetres shown are unscaled. Changed after the first browser run showed the difference wasn't visible.
- 9 new unit tests: speed × time × magnification; **walker frozen at 1/1000, streaked at 1/15, ratio exactly 1000/15** (acceptance); speed and distance trends; angular blur; **shake off leaves subject blur identical and vice versa** (acceptance); shake from the shared model; bands; the sample budget; provenance.

Validation:
- Browser checks **36/36** on WebKit iPhone 13 and iPhone SE, and GPU Chromium:
  - Walker at 1/1000 is 0.006 mm, 0.2× CoC, "frozen"; at 1/15 it's 0.394 mm, 13.1×, "streaked". **In pixels**, the subject's spread goes 33→73 px (iPhone 13).
  - Camera shake off leaves the subject readout identical; subject off leaves only shake.
  - It shares the camera's shutter. The custom angular-speed control works. No scroll, spill or errors.
  - **Interactive while dragging:** in the full regression, committing each step to the camera re-rendered the whole app (including the WebGL photo preview), costing 82–102 ms per step. Fixed: while dragging, the panel previews a draft speed and commits it to the camera on release, blur or cancel; keyboard and taps commit immediately. Now ~33 ms from input to painted frame (two frames, the floor of this measurement), and a new check confirms release commits the speed. Browser checks now **39/39**.
- Typecheck clean, lint 0 errors (5 pre-existing warnings), 328/328 unit tests, production build (main bundle 125 KB gz).

Known limitations:
- A stylised scene, not the simulated photograph. Subject motion inside the WebGL photo preview (masking the subject in the real scene) would be a larger renderer change.
- Motion is across the frame only (no toward/away component).
- Archetype speeds are typical values.

Regression-suite note (#2): the "memory stable over 28 lens swaps" check read textures 5→7 once animated swaps (#33) were on by default. The check measured while the last swap's outgoing lens was still on screen (two ring textures). Measured after the swap finishes it's 5→5 (geometries 34→34): no leak.

Related fix found by the regression suite (#33): WebKit threw an uncaught `program.isReady` error during rapid GLB lens swaps. It came from three.js's `compileAsync`, whose background polling breaks if a faster second swap disposes the materials mid-compile. `LensSwap` now pre-compiles with the synchronous `gl.compile`: same benefit, no background polling.

---

**Feature #28 — Photo Recipes** (unscheduled Priority 1) — **COMPLETE** (2026-09-27, overnight run)

Implemented:
- `data/recipes.ts`: six recipes as **content + constraints** — sunny street (zone focus), overcast street, window-light portrait, golden hour/open shade, city at dusk with pushed film, night street.
  - Each has a focal length, film (its box speed doubles as digital ISO), optional push EI, aperture, focus strategy (zone or subject distance), light conditions and "why this works".
  - **No stored shutter speeds.** Light comes from the same published EV guide as the Sunny 16 trainer, and the EV range is derived from it.
  - Also `findRecipe` and `recipeLink`.
- `physics/recipes.ts` (pure), `recipePlan` for the user's actual camera:
  - Lens: the current one if its focal length matches, else the fastest match, else the nearest focal length.
  - Aperture clamped to the lens.
  - Film: film bodies load the film and push EI, but **keep a roll already in the camera** (with a note); digital bodies set ISO within the body's range.
  - Shutter **calculated** by the shared `correctShutter` at the range's middle EV, snapped to a marked speed.
  - Zone focus via the shared `hyperfocal`.
  - `recipeLightMismatch` (±1 EV tolerance) and `planExposureError` (engine).
- `components/RecipesPanel.tsx`:
  - Cards show the settings *as they'll apply to your camera*, "(calculated)" on the shutter, and a "Why this works" disclosure.
  - One-tap **Load**; **☆ save** (remembered per viewer) with an All/Saved filter; **Share link** (clipboard, or a selectable link where the clipboard is blocked).
  - A "Loaded" status with adaptation notes, and a **warning when the simulator's scene light is outside the recipe's range**. Framed as "Starting points, not guaranteed exposures".
- `App.tsx`: `loadRecipe` goes through the same setters the controls use (lens, film + EI + push/pull, ISO, aperture, manual shutter, focus), so every control shows the recipe. `?recipe=<id>` links load on open.
- `LiveView`: also warns when its scene-light setting is outside the loaded recipe's range. This is the spec's "live metered EV": browsers can't meter, so Live's light is set by hand.
- Content fix after testing: the night recipe covers EV 3–5 (the guide's night street *and* dusk street), because the app's own "Night street" scene is EV 5 and loading the night recipe there warned "2 stops brighter".
- Layout fix after the screenshot: the All/Saved switch overflowed the panel on phones. The suite now checks that nothing spills out of the panel, and a one-off sweep of every panel at 320 and 390 px found no other case.
- 15 new unit tests: content uses only EV-guide light and catalogue films; a "why" everywhere and no stored shutter; engine-calculated shutter within ½ stop for its own light; zone = hyperfocal; lens choice; aperture clamping with a note; pushed EI; a locked roll kept; digital ISO; every body works; warning silent in range and firing out of range; agreement with the engine; share-link format.

Validation:
- Browser checks **36/36** on WebKit iPhone 13 and Chromium:
  - Six cards with calculated shutters. Loading "Sunny street" sets the 35 mm, f/11, the card's calculated 1/1000 (manual) and the zone distance 3.75 m, and marks it loaded.
  - It warns "9 stops darker" in the night scene; the night recipe in the night scene doesn't warn and takes the fastest 50 at f/1.4, ISO 3200. Live View warns too.
  - Saving persists across reload; share link works; `?recipe=window-portrait` opens loaded (f/2, 1.20 m).
  - On a film M6: the dusk recipe loads Tri-X at EI 1600 with Push 2. After a shot, the night recipe keeps the roll and says so.
  - No horizontal scroll, clipping or spill; no errors.
- Typecheck clean, lint 0 errors (5 pre-existing warnings), 319/319 unit tests, production build (main bundle 122 KB gz).

Known limitations:
- Six recipes, written for this project. The "why" copy is explanatory, not sourced from a publication.
- The warning compares against the simulator's scene EV and Live's hand-set light, since no browser metering exists; real metering is #13.

---


**Feature #35 — Signature 60-second "WOW" demo** (Phase 3) — **COMPLETE** (2026-09-27, overnight run)

Implemented:
- `state/demoScript.ts` (pure): the tour as data over the **production components**, not a video.
  - Five steps, in the spec's order: mount the 50 on an M3 in 3D → align the rangefinder patch → stop down to f/8 → go LIVE → "Take this setup outside".
  - Each step has `enter` (setup through the app's real setters), `done(state)` (reads the app's real state) and `skip` (reaches the same end state through the same setters).
  - Period-correct gear from the catalogue: the M3 starts with the Summaron 35 f/3.5 and mounts the Summicron 50 f/2 (rigid).
  - A deterministic subject at 3 m for the rangefinder step. `demoSummary` checks the 60 s budget.
- `components/DemoTour.tsx`:
  - A bottom card with step, elapsed time, title and instruction (`aria-live`); focus moves to the title on each step.
  - Steps complete themselves from real state, pausing briefly so the lens locking on is seen. Every step has **Skip**, and **Exit** is always available.
  - Instrumented: `performance.mark`/`measure` per step (`demo:mount` …).
  - The finish card shows the setup (body, lens, f-number, focus, zone-focus setting), per-step times, "Under a minute: N s", **Save to My Leica Bag** (the existing bag) and Finish.
- `App.tsx`:
  - Start from a **Tour** button in the Camera & lens panel header, or `?demo` (event/kiosk). The topbar had no room at 320px: putting it there caused horizontal scroll, caught by the #25 suite.
  - A `demoSubjectMm` override, used only during the tour, so the patch can be split.
  - The tour prefetches the 3D chunk and the stand-in Live scene at start, so **no later step needs the network**.
  - The tour card stays mounted but hidden while Live View's full-screen dialog is open.
- `components/LiveView.tsx`:
  - Optional `syntheticSceneUrl`: when the camera is denied or unavailable, a bundled street scene stands in, with the same framelines and exposure sheet and a "Synthetic scene — no camera available" label. Capture stays off.
  - New everywhere: a **zone-focus recommendation** from the shared `hyperfocal` engine ("Zone focus at f/8: set 10.5 m — sharp from 5.23 m to ∞").
- **App-wide fix, `audio/sounds.ts`:** sounds and haptics now wait for real user activation (`navigator.userActivation.hasBeenActive`). `?demo` auto-start was playing the mount click before any interaction, which broke #32's criterion "no sound plays before user interaction" and made Chrome log a blocked `navigator.vibrate`. This now holds on every code path.
- Bugs found in testing and fixed:
  - A step's completion check ran in the same commit as its setup, against the *previous* state. The rangefinder step "completed" at 1.46 m with the subject at 3 m. It now re-checks once the setup has applied.
  - Turning a little past the aligned patch during the brief pause cancelled the advance. A step achieved now stays achieved.
- 10 new unit tests: the gear exists and fits; spec order; mount setup and completion; the deterministic rangefinder setup; the f/8 threshold; every skip uses the real setters; the subject released at the end; the budget summary; `userHasInteracted` (×2).

Validation:
- Browser checks **46/46** on WebKit iPhone 13 and GPU Chromium, run against the real app:
  - `?demo` starts on the M3 in 3D with the Summaron 35.
  - **The network is switched off** after the initial load, then: mounting plays the lens swap and advances; turning focus aligns the patch (1.20 m → 3.21 m, subject 3 m); stopping down to f/8 advances.
  - Live, with no camera, shows the synthetic scene with framelines and the zone-focus line; the card steps aside; closing Live reaches the finish.
  - The finish card summarises the setup, and four steps are timed and measured. **Completed in ~5 s scripted, under the 60 s budget.**
  - Save to My Leica Bag works. **No failed requests while offline.** Finish closes the tour; no horizontal scroll; no errors.
  - Skipping all four steps reaches the same real end state: 50 mm, f/8, focused at 3 m.
  - The panel button starts the tour and Exit ends it.
- Typecheck clean, lint 0 errors (5 pre-existing warnings), 304/304 unit tests, production build (main bundle 119 KB gz).

Known limitations:
- "Completed in under 60 s by a first-time user" is verified for the scripted path (~5–11 s), **not with real first-time users**.
- "Beautiful M3" uses the procedural stand-in until real models exist (see #2 and `docs/MODEL_SPEC.md`).
- Live View on a real phone camera is covered by #1/#9's real-device checks, not re-verified here.
- The whole run happened while the machine was under heavy load; timings in the suites are not benchmarks.

---


**Feature #33 — Cinematic virtual lens swap** (Phase 3) — **COMPLETE** (2026-09-27, overnight run)

Implemented:
- `three/swapTimeline.ts` (pure, deterministic):
  - `swapPose(t)` runs four phases over 1.0 s: unlock (old lens turns −40° on the bayonet), away (floats 70 mm forward), arrive (new lens comes in turned), lock (turns home). At or past the end it's always the valid final state.
  - Bayonet travel and float distance are illustrative.
  - The "Animate lens changes" setting is remembered per viewer.
  - `SWAP_GROUP` names the two lens groups.
  - Named `swapTimeline.ts`, not `lensSwap.ts`: on macOS's case-insensitive file system that collided with `LensSwap.tsx`, and it would break on a case-sensitive CI.
- `three/LensSwap.tsx`:
  - The app's lens changes **immediately** (state, simulator, sound); only the view animates. Nothing waits on the animation or audio.
  - Both lenses stay mounted under their own keys while their roles change (no rebuild mid-swap). The incoming lens renders first, so the Rig and picker drive the new lens.
  - **Before the timeline starts:** the incoming GLB model is preloaded (new `preloadModel` in `glbCache.ts`); then its shaders are pre-compiled (`compileAsync`, with the group briefly visible to the compiler only) and its textures pre-uploaded (`initTexture`). This fixed an intermittent WebKit case where first-use compilation stalled the start. The old lens stays locked on meanwhile.
  - A generation token discards a stale preload or compile after a later change or an interrupt.
  - **Interrupts:** a pointer or wheel on the canvas, or any key in the viewer (`Leica3D` bumps an interrupt counter), jumps to the final pose. Switching the setting off mid-swap also resolves it; that was a real bug caught in testing.
  - Rapid changes resolve the running swap and start from the lens on the mount.
- `Leica3D`: an "Animate lens changes" checkbox, remembered per viewer (`services/persistence`). Under reduced motion it's off and disabled, with the reason given.
- Only the lens on the mount takes the turn highlight and X-Ray fade; an outgoing lens keeps its plain look.
- Dev probe `swap()` (running, incoming and outgoing poses), stripped from production.
- 6 new unit tests: the start state; each phase (unlock, float, arrive turned, lock); the final state holds; determinism and continuity; never zero lenses visible; the setting round-trips.

Validation:
- Browser checks **34/34** on WebKit iPhone 13, GPU Chromium, WebKit with reduced motion, and GPU Chromium with GLB fixtures:
  - The app state changes at once. The old lens unlocks (−0.70 rad) and floats 70 mm; the new one arrives turned (−0.70 rad, 70 mm out) and locks.
  - Never no lens on screen. It ends at rest after about 60 frames over ~1.0 s.
  - A tap mid-swap and a key mid-swap each resolve to the final state; rapid changes end on the last lens; the Rig drives the new lens after a swap; memory is flat over repeated swaps.
  - Switching the setting off mid-swap resolves it; off means instant; the setting survives reload. Reduced motion: disabled with the reason, and instant.
  - **GLB:** the incoming lens is already its GLB model when it first appears (preloaded, no pop-in).
  - Start delay after the click is ~0.25–0.57 s, including first-use shader compilation on the headless renderers.
- Test-harness notes, not app issues:
  - Synthetic pointers need the capture shim (as in #2 slice 3).
  - Headless Chromium has no audio device, so the browser logs an AudioContext error when the mount click plays; filtered with a comment.
  - The machine was under heavy load (load average ~12) during these runs, which slowed them.
- Typecheck clean, lint 0 errors (5 pre-existing warnings), 294/294 unit tests, production build (3D chunk 254 KB gz).

Known limitations:
- The bayonet motion is illustrative, not the M mount's exact geometry, and there's no distinct unlock sound: the existing mount click plays at selection.
- A first-ever swap can wait a few hundred ms for shader compilation before moving; the old lens stays locked on meanwhile.
- Body changes aren't animated (the spec is about lenses).

---


**Feature #25 — Flare Lab** (Phase 3) — **COMPLETE** (2026-09-27, overnight run)

Implemented:
- `physics/flare.ts` (pure, deterministic), an artistic flare kernel as the spec asks, with room for measured profiles:
  - **Calculated:** the light's field angle from the lens's real angle of view; in/out of frame; ghosts take the *iris shape at the current aperture* and shrink as it closes; diffraction-star spike count (n for even blades, 2n for odd).
  - **Physically motivated:** the hood only acts on light from *outside* the frame's angle of view (`hoodTransmission`); it can't block image-forming light.
  - **Artistic, labelled:** ghost positions along the source–centre line, sizes, brightness, veiling glare, and the hood's falloff shape.
  - `FlareProfile` / `FLARE_PROFILES` (empty: nothing measured) with `ARTISTIC_FLARE_PROFILE` as everyone's default. Its provenance is `illustrative`, and it's never called ray tracing.
- `components/FlareLab.tsx`, behind the `experimentalLensCharacter` flag (the same flag the flags file reserves for Lens DNA and Flare Lab):
  - A 3:2 canvas, redrawn only on change (no idle loop), with DPR capped at 2 and a fixed ghost count, so glow stays bounded on mobile.
  - Drag the light with pointer capture (guarded), including past the frame edge, where an arrow points to it.
  - HTML sliders (across, up/down, brightness) as the non-pointer equivalent, and a hood toggle.
  - An `aria-live` readout of angle, in/out of frame and hood effect; the canvas `aria-label` describes the scene.
  - An "Artistic approximation" badge with the provenance note.
- `components/ApertureStops.tsx`: shared click-stop radio row, now used by Lens DNA and Flare Lab (no copy). Both write through the app's `changeAperture`.
- Layout fix: provenance notes stack under their badge (Flare Lab and the 3D X-Ray note), because side by side they squeezed into a narrow column at 320px.
- 12 new unit tests:
  - Field angle: 0 on axis, the half angle of view at the edge, wider on a wide-angle.
  - Physical rules: spike counts for 9/10/11 blades; the hood can't block in-frame light, cuts far-outside light, and changes only brightness (same ghosts, same places, same angle).
  - Kernel behaviour: determinism; continuity; ghosts collinear with the source and centre; iris shape per aperture and shrinking stopped down; spikes only with straight blade edges in frame; every lens uses the artistic profile.

Validation:
- Browser checks **39/39** on WebKit iPhone 13 and iPhone SE, and Chromium:
  - The badge is shown. The angle rises smoothly (0°→12°→23°→33°→41°→47° on the 21 mm) and the same position gives an identical image.
  - Canvas drag moves the light. The hood can't block in-frame light; out of frame it lets ~40% through and frame brightness drops 91.6→58.6.
  - **The exposure readouts are byte-identical with the hood on and off.**
  - The lab's stops set the app's aperture, and the image changes with it. Accessible description; no scroll, clipping or errors.
- Regression: every other suite re-run clean. Typecheck clean, lint 0 errors (5 pre-existing warnings), 288/288 unit tests, production build (main +2.4 KB gz).
- Screenshots inspected: an 18-point star at f/11 on a 9-blade lens, ghosts on the axis through the frame centre.

Known limitations:
- Entirely an artistic approximation: no lens has a measured flare profile, and coatings, lens era and element count aren't modelled.
- No catalogue lens is listed without a hood, so the disabled-hood path exists but can't be exercised with current data.
- Ghosts don't vary by lens design.

---


**Feature #4 — Lens DNA** (Phase 3) — **COMPLETE** (2026-09-27, overnight run)

Implemented:
- `physics/lensCharacter.ts` (pure):
  - `LensCharacterProfile` for sourced, lens-specific character data, separate from optical geometry as the spec requires. `LENS_CHARACTER_PROFILES` is **empty**: nothing was estimated or taken from marketing copy.
  - `lensDNA(lens, ctx)` returns ten rows, each with a provenance kind and a note on its source:
    - Closest focus and aperture range: published (catalogue).
    - Highlight shape: blade count published where the catalogue has it, generic 9-blade approximation otherwise; roundness from the shared iris model.
    - Corner falloff: **calculated**, the cos⁴ law at the frame corner.
    - Corner darkening in the preview: approximate — the *same* heuristic the simulated photo uses.
    - Diffraction softening from: **calculated** via the shared `diffractionLimitedFNumber` and the current sharpness standard.
    - Sharpness, distortion, flare: **"No data"**, never guessed; a sourced profile fills them.
    - Rendering notes: the catalogue's nicknames, shown as **community** notes, not objective claims.
  - `reachableFNumber` for comparing lenses of different speeds.
- **Engine hygiene (CLAUDE.md "no formulas in UI"):**
  - `vignetteStops` moved out of `App.tsx` into the engine unchanged, so the preview and Lens DNA share one heuristic.
  - Two duplicate copies of the focus-extension formula I'd written tonight (`rig.ts`, `three/optics.ts`) now use the shared `focusExtension` / `distanceFromExtension` in `physics/optics.ts`.
- `components/LensDNA.tsx` (behind the existing `experimentalLensCharacter` flag, now on):
  - Aperture stop buttons that write through the app's `changeAperture`.
  - "Compare with" any lens that fits the body. Both columns use the app's shared aperture and focus state; a slower lens is clamped to its nearest stop with the light difference stated.
  - A text provenance badge on every value (Calculated / Published / Measured / Community / Approximation / No data), plus an "About" disclosure with the source note.
  - A small iris-shape preview.
  - Table semantics (`role=table/row/cell`).
  - On phones the comparison columns stack and each value names its lens.
- 11 new unit tests:
  - Calculation: cos⁴ exactness, and ≈0.5 stop at 50 mm vs ≈2.1 at 21 mm on full frame.
  - Rendering: every lens renders from geometry alone; no value without provenance; "none" always means no value.
  - Honesty: nothing is "measured" without a profile; published vs generic blades; diffraction from the shared engine.
  - Data handling: a profile's data used with its source; a nickname stays community; comparison clamping; the moved preview heuristic.

Validation:
- Browser checks **57/57** on WebKit iPhone 13 and iPhone SE, and Chromium:
  - 10 badges, no "measured"; sharpness, distortion and flare say No data; the 50 mm falloff is 0.5 stop (calculated).
  - DNA stop buttons set the app's aperture, and the main ring updates DNA. Preview vignetting goes from 0.6 stop to "None" at f/4 (digital M, in-camera correction applied).
  - The 35/2 at f/1.4 is "shown at f/2 (1.0 stops less light)"; both lenses follow f/4.
  - "About" opens; no horizontal scroll or clipped text; stacked comparison labels on phones; no errors.
- Regression: all other suites re-run clean (#2 35 + 17 + 63 + 28, #5 48, #22 213, #9 21). Typecheck clean, lint 0 errors (5 pre-existing warnings), 276/276 unit tests, production build (main bundle +6.9 KB gz).
- Test-expectation errors fixed along the way (not app bugs): 35 mm falloff is 0.93 stop, not 1.0; Chromium's `innerText` applies CSS uppercase.

Known limitations:
- No measured or published character data has been sourced yet, so most "tendency" rows read No data. That's by design until real data (e.g. manufacturer MTF and distortion graphs, actually read) is added to `LENS_CHARACTER_PROFILES` with sources.
- "Scene conditions" (spec goal) aren't modelled beyond aperture.
- The iris preview is small at narrow apertures.

---


**Feature #5 — Lens X-Ray / optical path** (Phase 3) — **COMPLETE** (2026-09-27, overnight run)

Implemented:
- `three/optics.ts` (pure):
  - `M_FLANGE_FOCAL_MM` = 27.80 (published M-mount flange distance).
  - `unitFocusExtensionMm` = f²/(d−f) (calculated; assumes unit focusing).
  - `xrayLayout(lens, focus, N)` gives two schematic groups either side of the stop, the image plane, the ideal-lens plane, the entrance-pupil radius f/2N, and a meridional ray fan that enters across the pupil and converges on-axis at the image plane.
  - `XRAY_PROVENANCE` separates schematic groups (illustrative) from calculated focus travel and rays. No element radii or indices are inferred from marketing diagrams.
- `three/SchematicOptics.tsx`:
  - Lathe "biconvex" group shapes inside an `optics-block` node.
  - Rays redrawn each frame against the block's *current* animated position, so the fan stays attached mid-animation.
  - A 36×24 mm image-plane marker. Rays and marker draw over the body, where the image plane is.
  - Rendered inside the body's `lens-mount` anchor, so it works with procedural *and* GLB lenses.
- `Rig`: new slide targets (position along local +Y from rest). The optics block and the iris anchor move out together by the calculated extension, which is what unit focusing does.
- Barrel fade: procedural lenses swap to a shared `xrayShell` material and hide the glass cap. GLB lenses get instance-owned transparent copies from a single `useMaterialOverrides` hook that also owns the turn highlight, so the two can't restore over each other. The live iris is never faded.
- `Leica3D`:
  - An **X-Ray** toggle (`aria-pressed`) and a separate **Rays** toggle. The ray layer is on by default at full quality and off on the reduced tier (the spec's "disable on weak devices").
  - A text **"Schematic"** badge, not colour alone, plus notes on what's schematic and what's calculated.
- 9 new unit tests: extension 0 at ∞ and growing; matches 1/f = 1/u + 1/v; image plane at the flange distance; ideal lens one focal length in front at ∞ and moving by the extension; pupil f/2N; every ray converges on-axis through the pupil on every catalogue lens; groups inside every barrel; provenance kinds.

Validation:
- Browser checks **48/48** (twice) on WebKit iPhone 13, WebKit iPhone SE, GPU Chromium, and GPU Chromium with GLB fixtures:
  - X-Ray toggles without reload, with the badge.
  - Optics move 1.28 → 2.53 mm focusing to 1.04 m, matching f²/(d−f) = 2.525 mm (readout rounding); the diaphragm moves with them.
  - The ray bundle is exactly the entrance pupil: 35.71 mm at f/1.4, 17.86 mm at f/2.8.
  - The ray layer toggles independently; memory is flat over 10 X-Ray toggles; off removes everything; no horizontal scroll; no errors.
- All #2 suites re-run clean (35 + 17 + 63 + 28). Typecheck clean, lint 0 errors (5 pre-existing warnings), 265/265 unit tests, production build (3D chunk 253 KB gz).
- Screenshot inspected: faded shell, blue schematic groups, yellow ray fan converging on the image plane inside the body. The shell colour was darkened after the first look.

Bug found and fixed: a duplicate React key (lens and optics both keyed by lens id in one fragment) made React drop children, so X-Ray-off and Rays-off didn't always remove what they should.

Known limitations:
- Schematic only. No per-lens prescription data exists, so a prescription-accurate mode isn't offered; the badge always says Schematic.
- Unit-focusing assumption: floating-element designs aren't modelled.
- One meridional ray fan from an on-axis point; no off-axis rays or aberrations.
- The front barrel doesn't physically extend with focus.
- Real-phone check shared with #2.

---


**Feature #2 — Virtual Leica, full 3D camera and lens** (Phase 3) — **PARTIAL**, slices 1–4 (2026-09-27)

**Slice 4: GLB model pipeline** (guided by the `threejs-assets` skill). Photoreal models aren't needed to build or prove the pipeline: it was built and tested against fixtures exported from the app's own procedural models.

- `three/models.ts` (main-bundle-safe, no loaders):
  - `MODEL_ASSETS`: licensed models, empty until supplied. `FIXTURE_ASSETS`: M6 and M11 bodies, 50/1.4 and 35/2 lenses. Fixtures are used only with `?models=fixtures`, and a real model beats a fixture.
  - `ANCHORS`: `lens-mount` and `iris-anchor` (empty nodes). `requiredParts` and `validateModel` define the parts contract; `licenceProblems` requires licence, author and date.
  - `assetUrl` resolves against Vite's `BASE_URL`, because the app is deployed with base `./`.
- The procedural models now follow the same contract. The body has a `lens-mount` anchor that the lens renders into; the lens has an `iris-anchor`.
- `IrisAssembly.tsx`: the live iris, extracted so it can sit inside a GLB lens. A GLB never models the blades, since their shape follows the f-number.
- `three/glbCache.ts`:
  - GLTFLoader with the Meshopt decoder, in the lazy chunk only.
  - Reference-counted source cache. Instances are clones sharing geometry, materials and textures.
  - Eviction is separate from unmount: up to 4 idle models stay warm, and older ones are disposed (geometry, materials, textures).
  - A failed load stays cached, so its error reaches the boundary; it's retried only after 30 s on a later mount.
- `three/glb.tsx`:
  - `GlbBody` and `GlbLens`: the base model first, detail swapped in after the first interaction (orbit, tap-pick, *or* an HTML turn button).
  - The lens renders into the body's `lens-mount` and the iris into `iris-anchor`, via R3F `createPortal`.
  - The highlight tints instance-owned material copies and never touches shared ones.
  - `ModelBoundary` falls back to the procedural stand-in and reports why. The UI notes "couldn't be used, stand-in shown", and the hint shows each GLB's provenance and licence.
- `Rig`: parts seen for the first time (new lens, base→detail swap) take their pose at once instead of spinning up from zero.
- `scripts/build-models.mjs` (`npm run models:build <group>`) turns `models-src/<group>/*.glb` into `public/models/<group>/<name>.glb` (Meshopt, WebP ≤1024 px) and `<name>.base.glb` (also simplified to ~50%, ≤512 px). It then runs the Khronos glTF validator and a parts-contract check on every output.
  - Flatten, join, instance and palette are off, because they'd merge or rename animated parts.
  - Pruning runs first with empty leaves kept, then compression.
- Two real pipeline bugs, both caught by the contract check:
  - The default prune deleted the empty anchors.
  - A post-compression prune silently dropped Meshopt compression (71→152 KB).
- Fixtures: raw exports of 408 KB (bodies) and 110 KB (lenses) come out at 71 KB and 22–27 KB. The fixture GLBs ship in `dist/` but are downloaded only with `?models=fixtures`.
- Dev-only probe additions (stripped from production): `sources`, `modelCache`, `irisInGlb`, `exportGLB`.
- `docs/MODEL_SPEC.md`: the one-page spec for a 3D artist or a purchase check. It covers named parts, pivots, axes, anchors, units, budgets, licence requirements (interactive web use, not editorial-only, no trademarks without permission) and the steps for adding a model.
- **New dev dependency: `@gltf-transform/cli`** (build-time tool only; never in the app bundle). It includes `sharp` (native, for WebP) and the Khronos `gltf-validator`. Alternatives considered: running it through `npx` each time (not reproducible), and hand-written compression (reinventing a standard tool). The 3D chunk grew 230→252 KB gz for GLTFLoader and the Meshopt decoder; the main bundle grew ~1 KB.
- 11 new unit tests: manifest lookup, fixtures only on request, real beats fixture, catalogue ids exist, licence fields, base-path resolution, required parts per kind (lever only on film bodies), missing-part and bad-radius and bad-axis reporting.
- Browser checks: **28/28**, plus the slice 1–3 suites (35 + 17 + 63) re-run clean on the restructured scene, on WebKit iPhone 13 and GPU Chromium. The slice 4 checks cover:
  - Default: procedural, no model requests. `?models=fixtures`: base models load; detail isn't requested until interaction, then swaps in with pose kept.
  - The live iris sits inside the GLB lens; its aperture ring follows the f-stop and is tap-pickable.
  - Memory is flat over 20 GLB lens swaps (geometries 44→44, textures 7→7), and each file is fetched once.
  - An aborted download falls back to the procedural lens (body still GLB) with a UI note, one request, no loop.
  - A contract-breaking file (body served as the lens) falls back too, and the view keeps working. No console errors.
  - Production build via `vite preview` with relative base: fixtures return 200 and render, the probe is absent, no errors.
- Bugs found in testing and fixed:
  - Detail never loaded when a turn started from the HTML buttons (keyboard users).
  - A failed download caused an endless suspend-and-retry request loop.


**Slice 3: turning parts directly in 3D** (guided by the `threejs-interaction` and `threejs-accessibility` skills).
- `rig.ts`:
  - `stepAperture` (click-stops, clamped).
  - `stepShutter`: dial order slowest → fastest → A. Turning onto A engages auto; turning off it sets that speed manually.
  - `focusFromRingAngle`, the exact inverse of `focusRingAngle`; the focus ring is smooth, not detented.
  - `detentsFromDrag`: 22 px per detent, with the remainder carried within a gesture.
  - `TAP_SLOP_PX` = 6.
- `VirtualLeica` `Turner`:
  - Picks by raycast on a *tap* (under 6 px of travel), so a drag that starts on a ring still orbits.
  - Only the nearest surface counts, so hidden parts can't be picked.
  - While a part is active, orbit is suspended (`controls.enabled` follows the active part, restored on every exit path), and horizontal drags turn it.
  - The pointer is captured so a turn can pass the canvas edge. `setPointerCapture` is guarded for pointers that are already gone.
  - pointercancel and lostpointercapture end the gesture. Tapping empty space exits.
  - The mouse cursor shows pointer, grab or ew-resize, updated at most once per frame.
  - The active part gets a translucent red band that can't itself be picked.
- `Leica3D`:
  - Turns write through the app's own setters (`changeAperture` with its rate-limited click and haptic, `setFocusMm`, and a new `turnShutterDial` in `App.tsx` with a dial click), so the optical state stays the single source of truth.
  - Values in flight are tracked, so fast drags don't lose steps between renders.
  - Native HTML equivalents: Aperture / Focus / Speed buttons to enter a mode, a live `aria-live` readout, −/+ buttons, and Done. Esc exits. ←/→ turn, but only while focus is inside the viewer, so page keys are never hijacked.
  - The canvas label now includes focus distance.
- Real UX fix found in testing: a half-detent left over from one drag leaked into the next. Each gesture now starts clean.
- Layout at 320px, fixed after inspecting screenshots: the part buttons are a three-column grid on one row, and the turn readout has its own line above −, + and Done.
- 4 new unit tests (aperture stepping and clamping; dial on/off A and between speeds; exact focus inverse; drag → detents with remainder).
- Browser checks: **63/63**, stable across 3 consecutive runs, on WebKit (iPhone 13 and iPhone SE) and GPU Chromium. Slice 1 (35/35) and slice 2 (17/17) re-run clean. The slice 3 checks cover:
  - A drag from a ring orbits and doesn't pick it.
  - A tap picks it; a 3-detent drag moves the app's aperture slider by exactly 3 stops and the 3D ring reaches it.
  - The camera doesn't orbit while a part is active; the readout matches the app's value.
  - Tapping empty space exits and orbit comes back.
  - The dial goes off A to manual and back onto A to auto.
  - Keyboard: the HTML Focus button, ←/→ refocus without scrolling the page, and Esc exits.
  - Dragging the focus ring in 3D refocuses (1.55 m → 0.79 m).
  - No horizontal scroll, no console errors.
- Test-harness notes (not app issues):
  - In touch-emulated WebKit, Playwright's `mouse` and `touchscreen.tap` send no pointer events to the canvas. Touch taps and drags were dispatched as `PointerEvent`s with `pointerType: "touch"`, which is what iOS Safari (Pointer Events since iOS 13) produces.
  - OrbitControls' own `set/releasePointerCapture` throws for synthetic pointer ids, so the touch contexts wrap those two calls. Real fingers are tracked pointers.
  - Real multi-touch (pinch) and assistive technology (VoiceOver) were **not** tested.


**Slice 2: the other moving controls follow state.**
- `rig.ts`:
  - `focusRingAngle` turns in proportion to the helicoid extension f²/(d−f) (calculated), scaled to an illustrative 100° throw. The scale crowds toward ∞ as real ones do.
  - `focusRingMarks` gives the engraved distances in metres. It always keeps ∞ and the closest distance, and drops labels closer than 16° to a neighbour.
  - `dialDetents` / `dialStep` / `shutterDialAngle`: one detent per marked speed, slowest at 0. There's an "A" position on bodies with auto exposure, and the dial sits there when auto is engaged. Spacing adapts to fit 19 positions within 330°.
  - `advanceLeverAngle`: an illustrative 120° stroke, 0.28 s out and 0.22 s back. `RIG_PARTS` gains `advance-lever`. `AXIS_Y` is a shared, frozen userData object.
- Lens: the focus ring has a knurled grip plus an engraved distance scale, with a second index mark.
- Body:
  - The shutter dial's top is engraved with the body's real marked speeds, radially as on a real dial (tangential labels didn't fit a digital M's 19 positions), with an index on the top plate.
  - The film advance lever is rebuilt around a pivot on the release-button axis.
- `VirtualLeica`:
  - The focus ring and dial go through the existing `Rig` animator.
  - `LeverStroke` plays one stroke per film wind-on. Its clock starts on the first frame drawn after the trigger, so a busy main thread delays the stroke instead of swallowing it.
  - It compares against the last count seen, so mounting, StrictMode, or switching to a film body never plays a spurious stroke. That was a real bug in the first version, caught in testing.
  - Reduced motion means no stroke.
  - The component is memoized, and the context-loss callback is stable.
  - The rig publishes its targets for the dev probe.
- `App.tsx`: an `advanceCount`, incremented in the same timeout as `playAdvance()`, so the lever strokes in sync with the sound.
- 9 new unit tests: focus 0 at ∞ and full throw at closest; monotonic and clamped; helicoid crowding; ∞ plus closest engraved with no collisions and each mark under the index at its distance on every catalogue lens; dial slowest at 0 and per-speed detents; A only on auto bodies; ≤330° on long dials; label formats; lever stroke curve.
- Browser checks (WebKit iPhone 13, Chromium on the real GPU): **17/17** plus the slice-1 suite **35/35** again.
  - Dial 0 → 2.88 → 5.44 rad across speeds, and A at 5.76.
  - The focus ring follows 2.00 m → 3.54 m.
  - The lever rests, strokes to ~2.07 rad on an M6 wind-on, and returns to 0; it doesn't move under reduced motion.
  - Every pose is checked against the rig's published target (semantic readiness, no sleeps).
  - Screenshots were inspected; dial and distance-scale legibility was fixed after the first look.
- Performance findings:
  - The view renders about 40 frames while the rings ease in, then **0 frames per second at idle** in Chromium and WebKit.
  - A pre-existing ~0.2 s main-thread task on each shot exists on a real GPU (Apple M2 via Metal), with or without 3D; the 3D view adds nothing measurable (172 vs 159 frames in 3 s).
  - Headless Chromium's default software GPU (SwiftShader) inflates that stall to seconds. Chromium checks therefore use `--use-angle=metal`.

**Slice 1:**

Decisions made with the user:
- Engine: **React Three Fiber v8** (the React 18 line) with `three` 0.170 pinned (same era as R3F 8.18; not the newest 0.186). No `drei`: orbit controls and studio lighting come from `three/examples`.
- Models: **"the mix"**. Procedural models now, and licensed or commissioned GLB models later for photorealism. The user was given the model spec (named moving parts, pivots, scale, triangle and texture budgets, licence checks).
- The project's installed `threejs-*` skills guided the work: web (planning), r3f, product-viewer and testing.

Implemented:
- `three/rig.ts` (pure, no three.js):
  - `RIG_PARTS` is the named-parts contract (`aperture-ring`, `focus-ring`, `iris`, `shutter-dial`), with the rotation axis in `userData.axis`. That's the same place glTF "extras" land, so a GLB with the same node names works with the same animator.
  - `apertureRingAngle` (uniform 15° per stop, labelled illustrative), `apertureRingMarks`, `irisOpening`, `lensProfile` (the catalogue's approximate length and diameter), `chooseQualityTier`, and the generic M-body envelope.
  - `MODEL_PROVENANCE` is `illustrative`.
- `three/capabilities.ts`: a three.js-free WebGL probe. The probe context is released right away, because mobile Safari caps live contexts. The main bundle decides whether to offer 3D without loading the chunk.
- `three/ProceduralLens.tsx`: mount, focus ring (with a tab where `look.tab`), barrel, a red index mark, an aperture ring with engraved stops from a canvas texture, the front bezel, and the glass cap. The iris is cut from the same `irisOutline()` as the 2D iris and the bokeh kernel, so all three are provably the same shape.
- `three/ProceduralBody.tsx`: a generic M body with the catalogue finish. Windows are in M positions. Film bodies get the frosted illumination window, advance lever and rewind knob; digital bodies don't.
- `three/materials.ts`: shared PBR materials, created once per view and disposed with it.
- `three/VirtualLeica.tsx`:
  - Demand rendering (`frameloop="demand"`), so it's idle when nothing moves.
  - Orbit controls: no panning, zoom limits, damping unless reduced motion is on.
  - A `Rig` animator that damps named parts toward the pose the optical state implies, and snaps instead when reduced motion is on.
  - Tiers: `full` has RoomEnvironment reflections via PMREM (no HDR download), DPR up to 2 and antialiasing; `reduced` has lights only and DPR 1.
  - WebGL context loss falls back to 2D.
  - The lens is keyed by id, so a swap tears down the old one in one step.
  - A dev-only `window.__leica3d` probe (memory, ring pose, fixture camera), stripped from production builds.
- `components/Leica3D.tsx`: `React.lazy` import (the only one), a Suspense fallback showing the 2D art with "Loading 3D…", an error boundary with the 2D fallback, a Reset view button, the tier label, and the provenance note. The canvas wrapper is `role="img"` with a live description of body, lens and f-stop.
- `App.tsx`: a **3D** toggle (`aria-pressed`) in the Camera & lens panel header. It's shown only for M rangefinder bodies with an M lens and WebGL, since the procedural body is an M. `flags.ts`: `threeD` is now `true`. `styles.css`: a fixed 280px stage, so a drag can't trap page scrolling over a large area.
- Dependencies added: `three@~0.170.0`, `@react-three/fiber@^8.18.0`, and `@types/three` (dev). The production 3D chunk is **229 KB gzipped**, separate from the main bundle. The main bundle grew by about 4 KB. That's above the 170–200 KB first estimate; R3F's reconciler is the difference.
- 10 new unit tests: ring angle per stop, monotonic and deterministic across every catalogue lens; every engraved mark lands under the index at its stop; wide open plus full stops only; iris 1/f scaling; both rings fit inside every catalogue lens without overlap; metre scale; tier selection including Safari hiding `deviceMemory`.

Browser verification: a Playwright script (scratch directory) on WebKit (iPhone 13; iPhone SE with reduced motion) and desktop Chromium, plus Chromium with WebGL disabled. **35/35 passed**:
- three.js isn't requested before 3D is opened, and is when it is.
- The 3D view appears after tapping 3D, with a semantic readiness signal.
- f/1.4 → f/2.8 through the existing HTML aperture slider turns the 3D ring to the exact expected angle (0.524 rad).
- Memory is flat over 28 lens swaps: geometries 31→31, textures 3→3.
- Turning 3D off removes the canvas and the probe; the simulator still works.
- No horizontal page scroll; no console errors.
- Without WebGL, the toggle is hidden and the 2D camera shows.

Screenshots were inspected. Top-down fixtures confirm "2.8" and "8" sit exactly under the red index at those stops, the iris shows as a 9-sided opening, and the engravings aren't mirrored.

**Not done in this slice (why #2 is PARTIAL):**
1. ~~Interaction modes in 3D~~ — done in slice 3. Haptics come through the existing aperture and dial click paths, but real-device feel is unverified.
2. ~~Focus ring, shutter dial, advance lever~~ — done in slice 2 (illustrative throws and detents, labelled as such).
3. ~~The GLB path~~ — done in slice 4 and proven with fixtures. KTX2/Basis textures aren't wired: they need the transcoder (~0.5 MB) hosted, which is worth it only once real PBR texture sets exist. WebP is used meanwhile. Draco isn't used; Meshopt needs no WASM hosting.
4. Photorealism depends on real models (an asset task; see `docs/MODEL_SPEC.md`).
5. The "<2.5 s interactive on a modern phone" criterion isn't measured on a phone. Dev-server times in emulation (0.3–0.9 s) aren't a benchmark, and headless rendering isn't a mobile GPU.
6. Non-M bodies (Q, SL, CL, S) get no 3D; they keep the 2D art.

---


**Feature #3 — Physical Aperture / Iris Visualization** (Phase 2)

Implemented:
- `preview/aperture.ts`: new pure `irisOutline(shape, samples)` function, reusing the exact same `apertureRadius` edge function the WebGL bokeh kernel already uses — the iris diagram and the bokeh highlight are provably the same shape, not two independent approximations. 5 new unit tests (closed-loop geometry, perfect circle at roundness 1, per-point match against `apertureRadius`, determinism, custom sample count).
- `components/Iris.tsx`: new "Aperture · iris" panel with a Front/Side (through-lens) toggle. Front view: barrel + iris opening polygon, sized by `lens.maxAperture / fNumber` (opening diameter scales as 1/f-number). Side view: a generic schematic (tube, two element ellipses, two diaphragm blades closing toward centre) — explicitly labeled "not this lens's real optical prescription," since no per-lens optical-group data exists or was fabricated. A small out-of-focus-highlight preview sits beside both, using the same `irisOutline` geometry with a radial-gradient glow fill.
- Blade-count labeling reuses the existing convention: published count when `lens.apertureBlades` is set, otherwise "Generic 9-blade… approximation" — same wording pattern already used in the main simulated-photo panel.
- Wired into `App.tsx` right after the Focus & Aperture Rings panel (new `.stage-iris` CSS order slot, forced full-width at the tablet breakpoint alongside the lens barrel).

Manually verified in Chrome (desktop): opens correctly, front view shows a round opening at max aperture and a correct 9-gon at a stopped-down aperture with the diaphragm/bokeh preview shrinking together and staying in sync, Side view's diaphragm blades close symmetrically toward centre, generic-vs-published blade labeling reads correctly, no console errors. **Caught and fixed a real bug during this check**: the Front/Side toggle's default labels ("Front view" / "Through-lens") overflowed the shared `Segmented` component at this panel's width — the component assumes short labels (used elsewhere for "m"/"ft", "Auto"/"Manual") and doesn't wrap. Fixed by shortening the labels to "Front"/"Side" rather than modifying the shared component (lower blast radius; `Segmented` is used throughout the app).

Deliberately scoped down from the full spec: **no "through-lens" optical realism** (internal glass groups, ray tracing) — that's Feature #5 (Lens X-Ray), explicitly Phase 3 territory per `CLAUDE.md`'s phase-boundary rule, so the side view is a generic, always-the-same-shape schematic, not lens-specific data.

Validation: typecheck clean, lint 0 errors (5 pre-existing warnings, untouched files), 131/131 tests passing (was 126), clean production build.

Known limitation: not confirmed at a real narrow/mobile viewport — `resize_window` isn't taking effect in this browser-automation session (a recurring tooling issue, not specific to this feature). Static CSS review (fixed 168px/96px diagrams, `flex-wrap`, short toggle labels) suggests low risk at 390px width, but this is reasoning, not a live-confirmed check.

---

**Feature #16 — Interactive Focusing Ring / DOF Scale Trainer** (Phase 2)

Implemented:
- `utils/format.ts`: new pure `parseDistanceInput(text, units)` — the inverse of the existing `scaleLabel`, parsing a typed metres/feet value to mm, `null` for anything not a positive number. 6 new unit tests, including a round-trip check against `scaleLabel` and an explicit table of rejected inputs (empty, whitespace, non-numeric, zero, negative, `"Infinity"`).
- `components/DistanceInput.tsx`: a new labeled text input, bidirectionally synced with focus distance — types live-commit through `onFocusChange` on every valid keystroke (matching the ring's live-drag feel), local text state while focused so reformatting never fights the user's typing, re-syncs from the external `focusMm` once blurred or when it changes from elsewhere (ring drag, Zone Focus presets, Live View). Shows `∞` as a placeholder when focus is at infinity rather than the literal string "Infinity".
- Expanded the existing Zone Focus hint in `App.tsx` into a full "copy to a real lens" card: names the exact distance-scale and aperture-ring settings and the resulting near/far sharp range, reacting live to whichever aperture stop is currently selected — this single card satisfies both the "tap an aperture marking to explain covered distances" and "copy to real lens" UX requirements at once, without inventing a second interaction mode alongside the ring's existing tap-to-select.
- Did **not** modify `LensBarrel.tsx` itself — the new input is a sibling control in `App.tsx` that shares the same `setFocusMm` callback, so "bidirectional" sync falls out of the existing shared-state architecture rather than needing new wiring inside the ring component. Lower risk to a working, previously-verified component.
- "Unknown lens scale artwork falls back to generic semantic scale" was already true by construction (there's no lens-specific skin system at all — every lens already renders the same generic engraved scale) — no work needed for that acceptance criterion.

Manually verified in Chrome (desktop): typed "3" into the field — the ring's index, the DOF band, the "copy to real lens" card, the Readouts panel, and even the rangefinder viewfinder above all updated live and in sync; tapped the ring at a new position — the input field updated to match (confirmed the reverse direction, not just forward); set focus to infinity via the existing ∞ button — the input correctly showed the `∞` placeholder and the hint card read "set the distance scale to ∞" rather than anything broken. No console errors throughout.

Validation: typecheck clean, lint 0 errors (5 pre-existing warnings, untouched files), 137/137 tests passing (was 131), clean production build.

Known limitation: same as Feature #3 — not confirmed at a real narrow/mobile viewport this session. The new input uses the existing `.field`/`input[type="text"]` pattern already used (and already mobile-verified) elsewhere in the app (ISO dial, Aperture B selector in Phase 1's compare mode), so risk is judged lower than for Feature #3's custom SVG diagrams, but still not a live-confirmed check.

---

**Feature #11 — Push / Pull Simulation** (Phase 2)

Implemented:
- `physics/pushPull.ts`: pure module — `eiStops(boxIso, ei)` (metering deviation in stops), `DEVELOP_LEVELS`/`nearestDevelopLevel` (5 discrete levels: Pull 1, Normal, Push 1–3), `softnessForPush`/`grainMultiplier` (contrast steepens and grain increases with push; contrast flattens and grain still increases with pull — clamped so neither runs away at extreme stops). Tagged `PUSH_PULL_PROVENANCE: illustrative` — one generic curve for every stock, since no verified per-stock push/pull data exists to model instead (matches the spec's own explicit allowance for this). 14 new tests.
- `preview/film.ts`: new `developedLook(look, developStops)` composing that math onto an actual `FilmLook` (no-op for digital sensors and at 0 stops); first tests for this file at all (13 new, also covering the previously-untested `lookFor`/`grainStrength`).
- `state/opticalState.ts`: two new fields, `filmEI: number | null` (null = box speed) and `pushPullStops: number`, persisted like everything else in `OpticalState`. Added `selectFilm(id)` (mirroring the existing `selectBody`/`selectLens` wrapper pattern) that resets both to defaults when a *different* film stock is loaded — an EI of 1600 calibrated against one stock's box speed would be misleading carried over to a stock with a different box speed. Replaced the raw `setFilmId` in the hook's public surface with `selectFilm`, for consistency with how body/lens switching already works.
- `components/ExposurePanel.tsx`: two new film-only fields — an EI selector (reuses the existing ISO_STEPS list, filtered to ±3 stops of box speed) with a live "Metering at EI *X* on ISO *Y* film: *N* EV under/over a normal box-speed capture, before push/pull development" line; and a Development segmented control (Pull 1/Normal/Push 1/2/3) with its own separate contrast/grain explanation line — satisfying the spec's explicit requirement that exposure and development effects are explained *separately*, not conflated into one message. Picking an EI auto-suggests the nearest matching development level (the common real-world case: "I rated it at 1600, so push 2"), but the two controls remain genuinely independent afterward — confirmed by manually overriding development without it snapping back.
- `App.tsx`: `iso` (the metering value fed to the exposure engine) now resolves to `filmEI ?? boxIso` for film bodies; `look` (fed to the renderer and contact-sheet grain calc) is `developedLook(baseLook, pushPullStops)` — so push/pull visibly changes the simulated photo, not just a number in a panel.

Manually verified in Chrome (desktop) — the **exact acceptance-criterion scenario**: loaded Tri-X 400 (box ISO 400), set EI to 1600, and got precisely "Metering at EI 1600 on ISO 400 film: 2 EV under a normal box-speed capture, before push/pull development," Development auto-jumped to "Push 2," and the simulated photo visibly went grainier/higher-contrast. Manually overrode Development to "Pull 1" without touching EI — confirmed EI stayed at 1600 and the two stayed independent. Loaded a different film stock (HP5 Plus) — confirmed EI reset to box speed and Development reset to Normal. No console errors throughout. (One hiccup during testing, not a bug: the film picker was disabled because a roll from earlier Phase 1 testing still had frames on it — expected `filmLocked` behavior, unrelated to this feature; rewound the roll to continue testing.)

Validation: typecheck clean, lint 0 errors (5 pre-existing warnings, untouched files), 164/164 tests passing (was 137), clean production build.

Known limitation: same recurring narrow-viewport gap as the last two features — not confirmed live this session. The new controls reuse the existing `.dial`/`Segmented`/`.field` patterns already used (and mobile-verified) throughout `ExposurePanel.tsx`, so risk is judged low.

---

**Feature #27 — Portrait Distance Trainer** (Phase 2)

Implemented:
- `physics/portrait.ts`: pure module — four `FRAMINGS` (head / head & shoulders / half body / full body), each a fraction of a default 1.7 m standing reference height; `requiredDistanceMm(focalMm, frameHeightMm, subjectHeightM)` inverts the existing thin-lens magnification relationship (`magnification = frameHeightMm / (subjectHeightM · 1000)`, distance = `focal / magnification + focal`); `scaledSubjectHeightM(framing, assumedHeightM)` rescales a framing's fraction against a user-configurable assumed height rather than always assuming 1.7 m. Tagged `PORTRAIT_FRAMING_PROVENANCE: illustrative` — the framing fractions are rough generic proportions, not anthropometric data. 9 new unit tests (rule-of-thumb ~3.6 m sanity check for a 50 mm full-frame full-body portrait, tighter framing ⇒ closer distance, longer focal ⇒ farther distance, taller subject ⇒ farther distance, height-scaling identity/proportionality, framing ordering).
- `components/DistanceInput.tsx`: added an optional `label?: string` prop (defaults to `"Focus distance"`), so the existing bidirectional-sync input could be reused for "Assumed height" instead of writing a second, near-duplicate input. The pre-existing Focus & Aperture Rings call site (no `label` passed) is unaffected — confirmed live, see below.
- `components/PortraitTrainer.tsx`: new self-contained panel (framing dial, an SVG silhouette guide, the "stand back to X" readout, and the reused `DistanceInput` for assumed height). The silhouette's crop window is derived from the exact same `subjectHeightM / DEFAULT_ASSUMED_HEIGHT_M` ratio driving the distance math, not a separately hand-tuned visual value, so the guide and the number can't drift apart. Shows an explicit warning when the required distance is closer than `lens.minFocusMm`.
- `App.tsx`: wired in right after the Intent Assistant panel; `styles.css`: new `.stage-portrait` order slot and a small `.portrait-*` block for the silhouette/result layout.

Manually verified in Chrome (desktop): panel renders with "Head & shoulders" selected by default, reading "Stand back to 0.99 m for a head & shoulders framing with the Summilux-M 50 f/1.4 ASPH." Clicked through all four framing buttons — Head (0.55 m), Half body (1.04 m at assumed height 0.9 m), Full body (1.92 m at assumed height 0.9 m) — the silhouette crop visibly tightened/widened in step with each, and the distance readout changed correctly every time. Lowered "Assumed height" to 0.9 m and selected Head framing: distance dropped to 0.31 m, correctly triggering the MFD warning ("Closer than this lens's minimum focus distance (0.45 m)…") — confirmed the warning is live, not just present in code. Confirmed the reused `DistanceInput` shows "Assumed height (m)" here, and separately confirmed the pre-existing "Focus distance (m)" input in the Focus & Aperture Rings panel is unaffected by the new optional `label` prop. No console errors throughout.

Validation: typecheck clean, lint 0 errors (5 pre-existing warnings, untouched files), 173/173 tests passing (was 164), clean production build (main JS 296.47 kB).

Known limitation: same recurring narrow-viewport gap as the last three features — not confirmed live this session (`resize_window` still non-functional in this environment). The panel reuses the existing `.dial`/`.field` patterns (mobile-verified elsewhere), so risk is judged low. Live View integration (a real-time distance-target overlay in the viewfinder) was deliberately deferred, matching the same staged approach used for Live View's own capture-to-roll feature in Phase 1 — this trainer is a standalone geometric calculator for now, not wired into the camera stream.

---

**Feature #31 — Learn From Negatives / Scan Feedback Loop** (Phase 2)

Implemented:
- `state/rollExport.ts`: extended the existing `Frame`/`FrameMeta` domain model — `FrameMeta` gained `focalMm` and `evOffset` (the exposure deviation of the chosen settings from a metered exposure, reusing the already-computed `errorStops` value rather than a new calculation); `Frame` gained an optional `outcome?: OutcomeTag`, a closed set (`good` / `missed-focus` / `motion-blur` / `underexposed` / `overexposed`) exported as `OUTCOME_TAGS` for UI labeling. The pre-existing free-text `note` field is kept as-is and relabeled "Composition note" in the UI, matching the spec's "good, missed focus, motion blur, under/over, composition note" list as four structured tags plus the existing free-text field, rather than inventing a sixth tag that duplicates it.
- `physics/insights.ts`: new pure module, `computeInsights(frames)` — groups tagged frames by outcome and surfaces plain-language trend statements (shake tags clustered by shutter+focal length, missed-focus tags clustered by aperture, good/under/over-exposed tags' average EV offset from metered), each carrying the exact frame numbers it was derived from. Below `MIN_SAMPLE` (3) tagged frames in a bucket, no trend is stated — a "not enough data" entry is returned instead, satisfying the spec's explicit requirement not to give overconfident advice from a small sample. No image analysis; purely the user's own tags and each frame's already-known shooting metadata. 7 new unit tests.
- `components/Insights.tsx`: new panel — tag-count summary, one card per generated trend (text + the linked frame numbers, e.g. "Frames: #1, #2, #3"), and explicit not-enough-data messaging per under-sampled category.
- `components/ContactSheet.tsx`: the frame lightbox gained an "Outcome" tag selector (reusing the same `dial`/`role="radiogroup"` pattern as Portrait Trainer's framing buttons) beside the renamed "Composition note" field; clicking the already-active tag clears it (the "delete metadata independently" acceptance criterion — a tag can be removed without touching the note or deleting the whole frame). Thumbnails on the sheet now show a small outcome badge when tagged, so the source of a trend is visible at a glance without opening the lightbox.
- `App.tsx`: `addFrame` now records `focalMm`/`evOffset` from values already computed for that shot (`lens.focalMm`, the existing `errorStops`) — no duplicated exposure math. New `updateFrameOutcome(id, outcome)` mirrors the existing `updateFrameNote` persistence pattern (local state + `saveStoredFrame` to IndexedDB, reusing the existing `put`-based `saveFrame` rather than adding a new db.ts function). `Insights` is wired in directly below `ContactSheet`, reading the same active-medium `frames` list (film roll or digital card, whichever is loaded) — consistent with how the Contact Sheet itself scopes to one medium at a time.
- `styles.css`: new `.stage-insights` order slot (right after `.stage-roll`), `.sheet-tag` badge styling, and `.insight-list`/`.insight-item` card styling.

Manually verified in Chrome (desktop): tagged a frame "Missed focus" — the thumbnail badge appeared immediately, and Insights correctly read "1 of 1 frame tagged: 1 missed-focus" with "Not enough data yet for missed-focus (1 of 3 needed)." Took two more frames at the same aperture and tagged all three "Missed focus" — Insights correctly promoted this to a real trend: "Most missed-focus tags (3 of 3) happen at f/2.8," with "Frames: #1, #2, #3" directly underneath, confirming insights link back to their source frames. Clicked the active "Missed focus" tag again on frame #1 to clear it — the badge disappeared and Insights correctly demoted back to "2 of 3... Not enough data yet for missed-focus (2 of 3 needed)," confirming independent tag deletion. Reloaded the page — all three frames and their tags survived exactly as left (IndexedDB persistence, extending the same mechanism already used for frame images/notes). Rewound the roll afterward to leave a clean slate; Insights correctly reverted to its empty-state message. No console errors throughout.

Validation: typecheck clean, lint 0 errors (5 pre-existing warnings, untouched files), 180/180 tests passing (was 173), clean production build (main JS 301.17 kB).

Known limitation: same recurring narrow-viewport gap as the last four features — not confirmed live this session. Insights is scoped to whichever single medium (film roll or digital card) is currently active, matching the existing Contact Sheet's scope — "Rewind & new roll" clears film frames (and therefore their tags) exactly as it always has, so cross-roll historical trends spanning multiple physical rolls are out of scope for this v1 (the spec's "scan attached from a lab/scanner" flow — a real external-image-upload feature with its own consent UI — was deliberately not built; this app's existing captured/rendered frames stand in for that data, which is the same scope decision already made for the rest of the Film Roll Companion).

---

**Feature #18 — Cross-body Leica Viewfinder Comparison** (Phase 2)

Implemented:
- `preview/rangefinder.ts`: new pure `frameLineFraction(fieldDeg, focalMm, frameWidthMm?, frameHeightMm?)`, extracted from math that was previously inlined only in `Viewfinder.tsx` (`hw`/`hh` from `fpx`) — returns the frame line's half-width/half-height as a fraction of the finder's field, independent of any pixel size, so it works for a live canvas or a plain CSS/SVG overlay alike. `Viewfinder.tsx` now calls this helper instead of duplicating the formula, per the engineering rule against duplicating optical formulas in UI components. 3 new unit tests, plus the existing `Viewfinder` behavior re-verified unchanged (see below).
- `data/gear.ts`: new `rangefinderBodies()` (every body with an optical rangefinder — the M film/digital family; Q/SL/CL/S are correctly excluded since they have no `rangefinder` field) and `FINDER_PROVENANCE` (published, since finder magnification/frame-line sets are the same already-curated public-spec data the rest of `gear.ts` uses — no new data was fabricated). 1 new unit test.
- `components/FinderCompare.tsx`: new panel — two independent body pickers (plain `<select>`s, reusing existing global `select` styling), each driving a schematic SVG "finder field" circle (styling reused directly from `Iris.tsx`'s `.iris-diagram`/`.iris-barrel` classes) with the current lens's bright-line frame overlaid via `frameLineFraction`, sized correctly relative to each body's own magnification. When a real sample-scene photo is loaded, that same image (`sampleInfo.image`, the URL already used by the scene picker) is reused as the shared background so both panels visibly show "the same scene, framed differently" — a lightweight `<image>`/`<clipPath>` reuse rather than standing up two more WebGL bokeh renderers (which would risk exceeding mobile Safari's WebGL context limit for a comparison feature not central to the shot pipeline); it falls back to a plain reference grid when no photo is loaded (e.g. the default illustrated street scene). Body selection is fully local component state — it never touches `OpticalState`'s real `body`, so switching finder-comparison bodies cannot affect the app's actual DOF/exposure display, trivially satisfying that acceptance criterion by construction rather than by a runtime guard.
- `App.tsx`: wired in right after the conditional Rangefinder panel (`lens={lens}`, `sceneImageUrl={sampleInfo?.image}`); `styles.css`: new `.stage-finder-compare` order slot (added to the tablet-breakpoint full-width panel list alongside `.stage-iris`/`.stage-barrel`, since it's a wide two-diagram panel) plus `.finder-compare-pickers`/`.finder-frameline`/`.finder-grid`.

Manually verified in Chrome (desktop): panel renders with sensible defaults (Body A = M3 · 0.91×, Body B = M6 · 0.72×) showing correct frame-line captions ("M3 · 0.91× · 50 mm frames" vs "M6 · 0.72× · 50/75 mm frames," matching each body's real frame-set data) and a visibly larger frame rectangle in the higher-magnification M3 circle. Switched Body A to M9 (0.68×) via the dropdown — the diagram and caption updated live, and the frame rectangle correctly shrank relative to M6's (lower magnification ⇒ wider field ⇒ frame occupies less of it). Selected a real sample scene ("Amsterdam, Christmas lights") — both finder circles correctly switched from the placeholder grid to the same photo, confirming the shared-reference-scene requirement. Confirmed the pre-existing main `Viewfinder` panel (which now calls the extracted `frameLineFraction` instead of its own inline formula) still renders its bright-line frames and rangefinder patch correctly and unchanged. No console errors throughout.

Validation: typecheck clean, lint 0 errors (5 pre-existing warnings, untouched files), 184/184 tests passing (was 180), clean production build (main JS 304.20 kB).

Known limitation: same recurring narrow-viewport gap as the last five features — not confirmed live this session. The panel reuses `Iris.tsx`'s already mobile-considered SVG diagram sizing and the `.dial`/`.field`-adjacent `<select>` pattern already styled globally, so risk is judged low. Swipe-style comparison (an alternative to side-by-side) was not built — side-by-side was chosen instead, which the spec explicitly allows ("side-by-side or swipe"), and reads better once the tablet breakpoint forces the panel full-width. Comparison is limited to two bodies at a time by design (not simultaneous multi-body), which keeps the UI simple and avoids the WebGL-context risk a fuller multi-way comparison using the real renderer would carry.

---

**Feature #32 — Mechanical Audio + Haptics** (Phase 2)

Repository-check note (per `CLAUDE.md`'s source-of-truth rule): this feature was **substantially already implemented** in an earlier phase — `audio/sounds.ts` (a Web-Audio-synthesized, no-samples mechanical sound engine) and an accessible, persistent mute control already existed and were already wired to aperture clicks, shutter-speed dial clicks, shutter fire, film advance, and rewind — none of which `PROJECT_STATUS.md` had ever recorded, since Phase 1's tracker entries predate this file's per-feature narrative format. Verified against the actual code before treating anything as "done": "no sound before interaction" and "persistent, accessible mute" were already true; "rapid dial movement rate-limiting" and the lens-mount click were genuinely missing. Scope for this pass was narrowed to exactly those real gaps, not a re-implementation.

Implemented:
- `audio/sounds.ts`: new pure, exported `rateLimit(state, key, minIntervalMs, now)` — true at most once per `minIntervalMs` for a given key. `playApertureClick`/`playDialClick` (the two detent sounds a fast ring drag can trigger many times in a few milliseconds) now call through a `allowDetent()` wrapper (30 ms per kind) before scheduling any Web Audio nodes, so a rapid drag crossing several stops produces one clean click instead of overlapping ones stacking into noise. New `playMountClick()` — the lens-bayonet sound the spec lists (rotational scrape + locking click) that was the one genuinely missing mechanical event. New `vibrate(ms)` helper — optional haptic pairing (spec UX requirement, marked optional) via `navigator.vibrate`, gated behind the same mute flag rather than a second setting the spec never asks for, and a silent no-op on devices/contexts without the Vibration API. Wired to the three most meaningful discrete moments (aperture/dial detents, shutter release, lens mount) — deliberately not every sound, per the spec's own "support interaction, not become a toy." 5 new unit tests for `rateLimit` (the only piece of this module that's meaningfully unit-testable without a real `AudioContext`).
- `App.tsx`: the destructured `selectLens` from `useOpticalState()` is now `selectLensState`; a new local `selectLens(id)` wrapper calls `playMountClick()` then `selectLensState(id)`, mirroring the existing `selectBody` wrapper pattern exactly, and is what's actually passed to the lens `GearPicker`.

Manually verified in Chrome (desktop), instrumented via a patched `window.AudioContext`/`navigator.vibrate` to observe real call counts rather than guessing from behavior: confirmed zero `AudioContext` constructions before any interaction (page load alone never creates one). Dragged the aperture ring fast across four stops (f/2.8 → f/1.4, crossing 2.4 and 2 in between) in one gesture — exactly **one** `vibrate(8)` call was recorded, not four, confirming the rate limiter is working on a real multi-stop drag, not just in the unit test. Toggled mute off/on via the topbar button — `localStorage["rangefinder-muted"]` flipped correctly each time and the accessible label swapped between "Turn sounds on"/"Turn sounds off"; unmuting correctly played a confirmation click. Opened the lens picker and selected a different lens (Noctilux-M 50 f/1.2 ASPH.) — a `vibrate(12)` call fired (the new mount click), the lens updated correctly, and the single shared `AudioContext` was reused rather than a second one being created. Fired the shutter — `vibrate(15)` fired as expected. No console errors through any of this.

Validation: typecheck clean, lint 0 errors (5 pre-existing warnings, untouched files), 189/189 tests passing (was 184), clean production build (main JS 304.74 kB).

Known limitation: haptics were verified via a patched `navigator.vibrate` call count, not felt on a real vibration-capable device this session (no physical phone attached to this browser automation session) — the code path degrades to a silent no-op on unsupported devices by construction, so the risk of this being wrong is low, but it's not a felt/live confirmation. Per-body/lens sound *differentiation* beyond film-vs-digital (already existing in `playShutter`'s `digital` flag) was not added — the spec allows falling back to "generic mechanical samples," and since every sound here is synthesized (not sampled/licensed audio), there was nothing to license or attribute; a real per-body sound "voice" would be a larger, separately-scoped effort if ever requested.

**Follow-up (2026-09-26, user-requested): per-body shutter voices.** The shutter's film-vs-digital `boolean` is replaced with a voice chosen from the body's shutter *mechanism*. `audio/voices.ts` is new: `shutterMechanism(body)` maps each body family to its publicly known mechanism: film M → horizontal cloth focal-plane; digital M, SL, CL and S → vertical metal focal-plane with motor recock; Q → leaf shutter in the lens. `shutterVoiceFor(body)` returns the synthesis parameters for that mechanism. `SHUTTER_VOICE_PROVENANCE` is `illustrative`: the mechanism per family is fact, but the sounds are synthesised, not recorded. `playShutter(exposureSec, voice)` now plays the voice's open and close strikes plus an optional motor recock. It's called from `App.tsx` (both shutter paths) and from `FilmLoadingTrainer.tsx` (which uses the trainer's selected body). The cloth voice uses exactly the previous film-sound values, so film bodies sound unchanged. 7 new unit tests. Validation: typecheck clean, lint 0 errors (5 pre-existing warnings), 221/221 tests, clean production build.
Limitations: the voices differ only by mechanism, not by individual model. How an M9 sounds compared with an M11 isn't published data, so it wasn't invented. Lens-dependent sounds (the spec's "sound map by body/lens") are not modelled either. No per-lens mechanical data exists to base them on. The new sounds haven't been listened to in a live browser this session (no browser tooling was available). Only the mapping and the type wiring are verified, so a listening check on desktop and mobile Safari is still pending.

---

**Feature #9 — Phone Gyroscope Hand-Stability Trainer** (Phase 2) — **COMPLETE** (2026-09-27)

Repository-check note: HEAD commit `787cf0e` is titled "implement Phone Gyroscope Hand-Stability Trainer…", but its diff contains only the #32 audio/haptics work (`audio/sounds.ts`, `App.tsx` mount click, this file). No motion-sensor code existed before this pass, so this file's "NOT STARTED" was correct and the commit message is the thing that's wrong.

Implemented:
- `physics/stability.ts` (pure): `filterSpeeds` normalizes irregular sample streams (time-constant 15 Hz low-pass, so the result doesn't depend on the device's 30–100 Hz rate; duplicate timestamps dropped; gaps > 250 ms not integrated across). `summarizeStability` gives time-weighted RMS and 90th-percentile angular speed about the two axes perpendicular to the lens (roll ignored), or `null` under 1 s of usable data. `angularBlurMm`/`maxHandheldSec` apply small-angle image-plane blur (focal × ω × t). Stable/marginal/unstable thresholds are calibrated to the **same** 1/focal-length rule as `shakeBlurMm` in `physics/exposure.ts` (0.03 mm at 1/f ⇒ a nominal hand turns at ≈1.72°/s), so the trainer and the simulator's shake kernel agree about what an "average hand" is. That agreement is a unit test. `suggestHandheld` snaps a conservative (p90) and a typical (RMS) limit to the current body's real shutter speeds. Provenance: `approximate`.
- `services/motionSensor.ts`: the `MotionSensorService` capability adapter from the Master Plan. It detects support, handles iOS 13+ `DeviceMotionEvent.requestPermission()` (called as the first await inside the tap handler, so iOS accepts it), maps granted/denied/default/NotAllowedError/SecurityError to clear statuses and messages, drops events without gyroscope data, and `subscribeMotion` returns an unsubscribe function.
- `components/StabilityTrainer.tsx`: 5 s / 10 s test using the currently selected lens's focal length and the shot's CoC. It shows a live SVG trace of filtered angular speed with dashed stable/marginal threshold lines, plus a live label (1 s window). The result is "Handheld at 1/X or faster", plus a "1/Y can work with care" line when the typical limit is slower, and copy saying this is personal/device-specific guidance, not a guarantee. The suggestion recomputes live if the lens is changed afterwards, because the summary is focal-independent. Sampling stops on test completion, the Stop button, the page going to the background (`visibilitychange`), and unmount. Raw samples live only in a ref for one test and are cleared when it ends; nothing is persisted. If no gyroscope event arrives within 1.5 s of access being granted (desktop browsers that define `DeviceMotionEvent` but never fire it), it stops and shows a labeled "needs a phone" message.
- `flags.ts`: `motionSensors` flipped to `true` and now read by `App.tsx` to mount the panel (placed after the Portrait trainer, `.stage-stability`). The stale "nothing reads these yet" comment was removed.
- 12 new unit tests: 9 for the engine (1/f agreement with `shakeBlurMm`, classification, braced vs shaken streams give different labels and speeds, safe ≤ typical, focal-length ordering, fastest-speed fallback, 30 Hz vs 100 Hz agreement, jitter/duplicate/gap tolerance) and 3 for the adapter (permission/denial mapping, gyro-less events ignored, no samples after unsubscribe).

Validation: typecheck clean, lint 0 errors (5 pre-existing warnings, untouched files), 201/201 tests passing (was 189), clean production build (main JS 311.80 kB, was 304.74 kB).

**Browser verification (2026-09-27):** driven with Playwright (installed in a scratch directory, not a project dependency) against the running dev app. It used WebKit, Safari's engine, with iPhone 13 and iPhone SE emulation, plus desktop Chromium. Real `devicemotion` events carrying `rotationRate` were dispatched into the page at 60 Hz, so the full listener → filter → summary → UI path ran, not just the pure functions. iOS's `DeviceMotionEvent.requestPermission` was emulated. `devicemotion` listener registrations were counted to prove sampling actually stops. 21/21 checks passed:
- Criterion 1: an emulated iOS denial shows the "Motion access was declined…" message, the Start button returns, retrying works, no listener is left and no console errors.
- Criterion 2: a braced stream (σ 0.4°/s) → **Stable**, "Handheld at 1/15" at 21 mm, averaging 0.6°/s. A shaken stream (σ 12°/s) → **Unstable**, "1/500", averaging 16.3°/s. The live label shows while sampling.
- Criterion 3: exactly one listener while sampling, and zero after Stop, after completion, and after the page goes to the background (`visibilitychange` → hidden). Unmount stays covered by the effect cleanup plus the unsubscribe unit test.
- Desktop Chromium, which has `DeviceMotionEvent` but never fires it: the "isn't reporting gyroscope data" fallback appears after 1.5 s and releases the listener.
- 320px: no clipped text, no horizontal page scroll. Screenshots were inspected.

**Real-phone check (2026-09-27), which moved this to COMPLETE:** the user ran `npm run dev:phone` and a 10 s test on their own phone with a 24 mm lens. Motion access was granted from the tap, and real gyroscope data flowed and drew the trace. The result was **Stable**, averaging 1.7°/s, "Handheld at 1/30 or faster". That settles the two things emulation couldn't prove. Real iOS/phone permission-from-tap works. The units are degrees per second: 1.7°/s is a realistic still hand and sits on the 1.72°/s nominal-hand calibration, whereas radians per second would have read about 57× lower. A shaken run on the device wasn't separately reported. Braced-vs-shaken differentiation is proven through the same event path in the browser check above, and with the units confirmed the on-device behaviour follows.

Known limitations: the real-device denial path was checked only via the emulated iOS prompt. The trace shows the Start tap itself as a brief spike at the beginning of the test, which is included in the average and makes the result slightly conservative. A short settle-in period (e.g. dropping the first ~0.5 s) would remove it; noted as a possible refinement, not done.

---

**Feature #22 — Film Loading Trainer** (Phase 2) — **COMPLETE** (2026-09-27)

Sourcing (the reason this feature was sequenced last): the loading/unloading procedures were read from the manufacturer manuals themselves, not written from general knowledge:
- **M3**: Leica M3 Instruction Book (Ernst Leitz, Wetzlar), pp. 28–32. Scanned original from the butkus.us archive (cameramanuals.org mirror).
- **M6**: Leica M6 Instruction manual M6/EN/2022/10/1, pp. 25–29 (leica-camera.com). This is the current manual for the 2022 re-edition; the catalog's M6 entry is the 1984 original.
- **MP**: Leica MP Instruction manual, pp. 24–29 (leica-camera.com).
- **M-A**: Leica M-A Instructions, pp. 36–39 (leica-camera.com).
- **M4** (added 2026-09-26, follow-up pass): Leica M4 instruction booklet (Ernst Leitz GmbH, Wetzlar), pp. 20–21. Scanned original via butkus.org (cameramanuals.org). The M4 loads differently from the others: the back panel swings open by itself when the baseplate comes off (no separate open-back step), the frame counter springs back to 2 marks before 0 at the same moment, and the film end is pressed in between two of three loading prongs rather than pulled into a slotted spool. That needed one new catalog action, `seat-on-prongs`. The manual doesn't word a cartridge-removal step for unloading, so that step just says "Take out the cartridge."
- **M7** (added 2026-09-26): Leica M7 Bedienungsanleitung / Instructions (Leica Camera AG, German/English edition, 930 22 III/04), pp. 77–78. leica-camera.com no longer hosts it, so it's linked via the apotelyt.com mirror of the official PDF. Same sequence shape as the M-A (tension between the first and second wind), plus the DX-contact resistance notes.
- `UNSOURCED_FILM_BODY_IDS` is now empty. The unsourced-body path stays in the code for future catalog additions. 1 new test covers the M4's prong loading, its back opening with the baseplate, and its counter reset. The existing "every step physically possible" and random-tap fuzz tests cover both new bodies automatically. Validation after this pass: typecheck clean, lint 0 errors (5 pre-existing warnings), 222/222 tests, clean production build.

Implemented:
- `state/loadingTutorial.ts` (pure finite-state engine): mechanical state is never stored; `stateAt(tutorial, i)` folds step patches, so back-step and restart are just index changes. `attempt()` only advances on the expected action. Anything else returns `blocked`, with the physical reason from the action's `requires` (e.g. working the advance lever with the bottom cover off, citing the manuals' own warning), or `out-of-order`, with the correct next step. Both leave the index unchanged.
- `data/filmLoading.ts` (all body-specific content): a shared action catalog with mechanical preconditions, plus a load and an unload tutorial for each sourced body, each carrying a `published` provenance with source name, URL, pages and verified date. Real mechanical differences are modelled: the M3's removable take-up spool, clipping the leader and inserting cartridge and spool as a pair, the sprocket check, rewind-knob tensioning, and the counter returning to "2 marks before 0" on spool removal, versus the M6/MP/M-A fixed spool and counter reset on opening the bottom cover. The M-A's tensioning step comes between the first and second wind, exactly as its manual orders it. The counter is only shown where the manual states a value; elsewhere it shows "—" rather than an invented intermediate.
- `components/FilmLoadingTrainer.tsx`: body picker (defaults to the app's current body when sourced, otherwise M6), Load/Unload toggle, live mechanical-state readout (bottom cover, rear panel, M3 take-up spool, cartridge, rewind lever, shutter, counter), the current instruction with the previous step's manual note, an action palette in catalog order (so it doesn't give away the sequence), gentle feedback in an `aria-live` region, Back a step, Restart, and a linked source citation with pages. The existing synthesized advance and shutter sounds play on correct wind/release steps (muted by the existing mute control). Mounted after the stability trainer (`.stage-loading`).
- 13 new tests: every film body in the catalog is either covered or explicitly unsourced (never both); every tutorial cites a published source with pages and URL; every scripted step is physically possible in the state it runs from, which catches data mistakes in CI; load ends closed/loaded/counter 1 and unload ends with the cartridge out; the M3 uses the removable spool and the M6 doesn't; the engine advances only on the expected action, explains blocked actions, points out-of-order ones to the right step, and a 2,000-tap random fuzz never reaches an off-path state; back-step/restart and completion; palette order.

Validation: typecheck clean, lint 0 errors (same 5 pre-existing warnings), 214/214 tests passing (was 201), clean production build (main JS 330.39 kB, was 311.80 kB; mostly tutorial text, which could be lazy-loaded later if size matters).

**Browser verification (2026-09-27), which moved this to COMPLETE:** a Playwright script drove the running app on WebKit (iPhone 13 at 390px, iPhone SE at 320px) and on desktop Chromium. It covered all 12 tutorials (6 bodies × load/unload), stepped through using the actual tutorial data. For each tutorial it checked: one wrong tap gives feedback without advancing; completion text; the counter ends at 1 after loading; the source link matches the cited URL; Back a step and Restart work; no clipped text at any step; no horizontal page scroll; nothing spills out of the panel; no console errors. 213/213 checks passed after two fixes, and the screenshots were inspected:
- **Bug fixed, found by inspecting the screenshots:** step instructions (and the #9 result line) used `.gear-name`, which is single-line with an ellipsis, so on a phone most instructions were cut off after a few words. `styles.css` now lets `.gear-name` wrap inside `.loading-step` and `.stability-result`.
- **App-wide bug fixed:** at 320px the page scrolled sideways by 15px, caused by the Camera/Lens picker buttons (Phase 1), not this panel. The `.gear-buttons` grid column grew to fit the lens-scale thumbnail's min-content width. It's now `grid-template-columns: minmax(0, 1fr)`, and the long lens name ellipsizes as intended.

Known limitations: checked in WebKit emulation, not on a physical iPhone. The M3 and M4 sources are OCR'd scans; step order and warnings were read directly, but a few garbled OCR words were read in context.

## Next

- **#2:** the real-phone check (the only open Phase 3 item).
- **Phase 4** has no defined contents in the Master Plan. Scoping it is the user's call.
- Remaining unscheduled Priority 1 brief: **#13 Real-world light meter**. Browsers can't read a camera's real exposure; the brief itself allows manual EV or a clearly labelled estimate. Worth a scoping decision with the user first.

## Blockers

None currently recorded.

## Known limitations / verification required

- Live Leica View may currently be an alpha/v1 implementation rather than the final complete Feature #1 specification (unchanged from Phase 1).
- Mobile Safari / narrow-viewport verification: as of 2026-09-27 a working emulation path exists. Playwright's cached WebKit with iPhone device profiles (real `@media` breakpoints, touch, DPR), run from a scratch directory. The whole app has no horizontal overflow at 320/360/375/390px (the only offender, the gear-picker buttons, was fixed), and #9/#22 were checked in depth. Earlier panels (#3–#32) have not each had the same per-panel screenshot review, and nothing substitutes for a pass on a physical iPhone.
- #9's thresholds use the 1/focal-length rule as a proxy for "a nominal hand" and measure the phone held like a phone, not a rangefinder (different mass/grip). The UI states this, but it remains approximate by design.
- Phase 3 is in progress, starting with #2. The rest of Phase 3 (#5, #4, #25, #33, #35) has not started.

## Phase 3 — scope (started 2026-09-27; all but #2's phone check done)

Phase 3 contains the high-impact 3D / “WTF” work, including items such as:

- Virtual Leica full 3D body/lens
- cinematic lens swap
- Lens X-Ray / optical path
- Lens DNA
- Flare Lab
- 60-second WOW demo orchestration

These were started only after Phase 2 closed, at the user's request.

## Status update rules

Claude owns day-to-day maintenance of this file.

When a feature starts:
- change its status to `IN PROGRESS`
- update `Current task`

When a feature is fully validated:
- mark it `COMPLETE`
- check its checkbox
- update `Last completed`
- set `Next`
- STOP before starting the next feature

If only part of a feature is implemented:
- mark it `PARTIAL`
- document exactly what remains

If blocked:
- mark it `BLOCKED`
- document the blocker and the minimum decision/information needed
