# Phase 2 — Scene and Vehicle Verification

**Status:** Completed. Scope: F2.1–F2.7.

## Baseline

Original registered assets were intersection-01 and car-blue, with one vehicle, one zero-time point and no timeline editing. Historical identities describe that stage; F7.12 introduced the final models.

Original suite: **14 files / 55 tests**, strict checking and build passed. Six preceding records/commits, dependency stability and unchanged project documents were verified.

## Workflow and integrity

Each formal browser/size started empty, selected background, added the vehicle, selected it, entered out-of-bounds coordinates, checked X=60/Y=864 clamping, entered an interior position, deselected/reselected and dragged.

Scene outline and properties agreed; library showed Added and timeline remained a placeholder. The model retained scene dimensions, background reference, one stable zero-time point, empty paths and four initial state keyframes. Selection/resize were read-only; position edits changed only that point. Temporary time/selection remained outside project data and validation passed.

## Browser matrix

| Browser | 1280 × 720 | 1440 × 900 | 1920 × 1080 |
|---|---|---|---|
| Chrome 153.0.8010.48 | Passed | Passed | Passed |
| Edge 154.0.4258.37 | Passed | Passed | Passed |

Workflow, layout/scaling and application runtime passed in all six combinations. Document dimensions matched supported viewports; library/properties widths were 224/280 px, timeline height 208 px and the scene retained proportional scaling.

Edge 1024 × 600 fallback produced a 1280 × 720 document with page scrolling, preserved data and usable panels.

## Accepted captures

- [Chrome 1280 × 720](../development/screenshots/f2.7/chrome/scene-vehicle-1280x720.png)
- [Chrome 1440 × 900](../development/screenshots/f2.7/chrome/scene-vehicle-1440x900.png)
- [Chrome 1920 × 1080](../development/screenshots/f2.7/chrome/scene-vehicle-1920x1080.png)
- [Edge 1280 × 720](../development/screenshots/f2.7/edge/scene-vehicle-1280x720.png)
- [Edge 1440 × 900](../development/screenshots/f2.7/edge/scene-vehicle-1440x900.png)
- [Edge 1920 × 1080](../development/screenshots/f2.7/edge/scene-vehicle-1920x1080.png)
- [Edge fallback](../development/screenshots/f2.7/edge/scene-vehicle-1024x600-fallback.png)

## Observations and gate

The build advisory was 560.46 kB. Browser-generated favicon requests returned 404 while scripts, CSS and actual scene assets loaded. Headless verification used temporary profiles and SwiftShader; in-app pre-checks also passed.

Human acceptance confirmed workflow, matrix, invariants and fallback. Original commit: `test: verify phase 2 scene and vehicle`; tag: `phase-2-scene-vehicle`.
