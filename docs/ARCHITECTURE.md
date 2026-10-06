# Architecture

## Application boundary

The MVP is a standalone, browser-based vehicle-animation editor. It requires no backend, account service, database, or remote API. React provides the workspace UI; React Konva draws the editable scene; Zustand coordinates project data and temporary editor state.

The workspace contains an object library, scene, properties panel, timeline, and project toolbar. All panels work on the same project and selection identity.

## Persistent data and temporary state

`src/model/` defines the animation project. Vehicles reference registered assets and own movement points, Bezier paths, and state keyframes. This is the data saved to JSON.

`src/store/editorStore.ts` also manages selection, current time, preview status, and editing operations. Only project data is serialized. Timeline scroll, track expansion, selection, and playback state do not become project fields.

Editing operations maintain data invariants centrally. Scene and properties edits do not implement competing rules for inserting or deleting movement points. The timeline and properties panel update the same state tracks.

## Geometry and preview

`src/path/bezier.ts` is the shared mathematical core. A path segment references adjacent movement points and contains two cubic Bezier control points. Position and direction are calculated from this geometry for both authoring and preview.

`src/preview/sceneState.ts` combines the project, current time, path calculations, and state-track resolution into a preview representation. The scene displays the resolved position, rotation, and vehicle states.

`src/preview/usePreviewPlaybackClock.ts` advances editor time while preview is playing. Playback stops at 60 seconds. Seeking and playback do not change persistent animation data.

This release has editor preview logic and shared vehicle drawing. It has no independent Engine, Renderer, or Player module.

## Coordinate system

The default scene is 1600 x 900 logical units. Browser resizing changes display scaling, not saved coordinates. Pointer positions are translated back into scene coordinates before data is updated. Vehicle dragging respects the MVP's scene bounds.

## State authoring

Indicator, brake-light, headlight, and horn tracks use discrete keyframes. The latest value at or before a time remains active until the next keyframe.

Timeline intervals are projections of those keyframes. Creating, moving, resizing, or deleting an interval updates its keyframe boundaries. Left and right indicator lanes are views of one enum track; overlap represents hazard lights.

## Asset geometry

`src/assets/assetRegistry.ts` defines background and vehicle assets. Each vehicle definition includes native forward direction and lamp-anchor geometry. `VehicleVisual.tsx` binds the resolved vehicle state to that definition, avoiding per-model branches and guessed lamp positions.

## Persistence boundary

Loading follows parse -> validate and resolve references -> replace the project. Validation checks supported fields, IDs, timing, path topology, state values, and known assets. Failure displays a categorized message and preserves the existing project.

Saving produces a canonical representation of supported project fields. A successful load resets temporary editor state. Round-trip tests compare the persisted project before saving with the restored project.

## Styling and delivery

Tailwind CSS and the baseline styles provide the desktop workspace and minimum-size scrolling fallback. Vite serves development modules and builds a static application. TypeScript strict checks include application code, tests, and Vite configuration.

The public release preserves the accepted MVP implementation. Documentation and continuous integration make its boundaries and checks easier to inspect.
