# CLAUDE.md — Rangefinder Project Operating Rules

## Purpose

This repository is developed against two project documents:

- `docs/RANGEFINDER_MASTER_PLAN.md` — long-term product/engineering specification.
- `docs/PROJECT_STATUS.md` — current implementation state and the only day-to-day project tracker.

The user should not need to manually synchronize the roadmap with the codebase.

## Mandatory startup procedure

At the beginning of every new Claude Code session:

1. Read this file completely.
2. Read `docs/PROJECT_STATUS.md` completely.
3. Read only the relevant sections of `docs/RANGEFINDER_MASTER_PLAN.md` for the current phase/current feature.
4. Inspect the actual repository state before assuming the status file is correct:
   - `git status`
   - recent commits
   - relevant files/components/tests
5. Briefly state:
   - current phase
   - current feature
   - what is already complete
   - exact scope you are about to work on
6. Then work only on the current feature/vertical slice.

Do not re-run or redo completed phases unless an actual regression or missing dependency is found.

## Source-of-truth hierarchy

When documents disagree, use this order:

1. Actual working repository + tests
2. `docs/PROJECT_STATUS.md` for progress/state
3. `docs/RANGEFINDER_MASTER_PLAN.md` for product requirements and acceptance criteria
4. Old chat/session assumptions

If `PROJECT_STATUS.md` does not match the codebase, report the mismatch and correct the status file before continuing.

## One-feature-at-a-time rule

Never implement an entire phase in one pass.

Work on exactly one current feature/vertical slice at a time.

For the current feature:

1. Read its full specification in the Master Plan.
2. Inspect existing reusable code.
3. Reuse shared state/calculation engines/catalog/capability adapters.
4. Implement the smallest coherent production-ready vertical slice.
5. Add/update tests.
6. Run validation.
7. Update `PROJECT_STATUS.md`.
8. STOP.

Do not automatically start the next feature.

## Completion rule

A feature may be marked `COMPLETE` only when all applicable items below are true:

- acceptance criteria from the Master Plan are satisfied
- typecheck passes
- lint passes
- relevant unit/integration/E2E tests pass
- production build passes
- existing functionality has not regressed
- mobile behavior has been checked where relevant
- known limitations are documented

If some acceptance criteria are intentionally deferred, mark the feature `PARTIAL`, not `COMPLETE`.

## PROJECT_STATUS.md maintenance

After every completed or paused vertical slice, update `docs/PROJECT_STATUS.md`.

Update:

- `Last updated`
- `Current phase`
- `Current task`
- feature status: `NOT STARTED`, `IN PROGRESS`, `PARTIAL`, `BLOCKED`, or `COMPLETE`
- `Last completed`
- `Next`
- blockers
- known limitations
- short implementation note if useful

Do not rewrite the history unnecessarily.

## Master Plan protection

`docs/RANGEFINDER_MASTER_PLAN.md` is the long-term specification.

Do NOT modify it during normal feature implementation.

Only modify the Master Plan when the user explicitly asks to change the product specification, roadmap, architecture, or feature definitions.

Implementation progress belongs in `PROJECT_STATUS.md`, not the Master Plan.

## Phase boundaries

The current roadmap phases are defined by the Master Plan.

Do not start a later phase simply because an individual feature looks interesting.

In particular:

- Do not start Phase 3 / 3D / WTF-layer work while Phase 2 is still active unless the user explicitly overrides the roadmap.
- Do not pull unrelated future features into the current feature implementation.
- Shared foundations may be improved only when required by the current feature.

## Priority vs. phase terminology

Never interpret Priority 1/2/3/4 as Phase 1/2/3/4.

Priority describes feature priority only (see the legend in the Master Plan). Phase describes the current development milestone. PROJECT_STATUS.md determines what is currently being implemented.

## Engineering rules

Preserve the existing application and architecture unless a change is justified.

Important principles:

- `OpticalState` remains the shared source of truth.
- Optical/exposure/DOF calculations remain in pure reusable engines.
- Do not duplicate optical formulas inside UI components.
- Respect provenance: calculated / published / measured / calibrated / approximate / illustrative.
- Do not fabricate Leica specifications or optical data.
- Mobile Safari is a first-class target.
- Camera, gyroscope, haptics, audio, WebGL and other device capabilities must degrade gracefully.
- Heavy/experimental capabilities should be lazy-loaded when appropriate.
- Preserve accessibility and reduced-motion behavior.
- Do not silently introduce large dependencies.

## End-of-task report

When the current feature is finished or paused, report only what the user needs:

1. What was implemented
2. Validation results
3. Any known limitations/blockers
4. What `PROJECT_STATUS.md` now says
5. What the next feature is

Then stop and wait for the user.

## Default user command

If the user says:

> Continue the Rangefinder project.

or:

> Continue with the current task.

Interpret it as:

1. Follow the mandatory startup procedure.
2. Work only on the current task in `docs/PROJECT_STATUS.md`.
3. Update project status when done.
4. Do not start the next task automatically.
