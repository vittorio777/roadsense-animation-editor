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

Phase 0 is represented by its foundation plan and feature inventory. The original accepted snapshot has no standalone F0.x feature records; none are fabricated here.

## Design decisions

- [D001 — Keyframe-backed state intervals](decisions/D001-keyframe-backed-state-intervals.md)
- [D002 — Vehicle model visual definitions](decisions/D002-vehicle-model-visual-definitions.md)

The [decision index](decisions/INDEX.md) records their introduction and related work.

## Document edition and history

This English edition uses the accepted Phase 7 development snapshot, private commit `97b18c80b4057f2cef4ff8645cb09921a0bc4fa7`, tagged `v0.1-editor-mvp`. Original project definitions, all existing MVP feature records, decisions and verification reports are represented.

Translation preserves numbered acceptance conditions, meaningful feature boundaries, design changes, implementation and recorded results. Repeated requirement/checklist narration is consolidated. Plans for capabilities outside this MVP are omitted.

Early single-vehicle, 10-second or read-only feature boundaries explain the actual sequence. Historical car-blue references identify the original model used before F7.12 introduced Sedan/Sport. They are not renamed retroactively or described as current release assets.

Historical test/browser results describe their original runs. Current installation, CI and deployment evidence is reported separately. Process previews and accepted captures retain their original classifications; capture/export limitations remain explicit.

The public Git history began with the prepared release and does not reproduce private feature commits. Original commit messages/tags and occasional commit identifiers are provenance, not links to public commits. No historical development sequence or unavailable evidence is invented.
