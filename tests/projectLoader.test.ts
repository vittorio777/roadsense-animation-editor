import { describe, expect, it, vi } from "vitest";

import type { ProjectLoadDependencies } from "../src/persistence/projectLoader";
import { prepareAnimationProjectFile } from "../src/persistence/projectLoader";
import { serializeAnimationProject } from "../src/persistence/projectSerializer";
import { createEmptyAnimationProject } from "../src/model/animation";
import { createVehicleObject } from "../src/model/vehicle";
import { useEditorStore } from "../src/store/editorStore";

function createLoadProject() {
  const project = createEmptyAnimationProject("loaded-project");
  project.scene.background = { assetId: "intersection-01" };
  project.scene.objects.push(
    createVehicleObject({
      assetId: "car-blue-sedan",
      x: 640,
      y: 360,
      createId: (kind) => `loaded-${kind}`,
    }),
  );
  return project;
}

function createDependencies(
  overrides: Partial<ProjectLoadDependencies> = {},
): ProjectLoadDependencies {
  return {
    readFile: vi.fn(async () => ({ status: "parsed" as const, value: {} })),
    validateProject: vi.fn(() => ({ valid: true, errors: [] })),
    resolveAssets: vi.fn(() => ({
      status: "resolved" as const,
      assets: { vehicles: [] },
    })),
    ...overrides,
  };
}

describe("F6.6 project load preparation", () => {
  it("prepares Serializer output after Validation and Asset Resolution", async () => {
    const project = createLoadProject();
    const serialized = serializeAnimationProject(project);
    expect(serialized.status).toBe("serialized");
    if (serialized.status !== "serialized") {
      throw new Error(serialized.errors.join(" "));
    }
    const file = { text: vi.fn(async () => serialized.json) };
    const storeBefore = useEditorStore.getState();

    const result = await prepareAnimationProjectFile(file);

    expect(file.text).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ status: "ready", project });
    if (result.status === "ready") {
      expect(result.project).toEqual(project);
      expect(result.assets.background?.id).toBe("intersection-01");
      expect(result.assets.vehicles).toEqual([
        expect.objectContaining({
          objectId: project.scene.objects[0]!.id,
          asset: expect.objectContaining({ id: "car-blue-sedan" }),
        }),
      ]);
    }
    expect(useEditorStore.getState()).toBe(storeBefore);
  });

  it("preserves parser read and JSON failures", async () => {
    await expect(
      prepareAnimationProjectFile({
        text: () => Promise.reject(new Error("denied")),
      }),
    ).resolves.toEqual({
      status: "read-failed",
      message: "Project file could not be read.",
    });
    await expect(
      prepareAnimationProjectFile({ text: async () => "not json" }),
    ).resolves.toEqual({
      status: "invalid-json",
      message: "Project file is not valid JSON.",
    });
  });

  it("stops before Validation and Asset Resolution after a read failure", async () => {
    const dependencies = createDependencies({
      readFile: vi.fn(async () => ({
        status: "read-failed" as const,
        message: "read failed",
      })),
    });

    const result = await prepareAnimationProjectFile(
      { text: async () => "ignored" },
      dependencies,
    );

    expect(result).toEqual({ status: "read-failed", message: "read failed" });
    expect(dependencies.validateProject).not.toHaveBeenCalled();
    expect(dependencies.resolveAssets).not.toHaveBeenCalled();
  });

  it("returns every Validation error and skips Asset Resolution", async () => {
    const value = { schemaVersion: 2 };
    const dependencies = createDependencies({
      readFile: vi.fn(async () => ({
        status: "parsed" as const,
        value,
      })),
      validateProject: vi.fn(() => ({
        valid: false,
        errors: ["schemaVersion must be 1.", "scene must be an object."],
      })),
    });

    const result = await prepareAnimationProjectFile(
      { text: async () => "ignored" },
      dependencies,
    );

    expect(result).toEqual({
      status: "invalid-project",
      errors: ["schemaVersion must be 1.", "scene must be an object."],
    });
    expect(dependencies.resolveAssets).not.toHaveBeenCalled();
  });

  it("keeps unresolved Asset errors separate from Project replacement", async () => {
    const project = createLoadProject();
    const assetError = {
      path: "scene.objects[0].assetId",
      assetId: "missing-car",
      expectedType: "vehicle" as const,
      reason: "missing" as const,
      message: "Unknown vehicle assetId: missing-car.",
    };
    const dependencies = createDependencies({
      readFile: vi.fn(async () => ({
        status: "parsed" as const,
        value: project,
      })),
      resolveAssets: vi.fn(() => ({
        status: "unresolved" as const,
        errors: [assetError],
      })),
    });

    const result = await prepareAnimationProjectFile(
      { text: async () => "ignored" },
      dependencies,
    );

    expect(result).toEqual({
      status: "unresolved-assets",
      errors: [assetError],
    });
    expect(Object.hasOwn(result, "project")).toBe(false);
  });
});
