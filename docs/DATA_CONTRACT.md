# Animation Project Data Contract

## Purpose and structure

This contract defines what a complete animation project contains, what its fields mean and how authoring and preview interpret them. The TypeScript model in src/model and the complete validator implement these rules.

```text
AnimationProject
  Scene
    Background reference
    Vehicle objects
      Asset reference
      Movement points and path segments
      Indicator, brake-light, headlight and horn tracks
```

The MVP scene object type is Vehicle. Editor time, selection and timeline layout are outside this structure.

## Complete example

```json
{
  "schemaVersion": 1,
  "animationId": "animation-01",
  "scene": {
    "width": 1600,
    "height": 900,
    "background": {
      "assetId": "intersection-01"
    },
    "objects": [
      {
        "id": "vehicle-01",
        "type": "vehicle",
        "assetId": "car-blue-sedan",
        "movement": {
          "points": [
            {
              "id": "mp-01",
              "time": 0,
              "x": 300,
              "y": 700
            },
            {
              "id": "mp-02",
              "time": 3,
              "x": 700,
              "y": 400
            }
          ],
          "paths": [
            {
              "id": "path-01",
              "fromPointId": "mp-01",
              "toPointId": "mp-02",
              "type": "cubicBezier",
              "control1": {
                "x": 420,
                "y": 650
              },
              "control2": {
                "x": 620,
                "y": 500
              }
            }
          ]
        },
        "stateTracks": {
          "indicator": {
            "keyframes": [
              {
                "id": "indicator-01",
                "time": 0,
                "value": "off"
              },
              {
                "id": "indicator-02",
                "time": 1,
                "value": "right"
              }
            ]
          },
          "brakeLight": {
            "keyframes": [
              {
                "id": "brake-01",
                "time": 0,
                "value": false
              }
            ]
          },
          "headlight": {
            "keyframes": [
              {
                "id": "headlight-01",
                "time": 0,
                "value": false
              }
            ]
          },
          "horn": {
            "keyframes": [
              {
                "id": "horn-01",
                "time": 0,
                "value": false
              }
            ]
          }
        }
      }
    ]
  }
}
```

This is a complete saved animation, using registered assets and explicit initial states.

## Project and scene

```ts
type AnimationProject = {
  schemaVersion: 1;
  animationId: string;
  scene: Scene;
};

type Scene = {
  width: number;
  height: number;
  background?: { assetId: string };
  objects: VehicleObject[];
};
```

schemaVersion is 1; animationId is a stable non-empty project identity. The MVP does not perform version migration.

Scene dimensions are positive finite numbers, defaulting to 1600 × 900. Points and path controls use this logical space. Browser/canvas resizing changes display scale, not saved coordinates. An empty scene and absent background are valid.

## Vehicle

```ts
type VehicleObject = {
  id: string;
  type: "vehicle";
  assetId: string;
  movement: VehicleMovement;
  stateTracks: VehicleStateTracks;
};
```

id identifies the instance, while assetId identifies a registered appearance and static visual definition. Multiple instances can reference one asset without sharing animation identity.

Movement and state tracks are independent: one describes location/routes, the other discrete states at times.

## Movement

```ts
type VehicleMovement = {
  points: MovementPoint[];
  paths: PathSegment[];
};

type MovementPoint = {
  id: string;
  time: number;
  x: number;
  y: number;
};
```

A point says that the vehicle reaches logical position (x, y) at time seconds. For example, time 3 and coordinates (700, 400) mean that location at three seconds.

Each vehicle has an explicit zero-time point. Points use finite coordinates and non-negative finite times in strictly increasing order, with no duplicate time within one vehicle. Entity IDs must be non-empty and globally unique across vehicle, point, path and state-keyframe entities.

Seeking alone creates no data. Position edits at a new time create a point; edits at an existing time update it. Explicitly selected point edits target that stable ID, even after ordinary seeking changes currentTime. Zero-time position is editable, but its time and deletion are protected.

## Paths

```ts
type Point = { x: number; y: number };

type PathSegment = {
  id: string;
  fromPointId: string;
  toPointId: string;
  type: "cubicBezier";
  control1: Point;
  control2: Point;
};
```

A cubic segment uses P0 from the referenced start point, P1=control1, P2=control2 and P3 from the end point. Endpoints do not duplicate coordinates.

Each directed adjacent point pair has exactly one path; n points require n−1 paths. References stay within the vehicle and point forward in time. Controls use absolute logical coordinates. Default controls lie at one-third and two-thirds of the endpoint line.

Drawing and preview use the same data and path core.

## Movement calculation

```ts
const progress = (currentTime - startTime) / (endTime - startTime);
const t = progress;
```

Within an interval, t is in [0, 1] and feeds the cubic polynomial directly. The path tangent gives semantic rotation; ordinary rotation is not saved as an extra track.

This does not imply constant physical speed, easing or arc-length adjustment. Pure path functions reject invalid parameters rather than extrapolating.

At an exact nonfinal point, preview uses its exact position and outgoing direction. At/after the final point it holds the final pose using the incoming end direction. A single-point vehicle holds that point with rotation zero. Undefined tangent direction produces an unresolved result rather than an invented heading.

## Movement mutations

| Change | Required behavior |
|---|---|
| Create/insert point | Sort by time, remove obsolete adjacency and create default paths for affected new neighbors |
| Move point position | Resolve connected endpoints from the new position; retain existing path IDs and absolute controls |
| Edit time without changing order | Preserve path geometry and references |
| Reorder time | Retain still-valid directed paths; remove obsolete/reversed relationships and default new ones |
| Attempt duplicate time | Reject atomically |
| Delete middle point | Remove its connected paths and default the new neighbor connection |
| Delete final nonzero point | Remove its incoming path without unnecessary replacement |

New connections do not preserve a removed edited curve by subdivision, reversal or merging. Unaffected geometry and identities remain intact.

## Vehicle states

```ts
type IndicatorState = "off" | "left" | "right" | "hazard";
type StateKeyframe<T> = { id: string; time: number; value: T };
type StateTrack<T> = { keyframes: StateKeyframe<T>[] };
type VehicleStateTracks = {
  indicator: StateTrack<IndicatorState>;
  brakeLight: StateTrack<boolean>;
  headlight: StateTrack<boolean>;
  horn: StateTrack<boolean>;
};
```

State is discrete: the latest keyframe at or before a time remains active until the next keyframe. For 0:off, 2:right, 5:off, right is active from 2 until 5. There is no interpolation.

Each track uses strictly increasing unique non-negative finite times. A same-time state edit updates the existing keyframe; different tracks may change at the same time.

### Initial states

Every newly created vehicle has one zero-time movement point and four explicit zero-time state keyframes: indicator off and three false values. These states belong to the data rather than a renderer's assumptions. Empty tracks are invalid.

### Timeline intervals

Intervals are derived editing views, not saved entities. Boolean true spans project to active ranges; left/right lanes project from the one indicator enum, with overlap representing hazard.

Creation and editing mutate keyframe boundaries, preserve resolved state outside the edited range and the opposite indicator side, retain valid identities and normalize redundant values. Open/clipped display ends are not authored end keyframes. See [D001](decisions/D001-keyframe-backed-state-intervals.md).

Horn is editable, persisted and resolved as a Boolean, without audio or substitute visual output.

## Time

All saved times are seconds and may have arbitrary finite decimal precision. The editor works over 0–60 seconds with a default 10-second view. Interaction snapping is 0.1 seconds; it does not constrain stored precision or continuous playback time.

Zoom, scroll and visual tick density do not alter time data. FPS is not part of the file. Pure composition can resolve later finite times under final-pose/state hold rules rather than applying a hidden UI limit.

## Assets

The bundled background is intersection-01; final vehicles are car-blue-sedan and car-blue-sport. All references must resolve to the correct registry type.

Projects do not contain React components, Konva nodes, renderer functions, blob URLs, image bytes or temporary file paths. They also do not contain asset dimensions, native direction, lamp anchors/radii or beam geometry.

Each registered vehicle provides a complete typed visual definition in static metadata. Preview first resolves semantic state, then drawing binds that state to registered geometry. Invalid/missing metadata fails explicitly; it is not reconstructed from width/height. See [D002](decisions/D002-vehicle-model-visual-definitions.md).

## Persistence and validation

Save validates before canonical JSON serialization. Load performs syntax parsing, supported-version and full-contract validation, asset resolution and only then an atomic project replacement. Failure shows a categorized explanation and preserves current valid work.

Validation checks known fields and complete shape, positive dimensions, finite numbers, global stable entity IDs, time ordering/uniqueness, explicit initial points/states, valid value types and exact directed adjacency with resolvable references/assets.

Validation is read-only: it does not sort, fill defaults, strip unknown fields, repair topology or migrate data. Successful loading preserves supported values/array order and resets temporary time/selection.

## Editor state and TypeScript ownership

currentTime, object/point/path/keyframe selection, preview-playing state, zoom/scroll, hover, drag, collapse and feedback are temporary editor state. Never serialize the whole store.

The actual model files express this contract rather than defining a competing format. Contract conflicts must be resolved and documented before implementation changes.

English edition of the Phase 7 contract. The complete example and model semantics are retained; editor clarifications reflect the accepted MVP. Future object/platform plans are omitted.
