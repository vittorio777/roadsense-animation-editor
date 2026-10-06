import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { PropertiesPanel } from "../src/editor/components/properties/PropertiesPanel";
import { createEmptyAnimationProject } from "../src/model/animation";
import { useEditorStore } from "../src/store/editorStore";

function setInputValue(input: HTMLInputElement, value: string) {
  const valueSetter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )?.set;

  valueSetter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function commitOnBlur(input: HTMLInputElement) {
  input.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
}

function pressKey(input: HTMLInputElement, key: string) {
  input.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
}

describe("F2.6 Vehicle properties", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(async () => {
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

    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);

    await act(async () => {
      root.render(<PropertiesPanel />);
    });
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("shows labelled Position fields with the current logical coordinates", () => {
    const xInput = container.querySelector<HTMLInputElement>(
      'input[aria-label="Position X"]',
    );
    const yInput = container.querySelector<HTMLInputElement>(
      'input[aria-label="Position Y"]',
    );

    expect(xInput?.value).toBe("800");
    expect(yInput?.value).toBe("450");
    expect(xInput?.type).toBe("number");
    expect(yInput?.type).toBe("number");
    expect(container.textContent).toContain("Vehicle");
    expect(container.textContent).toContain("Car Blue Sedan");
    expect(container.textContent).toContain("Instance ID");
    expect(container.querySelector("select, textarea")).toBeNull();
  });

  it("commits X on blur and Y on Enter without changing other data", async () => {
    const stateBeforeEdit = useEditorStore.getState();
    const vehicleBeforeEdit = stateBeforeEdit.project.scene.objects[0];
    const pointBeforeEdit = vehicleBeforeEdit?.movement.points[0];
    const xInput = container.querySelector<HTMLInputElement>(
      'input[aria-label="Position X"]',
    );
    const yInput = container.querySelector<HTMLInputElement>(
      'input[aria-label="Position Y"]',
    );

    await act(async () => {
      setInputValue(xInput as HTMLInputElement, "420");
      commitOnBlur(xInput as HTMLInputElement);
    });
    expect(
      useEditorStore.getState().project.scene.objects[0]?.movement.points[0],
    ).toEqual({ ...pointBeforeEdit, x: 420, y: 450 });

    await act(async () => {
      setInputValue(yInput as HTMLInputElement, "315.5");
      pressKey(yInput as HTMLInputElement, "Enter");
    });

    const stateAfterEdit = useEditorStore.getState();
    const vehicleAfterEdit = stateAfterEdit.project.scene.objects[0];
    expect(vehicleAfterEdit?.movement.points).toEqual([
      { ...pointBeforeEdit, x: 420, y: 315.5 },
    ]);
    expect(vehicleAfterEdit?.id).toBe(vehicleBeforeEdit?.id);
    expect(vehicleAfterEdit?.assetId).toBe(vehicleBeforeEdit?.assetId);
    expect(vehicleAfterEdit?.movement.paths).toBe(vehicleBeforeEdit?.movement.paths);
    expect(vehicleAfterEdit?.stateTracks).toBe(vehicleBeforeEdit?.stateTracks);
    expect(stateAfterEdit.project.scene.background).toBe(
      stateBeforeEdit.project.scene.background,
    );
    expect(stateAfterEdit.selection).toBe(stateBeforeEdit.selection);
    expect(stateAfterEdit.currentTime).toBe(0);
    expect(xInput?.value).toBe("420");
    expect(yInput?.value).toBe("315.5");
  });

  it("clamps submitted coordinates so the complete Vehicle stays visible", async () => {
    const xInput = container.querySelector<HTMLInputElement>(
      'input[aria-label="Position X"]',
    );
    const yInput = container.querySelector<HTMLInputElement>(
      'input[aria-label="Position Y"]',
    );

    await act(async () => {
      setInputValue(xInput as HTMLInputElement, "-100");
      pressKey(xInput as HTMLInputElement, "Enter");
    });
    await act(async () => {
      setInputValue(yInput as HTMLInputElement, "2000");
      commitOnBlur(yInput as HTMLInputElement);
    });

    expect(
      useEditorStore.getState().project.scene.objects[0]?.movement.points[0],
    ).toMatchObject({ x: 60, y: 864 });
    expect(xInput?.value).toBe("60");
    expect(yInput?.value).toBe("864");
  });

  it("rejects empty input and cancels uncommitted edits with Escape", async () => {
    const projectBeforeEdit = useEditorStore.getState().project;
    const xInput = container.querySelector<HTMLInputElement>(
      'input[aria-label="Position X"]',
    );
    const yInput = container.querySelector<HTMLInputElement>(
      'input[aria-label="Position Y"]',
    );

    await act(async () => {
      setInputValue(xInput as HTMLInputElement, "");
      commitOnBlur(xInput as HTMLInputElement);
    });
    expect(useEditorStore.getState().project).toBe(projectBeforeEdit);
    expect(xInput?.value).toBe("800");

    await act(async () => {
      setInputValue(yInput as HTMLInputElement, "700");
      pressKey(yInput as HTMLInputElement, "Escape");
    });
    expect(useEditorStore.getState().project).toBe(projectBeforeEdit);
    expect(yInput?.value).toBe("450");
  });

  it("synchronizes Store movement changes and the empty selection state", async () => {
    const vehicleId = useEditorStore.getState().selection.objectId;

    await act(async () => {
      useEditorStore.getState().updateVehiclePosition(
        vehicleId as string,
        610.1234,
        275.6789,
      );
    });

    expect(
      container.querySelector<HTMLInputElement>(
        'input[aria-label="Position X"]',
      )?.value,
    ).toBe("610.12");
    expect(
      container.querySelector<HTMLInputElement>(
        'input[aria-label="Position Y"]',
      )?.value,
    ).toBe("275.68");

    await act(async () => {
      useEditorStore.getState().clearSelection();
    });
    expect(container.querySelector("input")).toBeNull();
    expect(container.textContent).toContain(
      "Select an object to inspect its properties.",
    );

    await act(async () => {
      useEditorStore.getState().selectObject(vehicleId as string);
    });
    expect(
      container.querySelector<HTMLInputElement>(
        'input[aria-label="Position X"]',
      )?.value,
    ).toBe("610.12");
  });

  it("creates a current-time Point from a single-axis Properties edit", async () => {
    const initialPoint =
      useEditorStore.getState().project.scene.objects[0]?.movement.points[0];

    await act(async () => {
      useEditorStore.getState().setCurrentTime(5);
    });

    const xInput = container.querySelector<HTMLInputElement>(
      'input[aria-label="Position X"]',
    );
    const yInput = container.querySelector<HTMLInputElement>(
      'input[aria-label="Position Y"]',
    );
    expect(xInput?.value).toBe("800");
    expect(yInput?.value).toBe("450");

    await act(async () => {
      setInputValue(xInput as HTMLInputElement, "1000");
      pressKey(xInput as HTMLInputElement, "Enter");
    });

    const points =
      useEditorStore.getState().project.scene.objects[0]?.movement.points;
    expect(points).toHaveLength(2);
    expect(points?.[0]).toBe(initialPoint);
    expect(points?.[1]).toMatchObject({ time: 5, x: 1000, y: 450 });
    expect(xInput?.value).toBe("1000");
    expect(yInput?.value).toBe("450");
  });

  it("edits from the composed pose between existing Points", async () => {
    const vehicleId = useEditorStore.getState().selection.objectId as string;
    await act(async () => {
      useEditorStore.getState().setCurrentTime(10);
      useEditorStore.getState().updateVehiclePosition(vehicleId, 1200, 650);
      useEditorStore.getState().setCurrentTime(5);
    });

    const xInput = container.querySelector<HTMLInputElement>(
      'input[aria-label="Position X"]',
    )!;
    const yInput = container.querySelector<HTMLInputElement>(
      'input[aria-label="Position Y"]',
    )!;
    expect(xInput.value).toBe("1000");
    expect(yInput.value).toBe("550");

    await act(async () => {
      setInputValue(xInput, "900");
      pressKey(xInput, "Enter");
    });

    const movement = useEditorStore.getState().project.scene.objects[0]!.movement;
    expect(movement.points.map(({ time, x, y }) => ({ time, x, y }))).toEqual([
      { time: 0, x: 800, y: 450 },
      { time: 5, x: 900, y: 550 },
      { time: 10, x: 1200, y: 650 },
    ]);
    expect(movement.paths).toHaveLength(2);
    expect(yInput.value).toBe("550");
  });

  it("shows and edits the selected Point independently from currentTime", async () => {
    const vehicleId = useEditorStore.getState().selection.objectId as string;
    await act(async () => {
      useEditorStore.getState().setCurrentTime(3.3);
      useEditorStore
        .getState()
        .updateVehiclePosition(vehicleId, 1000, 520);
    });
    const point =
      useEditorStore.getState().project.scene.objects[0]?.movement.points[1];
    expect(point).toBeDefined();

    await act(async () => {
      useEditorStore
        .getState()
        .selectMovementPoint(vehicleId, point?.id as string);
      useEditorStore.getState().setCurrentTime(7.5);
    });

    expect(container.textContent).toContain("Selected movement point");
    expect(container.textContent).toContain("Point ID");
    expect(container.textContent).toContain(point?.id);
    expect(
      container.querySelector<HTMLInputElement>(
        'input[aria-label="Movement point time"]',
      )?.value,
    ).toBe("3.3");
    expect(container.textContent).toContain("Point position");
    const xInput = container.querySelector<HTMLInputElement>(
      'input[aria-label="Position X"]',
    );
    const yInput = container.querySelector<HTMLInputElement>(
      'input[aria-label="Position Y"]',
    );
    expect(xInput?.value).toBe("1000");
    expect(yInput?.value).toBe("520");

    await act(async () => {
      setInputValue(xInput as HTMLInputElement, "1100");
      pressKey(xInput as HTMLInputElement, "Enter");
    });

    const stateAfterEdit = useEditorStore.getState();
    const points = stateAfterEdit.project.scene.objects[0]?.movement.points;
    expect(points).toHaveLength(2);
    expect(points?.[1]).toEqual({ ...point, x: 1100, y: 520 });
    expect(points?.some((candidate) => candidate.time === 7.5)).toBe(false);
    expect(stateAfterEdit.currentTime).toBe(7.5);
    expect(stateAfterEdit.selection.movementPointId).toBe(point?.id);
    expect(xInput?.value).toBe("1100");
    expect(yInput?.value).toBe("520");
  });
});
