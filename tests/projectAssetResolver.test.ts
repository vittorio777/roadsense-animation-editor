import { describe, expect, it } from "vitest";

import { getAssetById } from "../src/assets/assetRegistry";
import {
  resolveAnimationProjectAssets,
  resolveAssetReference,
} from "../src/assets/projectAssetResolver";
import {
  createEmptyAnimationProject,
  type AnimationProject,
} from "../src/model/animation";
import { createVehicleObject } from "../src/model/vehicle";
import { validateAnimationProject } from "../src/persistence/projectValidator";
import { useEditorStore } from "../src/store/editorStore";

function createProjectWithVehicles(count: number): AnimationProject {
  const project = createEmptyAnimationProject("asset-resolution");
  project.scene.background = { assetId: "intersection-01" };
  project.scene.objects = Array.from({ length: count }, (_, index) =>
    createVehicleObject({
      assetId: index % 2 === 0 ? "car-blue-sedan" : "car-blue-sport",
      x: 300 + index * 200,
      y: 450,
      createId: (kind) => `vehicle-${index + 1}-${kind}`,
    }),
  );
  return project;
}

function deepFreeze(value: unknown): unknown {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) {
    return value;
  }
  Object.freeze(value);
  for (const child of Object.values(value)) {
    deepFreeze(child);
  }
  return value;
}

describe("F6.5 project asset resolution", () => {
  it("resolves an empty Project without inventing a Background", () => {
    expect(
      resolveAnimationProjectAssets(createEmptyAnimationProject()),
    ).toEqual({
      status: "resolved",
      assets: { vehicles: [] },
    });
  });

  it("resolves the Background and preserves every Vehicle object mapping", () => {
    const project = createProjectWithVehicles(2);
    const result = resolveAnimationProjectAssets(project);

    expect(result).toEqual({
      status: "resolved",
      assets: {
        background: getAssetById("intersection-01"),
        vehicles: [
          {
            objectId: project.scene.objects[0]!.id,
            asset: getAssetById("car-blue-sedan"),
          },
          {
            objectId: project.scene.objects[1]!.id,
            asset: getAssetById("car-blue-sport"),
          },
        ],
      },
    });
    if (result.status === "resolved") {
      expect(result.assets.background).toBe(getAssetById("intersection-01"));
      expect(result.assets.vehicles[0]!.asset).toBe(getAssetById("car-blue-sedan"));
      expect(result.assets.vehicles[1]!.asset).toBe(getAssetById("car-blue-sport"));
    }
  });

  it("classifies missing and mismatched references", () => {
    expect(
      resolveAssetReference("missing-car", "vehicle", "vehicle.assetId"),
    ).toEqual({
      status: "unresolved",
      error: {
        path: "vehicle.assetId",
        assetId: "missing-car",
        expectedType: "vehicle",
        reason: "missing",
        message: "Unknown vehicle assetId: missing-car.",
      },
    });
    expect(
      resolveAssetReference(
        "intersection-01",
        "vehicle",
        "vehicle.assetId",
      ),
    ).toEqual({
      status: "unresolved",
      error: {
        path: "vehicle.assetId",
        assetId: "intersection-01",
        expectedType: "vehicle",
        reason: "type-mismatch",
        message: "Unknown vehicle assetId: intersection-01.",
      },
    });
    expect(
      resolveAssetReference("car-blue-sedan", "background", "background.assetId"),
    ).toEqual({
      status: "unresolved",
      error: {
        path: "background.assetId",
        assetId: "car-blue-sedan",
        expectedType: "background",
        reason: "type-mismatch",
        message: "Unknown background assetId: car-blue-sedan.",
      },
    });
  });

  it("aggregates errors deterministically without returning partial assets", () => {
    const project = createProjectWithVehicles(2);
    project.scene.background = { assetId: "missing-background" };
    project.scene.objects[0]!.assetId = "missing-car";
    project.scene.objects[1]!.assetId = "intersection-01";

    const result = resolveAnimationProjectAssets(project);

    expect(result).toEqual({
      status: "unresolved",
      errors: [
        expect.objectContaining({
          path: "scene.background.assetId",
          reason: "missing",
        }),
        expect.objectContaining({
          path: "scene.objects[0].assetId",
          reason: "missing",
        }),
        expect.objectContaining({
          path: "scene.objects[1].assetId",
          reason: "type-mismatch",
        }),
      ],
    });
    expect(Object.hasOwn(result, "assets")).toBe(false);
  });

  it("keeps F6.1 Asset validation messages compatible", () => {
    const project = createProjectWithVehicles(1);
    project.scene.background = { assetId: "car-blue-sedan" };
    project.scene.objects[0]!.assetId = "missing-car";

    expect(validateAnimationProject(project)).toEqual({
      valid: false,
      errors: [
        "Unknown background assetId: car-blue-sedan.",
        "Unknown vehicle assetId: missing-car.",
      ],
    });
  });

  it("is deterministic and does not mutate frozen Project or Editor State", () => {
    const project = createProjectWithVehicles(2);
    const snapshot = JSON.stringify(project);
    const storeBefore = useEditorStore.getState();
    deepFreeze(project);

    const first = resolveAnimationProjectAssets(project);
    const second = resolveAnimationProjectAssets(project);

    expect(second).toEqual(first);
    expect(JSON.stringify(project)).toBe(snapshot);
    expect(useEditorStore.getState()).toBe(storeBefore);
    expect(Object.hasOwn(project.scene.objects[0]!, "asset")).toBe(false);
    expect(Object.hasOwn(project.scene.background!, "src")).toBe(false);
  });
});
