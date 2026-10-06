import { beforeEach, describe, expect, it } from "vitest";

import { clampVehiclePosition } from "../src/editor/components/scene/vehicleDragging";
import { createEmptyAnimationProject } from "../src/model/animation";
import { validateAnimationProject } from "../src/persistence/projectValidator";
import { useEditorStore } from "../src/store/editorStore";

describe("Phase 2 Scene and Vehicle integration", () => {
  beforeEach(() => {
    useEditorStore.setState({
      project: createEmptyAnimationProject("phase-2-verification"),
      currentTime: 0,
      selection: {
        objectId: null,
        movementPointId: null,
        pathId: null,
        stateKeyframeId: null,
      },
    });
  });

  it("preserves Phase 2 data invariants through the complete editing workflow", () => {
    const store = useEditorStore.getState();
    store.setSceneBackground("intersection-01");
    store.addVehicle("car-blue-sedan");
    store.setCurrentTime(4.5);

    const projectAfterAdd = useEditorStore.getState().project;
    const vehicleAfterAdd = projectAfterAdd.scene.objects[0];
    const pointAfterAdd = vehicleAfterAdd?.movement.points[0];

    useEditorStore.getState().selectObject(vehicleAfterAdd?.id as string);
    useEditorStore.getState().clearSelection();
    useEditorStore.getState().selectObject(vehicleAfterAdd?.id as string);

    expect(useEditorStore.getState().project).toBe(projectAfterAdd);

    const draggedPosition = clampVehiclePosition(
      { x: -100, y: 1000 },
      projectAfterAdd.scene.width,
      projectAfterAdd.scene.height,
      120,
      72,
    );
    useEditorStore.getState().updateVehiclePosition(
      vehicleAfterAdd?.id as string,
      draggedPosition.x,
      draggedPosition.y,
    );

    const finalState = useEditorStore.getState();
    const finalProject = finalState.project;
    const finalVehicle = finalProject.scene.objects[0];
    const finalPoint = finalVehicle?.movement.points[1];

    expect(finalProject.scene).toMatchObject({
      width: 1600,
      height: 900,
      background: { assetId: "intersection-01" },
    });
    expect(finalProject.scene.objects).toHaveLength(1);
    expect(finalVehicle).toMatchObject({
      id: vehicleAfterAdd?.id,
      type: "vehicle",
      assetId: "car-blue-sedan",
      movement: {
        points: [
          {
            id: pointAfterAdd?.id,
            time: 0,
            x: 800,
            y: 450,
          },
          {
            time: 4.5,
            x: 60,
            y: 864,
          },
        ],
      },
    });
    expect(finalVehicle?.movement.paths).toHaveLength(1);
    expect(finalVehicle?.movement.paths[0]).toMatchObject({
      fromPointId: pointAfterAdd?.id,
      toPointId: finalPoint?.id,
      type: "cubicBezier",
    });
    expect(finalVehicle?.stateTracks).toEqual(vehicleAfterAdd?.stateTracks);
    expect(finalVehicle?.stateTracks.indicator.keyframes).toHaveLength(1);
    expect(finalVehicle?.stateTracks.brakeLight.keyframes).toHaveLength(1);
    expect(finalVehicle?.stateTracks.headlight.keyframes).toHaveLength(1);
    expect(finalVehicle?.stateTracks.horn.keyframes).toHaveLength(1);
    expect(finalPoint?.id).not.toBe(pointAfterAdd?.id);
    expect(finalPoint?.id).toEqual(expect.any(String));
    expect(finalState.currentTime).toBe(4.5);
    expect(finalState.selection).toEqual({
      objectId: finalVehicle?.id,
      movementPointId: null,
      pathId: null,
      stateKeyframeId: null,
    });
    expect(finalProject).not.toHaveProperty("currentTime");
    expect(finalProject).not.toHaveProperty("selection");
    expect(validateAnimationProject(finalProject)).toEqual({
      valid: true,
      errors: [],
    });
  });
});
