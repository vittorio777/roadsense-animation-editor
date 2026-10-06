# Testing and Verification

Verification covers deterministic data behavior, editor interactions and the assembled user workflow. Vitest uses jsdom for component interactions; browser acceptance supplies the visual and real file-input evidence.

## Run the checks

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm build
```

For the final workflow and scale gates:

```sh
pnpm exec vitest run tests/mvpAcceptance.test.ts tests/phase7Scale.test.ts
```

## Behaviors under test

| Area | What the checks protect |
|---|---|
| Geometry | Bézier position, tangent direction and edited control points |
| Movement | Insert, move, reorder and delete while preserving topology and unique times |
| States | Initial keyframes, resolution, interval boundaries and indicator overlap |
| Interactions | Selection synchronization, lane editing and deletion safety |
| Preview | Seeking, playback, pause and end behavior without project mutation |
| Persistence | Validation, asset references, canonical round trips and failed-load isolation |
| Integration | Empty project through authoring, preview, save/load and recovery |
| Scale | Five vehicles, 20 movement points each, 20 keyframes per track, 60 seconds |

The [full acceptance record](testing/mvp-end-to-end.md) and [scale record](testing/phase-7-mvp-scale.md) cover the complete authoring workflow and the specified data size, respectively.

## Accepted development baseline

The original final gate passed **72 files / 504 tests**, strict type checking and a production build. Browser acceptance exercised authoring, preview, actual JSON download/reload and error recovery.

The available Chromium-based in-app browser passed desktop checks at 1280 × 720, 1440 × 900 and 1920 × 1080, plus the 1024 × 600 scrolling fallback. Independent Chrome and Edge automation channels were unavailable for the final gate.

Each development record lists the test results at that feature stage.

## Public release verification

On 2026-10-07, a fresh frozen-lockfile installation using Node.js 22.14.0 and pnpm 11.25.0 passed all 504 tests, strict type checking and the production build.

[The initial GitHub Actions run](https://github.com/vittorio777/roadsense-animation-editor/actions/runs/37531388327) passed on Linux and Windows. The workflow installs locked dependencies and runs type checking, tests and a build.

A local browser smoke check loaded the five-vehicle example, checked selection, switched to the 60-second range and played/paused. The paused time held at 8.42 seconds, and captured console warnings/errors were absent.

The production [Vercel deployment](https://roadsense-animation-editor.vercel.app/) was checked without authentication: the page, JavaScript, CSS, background and vehicle assets loaded successfully. The online browser check loaded the example, selected a vehicle and played/paused at 9.67 seconds with no captured warnings or errors.

Deployment uses Node.js 22 and the pinned pnpm build configured in `vercel.json`. This release was deployed with the Vercel CLI; the GitHub automatic deployment connection was not established.

## Browser review checklist

1. Start empty and check guidance and unavailable playback.
2. Add the intersection and both vehicle models.
3. Author movement, edit timing and control points, and reject duplicate times.
4. Edit light/state intervals and check properties agree.
5. Check selection and data isolation between vehicles.
6. Seek, play, pause and verify the 60-second stop.
7. Exercise cancel/confirm deletion.
8. Save and load through the toolbar; compare restored animation data.
9. Load invalid JSON/data/assets and confirm the valid project survives.
10. Check desktop layouts, scrolling fallback and console output.

## Build observations

The build retains a main JavaScript chunk of approximately 635.35 kB, above Vite's default advisory. The production build passes.
