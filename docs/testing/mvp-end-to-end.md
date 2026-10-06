# MVP End-to-End Verification

**Status:** Completed. Scope: Phase 1–7 / F7.14.

## Purpose and baseline

Verify the accepted capabilities together from an empty project through authoring, preview, save and reload. [F7.13](phase-7-mvp-scale.md) supplies separate scale evidence.

Phase 1–6 annotated tags and all preceding feature records were verified in private development history. Final human acceptance completed the remaining F7.14 record.

## Acceptance project

Intersection background, one Sedan and one Sport; at least four points/three paths on the primary and two points/one path on the secondary. Exercise all four state tracks, the 5/10/20/60-second views and data beyond 20 seconds.

The actual browser project used Sedan point times 0/5.1/9.4/30 and Sport 0/5.1/30, with finite indicator, brake, headlight and horn intervals. The automated profile and browser profile are recorded separately.

## Automated results

- Focused F7.14 plus Phase 2–7 integration: 7 files / 20 tests passed.
- Full suite: **72 files / 504 tests passed**.
- Strict type checking, production build and diff check passed.
- Existing main chunk advisory: 635.35 kB; final gate changed no production modules.

## Real browser workflow

1. Start empty with actionable guidance and unavailable playback.
2. Add intersection, Sedan and Sport through library controls.
3. Author movement and state intervals through properties/timeline; inspect routes, selection and preview.
4. Save through the toolbar, reload to empty, and load the downloaded file.
5. Save again and compare canonical output.
6. Load malformed JSON, invalid project and missing-asset inputs; verify categorized dialogs preserve the restored project.
7. Retry a valid file successfully.

Successful load restored background, vehicle IDs, 4/3 points, paths, controls and authored states while resetting temporary time/selection. Captured console: zero errors and zero warnings.

## Browser coverage

| Browser | 1280 × 720 | 1440 × 900 | 1920 × 1080 | 1024 × 600 fallback |
|---|---|---|---|---|
| Chromium-based in-app browser | Passed | Passed | Passed | Passed |
| Independent Chrome | Not available for this run | Not available | Not available | Not available |
| Independent Edge | Not available for this run | Not available | Not available | Not available |

Chrome and Edge were named in the original plan, but their independent control channels were unavailable.

## Persistence oracle

| Original download | Size |
|---|---|
| untitled-animation (4).json | 7,950 bytes |
| untitled-animation (5).json, after load | 7,950 bytes |

Both shared SHA-256:

```text
DA1C780D5FC08B20203AB9D939C5919199D18C8A352109CAAE5AD40A54A3756D
```

Missing assets were rejected by the existing validator as invalid project with explicit unknown-asset details. This reflects the established pipeline, which also retains a distinct asset-resolution result.

## Captures and final gate

Viewport captures were displayed interactively, but the browser channel did not export them as workspace files.

Automation, complete in-app workflow and human acceptance completed the Phase 7 gate. The original final feature commit was `test: complete animation editor mvp acceptance`, tagged `v0.1-editor-mvp` after acceptance.

[Current public-release verification](../TESTING.md) reports installation, CI and hosted smoke checks separately.
