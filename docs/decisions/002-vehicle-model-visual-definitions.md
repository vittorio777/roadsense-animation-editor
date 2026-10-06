# Decision: Vehicle Model Visual Definitions

## Context

Different vehicle assets have different body proportions, native forward directions, and lamp locations. Guessing anchors from image dimensions or branching on asset IDs makes shared drawing fragile.

## Decision

Each vehicle asset defines its forward direction, indicator/brake/headlight anchors, radii, and headlight-beam geometry in the typed asset registry. Common vehicle drawing binds the resolved animation state to this definition.

The project stores the asset ID and authored motion/state. It does not store lamp geometry. Likewise, the registry stores the asset's geometry, not the current active light states.

Visual-definition validation rejects invalid geometry instead of substituting guessed positions. Sedan and Sport use independently calibrated definitions with the same rendering path.

## Consequences

New vehicle appearances can be added without introducing model-specific scene branches or changing project state-track semantics. Each model needs explicit geometry and visual verification. Generic rendering tests exercise both assets and their light states at different rotations.
