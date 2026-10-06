# D001 — Keyframe-backed State Intervals

**Status:** Accepted on 2026-09-30.

## Context

Properties already supported precise indicator, brake-light, headlight and horn edits at the playhead time. It did not make a state's start, duration and recurrence easy to arrange visually.

The timeline needed vehicle groups and editable duration spans while keeping a single persistent representation.

## Decision

Intervals are derived views of state keyframes. Save only keyframes; project them into timeline spans and translate interval edits back into boundary mutations.

Properties remains the precise current-time entry; timeline lanes become the main duration-authoring surface. Both read and write the same project, with no independent business interval array or saved interval ID.

## Vehicle hierarchy

```text
Vehicle icon + name
  Movement
  Left indicator
  Right indicator
  Brake light
  Headlight
  Horn
```

Groups follow vehicle data, not one hardcoded global track. Collapsing changes UI only. F5.7 introduced the hierarchy while the add workflow still allowed one vehicle; F7.1 later enabled multiple instances within this MVP.

## Boolean projection

A true keyframe begins an active span and a later false ends it. An unclosed true state extends visually to the displayed range boundary; clipping is not an authored end.

Finite creation writes start/end boundaries through the mutation core while preserving the original state outside the edited range.

## Indicator projection

The saved enum remains off, left, right or hazard. Left/right lanes are views:

| Enum | Left | Right |
|---|---|---|
| off | inactive | inactive |
| left | active | inactive |
| right | inactive | active |
| hazard | active | active |

Overlap deterministically represents hazard without splitting the saved indicator into two Boolean tracks.

## Editing semantics

- Empty-lane dragging creates a finite span.
- Handles resize boundaries; body drag moves while retaining duration.
- Deletion inactivates the target lane over the real span.
- Boundaries use the timeline's 0.1-second snapping.
- Reject invalid, zero-length, negative or occupied-range operations atomically.
- Keep unique ordered times, remove redundant consecutive values and preserve useful existing boundary IDs.
- Preserve state outside the edit, the opposite indicator side and unrelated owners/tracks.
- Hover, focus and active drag remain temporary UI state.

The interaction guard and detailed conditions appear in [F5.8](../development/F5.8-state-interval-creation.md); movement/resizing/deletion appears in [F5.9](../development/F5.9-state-interval-editing.md).

## Range and resolver ownership

At the decision's introduction, the timeline showed 0–10 seconds. That boundary was not a data end; F7.5 expanded navigation to 60 seconds. Display range, scrolling and collapse remain unsaved.

F5.1's resolver supplies a value at a time. Interval projection scans a visible range for authoring; it does not replace the point-state resolver. F7.6 preview composes the same state resolver with shared path geometry. F7.2 later connected interval source keyframes to shared selection.

## Consequences and alternatives

One data source keeps properties, duration editing, preview and persistence consistent. The costs are boundary normalization, more involved two-lane indicator mutation and careful open-end handling.

Separate saved interval arrays were rejected because they duplicate state and need synchronization. Replacing keyframes with start/end objects would change the contract and cannot naturally express every discrete transition. Properties-only editing remains precise but does not provide the duration workflow.
