import { describe, expect, it } from "vitest";

import type { PreviewAvailability } from "../src/preview/availability";
import { resolvePreviewAvailability } from "../src/preview/availability";
import {
  getPreviewPlayUnavailableReason,
  presentPreviewAvailability,
} from "../src/editor/previewPresentation";
import { createEmptyAnimationProject } from "../src/model/animation";
import type { VehicleStateTrackKey } from "../src/model/stateTrack";
import { createVehicleObject } from "../src/model/vehicle";

function createProjectWithVehicle(assetId = "car-blue-sedan") {
  const project = createEmptyAnimationProject();
  let nextId = 0;
  project.scene.objects = [
    createVehicleObject({
      assetId,
      x: 800,
      y: 450,
      createId: (kind) => `${kind}-${nextId++}`,
    }),
  ];
  return project;
}

describe("F7.11 Preview availability", () => {
  it("distinguishes empty, ready, composition, and asset states", () => {
    const emptyProject = createEmptyAnimationProject();
    expect(resolvePreviewAvailability(emptyProject, 0).status).toBe("empty");

    const readyProject = createProjectWithVehicle();
    expect(resolvePreviewAvailability(readyProject, 0).status).toBe("ready");

    const invalidMovementProject = createProjectWithVehicle();
    invalidMovementProject.scene.objects[0]!.movement.points = [];
    expect(resolvePreviewAvailability(invalidMovementProject, 0)).toEqual({
      status: "unavailable",
      issue: {
        kind: "composition",
        reason: "invalid-movement",
        objectId: invalidMovementProject.scene.objects[0]!.id,
      },
    });

    const missingAssetProject = createProjectWithVehicle("missing-car");
    expect(resolvePreviewAvailability(missingAssetProject, 0)).toEqual({
      status: "unavailable",
      issue: {
        kind: "vehicle-asset",
        objectId: missingAssetProject.scene.objects[0]!.id,
        assetId: "missing-car",
      },
    });

    const mismatchedAssetProject = createProjectWithVehicle("intersection-01");
    expect(resolvePreviewAvailability(mismatchedAssetProject, 0)).toEqual({
      status: "unavailable",
      issue: {
        kind: "vehicle-asset",
        objectId: mismatchedAssetProject.scene.objects[0]!.id,
        assetId: "intersection-01",
      },
    });
  });

  it("presents one coordinated empty state with optional background guidance", () => {
    const project = createEmptyAnimationProject();
    const empty = resolvePreviewAvailability(project, 0);
    const withoutBackground = presentPreviewAvailability(project, empty);

    expect(withoutBackground).toEqual({
      kind: "empty",
      title: "No vehicles in scene",
      message:
        "Choose a background and add a vehicle from the Object Library to begin.",
    });

    project.scene.background = { assetId: "intersection-01" };
    expect(presentPreviewAvailability(project, empty)).toEqual({
      kind: "empty",
      title: "No vehicles in scene",
      message: "Add a vehicle from the Object Library to begin.",
    });
  });

  it.each([
    ["invalid-time", undefined, "Choose a valid time"],
    ["invalid-movement", undefined, "incomplete movement data"],
    ["missing-path", undefined, "missing a path"],
    ["unresolved-position", undefined, "position could not be calculated"],
    ["unresolved-rotation", undefined, "direction could not be calculated"],
    ["unresolved-state", "headlight", "headlight state is incomplete"],
  ] as const)(
    "presents %s without leaking raw identifiers",
    (reason, stateTrack, expectedMessage) => {
      const project = createProjectWithVehicle();
      const objectId = project.scene.objects[0]!.id;
      const availability: PreviewAvailability = {
        status: "unavailable",
        issue: {
          kind: "composition",
          reason,
          objectId,
          ...(stateTrack === undefined
            ? {}
            : { stateTrack: stateTrack as VehicleStateTrackKey }),
        },
      };
      const presentation = presentPreviewAvailability(project, availability);

      expect(presentation).toMatchObject({
        kind: "error",
        title: "Preview unavailable",
      });
      expect(presentation?.message).toContain(expectedMessage);
      expect(presentation?.message).not.toContain(objectId);
      expect(presentation?.message).not.toContain(reason);
    },
  );

  it("uses a safe ordinal for unavailable assets and exposes a play reason", () => {
    const project = createProjectWithVehicle("private-asset-id");
    const availability = resolvePreviewAvailability(project, 0);
    const presentation = presentPreviewAvailability(project, availability);

    expect(presentation?.message).toContain("Vehicle 1");
    expect(presentation?.message).not.toContain("private-asset-id");
    expect(getPreviewPlayUnavailableReason(presentation)).toContain(
      "Preview unavailable",
    );
  });
});
