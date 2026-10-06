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
import { resolveStateValueAtTime } from "../src/model/stateTrack";
import { useEditorStore } from "../src/store/editorStore";

const reactTestEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT: boolean;
};

function setTimelineBounds(element: HTMLElement, left = 100, width = 6000) {
  Object.defineProperty(element, "getBoundingClientRect", {
    configurable: true,
    value: () => ({
      bottom: 320,
      height: 320,
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

describe("F5.9 State Interval Editing", () => {
  let container: HTMLDivElement;
  let root: Root;
  let vehicleId: string;

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
    useEditorStore.getState().addVehicle("car-blue-sedan");
    vehicleId = useEditorStore.getState().project.scene.objects[0]!.id;
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  async function renderTimeline() {
    await act(async () => root.render(<TimelinePanel />));
    const surface = container.querySelector<HTMLElement>(
      '[data-testid="timeline-time-surface"]',
    )!;
    setTimelineBounds(surface);
    return surface;
  }

  async function selectInterval(lane: string) {
    const body = container.querySelector<HTMLButtonElement>(
      `[data-state-interval="${lane}"] [data-interval-body]`,
    )!;
    await act(async () => body.click());
    return container.querySelector<HTMLElement>(
      `[data-state-interval="${lane}"]`,
    )!;
  }

  it("selects locally, synchronizes the source keyframe, and exposes controls", async () => {
    useEditorStore
      .getState()
      .createVehicleStateInterval(vehicleId, "brakeLight", 2, 4);
    const stateBefore = useEditorStore.getState();
    await renderTimeline();

    const interval = await selectInterval("brake-light");

    expect(interval.dataset.selected).toBe("true");
    expect(interval.querySelectorAll('[data-interval-handle]')).toHaveLength(2);
    expect(container.textContent).toContain("Delete interval");
    const stateAfter = useEditorStore.getState();
    const startKeyframe = stateAfter.project.scene.objects[0]?.stateTracks.brakeLight.keyframes.find(
      (keyframe) => keyframe.time === 2,
    );
    expect(stateAfter.project).toBe(stateBefore.project);
    expect(stateAfter.currentTime).toBe(2);
    expect(stateAfter.selection).toEqual({
      objectId: vehicleId,
      movementPointId: null,
      pathId: null,
      stateKeyframeId: startKeyframe?.id,
    });
  });

  it("previews and commits a body move only after four pixels", async () => {
    useEditorStore
      .getState()
      .createVehicleStateInterval(vehicleId, "brakeLight", 2, 4);
    await renderTimeline();
    await selectInterval("brake-light");
    const body = container.querySelector<HTMLButtonElement>(
      '[data-state-interval="brake-light"] [data-interval-body]',
    )!;
    const projectBefore = useEditorStore.getState().project;

    await act(async () => {
      body.dispatchEvent(
        new MouseEvent("mousedown", { bubbles: true, button: 0, clientX: 350 }),
      );
    });
    await act(async () => {
      window.dispatchEvent(
        new MouseEvent("mousemove", { bubbles: true, clientX: 550 }),
      );
    });

    const preview = container.querySelector<HTMLElement>(
      '[data-state-interval-edit-preview="brake-light"]',
    );
    expect(Number.parseFloat(preview?.style.left ?? "")).toBeCloseTo(6.667);
    expect(Number.parseFloat(preview?.style.width ?? "")).toBeCloseTo(3.333);
    expect(useEditorStore.getState().project).toBe(projectBefore);

    await act(async () => {
      window.dispatchEvent(
        new MouseEvent("mouseup", { bubbles: true, button: 0, clientX: 550 }),
      );
    });

    const track = useEditorStore.getState().project.scene.objects[0]!.stateTracks
      .brakeLight;
    expect(resolveStateValueAtTime(track, 3)).toBe(false);
    expect(resolveStateValueAtTime(track, 5)).toBe(true);
    expect(resolveStateValueAtTime(track, 6)).toBe(false);
  });

  it("keeps a sub-threshold body gesture as selection-only", async () => {
    useEditorStore
      .getState()
      .createVehicleStateInterval(vehicleId, "horn", 2, 4);
    await renderTimeline();
    const interval = await selectInterval("horn");
    const body = interval.querySelector<HTMLButtonElement>(
      '[data-interval-body]',
    )!;
    const projectBefore = useEditorStore.getState().project;

    await act(async () => {
      body.dispatchEvent(
        new MouseEvent("mousedown", { bubbles: true, button: 0, clientX: 350 }),
      );
    });
    await act(async () => {
      window.dispatchEvent(
        new MouseEvent("mousemove", { bubbles: true, clientX: 353 }),
      );
      window.dispatchEvent(
        new MouseEvent("mouseup", { bubbles: true, button: 0, clientX: 353 }),
      );
    });

    expect(useEditorStore.getState().project).toBe(projectBefore);
    expect(
      container.querySelector('[data-state-interval-edit-preview="horn"]'),
    ).toBeNull();
  });

  it("resizes both boundaries and supports Escape cancellation", async () => {
    useEditorStore
      .getState()
      .createVehicleStateInterval(vehicleId, "headlight", 2, 6);
    await renderTimeline();
    let interval = await selectInterval("headlight");
    let leftHandle = interval.querySelector<HTMLButtonElement>(
      '[data-interval-handle="left"]',
    )!;
    const projectBeforeCancel = useEditorStore.getState().project;

    await act(async () => {
      leftHandle.dispatchEvent(
        new MouseEvent("mousedown", { bubbles: true, button: 0, clientX: 300 }),
      );
    });
    await act(async () => {
      window.dispatchEvent(
        new MouseEvent("mousemove", { bubbles: true, clientX: 400 }),
      );
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(useEditorStore.getState().project).toBe(projectBeforeCancel);

    interval = container.querySelector<HTMLElement>(
      '[data-state-interval="headlight"]',
    )!;
    leftHandle = interval.querySelector<HTMLButtonElement>(
      '[data-interval-handle="left"]',
    )!;
    await act(async () => {
      leftHandle.dispatchEvent(
        new MouseEvent("mousedown", { bubbles: true, button: 0, clientX: 300 }),
      );
    });
    await act(async () => {
      window.dispatchEvent(
        new MouseEvent("mouseup", { bubbles: true, button: 0, clientX: 400 }),
      );
    });

    interval = container.querySelector<HTMLElement>(
      '[data-state-interval="headlight"]',
    )!;
    const rightHandle = interval.querySelector<HTMLButtonElement>(
      '[data-interval-handle="right"]',
    )!;
    await act(async () => {
      rightHandle.dispatchEvent(
        new MouseEvent("mousedown", { bubbles: true, button: 0, clientX: 700 }),
      );
    });
    await act(async () => {
      window.dispatchEvent(
        new MouseEvent("mouseup", { bubbles: true, button: 0, clientX: 800 }),
      );
    });

    const track = useEditorStore.getState().project.scene.objects[0]!.stateTracks
      .headlight;
    expect(resolveStateValueAtTime(track, 2.5)).toBe(false);
    expect(resolveStateValueAtTime(track, 3)).toBe(true);
    expect(resolveStateValueAtTime(track, 7)).toBe(false);
  });

  it("deletes the selected interval with keyboard input", async () => {
    useEditorStore
      .getState()
      .createVehicleStateInterval(vehicleId, "horn", 2, 4);
    await renderTimeline();
    await selectInterval("horn");

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Delete" }));
    });

    expect(container.querySelector('[data-state-interval="horn"]')).toBeNull();
    expect(container.textContent).not.toContain("Delete interval");
  });

  it("keeps open intervals free of a right handle and body movement", async () => {
    useEditorStore.getState().setCurrentTime(8);
    useEditorStore
      .getState()
      .updateVehicleStateAtCurrentTime(vehicleId, "horn", true);
    await renderTimeline();
    const interval = await selectInterval("horn");
    const projectBefore = useEditorStore.getState().project;

    expect(interval.dataset.endClipped).toBe("true");
    expect(interval.querySelector('[data-interval-handle="left"]')).not.toBeNull();
    expect(interval.querySelector('[data-interval-handle="right"]')).toBeNull();

    const body = interval.querySelector<HTMLButtonElement>(
      '[data-interval-body]',
    )!;
    await act(async () => {
      body.dispatchEvent(
        new MouseEvent("mousedown", { bubbles: true, button: 0, clientX: 950 }),
      );
      window.dispatchEvent(
        new MouseEvent("mousemove", { bubbles: true, clientX: 750 }),
      );
      window.dispatchEvent(
        new MouseEvent("mouseup", { bubbles: true, button: 0, clientX: 750 }),
      );
    });

    expect(useEditorStore.getState().project).toBe(projectBefore);
  });
});
