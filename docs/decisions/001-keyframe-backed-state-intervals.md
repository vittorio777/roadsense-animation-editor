# Decision: Keyframe-backed State Intervals

## Context

Keyframes are a precise way to persist discrete state changes, but duration is easier to author visually as a timeline interval. Persisting both representations would introduce synchronization and validation problems.

## Decision

Save only state keyframes. Derive timeline intervals from them, and express interval edits as mutations of their boundary keyframes. Properties and timeline operations read and write the same project data.

For boolean tracks, `true` starts an active interval and a later `false` ends it. An open final interval extends visually to the displayed timeline boundary without saving that display boundary as new data.

The indicator remains one enum track: `off`, `left`, `right`, or `hazard`. The left/right lanes are projections; their overlap represents `hazard`.

Creating, moving, resizing, or deleting an interval must preserve state outside the edited range and the data of other vehicles and tracks. Mutations reject invalid ranges and maintain ordered, unique keyframe times.

## Consequences

The saved format stays small and has one source of truth. Both precise state controls and visual duration editing operate on the same data. The mutation core is more involved than keeping an independent interval list, so dedicated state-interval tests verify its behavior.
