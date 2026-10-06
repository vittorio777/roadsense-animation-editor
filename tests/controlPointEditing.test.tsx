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

describe("F4.4 Control Point editing", () => {
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

  it.each(["control1", "control2"] as const)(
    "immutably updates only %s on the target Path",
    (control) => {
      const vehicle = createVehicleWithPaths();
      const targetPath = vehicle.movement.paths[0]!;
      const otherPath = vehicle.movement.paths[1]!;
      useEditorStore.getState().selectPath(vehicle.id, targetPath.id);
      useEditorStore.getState().setCurrentTime(4.4);
      const stateBeforeUpdate = useEditorStore.getState();
      const selectionBeforeUpdate = stateBeforeUpdate.selection;
      const untouchedControl =
        control === "control1" ? targetPath.control2 : targetPath.control1;

      stateBeforeUpdate.updatePathControlPoint(
        vehicle.id,
        targetPath.id,
        control,
        420.25,
        180.75,
      );

      const stateAfterUpdate = useEditorStore.getState();
      const vehicleAfterUpdate = stateAfterUpdate.project.scene.objects[0]!;
      const pathAfterUpdate = vehicleAfterUpdate.movement.paths[0]!;
      expect(pathAfterUpdate).not.toBe(targetPath);
      expect(pathAfterUpdate).toMatchObject({
        id: targetPath.id,
        fromPointId: targetPath.fromPointId,
        toPointId: targetPath.toPointId,
        [control]: { x: 420.25, y: 180.75 },
      });
      expect(
        pathAfterUpdate[
          control === "control1" ? "control2" : "control1"
        ],
      ).toBe(untouchedControl);
      expect(vehicleAfterUpdate.movement.paths[1]).toBe(otherPath);
      expect(vehicleAfterUpdate.movement.points).toBe(vehicle.movement.points);
      expect(vehicleAfterUpdate.stateTracks).toBe(vehicle.stateTracks);
      expect(stateAfterUpdate.project.scene.background).toBe(
        stateBeforeUpdate.project.scene.background,
      );
      expect(stateAfterUpdate.selection).toBe(selectionBeforeUpdate);
      expect(stateAfterUpdate.currentTime).toBe(4.4);
    },
  );

  it("keeps invalid and repeated updates as complete state no-ops", () => {
    const vehicle = createVehicleWithPaths();
    const path = vehicle.movement.paths[0]!;

    const requests: Array<() => void> = [
      () =>
        useEditorStore
          .getState()
          .updatePathControlPoint(
            vehicle.id,
            path.id,
            "control1",
            path.control1.x,
            path.control1.y,
          ),
      () =>
        useEditorStore
          .getState()
          .updatePathControlPoint(
            "missing-object",
            path.id,
            "control1",
            1,
            2,
          ),
      () =>
        useEditorStore
          .getState()
          .updatePathControlPoint(
            vehicle.id,
            "missing-path",
            "control1",
            1,
            2,
          ),
      () =>
        useEditorStore
          .getState()
          .updatePathControlPoint(
            vehicle.id,
            path.id,
            "control1",
            Number.NaN,
            2,
          ),
      () =>
        useEditorStore
          .getState()
          .updatePathControlPoint(
            vehicle.id,
            path.id,
            "control1",
            1,
            Number.POSITIVE_INFINITY,
          ),
      () =>
        useEditorStore.getState().updatePathControlPoint(
          vehicle.id,
          path.id,
          "invalid" as "control1",
          1,
          2,
        ),
    ];

    for (const request of requests) {
      const stateBeforeRequest = useEditorStore.getState();
      request();
      expect(useEditorStore.getState()).toBe(stateBeforeRequest);
    }
  });

  it("keeps edited controls when an endpoint moves and through stable topology", () => {
    const vehicle = createVehicleWithPaths();
    const path = vehicle.movement.paths[0]!;
    const toPoint = vehicle.movement.points[1]!;
    useEditorStore
      .getState()
      .updatePathControlPoint(vehicle.id, path.id, "control1", 360, 140);
    useEditorStore
      .getState()
      .updatePathControlPoint(vehicle.id, path.id, "control2", 720, 760);
    const controlsBeforePointMove = structuredClone(
      useEditorStore.getState().project.scene.objects[0]!.movement.paths[0]!,
    );

    useEditorStore
      .getState()
      .updateMovementPointPosition(vehicle.id, toPoint.id, 1080, 640);

    const pathAfterPointMove =
      useEditorStore.getState().project.scene.objects[0]!.movement.paths[0]!;
    expect(pathAfterPointMove.control1).toEqual(
      controlsBeforePointMove.control1,
    );
    expect(pathAfterPointMove.control2).toEqual(
      controlsBeforePointMove.control2,
    );

    useEditorStore.getState().selectPath(vehicle.id, path.id);
    expect(
      useEditorStore.getState().updateMovementPointTime(vehicle.id, toPoint.id, 4),
    ).toEqual({ status: "updated" });
    const pathAfterTimeMove =
      useEditorStore.getState().project.scene.objects[0]!.movement.paths[0]!;
    expect(pathAfterTimeMove.id).toBe(path.id);
    expect(pathAfterTimeMove.control1).toEqual({ x: 360, y: 140 });
    expect(pathAfterTimeMove.control2).toEqual({ x: 720, y: 760 });
    expect(useEditorStore.getState().selection.pathId).toBe(path.id);
  });

  it("shows live read-only Control Point coordinates in Properties", async () => {
    const vehicle = createVehicleWithPaths();
    const path = vehicle.movement.paths[0]!;
    useEditorStore.getState().selectPath(vehicle.id, path.id);
    useEditorStore
      .getState()
      .updatePathControlPoint(vehicle.id, path.id, "control1", 420.25, 180.75);
    useEditorStore
      .getState()
      .updatePathControlPoint(vehicle.id, path.id, "control2", 760.5, 690.25);
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<PropertiesPanel />);
    });

    expect(container.textContent).toContain("Control 1");
    expect(container.textContent).toContain("X 420.25, Y 180.75");
    expect(container.textContent).toContain("Control 2");
    expect(container.textContent).toContain("X 760.5, Y 690.25");
    expect(container.querySelectorAll("input")).toHaveLength(0);
    expect(container.textContent).not.toContain("Snap");
    expect(container.textContent).not.toContain("Tangent");

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
