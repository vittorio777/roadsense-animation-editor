# MVP Delivery Plan

The plan defines development order, dependencies and phase completion. Detailed Given/When/Then criteria were written when a feature began. A phase started only after its necessary foundations were stable.

## Phase 0 — Foundation

Create the standalone Vite/React/strict-TypeScript project and configure Tailwind, React Konva, Zustand and Vitest. Establish module directories, contract-aligned model types, the minimal store, static registry and initial validation.

The gate requires startup, build, type checking and tests, with valid minimal projects/assets accepted and obvious invalid data rejected. Scene editing, timeline and persistence UI are outside this foundation.

## Phase 1 — Editor shell

Build the library, scene, properties, timeline and toolbar. Introduce the 1600 × 900 logical scene and uniform display fitting.

Completion means stable desktop layout and resizing that changes display scale without changing saved coordinates.

## Phase 2 — Scene and vehicle

Choose a registered background, display available vehicles, create the first complete instance, select/drag it and edit its basic properties.

Completion means usable scene placement/editing in logical coordinates with consistent selection and bounds. The temporary single-vehicle restriction is lifted in Phase 7.

## Phase 3 — Timeline and movement

Add ruler, current-time playhead and 0.1-second interaction snapping. Creation provides a zero-time point; position edits at a new time create a point while same-time edits update it. Seeking alone writes nothing.

Add point selection, position/time editing, duplicate-time rejection and protected initial-point behavior. Completion means ordered unique point times and consistent spatial/time editing.

## Phase 4 — Movement paths

Create cubic Bézier paths between adjacent points, draw/select them and edit controls. Shared pure position/tangent functions define both the authored curve and motion calculations. Time progress maps directly to curve parameter.

Point position, insertion, reordering and deletion must preserve valid references and directed adjacency. Completion verifies renderer geometry against independent mathematical expectations and the shared core.

## Phase 5 — Vehicle states

Add indicator, brake-light, headlight and horn tracks with explicit zero-time defaults. At a new time, state changes create keyframes; at an existing time, they update the identity. Seek only reads.

The duration-authoring design was refined during this phase: vehicle groups and projected lanes lead to interval creation/movement/resizing/deletion through keyframe boundary mutations. Properties remains a precise current-time entry.

Completion verifies one saved state representation, sustained values and independence from motion. Phase 4 and Phase 5 share the Phase 3 foundation.

## Phase 6 — Persistence

Validate the full contract, serialize/download JSON, read/parse selected files, resolve assets and load only after all checks succeed. Save includes scene, asset references, movement, paths and states; temporary editor state is excluded.

Invalid input must not partially replace valid work. Completion verifies core-data equality after save/load and identical second serialization, with usable failure and retry behavior.

## Phase 7 — Integration and preview

Enable multiple independent vehicles and complete cross-panel selection and safe deletion. Expand timeline navigation to 60 seconds. Compose preview from the shared path core/state resolver and add seek, play and pause.

Bind resolved light states to each asset's explicit native direction and lamp geometry through common drawing. Introduce the independently calibrated Sedan and Sport. Horn is resolved and saved without audio.

The final gates are distinct:

- **F7.13:** Five vehicles, 20 movement points each, 20 keyframes per state track and 60 seconds; validate editing, preview and persistence at that data scale.
- **F7.14:** Start empty and complete creation, editing, preview, save/load and error recovery as a user workflow.

Both must be accepted before the MVP is complete. The original final gate commit received the annotated v0.1-editor-mvp tag.

See [all feature units](FEATURES.md), [their development records](development/INDEX.md) and [phase evidence](testing/INDEX.md).
