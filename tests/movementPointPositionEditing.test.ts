import { beforeEach, describe, expect, it } from "vitest";

import { createEmptyAnimationProject } from "../src/model/animation";
import { useEditorStore } from "../src/store/editorStore";

describe("F3.7 Movement Point position editing", () => {
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
    useEditorStore.getState().setCurrentTime(3.3);
    useEditorStore
      .getState()
      .updateVehiclePosition(vehicleId as string, 1000, 520);
  });

  it("updates only the target Point coordinates while preserving stable data", () => {
    const stateBeforeUpdate = useEditorStore.getState();
    const vehicleBeforeUpdate = stateBeforeUpdate.project.scene.objects[0]!;
    const firstPoint = vehicleBeforeUpdate.movement.points[0]!;
    const targetPoint = vehicleBeforeUpdate.movement.points[1]!;
    useEditorStore
      .getState()
      .selectMovementPoint(vehicleBeforeUpdate.id, targetPoint.id);
    const selectionBeforeUpdate = useEditorStore.getState().selection;

    useEditorStore
      .getState()
      .updateMovementPointPosition(
        vehicleBeforeUpdate.id,
        targetPoint.id,
        1120,
        610,
      );

    const stateAfterUpdate = useEditorStore.getState();
    const vehicleAfterUpdate = stateAfterUpdate.project.scene.objects[0]!;
    expect(vehicleAfterUpdate.movement.points[0]).toBe(firstPoint);
    expect(vehicleAfterUpdate.movement.points[1]).toEqual({
      ...targetPoint,
      x: 1120,
      y: 610,
    });
    expect(vehicleAfterUpdate.movement.points.map((point) => point.time)).toEqual([
      0, 3.3,
    ]);
    expect(vehicleAfterUpdate.movement.paths).toBe(
      vehicleBeforeUpdate.movement.paths,
    );
    expect(vehicleAfterUpdate.stateTracks).toBe(vehicleBeforeUpdate.stateTracks);
    expect(stateAfterUpdate.project.scene.background).toBe(
      stateBeforeUpdate.project.scene.background,
    );
    expect(stateAfterUpdate.selection).toBe(selectionBeforeUpdate);
    expect(stateAfterUpdate.currentTime).toBe(3.3);
  });

  it("keeps unchanged and invalid requests as complete no-ops", () => {
    const stateBeforeRequests = useEditorStore.getState();
    const vehicle = stateBeforeRequests.project.scene.objects[0]!;
    const point = vehicle.movement.points[1]!;

    useEditorStore
      .getState()
      .updateMovementPointPosition(vehicle.id, point.id, point.x, point.y);
    expect(useEditorStore.getState()).toBe(stateBeforeRequests);

    useEditorStore
      .getState()
      .updateMovementPointPosition("missing-object", point.id, 1, 2);
    expect(useEditorStore.getState()).toBe(stateBeforeRequests);

    useEditorStore
      .getState()
      .updateMovementPointPosition(vehicle.id, "missing-point", 1, 2);
    expect(useEditorStore.getState()).toBe(stateBeforeRequests);
  });

  it("edits a selected Point independently from currentTime", () => {
    const vehicle = useEditorStore.getState().project.scene.objects[0]!;
    const selectedPoint = vehicle.movement.points[1]!;
    useEditorStore
      .getState()
      .selectMovementPoint(vehicle.id, selectedPoint.id);
    useEditorStore.getState().setCurrentTime(7.5);
    const selectionBeforeUpdate = useEditorStore.getState().selection;

    useEditorStore
      .getState()
      .updateMovementPointPosition(vehicle.id, selectedPoint.id, 700, 350);

    const stateAfterUpdate = useEditorStore.getState();
    const points = stateAfterUpdate.project.scene.objects[0]!.movement.points;
    expect(points).toHaveLength(2);
    expect(points[1]).toEqual({ ...selectedPoint, x: 700, y: 350 });
    expect(points.some((point) => point.time === 7.5)).toBe(false);
    expect(stateAfterUpdate.currentTime).toBe(7.5);
    expect(stateAfterUpdate.selection).toBe(selectionBeforeUpdate);
  });
});
