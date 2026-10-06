# Phase 1 — Editor Shell Verification

**Status:** Completed. Scope: F1.1–F1.5.

## Baseline and automated checks

Verify shell layout, logical viewport, fitting and panel behavior together. The scene is 1600 × 900 logical units.

Original tests passed **6 files / 24 tests**, strict type checking and build. F1.1–F1.4 records/commits were complete; dependencies stayed unchanged.

## Browser matrix

| Browser | 1280 × 720 | 1440 × 900 | 1920 × 1080 |
|---|---|---|---|
| Chrome 153.0.8010.48 | Passed | Passed | Passed |
| Edge 154.0.4258.37 | Passed | Passed | Passed |

All combinations passed layout, proportional centered scene and application runtime checks. Edge at 1024 × 600 retained a 1280 × 720 workspace with two-axis page scrolling.

## Captures

- [Chrome 1280 × 720](../development/screenshots/f1.5/chrome/shell-1280x720.png)
- [Chrome 1440 × 900](../development/screenshots/f1.5/chrome/shell-1440x900.png)
- [Chrome 1920 × 1080](../development/screenshots/f1.5/chrome/shell-1920x1080.png)
- [Edge 1280 × 720](../development/screenshots/f1.5/edge/shell-1280x720.png)
- [Edge 1440 × 900](../development/screenshots/f1.5/edge/shell-1440x900.png)
- [Edge 1920 × 1080](../development/screenshots/f1.5/edge/shell-1920x1080.png)
- [Edge fallback](../development/screenshots/f1.5/edge/shell-1024x600-fallback.png)

## Observations and gate

The successful build reported 551.78 kB main JavaScript, above the default advisory. Chrome's local usage-statistics and external-extension-cache notices were unrelated to application resources/runtime. They did not invalidate the six checks.

Automated, browser and human acceptance passed. Original feature commit: `test: verify phase 1 editor shell`; annotated tag: `phase-1-editor-shell`.
