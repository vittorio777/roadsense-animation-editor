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

function createPoints() {
  useEditorStore.getState().addVehicle("car-blue-sedan");
  const vehicleId = useEditorStore.getState().project.scene.objects[0]!.id;
  useEditorStore.getState().setCurrentTime(3.3);
  useEditorStore.getState().updateVehiclePosition(vehicleId, 1000, 520);
  useEditorStore.getState().setCurrentTime(5);
  useEditorStore.getState().updateVehiclePosition(vehicleId, 600, 300);

  return {
    vehicleId,
    initialPointId:
      useEditorStore.getState().project.scene.objects[0]!.movement.points[0]!.id,
    pointAtThreeId:
      useEditorStore.getState().project.scene.objects[0]!.movement.points[1]!.id,
    pointAtFiveId:
      useEditorStore.getState().project.scene.objects[0]!.movement.points[2]!.id,
  };
}

describe("F3.8 Movement Point time editing", () => {
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

  it("updates by stable Point ID, sorts chronologically, and follows a selected Point", () => {
    const { vehicleId, pointAtThreeId, pointAtFiveId } = createPoints();
    useEditorStore
      .getState()
      .selectMovementPoint(vehicleId, pointAtThreeId);
    const stateBeforeEdit = useEditorStore.getState();
    const vehicleBeforeEdit = stateBeforeEdit.project.scene.objects[0]!;
    const initialPoint = vehicleBeforeEdit.movement.points[0]!;
    const targetPoint = vehicleBeforeEdit.movement.points[1]!;
    const pointAtFive = vehicleBeforeEdit.movement.points[2]!;

    useEditorStore
      .getState()
      .updateMovementPointTime(vehicleId, pointAtThreeId, 6.2);

    const stateAfterEdit = useEditorStore.getState();
    const vehicleAfterEdit = stateAfterEdit.project.scene.objects[0]!;
    expect(vehicleAfterEdit.movement.points.map((point) => point.time)).toEqual([
      0, 5, 6.2,
    ]);
    expect(vehicleAfterEdit.movement.points[0]).toBe(initialPoint);
    expect(vehicleAfterEdit.movement.points[1]).toBe(pointAtFive);
    expect(vehicleAfterEdit.movement.points[2]).toEqual({
      ...targetPoint,
      time: 6.2,
    });
    expect(vehicleAfterEdit.movement.points[1]?.id).toBe(pointAtFiveId);
    expect(
      vehicleAfterEdit.movement.paths.map(({ fromPointId, toPointId }) => ({
        fromPointId,
        toPointId,
      })),
    ).toEqual([
      { fromPointId: initialPoint.id, toPointId: pointAtFive.id },
      { fromPointId: pointAtFive.id, toPointId: targetPoint.id },
    ]);
    expect(vehicleAfterEdit.stateTracks).toBe(vehicleBeforeEdit.stateTracks);
    expect(stateAfterEdit.project.scene.background).toBe(
      stateBeforeEdit.project.scene.background,
    );
    expect(stateAfterEdit.selection).toBe(stateBeforeEdit.selection);
    expect(stateAfterEdit.selection.movementPointId).toBe(pointAtThreeId);
    expect(stateAfterEdit.currentTime).toBe(6.2);

    useEditorStore
      .getState()
      .updateMovementPointTime(vehicleId, pointAtThreeId, 2);
    expect(
      useEditorStore
        .getState()
        .project.scene.objects[0]!.movement.points.map((point) => point.time),
    ).toEqual([0, 2, 5]);
  });

  it("keeps the Store independent from the default visible Timeline span", () => {
    const { vehicleId, pointAtThreeId } = createPoints();

    useEditorStore
      .getState()
      .updateMovementPointTime(vehicleId, pointAtThreeId, 12.5);

    expect(
      useEditorStore
        .getState()
        .project.scene.objects[0]!.movement.points.find(
          (point) => point.id === pointAtThreeId,
        )?.time,
    ).toBe(12.5);
  });

  it("rejects initial, duplicate, invalid, unchanged, and mismatched requests", () => {
    const { vehicleId, initialPointId, pointAtThreeId } = createPoints();
    const requests: Array<[string, string, number]> = [
      [vehicleId, initialPointId, 1],
      [vehicleId, pointAtThreeId, 5],
      [vehicleId, pointAtThreeId, -1],
      [vehicleId, pointAtThreeId, Number.NaN],
      [vehicleId, pointAtThreeId, Number.POSITIVE_INFINITY],
      [vehicleId, pointAtThreeId, 3.3],
      ["missing-object", pointAtThreeId, 4],
      [vehicleId, "missing-point", 4],
    ];

    for (const request of requests) {
      const stateBeforeRequest = useEditorStore.getState();
      useEditorStore.getState().updateMovementPointTime(...request);
      expect(useEditorStore.getState()).toBe(stateBeforeRequest);
    }
  });

  it("drags a non-initial Timeline marker with snapped preview and commit", async () => {
    const { vehicleId, initialPointId, pointAtThreeId } = createPoints();
    root = createRoot(container);
    await act(async () => {
      root?.render(<TimelinePanel />);
    });
    const surface = container.querySelector<HTMLElement>(
      '[data-testid="timeline-time-surface"]',
    )!;
    setTimelineBounds(surface);
    const initialMarker = container.querySelector<HTMLButtonElement>(
      `[data-movement-point-id="${initialPointId}"]`,
    )!;
    const marker = container.querySelector<HTMLButtonElement>(
      `[data-movement-point-id="${pointAtThreeId}"]`,
    )!;
    expect(initialMarker.dataset.draggable).toBe("false");
    expect(marker.dataset.draggable).toBe("true");

    await act(async () => {
      marker.dispatchEvent(
        new MouseEvent("mousedown", { bubbles: true, clientX: 430 }),
      );
    });
    expect(useEditorStore.getState().selection.movementPointId).toBe(
      pointAtThreeId,
    );
    expect(useEditorStore.getState().currentTime).toBe(3.3);

    await act(async () => {
      window.dispatchEvent(
        new MouseEvent("mousemove", { bubbles: true, clientX: 726 }),
      );
    });
    expect(Number.parseFloat(marker.style.left)).toBeCloseTo(10.5);
    expect(
      useEditorStore
        .getState()
        .project.scene.objects[0]!.movement.points.find(
          (point) => point.id === pointAtThreeId,
        )?.time,
    ).toBe(3.3);

    await act(async () => {
      window.dispatchEvent(
        new MouseEvent("mouseup", { bubbles: true, clientX: 726 }),
      );
    });
    const stateAfterDrag = useEditorStore.getState();
    expect(
      stateAfterDrag.project.scene.objects[0]!.movement.points.find(
        (point) => point.id === pointAtThreeId,
      )?.time,
    ).toBe(6.3);
    expect(stateAfterDrag.currentTime).toBe(6.3);
    expect(stateAfterDrag.selection).toMatchObject({
      objectId: vehicleId,
      movementPointId: pointAtThreeId,
    });
    expect(container.textContent).toContain("Current time: 6.30s");
  });

  it("edits non-initial time in Properties and keeps the initial time read-only", async () => {
    const { vehicleId, initialPointId, pointAtThreeId } = createPoints();
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
    expect(timeInput.value).toBe("3.3");
    expect(timeInput.step).toBe("0.1");
    expect(timeInput.max).toBe("60");

    await act(async () => {
      setInputValue(timeInput, "4.24");
      pressKey(timeInput, "Enter");
    });
    expect(timeInput.value).toBe("4.2");
    expect(useEditorStore.getState().currentTime).toBe(4.2);

    await act(async () => {
      setInputValue(timeInput, "12");
      pressKey(timeInput, "Enter");
    });
    expect(timeInput.value).toBe("12");
    expect(useEditorStore.getState().currentTime).toBe(12);

    await act(async () => {
      setInputValue(timeInput, "5");
      pressKey(timeInput, "Enter");
    });
    expect(timeInput.value).toBe("12");
    expect(useEditorStore.getState().currentTime).toBe(12);

    await act(async () => {
      useEditorStore
        .getState()
        .selectMovementPoint(vehicleId, initialPointId);
    });
    expect(
      container.querySelector('input[aria-label="Movement point time"]'),
    ).toBeNull();
    expect(container.textContent).toContain("0.00s");
  });
});
