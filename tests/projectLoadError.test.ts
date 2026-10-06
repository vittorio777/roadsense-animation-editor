import { describe, expect, it } from "vitest";

import { presentProjectLoadFailure } from "../src/persistence/projectLoadError";

describe("F6.7 Project load error presentation", () => {
  it("presents a stable file read failure without raw exception text", () => {
    expect(
      presentProjectLoadFailure({
        status: "read-failed",
        message: "Project file could not be read.",
      }),
    ).toEqual({
      title: "Project could not be loaded",
      summary: "The selected file could not be read.",
      details: ["Project file could not be read."],
    });
  });

  it("presents invalid JSON with the stable Parser message", () => {
    const presentation = presentProjectLoadFailure({
      status: "invalid-json",
      message: "Project file is not valid JSON.",
    });

    expect(presentation).toEqual({
      title: "Project could not be loaded",
      summary: "The selected file is not valid JSON.",
      details: ["Project file is not valid JSON."],
    });
    expect(JSON.stringify(presentation)).not.toContain("SyntaxError");
  });

  it("preserves every Validation error in deterministic order", () => {
    const errors = [
      "schemaVersion must be 1.",
      "animationId must be a non-empty string.",
      "scene.width must be greater than 0.",
      "Unknown background assetId: missing-background.",
    ];

    expect(
      presentProjectLoadFailure({ status: "invalid-project", errors }),
    ).toEqual({
      title: "Project could not be loaded",
      summary:
        "The selected file does not match the RoadSense project format.",
      details: errors,
    });
  });

  it("adds Data Contract paths to structured Asset errors", () => {
    expect(
      presentProjectLoadFailure({
        status: "unresolved-assets",
        errors: [
          {
            path: "scene.background.assetId",
            assetId: "missing-background",
            expectedType: "background",
            reason: "missing",
            message: "Unknown background assetId: missing-background.",
          },
          {
            path: "scene.objects[0].assetId",
            assetId: "intersection-01",
            expectedType: "vehicle",
            reason: "type-mismatch",
            message: "Unknown vehicle assetId: intersection-01.",
          },
        ],
      }),
    ).toEqual({
      title: "Project could not be loaded",
      summary: "Some assets referenced by the project are unavailable.",
      details: [
        "Unknown background assetId: missing-background. (scene.background.assetId)",
        "Unknown vehicle assetId: intersection-01. (scene.objects[0].assetId)",
      ],
    });
  });
});
