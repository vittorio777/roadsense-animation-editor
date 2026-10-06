# RoadSense Animation Editor

A desktop-first editor for authoring 2D vehicle animations: place vehicles, shape their routes, arrange timed states, preview the result, and save an editable JSON project.

Built with React, TypeScript, React Konva, Zustand, Tailwind CSS, and Vite. This portfolio release contains the completed editor MVP, with its original application code and automated tests.

**[Open the live demo](https://roadsense-animation-editor.vercel.app/)** — best viewed in a desktop browser.

![RoadSense MVP preview with five vehicles and an editable timeline](docs/media/public-mvp-preview.jpg)

## What you can do

- Choose an intersection background and add multiple Sedan or Sport vehicles.
- Create movement points at different times and edit cubic Bezier routes using control points.
- Arrange indicator, brake-light, headlight, and horn states on a vehicle timeline.
- Keep selection synchronized across the scene, timeline, and properties panel.
- Seek, play, and pause a preview within a 60-second editing range.
- Download a JSON project and load it again, with validation and understandable error messages.

Horn is a stored state; this version does not play sound.

## Run locally

Use Node.js 22.12 or newer on the Node 22 line, and pnpm 11.25.0. The release has been verified locally with Node.js 22.14.0. No API keys, database, or backend service are required.

```sh
npm install --global pnpm@11.25.0
pnpm install --frozen-lockfile
pnpm dev
```

Open the local URL printed by Vite. Use a desktop browser; the recommended workspace is at least 1280 x 720.

For a quick demonstration, click **Load project** and select [the five-vehicle example](examples/five-vehicle-demo.json) from this checkout. Seek along the timeline, select a movement point or path, edit a control point, then save and reload the project.

To start from scratch, select **Foundation Intersection**, add a vehicle, move the playhead, and change the vehicle position. Select a path to adjust its control points. Use the state lanes or properties to set lights, then preview and save.

## Checks and production build

```sh
pnpm typecheck
pnpm test
pnpm build
pnpm exec vite preview
```

The baseline suite contains **72 test files and 504 tests**, covering path calculations, editing mutations, state tracks, persistence, UI interactions, and integrated MVP workflows. CI runs locked installation, type checking, tests, and a production build on Linux and Windows.

See [Testing](docs/TESTING.md) for verification evidence and known advisories. The main production bundle currently exceeds Vite's default size advisory; this does not prevent a build.

## Engineering highlights

- **Persistent data and editor state are separate.** Project files contain animation data, not selections, playback state, or timeline layout.
- **One geometry definition drives authoring and preview.** The shared path core computes position and tangent direction from the same Bezier curves shown in the editor.
- **Timeline intervals are derived views.** State changes persist as keyframes; interval edits update those keyframes rather than maintaining a second data format.
- **Vehicle appearance is data-driven.** Asset definitions describe native direction and lamp anchors, while common rendering code binds the current state to that geometry.
- **Loading is validated before replacement.** Invalid input leaves the current valid project intact.

## Project structure

```text
src/
  assets/         Asset registry and reference resolution
  editor/         Workspace, scene, properties, timeline, and toolbar
  model/          Animation, scene, vehicle, movement, path, and state types
  path/           Shared Bezier position and direction calculations
  persistence/    Validation, parsing, serialization, loading, and download
  preview/        Scene-state composition and playback clock
  store/          Editor operations and temporary state
tests/            Unit, interaction, integration, and acceptance tests
examples/         Loadable demonstration project
docs/             Architecture, contracts, decisions, and testing
```

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Data contract](docs/DATA_CONTRACT.md)
- [Testing and browser checklist](docs/TESTING.md)
- [Engineering process and AI-assisted development](docs/ENGINEERING_PROCESS.md)
- [Keyframe-backed state intervals](docs/decisions/001-keyframe-backed-state-intervals.md)
- [Vehicle model visual definitions](docs/decisions/002-vehicle-model-visual-definitions.md)

## Scope and limitations

This version is a standalone vehicle-animation authoring tool. It supports the bundled background and two vehicle assets, local JSON persistence, and desktop mouse/keyboard interaction. It does not provide question authoring, traffic-rule validation, accounts, cloud storage, undo/redo history, or mobile editing.

Preview is part of the editor. The public MVP does not include a separate animation-engine, renderer, or player package. Motion follows authored curves and timing rather than a physical traffic simulation. Time progress maps directly to the Bezier parameter, so speed is not constant along a curved path.

## Release provenance

Application code, CSS, tests, assets, dependency lockfile, and build configuration are taken from the accepted `v0.1-editor-mvp` snapshot:

```text
97b18c80b4057f2cef4ff8645cb09921a0bc4fa7
test: complete animation editor mvp acceptance
```

The public documentation and CI have been prepared for this release. Internal development records and later-stage work are excluded.

## Copyright

Source code is publicly available for portfolio purposes. All rights reserved.

See [Copyright](COPYRIGHT.md). Third-party dependencies retain their own licenses.
