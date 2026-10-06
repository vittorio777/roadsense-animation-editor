# Phase 6 — Save and Load Verification

**Status:** Completed. Human acceptance: 2026-10-01.

## Baseline

Scope: F6.1–F6.8. Schema 1; original intersection-01/car-blue; one vehicle with four points, three cubic paths and all four state transitions. Multi-vehicle/confirmation/playback work had not yet begun.

[Integration tests](../../tests/phase6Integration.test.ts): 3 passed. Full suite: **61 files / 415 tests**, strict checking and build passed. Feature records/commit messages and Phase 1–5 tags were verified; dependencies/stable design documents stayed unchanged.

## Independent round-trip oracle

Build through real store actions and clone source data before saving. Use the unmocked serializer, parser, validator, resolver and loader. Ready and restored store projects must equal that independent snapshot.

IDs, decimals, controls, state values and array order were preserved. Runtime assets resolve without entering JSON. Store replacement resets time/selection. Second serialization matches exactly. Empty scene remains empty; invalid save/JSON/data/assets returns no partial replacement and preserves full state.

## Real browser workflow

1. Load the deterministic four-point/three-path fixture and inspect all states.
2. Save as phase-6-browser-round-trip.json.
3. Reload the editor to empty and load the downloaded file.
4. Verify model, filename, geometry, tracks and zero-time restoration.
5. Save again as phase-6-browser-round-trip (1).json.
6. Load malformed JSON, verify dialog and intact restored data, then retry valid file.

Fixture and both downloads shared SHA-256:

```text
09E5700A19B563CD1E7888A965BA7E6E02EE1A73C56B87061D00768A21419FBC
```

## Actual browser matrix

| Requested | Measured content/document | Result |
|---|---|---|
| 1280 × 720 | 1280 × 672 content; 1280 × 720 document | Passed |
| 1440 × 900 | 1440 × 852 | Passed |
| 1920 × 1080 | 1920 × 1032 | Passed |
| 1024 × 600 | 1024 × 552 content; 1280 × 720 document | Passed |

The browser reserved 48 px for chrome. Actual content/document measurements supported restored-project/toolbar/dialog and fallback review. Console had no runtime errors.

## Process captures

- [Round trip at minimum size](../development/previews/f6.8/process/round-trip-1280x720.png)
- [Larger layout](../development/previews/f6.8/process/round-trip-1440x900.png)
- [Wide layout](../development/previews/f6.8/process/round-trip-1920x1080.png)
- [Fallback](../development/previews/f6.8/process/round-trip-1024x600-fallback.png)

## Gate

The successful build retained 614.00 kB advisory. Automated/browser/human gate passed. Original commit: `test: verify phase 6 persistence`; tag: `phase-6-save-load`.
