# Animation Project Data Contract

This document describes the public MVP format. The TypeScript definitions in `src/model/` and checks in `src/persistence/projectValidator.ts` are the executable contract.

## Project and scene

```ts
interface AnimationProject {
  schemaVersion: 1;
  animationId: string;
  scene: Scene;
}

interface Scene {
  width: number;
  height: number;
  background?: { assetId: string };
  objects: VehicleObject[];
}
```

Scene dimensions are positive finite numbers. The default project uses 1600 x 900 logical units. An absent background is valid. Asset IDs must resolve to an asset of the expected type.

## Vehicles and movement

```ts
interface VehicleObject {
  id: string;
  type: "vehicle";
  assetId: string;
  movement: {
    points: MovementPoint[];
    paths: PathSegment[];
  };
  stateTracks: VehicleStateTracks;
}

interface MovementPoint {
  id: string;
  time: number;
  x: number;
  y: number;
}
```

Movement points have non-negative finite times, strictly increasing order, and no duplicate times. A vehicle has an initial point at time zero. Coordinates are finite scene-space values. Stable entity IDs must be non-empty and unique within the project.

Selecting a new time alone does not create data. Editing vehicle position at a new time creates a movement point; editing an existing point updates it. The zero-time point is protected from deletion.

## Paths

```ts
interface PathSegment {
  id: string;
  fromPointId: string;
  toPointId: string;
  type: "cubicBezier";
  control1: { x: number; y: number };
  control2: { x: number; y: number };
}
```

Each adjacent pair of movement points has one connecting path. Endpoints come from the referenced points rather than duplicated coordinates. Control points are absolute scene-space coordinates.

Time progress between movement points maps directly to the curve parameter. The tangent defines vehicle direction. Before or after an authored movement interval, preview uses the applicable endpoint pose. Inserting, deleting, reordering, and moving points must maintain valid path references and adjacency.

## State tracks

Each state track contains `{ id, time, value }` keyframes:

| Track | Values | Initial value |
|---|---|---|
| `indicator` | `off`, `left`, `right`, `hazard` | `off` |
| `brakeLight` | boolean | `false` |
| `headlight` | boolean | `false` |
| `horn` | boolean | `false` |

Every track has an explicit zero-time keyframe. Keyframes are ordered by unique non-negative finite times. The latest keyframe at or before a time supplies the current value. Horn is persisted and resolved but produces no audio.

Intervals, hover state, selection, playback state, and visible timeline range are not serialized. Indicator lanes derive from the enum track rather than two independently saved boolean tracks.

## Assets and serialization

The bundled background is `intersection-01`; vehicle IDs are `car-blue-sedan` and `car-blue-sport`. Project files reference those IDs and do not embed image bytes, blob URLs, lamp anchors, or local file paths.

Serialization writes supported model fields in canonical order. Parsing and validation reject malformed JSON, unsupported structure, unknown fields, invalid references, and invalid asset IDs. A failed load never replaces the valid project currently open in the editor.

The file format uses a single `time` field for movement points. Use projects exported by this public MVP; newer private formats are not part of this release.
