# Phase 7 — MVP Scale Verification

**Status:** Completed. Human acceptance: 2026-10-02. Scope: F7.13.

This gate checks established editor behavior at the planned data size. Full workflow acceptance is a separate F7.14 gate.

## Scale profile

| Dimension | Verified scale |
|---|---|
| Duration | 60 seconds |
| Vehicles | 3 Sedans, 2 Sports |
| Movement points | 20 per vehicle, 100 total |
| Cubic paths | 19 per vehicle, 95 total |
| State tracks | 4 per vehicle |
| State keyframes | 20 per track, 80 per vehicle, 400 total |

[The deterministic builder](../../tests/fixtures/mvpScaleProject.ts) uses fixed IDs, times, coordinates, model distribution and states, without random/time dependence. [The tests](../../tests/phase7Scale.test.ts) compare fresh output with the [checked-in fixture](../../tests/fixtures/phase-7/mvp-scale-project.json). The public [example](../../examples/five-vehicle-demo.json) has the same data.

## Automated results

Four focused tests passed:

- Exact counts, unique IDs, strict time ordering, adjacency and finite geometry.
- Complete validation and resolution of both models.
- Repeated preview composition at every integer second from 0 through 60.
- Controlled play/pause/clamp/end behavior, isolated point/control/indicator edits and complete persistence equality.

The four untouched vehicles retain their data. Serialize → parse → validate → resolve → load preserves the complete edited project.

Original full suite: **71 files / 501 tests**, strict checking, build and diff passed. Production source, dependencies, schema and stable design documents were unchanged.

## Diagnostic timing

| Original local observation | Time |
|---|---|
| Five validation + 61-sample composition sweeps | 13.56 ms |
| Serialization and load preparation | 2.24 ms |
| Focused four-test process | 938 ms |

Operations completed inside the existing five-second test timeout.

## Browser workflow

Load the actual fixture through the toolbar. Verify exact library counts, five expanded vehicle groups, all movement and state lanes, and 20 movement points from 0 to 60 per owner.

Switch to full range, select the 31.58-second point, play to 31.81 and pause. All five models retain finite poses; captured console warnings/errors are absent.

## Visual evidence

- [Process preview at 31.81 seconds](../development/previews/f7.13/scale-project-31s.jpg)
- [Accepted five-vehicle scene](../development/screenshots/f7.13/mvp-scale-five-vehicles.jpg)

## Result

Scale automation, browser smoke and human acceptance passed. The successful build retained the existing 635.35 kB advisory.

Original commit message: `test: verify phase 7 mvp scale`.
