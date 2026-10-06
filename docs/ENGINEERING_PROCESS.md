# Development Process

I used AI assistance within a feature-by-feature development workflow. The project documents set the constraints for implementation, and each feature record carries its requirements through verification and acceptance.

## Define the project

The [project brief](PROJECT.md) describes the authoring problem, accepted workflow and scope. The [architecture](ARCHITECTURE.md) assigns module responsibilities; the [data contract](DATA_CONTRACT.md) defines saved data and invariants. The [engineering rules](ENGINEERING_RULES.md) make those constraints part of the work.

## Plan bounded features

The [delivery plan](ROADMAP.md) establishes dependencies and phase gates. The [feature breakdown](FEATURES.md) divides those phases into independently verifiable units.

A feature record was created when work began, with requirements and acceptance criteria before implementation. Its implementation summary and verification/acceptance results were added as work progressed. The [development index](development/INDEX.md) follows the entire existing MVP sequence.

## Resolve design conflicts and review behavior

The rules required a contract or architecture conflict to be explained and resolved before the affected implementation continued.

State-duration editing led to [D001](decisions/D001-keyframe-backed-state-intervals.md), keeping intervals as views of keyframes. Preview integration led to [D002](decisions/D002-vehicle-model-visual-definitions.md), replacing proposed proportional lamp placement with explicit model geometry.

Review also refined interactions. Interval creation received a hold-and-movement guard; timeline hierarchy verification found and fixed a grid-layout issue. These changes and their acceptance results remain in the feature records.

The records document constraints and review around AI-assisted development. They are not AI-session transcripts or a measurement of which tool wrote each line.

## Verify and accept

Feature verification uses relevant model/store/UI tests and browser review where needed. Phase reports check combined behavior. The final scale and end-to-end gates separately verify the specified data size and complete user workflow.

Human acceptance is recorded separately from automated success. Browser availability, requested versus measured dimensions and capture limitations are preserved in [testing records](testing/INDEX.md).

## Public release

The [documentation index](INDEX.md#document-edition-and-history) explains the English edition and original snapshot. [Current verification](TESTING.md) records fresh installation, public CI and hosted smoke checks separately from historical results.
