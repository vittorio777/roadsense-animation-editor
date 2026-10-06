import { beforeEach, describe, expect, it } from "vitest";

import { clampVehiclePosition } from "../src/editor/components/scene/vehicleDragging";
import { createEmptyAnimationProject } from "../src/model/animation";
import { useEditorStore } from "../src/store/editorStore";

describe("F2.5 Vehicle dragging", () => {
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
  });

  it("keeps an interior logical position unchanged", () => {
    expect(clampVehiclePosition({ x: 320, y: 240 }, 1600, 900, 120, 72)).toEqual({
      x: 320,
      y: 240,
    });
  });

  it.each([
    [{ x: -10, y: 450 }, { x: 60, y: 450 }],
    [{ x: 1700, y: 450 }, { x: 1540, y: 450 }],
    [{ x: 800, y: -10 }, { x: 800, y: 36 }],
    [{ x: 800, y: 950 }, { x: 800, y: 864 }],
    [{ x: -10, y: 950 }, { x: 60, y: 864 }],
  ])("clamps %o to the complete Vehicle bounds", (position, expected) => {
    expect(clampVehiclePosition(position, 1600, 900, 120, 72)).toEqual(expected);
  });

  it("creates a current-time Movement Point without changing unrelated data", () => {
    useEditorStore.getState().setSceneBackground("intersection-01");
    useEditorStore.getState().addVehicle("car-blue-sedan");
    useEditorStore.getState().setCurrentTime(4);
    const stateBeforeUpdate = useEditorStore.getState();
    const vehicleBeforeUpdate = stateBeforeUpdate.project.scene.objects[0];
    const pointBeforeUpdate = vehicleBeforeUpdate?.movement.points[0];

    useEditorStore.getState().updateVehiclePosition(
      vehicleBeforeUpdate?.id as string,
      420,
      315,
    );

    const stateAfterUpdate = useEditorStore.getState();
    const vehicleAfterUpdate = stateAfterUpdate.project.scene.objects[0];
    expect(vehicleAfterUpdate?.movement.points).toHaveLength(2);
    expect(vehicleAfterUpdate?.movement.points[0]).toBe(pointBeforeUpdate);
    expect(vehicleAfterUpdate?.movement.points[1]).toMatchObject({
      time: 4,
      x: 420,
      y: 315,
    });
    expect(vehicleAfterUpdate?.movement.points[1]?.id).toEqual(
      expect.any(String),
    );
    expect(vehicleAfterUpdate?.id).toBe(vehicleBeforeUpdate?.id);
    expect(vehicleAfterUpdate?.assetId).toBe(vehicleBeforeUpdate?.assetId);
    expect(vehicleAfterUpdate?.movement.paths).toHaveLength(1);
    expect(vehicleAfterUpdate?.movement.paths[0]).toMatchObject({
      fromPointId: pointBeforeUpdate?.id,
      toPointId: vehicleAfterUpdate?.movement.points[1]?.id,
      type: "cubicBezier",
    });
    expect(vehicleAfterUpdate?.stateTracks).toBe(vehicleBeforeUpdate?.stateTracks);
    expect(stateAfterUpdate.project.scene.background).toBe(
      stateBeforeUpdate.project.scene.background,
    );
    expect(stateAfterUpdate.project.scene.width).toBe(1600);
    expect(stateAfterUpdate.project.scene.height).toBe(900);
    expect(stateAfterUpdate.currentTime).toBe(4);
    expect(stateAfterUpdate.selection).toBe(stateBeforeUpdate.selection);
  });

  it("does not mutate the project for an unknown Vehicle or unchanged position", () => {
    useEditorStore.getState().addVehicle("car-blue-sedan");
    const stateBeforeUpdate = useEditorStore.getState();
    const vehicle = stateBeforeUpdate.project.scene.objects[0];
    const point = vehicle?.movement.points[0];

    useEditorStore.getState().updateVehiclePosition("missing-vehicle", 20, 30);
    expect(useEditorStore.getState().project).toBe(stateBeforeUpdate.project);

    useEditorStore.getState().updateVehiclePosition(
      vehicle?.id as string,
      point?.x as number,
      point?.y as number,
    );
    expect(useEditorStore.getState().project).toBe(stateBeforeUpdate.project);
  });
});
