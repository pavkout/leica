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

**Feature #16 — Interactive Focusing Ring / DOF Scale Trainer**

Status: **NOT STARTED**

Claude must read Feature #16 in `RANGEFINDER_MASTER_PLAN.md` before implementation, and must not start it until the user says to proceed (one-feature-at-a-time rule).

## Phase 2 checklist

- [x] **#3 — Physical Aperture / Iris Visualization** — COMPLETE
- [ ] **#16 — Interactive Focusing Ring / DOF Scale Trainer** — NOT STARTED
- [ ] **#9 — Phone Gyroscope Hand-Stability Trainer** — NOT STARTED
- [ ] **#11 — Push / Pull Simulation** — NOT STARTED
- [ ] **#18 — Cross-body Leica Viewfinder Comparison** — NOT STARTED
- [ ] **#27 — Portrait Distance Trainer** — NOT STARTED
- [ ] **#22 — Film Loading Trainer** — NOT STARTED
- [ ] **#31 — Learn From Negatives / Scan Feedback Loop** — NOT STARTED
- [ ] **#32 — Mechanical Audio + Haptics** — NOT STARTED

## Recommended Phase 2 order

1. #3 — Physical Aperture / Iris Visualization
2. #16 — Interactive Focusing Ring / DOF Scale Trainer
3. #9 — Phone Gyroscope Hand-Stability Trainer
4. #11 — Push / Pull Simulation
5. #18 — Cross-body Leica Viewfinder Comparison
6. #27 — Portrait Distance Trainer
7. #22 — Film Loading Trainer
8. #31 — Learn From Negatives / Scan Feedback Loop
9. #32 — Mechanical Audio + Haptics

This order may change if repository dependencies make another sequence safer. If so, Claude must explain and update this file.

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

## Next

Start **Feature #16 — Interactive Focusing Ring / DOF Scale Trainer**.

Do not begin it automatically — wait for the user to say proceed.

Note for whoever picks up #16: `LensBarrel.tsx` already implements the drag-interactive focus ring and engraved DOF scale (built in Phase 1, reused by Live View's shoot card too). What the Master Plan's #16 UX adds on top is per-aperture-stop explanation text and a "copy to real lens" summary — likely a light addition near the existing lens-barrel panel, not a new ring component. Worth re-reading `LensBarrel.tsx` and the Zone Focus preset buttons in `App.tsx` (`stage-barrel` panel) before designing #16, so it doesn't duplicate work already done in Phase 1's Zone Focus slice.

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
