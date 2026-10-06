# Phase 5 — Vehicle State Verification

**Status:** Completed. Human acceptance: 2026-09-30.

## Baseline and automated evidence

Scope: F5.1–F5.10. One historical car-blue, 0–10-second timeline and four state tracks, before persistence/playback/multiple vehicles.

[Integration tests](../../tests/phase5Integration.test.tsx): 5 passed. Full suite: **49 files / 336 tests**, strict checking and build passed. Nine prior records/commits and Phase 1–4 tags were verified; dependencies/stable documents were unchanged.

Independent test-local step and interval-scanning oracles check production values at exact/before/after/interior times, Boolean spans and both indicator bits. Finite, open and clipped projections agree without input mutation.

## Workflow and invariants

Create valid unique zero defaults, edit properties states, project lanes, create/move/resize/delete intervals, and recheck the current model after every change. Indicator overlap preserves both sides. Successful edits normalize boundaries; invalid/occupied/stale edits are full no-ops.

Only keyframes persist: no interval entities, selection, preview or viewport ends. State edits preserve motion/path references; movement regressions preserve states. Open/clipped 10-second display ends are not authored keyframes.

Browser at zero enabled Left and three Booleans; at 5 it switched Right and disabled Booleans. Four 0–5 finite spans and a right 5→continues appeared. Finite selection exposed handles/Delete. A fresh minimal reproduction verified collapse/expand without model changes.

## Actual browser matrix

| Requested | Measured content/document | Result |
|---|---|---|
| 1280 × 720 | 1280 × 720 | Passed |
| 1440 × 900 | 1440 × 852 content, no overflow | Passed |
| 1920 × 1080 | 1920 × 1032 content, no overflow | Passed |
| 1024 × 600 | 1024 × 552 content; 1280 × 720 document | Passed |

The browser reserved 48 px for its chrome at the larger/fallback sizes. Measurements use browser content dimensions. Controls, internal scrolling and state data stayed usable; console had no runtime errors.

## Process captures

- [Complete workflow](../development/previews/f5.10/process/1280x720-state-workflow.png)
- [Larger layout](../development/previews/f5.10/process/1440x900-state-workflow.png)
- [Wide layout](../development/previews/f5.10/process/1920x1080-state-workflow.png)
- [Fallback](../development/previews/f5.10/process/1024x600-scroll-fallback.png)

## Gate

Build advisory: 600.21 kB, successful build. Automated/browser/human gate passed. Original commit: `test: verify phase 5 vehicle states`; tag: `phase-5-vehicle-states`.
