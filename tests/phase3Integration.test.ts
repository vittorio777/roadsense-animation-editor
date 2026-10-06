import { beforeEach, describe, expect, it } from "vitest";

import { createEmptyAnimationProject } from "../src/model/animation";
import { resolveMovementPointForEditing } from "../src/model/movement";
import { validateAnimationProject } from "../src/persistence/projectValidator";
import { useEditorStore } from "../src/store/editorStore";

describe("Phase 3 Timeline and Movement integration", () => {
  beforeEach(() => {
    useEditorStore.setState({
      project: createEmptyAnimationProject("phase-3-verification"),
      currentTime: 0,
      selection: {
        objectId: null,
        movementPointId: null,
        pathId: null,
        stateKeyframeId: null,
      },
    });
  });

  it("preserves Movement invariants through the complete editing workflow", () => {
    const store = useEditorStore.getState();
    store.setSceneBackground("intersection-01");
    store.addVehicle("car-blue-sedan");

    const stateAfterAdd = useEditorStore.getState();
    const projectAfterAdd = stateAfterAdd.project;
    const vehicleAfterAdd = projectAfterAdd.scene.objects[0]!;
    const initialPoint = vehicleAfterAdd.movement.points[0]!;
    const initialStateTracks = vehicleAfterAdd.stateTracks;

    expect(vehicleAfterAdd.movement.points).toEqual([
      expect.objectContaining({ time: 0, x: 800, y: 450 }),
    ]);
    expect(vehicleAfterAdd.movement.paths).toEqual([]);

    useEditorStore.getState().setCurrentTime(3.3);
    expect(useEditorStore.getState().project).toBe(projectAfterAdd);
    useEditorStore
      .getState()
      .updateVehiclePosition(vehicleAfterAdd.id, 1000, 520);

    const projectAfterCreation = useEditorStore.getState().project;
    const pointAtThree = projectAfterCreation.scene.objects[0]!.movement.points[1]!;
    expect(pointAtThree).toMatchObject({ time: 3.3, x: 1000, y: 520 });

    useEditorStore
      .getState()
      .updateVehiclePosition(vehicleAfterAdd.id, 1100, 560);
    const pointAfterExistingTimeUpdate =
      useEditorStore.getState().project.scene.objects[0]!.movement.points[1]!;
    expect(pointAfterExistingTimeUpdate).toEqual({
      ...pointAtThree,
      x: 1100,
      y: 560,
    });

    useEditorStore.getState().setCurrentTime(5);
    useEditorStore
      .getState()
      .updateVehiclePosition(vehicleAfterAdd.id, 600, 300);
    const pointAtFive =
      useEditorStore.getState().project.scene.objects[0]!.movement.points[2]!;

    useEditorStore
      .getState()
      .selectMovementPoint(vehicleAfterAdd.id, pointAfterExistingTimeUpdate.id);
    useEditorStore.getState().updateMovementPointPosition(
      vehicleAfterAdd.id,
      pointAfterExistingTimeUpdate.id,
      1040,
      540,
    );
    expect(
      useEditorStore
        .getState()
        .project.scene.objects[0]!.movement.points.find(
          (point) => point.id === pointAfterExistingTimeUpdate.id,
        ),
    ).toMatchObject({ time: 3.3, x: 1040, y: 540 });

    expect(
      useEditorStore.getState().updateMovementPointTime(
        vehicleAfterAdd.id,
        pointAfterExistingTimeUpdate.id,
        4.2,
      ),
    ).toEqual({ status: "updated" });
    expect(useEditorStore.getState()).toMatchObject({
      currentTime: 4.2,
      selection: {
        objectId: vehicleAfterAdd.id,
        movementPointId: pointAfterExistingTimeUpdate.id,
        pathId: null,
        stateKeyframeId: null,
      },
    });

    const stateBeforeConflict = useEditorStore.getState();
    expect(
      stateBeforeConflict.updateMovementPointTime(
        vehicleAfterAdd.id,
        pointAfterExistingTimeUpdate.id,
        5,
      ),
    ).toEqual({ status: "duplicate-time", time: 5 });
    expect(useEditorStore.getState()).toBe(stateBeforeConflict);

    expect(
      useEditorStore.getState().deleteMovementPoint(
        vehicleAfterAdd.id,
        pointAfterExistingTimeUpdate.id,
      ),
    ).toEqual({ status: "deleted" });

    const stateAfterDeletion = useEditorStore.getState();
    const finalProject = stateAfterDeletion.project;
    const finalVehicle = finalProject.scene.objects[0]!;
    expect(finalVehicle.movement.points).toEqual([initialPoint, pointAtFive]);
    expect(finalVehicle.movement.points.map((point) => point.time)).toEqual([
      0, 5,
    ]);
    expect(finalVehicle.movement.paths).toHaveLength(1);
    expect(finalVehicle.movement.paths[0]).toMatchObject({
      fromPointId: initialPoint.id,
      toPointId: pointAtFive.id,
      type: "cubicBezier",
    });
    expect(finalVehicle.stateTracks).toBe(initialStateTracks);
    expect(stateAfterDeletion.currentTime).toBe(4.2);
    expect(stateAfterDeletion.selection).toEqual({
      objectId: vehicleAfterAdd.id,
      movementPointId: null,
      pathId: null,
      stateKeyframeId: null,
    });
    expect(resolveMovementPointForEditing(finalVehicle.movement, 4.2)).toBe(
      initialPoint,
    );

    const stateBeforeProtectedDeletion = useEditorStore.getState();
    expect(
      stateBeforeProtectedDeletion.deleteMovementPoint(
        vehicleAfterAdd.id,
        initialPoint.id,
      ),
    ).toEqual({ status: "protected-initial" });
    expect(useEditorStore.getState()).toBe(stateBeforeProtectedDeletion);

    expect(finalProject.scene).toMatchObject({
      width: 1600,
      height: 900,
      background: { assetId: "intersection-01" },
    });
    expect(finalProject.scene.objects).toHaveLength(1);
    expect(finalVehicle).toMatchObject({
      id: vehicleAfterAdd.id,
      type: "vehicle",
      assetId: "car-blue-sedan",
    });
    expect(finalProject).not.toHaveProperty("currentTime");
    expect(finalProject).not.toHaveProperty("selection");
    expect(validateAnimationProject(finalProject)).toEqual({
      valid: true,
      errors: [],
    });
  });

  it("rejects missing initial and duplicate-time Phase 3 projects", () => {
    useEditorStore.getState().addVehicle("car-blue-sedan");
    const validProject = useEditorStore.getState().project;
    const vehicle = validProject.scene.objects[0]!;
    const initialPoint = vehicle.movement.points[0]!;

    const missingInitialProject = structuredClone(validProject);
    missingInitialProject.scene.objects[0]!.movement.points = [
      { ...initialPoint, id: "point-at-three", time: 3 },
    ];
    expect(validateAnimationProject(missingInitialProject)).toMatchObject({
      valid: false,
      errors: [
        "scene.objects[0].movement must include a 0-second Movement Point.",
      ],
    });

    const duplicateTimeProject = structuredClone(validProject);
    duplicateTimeProject.scene.objects[0]!.movement.points.push({
      ...initialPoint,
      id: "duplicate-zero-point",
    });
    expect(validateAnimationProject(duplicateTimeProject)).toMatchObject({
      valid: false,
      errors: expect.arrayContaining([
        "scene.objects[0].movement contains duplicate time 0.",
      ]),
    });
  });
});
