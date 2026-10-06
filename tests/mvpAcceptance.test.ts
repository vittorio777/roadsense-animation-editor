import { beforeEach, describe, expect, it } from "vitest";

import { getAssetById } from "../src/assets/assetRegistry";
import { resolveAnimationProjectAssets } from "../src/assets/projectAssetResolver";
import { createEmptyAnimationProject } from "../src/model/animation";
import { resolveStateValueAtTime } from "../src/model/stateTrack";
import { calculatePathPosition } from "../src/path/bezier";
import { prepareAnimationProjectFile } from "../src/persistence/projectLoader";
import { serializeAnimationProject } from "../src/persistence/projectSerializer";
import { validateAnimationProject } from "../src/persistence/projectValidator";
import { composePreviewSceneState } from "../src/preview/sceneState";
import { useEditorStore } from "../src/store/editorStore";

const emptySelection = {
  objectId: null,
  movementPointId: null,
  pathId: null,
  stateKeyframeId: null,
};

function requireSerializedProject() {
  const result = serializeAnimationProject(useEditorStore.getState().project);
  expect(result.status).toBe("serialized");
  if (result.status !== "serialized") {
    throw new Error(result.errors.join("\n"));
  }
  return result.json;
}

function getVehicle(index: number) {
  const vehicle = useEditorStore.getState().project.scene.objects[index];
  if (!vehicle) {
    throw new Error(`Expected Vehicle at index ${index}.`);
  }
  return vehicle;
}

describe("F7.14 full MVP acceptance", () => {
  beforeEach(() => {
    useEditorStore.setState({
      project: createEmptyAnimationProject("f7-14-mvp-acceptance"),
      currentTime: 0,
      isPreviewPlaying: false,
      selection: emptySelection,
    });
  });

  it("authors an independent two-model animation from an empty project", () => {
    const store = useEditorStore.getState();
    expect(store.project.scene).toMatchObject({
      width: 1600,
      height: 900,
      objects: [],
    });

    store.setSceneBackground("intersection-01");
    store.addVehicle("car-blue-sedan");
    store.addVehicle("car-blue-sport");

    const sedanAtCreation = getVehicle(0);
    const sportAtCreation = getVehicle(1);
    expect(sedanAtCreation.id).not.toBe(sportAtCreation.id);
    expect([sedanAtCreation.assetId, sportAtCreation.assetId]).toEqual([
      "car-blue-sedan",
      "car-blue-sport",
    ]);
    expect(JSON.stringify(useEditorStore.getState().project)).not.toContain(
      '"assetId":"car-blue"',
    );
    expect(sedanAtCreation.movement.points).toHaveLength(1);
    expect(sportAtCreation.movement.points).toHaveLength(1);
    for (const vehicle of [sedanAtCreation, sportAtCreation]) {
      expect(vehicle.movement.points[0]?.time).toBe(0);
      expect(
        Object.values(vehicle.stateTracks).every(
          (track) => track.keyframes.length === 1 && track.keyframes[0]?.time === 0,
        ),
      ).toBe(true);
    }

    const authorPoint = (vehicleId: string, time: number, x: number, y: number) => {
      useEditorStore.getState().setCurrentTime(time);
      useEditorStore.getState().updateVehiclePosition(vehicleId, x, y);
    };
    authorPoint(sedanAtCreation.id, 4, 520, 250);
    authorPoint(sedanAtCreation.id, 12, 920, 640);
    authorPoint(sedanAtCreation.id, 28, 1360, 360);
    authorPoint(sportAtCreation.id, 8, 1120, 520);

    let sedan = getVehicle(0);
    const pointAtTwelve = sedan.movement.points.find((point) => point.time === 12)!;
    expect(
      useEditorStore
        .getState()
        .updateMovementPointTime(sedan.id, pointAtTwelve.id, 14),
    ).toEqual({ status: "updated" });
    sedan = getVehicle(0);
    const pointAtTwentyEight = sedan.movement.points.find(
      (point) => point.time === 28,
    )!;
    const projectBeforeDuplicate = useEditorStore.getState().project;
    expect(
      useEditorStore
        .getState()
        .updateMovementPointTime(sedan.id, pointAtTwentyEight.id, 4),
    ).toEqual({ status: "duplicate-time", time: 4 });
    expect(useEditorStore.getState().project).toBe(projectBeforeDuplicate);

    const pointAtFour = sedan.movement.points.find((point) => point.time === 4)!;
    useEditorStore
      .getState()
      .updateMovementPointPosition(sedan.id, pointAtFour.id, 560, 280);
    sedan = getVehicle(0);
    const middlePath = sedan.movement.paths[1]!;
    useEditorStore
      .getState()
      .updatePathControlPoint(sedan.id, middlePath.id, "control1", 680, 760);
    useEditorStore
      .getState()
      .updatePathControlPoint(sedan.id, middlePath.id, "control2", 980, 120);

    sedan = getVehicle(0);
    expect(sedan.movement.points.map(({ time }) => time)).toEqual([0, 4, 14, 28]);
    expect(sedan.movement.paths).toHaveLength(3);
    expect(sedan.movement.paths[1]).toMatchObject({
      id: middlePath.id,
      control1: { x: 680, y: 760 },
      control2: { x: 980, y: 120 },
    });
    expect(getVehicle(1).movement.points.map(({ time }) => time)).toEqual([0, 8]);

    expect(
      useEditorStore.getState().createVehicleStateInterval(sedan.id, "leftIndicator", 2, 5),
    ).toBe("created");
    expect(
      useEditorStore.getState().createVehicleStateInterval(sedan.id, "rightIndicator", 6, 9),
    ).toBe("created");
    expect(
      useEditorStore.getState().createVehicleStateInterval(sedan.id, "brakeLight", 10, 12),
    ).toBe("created");
    expect(
      useEditorStore.getState().createVehicleStateInterval(sedan.id, "headlight", 14, 18),
    ).toBe("created");
    expect(
      useEditorStore.getState().createVehicleStateInterval(sportAtCreation.id, "horn", 21, 22),
    ).toBe("created");

    sedan = getVehicle(0);
    expect(resolveStateValueAtTime(sedan.stateTracks.indicator, 3)).toBe("left");
    expect(resolveStateValueAtTime(sedan.stateTracks.indicator, 7)).toBe("right");
    expect(resolveStateValueAtTime(sedan.stateTracks.brakeLight, 11)).toBe(true);
    expect(resolveStateValueAtTime(sedan.stateTracks.headlight, 15)).toBe(true);
    expect(resolveStateValueAtTime(getVehicle(1).stateTracks.horn, 21.5)).toBe(true);

    const secondPath = sedan.movement.paths[1]!;
    const expectedPosition = calculatePathPosition(
      sedan.movement.points,
      secondPath,
      0.5,
    );
    const preview = composePreviewSceneState(
      useEditorStore.getState().project,
      9,
    );
    expect(preview.status).toBe("composed");
    if (preview.status === "composed") {
      expect(preview.scene.backgroundAssetId).toBe("intersection-01");
      expect(preview.scene.vehicles).toHaveLength(2);
      expect(preview.scene.vehicles[0]).toMatchObject(expectedPosition!);
      expect(preview.scene.vehicles.every((vehicle) =>
        Number.isFinite(vehicle.rotationDeg),
      )).toBe(true);
    }

    const sedanAsset = getAssetById("car-blue-sedan");
    const sportAsset = getAssetById("car-blue-sport");
    expect(sedanAsset?.type).toBe("vehicle");
    expect(sportAsset?.type).toBe("vehicle");
    if (sedanAsset?.type === "vehicle" && sportAsset?.type === "vehicle") {
      expect(sedanAsset.src).not.toBe(sportAsset.src);
      expect(sedanAsset.visual.lights).not.toEqual(sportAsset.visual.lights);
    }

    const primarySnapshot = structuredClone(getVehicle(0));
    const disposableId = getVehicle(1).id;
    useEditorStore.getState().selectObject(disposableId);
    expect(useEditorStore.getState().deleteVehicle(disposableId)).toEqual({
      status: "deleted",
    });
    expect(useEditorStore.getState().selection).toEqual(emptySelection);
    expect(getVehicle(0)).toEqual(primarySnapshot);
    expect(useEditorStore.getState().deleteMovementPoint(
      primarySnapshot.id,
      primarySnapshot.movement.points[0]!.id,
    )).toEqual({ status: "protected-initial" });
  });

  it("previews, serializes, validates, resolves, and atomically reloads the workflow", async () => {
    const store = useEditorStore.getState();
    store.setSceneBackground("intersection-01");
    store.addVehicle("car-blue-sedan");
    store.addVehicle("car-blue-sport");
    const sedanId = getVehicle(0).id;
    const sportId = getVehicle(1).id;

    for (const [time, x, y] of [
      [4, 500, 260],
      [14, 900, 650],
      [28, 1360, 350],
    ] as const) {
      useEditorStore.getState().setCurrentTime(time);
      useEditorStore.getState().updateVehiclePosition(sedanId, x, y);
    }
    useEditorStore.getState().setCurrentTime(8);
    useEditorStore.getState().updateVehiclePosition(sportId, 1080, 520);
    expect(useEditorStore.getState().createVehicleStateInterval(
      sedanId,
      "headlight",
      14,
      18,
    )).toBe("created");
    expect(useEditorStore.getState().createVehicleStateInterval(
      sportId,
      "horn",
      21,
      22,
    )).toBe("created");

    const animationBeforePlayback = useEditorStore.getState().project;
    useEditorStore.getState().setCurrentTime(20);
    useEditorStore.getState().startPreviewPlayback();
    useEditorStore.getState().advancePreviewPlayback(1.5);
    expect(useEditorStore.getState()).toMatchObject({
      currentTime: 21.5,
      isPreviewPlaying: true,
      project: animationBeforePlayback,
    });
    useEditorStore.getState().stopPreviewPlayback();
    expect(useEditorStore.getState().currentTime).toBe(21.5);
    useEditorStore.getState().setCurrentTime(59.5);
    useEditorStore.getState().startPreviewPlayback();
    useEditorStore.getState().advancePreviewPlayback(1);
    expect(useEditorStore.getState()).toMatchObject({
      currentTime: 60,
      isPreviewPlaying: false,
      project: animationBeforePlayback,
    });

    expect(validateAnimationProject(animationBeforePlayback)).toEqual({
      valid: true,
      errors: [],
    });
    expect(resolveAnimationProjectAssets(animationBeforePlayback).status).toBe(
      "resolved",
    );
    const firstJson = requireSerializedProject();
    const prepared = await prepareAnimationProjectFile({ text: async () => firstJson });
    expect(prepared.status).toBe("ready");
    if (prepared.status !== "ready") {
      throw new Error(`Expected ready Project, received ${prepared.status}.`);
    }

    useEditorStore.getState().setProject(createEmptyAnimationProject("reset"));
    useEditorStore.getState().setCurrentTime(32);
    useEditorStore.getState().selectObject("missing-selection");
    useEditorStore.getState().loadProject(prepared.project);
    expect(useEditorStore.getState()).toMatchObject({
      project: animationBeforePlayback,
      currentTime: 0,
      isPreviewPlaying: false,
      selection: emptySelection,
    });
    expect(requireSerializedProject()).toBe(firstJson);
  });

  it("keeps the valid project intact across categorized load failures", async () => {
    useEditorStore.getState().setSceneBackground("intersection-01");
    useEditorStore.getState().addVehicle("car-blue-sedan");
    const validProject = useEditorStore.getState().project;

    const malformed = await prepareAnimationProjectFile({
      text: async () => "{ definitely not JSON",
    });
    expect(malformed.status).toBe("invalid-json");
    expect(useEditorStore.getState().project).toBe(validProject);

    const invalidData = await prepareAnimationProjectFile({
      text: async () => JSON.stringify({ schemaVersion: 1 }),
    });
    expect(invalidData.status).toBe("invalid-project");
    expect(useEditorStore.getState().project).toBe(validProject);

    const missingAssetProject = structuredClone(validProject);
    missingAssetProject.scene.objects[0]!.assetId = "missing-vehicle";
    const missingAsset = await prepareAnimationProjectFile({
      text: async () => JSON.stringify(missingAssetProject),
    });
    expect(missingAsset.status).toBe("invalid-project");
    if (missingAsset.status === "invalid-project") {
      expect(missingAsset.errors).toContain(
        "Unknown vehicle assetId: missing-vehicle.",
      );
    }
    expect(useEditorStore.getState().project).toBe(validProject);

    const validJson = requireSerializedProject();
    const recovered = await prepareAnimationProjectFile({
      text: async () => validJson,
    });
    expect(recovered.status).toBe("ready");
    if (recovered.status === "ready") {
      useEditorStore.getState().loadProject(recovered.project);
    }
    expect(useEditorStore.getState().project).toEqual(validProject);
  });
});
