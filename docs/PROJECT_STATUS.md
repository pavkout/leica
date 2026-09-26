# Rangefinder — Project Status

Last updated: 2026-09-26

## Current state

| Phase | Status |
|---|---|
| Phase 0 — Repository Audit & Foundation | ✅ COMPLETE |
| Phase 1 — M3 Film Companion | ✅ COMPLETE |
| Phase 2 — Tactile Learning | 🟡 IN PROGRESS |
| Phase 3 — “WTF” / 3D Layer | ⬜ NOT STARTED |
| Phase 4 — Explore / Kiosk / Museum | ⬜ NOT STARTED |

> Phase 0 and Phase 1 were verified directly against the repository (typecheck/lint/test/build all clean, 126 tests passing before this session's work) before Phase 2 began.

## Current phase

**Phase 2 — Tactile Learning**

## Current task

**Feature #18 — Cross-body Leica Viewfinder Comparison**

Status: **NOT STARTED**

Claude must read Feature #18 in `RANGEFINDER_MASTER_PLAN.md` before implementation, and must not start it until the user says to proceed (one-feature-at-a-time rule).

## Phase 2 checklist

- [x] **#3 — Physical Aperture / Iris Visualization** — COMPLETE
- [x] **#16 — Interactive Focusing Ring / DOF Scale Trainer** — COMPLETE
- [x] **#11 — Push / Pull Simulation** — COMPLETE
- [x] **#27 — Portrait Distance Trainer** — COMPLETE
- [x] **#31 — Learn From Negatives / Scan Feedback Loop** — COMPLETE
- [ ] **#18 — Cross-body Leica Viewfinder Comparison** — NOT STARTED
- [ ] **#32 — Mechanical Audio + Haptics** — NOT STARTED
- [ ] **#9 — Phone Gyroscope Hand-Stability Trainer** — NOT STARTED
- [ ] **#22 — Film Loading Trainer** — NOT STARTED

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

## Last completed

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

## Next

Start **Feature #18 — Cross-body Leica Viewfinder Comparison**.

Do not begin it automatically — wait for the user to say proceed.

## Blockers

None currently recorded.

## Known limitations / verification required

- Live Leica View may currently be an alpha/v1 implementation rather than the final complete Feature #1 specification (unchanged from Phase 1).
- Mobile Safari / narrow-viewport verification remains outstanding across the whole app, not just Feature #3 — this environment cannot currently force a narrow browser viewport (`resize_window` no-ops; a CSS-zoom workaround was tried previously and doesn't affect `@media` breakpoints either). Needs a real device or a working device-emulation tool.
- Phase 3 / Virtual Leica Full 3D has not started and must not be pulled into Phase 2 accidentally.

## Phase 3 — explicitly not started

Phase 3 contains the high-impact 3D / “WTF” work, including items such as:

- Virtual Leica full 3D body/lens
- cinematic lens swap
- Lens X-Ray / optical path
- Lens DNA
- Flare Lab
- 60-second WOW demo orchestration

Do not start these while Phase 2 is active unless explicitly requested by the user.

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
