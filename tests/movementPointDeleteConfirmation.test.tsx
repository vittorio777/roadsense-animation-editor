import { act } from "react";
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
import { createEmptyAnimationProject } from "../src/model/animation";
import { useEditorStore } from "../src/store/editorStore";

const reactTestEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT: boolean;
};

function createVehicleWithPoints() {
  useEditorStore.getState().addVehicle("car-blue-sedan");
  const vehicleId = useEditorStore.getState().project.scene.objects[0]!.id;
  useEditorStore.getState().setCurrentTime(3.3);
  useEditorStore.getState().updateVehiclePosition(vehicleId, 1000, 520);
  useEditorStore.getState().setCurrentTime(5);
  useEditorStore.getState().updateVehiclePosition(vehicleId, 620, 320);
  const points = useEditorStore.getState().project.scene.objects[0]!.movement.points;

  return {
    vehicleId,
    initialPoint: points[0]!,
    pointAtThree: points[1]!,
    pointAtFive: points[2]!,
  };
}

function findButton(root: ParentNode, label: string) {
  const button = Array.from(root.querySelectorAll("button")).find(
    (candidate) => candidate.textContent?.trim() === label,
  );
  expect(button).toBeDefined();
  return button as HTMLButtonElement;
}

describe("F7.4 Movement Point delete confirmation", () => {
  let container: HTMLDivElement;
  let root: Root;

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
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  async function renderProperties() {
    await act(async () => root.render(<PropertiesPanel />));
  }

  it("shows the command only for a selected non-initial Point", async () => {
    const { vehicleId, initialPoint, pointAtThree } = createVehicleWithPoints();
    useEditorStore
      .getState()
      .selectMovementPoint(vehicleId, pointAtThree.id);
    await renderProperties();
    expect(findButton(container, "Delete point").getAttribute("aria-haspopup"))
      .toBe("dialog");

    await act(async () => {
      useEditorStore
        .getState()
        .selectMovementPoint(vehicleId, initialPoint.id);
    });
    expect(container.textContent).not.toContain("Delete point");

    await act(async () => useEditorStore.getState().selectObject(vehicleId));
    expect(container.textContent).not.toContain("Delete point");

    const path = useEditorStore.getState().project.scene.objects[0]!.movement.paths[0]!;
    await act(async () => useEditorStore.getState().selectPath(vehicleId, path.id));
    expect(container.textContent).not.toContain("Delete point");

    const stateKeyframe = useEditorStore
      .getState()
      .project.scene.objects[0]!.stateTracks.horn.keyframes[0]!;
    await act(async () => {
      useEditorStore
        .getState()
        .selectStateKeyframe(vehicleId, stateKeyframe.id);
    });
    expect(container.textContent).not.toContain("Delete point");
  });

  it("opens an accessible locked dialog without mutating Store state", async () => {
    const { vehicleId, pointAtThree } = createVehicleWithPoints();
    useEditorStore
      .getState()
      .selectMovementPoint(vehicleId, pointAtThree.id);
    await renderProperties();
    const trigger = findButton(container, "Delete point");
    const stateBeforeDialog = useEditorStore.getState();

    await act(async () => trigger.click());
    const dialog = container.querySelector<HTMLElement>('[role="dialog"]')!;
    const cancelButton = findButton(dialog, "Cancel");
    const confirmButton = findButton(dialog, "Delete point");
    expect(container.querySelectorAll('[role="dialog"]')).toHaveLength(1);
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.getAttribute("aria-labelledby")).toBeTruthy();
    expect(dialog.getAttribute("aria-describedby")).toBeTruthy();
    expect(dialog.textContent).toContain("Delete movement point?");
    expect(dialog.textContent).toContain("3.30s");
    expect(dialog.textContent).toContain(pointAtThree.id);
    expect(dialog.textContent).toContain("Connected paths will be rebuilt");
    expect(document.activeElement).toBe(cancelButton);
    expect(useEditorStore.getState()).toBe(stateBeforeDialog);

    confirmButton.focus();
    await act(async () => {
      confirmButton.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Tab", bubbles: true }),
      );
    });
    expect(document.activeElement).toBe(cancelButton);
    await act(async () => {
      cancelButton.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Tab",
          shiftKey: true,
          bubbles: true,
        }),
      );
    });
    expect(document.activeElement).toBe(confirmButton);
  });

  it("cancels with the button or Escape as a complete no-op", async () => {
    const { vehicleId, pointAtThree } = createVehicleWithPoints();
    useEditorStore
      .getState()
      .selectMovementPoint(vehicleId, pointAtThree.id);
    await renderProperties();
    const trigger = findButton(container, "Delete point");
    const stateBeforeDialog = useEditorStore.getState();

    await act(async () => trigger.click());
    await act(async () => {
      findButton(
        container.querySelector<HTMLElement>('[role="dialog"]')!,
        "Cancel",
      ).click();
    });
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(useEditorStore.getState()).toBe(stateBeforeDialog);
    expect(document.activeElement).toBe(trigger);

    await act(async () => trigger.click());
    const dialog = container.querySelector<HTMLElement>('[role="dialog"]')!;
    await act(async () => {
      dialog.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
    });
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(useEditorStore.getState()).toBe(stateBeforeDialog);
    expect(document.activeElement).toBe(trigger);
  });

  it("keeps the original target when selection changes before confirmation", async () => {
    const { vehicleId, pointAtThree, pointAtFive } = createVehicleWithPoints();
    useEditorStore
      .getState()
      .selectMovementPoint(vehicleId, pointAtThree.id);
    await renderProperties();
    await act(async () => findButton(container, "Delete point").click());

    await act(async () => {
      useEditorStore
        .getState()
        .selectMovementPoint(vehicleId, pointAtFive.id);
    });
    const dialog = container.querySelector<HTMLElement>('[role="dialog"]')!;
    expect(dialog.textContent).toContain(pointAtThree.id);
    expect(dialog.textContent).not.toContain(pointAtFive.id);
    await act(async () => findButton(dialog, "Delete point").click());

    const stateAfterDeletion = useEditorStore.getState();
    const vehicle = stateAfterDeletion.project.scene.objects[0]!;
    expect(vehicle.movement.points.map((point) => point.id)).not.toContain(
      pointAtThree.id,
    );
    expect(vehicle.movement.points.map((point) => point.id)).toContain(
      pointAtFive.id,
    );
    expect(stateAfterDeletion.selection).toMatchObject({
      objectId: vehicleId,
      movementPointId: pointAtFive.id,
    });
    expect(stateAfterDeletion.currentTime).toBe(5);
    expect(vehicle.movement.paths).toHaveLength(1);
    expect(vehicle.movement.paths[0]).toMatchObject({
      fromPointId: vehicle.movement.points[0]!.id,
      toPointId: pointAtFive.id,
    });
  });

  it("treats a stale locked target as a safe no-op", async () => {
    const { vehicleId, pointAtThree, pointAtFive } = createVehicleWithPoints();
    useEditorStore
      .getState()
      .selectMovementPoint(vehicleId, pointAtThree.id);
    await renderProperties();
    await act(async () => findButton(container, "Delete point").click());

    await act(async () => {
      useEditorStore
        .getState()
        .deleteMovementPoint(vehicleId, pointAtThree.id);
      useEditorStore
        .getState()
        .selectMovementPoint(vehicleId, pointAtFive.id);
    });
    const stateBeforeStaleConfirmation = useEditorStore.getState();
    const dialog = container.querySelector<HTMLElement>('[role="dialog"]')!;
    await act(async () => findButton(dialog, "Delete point").click());

    expect(useEditorStore.getState()).toBe(stateBeforeStaleConfirmation);
    expect(useEditorStore.getState().selection.movementPointId).toBe(
      pointAtFive.id,
    );
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });
});
