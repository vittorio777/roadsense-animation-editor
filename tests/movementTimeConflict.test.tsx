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
import { TimelinePanel } from "../src/editor/components/timeline/TimelinePanel";
import { createEmptyAnimationProject } from "../src/model/animation";
import { createMovementPoint } from "../src/model/movement";
import { createVehicleObject } from "../src/model/vehicle";
import { useEditorStore } from "../src/store/editorStore";

const reactTestEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT: boolean;
};

function setTimelineBounds(element: HTMLElement, left = 100, width = 6000) {
  Object.defineProperty(element, "getBoundingClientRect", {
    configurable: true,
    value: () => ({
      bottom: 120,
      height: 120,
      left,
      right: left + width,
      top: 0,
      width,
      x: left,
      y: 0,
      toJSON: () => ({}),
    }),
  });
}

function setInputValue(input: HTMLInputElement, value: string) {
  const valueSetter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )?.set;

  valueSetter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function pressKey(input: HTMLInputElement, key: string) {
  input.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
}

function commitOnBlur(input: HTMLInputElement) {
  input.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
}

function createPoints() {
  useEditorStore.getState().addVehicle("car-blue-sedan");
  const vehicleId = useEditorStore.getState().project.scene.objects[0]!.id;
  useEditorStore.getState().setCurrentTime(3.3);
  useEditorStore.getState().updateVehiclePosition(vehicleId, 1000, 520);
  useEditorStore.getState().setCurrentTime(5);
  useEditorStore.getState().updateVehiclePosition(vehicleId, 600, 300);
  const points =
    useEditorStore.getState().project.scene.objects[0]!.movement.points;

  return {
    vehicleId,
    initialPointId: points[0]!.id,
    pointAtThreeId: points[1]!.id,
    pointAtFiveId: points[2]!.id,
  };
}

describe("F3.9 Movement time conflict", () => {
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

  it("returns typed results and rejects a duplicate atomically", () => {
    const { vehicleId, initialPointId, pointAtThreeId } = createPoints();
    useEditorStore
      .getState()
      .selectMovementPoint(vehicleId, pointAtThreeId);

    expect(
      useEditorStore
        .getState()
        .updateMovementPointTime(vehicleId, pointAtThreeId, 3.3),
    ).toEqual({ status: "unchanged" });
    expect(
      useEditorStore
        .getState()
        .updateMovementPointTime(vehicleId, initialPointId, 1),
    ).toEqual({ status: "invalid" });

    const stateBeforeConflict = useEditorStore.getState();
    const projectSnapshot = JSON.stringify(stateBeforeConflict.project);
    expect(
      useEditorStore
        .getState()
        .updateMovementPointTime(vehicleId, pointAtThreeId, 5),
    ).toEqual({ status: "duplicate-time", time: 5 });
    expect(useEditorStore.getState()).toBe(stateBeforeConflict);
    expect(JSON.stringify(useEditorStore.getState().project)).toBe(
      projectSnapshot,
    );

    expect(
      useEditorStore
        .getState()
        .updateMovementPointTime(vehicleId, pointAtThreeId, 4.2),
    ).toEqual({ status: "updated" });
  });

  it("allows matching Point times on different Vehicles", () => {
    const firstVehicle = createVehicleObject({
      assetId: "car-blue-sedan",
      x: 400,
      y: 300,
      createId: (kind) => `first-${kind}`,
    });
    const secondVehicle = createVehicleObject({
      assetId: "car-blue-sedan",
      x: 800,
      y: 450,
      createId: (kind) => `second-${kind}`,
    });
    secondVehicle.movement.points.push(
      createMovementPoint({
        time: 2,
        x: 900,
        y: 500,
        createId: () => "second-point-2",
      }),
    );
    firstVehicle.movement.points.push(
      createMovementPoint({
        time: 5,
        x: 500,
        y: 350,
        createId: () => "first-point-5",
      }),
    );
    const project = createEmptyAnimationProject();
    project.scene.objects = [firstVehicle, secondVehicle];
    useEditorStore.getState().setProject(project);

    expect(
      useEditorStore
        .getState()
        .updateMovementPointTime(secondVehicle.id, "second-point-2", 0),
    ).toEqual({ status: "duplicate-time", time: 0 });

    expect(
      useEditorStore
        .getState()
        .updateMovementPointTime(secondVehicle.id, "second-point-2", 5),
    ).toEqual({ status: "updated" });
  });

  it("shows and clears an accessible Properties conflict", async () => {
    const { vehicleId, pointAtThreeId, pointAtFiveId } = createPoints();
    useEditorStore
      .getState()
      .selectMovementPoint(vehicleId, pointAtThreeId);
    root = createRoot(container);
    await act(async () => {
      root?.render(<PropertiesPanel />);
    });
    const timeInput = container.querySelector<HTMLInputElement>(
      'input[aria-label="Movement point time"]',
    )!;

    await act(async () => {
      setInputValue(timeInput, "5");
      pressKey(timeInput, "Enter");
    });
    const alert = container.querySelector<HTMLElement>('[role="alert"]');
    expect(timeInput.value).toBe("3.3");
    expect(timeInput.getAttribute("aria-invalid")).toBe("true");
    expect(alert?.textContent).toBe(
      "A movement point already exists at 5.00s.",
    );
    expect(
      useEditorStore
        .getState()
        .project.scene.objects[0]!.movement.points.map((point) => point.time),
    ).toEqual([0, 3.3, 5]);

    await act(async () => {
      setInputValue(timeInput, "4.2");
    });
    expect(container.querySelector('[role="alert"]')).toBeNull();

    await act(async () => {
      pressKey(timeInput, "Enter");
    });
    expect(timeInput.value).toBe("4.2");
    expect(container.querySelector('[role="alert"]')).toBeNull();

    await act(async () => {
      setInputValue(timeInput, "5");
      commitOnBlur(timeInput);
    });
    expect(container.querySelector('[role="alert"]')).not.toBeNull();

    await act(async () => {
      pressKey(timeInput, "Escape");
    });
    expect(container.querySelector('[role="alert"]')).toBeNull();

    await act(async () => {
      setInputValue(timeInput, "5");
      pressKey(timeInput, "Enter");
      useEditorStore
        .getState()
        .selectMovementPoint(vehicleId, pointAtFiveId);
    });
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });

  it("restores a conflicting Timeline drag and clears feedback on seek", async () => {
    const { pointAtThreeId } = createPoints();
    root = createRoot(container);
    await act(async () => {
      root?.render(<TimelinePanel />);
    });
    const surface = container.querySelector<HTMLElement>(
      '[data-testid="timeline-time-surface"]',
    )!;
    setTimelineBounds(surface);
    const marker = container.querySelector<HTMLButtonElement>(
      `[data-movement-point-id="${pointAtThreeId}"]`,
    )!;

    await act(async () => {
      marker.dispatchEvent(
        new MouseEvent("mousedown", { bubbles: true, clientX: 430 }),
      );
    });
    await act(async () => {
      window.dispatchEvent(
        new MouseEvent("mousemove", { bubbles: true, clientX: 600 }),
      );
    });
    await act(async () => {
      window.dispatchEvent(
        new MouseEvent("mouseup", { bubbles: true, clientX: 600 }),
      );
    });
    expect(Number.parseFloat(marker.style.left)).toBeCloseTo(5.5);
    expect(useEditorStore.getState().currentTime).toBe(3.3);
    expect(container.querySelector('[role="alert"]')?.textContent).toBe(
      "A movement point already exists at 5.00s.",
    );

    await act(async () => {
      marker.dispatchEvent(
        new MouseEvent("mousedown", { bubbles: true, clientX: 430 }),
      );
    });
    expect(container.querySelector('[role="alert"]')).toBeNull();
    await act(async () => {
      window.dispatchEvent(
        new MouseEvent("mouseup", { bubbles: true, clientX: 520 }),
      );
    });
    expect(useEditorStore.getState().currentTime).toBe(4.2);

    await act(async () => {
      marker.dispatchEvent(
        new MouseEvent("mousedown", { bubbles: true, clientX: 520 }),
      );
    });
    await act(async () => {
      window.dispatchEvent(
        new MouseEvent("mouseup", { bubbles: true, clientX: 600 }),
      );
    });
    expect(container.querySelector('[role="alert"]')).not.toBeNull();

    await act(async () => {
      surface.dispatchEvent(
        new MouseEvent("click", { bubbles: true, clientX: 720 }),
      );
    });
    expect(useEditorStore.getState().currentTime).toBe(6.2);
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });
});
