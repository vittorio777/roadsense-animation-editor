# Feature Development Records

These records follow the complete existing Phase 1–7 MVP development sequence. Each feature records its requirement, scope, acceptance conditions, implementation, verification and human acceptance. Phase 0 has a foundation plan and feature inventory; the accepted snapshot has no separate F0.x development records.

Read records in phase order or use the [feature breakdown](../FEATURES.md). Early capability limits describe sequencing inside this MVP, not limitations of the finished editor.

Acceptance criteria retain original AC numbers. Repeated requirement/verification narration is consolidated while preserving conditions, meaningful design choices and recorded results. Test counts are historical feature-stage results. See the [process overview](../ENGINEERING_PROCESS.md) for the development workflow and [testing records](../testing/INDEX.md) for cross-feature gates.

## Record and evidence conventions

A record was created when work began and updated through acceptance. Features used one final feature commit; phase tags were placed on the gate commit. Original commit messages identify that private sequence; the clean public release does not reproduce it.

Screenshots under screenshots/ are original accepted captures. Images under previews/ are progress evidence; they do not replace final human acceptance. Original unavailable captures and cropped/narrow browser panels are disclosed in their records. Available media retains its original bytes and classification.

## Phase 1 — Editor shell

| Feature | Record | Status | Original commit message |
|---|---|---|---|
| F1.1 | [Editor Layout](F1.1-editor-layout.md) | Completed | `feat: add editor workspace layout` |
| F1.2 | [Scene Viewport](F1.2-scene-viewport.md) | Completed | `feat: add logical scene viewport` |
| F1.3 | [Scene Scaling](F1.3-scene-scaling.md) | Completed | `feat: scale scene to available viewport` |
| F1.4 | [Panel Layout Behaviour](F1.4-panel-layout-behaviour.md) | Completed | `feat: stabilize editor panel layout` |
| F1.5 | [Shell Verification](F1.5-shell-verification.md) | Completed | `test: verify phase 1 editor shell` |

## Phase 2 — Scene and vehicle

| Feature | Record | Status | Original commit message |
|---|---|---|---|
| F2.1 | [Background Selection](F2.1-background-selection.md) | Completed | `feat: add background selection` |
| F2.2 | [Vehicle Library](F2.2-vehicle-library.md) | Completed | `feat: add vehicle asset library` |
| F2.3 | [Add Vehicle](F2.3-add-vehicle.md) | Completed | `feat: add vehicle to scene` |
| F2.4 | [Vehicle Selection](F2.4-vehicle-selection.md) | Completed | `feat: add vehicle selection` |
| F2.5 | [Vehicle Dragging](F2.5-vehicle-dragging.md) | Completed | `feat: add vehicle dragging` |
| F2.6 | [Vehicle Properties](F2.6-vehicle-properties.md) | Completed | `feat: add vehicle position properties` |
| F2.7 | [Scene and Vehicle Verification](F2.7-scene-vehicle-verification.md) | Completed | `test: verify phase 2 scene and vehicle` |

## Phase 3 — Timeline and movement

| Feature | Record | Status | Original commit message |
|---|---|---|---|
| F3.1 | [Timeline Ruler](F3.1-timeline-ruler.md) | Completed | `feat: add timeline ruler` |
| F3.2 | [Playhead & Current Time](F3.2-playhead-current-time.md) | Completed | `feat: add timeline playhead` |
| F3.3 | [Timeline Snapping](F3.3-timeline-snapping.md) | Completed | `feat: add timeline snapping` |
| F3.4 | [Initial Movement Point](F3.4-initial-movement-point.md) | Completed | `feat: enforce initial movement point` |
| F3.5 | [Movement Point Creation](F3.5-movement-point-creation.md) | Completed | `feat: create movement points at current time` |
| F3.6 | [Movement Point Selection](F3.6-movement-point-selection.md) | Completed | `feat: synchronize movement point selection` |
| F3.7 | [Movement Point Position Editing](F3.7-movement-point-position-editing.md) | Completed | `feat: edit movement point positions` |
| F3.8 | [Movement Point Time Editing](F3.8-movement-point-time-editing.md) | Completed | `feat: edit movement point times` |
| F3.9 | [Movement Time Conflict](F3.9-movement-time-conflict.md) | Completed | `feat: handle movement time conflicts` |
| F3.10 | [Movement Point Deletion](F3.10-movement-point-deletion.md) | Completed | `feat: delete movement points` |
| F3.11 | [Movement Verification](F3.11-movement-verification.md) | Completed | `test: verify phase 3 timeline and movement` |

## Phase 4 — Movement paths

| Feature | Record | Status | Original commit message |
|---|---|---|---|
| F4.1 | [Default Bézier Path](F4.1-default-bezier-path.md) | Completed | `feat: create default bezier paths` |
| F4.2 | [Path Rendering](F4.2-path-rendering.md) | Completed | `feat: render movement paths` |
| F4.3 | [Path Selection](F4.3-path-selection.md) | Completed | `feat: add movement path selection` |
| F4.4 | [Control Point Editing](F4.4-control-point-editing.md) | Completed | `feat: edit bezier control points` |
| F4.5 | [Path Position Calculation](F4.5-path-position-calculation.md) | Completed | `feat: calculate bezier path positions` |
| F4.6 | [Path Direction & Rotation](F4.6-path-direction-rotation.md) | Completed | `feat: calculate bezier path rotation` |
| F4.7 | [Point Position Mutation](F4.7-point-position-mutation.md) | Completed | `feat: preserve path geometry on point movement` |
| F4.8 | [Point Insertion Mutation](F4.8-point-insertion-mutation.md) | Completed | `feat: split paths when inserting points` |
| F4.9 | [Point Time Reordering](F4.9-point-time-reordering.md) | Completed | `feat: rebuild paths after point time reordering` |
| F4.10 | [Point Deletion Mutation](F4.10-point-deletion-mutation.md) | Completed | `feat: reconnect paths after point deletion` |
| F4.11 | [Path Verification](F4.11-path-verification.md) | Completed | `test: verify phase 4 movement paths` |

## Phase 5 — Vehicle states

| Feature | Record | Status | Original commit message |
|---|---|---|---|
| F5.1 | [State Track Foundation](F5.1-state-track-foundation.md) | Completed | `feat: add state track foundation` |
| F5.2 | [Indicator Track](F5.2-indicator-track.md) | Completed | `feat: edit vehicle indicator states` |
| F5.3 | [Brake Light Track](F5.3-brake-light-track.md) | Completed | `feat: edit vehicle brake light states` |
| F5.4 | [Headlight Track](F5.4-headlight-track.md) | Completed | `feat: edit vehicle headlight states` |
| F5.5 | [Horn Track](F5.5-horn-track.md) | Completed | `feat: edit vehicle horn states` |
| F5.6 | [Initial State Keyframes](F5.6-initial-state-keyframes.md) | Completed | `refactor: centralize initial vehicle states` |
| F5.7 | [Vehicle State Timeline Hierarchy](F5.7-vehicle-state-timeline-hierarchy.md) | Completed | `feat: add vehicle state timeline hierarchy` |
| F5.8 | [State Interval Creation](F5.8-state-interval-creation.md) | Completed | `feat: create vehicle state intervals` |
| F5.9 | [State Interval Editing](F5.9-state-interval-editing.md) | Completed | `feat: edit vehicle state intervals` |
| F5.10 | [State Verification](F5.10-state-verification.md) | Completed | `test: verify phase 5 vehicle states` |

## Phase 6 — Persistence

| Feature | Record | Status | Original commit message |
|---|---|---|---|
| F6.1 | [Full Project Validation](F6.1-full-project-validation.md) | Completed | `feat: validate complete animation projects` |
| F6.2 | [JSON Serialization](F6.2-json-serialization.md) | Completed | `feat: serialize animation projects to json` |
| F6.3 | [Save Project](F6.3-save-project.md) | Completed | `feat: download animation project json` |
| F6.4 | [JSON Parsing](F6.4-json-parsing.md) | Completed | `feat: parse animation project json files` |
| F6.5 | [Asset Resolution](F6.5-asset-resolution.md) | Completed | `feat: resolve animation project assets` |
| F6.6 | [Load Project](F6.6-load-project.md) | Completed | `feat: load validated animation projects` |
| F6.7 | [Load Error Handling](F6.7-load-error-handling.md) | Completed | `feat: explain project load failures` |
| F6.8 | [Save/Load Round Trip Test](F6.8-save-load-round-trip.md) | Completed | `test: verify phase 6 persistence` |

## Phase 7 — Integration and preview

| Feature | Record | Status | Original commit message |
|---|---|---|---|
| F7.1 | [Multiple Vehicles](F7.1-multiple-vehicles.md) | Completed | `feat: support multiple vehicles` |
| F7.2 | [Cross-Panel Selection Sync](F7.2-cross-panel-selection-sync.md) | Completed | `feat: synchronize editor selection` |
| F7.3 | [Vehicle Deletion](F7.3-vehicle-deletion.md) | Completed | `feat: delete vehicles with confirmation` |
| F7.4 | [Movement Point Delete Confirmation](F7.4-movement-point-delete-confirmation.md) | Completed | `feat: confirm movement point deletion` |
| F7.5 | [Timeline Range & Navigation](F7.5-timeline-range-navigation.md) | Completed | `feat: add timeline range navigation` |
| F7.6 | [Preview Scene State Composition](F7.6-preview-scene-state-composition.md) | Completed | `feat: compose preview scene state` |
| F7.7 | [Preview Seek](F7.7-preview-seek.md) | Completed | `feat: seek preview scene` |
| F7.8 | [Preview Play](F7.8-preview-play.md) | Completed | `feat: play preview animation` |
| F7.9 | [Preview Pause](F7.9-preview-pause.md) | Completed | `feat: pause preview animation` |
| F7.10 | [Preview Integration](F7.10-preview-integration.md) | Completed | `feat: integrate preview vehicle states` |
| F7.11 | [Error & Empty States](F7.11-error-empty-states.md) | Completed | `feat: handle preview empty and error states` |
| F7.12 | [Vehicle Asset Variants](F7.12-vehicle-asset-variants.md) | Completed | `feat: add sedan and sport vehicle assets` |
| F7.13 | [MVP Scale Test](F7.13-mvp-scale-test.md) | Completed | `test: verify phase 7 mvp scale` |
| F7.14 | [Full MVP Acceptance](F7.14-full-mvp-acceptance.md) | Completed | `test: complete animation editor mvp acceptance` |
