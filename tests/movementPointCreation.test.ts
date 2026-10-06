import { beforeEach, describe, expect, it } from "vitest";

import { createEmptyAnimationProject } from "../src/model/animation";
import {
  createMovementPoint,
  findMovementPointAtTime,
  resolveMovementPointForEditing,
  type VehicleMovement,
} from "../src/model/movement";
import { useEditorStore } from "../src/store/editorStore";

describe("F3.5 Movement Point creation", () => {
  beforeEach(() => {
    useEditorStore.setState({
      project: createEmptyAnimationProject(),
      currentTime: 0,
      selection: {
        objectId: null,
        movementPointId: null,
        pathId: null,
        stateKeyframeId: null,
      },
    });
    useEditorStore.getState().setSceneBackground("intersection-01");
    useEditorStore.getState().addVehicle("car-blue-sedan");
    const vehicleId = useEditorStore.getState().project.scene.objects[0]?.id;
    useEditorStore.getState().selectObject(vehicleId as string);
  });

  it("creates deterministic Point data and resolves exact or previous positions", () => {
    const movement: VehicleMovement = {
      points: [
        { id: "point-0", time: 0, x: 100, y: 200 },
        { id: "point-3", time: 3, x: 300, y: 400 },
        { id: "point-6", time: 6, x: 600, y: 700 },
      ],
      paths: [],
    };
    const createdPoint = createMovementPoint({
      time: 2,
      x: 220,
      y: 330,
      createId: () => "point-created",
    });

    expect(createdPoint).toEqual({
      id: "point-created",
      time: 2,
      x: 220,
      y: 330,
    });
    expect(findMovementPointAtTime(movement, 3)).toBe(movement.points[1]);
    expect(findMovementPointAtTime(movement, 4)).toBeUndefined();
    expect(resolveMovementPointForEditing(movement, 3)).toBe(movement.points[1]);
    expect(resolveMovementPointForEditing(movement, 5)).toBe(movement.points[1]);
    expect(resolveMovementPointForEditing(movement, 10)).toBe(movement.points[2]);
    expect(movement.points.map((point) => point.time)).toEqual([0, 3, 6]);
  });

  it("does not create data when only currentTime changes", () => {
    const stateBeforeSeek = useEditorStore.getState();
    const pointsBeforeSeek = stateBeforeSeek.project.scene.objects[0]?.movement.points;

    useEditorStore.getState().setCurrentTime(3.3);

    const stateAfterSeek = useEditorStore.getState();
    expect(stateAfterSeek.project).toBe(stateBeforeSeek.project);
    expect(stateAfterSeek.project.scene.objects[0]?.movement.points).toBe(
      pointsBeforeSeek,
    );
    expect(pointsBeforeSeek).toHaveLength(1);
  });

  it("creates a Point at currentTime while preserving unrelated data", () => {
    useEditorStore.getState().setCurrentTime(3.3);
    const stateBeforeUpdate = useEditorStore.getState();
    const vehicleBeforeUpdate = stateBeforeUpdate.project.scene.objects[0]!;
    const initialPoint = vehicleBeforeUpdate.movement.points[0]!;

    useEditorStore
      .getState()
      .updateVehiclePosition(vehicleBeforeUpdate.id, 1000, 520);

    const stateAfterUpdate = useEditorStore.getState();
    const vehicleAfterUpdate = stateAfterUpdate.project.scene.objects[0]!;
    expect(vehicleAfterUpdate.movement.points).toHaveLength(2);
    expect(vehicleAfterUpdate.movement.points[0]).toBe(initialPoint);
    expect(vehicleAfterUpdate.movement.points[1]).toMatchObject({
      time: 3.3,
      x: 1000,
      y: 520,
    });
    expect(vehicleAfterUpdate.movement.points[1]?.id).toEqual(expect.any(String));
    expect(vehicleAfterUpdate.movement.points[1]?.id).not.toBe(initialPoint.id);
    expect(vehicleAfterUpdate.movement.paths).toHaveLength(1);
    expect(vehicleAfterUpdate.movement.paths[0]).toMatchObject({
      fromPointId: initialPoint.id,
      toPointId: vehicleAfterUpdate.movement.points[1]?.id,
      type: "cubicBezier",
    });
    expect(vehicleAfterUpdate.stateTracks).toBe(vehicleBeforeUpdate.stateTracks);
    expect(stateAfterUpdate.project.scene.background).toBe(
      stateBeforeUpdate.project.scene.background,
    );
    expect(stateAfterUpdate.currentTime).toBe(3.3);
    expect(stateAfterUpdate.selection).toBe(stateBeforeUpdate.selection);
    expect(stateAfterUpdate.selection.movementPointId).toBeNull();
  });

  it("keeps a fallback-position commit as a no-op", () => {
    useEditorStore.getState().setCurrentTime(3.3);
    const stateBeforeUpdate = useEditorStore.getState();
    const vehicle = stateBeforeUpdate.project.scene.objects[0]!;

    useEditorStore.getState().updateVehiclePosition(vehicle.id, 800, 450);

    expect(useEditorStore.getState().project).toBe(stateBeforeUpdate.project);
    expect(vehicle.movement.points).toHaveLength(1);
  });

  it("updates an existing current-time Point without changing its ID", () => {
    const vehicleId = useEditorStore.getState().project.scene.objects[0]!.id;
    useEditorStore.getState().setCurrentTime(3.3);
    useEditorStore.getState().updateVehiclePosition(vehicleId, 1000, 520);
    const createdPoint =
      useEditorStore.getState().project.scene.objects[0]!.movement.points[1]!;

    useEditorStore.getState().updateVehiclePosition(vehicleId, 1100, 600);

    const points =
      useEditorStore.getState().project.scene.objects[0]!.movement.points;
    expect(points).toHaveLength(2);
    expect(points[1]).toEqual({
      ...createdPoint,
      x: 1100,
      y: 600,
    });
  });

  it("updates the initial Point at zero without creating another Point", () => {
    const vehicle = useEditorStore.getState().project.scene.objects[0]!;
    const initialPoint = vehicle.movement.points[0]!;

    useEditorStore.getState().updateVehiclePosition(vehicle.id, 640, 360);

    const points =
      useEditorStore.getState().project.scene.objects[0]!.movement.points;
    expect(points).toEqual([{ ...initialPoint, x: 640, y: 360 }]);
    expect(points[0]?.id).toBe(initialPoint.id);
  });

  it("sorts newly created Points chronologically", () => {
    const vehicleId = useEditorStore.getState().project.scene.objects[0]!.id;
    useEditorStore.getState().setCurrentTime(5);
    useEditorStore.getState().updateVehiclePosition(vehicleId, 1200, 600);
    useEditorStore.getState().setCurrentTime(2);
    useEditorStore.getState().updateVehiclePosition(vehicleId, 1000, 500);

    const points =
      useEditorStore.getState().project.scene.objects[0]!.movement.points;
    expect(points.map((point) => point.time)).toEqual([0, 2, 5]);
    expect(points.map(({ time, x, y }) => ({ time, x, y }))).toEqual([
      { time: 0, x: 800, y: 450 },
      { time: 2, x: 1000, y: 500 },
      { time: 5, x: 1200, y: 600 },
    ]);
    expect(new Set(points.map((point) => point.id)).size).toBe(3);
  });
});
