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

describe("F3.6 Movement Point selection", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeAll(() => {
    reactTestEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterAll(() => {
    reactTestEnvironment.IS_REACT_ACT_ENVIRONMENT = false;
  });

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
    useEditorStore.getState().addVehicle("car-blue-sedan");
    const vehicleId = useEditorStore.getState().project.scene.objects[0]?.id;
    useEditorStore.getState().setCurrentTime(3.3);
    useEditorStore
      .getState()
      .updateVehiclePosition(vehicleId as string, 1000, 520);
    useEditorStore.getState().setCurrentTime(5);
    useEditorStore
      .getState()
      .updateVehiclePosition(vehicleId as string, 600, 300);

    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    await act(async () => {
      root.render(<TimelinePanel />);
    });
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("selects a valid Point and rejects invalid ownership without data changes", () => {
    const stateBeforeSelection = useEditorStore.getState();
    const vehicle = stateBeforeSelection.project.scene.objects[0];
    const point = vehicle?.movement.points[1];
    const projectSnapshot = JSON.stringify(stateBeforeSelection.project);

    useEditorStore
      .getState()
      .selectMovementPoint(vehicle?.id as string, point?.id as string);

    const selectedState = useEditorStore.getState();
    expect(selectedState.selection).toEqual({
      objectId: vehicle?.id,
      movementPointId: point?.id,
      pathId: null,
      stateKeyframeId: null,
    });
    expect(selectedState.currentTime).toBe(3.3);
    expect(selectedState.project).toBe(stateBeforeSelection.project);
    expect(JSON.stringify(selectedState.project)).toBe(projectSnapshot);

    const selectionBeforeInvalidRequest = selectedState.selection;
    useEditorStore
      .getState()
      .selectMovementPoint("missing-object", point?.id as string);
    expect(useEditorStore.getState()).toMatchObject({
      currentTime: 3.3,
      selection: selectionBeforeInvalidRequest,
      project: stateBeforeSelection.project,
    });

    useEditorStore
      .getState()
      .selectMovementPoint(vehicle?.id as string, "missing-point");
    expect(useEditorStore.getState()).toMatchObject({
      currentTime: 3.3,
      selection: selectionBeforeInvalidRequest,
      project: stateBeforeSelection.project,
    });
  });

  it("renders chronological Timeline markers and selects one without seek bubbling", async () => {
    const vehicle = useEditorStore.getState().project.scene.objects[0];
    const markers = container.querySelectorAll<HTMLButtonElement>(
      "[data-movement-point-id]",
    );
    expect(markers).toHaveLength(3);
    expect(markers[0]?.style.left).toBe("0%");
    expect(markers[0]?.style.marginLeft).toBe("0px");
    expect(Number.parseFloat(markers[1]?.style.left ?? "")).toBeCloseTo(5.5);
    expect(markers[1]?.style.marginLeft).toBe("-8px");
    expect(Number.parseFloat(markers[2]?.style.left ?? "")).toBeCloseTo(8.333);
    expect(markers[1]?.getAttribute("aria-label")).toBe(
      "Select movement point at 3.30 seconds",
    );

    const projectBeforeClick = useEditorStore.getState().project;
    await act(async () => {
      markers[1]?.click();
    });

    expect(useEditorStore.getState().currentTime).toBe(3.3);
    expect(useEditorStore.getState().selection.movementPointId).toBe(
      vehicle?.movement.points[1]?.id,
    );
    expect(useEditorStore.getState().project).toBe(projectBeforeClick);
    expect(markers[1]?.getAttribute("aria-pressed")).toBe("true");
    expect(markers[0]?.getAttribute("aria-pressed")).toBe("false");
  });

  it("preserves Point selection during ordinary snapped Timeline seek", async () => {
    const vehicle = useEditorStore.getState().project.scene.objects[0];
    const point = vehicle?.movement.points[1];
    await act(async () => {
      useEditorStore
        .getState()
        .selectMovementPoint(vehicle?.id as string, point?.id as string);
    });
    const selectionBeforeSeek = useEditorStore.getState().selection;
    const surface = container.querySelector<HTMLElement>(
      '[data-testid="timeline-time-surface"]',
    );
    expect(surface).not.toBeNull();
    setTimelineBounds(surface as HTMLElement);

    await act(async () => {
      surface?.dispatchEvent(
        new MouseEvent("click", { bubbles: true, clientX: 726 }),
      );
    });

    expect(useEditorStore.getState().currentTime).toBe(6.3);
    expect(useEditorStore.getState().selection).toBe(selectionBeforeSeek);
    expect(
      container.querySelector<HTMLButtonElement>(
        `[data-movement-point-id="${point?.id}"]`,
      )?.getAttribute("aria-pressed"),
    ).toBe("true");
  });

  it("clears Point selection when object-only or empty selection is requested", () => {
    const vehicle = useEditorStore.getState().project.scene.objects[0];
    const point = vehicle?.movement.points[1];
    useEditorStore
      .getState()
      .selectMovementPoint(vehicle?.id as string, point?.id as string);

    useEditorStore.getState().selectObject(vehicle?.id as string);
    expect(useEditorStore.getState().selection).toEqual({
      objectId: vehicle?.id,
      movementPointId: null,
      pathId: null,
      stateKeyframeId: null,
    });

    useEditorStore
      .getState()
      .selectMovementPoint(vehicle?.id as string, point?.id as string);
    useEditorStore.getState().clearSelection();
    expect(useEditorStore.getState().selection).toEqual({
      objectId: null,
      movementPointId: null,
      pathId: null,
      stateKeyframeId: null,
    });
  });
});
