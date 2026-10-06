# D002 — Vehicle Model Visual Definitions

**Status:** Accepted on 2026-10-01.

## Context

Movement and state tracks already described a vehicle's motion, direction and lights, and F7.6 composed them at time.

The initial F7.10 proposal inferred lamp locations from image width/height. This assumed matching proportions, native orientation and component layouts. Different models would misalign; asset-ID branches in the scene would spread model-specific knowledge through UI code.

## Decision

Require a static, typed visual definition for each registered vehicle. Save assetId in animation data; resolve body and geometry from the registry and bind the composed state generically.

This uses metadata rather than vehicle-class inheritance. Lamp locations belong to assets, not animation instances.

## Three responsibilities

### Animation semantics

Projects store instance/asset IDs, movement and state tracks. Resolved preview state contains:

```ts
type PreviewVehicleState = {
  id: string;
  assetId: string;
  x: number;
  y: number;
  rotationDeg: number;
  indicator: "off" | "left" | "right" | "hazard";
  brakeLight: boolean;
  headlight: boolean;
  horn: boolean;
};
```

It answers the instance's current state without image-pixel geometry.

### Model geometry

Registry identity/source/dimensions are accompanied by:

```ts
type LampAnchor = { x: number; y: number; radius: number };
type VehicleLightRig = {
  indicatorFrontLeft: LampAnchor;
  indicatorRearLeft: LampAnchor;
  indicatorFrontRight: LampAnchor;
  indicatorRearRight: LampAnchor;
  brakeLeft: LampAnchor;
  brakeRight: LampAnchor;
  headlightLeft: LampAnchor;
  headlightRight: LampAnchor;
  headlightBeamLength: number;
  headlightBeamSpread: number;
};
type VehicleVisualDefinition = {
  forwardDeg: number;
  lights: VehicleLightRig;
};
```

The definition answers where native forward and parts are; it does not store current active states.

### Visual binding

```text
Resolved vehicle state + resolved asset definition → vehicle drawing
```

World pose comes from preview; body/native direction/parts come from model metadata. Generic indicator/brake/headlight rules choose active appearance. Drawing does not read keyframes or branch on model ID.

## Coordinate convention

Model origin is the asset center, positive X right and positive Y down. forwardDeg is native clockwise heading relative to +X. Anchors use that native space.

The inner model applies −forwardDeg; the outer vehicle group applies semantic rotation. The final Sedan and Sport face +X, each with forwardDeg=0.

## Registry contract

Discriminated vehicle/background definitions require complete vehicle metadata. Missing configuration is a type/resolution failure rather than a guessed default.

JSON excludes image source/dimensions/model coordinates, forwardDeg, anchors/radii/beams and UI/drawing nodes. Updating compatible metadata therefore does not require copying geometry into every project.

## Model integration procedure

1. Add the body asset and stable registry identity.
2. Declare native forward direction and every required lamp/beam geometry field.
3. Calibrate against that body's actual parts.
4. Verify definition, asset resolution and rendering.

Replacing a body under the same ID requires updating metadata and confirming compatible identity. Different model semantics require a distinct ID. [F7.12](../development/F7.12-vehicle-asset-variants.md) demonstrates two separately calibrated models.

## Horn and errors

Horn remains semantic Boolean state, without an anchor, substitute icon or audio in this MVP.

Missing definitions fail explicitly. Unregistered/wrong-type references use existing asset errors. Non-finite geometry, non-positive sizes or missing anchors are definition failures. F7.11 presents unavailable preview rather than drawing guessed lamps.

## Consequences

Animation data stays independent of appearance. Both models use one state-mapping path, and precise anchor calibration can be verified.

Each asset needs maintained metadata, calibration, visual acceptance and registry/resolution tests. These costs replace scattered model-specific UI logic.

## Alternatives rejected

| Alternative | Reason |
|---|---|
| Infer anchors from width/height | Proportions and lamp locations differ |
| Save anchors in each project | Duplicates static geometry and complicates asset updates |
| Put stateful lamp control inside each SVG | Image-internal nodes are not the drawing API and mapping would be duplicated |
| Branch by assetId in SceneViewport | Couples model knowledge to UI and requires code changes per asset |

English edition of the accepted MVP decision. Future system designs are omitted; its problem, types, transform rules, errors and tradeoffs are retained.
