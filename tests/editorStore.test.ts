import { beforeEach, describe, expect, it } from "vitest";

import { createEmptyAnimationProject } from "../src/model/animation";
import { useEditorStore } from "../src/store/editorStore";

describe("editor store foundation", () => {
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

  it("keeps Animation Data separate from temporary Editor State", () => {
    const project = createEmptyAnimationProject("animation-02");

    useEditorStore.getState().setProject(project);
    useEditorStore.getState().setCurrentTime(3.5);

    expect(useEditorStore.getState().project).toBe(project);
    expect(useEditorStore.getState().currentTime).toBe(3.5);
    expect(project).not.toHaveProperty("currentTime");
    expect(project).not.toHaveProperty("selection");
  });

  it("updates only the Scene background reference", () => {
    const stateBeforeUpdate = useEditorStore.getState();
    const sceneBeforeUpdate = stateBeforeUpdate.project.scene;

    useEditorStore.getState().setCurrentTime(3.5);
    useEditorStore.getState().setSceneBackground("intersection-01");

    const stateAfterUpdate = useEditorStore.getState();
    expect(stateAfterUpdate.project.scene.background).toEqual({
      assetId: "intersection-01",
    });
    expect(stateAfterUpdate.project.scene.width).toBe(sceneBeforeUpdate.width);
    expect(stateAfterUpdate.project.scene.height).toBe(sceneBeforeUpdate.height);
    expect(stateAfterUpdate.project.scene.objects).toBe(sceneBeforeUpdate.objects);
    expect(stateAfterUpdate.currentTime).toBe(3.5);
    expect(stateAfterUpdate.selection).toBe(stateBeforeUpdate.selection);
  });

  it("adds complete Vehicle instances without changing Editor state", () => {
    useEditorStore.getState().setSceneBackground("intersection-01");
    useEditorStore.getState().setCurrentTime(2.5);
    const stateBeforeAdd = useEditorStore.getState();

    useEditorStore.getState().addVehicle("car-blue-sedan");

    const stateAfterAdd = useEditorStore.getState();
    expect(stateAfterAdd.project.scene.objects).toHaveLength(1);
    expect(stateAfterAdd.project.scene.objects[0]).toMatchObject({
      type: "vehicle",
      assetId: "car-blue-sedan",
      movement: {
        points: [{ time: 0, x: 800, y: 450 }],
        paths: [],
      },
    });
    expect(stateAfterAdd.project.scene.background).toEqual({
      assetId: "intersection-01",
    });
    expect(stateAfterAdd.currentTime).toBe(2.5);
    expect(stateAfterAdd.selection).toBe(stateBeforeAdd.selection);

    useEditorStore.getState().addVehicle("car-blue-sedan");
    expect(useEditorStore.getState().project.scene.objects).toHaveLength(2);
    expect(useEditorStore.getState().project.scene.objects[0]).toBe(
      stateAfterAdd.project.scene.objects[0],
    );
    expect(useEditorStore.getState().project.scene.objects[1]).toMatchObject({
      type: "vehicle",
      assetId: "car-blue-sedan",
      movement: {
        points: [{ time: 0, x: 960, y: 450 }],
        paths: [],
      },
    });
    expect(useEditorStore.getState().currentTime).toBe(2.5);
    expect(useEditorStore.getState().selection).toBe(stateBeforeAdd.selection);
  });

  it("selects and clears an object without mutating Animation Data", () => {
    useEditorStore.getState().addVehicle("car-blue-sedan");
    useEditorStore.getState().setCurrentTime(3);
    const projectBeforeSelection = useEditorStore.getState().project;
    const vehicleId = projectBeforeSelection.scene.objects[0]?.id;

    expect(vehicleId).toBeDefined();
    useEditorStore.getState().selectObject(vehicleId as string);

    expect(useEditorStore.getState().selection).toEqual({
      objectId: vehicleId,
      movementPointId: null,
      pathId: null,
      stateKeyframeId: null,
    });
    expect(useEditorStore.getState().project).toBe(projectBeforeSelection);
    expect(useEditorStore.getState().currentTime).toBe(3);

    useEditorStore.getState().clearSelection();

    expect(useEditorStore.getState().selection).toEqual({
      objectId: null,
      movementPointId: null,
      pathId: null,
      stateKeyframeId: null,
    });
    expect(useEditorStore.getState().project).toBe(projectBeforeSelection);
  });
});
