# Engineering Process

## Acceptance before implementation

Development started with the animation data contract and module boundaries. Features then progressed through requirements, acceptance criteria, implementation, automated verification, browser review where appropriate, and acceptance before a feature commit.

The MVP joined scene editing, movement points, shared path geometry, state tracks, persistence, and preview into one complete workflow. Its final gate tested the combined behavior instead of treating individual feature completion as proof that the product worked end to end.

## Engineering rules

- Keep persistent animation data separate from temporary editor state.
- Centralize data mutation rules so scene, properties, and timeline operations agree.
- Prefer typed, deterministic functions for geometry, state resolution, and validation.
- Use strict TypeScript settings; do not bypass data invariants with untyped values.
- Validate input before changing a currently valid project.
- Keep asset geometry separate from animation semantics.
- Test behavior, data invariants, round trips, and interactions, with browser review for visual details.
- Keep feature scope bounded; resolve contract conflicts explicitly before changing semantics.

## AI-assisted development

AI tools assisted with implementation and verification within documented feature boundaries. Requirements, acceptance criteria, data contracts, and human review guided that work. The public repository exposes the resulting source and tests so engineering claims can be inspected and reproduced.

Human acceptance remains distinct from automated checks. Browser availability limitations are recorded rather than presented as passing coverage. Internal prompts, process previews, and detailed task records are excluded from this public release; they are not required to run the product.

## Release traceability

The private development history used feature-level commits and annotated milestone tags. The accepted MVP snapshot is `97b18c80b4057f2cef4ff8645cb09921a0bc4fa7`, tagged `v0.1-editor-mvp`. Public preparation preserves its application source, CSS, tests, assets, and configuration, while curating English documentation and adding CI.

A clean public initial release should state this provenance. It should not invent a sequence of historical development commits. Subsequent public work can retain its ordinary commit history.
