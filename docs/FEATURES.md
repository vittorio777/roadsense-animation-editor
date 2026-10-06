# MVP Feature Breakdown

The delivery plan was split into independently verifiable features. This inventory retains all Phase 0–7 units and links every existing feature record. Detailed criteria were written when that feature began; [engineering rules](ENGINEERING_RULES.md) governed scope changes and acceptance.

## Phase 0 — Foundation

- **F0.1 — Project initialization:** Create the independent Vite/React/TypeScript project with strict checking and Tailwind.
- **F0.2 — Git setup:** Establish the repository, ignore rules, initial branch and first stable commit.
- **F0.3 — Editor dependencies:** Install and verify React Konva, Zustand and Vitest.
- **F0.4 — Project structure:** Establish the agreed editor, model, store, path, persistence and assets directories.
- **F0.5 — Core data model:** Implement contract-aligned project, scene, vehicle, movement, path and state types.
- **F0.6 — Editor store foundation:** Separate persistent animation data from temporary editor state in a minimal store.
- **F0.7 — Asset registry:** Define static assets and assetId lookup.
- **F0.8 — Initial project validator:** Accept valid minimal data and reject obvious invalid projects.
- **F0.9 — Foundation verification:** Run type checking, tests and build to complete the foundation gate.


## Phase 1 — Editor shell

- **[F1.1 — Editor Layout](development/F1.1-editor-layout.md)**: Build the initial workspace with a toolbar, object library, scene, properties and timeline.
- **[F1.2 — Scene Viewport](development/F1.2-scene-viewport.md)**: Replace the scene placeholder with a React Konva Stage and Layer, reading logical width and height directly from the current project.
- **[F1.3 — Scene Scaling](development/F1.3-scene-scaling.md)**: Fit the scene uniformly into measured space while keeping logical coordinates unchanged.
- **[F1.4 — Panel Layout Behaviour](development/F1.4-panel-layout-behaviour.md)**: Keep desktop panels usable and provide a scrolling fallback below the minimum workspace.
- **[F1.5 — Shell Verification](development/F1.5-shell-verification.md)**: Verify the assembled shell across the original browser and viewport matrix.

## Phase 2 — Scene and vehicle

- **[F2.1 — Background Selection](development/F2.1-background-selection.md)**: Choose a registered background, persist its asset ID and display it over the logical scene.
- **[F2.2 — Vehicle Library](development/F2.2-vehicle-library.md)**: Display registered vehicles in a read-only Vehicles section.
- **[F2.3 — Add Vehicle](development/F2.3-add-vehicle.md)**: Add a complete registered vehicle to the scene.
- **[F2.4 — Vehicle Selection](development/F2.4-vehicle-selection.md)**: Click a vehicle to select it and synchronize scene and read-only properties through selection.objectId.
- **[F2.5 — Vehicle Dragging](development/F2.5-vehicle-dragging.md)**: Vehicle Dragging.
- **[F2.6 — Vehicle Properties](development/F2.6-vehicle-properties.md)**: Vehicle Properties.
- **[F2.7 — Scene and Vehicle Verification](development/F2.7-scene-vehicle-verification.md)**: Scene and Vehicle Verification.

## Phase 3 — Timeline and movement

- **[F3.1 — Timeline Ruler](development/F3.1-timeline-ruler.md)**: Create the default linear 0–10-second ruler as the foundation for timeline editing.
- **[F3.2 — Playhead & Current Time](development/F3.2-playhead-current-time.md)**: Click the ruler or blank track surface to set temporary currentTime, with a synchronized playhead and readout.
- **[F3.3 — Timeline Snapping](development/F3.3-timeline-snapping.md)**: Snap timeline clicks to the nearest 0.1 second while preserving arbitrary valid precision in animation data and direct store time updates.
- **[F3.4 — Initial Movement Point](development/F3.4-initial-movement-point.md)**: Verify every new vehicle immediately has one zero-time point at its logical spawn position, regardless of playhead time.
- **[F3.5 — Movement Point Creation](development/F3.5-movement-point-creation.md)**: Create a movement point only when position is actually changed at a new time.
- **[F3.6 — Movement Point Selection](development/F3.6-movement-point-selection.md)**: Select an existing point from scene or timeline through one temporary selection identity, aligning time and both views.
- **[F3.7 — Movement Point Position Editing](development/F3.7-movement-point-position-editing.md)**: Edit an explicitly selected point by stable identity through marker drag or properties, preserving its time and count.
- **[F3.8 — Movement Point Time Editing](development/F3.8-movement-point-time-editing.md)**: Edit non-initial arrival times by horizontal timeline drag or properties while preserving identity/position and ordering.
- **[F3.9 — Movement Time Conflict](development/F3.9-movement-time-conflict.md)**: Explain duplicate arrival times and reject them atomically, allowing immediate correction.
- **[F3.10 — Movement Point Deletion](development/F3.10-movement-point-deletion.md)**: Delete non-initial points while preserving the zero-time invariant and consistent views.
- **[F3.11 — Movement Verification](development/F3.11-movement-verification.md)**: Verify the assembled timeline/movement workflow and prior ten feature records before path work.

## Phase 4 — Movement paths

- **[F4.1 — Default Bézier Path](development/F4.1-default-bezier-path.md)**: Create default cubic paths between adjacent chronologically ordered points.
- **[F4.2 — Path Rendering](development/F4.2-path-rendering.md)**: Draw stored cubic paths in logical scene coordinates without adding editing or motion calculation.
- **[F4.3 — Path Selection](development/F4.3-path-selection.md)**: Select a rendered path as the vehicle's exclusive subordinate selection, with highlighting and read-only properties.
- **[F4.4 — Control Point Editing](development/F4.4-control-point-editing.md)**: Drag the selected path's two controls, redraw live and show read-only coordinates.
- **[F4.5 — Path Position Calculation](development/F4.5-path-position-calculation.md)**: Provide a typed pure cubic-position function from the same geometry used by rendering.
- **[F4.6 — Path Direction & Rotation](development/F4.6-path-direction-rotation.md)**: Calculate the cubic derivative and signed screen-coordinate direction through pure shared functions.
- **[F4.7 — Point Position Mutation](development/F4.7-point-position-mutation.md)**: Move an existing point and update connected resolved endpoints without rebuilding paths or translating controls.
- **[F4.8 — Point Insertion Mutation](development/F4.8-point-insertion-mutation.md)**: Insert at a new time through existing vehicle-position editing, maintaining chronological adjacency.
- **[F4.9 — Point Time Reordering](development/F4.9-point-time-reordering.md)**: Preserve all path geometry when a time edit retains order; otherwise synchronize the new directed adjacency without reusing reversed paths.
- **[F4.10 — Point Deletion Mutation](development/F4.10-point-deletion-mutation.md)**: Maintain path topology when deleting non-initial points.
- **[F4.11 — Path Verification](development/F4.11-path-verification.md)**: Verify creation, editing and every point mutation against one geometry definition before the state-authoring phase.

## Phase 5 — Vehicle states

- **[F5.1 — State Track Foundation](development/F5.1-state-track-foundation.md)**: Establish typed shared access and discrete time resolution for four vehicle state tracks.
- **[F5.2 — Indicator Track](development/F5.2-indicator-track.md)**: Add precise current-time indicator editing with Off/Left/Right/Hazard in properties.
- **[F5.3 — Brake Light Track](development/F5.3-brake-light-track.md)**: Add a current-time Brake light switch using established state resolution and mutations.
- **[F5.4 — Headlight Track](development/F5.4-headlight-track.md)**: Add Headlight after Brake light, reusing the Boolean control and shared state core.
- **[F5.5 — Horn Track](development/F5.5-horn-track.md)**: Add a sustained Horn Boolean state without audio, and group all four properties controls under State at <currentTime>.
- **[F5.6 — Initial State Keyframes](development/F5.6-initial-state-keyframes.md)**: Centralize and lock the existing zero-time state defaults in the model factory.
- **[F5.7 — Vehicle State Timeline Hierarchy](development/F5.7-vehicle-state-timeline-hierarchy.md)**: Organize timeline data into collapsible vehicle groups and read-only projected state intervals.
- **[F5.8 — State Interval Creation](development/F5.8-state-interval-creation.md)**: Create finite intervals by dragging empty lanes, using keyframes as the sole saved representation.
- **[F5.9 — State Interval Editing](development/F5.9-state-interval-editing.md)**: Select, move, resize and delete existing derived intervals without duplicating saved state.
- **[F5.10 — State Verification](development/F5.10-state-verification.md)**: Verify the complete properties/timeline/state workflow before persistence.

## Phase 6 — Persistence

- **[F6.1 — Full Project Validation](development/F6.1-full-project-validation.md)**: Extend validation to the complete data contract for unknown input.
- **[F6.2 — JSON Serialization](development/F6.2-json-serialization.md)**: Serialize validated animation data into readable canonical JSON, excluding the complete store and temporary UI state.
- **[F6.3 — Save Project](development/F6.3-save-project.md)**: Download current project JSON through the toolbar using existing serialization, with safe names, resource cleanup and no state mutation.
- **[F6.4 — JSON Parsing](development/F6.4-json-parsing.md)**: Read selected file text and parse syntax into unknown, keeping syntax separate from project validity and returning stable failures.
- **[F6.5 — Asset Resolution](development/F6.5-asset-resolution.md)**: Resolve validated project references into a runtime asset bundle without duplicating registry rules or embedding metadata in the saved project.
- **[F6.6 — Load Project](development/F6.6-load-project.md)**: Compose read→parse→validate→resolve, then replace project and reset core editor state only after complete success.
- **[F6.7 — Load Error Handling](development/F6.7-load-error-handling.md)**: Explain read, syntax, contract and asset failures through existing loader results while protecting current work.
- **[F6.8 — Save/Load Round Trip Test](development/F6.8-save-load-round-trip.md)**: Verify the complete persistence gate through production modules and real save/load, without adding a parallel implementation.

## Phase 7 — Integration and preview

- **[F7.1 — Multiple Vehicles](development/F7.1-multiple-vehicles.md)**: Remove the single-vehicle restriction using the existing nested model and editing/persistence flow.
- **[F7.2 — Cross-Panel Selection Sync](development/F7.2-cross-panel-selection-sync.md)**: Use one shared selection across scene, timeline and properties for owner, point, path and state keyframe, with at most one subordinate type.
- **[F7.3 — Vehicle Deletion](development/F7.3-vehicle-deletion.md)**: Delete the selected vehicle only after explicit confirmation, removing its nested motion/state data together and synchronizing all views.
- **[F7.4 — Movement Point Delete Confirmation](development/F7.4-movement-point-delete-confirmation.md)**: Add confirmation to existing point deletion, reusing established protection and path reconnection instead of changing them.
- **[F7.5 — Timeline Range & Navigation](development/F7.5-timeline-range-navigation.md)**: Extend working time to0–60 while retaining default10-second density, horizontal navigation and four bounded zoom spans.
- **[F7.6 — Preview Scene State Composition](development/F7.6-preview-scene-state-composition.md)**: Compose pure scene pose/state at time from existing path mathematics and state resolver.
- **[F7.7 — Preview Seek](development/F7.7-preview-seek.md)**: Render every vehicle's composed position/direction when any existing time entry changes.
- **[F7.8 — Preview Play](development/F7.8-preview-play.md)**: Play from current time through one elapsed-time clock, updating existing scene composition and timeline until the60-second end.
- **[F7.9 — Preview Pause](development/F7.9-preview-pause.md)**: Add Pause to the existing transport/clock and hold exact last committed time, resuming without counting paused wall-clock duration.
- **[F7.10 — Preview Integration](development/F7.10-preview-integration.md)**: Bind resolved lights to explicit typed vehicle model geometry, and make the original top-view body's forward direction recognizable even with all lights off.
- **[F7.11 — Error & Empty States](development/F7.11-error-empty-states.md)**: Provide usable empty/background/unavailable states and playback recovery through existing validation/composition rules.
- **[F7.12 — Vehicle Asset Variants](development/F7.12-vehicle-asset-variants.md)**: Add two final independently calibrated vehicle models through the existing generic authoring/preview/persistence chain, demonstrating D002 in production.
- **[F7.13 — MVP Scale Test](development/F7.13-mvp-scale-test.md)**: Verify the specified five-vehicle/60-second data scale with deterministic fixture and existing production modules, separately from final user-workflow acceptance.
- **[F7.14 — Full MVP Acceptance](development/F7.14-full-mvp-acceptance.md)**: From an empty project complete creation→movement/path/state editing→preview→save→reload→load and error recovery.

## Final gates

F7.12 supplies two independently calibrated production models. F7.13 verifies the specified scale without adding product features. F7.14 verifies the complete user workflow and final MVP release gate. Their records and the [testing index](testing/INDEX.md) preserve the distinction.
