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
import { parseAnimationProjectJson } from "../src/persistence/projectParser";
import { serializeAnimationProject } from "../src/persistence/projectSerializer";
import {
  isAnimationProject,
  validateAnimationProject,
} from "../src/persistence/projectValidator";
import { useEditorStore } from "../src/store/editorStore";

const reactTestEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT: boolean;
};

function resetStore() {
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
}

function addVehicles(count: number) {
  for (let index = 0; index < count; index += 1) {
    useEditorStore.getState().addVehicle("car-blue-sedan");
  }

  return useEditorStore.getState().project.scene.objects;
}

function findButton(root: ParentNode, label: string) {
  const button = Array.from(root.querySelectorAll("button")).find(
    (candidate) => candidate.textContent?.trim() === label,
  );
  expect(button).toBeDefined();
  return button as HTMLButtonElement;
}

describe("F7.3 Vehicle deletion", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeAll(() => {
    reactTestEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterAll(() => {
    reactTestEnvironment.IS_REACT_ACT_ENVIRONMENT = false;
  });

  beforeEach(() => {
    resetStore();
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  async function renderPanels() {
    await act(async () => {
      root.render(
        <Fragment>
          <TimelinePanel />
          <PropertiesPanel />
        </Fragment>,
      );
    });
  }

  it("returns typed results and keeps an invalid request as a complete no-op", () => {
    addVehicles(2);
    const first = useEditorStore.getState().project.scene.objects[0]!;
    useEditorStore.getState().selectObject(first.id);
    const stateBeforeRequest = useEditorStore.getState();

    expect(useEditorStore.getState().deleteVehicle("missing-vehicle")).toEqual({
      status: "invalid",
    });
    expect(useEditorStore.getState()).toBe(stateBeforeRequest);
  });

  it("removes only the target and all of its nested animation data", () => {
    useEditorStore.getState().setSceneBackground("intersection-01");
    const [first, second, third] = addVehicles(3);
    useEditorStore.getState().setCurrentTime(3);
    useEditorStore.getState().updateVehiclePosition(second!.id, 1040, 540);
    useEditorStore
      .getState()
      .createVehicleStateInterval(second!.id, "headlight", 1, 2.5);
    const target = useEditorStore.getState().project.scene.objects[1]!;
    const selectedPath = target.movement.paths[0]!;
    useEditorStore.getState().selectPath(target.id, selectedPath.id);
    const stateBeforeDeletion = useEditorStore.getState();
    const firstBeforeDeletion = stateBeforeDeletion.project.scene.objects[0]!;
    const thirdBeforeDeletion = stateBeforeDeletion.project.scene.objects[2]!;

    expect(target.movement.points.length).toBeGreaterThan(1);
    expect(target.movement.paths.length).toBeGreaterThan(0);
    expect(target.stateTracks.headlight.keyframes.length).toBeGreaterThan(1);
    expect(useEditorStore.getState().deleteVehicle(target.id)).toEqual({
      status: "deleted",
    });

    const stateAfterDeletion = useEditorStore.getState();
    expect(stateAfterDeletion.project.scene.objects).toEqual([
      firstBeforeDeletion,
      thirdBeforeDeletion,
    ]);
    expect(stateAfterDeletion.project.scene.objects[0]).toBe(first);
    expect(stateAfterDeletion.project.scene.objects[1]).toBe(third);
    expect(stateAfterDeletion.project.scene.background).toBe(
      stateBeforeDeletion.project.scene.background,
    );
    expect(stateAfterDeletion.project.scene.width).toBe(
      stateBeforeDeletion.project.scene.width,
    );
    expect(stateAfterDeletion.project.scene.height).toBe(
      stateBeforeDeletion.project.scene.height,
    );
    expect(stateAfterDeletion.currentTime).toBe(3);
    expect(stateAfterDeletion.selection).toEqual({
      objectId: null,
      movementPointId: null,
      pathId: null,
      stateKeyframeId: null,
    });
    expect(validateAnimationProject(stateAfterDeletion.project)).toEqual({
      valid: true,
      errors: [],
    });

    const serialization = serializeAnimationProject(stateAfterDeletion.project);
    expect(serialization.status).toBe("serialized");
    if (serialization.status === "serialized") {
      expect(serialization.json).not.toContain(target.id);
      for (const point of target.movement.points) {
        expect(serialization.json).not.toContain(point.id);
      }
      for (const path of target.movement.paths) {
        expect(serialization.json).not.toContain(path.id);
      }
      const parsed = parseAnimationProjectJson(serialization.json);
      expect(parsed.status).toBe("parsed");
      if (parsed.status === "parsed" && isAnimationProject(parsed.value)) {
        expect(parsed.value.scene.objects.map((vehicle) => vehicle.id)).toEqual([
          first!.id,
          third!.id,
        ]);
      }
    }
  });

  it("preserves a valid selection when deleting a different Vehicle", () => {
    const [first, second] = addVehicles(2);
    const firstPoint = first!.movement.points[0]!;
    useEditorStore
      .getState()
      .selectMovementPoint(first!.id, firstPoint.id);
    const selectionBeforeDeletion = useEditorStore.getState().selection;

    expect(useEditorStore.getState().deleteVehicle(second!.id)).toEqual({
      status: "deleted",
    });
    expect(useEditorStore.getState().selection).toBe(selectionBeforeDeletion);
  });

  it("opens an accessible dialog without mutation and cancels safely", async () => {
    const [vehicle] = addVehicles(1);
    useEditorStore.getState().selectObject(vehicle!.id);
    await renderPanels();
    const trigger = container.querySelector<HTMLButtonElement>(
      'button[aria-haspopup="dialog"]',
    )!;
    const stateBeforeDialog = useEditorStore.getState();

    await act(async () => trigger.click());
    const dialog = container.querySelector<HTMLElement>('[role="dialog"]')!;
    const cancelButton = findButton(dialog, "Cancel");
    const confirmButton = findButton(dialog, "Delete vehicle");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.getAttribute("aria-labelledby")).toBeTruthy();
    expect(dialog.getAttribute("aria-describedby")).toBeTruthy();
    expect(dialog.textContent).toContain("Delete vehicle?");
    expect(dialog.textContent).toContain("Car Blue Sedan");
    expect(dialog.textContent).toContain(vehicle!.id);
    expect(dialog.textContent).toContain("movement points, paths, and state tracks");
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

    await act(async () => cancelButton.click());
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(useEditorStore.getState()).toBe(stateBeforeDialog);
    expect(document.activeElement).toBe(trigger);

    await act(async () => trigger.click());
    const reopenedDialog = container.querySelector<HTMLElement>('[role="dialog"]')!;
    await act(async () => {
      reopenedDialog.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
    });
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(useEditorStore.getState()).toBe(stateBeforeDialog);
    expect(document.activeElement).toBe(trigger);
  });

  it("locks the target and removes it across Timeline and Properties on confirmation", async () => {
    const [first, second] = addVehicles(2);
    useEditorStore.getState().selectObject(first!.id);
    await renderPanels();
    const trigger = container.querySelector<HTMLButtonElement>(
      'button[aria-haspopup="dialog"]',
    )!;
    await act(async () => trigger.click());

    await act(async () => {
      useEditorStore.getState().selectObject(second!.id);
    });
    const dialog = container.querySelector<HTMLElement>('[role="dialog"]')!;
    expect(dialog.textContent).toContain(first!.id);
    expect(dialog.textContent).not.toContain(second!.id);
    await act(async () => findButton(dialog, "Delete vehicle").click());

    expect(
      useEditorStore.getState().project.scene.objects.map((vehicle) => vehicle.id),
    ).toEqual([second!.id]);
    expect(
      container.querySelector(`[data-vehicle-timeline-group="${first!.id}"]`),
    ).toBeNull();
    expect(
      container.querySelector(`[data-vehicle-timeline-group="${second!.id}"]`),
    ).not.toBeNull();
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(container.textContent).toContain(second!.id);
    expect(useEditorStore.getState().selection.objectId).toBe(second!.id);
  });

  it("deletes the last Vehicle into the existing empty state and can add again", async () => {
    const [vehicle] = addVehicles(1);
    useEditorStore.getState().selectObject(vehicle!.id);
    await renderPanels();
    await act(async () => {
      container
        .querySelector<HTMLButtonElement>('button[aria-haspopup="dialog"]')!
        .click();
    });
    const dialog = container.querySelector<HTMLElement>('[role="dialog"]')!;
    await act(async () => findButton(dialog, "Delete vehicle").click());

    expect(useEditorStore.getState().project.scene.objects).toEqual([]);
    expect(container.textContent).toContain("No vehicles");
    expect(container.textContent).toContain(
      "Select an object to inspect its properties.",
    );

    await act(async () => useEditorStore.getState().addVehicle("car-blue-sedan"));
    expect(useEditorStore.getState().project.scene.objects).toHaveLength(1);
    expect(container.textContent).not.toContain("No vehicles");
  });
});
