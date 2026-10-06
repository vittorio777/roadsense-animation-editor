# Phase 3 — Timeline and Movement Verification

**Status:** Completed. Human acceptance: 2026-09-29.

## Baseline and checks

Scope: F3.1–F3.11. In-app Chromium was the available browser, approved for this matrix. Earlier Chrome/Edge layout results belong to Phase 2 and are not new runs here.

Original scene: 1600 × 900, one historical car-blue, 0–10-second timeline with 0.1-second snapping, empty paths and no state editing/playback. Tests passed **25 files / 124 tests**, strict checking and build. Ten preceding records/commits were complete; dependencies/design documents were unchanged.

## Workflow

Start empty, add background/vehicle and verify zero point. Seek to 5 without mutation, edit position to create a point, select it, change time to 3.3 and coordinates to (1040, 540). Attempt occupied zero time and verify restored input/accessibly explained failure.

Integration continues through legal reorder, atomic conflict, nonzero deletion, selection cleanup, prior-point fallback and validation. Initial-point time/deletion protection remains.

## Matrix

| Viewport | Document | Result |
|---|---|---|
| 1280 × 720 | 1280 × 720 | Passed |
| 1440 × 900 | 1440 × 900 | Passed |
| 1920 × 1080 | 1920 × 1080 | Passed |
| 1024 × 600 | 1280 × 720, scrolling | Passed |

The same selected 3.3-second point at (1040, 540), editor time and visible conflict survived resizing. Formal sizes had no document overflow; logical coordinates remained fixed.

## Invariants

Seek preserves project reference. New-time edits create; same-time edits retain identity. Position changes retain time/count; time changes retain identity/position and sort. Duplicate rejection and protected-zero deletion are full no-ops. Nonzero deletion keeps current time, cleans subordinate IDs and resolves previous point.

Paths stayed empty at this stage; state data, metadata/assets and saved-editor-state exclusion stayed intact. Validator accepted legal data and rejected missing-zero/duplicate-time cases.

## Captures and limitations

The original accepted captures are:

- [1280 × 720](../development/screenshots/f3.11/chromium/movement-1280x720.jpg)
- [1440 × 900](../development/screenshots/f3.11/chromium/movement-1440x900.jpg)
- [1920 × 1080](../development/screenshots/f3.11/chromium/movement-1920x1080.jpg)
- [Fallback](../development/screenshots/f3.11/chromium/movement-1024x600-fallback.jpg)

The screenshot interface cropped the taller captures: requested 1440 × 900 produced 1440 × 810; 1920 × 1080 produced 1920 × 953. Full viewport/document measurements and accessibility observations support layout results separately from those images.

Console had no warnings/errors. The successful build retained 571.45 kB advisory. Phase gate passed; original commit `test: verify phase 3 timeline and movement`, tag `phase-3-timeline-movement`.
