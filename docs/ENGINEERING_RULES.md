# Engineering Rules

These rules governed feature implementation, AI assistance, review and acceptance throughout the MVP.

## 1. Acceptance before implementation

Do not implement a feature before its acceptance criteria are clear. Do not allow a developer or AI assistant to choose undefined core data behavior implicitly.

Solve the currently confirmed problem within the documented project boundaries.

## 2. Feature workflow

1. Define the requirement.
2. Write acceptance criteria.
3. Resolve necessary data and interaction design.
4. Implement the feature.
5. Test and verify.
6. Obtain acceptance before the feature commit.

If requirements conflict with the architecture or data contract, stop the affected implementation, explain the conflict, confirm a decision and update the relevant documents before continuing.

## 3. Scope control

Allowed work includes accepted feature criteria, necessary contract/architecture code, relevant tests/types, directly related fixes and small maintainability refactors.

Do not add unconfirmed features, excluded MVP capabilities, unrelated large refactors or speculative general frameworks. The delivery plan defines dependencies; detailed criteria are established when each feature starts.

## 4. Contract stability

The core format, coordinate/time rules, path mathematics, editor behavior, module boundaries and persistence rules are contracts.

Implementation must respect them. Changes must be explained and confirmed rather than silently introduced during coding. Update the documented rule before implementing a different semantic behavior.

## 5. Code rules

Use strict TypeScript and explicit types; do not bypass invariants with any. Keep functions/modules focused. Path calculation, data mutation and UI drawing must not accumulate in one component.

Prefer deterministic pure functions for geometry, state resolution and validation. Avoid unexplained constants, duplicated business rules and implicit default behavior. Comments should explain why rather than repeat the code.

## 6. Data and assets

Animation data follows the [data contract](DATA_CONTRACT.md). Keep it separate from editor selection, playback and timeline state; never serialize the whole store.

Centralize mutations such as path topology rather than reimplementing them in scene, properties and timeline.

Separate animation semantics from static asset geometry. Tracks/resolved states describe the current instance; model definitions describe native direction and part positions. Do not put lamp anchors in the project or active instance state in the registry.

Keep vehicle-specific geometry in typed asset definitions. Scene drawing must not branch by model ID or guess absent anchors from image dimensions. Missing required metadata must fail explicitly.

Common visual binding consumes resolved state and model definition without re-resolving keyframes, paths or timeline UI. This boundary was refined through [D002](decisions/D002-vehicle-model-visual-definitions.md).

## 7. Tests

Automate deterministic core behavior, including:

- Bézier position and tangent/direction.
- Movement mutations and path topology.
- State resolution and boundary edits.
- Validation and save/load round trips.
- Important store operations.

For a reproducible core bug, prefer a failing regression test before the fix. Visual layout and some drag experience may use human browser acceptance; every UI detail need not have an automated test.

## 8. Errors

Reject invalid project, asset and animation data explicitly. Do not silently repair or ignore errors, and preserve the valid project already open.

The MVP does not require a generic migration or recovery framework. Its current file format has explicit validation and failure behavior.

## 9. Completion

Running code alone does not complete a feature. Completion requires all accepted criteria, strict type checking and relevant automated checks to pass, no known blocking defect, conformity with architecture/contract and no unconfirmed scope.

Human acceptance and automated verification are recorded separately in [feature records](development/INDEX.md).
