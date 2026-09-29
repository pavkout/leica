# RANGEFINDER — CLAUDE CODE MASTER IMPLEMENTATION PROMPT
## Mission
You are working inside an existing web application called **Rangefinder / Depth of Field Studio**. It already has a polished dark UI with split-lens comparison, camera/lens selection, aperture, ISO, shutter speed, background distance, depth-of-field output and a rangefinder-style visualization. Your job is to evolve this codebase into a **Leica-inspired virtual camera system** that is useful to a real beginner/enthusiast with film and digital M bodies, while remaining technically honest about what is calculated versus approximated.
The target emotional bar is: a serious photographer should say “this is genuinely useful,” while a product/design person should say “how is this running in a browser?” The target practical use case is a user taking a meterless film body such as an M3 into the street and using the app to practice, meter, understand framelines/zone focus, log frames and avoid wasting film.
**Important:** this is an independent/unofficial project unless the repository explicitly contains licensing/partnership evidence. Use Leica model/lens names descriptively where already used, but do not add Leica logos, imply endorsement, or fabricate manufacturer data.
## Non-negotiable operating protocol
- **Do not start by rewriting the app.** First inspect the repository structure, package manager, framework, routes, state management, styling, existing math, tests, rendering strategy and deployment target.
- Before code changes, create or update a repository document such as `docs/rangefinder-master-plan.md` summarizing: current architecture, technical debt, reusable components, risks, and the exact staged migration plan.
- Preserve the existing visual quality and existing features. Introduce shared engines behind adapters and migrate one vertical slice at a time.
- After each vertical slice: run typecheck/lint/tests/build, add/update automated tests, and provide a short changelog with files changed and manual verification steps.
- Use feature flags for experimental live-camera, sensor, 3D, audio or AR capabilities.
- Every numerical/physical claim must be tagged internally as `calculated`, `published`, `measured`, `calibrated`, `approximate`, or `illustrative`. Never silently fabricate a value.
- If a browser API is unavailable, degrade gracefully and keep a manual path. The core simulator must never depend on camera, motion, haptics or WebGL.
- Optimize for mobile Safari as a first-class target, then Chromium desktop/mobile.
- Do not introduce a large dependency without explaining why, bundle cost, alternatives considered, and how it is lazy-loaded.
- Do not complete all phases in one giant PR. Produce the plan first, then implement the user-requested phase/vertical slice.

## Product model: four modes
| Mode | Job | Examples |
|---|---|---|
| SIMULATE | Understand cause → effect | exposure, DOF, motion, bokeh, lens character |
| LEARN | Practice a skill | rangefinder, Sunny 16, zone focus, film loading |
| SHOOT | Real-world companion | live camera, meter, intent assistant, roll log |
| EXPLORE | Tactile/product discovery | 3D body/lens, X-Ray, timeline, kiosk |

## Architecture that should exist after the foundation work

### 1. Single source of truth
Create a framework-appropriate `OpticalState` (name may adapt to repo conventions) containing at least:
- camera/body id
- lens family/revision id
- focal length
- aperture
- focus distance in meters (canonical internal unit)
- sensor/film format geometry
- film profile + box ISO + exposure index when relevant
- shutter duration in seconds
- scene EV / exposure compensation
- background distance
- shooting intent / locked constraints
- UI unit preference (m/ft) kept outside the canonical math values where possible

No renderer should own independent copies of these values. 2D simulation, live overlay, 3D model and training modes subscribe to the same state.

### 2. Pure calculation engines
Create pure, unit-tested modules for:
- exposure / EV / equivalent exposure
- field of view and crop
- depth of field, near/far limits, hyperfocal, magnification assumptions
- viewfinder/framel ine geometry and parallax approximation
- subject motion blur + camera-shake model
- rangefinder challenge geometry and scoring
- constraint solving for shooting intent
- film exposure response (separate from artistic rendering)

These engines must not import React/DOM/WebGL.

### 3. Catalog and provenance
Data structures should support:
- `CameraProfile`
- `ViewfinderProfile`
- `LensFamily`
- `LensRevision`
- `LensCharacterProfile`
- `FilmProfile`
- `Recipe`
- `Provenance` / confidence metadata

Suggested provenance shape:
```ts
type ProvenanceKind = 'calculated' | 'published' | 'measured' | 'calibrated' | 'approximate' | 'illustrative';
interface Provenance {
  kind: ProvenanceKind;
  sourceName?: string;
  sourceUrl?: string;
  notes?: string;
  lastVerifiedAt?: string;
}
```
Do not force this exact TypeScript if the app is not TypeScript; preserve the semantics.

### 4. Capability adapters
Abstract browser/device capabilities behind services:
- `CameraStreamService`
- `MotionSensorService`
- `HapticsService`
- `AudioService`
- `LocalPersistenceService`
- optional future `DepthEstimationService`

Each service exposes capability detection and a no-op/manual fallback.

### 5. Render layers
- existing 2D simulator
- live-camera overlay
- educational diagrams
- optional WebGL/3D renderer

Heavy renderers must be lazy loaded.

## Physics / fidelity requirements

1. **Exposure**: use standard EV relationships and keep shutter internally as seconds, aperture as f-number and ISO/EI explicit. Equivalent exposure combinations must be mathematically equivalent within rounding tolerance.
2. **DOF**: choose and document a circle-of-confusion policy by format. Make it configurable; do not hide the assumption. Handle far-limit → infinity correctly.
3. **FOV**: derive from sensor/film dimensions and focal length. If using Leica M 35 mm format, keep the actual format dimensions in data rather than hardcoding “full frame” strings into formulas.
4. **Rangefinder**: if exact finder baseline/magnification data is unavailable, keep the alignment model educational/normalized and label it. Do not invent service-calibration precision.
5. **Film**: separate capture exposure from development and aesthetic rendering. A film look is not a physical truth. Start with profiles and provenance, and allow later replacement by calibrated data.
6. **Lens character**: never claim exact bokeh/flare/microcontrast simulation without a measured/calibrated profile. Use “visual approximation” in UI when needed.
7. **3D internals/X-Ray**: call it schematic unless built from verified optical/mechanical data.

## Phase 0 — repository audit and foundation (DO THIS FIRST)
Deliver these items before implementing the spectacular features:
- A repo map: routes/pages, main simulator components, state/data flow, formula locations, styling system, test stack, build/deploy targets.
- A list of duplicated state/calculation logic and a safe consolidation plan.
- A canonical `OpticalState` and pure calculation layer, introduced incrementally without visual regressions.
- Golden tests for exposure equivalence, DOF, hyperfocal, FOV and any existing formulas.
- Versioned catalog schemas with at least one film body (M3-class), one digital body already present in the app (for example the existing M11 profile if it exists), one 50 mm lens, and one film profile placeholder with provenance.
- Feature flag mechanism for `liveView`, `filmMode`, `motionSensors`, `audioHaptics`, `threeD`, `experimentalLensCharacter`.
- A mobile layout audit and a concrete plan to translate the current desktop sidebar into mobile sheets/bottom controls.
- A performance baseline: main bundle, interaction latency, biggest assets and likely 3D budget.

## Priority label legend

Priority labels:
- Priority 1 = high-value / earlier implementation priority
- Priority 2 = secondary implementation priority
- Priority 3 = later / advanced implementation priority
- Priority 4 = long-term / exploratory implementation priority

**IMPORTANT: Priority numbers are NOT development phases.**

Development phases are separate roadmap milestones: Phase 0, Phase 1, Phase 2, Phase 3, Phase 4.

A Priority 1 feature is not automatically part of Phase 1. A Priority 2 feature is not automatically part of Phase 2. Feature completion must be determined from `PROJECT_STATUS.md` and the explicit milestone sections of this Master Plan.

## Feature implementation briefs (1–38)

### 1. Live Leica View  — Priority 1
**Goal:** Turn the phone into a live shooting companion that overlays the selected Leica body/lens behavior on the real camera feed. The goal is not to pretend the phone is optically identical to the Leica; it is to help the photographer make a better decision before exposing film or pressing the shutter.

**UX requirements**
- User selects body, lens and film/ISO, then enters LIVE mode from the simulator.
- Camera feed fills the screen with body-specific framelines, center rangefinder patch styling, exposure recommendation, focus/DOF card and motion-risk warning.
- A minimal “shoot card” shows aperture, shutter, ISO, estimated focus distance, near/far DOF and one concise recommendation.
- Allow quick lock of ISO/film so the user can walk around and only change aperture/focus intent.
- Provide a clear “simulation/estimate” badge for any value derived from phone sensors rather than direct Leica telemetry.

**Engineering requirements**
- Use getUserMedia for the video stream and keep all camera permissions user-initiated.
- Create an overlay coordinate system independent from the video DOM so framelines can be calibrated for aspect ratio, device orientation and safe areas.
- Share the same optical state object used by the desktop simulator: bodyId, lensId, aperture, focusDistanceM, iso, shutter, sceneEV, filmId.
- Implement a provider abstraction for metering/focus estimation so browser-only heuristics can later be replaced by native APIs or calibrated models.
- On iOS/Safari, design for progressive enhancement: live video + manual focus distance works even if depth estimation or sensor APIs are unavailable.

**Acceptance criteria**
- From a fresh session, user can choose M3 + 50 mm + ISO/film and reach live mode in <= 3 taps after permission.
- Overlay remains aligned in portrait/landscape and never blocks the central subject area unnecessarily.
- Changing aperture updates DOF instantly without restarting the stream.
- Unsupported sensor capabilities degrade gracefully with an explanatory label, never a broken control.

### 2. Virtual Leica — full 3D camera and lens  — Priority 3
**Goal:** A tactile, photorealistic 3D camera/lens experience where the physical object responds to the same optical state as the simulator. This becomes the emotional centerpiece of the product and the entry point to configuration, education and store/kiosk experiences.

**UX requirements**
- Rotate, zoom and inspect the body; tap a control to enter an interaction mode rather than accidentally moving the camera.
- Aperture ring, focusing ring, shutter-speed dial and film-advance interactions animate physically and update the simulation.
- On mobile, each detent can produce subtle haptic feedback where supported.
- Use cinematic but short transitions; every animation must remain interruptible so the UI never feels like a demo reel.

**Engineering requirements**
- Prefer glTF/GLB assets with physically based materials and a strict LOD budget.
- Use Three.js or React Three Fiber if compatible with the repository; otherwise keep the 3D renderer behind an adapter.
- Separate product-state animation from camera-orbit animation. The optical state remains source of truth; the 3D scene is a view of that state.
- Preload only the selected body/lens; lazy-load high-detail geometry and texture maps after first interaction.
- Add device-tier quality presets: full PBR, reduced reflections, and 2D fallback.

**Acceptance criteria**
- Initial 3D shell becomes interactive in under 2.5 seconds on a modern phone over a warm cache.
- Changing f-stop moves the physical ring and aperture iris in sync with the UI.
- 3D mode can be disabled without losing any core simulator functionality.
- Memory usage remains stable after swapping lenses repeatedly.

### 3. Physical aperture / iris visualization  — Priority 2
**Goal:** Show aperture as a physical iris rather than only as an f-number. The user should immediately see why changing from f/1.4 to f/8 changes light, depth of field and out-of-focus highlight shape.

**UX requirements**
- An iris diagram sits next to the aperture control and animates blade geometry between stops.
- Bokeh highlight preview updates beside it, with a label explaining that highlight shape is an approximation unless verified blade data exists.
- Allow “front view” and “through-lens” views for learning.

**Engineering requirements**
- Create a parametric iris renderer with bladeCount, bladeCurvature, rotation, maxOpening and stop.
- Keep blade metadata optional and provenance-tagged; use generic rounded 9-blade fallback when exact data is unavailable.
- Bind aperture area ratio to exposure engine and DOF state, not to an independent animation timeline.

**Acceptance criteria**
- Every supported aperture stop has deterministic geometry.
- Lens with unknown blade data is clearly labeled as generic approximation.
- Animation stays at 60 fps on mid-tier mobile hardware.

### 4. Lens DNA  — Priority 2
**Goal:** A structured visual fingerprint for each lens: what changes with aperture, focus distance and scene conditions. It should teach character without making false claims of laboratory precision.

**UX requirements**
- DNA panel contains sharpness tendency, vignetting, distortion, flare susceptibility, bokeh geometry, minimum focus and rendering notes.
- Aperture slider updates the visual previews and explanatory text.
- Comparison mode places two lenses side-by-side with the same scene and state.
- Every characteristic carries a confidence/provenance badge: measured, manufacturer-published, community-derived, or visual approximation.

**Engineering requirements**
- Define LensCharacterProfile separate from optical geometry data.
- Use compact lookup curves per aperture where measured data exists; otherwise use bounded heuristic values.
- Never bake marketing adjectives into the calculation engine; descriptive copy belongs in content data and must be sourceable/editable.

**Acceptance criteria**
- Lens DNA can render even when only geometric specs are available.
- Comparison keeps exposure/focus state synchronized between lenses.
- Unverified claims are not shown as objective measurements.

### 5. Lens X-Ray / optical path mode  — Priority 3
**Goal:** Reveal the internal lens groups and a simplified light path. This is an education and spectacle mode, not a full optical ray-tracing claim unless prescription data is available.

**UX requirements**
- Toggle X-RAY to fade the barrel while preserving glass groups and aperture.
- Animate focus-group movement when changing focus distance.
- Show representative rays from object to image plane, with a visible “schematic” badge unless based on verified optical prescription data.

**Engineering requirements**
- Use simplified optical group metadata for layout and motion.
- Keep ray visualization in a separate render layer so it can be disabled on weak devices.
- If exact element radii/refractive indices are unknown, do not infer them from marketing diagrams; use schematic group paths.

**Acceptance criteria**
- X-Ray can be toggled without reload.
- Focus animation and aperture animation remain synchronized with simulator state.
- UI explicitly distinguishes schematic from prescription-accurate modes.

### 6. Rangefinder Focus Challenge  — Priority 1
**Goal:** Turn rangefinder focusing into a repeatable game. Users learn patch alignment and the cost of small focus errors at wide apertures.

**UX requirements**
- Random scene target appears at a known virtual distance.
- User drags/rotates a virtual focus ring until ghosted patch images align, then presses SHOOT.
- Result shows target distance, selected distance, error in cm, DOF band and whether the target lands inside acceptable sharpness.
- Difficulty presets change focal length, aperture, subject distance, contrast and motion.

**Engineering requirements**
- Build a deterministic rangefinder parallax model for horizontal patch offset based on virtual focus error.
- Seed challenge RNG so tests and daily challenges are reproducible.
- Score based on physical focus error normalized by DOF, not arbitrary pixel alignment alone.

**Acceptance criteria**
- Same seed produces same target and scoring.
- At f/0.95 the tolerance is visibly and numerically tighter than at f/8.
- Keyboard, touch and pointer interactions all work.

### 7. Rangefinder calibration simulator  — Priority 3
**Goal:** Explain what vertical/horizontal rangefinder misalignment does and how focus error changes with focal length and distance. It must be educational and avoid presenting repair instructions as a substitute for professional service.

**UX requirements**
- Sliders introduce horizontal offset, vertical offset and baseline error into the simulated patch.
- Charts show resulting focus-plane deviation across focal length and subject distance.
- A “service note” explains that the simulator is diagnostic education, not a calibration procedure.

**Engineering requirements**
- Keep misalignment parameters isolated from normal focusing model.
- Use explicit units and include model assumptions in an info panel.
- Allow exporting a small diagnostic screenshot for discussion with a technician.

**Acceptance criteria**
- Zero offsets exactly match normal focus behavior.
- Changing focal length recalculates sensitivity immediately.
- No feature tells users to open or mechanically adjust the camera.

### 8. Motion Simulator  — Priority 1
**Goal:** Teach the difference between subject motion blur and camera shake using animated scene elements and shutter speed.

**UX requirements**
- Choose motion archetype: walking person, cyclist, car, train or custom angular speed.
- Shutter slider updates motion trail in real time.
- Two independent toggles: subject motion and camera shake.
- Freeze/blur threshold is described as a continuum rather than a binary truth.

**Engineering requirements**
- Use time integration or sample accumulation for motion blur preview.
- Drive camera-shake kernel from focal length and a tunable stability model.
- Render lower sample counts while dragging, then refine after input settles.

**Acceptance criteria**
- 1/1000 visibly freezes a walking subject compared with 1/15.
- Turning off camera shake leaves subject blur unaffected.
- Performance stays interactive during slider movement.

### 9. Phone gyroscope hand-stability trainer  — Priority 2
**Goal:** Use device motion to estimate how steadily the user is holding the phone and translate that into a practical shutter-speed learning signal.

**UX requirements**
- User enters a 5–10 second stability test with a selected focal length.
- Live trace shows angular movement and an easy label: stable, marginal, unstable.
- After the sample, the app suggests a conservative handheld shutter range and explains that this is personal/device-specific guidance, not a guarantee.

**Engineering requirements**
- Use DeviceMotion/DeviceOrientation when permission is available; request access only after user action.
- Normalize sensor sampling and filter high-frequency noise; store no raw motion data by default.
- Estimate angular blur on the image plane from focal length and exposure duration.

**Acceptance criteria**
- Feature handles iOS permission denial cleanly.
- Results change when the device is intentionally shaken versus braced.
- No sensor sampling continues after leaving the mode.

### 10. Film stock mode  — Priority 1
**Goal:** Model the practical behavior of film stocks—speed, latitude tendency, grain/contrast/color look—without reducing them to a social-media filter.

**UX requirements**
- Film becomes a first-class selection beside camera/lens.
- Exposure-latitude strip visualizes shadow loss and highlight tolerance across EV offsets.
- Preview contains grain, color response and contrast, all labeled as simulation unless calibrated from controlled scans.

**Engineering requirements**
- FilmProfile schema: boxISO, process, latitude model, grain parameters, tone curve, color transform, provenance.
- Keep exposure physics and film rendering separate: exposure engine determines scene exposure; film engine maps it to a visual response.
- Build the pipeline so future measured film profiles can replace heuristics without UI rewrites.

**Acceptance criteria**
- Switching film does not alter lens geometry or DOF.
- Changing exposure compensation shifts film response predictably.
- Every film profile exposes source/confidence metadata.

### 11. Push / Pull simulation  — Priority 2
**Goal:** Teach rating and processing changes as a system: metering at a different EI plus development compensation.

**UX requirements**
- User chooses box ISO, exposure index, and development intent (normal/push/pull).
- Preview and explanation update separately for exposure change and development effect.
- Show practical consequences: shadow placement, contrast, grain tendency, highlight density.

**Engineering requirements**
- Model EI as metering state, push/pull as film-development response parameters.
- Do not hardcode universal stop behavior across all stocks; allow per-film override curves.

**Acceptance criteria**
- Rating ISO 400 film at 1600 clearly shows -2 EV capture before push-development compensation.
- UI explains the distinction between exposure and development.
- Unsupported film/developer combinations fall back to generic educational mode.

### 12. Sunny 16 Trainer  — Priority 1
**Goal:** A fast drill mode for learning exposure estimation without a meter—especially useful for meterless film bodies.

**UX requirements**
- Present a scene/light condition, ISO and optional movement constraint.
- User selects aperture and shutter, then gets EV difference plus equivalent correct combinations.
- Daily streaks are optional; no dark patterns or compulsive mechanics.

**Engineering requirements**
- Generate scenarios from EV ranges rather than fixed memorized answers.
- Keep accepted tolerance configurable by training level.
- Use the same exposure equation as the main simulator.

**Acceptance criteria**
- Equivalent exposure pairs score equivalently.
- Questions cover bright sun through low-light cases.
- User can disable gamification and use pure practice mode.

### 13. Real-world light meter  — Priority 1
**Goal:** Provide a practical incident-like/reflective-style guidance tool from the phone camera, with transparent limitations. For a meterless Leica, this is one of the most directly useful features.

**UX requirements**
- Point the phone at the scene; show measured scene EV, recommended exposure and equivalent combinations.
- Allow tap-to-meter regions and highlight/shadow priority modes.
- Film users can apply exposure bias rules as configurable preferences, never as universal truths.

**Engineering requirements**
- Abstract metering so calibrated luminance mapping can evolve independently from UI.
- Use camera exposure metadata when browser/runtime exposes it; otherwise estimate from controlled camera settings and image luminance.
- Provide a calibration offset against a known meter/camera for users who want precision.

**Acceptance criteria**
- Recommendations remain stable for a static scene rather than oscillating wildly.
- Equivalent exposure table updates instantly when user locks an aperture or shutter.
- Calibration offset can be reset and is stored locally.

### 14. Intent-based shooting assistant (“What do you want?”)  — Priority 1
**Goal:** Translate photographic intent into constraints. Instead of asking a beginner to understand all settings first, ask the visual goal and explain the recommended trade-off.

**UX requirements**
- Intent cards: freeze motion, shallow background, maximum depth, low-light handheld, portrait, street/zone focus.
- Assistant returns one recommended starting point plus 2–3 alternatives with the trade-off explained.
- User can lock any parameter to say “I want f/2 no matter what” and the solver adapts the others.

**Engineering requirements**
- Build a constraint solver over exposure, aperture limits, shutter limits, ISO/film speed, focal length and target DOF.
- Keep recommendations deterministic and explainable; return reasons with every solution.
- Never use an opaque AI model for the core exposure solution; AI can later explain the deterministic result.

**Acceptance criteria**
- Locking aperture changes shutter recommendation but preserves exposure target when possible.
- If constraints cannot all be satisfied, the app says which constraint fails and why.
- Recommendation copy remains concise in shooting mode.

### 15. Zone Focus Mode  — Priority 1
**Goal:** Make the lens depth-of-field scale understandable and actionable. This should become a bridge from digital visualization to the markings on the real Leica lens.

**UX requirements**
- Linear distance ruler highlights near limit, focus point, far limit and hyperfocal distance.
- Preset buttons: 2 m street, 3 m street, hyperfocal, custom.
- Overlay the same numbers on a stylized focusing ring/DOF scale so the user can copy the setup to the physical lens.

**Engineering requirements**
- Use circle-of-confusion configurable by sensor/film format and a documented default.
- Handle infinity correctly; never display impossible finite far limits when denominator crosses zero.
- Add unit support m/ft without converting the underlying calculation state repeatedly.

**Acceptance criteria**
- Near/far values match independent DOF test fixtures within tolerance.
- Infinity behavior is mathematically correct.
- UI remains readable on a phone outdoors.

### 16. Interactive lens focusing-ring / DOF-scale trainer  — Priority 2
**Goal:** Teach the engraved distance and aperture scales found on manual-focus lenses by mirroring them interactively.

**UX requirements**
- Rotate the focus ring; the distance index and DOF marks move exactly as the virtual lens state changes.
- Tap an aperture marking to explain which distances are covered at that aperture.
- Optional “copy to real lens” card tells the user where to set focus and which aperture marks to use.

**Engineering requirements**
- Create a reusable scale-renderer driven by lens distance range, focus helicoid mapping and aperture marks.
- Allow lens-specific graphic skins but keep semantics accessible in HTML/text.

**Acceptance criteria**
- Distance state is bidirectional between ring and numeric input.
- Scale remains legible at narrow mobile widths.
- Unknown lens scale artwork falls back to generic semantic scale.

### 17. M3 viewfinder simulator  — Priority 1
**Goal:** Create a faithful educational representation of the M3 viewing experience: magnification, frame lines, rangefinder patch and parallax behavior.

**UX requirements**
- Full-screen “eye to finder” mode with minimal chrome.
- Changing lens focal length activates relevant frame-line behavior and shows what lies outside the frame.
- Near focus introduces parallax correction visualization and explains why the frame shifts.

**Engineering requirements**
- Define ViewfinderProfile per body: magnification, supported framelines, frame coverage assumptions, patch geometry, parallax model.
- Render line positions from geometry/calibration constants rather than screenshot overlays where possible.
- Separate educational fidelity from official certification; surface “calibrated/approximate” metadata.

**Acceptance criteria**
- 50 mm mode is visibly different from 90 mm framing.
- Parallax visualization changes with focus distance.
- Viewfinder can be used with synthetic scene and live camera feed.

### 18. Cross-body Leica viewfinder comparison  — Priority 2
**Goal:** Let users see the same scene through different M-system finder profiles to learn body ergonomics and framing differences.

**UX requirements**
- Side-by-side or swipe comparison between M3, M2/M4 family, M6/MP/M-A, and supported digital M bodies.
- Lock scene and lens; only finder geometry changes.
- Info panel explains magnification and frame-line availability.

**Engineering requirements**
- Reuse ViewfinderProfile and comparison split-view component.
- Load only profiles whose data is sourced or clearly approximated.

**Acceptance criteria**
- Comparison maintains exact same simulated scene crop/reference.
- Switching body never changes lens DOF/exposure unless body format genuinely differs.
- Metadata notes source/assumption for each finder.

### 19. Try Before You Buy — focal-length and lens trial  — Priority 2
**Goal:** A product-discovery tool: users can experience framing, DOF and practical handling consequences of a lens before buying it.

**UX requirements**
- Quick strip of focal lengths/lenses over live view or the simulator.
- Keep subject distance fixed and show framing change; optionally keep framing fixed and show required photographer distance.
- Show MFD and finder/frame-line compatibility warnings.

**Engineering requirements**
- Use lens geometric data + viewfinder profile; no need for full Lens DNA to ship useful v1.
- Add shareable comparison URL with serialized state.

**Acceptance criteria**
- User can compare 28/35/50/75/90 in seconds.
- Shared link recreates camera, lens, distance and scene state.
- Warnings are factual, not sales recommendations.

### 20. Virtual Leica Store / kiosk mode  — Priority 4
**Goal:** Transform the simulator into an in-store or event experience: configure body/lens, attach it virtually, then immediately try the finder/simulation.

**UX requirements**
- Large touch targets, guided flow, auto-reset after inactivity.
- Drag or tap a lens onto the body; short bayonet lock animation and mechanical click.
- After configuration, one tap enters TRY IT and shows the same simulator/live view.

**Engineering requirements**
- Create kiosk shell as a presentation layer over the same state engine.
- Add session timeout, offline asset cache and analytics hooks suitable for event deployments.
- Never hardwire retail inventory until an official data source exists.

**Acceptance criteria**
- Kiosk can run full-screen for hours without memory growth.
- Idle reset restores a clean home state.
- Core app and kiosk share feature code rather than fork.

### 21. Exploded camera view / mechanical education  — Priority 4
**Goal:** An interactive mechanical anatomy view showing major subsystems and the sequence of a shutter release. The point is understanding and appreciation, not service instructions.

**UX requirements**
- Explode/reassemble control with labels for top plate, finder, rangefinder, shutter, film gate, pressure plate, winding system.
- Slow-motion “fire shutter” sequence with a timeline scrubber.
- Click a part for a concise explanation and historical context.

**Engineering requirements**
- Requires specially authored 3D assets with component hierarchy.
- Animation state machine must be decoupled from optical simulation.
- Use simplified mechanisms where engineering drawings are unavailable and label as illustrative.

**Acceptance criteria**
- Parts never intersect visibly during explode/reassemble.
- Animation can be scrubbed and paused.
- No repair/adjustment steps are presented as instructions.

### 22. Film loading trainer  — Priority 2
**Goal:** A safe rehearsal of loading/unloading a classic Leica body before doing it with real film.

**UX requirements**
- Guided interactive sequence: open, remove baseplate/spool as applicable, place leader, engage transport, close, advance, confirm counter.
- Wrong actions produce gentle feedback and show the correct next state.
- Offer body-specific sequences rather than a generic film-camera workflow.

**Engineering requirements**
- Model it as a finite-state tutorial with optional 3D/2D visualizations.
- Content and state steps should be data-driven so bodies can be added without rewriting the engine.
- Validate instructional copy against the manufacturer manual or reliable service documentation.

**Acceptance criteria**
- User cannot skip into an impossible mechanical state accidentally.
- Restart and back-step are supported.
- Each body tutorial cites its source in the info panel.

### 23. Leica timeline / interactive museum  — Priority 4
**Goal:** A browsable history layer connecting cameras, eras, lenses and technology milestones to the simulator.

**UX requirements**
- Horizontal timeline with major bodies and optional lens milestones.
- Tap an item for 3D/2D object view, key specifications, historical notes and “simulate this” action where supported.
- Filters by era, film/digital, finder type and mount.

**Engineering requirements**
- Keep historical content in a versioned content dataset separate from code.
- Add citations/provenance fields so facts can be audited.
- Do not copy long copyrighted historical text; write concise original summaries.

**Acceptance criteria**
- Timeline can render with missing 3D assets using image/card fallback.
- Every factual historical note has provenance metadata.
- “Simulate this” only appears for models with sufficient data.

### 24. Lens generations / collector mode  — Priority 3
**Goal:** Differentiate versions of the same focal-length family rather than flattening everything into “50 mm Summicron.” This makes the tool collector-grade.

**UX requirements**
- Family view groups generations/versions with year range, optical revision, MFD, filter size, blade data, rendering notes and compatibility.
- Comparison can lock composition or lock photographer position.
- Collector badge is informational only. Market context is allowed only as cited comparables (see #38); never assign investment-value scores or predictions.

**Engineering requirements**
- Data model needs lensFamilyId and revisionId, with aliases for colloquial names.
- Rendering differences require provenance; use generic geometry when optical character is unknown.
- Create data validation to prevent conflicting spec units across revisions.

**Acceptance criteria**
- UI clearly distinguishes lens family from specific revision.
- Lens revision changes can alter geometric specs independently of marketing name.
- No fabricated historical/spec data.

### 25. Flare Lab  — Priority 3
**Goal:** Move a virtual bright source around the frame and demonstrate flare/ghosting tendencies, hood effects and aperture-dependent ghost shapes.

**UX requirements**
- Drag sun/light around scene; intensity and incident angle update in real time.
- Hood on/off and aperture control show how the artifact pattern may change.
- Profiles are marked measured/calibrated/artistically approximated.

**Engineering requirements**
- Begin with an artistic flare kernel system; architecture must allow measured profiles later.
- Do not call it physically accurate ray tracing unless using optical prescription and validated rendering.
- Keep HDR/glow passes bounded to avoid performance collapse on mobile.

**Acceptance criteria**
- Light-source movement produces smooth deterministic changes.
- Hood toggle changes only the flare model, not base exposure engine.
- Approximation label is visible in unsupported lenses.

### 26. Focus breathing / perspective lab  — Priority 3
**Goal:** Teach the difference between focusing-induced field-of-view changes and perspective changes caused by moving the camera.

**UX requirements**
- Two sliders: focus distance and camera distance.
- Overlay framing guides show breathing; a second mode moves camera position and demonstrates perspective shift.
- Side panel explains “focal length/focus” vs “camera position” in plain language.

**Engineering requirements**
- Breathing requires per-lens measured/estimated effective focal-length curve; default should be “not modeled” rather than invented.
- Perspective mode uses real pinhole projection with camera translation.

**Acceptance criteria**
- Lens without breathing data does not fake a numeric percentage.
- Perspective changes only when camera position changes.
- Comparison can be reset to identical framing.

### 27. Portrait distance trainer  — Priority 2
**Goal:** Help users learn how focal length, distance and minimum focus affect portrait framing, while optionally using AR/distance estimation where available.

**UX requirements**
- Choose desired framing: head, head-and-shoulders, half body, full body.
- App estimates required distance for selected lens and warns if inside MFD.
- Live mode can display a framing silhouette and distance target.

**Engineering requirements**
- Use a human-height assumption configurable by the user; keep it explicit.
- AR/depth APIs are optional enhancements; geometric calculation must work manually everywhere.
- Do not infer or identify the person in the camera feed.

**Acceptance criteria**
- Manual mode works without AR support.
- MFD warnings are exact from lens data.
- Framing guide scales correctly with viewport orientation.

### 28. Photo Recipes  — Priority 1
**Goal:** Offer explainable starting setups for common situations—night street, sunny Mediterranean, indoor window portrait—without presenting them as guaranteed exposure recipes.

**UX requirements**
- Recipe card includes body/lens archetype, film/ISO, aperture, shutter, focus strategy and “why this works.”
- One tap loads the recipe into simulator; user can then change conditions and see what breaks.
- Recipes can be saved and shared as state links.

**Engineering requirements**
- Treat recipes as content + constraints, not hard-coded scenes.
- Include target EV range so the app can warn when ambient conditions differ from the recipe.

**Acceptance criteria**
- Loading a recipe updates all relevant controls consistently.
- App warns if live metered EV is materially outside recipe range.
- Recipe copy is framed as a starting point.

### 29. My Leica Bag  — Priority 1
**Goal:** Personalize the whole app around the actual bodies, lenses and film stocks the user owns. This turns a broad database into a practical daily tool.

**UX requirements**
- Add gear from catalog to My Bag; pin favorites.
- Every selector offers “My Gear” first, with full catalog one tap away.
- Save default body/lens/film combinations and last-used configuration.

**Engineering requirements**
- Local-first storage with stable catalog IDs; cloud sync can come later.
- Migrations must survive catalog schema updates and renamed display labels.
- Import/export bag as JSON for backup and testing.

**Acceptance criteria**
- Bag persists across reloads.
- Deleting a catalog item from a future dataset does not corrupt user data; show archived item gracefully.
- User can clear all personalization easily.

### 30. Film Roll Companion  — Priority 1
**Goal:** Log the exposure metadata that film cameras cannot embed. Each frame becomes a learning record that can later be matched to scans.

**UX requirements**
- Start roll: body, lens, film, box ISO/EI, development intent.
- One-tap frame log records f-stop, shutter, focus estimate, EV, location optional, and a short note.
- Frame counter follows the roll; edits preserve history.
- Export roll as CSV/JSON and printable contact-sheet notes.

**Engineering requirements**
- Offline-first IndexedDB/local database; never require network while shooting.
- Optional location must be opt-in and coarse by default; app works fully without it.
- Data model should link future scan assets by rollId + frameNumber.

**Acceptance criteria**
- Logging a frame takes <= 2 taps when settings are unchanged.
- Roll survives offline reload and phone sleep.
- Export preserves exact frame order and settings.

### 31. Learn from your negatives / scan feedback loop  — Priority 2
**Goal:** Close the loop between what the user intended and what came back from the lab/scanner. The system should surface trends in missed focus, shake and exposure from user-tagged outcomes.

**UX requirements**
- Attach scan to roll/frame, then tag outcome: good, missed focus, motion blur, under/over, composition note.
- Insights page aggregates only the user’s own explicit tags and exposure metadata.
- Examples: “Most shake tags occur at 1/30 with 50 mm” or “Your successful night frames cluster around +0.7 EV relative to meter.”

**Engineering requirements**
- Start with transparent statistics; no image-analysis model is required for v1.
- If computer vision is added later, always distinguish automated suggestion from user-confirmed tag.
- Keep private photo data local by default or require explicit upload consent.

**Acceptance criteria**
- Insight statements link back to the frames that generated them.
- Small sample sizes show “not enough data” rather than overconfident advice.
- User can delete scans/metadata independently.

### 32. Mechanical sound system  — Priority 2
**Goal:** Give the app restrained mechanical tactility: aperture detents, lens mount click, shutter, film advance and rewind. The sound should support interaction, not become a toy.

**UX requirements**
- Subtle sounds fire only on meaningful detents/actions.
- Sound is disabled by default where autoplay policies require it and has a persistent mute control.
- Optional haptic pairing on supported devices.

**Engineering requirements**
- Use Web Audio for low-latency playback after user gesture unlock.
- Create an event-based sound map by body/lens; fall back to generic mechanical samples.
- Record or license sounds lawfully; track asset provenance.

**Acceptance criteria**
- No sound plays before user interaction/permission.
- Rapid dial movement rate-limits overlapping samples cleanly.
- Mute persists and is accessible.

### 33. Cinematic virtual lens swap  — Priority 3
**Goal:** Replace a plain lens dropdown transition with a brief physical M-mount detachment/attachment moment, while keeping the normal selector for speed.

**UX requirements**
- When “immersive transitions” is enabled, lens floats forward, rotates off mount, new lens aligns, rotates and clicks into place.
- Skip/interrupt with any user input.
- Fast mode changes instantly with no animation.

**Engineering requirements**
- Requires mount anchor points in 3D assets and a deterministic animation timeline.
- Preload target lens low-LOD before transition starts.
- Never block state changes on audio or animation completion.

**Acceptance criteria**
- Animation can be disabled globally.
- Interrupting halfway resolves to a valid final state.
- No visible asset pop-in after warm cache.

### 34. Darkroom mode  — Priority 4
**Goal:** Extend the film learning journey into development: time, temperature, agitation and push/pull can be explored as an educational model tied back to captured frames.

**UX requirements**
- Choose film, developer profile, dilution, temperature and target push/pull.
- Preview changes density/contrast/grain tendency and provides process notes.
- Timer/checklist mode can be a later, separate utility.

**Engineering requirements**
- Keep chemical/process data explicitly sourced and avoid inventing times.
- For v1, focus on conceptual simulation; real processing timers should only use verified manufacturer/community data with citations.
- Do not present safety-critical chemical handling shortcuts.

**Acceptance criteria**
- Unsupported film/developer pair does not fabricate a process time.
- Conceptual preview is clearly separated from actionable process instructions.
- Development state can link back to Film Roll Companion.

### 35. Signature 60-second “WOW” demo journey  — Priority 3/Priority 4
**Goal:** A polished, scripted-but-interactive one-minute experience designed for a portfolio, Leica meeting, event booth or social demo. It should compress the product thesis into one memorable flow.

**UX requirements**
- Open on a beautiful M3 in 3D; select a 50 mm lens and watch it mount.
- Enter viewfinder; align the rangefinder patch by turning focus.
- Change aperture; hear detents, watch iris close, DOF band change.
- Tap LIVE; the phone camera appears with M3-inspired framelines, metering and a zone-focus recommendation.
- Finish with “Take this setup outside” and save it as a shooting card/roll.

**Engineering requirements**
- Build this as an orchestrated route over production components, not a fake video.
- Preload only assets used by the demo and implement deterministic fallbacks when camera/sensor permissions are unavailable.
- Instrument each step for performance; the demo should never depend on network after initial load.

**Acceptance criteria**
- Full demo can be completed in under 60 seconds by a first-time user.
- Every step is interactive and also skippable.
- Offline/demo mode still works with a synthetic scene if camera permission is denied.

### 36. Long Exposure Lab (working name)  — Priority 3
**Goal:** Turn the app into a real-world long-exposure experiment. The screen shows a pure black field with one bright moving light; the user puts their real Leica on a tripod in front of the screen, sets a slow shutter speed and photographs it. The screen only ever shows the light at its current position — the camera builds the trail through exposure over time. It connects **animation time → shutter speed → physical photograph** and belongs to the LEARN and SHOOT modes: the app sends the user back to their actual camera.

Working name is open: alternatives include Light Painter, Long Exposure Playground, Light Trail Lab, Shutter Lab. Avoid names that imply Leica endorsement (see Mission).

**MVP**
- Fullscreen black stage with one bright moving point; all UI hidden while an experiment runs (Fullscreen API, controls fully hideable, tap/key to exit).
- Patterns: circle, infinity / figure-eight, horizontal sweep, vertical sweep, spiral, Lissajous; custom geometric paths from parameters.
- Controls: movement speed, point size, brightness, colour, pattern, cycle duration, loop / one-shot, plus a countdown start so the user can press the shutter first.
- Learning layer before each run: suggested starting settings (ISO, aperture, shutter, focal length, tripod, manual focus at the screen distance) and what to expect. Example — infinity, 4 s cycle: ISO 100, f/8, 4 s, tripod, manual focus; 1 s → partial pattern, 4 s → about one complete pattern, 8 s → repeated, brighter overlap.
- Screen-to-camera distance and framing suggested from the user's lens (focal length/FOV) via the existing field-of-view math.

**Later enhancements**
- Pattern Designer: draw a path with mouse/touch, SVG path import, geometric generator, text-to-path.
- Long-exposure text: the light draws words that appear only in the photograph (e.g. M3, SUMMILUX, 1954 — see the trademark note under experimental ideas).
- Multi-light mode: several points with different colours, speeds, trajectories and synchronized motion.
- Guided challenges, e.g. "capture the complete infinity in one exposure", "three separate circles without clipping highlights", "a word in a 10-second exposure", "ISO 100 vs ISO 800", "f/2 vs f/8" — optional, with no compulsive mechanics (same rule as the Sunny 16 Trainer).
- "Log this frame" into the Film Roll Companion, and compare the result with expectations via Learn From Negatives.

**Experimental ideas**
- Leica-inspired experiments: aperture-blade patterns, rangefinder-patch graphics, generic M-camera silhouettes, focal-length visualization patterns. Keep them tasteful and educational, not a gimmick.
- Leica red dot / logo geometry and the "LEICA" word mark are trademarks: per the Mission, do not ship them without explicit authorization. Prototype with generic geometry instead.
- Explaining refresh-rate / PWM artifacts (segmented or dotted trails) as a teaching moment about how screens actually emit light.

**Engineering requirements**
- Lightweight and client-side: Canvas 2D or WebGL, `requestAnimationFrame`, Fullscreen API, Screen Wake Lock API where supported (prevent sleep/dimming mid-exposure). No 3D engine needed; lazy-load the route.
- Timing must be predictable: drive position from elapsed time (`performance.now()`), never from frame count, so a pattern cycle lasts its stated duration regardless of refresh rate or dropped frames. Verify cycle-duration accuracy.
- Suggested settings come from the shared exposure engine. Screen luminance is unknown and varies widely by device and brightness setting, so the exposure suggestion is `approximate` and paired with "take a test frame, then adjust" guidance.
- Physics to teach honestly: with a black background, trail *length* is set by shutter time, but trail *brightness* is set by light brightness, point size and speed (dwell time per point), aperture and ISO — a longer exposure repeats the path rather than brightening a single pass. The background is only black if the screen is: LCD backlight bleed records as a glow in long exposures; OLED is truly black.
- Document display factors: refresh rate, OLED vs LCD, PWM brightness modulation, motion interpolation, screen brightness, browser fullscreen UI, device sleep.
- Respect reduced motion: the experiment only starts on an explicit user action, and the settings/learning screens work without animation.
- Desktop, tablet and phone support; the phone doubles as a small light source in front of the camera.

**Dependencies**
- Existing exposure engine and FOV math (settings and distance suggestions).
- My Leica Bag (#29), to personalize settings to the user's body and lens.
- Motion Simulator (#8), for the "what happens at 1/30, 1/8, 1 s, 4 s, 10 s, Bulb" theory before the real-camera experiment.
- Optional: Film Roll Companion (#30), Learn From Negatives (#31), Virtual Leica (#2) to demonstrate the shutter staying open.

**Relationship to the beginner-learning experience**
- Shutter-speed lessons (Motion Simulator, Intent Assistant "freeze motion") end with a "Try this with your real camera" link that opens Long Exposure Lab with a matching pattern and suggested settings.
- It extends the LEARN mode beyond the screen: Sunny 16, zone focus and film loading teach knowledge; this makes the user practise the shutter-speed concept on their own Leica and get a physical result they can compare with the prediction.

**Product value**
Moves the project from "a website that simulates Leica cameras" toward "an interactive Leica photography learning environment": digital simulator → photography theory → physical Leica camera → real photograph. It gets users to pick up their actual camera and experiment, which supports beginner education, the museum/exploration and kiosk directions, and a compelling live demonstration (e.g. an educational or retail setting).

**Acceptance criteria**
- A pattern cycle's real duration matches the selected duration within one display frame, across 60/120 Hz displays and after dropped frames.
- No UI, cursor or browser chrome is visible on the stage during a run (where the Fullscreen API allows); the screen doesn't sleep mid-exposure where Wake Lock is supported, and the user is warned where it isn't.
- Suggested settings come from the shared exposure engine and are labelled as a starting point, not a guaranteed exposure.
- Works with no camera or sensor permissions, since the user's own Leica is the only camera involved.

### 37. The camera is the interface ("hold a Leica")  — Priority 1
Added 2026-09-28 at the user's request. This supersedes the four-mode dial navigation as the app's home.

**Goal:** Using the app should feel like holding a Leica. The full screen is the camera, the image is always centre stage, and every setting is changed with a camera control. Every change shows in the image straight away: static scene, photo, or live camera.

**Decisions (user, 2026-09-28)**
- The interface follows the chosen body:
  - Digital Ms get a rear screen with an LCD info line, an ISO dial, and PLAY / FN / MENU.
  - Film Ms show the rangefinder viewfinder, with the shutter dial, film-advance lever and frame counter. A held "preview" shows the simulated exposure, labelled as simulated.
- Landscape first, held with two hands. Portrait works with a stacked layout.
- Live simulation goes all the way: brightness, ISO grain and shutter motion blur in real time. Depth of field on the live camera comes from an on-device depth model, is labelled approximate, and can be switched off.

**Controls (placed as on an M, sized for thumbs)**
- Top plate:
  - Shutter-speed dial with detents, including A where the body has it.
  - ISO dial on digital bodies.
  - Shutter release: half-press meters, full press shoots.
  - Film-advance lever on film bodies.
- Lens: aperture ring (click stops, engraved scale) and focus ring (tab, distance scale), with the depth-of-field scale between them.
- Back:
  - A thumb wheel for exposure compensation.
  - PLAY: review the roll or card.
  - FN: a configurable quick setting.
  - MENU: a Leica-style menu (black, list-based, red selection) holding everything that isn't a direct camera control. That covers scenes, film and sensor, trainers, labs, darkroom, timeline, 3D, and settings.

**Feedback**
- Turning any control updates the image within one display frame at interactive quality. Full quality follows when the control is released.
- Each control gives its mechanical sound (#32) and a short haptic tick where supported.
- A live exposure meter (the LEDs on film Ms, a scale on digital) responds to aperture, shutter, ISO and compensation.

**Live camera (#1 folded in)**
- The phone camera becomes the image source inside the same camera UI, never a separate screen.
- Brightness follows the exposure error from the meter. ISO adds grain and noise. The shutter builds up frames over time, so slow speeds smear movement.
- Depth of field comes from a depth model run in a Web Worker on a low-resolution frame a few times a second, so the UI never waits for it. Tap to focus sets the focus plane. Labelled approximate.

**Engineering requirements**
- One shared optical state (unchanged). Controls write to it; the image, meter, LCD and menu pages read from it.
- Change detection must not serialise image data. The render loop must be rAF-driven for live sources.
- Depth inference runs off the main thread and degrades gracefully: no WebGPU means the WASM path; no model means no live DOF, with a message.
- Every control is operable by keyboard and screen reader as a slider or button with its value, and works with reduced motion.

**Acceptance criteria**
- Changing aperture, focus, shutter, ISO or compensation updates the image in the next frame (≤ 1 display frame of input latency, measured) on the static scene and on photos. Live exposure changes land in the next frame.
- All existing features stay reachable through MENU; no feature is lost.
- Film and digital bodies present their own controls (lever and finder vs ISO dial, LCD and PLAY).
- Landscape phone: the image fills the height and the controls sit under the thumbs. No control is covered, and there's no page scrolling in camera view.
- Live DOF never blocks input. When depth is unavailable, the app says so and keeps everything else live.

### 38. Collector tools  — Priority 1
Added 2026-09-29 at the user's request. Design: `docs/superpowers/specs/2026-09-29-collector-tools-design.md`.

**Goal:** Serve collectors. Add items fast by serial or photo. Check a public listing (what it is, whether the serial is consistent, buyer red flags, a fair price). Value owned items. Sourced facts come first, and AI is labelled as AI.

**Decisions (user, 2026-09-29)**
- Cloud AI (Anthropic Claude) is acceptable. Users bring their own API key; a paid mode is a later, separate project.
- The user chooses the model (Haiku 4.5 / Sonnet 5 / Opus 5.5). A pricing table, a cost preview before each run and the actual cost after keep spend visible.
- Price suggestions cover both listing links and owned items, as cited comparables only.

**Structure (user, 2026-09-29):** Collectors is its own top-level MENU section, next to Simulate, Learn, Shoot and Explore. Its pages:
- My collection
- What is this? (photo)
- Before you buy (listing)
- Serial numbers
- AI helper

Old links to My collection and Serial numbers under Explore still open them.

**Audience:** people who are not technical. Each page does one job, with one clearly marked main action per step, plain words (costs in cents; "Sure / Fairly sure / Not sure"), and every disabled button says why.

**UX requirements**
- The serial auto-fills model, year, variant and batch size from the sourced serial tables, with the source shown. This works offline without a key.
- Photo → draft collection item. The user confirms before anything is saved, and the app never guesses unreadable serial digits.
- Listing check: identification, serial consistency, buyer red flags, and a price range with cited comparables (sold vs asking labelled). "Not enough data" with fewer than 3 comparables.
- Valuations are saved with date and sources, with history kept; an old valuation is marked stale.

**Engineering requirements**
- Client-side only: the browser calls the Anthropic API with the user's key, and listings and research use Claude's server-side web fetch/search tools.
- One adapter (`aiClient`) is the only code that calls Claude; the SDK is lazy-loaded.
- Sourced `serialFacts` and AI `aiFindings` are stored separately and never merged; conflicts are shown.
- Photos are downscaled with EXIF stripped before upload; the key is stored on the device only and can be deleted.
- AI output is validated against schemas and rendered as text only.

**Acceptance criteria**
- With no key, every non-AI collection feature still works, and AI buttons explain what is needed.
- Every price shown has a source link; no scores or predictions appear anywhere.
- Every AI run records its actual cost; a monthly limit, if set, is respected.
- A sourced fact is never overwritten by an AI reading; conflicts are visible.
- Tests never call the real API.

## First production milestone I want you to implement after Phase 0

Implement a coherent **M3 Film Companion vertical slice** before 3D:

1. **My Leica Bag** with one film body + one 50 mm lens + one film profile and generic catalog fallback.
2. **M3-style viewfinder simulator** with 50 mm and 90 mm educational frameline profiles plus rangefinder patch.
3. **Zone Focus** with correct near/far/hyperfocal math and a stylized lens distance/DOF scale.
4. **Sunny 16 Trainer** using the same exposure engine.
5. **Rangefinder Focus Challenge** with deterministic seed and scoring normalized by DOF.
6. **Film Mode v1**: box ISO/EI, exposure latitude visualization and clearly labeled approximate rendering.
7. **Film Roll Companion**: start roll, log frame, edit frame, export JSON/CSV, offline persistence.
8. **Live View alpha**: permission-gated camera stream + overlay + manual focus distance + exposure card. If reliable browser metering is not yet possible, allow manual EV or clearly label the estimate.
9. **Intent Assistant v1**: constraint solver for “freeze motion,” “shallow background,” “maximum depth,” and “street/zone focus.”

Definition of done for this milestone:
- Works on desktop Chromium and mobile Safari with graceful capability fallbacks.
- No regression to current comparison simulator.
- Math covered by unit tests.
- Core user path can be demonstrated without internet after the app is loaded.
- Every approximate behavior is labeled.
- A README/demo script explains a 2-minute walkthrough.

## Phase 2 milestone — tactile learning
After the M3 Film Companion is stable, implement: physical iris, focusing-ring trainer, gyro stability test, push/pull, cross-body finder comparison, portrait trainer, film-loading trainer, negative/scan feedback loop, and mechanical audio/haptics. Keep all of them behind stable shared state and data schemas.

## Phase 3 milestone — the “WTF” layer

Only after Phase 1/2 foundations are stable:
- Add 3D renderer as a lazy-loaded route/component, preferably glTF/GLB + PBR, with device quality tiers and 2D fallback.
- Bind physical aperture, focusing ring and shutter dial to `OpticalState`.
- Add cinematic but interruptible lens swap.
- Add X-Ray mode with a clear schematic/accurate distinction.
- Add Lens DNA and Flare Lab using provenance-aware profiles.
- Build the 60-second demo as an orchestration of production components, not as a separate fake animation.

Performance constraints:
- Do not load 3D engine/assets into users who never enter Explore/3D.
- Use LODs, compressed textures/meshes where supported, and dispose GPU resources on lens/body changes.
- Suspend render loop when offscreen/hidden.
- Maintain a no-WebGL core experience.

## Future milestone candidate — Photography Lab (not yet scheduled)

A possible umbrella for real-world practice modules, where the app sends the user to their own camera and compares the result with the simulator's prediction: motion blur, panning, depth of field, the exposure triangle, focusing, low light, light painting and shutter-speed experiments.

**Long Exposure Lab (#36)** is the natural first module: lightweight, client-side and independent of the 3D layer.

Placement:
- After Phase 3, alongside the long-term exploration work (timeline/museum, kiosk, exploded view, darkroom).
- Not ahead of the Phase 2/3 simulator and learning foundations it depends on: the exposure engine, My Leica Bag and the Motion Simulator.
- It should be scheduled explicitly in `PROJECT_STATUS.md` when chosen; it isn't part of any current milestone.

## UX details that matter

- Preserve the premium dark aesthetic shown in the current app, but reduce visual density on mobile.
- Red accent should communicate current selection/active mechanical state, not decorate everything.
- Use microcopy to teach in one sentence; put deep theory behind an info drawer.
- The central scene/viewfinder is sacred: avoid covering the subject with controls.
- Every “wow” animation must be interruptible and have a reduced-motion path.
- Mechanical sounds are optional, muted easily, and never autoplay before a user gesture.
- Add outdoor high-contrast mode for shooting use.
- All key values must be operable via keyboard and screen reader even when a visual 3D representation exists.

## Suggested test matrix

### Unit
- EV/equivalent exposure fixtures
- DOF/hyperfocal edge cases including infinity
- FOV fixtures by format/focal length
- zone-focus unit conversion round trips
- intent solver satisfiable/unsatisfiable constraints
- challenge scoring around DOF boundary
- film EI vs development separation

### Integration
- state synchronization between main simulator and comparison panel
- My Bag persistence/migration
- roll start/log/edit/export
- recipe load + state serialization
- live-view permission denied/accepted paths
- motion sensor unavailable path
- audio muted/unlocked path

### E2E
- phone-size M3 workflow: select gear → zone focus → start roll → log frame
- training workflow: Sunny 16 → focus challenge
- desktop comparison workflow remains intact
- live view survives orientation change
- experimental 3D route lazy-loads and returns cleanly

### Visual regression
- existing desktop screenshot baseline
- mobile simulator
- M3 viewfinder 50/90
- zone-focus ruler
- film latitude strip
- 3D fallback/loading/error states

## Data/privacy/security requirements

- Live camera frames should stay client-side unless the user explicitly triggers upload.
- Raw motion data should not be stored by default.
- Film roll metadata is local-first; optional sync must be opt-in.
- Location is optional, off by default, and not required for any core feature.
- Sanitize all imported/exported JSON and shared-state URLs.
- Do not allow user-provided catalog content to inject HTML/scripts.

## Deliverables I expect from you before claiming a phase is complete
- Repository-specific implementation plan with file/module names.
- Code changes in small coherent commits or clearly described groups.
- Automated tests and the exact commands used to run them.
- Build/typecheck/lint status.
- Manual verification checklist for desktop + mobile.
- Before/after screenshots for major UI work when possible.
- Known limitations, especially where behavior is approximate or browser-dependent.
- Performance impact and any new dependencies.
- Next recommended vertical slice, but do not start it unless requested.

## Failure modes to actively avoid
- Rewriting the app into a new framework because it is convenient.
- Copying optical formulas into multiple UI components.
- Using arbitrary blur CSS as if it were an exact lens simulation.
- Inventing Leica specifications, optical prescriptions, blade counts, film latitude values or finder geometry.
- Loading Three.js/3D assets on the initial route before they are needed.
- Making live camera/sensors mandatory for core functionality.
- Creating beautiful animations that block fast operation.
- Building a monolithic “AI photographer” that hides deterministic exposure math.
- Collecting camera/location/photo data without explicit user intent.
- Calling the project official or Leica-endorsed without authorization.

## Your first response to this prompt
Do **not** immediately implement the 35 features. First inspect the repository and reply with: (1) architecture map, (2) what already exists that can be reused, (3) the safest Phase 0 refactor plan, (4) the first M3 Film Companion vertical slice broken into concrete tasks/files/tests, (5) risks/unknowns, and (6) any exact questions that truly block implementation. Then begin Phase 0 only after the plan is internally coherent.
