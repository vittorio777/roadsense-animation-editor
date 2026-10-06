# Documentation

The documents describe the accepted editor MVP and its development from foundation through final acceptance. Start with the [project brief](PROJECT.md), then follow the design documents and complete phase records.

## Project definition and design

| Document | Role |
|---|---|
| [Project brief](PROJECT.md) | Problem, intended workflow, scope and acceptance scale |
| [Architecture](ARCHITECTURE.md) | Modules, responsibilities and dependencies |
| [Engineering rules](ENGINEERING_RULES.md) | Feature scope, contract changes, implementation and acceptance |
| [Data contract](DATA_CONTRACT.md) | Saved format, semantics and invariants |
| [Delivery plan](ROADMAP.md) | Phase order, dependencies and completion gates |
| [Feature breakdown](FEATURES.md) | All Phase 0–7 work units and their records |

## Development and verification

- [Development process](ENGINEERING_PROCESS.md): how documents, AI assistance, implementation and review fit together.
- [Complete feature records](development/INDEX.md): all 66 existing Phase 1–7 records, with requirements, numbered criteria, implementation and recorded acceptance.
- [Historical testing records](testing/INDEX.md): all eight phase/scale/end-to-end reports.
- [Current checks and public release evidence](TESTING.md): running the suite, CI and deployment observations.

Phase 0 is covered by the foundation plan and feature inventory.

## Design decisions

- [D001 — Keyframe-backed state intervals](decisions/D001-keyframe-backed-state-intervals.md)
- [D002 — Vehicle model visual definitions](decisions/D002-vehicle-model-visual-definitions.md)

The [decision index](decisions/INDEX.md) records their introduction and related work.

## Development baseline

The development records cover the Phase 7 MVP, tagged `v0.1-editor-mvp`. Early features establish single-vehicle editing and a 10-second timeline; later phases add multiple vehicles and a 60-second range. F7.12 replaces the initial car-blue model with Sedan and Sport.

Feature commit messages and phase tags refer to the development repository. The public repository starts with the MVP release.
