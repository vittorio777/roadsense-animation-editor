import { act, Fragment } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import { PropertiesPanel } from "../src/editor/components/properties/PropertiesPanel";
import { TimelinePanel } from "../src/editor/components/timeline/TimelinePanel";
import { createEmptyAnimationProject } from "../src/model/animation";
import { resolveMovementPointForEditing } from "../src/model/movement";
import { validateAnimationProject } from "../src/persistence/projectValidator";
import { useEditorStore } from "../src/store/editorStore";

const reactTestEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT: boolean;
};

function createPoints() {
  useEditorStore.getState().setSceneBackground("intersection-01");
  useEditorStore.getState().addVehicle("car-blue-sedan");
  const vehicleId = useEditorStore.getState().project.scene.objects[0]!.id;
  useEditorStore.getState().setCurrentTime(3.3);
  useEditorStore.getState().updateVehiclePosition(vehicleId, 1000, 520);
  useEditorStore.getState().setCurrentTime(5);
  useEditorStore.getState().updateVehiclePosition(vehicleId, 600, 300);
  const points = useEditorStore.getState().project.scene.objects[0]!.movement.points;

  return {
    vehicleId,
    initialPointId: points[0]!.id,
    pointAtThreeId: points[1]!.id,
    pointAtFiveId: points[2]!.id,
  };
}

describe("F3.10 Movement Point deletion", () => {
  let container: HTMLDivElement;
  let root: Root | undefined;

  beforeAll(() => {
    reactTestEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterAll(() => {
    reactTestEnvironment.IS_REACT_ACT_ENVIRONMENT = false;
  });

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
    container = document.createElement("div");
    document.body.append(container);
  });

  afterEach(async () => {
    if (root) {
      await act(async () => {
        root?.unmount();
      });
    }
    root = undefined;
    container.remove();
  });

  it("returns typed results and keeps protected or invalid requests atomic", () => {
    const { vehicleId, initialPointId, pointAtThreeId } = createPoints();
    useEditorStore
      .getState()
      .selectMovementPoint(vehicleId, pointAtThreeId);

    for (const [objectId, pointId, expectedStatus] of [
      [vehicleId, initialPointId, "protected-initial"],
      ["missing-object", pointAtThreeId, "invalid"],
      [vehicleId, "missing-point", "invalid"],
    ] as const) {
      const stateBeforeRequest = useEditorStore.getState();
      const result = useEditorStore
        .getState()
        .deleteMovementPoint(objectId, pointId);

      expect(result.status).toBe(expectedStatus);
      expect(useEditorStore.getState()).toBe(stateBeforeRequest);
    }
  });

  it("deletes only the target and clears subordinate selection", () => {
    const { vehicleId, pointAtThreeId, pointAtFiveId } = createPoints();
    useEditorStore
      .getState()
      .selectMovementPoint(vehicleId, pointAtThreeId);
    const stateBeforeDeletion = useEditorStore.getState();
    const vehicleBeforeDeletion = stateBeforeDeletion.project.scene.objects[0]!;
    const initialPoint = vehicleBeforeDeletion.movement.points[0]!;
    const pointAtFive = vehicleBeforeDeletion.movement.points[2]!;

    const result = useEditorStore
      .getState()
      .deleteMovementPoint(vehicleId, pointAtThreeId);

    const stateAfterDeletion = useEditorStore.getState();
    const vehicleAfterDeletion = stateAfterDeletion.project.scene.objects[0]!;
    expect(result).toEqual({ status: "deleted" });
    expect(vehicleAfterDeletion.movement.points).toEqual([
      initialPoint,
      pointAtFive,
    ]);
    expect(vehicleAfterDeletion.movement.points[1]?.id).toBe(pointAtFiveId);
    expect(vehicleAfterDeletion.movement.paths).toHaveLength(1);
    expect(vehicleAfterDeletion.movement.paths[0]).toMatchObject({
      fromPointId: initialPoint.id,
      toPointId: pointAtFive.id,
      type: "cubicBezier",
    });
    expect(vehicleBeforeDeletion.movement.paths).not.toContain(
      vehicleAfterDeletion.movement.paths[0],
    );
    expect(vehicleAfterDeletion.stateTracks).toBe(
      vehicleBeforeDeletion.stateTracks,
    );
    expect(stateAfterDeletion.project.scene.background).toBe(
      stateBeforeDeletion.project.scene.background,
    );
    expect(stateAfterDeletion.selection).toEqual({
      objectId: vehicleId,
      movementPointId: null,
      pathId: null,
      stateKeyframeId: null,
    });
    expect(stateAfterDeletion.currentTime).toBe(3.3);
    expect(
      resolveMovementPointForEditing(vehicleAfterDeletion.movement, 3.3),
    ).toBe(initialPoint);
    expect(validateAnimationProject(stateAfterDeletion.project)).toEqual({
      valid: true,
      errors: [],
    });
  });

  it("preserves selection when deleting an unselected Point", () => {
    const { vehicleId, pointAtThreeId, pointAtFiveId } = createPoints();
    useEditorStore
      .getState()
      .selectMovementPoint(vehicleId, pointAtFiveId);
    const selectionBeforeDeletion = useEditorStore.getState().selection;

    useEditorStore
      .getState()
      .deleteMovementPoint(vehicleId, pointAtThreeId);

    expect(useEditorStore.getState().selection).toBe(selectionBeforeDeletion);
    expect(useEditorStore.getState().currentTime).toBe(5);
  });

  it("confirms deletion for a selected non-initial Point", async () => {
    const { vehicleId, pointAtThreeId } = createPoints();
    useEditorStore
      .getState()
      .selectMovementPoint(vehicleId, pointAtThreeId);
    root = createRoot(container);
    await act(async () => {
      root?.render(
        <Fragment>
          <PropertiesPanel />
          <TimelinePanel />
        </Fragment>,
      );
    });

    const deleteButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Delete point",
    );
    expect(deleteButton).toBeDefined();
    expect(
      container.querySelector(
        `[data-movement-point-id="${pointAtThreeId}"]`,
      ),
    ).not.toBeNull();

    await act(async () => {
      deleteButton?.click();
    });

    const dialog = container.querySelector<HTMLElement>('[role="dialog"]');
    expect(dialog?.textContent).toContain("Delete movement point?");
    expect(dialog?.textContent).toContain("3.30s");
    expect(
      container.querySelector(
        `[data-movement-point-id="${pointAtThreeId}"]`,
      ),
    ).not.toBeNull();

    const confirmButton = Array.from(
      dialog?.querySelectorAll("button") ?? [],
    ).find((button) => button.textContent === "Delete point");
    await act(async () => {
      confirmButton?.click();
    });

    expect(
      container.querySelector(
        `[data-movement-point-id="${pointAtThreeId}"]`,
      ),
    ).toBeNull();
    expect(container.textContent).not.toContain("Selected movement point");
    expect(container.textContent).not.toContain("Delete point");
    expect(container.textContent).toContain("Position");
    expect(useEditorStore.getState().selection).toMatchObject({
      objectId: vehicleId,
      movementPointId: null,
    });
  });

  it("does not expose deletion for the initial Point or object-only selection", async () => {
    const { vehicleId, initialPointId } = createPoints();
    useEditorStore
      .getState()
      .selectMovementPoint(vehicleId, initialPointId);
    root = createRoot(container);
    await act(async () => {
      root?.render(<PropertiesPanel />);
    });
    expect(container.textContent).not.toContain("Delete point");

    await act(async () => {
      useEditorStore.getState().selectObject(vehicleId);
    });
    expect(container.textContent).not.toContain("Delete point");
  });
});
