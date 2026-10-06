import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it } from "vitest";

import { PropertiesPanel } from "../src/editor/components/properties/PropertiesPanel";
import { createEmptyAnimationProject } from "../src/model/animation";
import { useEditorStore } from "../src/store/editorStore";

function createVehicleWithPaths() {
  useEditorStore.getState().addVehicle("car-blue-sedan");
  const vehicleId = useEditorStore.getState().project.scene.objects[0]!.id;
  useEditorStore.getState().setCurrentTime(3);
  useEditorStore.getState().updateVehiclePosition(vehicleId, 1000, 520);
  useEditorStore.getState().setCurrentTime(5);
  useEditorStore.getState().updateVehiclePosition(vehicleId, 1200, 600);

  return useEditorStore.getState().project.scene.objects[0]!;
}

describe("F4.3 Path selection", () => {
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

  it("selects a valid owned Path without changing time or Animation Data", () => {
    const vehicle = createVehicleWithPaths();
    const path = vehicle.movement.paths[0]!;
    useEditorStore.getState().setCurrentTime(4.4);
    useEditorStore.setState({
      selection: {
        objectId: vehicle.id,
        movementPointId: vehicle.movement.points[1]!.id,
        pathId: null,
        stateKeyframeId: "old-state-selection",
      },
    });
    const projectBeforeSelection = useEditorStore.getState().project;

    useEditorStore.getState().selectPath(vehicle.id, path.id);

    const stateAfterSelection = useEditorStore.getState();
    expect(stateAfterSelection.selection).toEqual({
      objectId: vehicle.id,
      movementPointId: null,
      pathId: path.id,
      stateKeyframeId: null,
    });
    expect(stateAfterSelection.currentTime).toBe(4.4);
    expect(stateAfterSelection.project).toBe(projectBeforeSelection);

    const stateBeforeRepeat = useEditorStore.getState();
    stateBeforeRepeat.selectPath(vehicle.id, path.id);
    expect(useEditorStore.getState()).toBe(stateBeforeRepeat);
  });

  it("keeps invalid and ownership-mismatched Path requests atomic", () => {
    const vehicle = createVehicleWithPaths();
    const path = vehicle.movement.paths[0]!;
    const secondVehicle = {
      ...structuredClone(vehicle),
      id: "second-vehicle",
      movement: {
        ...structuredClone(vehicle.movement),
        paths: [],
      },
    };
    useEditorStore.getState().setProject({
      ...useEditorStore.getState().project,
      scene: {
        ...useEditorStore.getState().project.scene,
        objects: [vehicle, secondVehicle],
      },
    });

    for (const request of [
      ["missing-object", path.id],
      [vehicle.id, "missing-path"],
      [secondVehicle.id, path.id],
    ] as const) {
      const stateBeforeRequest = useEditorStore.getState();
      stateBeforeRequest.selectPath(request[0], request[1]);
      expect(useEditorStore.getState()).toBe(stateBeforeRequest);
    }
  });

  it("preserves valid Path selection and clears it when topology removes the Path", () => {
    const vehicle = createVehicleWithPaths();
    const firstPath = vehicle.movement.paths[0]!;
    const middlePoint = vehicle.movement.points[1]!;
    useEditorStore.getState().selectPath(vehicle.id, firstPath.id);

    expect(
      useEditorStore
        .getState()
        .updateMovementPointTime(vehicle.id, middlePoint.id, 4),
    ).toEqual({ status: "updated" });
    expect(useEditorStore.getState().selection.pathId).toBe(firstPath.id);

    expect(
      useEditorStore
        .getState()
        .updateMovementPointTime(vehicle.id, middlePoint.id, 6),
    ).toEqual({ status: "updated" });
    expect(useEditorStore.getState().selection).toEqual({
      objectId: vehicle.id,
      movementPointId: null,
      pathId: null,
      stateKeyframeId: null,
    });

    const pathBeforeDeletion =
      useEditorStore.getState().project.scene.objects[0]!.movement.paths[0]!;
    const pointAtFive =
      useEditorStore.getState().project.scene.objects[0]!.movement.points[1]!;
    useEditorStore.getState().selectPath(vehicle.id, pathBeforeDeletion.id);
    expect(
      useEditorStore
        .getState()
        .deleteMovementPoint(vehicle.id, pointAtFive.id),
    ).toEqual({ status: "deleted" });
    expect(useEditorStore.getState().selection).toEqual({
      objectId: vehicle.id,
      movementPointId: null,
      pathId: null,
      stateKeyframeId: null,
    });
  });

  it("clears a selected Path when Point insertion splits its topology", () => {
    const vehicle = createVehicleWithPaths();
    const firstPath = vehicle.movement.paths[0]!;
    useEditorStore.getState().selectPath(vehicle.id, firstPath.id);
    useEditorStore.getState().setCurrentTime(1.5);

    useEditorStore.getState().updateVehiclePosition(vehicle.id, 900, 480);

    expect(useEditorStore.getState().selection).toEqual({
      objectId: vehicle.id,
      movementPointId: null,
      pathId: null,
      stateKeyframeId: null,
    });
  });

  it("shows read-only Path Properties without position or editing controls", async () => {
    const vehicle = createVehicleWithPaths();
    const path = vehicle.movement.paths[0]!;
    useEditorStore.getState().selectPath(vehicle.id, path.id);
    const projectBeforeRender = useEditorStore.getState().project;
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<PropertiesPanel />);
    });

    expect(container.textContent).toContain("Selected path");
    expect(container.textContent).toContain("Cubic Bézier");
    expect(container.textContent).toContain(path.id);
    expect(container.textContent).toContain(path.fromPointId);
    expect(container.textContent).toContain(path.toPointId);
    expect(container.querySelector('input[aria-label="Position X"]')).toBeNull();
    expect(container.querySelector('input[aria-label="Position Y"]')).toBeNull();
    expect(container.textContent).not.toContain("Delete point");
    expect(container.textContent).not.toContain("Control point");
    expect(useEditorStore.getState().project).toBe(projectBeforeRender);

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
