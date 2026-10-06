# Architecture

## Architectural goal

The editor creates and modifies animation data; preview interprets that data at a given time. Both share stable model definitions and path mathematics, while UI interactions stay separate from calculation.

The editor is a standalone project alongside the RoadSense practice website. It has no dependency on question text, answers or explanations, and does not require a backend or shared package.

## Editor modules

| Module | Responsibility |
|---|---|
| Editor shell | Compose toolbar, library, scene, properties and timeline; own page layout rather than animation math |
| Object library | Present registered backgrounds and vehicles for use in a scene |
| Scene editor | Spatial selection, dragging, movement-point positions and path/control editing in logical coordinates |
| Properties | Precise editing of selected entities through shared store operations |
| Timeline | Time navigation, point timing and state-duration authoring |
| Editor store | Coordinate project mutations and cross-panel selection, time and playback |

Changing time alone does not create animation data. A position or state edit creates or updates the corresponding point/keyframe through the shared operations.

Zustand holds the current AnimationProject and shared temporary editor state. Persistence saves only AnimationProject. Component-specific drafts, collapse state, interval handles, drag previews, zoom/scroll and feedback remain React local state.

## Data model

The model defines project, scene, vehicles, movement points, paths and state tracks. It has no React, Konva, timeline-layout or clock dependency. The [data contract](DATA_CONTRACT.md) specifies format, meaning and invariants.

Mutation operations centralize business rules so scene, timeline and properties do not independently implement point insertion, topology or keyframe boundaries.

## Path core

The pure path core resolves the same P0/P1/P2/P3 geometry for drawing, position and tangent direction. A path refers to adjacent movement-point IDs and stores two absolute control points. Moving endpoints does not translate controls.

Editor curves and preview movement therefore use the same mathematical definition. The core calculates geometry; store operations coordinate data changes.

## Preview

composePreviewSceneState combines project data, time, shared path functions and the model's state resolver into ordered vehicle poses and states. It does not mutate the project or advance time.

The root playback clock advances shared currentTime using animation-frame timestamp differences. Seeking and pausing use the same time source; playback stops at the 60-second editor boundary. This working range is a UI/transport policy rather than a hidden upper limit in the saved format.

Scene rendering consumes resolved poses; authoring overlays retain their original model coordinates. Preview availability and presentation adapters supply empty/error behavior without maintaining another project or saved error model.

## Persistence

Persistence provides validation, canonical serialization, file reading/parsing, download and load preparation. It saves animation data rather than selection, playback, hover, panel layout or projected intervals.

Loading reads and parses into unknown, validates the complete project, resolves registered assets, and returns a ready result. Only then does one store action replace the project and reset time/selection. Failure leaves current valid work intact.

The serializer reconstructs supported fields with canonical object ordering while preserving arrays and values. Round-trip checks compare independent source snapshots and second serialization.

## Asset definitions and visual binding

Assets live in public/assets/backgrounds and public/assets/vehicles. A static registry supplies identity, type, source, name and dimensions. Projects save assetId references only.

Every vehicle also has a typed visual definition with native forward direction, lamp anchors/radii and beam geometry. Three responsibilities remain distinct:

1. Animation data and composed preview state describe the instance's position, semantic direction and current states.
2. Asset metadata describes body appearance, native direction and component locations.
3. Generic visual binding applies resolved states to the resolved model without reading keyframes or branching on assetId.

Model coordinates use a centered origin, positive X right and positive Y down. An inner −forwardDeg correction aligns the native asset; the outer group applies semantic rotation. Missing/invalid geometry fails explicitly rather than guessing from image dimensions. See [D002](decisions/D002-vehicle-model-visual-definitions.md).

## Coordinates and styling

The default scene is 1600 × 900 logical units. Uniform display scaling fits available space without changing stored coordinates. Spatial editing uses logical coordinates and shared full-vehicle bounds.

Tailwind CSS and the layout contract provide a desktop workspace with a minimum-size scrolling fallback. Vite builds the static application; strict TypeScript checking covers code, tests and configuration.

## Dependency rules

- UI uses shared store actions rather than private animation formats.
- Model and path calculation do not depend on UI components.
- Preview composition uses the shared model/path/state logic.
- Persistence uses the model, validator and asset resolver, and does not directly mutate the store.
- Asset definitions do not depend on instance state, timeline or store.
- Vehicle drawing consumes resolved state and asset geometry; the clock supplies time rather than calculating motion.

If a feature cannot fit these boundaries, review its architecture or contract explicitly before adding cross-module coupling.

## Project structure

```text
src/
  editor/
    components/
      toolbar/
      object-library/
      scene/
      properties/
      timeline/
    Editor.tsx
  model/
    animation.ts
    scene.ts
    vehicle.ts
    movement.ts
    path.ts
    stateTrack.ts
    stateIntervals.ts
  store/editorStore.ts
  path/bezier.ts
  preview/
    sceneState.ts
    usePreviewPlaybackClock.ts
    availability.ts
  persistence/
    projectValidator.ts
    projectSerializer.ts
    projectParser.ts
    projectDownloader.ts
    projectLoader.ts
    projectLoadError.ts
  assets/
    assetRegistry.ts
    projectAssetResolver.ts
  App.tsx
  main.tsx
tests/
```

English edition of the MVP architecture, retaining its module, state, coordinate, asset and persistence boundaries. The structure reflects the accepted implementation. Designs for separate later-stage systems are omitted.
