# Project Brief

## Context

RoadSense is a road-rule learning project for New Zealand. Preparing animation scenarios required manually writing and adjusting data, making repeated changes to vehicle routes, timing and state transitions cumbersome.

The editor provides a visual way to author that data. A scenario author can place vehicles, set positions at different times, shape routes, edit lights and check the result before saving.

## Accepted MVP

The target workflow is: start with an empty project, choose a background, add vehicles, author movement and state changes, preview, save JSON, and reload the same animation for continued editing.

The workspace contains an object library, scene, properties panel, timeline and toolbar. Its default scene uses 1600 × 900 logical coordinates independent of browser display size.

The application uses React, TypeScript strict mode, React Konva, Zustand, Tailwind CSS, Vite and Vitest. It is a standalone static web application with local file persistence.

## Scope

The bundled assets are one intersection background, a Sedan and a Sport. Vehicles have movement points connected by cubic Bézier paths, plus indicator, brake-light, headlight and horn keyframes. Horn has no audio output.

Road editing, question/answer authoring, traffic-rule simulation, accounts, cloud storage, collaboration, arbitrary asset uploads, undo/redo and mobile/touch optimization are outside the accepted scope.

Desktop mouse and keyboard interaction is the target. The recommended workspace is at least 1280 × 720, with scrolling at smaller sizes. Actual browser evidence is recorded in [Testing](TESTING.md).

## Acceptance scale

The scale profile is five vehicles, 20 movement points per vehicle, 20 keyframes per state track and 60 seconds of animation. These are acceptance targets rather than hard format limits.

Scale verification and end-to-end acceptance are separate gates: one checks the specified data size; the other checks whether the complete authoring workflow works.

## Document basis

English edition of `docs/PROJECT.md` at the accepted Phase 7 snapshot. Context, scope and acceptance goals are retained; future platform plans are omitted.
