import { beforeEach, describe, expect, it } from "vitest";

import {
  createEmptyAnimationProject,
  type AnimationProject,
} from "../src/model/animation";
import { prepareAnimationProjectFile } from "../src/persistence/projectLoader";
import {
  serializeAnimationProject,
  type ProjectSerializationResult,
} from "../src/persistence/projectSerializer";
import { validateAnimationProject } from "../src/persistence/projectValidator";
import { useEditorStore } from "../src/store/editorStore";

function expectSerialized(
  result: ProjectSerializationResult,
): asserts result is Extract<
  ProjectSerializationResult,
  { status: "serialized" }
> {
  expect(result.status).toBe("serialized");
  if (result.status !== "serialized") {
    throw new Error(result.errors.join(" "));
  }
}

function buildRepresentativeEditorProject(): AnimationProject {
  const store = useEditorStore.getState();
  store.setSceneBackground("intersection-01");
  store.addVehicle("car-blue-sedan");
  store.addVehicle("car-blue-sport");

  const vehicleId = useEditorStore.getState().project.scene.objects[0]!.id;
  for (const point of [
    { time: 2.5, x: 420.25, y: 240.5 },
    { time: 5.25, x: 920.75, y: 680.125 },
    { time: 8.75, x: 1380.5, y: 310.25 },
  ]) {
    useEditorStore.getState().setCurrentTime(point.time);
    useEditorStore
      .getState()
      .updateVehiclePosition(vehicleId, point.x, point.y);
  }

  let vehicle = useEditorStore.getState().project.scene.objects[0]!;
  useEditorStore
    .getState()
    .updatePathControlPoint(vehicleId, vehicle.movement.paths[0]!.id, "control1", 180.5, 720.25);
  useEditorStore
    .getState()
    .updatePathControlPoint(vehicleId, vehicle.movement.paths[1]!.id, "control2", 1120.75, 120.5);
  useEditorStore
    .getState()
    .updatePathControlPoint(vehicleId, vehicle.movement.paths[2]!.id, "control1", 1040.125, 760.875);

  for (const [time, value] of [
    [0, "left"],
    [1.5, "off"],
    [3.25, "right"],
    [5.5, "hazard"],
    [8.25, "off"],
  ] as const) {
    useEditorStore.getState().setCurrentTime(time);
    useEditorStore
      .getState()
      .updateVehicleStateAtCurrentTime(vehicleId, "indicator", value);
  }

  for (const [track, transitions] of [
    [
      "brakeLight",
      [
        [2, true],
        [4.75, false],
      ],
    ],
    [
      "headlight",
      [
        [0, true],
        [7.5, false],
      ],
    ],
    [
      "horn",
      [
        [6.1, true],
        [6.6, false],
      ],
    ],
  ] as const) {
    for (const [time, value] of transitions) {
      useEditorStore.getState().setCurrentTime(time);
      useEditorStore
        .getState()
        .updateVehicleStateAtCurrentTime(vehicleId, track, value);
    }
  }

  vehicle = useEditorStore.getState().project.scene.objects[0]!;
  useEditorStore.getState().setCurrentTime(7.75);
  useEditorStore.getState().setSelection({
    objectId: vehicle.id,
    movementPointId: vehicle.movement.points[2]!.id,
    pathId: vehicle.movement.paths[1]!.id,
    stateKeyframeId: vehicle.stateTracks.horn.keyframes[1]!.id,
  });

  return useEditorStore.getState().project;
}

describe("F6.8 Phase 6 persistence integration", () => {
  beforeEach(() => {
    useEditorStore.setState({
      project: createEmptyAnimationProject("phase-6-round-trip"),
      currentTime: 0,
      selection: {
        objectId: null,
        movementPointId: null,
        pathId: null,
        stateKeyframeId: null,
      },
    });
  });

  it("restores complete Editor Animation Data through the production pipeline", async () => {
    const sourceProject = buildRepresentativeEditorProject();
    const sourceSnapshot = structuredClone(sourceProject);
    const editorStateBeforeSave = useEditorStore.getState();

    expect(validateAnimationProject(sourceProject)).toEqual({
      valid: true,
      errors: [],
    });
    expect(editorStateBeforeSave.currentTime).toBe(7.75);
    expect(Object.values(editorStateBeforeSave.selection).every(Boolean)).toBe(
      true,
    );

    const firstSave = serializeAnimationProject(sourceProject);
    expectSerialized(firstSave);
    const savedValue = JSON.parse(firstSave.json) as AnimationProject;

    expect(savedValue).toEqual(sourceSnapshot);
    expect(firstSave.json).not.toMatch(
      /currentTime|selection|feedback|intervals|resolvedAssets/,
    );
    expect(firstSave.json).not.toContain("/assets/");
    expect(firstSave.json).not.toContain("Foundation intersection");
    expect(firstSave.json).not.toContain("Car Blue Sedan");

    const prepared = await prepareAnimationProjectFile({
      text: async () => firstSave.json,
    });

    expect(prepared.status).toBe("ready");
    if (prepared.status !== "ready") {
      throw new Error(`Expected ready result, received ${prepared.status}.`);
    }
    expect(prepared.project).toEqual(sourceSnapshot);
    expect(prepared.project).not.toBe(sourceProject);
    expect(prepared.assets.background).toMatchObject({
      id: "intersection-01",
      type: "background",
    });
    expect(prepared.assets.vehicles).toEqual([
      expect.objectContaining({
        objectId: sourceSnapshot.scene.objects[0]!.id,
        asset: expect.objectContaining({ id: "car-blue-sedan", type: "vehicle" }),
      }),
      expect.objectContaining({
        objectId: sourceSnapshot.scene.objects[1]!.id,
        asset: expect.objectContaining({ id: "car-blue-sport", type: "vehicle" }),
      }),
    ]);
    expect(JSON.stringify(sourceProject)).toBe(JSON.stringify(sourceSnapshot));

    useEditorStore.getState().loadProject(prepared.project);
    const restoredState = useEditorStore.getState();
    expect(restoredState.project).toEqual(sourceSnapshot);
    expect(restoredState.project).toBe(prepared.project);
    expect(restoredState.currentTime).toBe(0);
    expect(restoredState.selection).toEqual({
      objectId: null,
      movementPointId: null,
      pathId: null,
      stateKeyframeId: null,
    });
    expect(validateAnimationProject(restoredState.project)).toEqual({
      valid: true,
      errors: [],
    });

    const secondSave = serializeAnimationProject(restoredState.project);
    expectSerialized(secondSave);
    expect(secondSave.json).toBe(firstSave.json);
    expect(secondSave.json.endsWith("\n")).toBe(true);
    expect(secondSave.json.endsWith("\n\n")).toBe(false);
  });

  it("round-trips an empty Project without inventing optional data", async () => {
    const source = createEmptyAnimationProject("phase-6-empty");
    const serialized = serializeAnimationProject(source);
    expectSerialized(serialized);

    const prepared = await prepareAnimationProjectFile({
      text: async () => serialized.json,
    });

    expect(prepared).toMatchObject({
      status: "ready",
      project: source,
      assets: { vehicles: [] },
    });
    if (prepared.status === "ready") {
      expect(prepared.project.scene).not.toHaveProperty("background");
      expect(prepared.project.scene.objects).toEqual([]);
      expect(prepared.assets).not.toHaveProperty("background");
    }
  });

  it("keeps the current Editor state isolated from invalid save and load input", async () => {
    buildRepresentativeEditorProject();
    const stateBefore = useEditorStore.getState();
    const projectSnapshot = JSON.stringify(stateBefore.project);

    const invalidSave = serializeAnimationProject({
      ...stateBefore.project,
      currentTime: stateBefore.currentTime,
    });
    expect(invalidSave.status).toBe("invalid");
    expect("json" in invalidSave).toBe(false);

    const missingAssetProject = structuredClone(stateBefore.project);
    missingAssetProject.scene.background = { assetId: "missing-background" };
    const failures = await Promise.all([
      prepareAnimationProjectFile({ text: async () => "{not-json" }),
      prepareAnimationProjectFile({
        text: async () => JSON.stringify({ schemaVersion: 2 }),
      }),
      prepareAnimationProjectFile({
        text: async () => JSON.stringify(missingAssetProject),
      }),
    ]);

    expect(failures.map((failure) => failure.status)).toEqual([
      "invalid-json",
      "invalid-project",
      "invalid-project",
    ]);
    for (const failure of failures) {
      expect(failure.status).not.toBe("ready");
      expect(Object.hasOwn(failure, "project")).toBe(false);
    }
    expect(useEditorStore.getState()).toBe(stateBefore);
    expect(JSON.stringify(useEditorStore.getState().project)).toBe(
      projectSnapshot,
    );
  });
});
