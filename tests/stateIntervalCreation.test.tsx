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
  vi,
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

describe("F5.8 State Interval Creation", () => {
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
    useEditorStore.getState().addVehicle("car-blue-sedan");
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  async function renderTimeline() {
    await act(async () => {
      root.render(<TimelinePanel />);
    });
    const surface = container.querySelector<HTMLElement>(
      '[data-testid="timeline-time-surface"]',
    )!;
    setTimelineBounds(surface);
    return surface;
  }

  async function dragLane(
    lane: HTMLElement,
    surface: HTMLElement,
    startX: number,
    endX: number,
  ) {
    const now = vi.spyOn(performance, "now").mockReturnValue(0);
    await act(async () => {
      lane.dispatchEvent(
        new MouseEvent("mousedown", { bubbles: true, button: 0, clientX: startX }),
      );
    });
    now.mockReturnValue(850);
    await act(async () => {
      window.dispatchEvent(
        new MouseEvent("mousemove", { bubbles: true, clientX: endX }),
      );
    });

    await act(async () => {
      window.dispatchEvent(
        new MouseEvent("mouseup", { bubbles: true, button: 0, clientX: endX }),
      );
      surface.dispatchEvent(
        new MouseEvent("click", { bubbles: true, button: 0, clientX: endX }),
      );
    });
    now.mockRestore();
  }

  it("shows a snapped preview without mutating data before mouseup", async () => {
    const surface = await renderTimeline();
    const lane = container.querySelector<HTMLElement>(
      '[data-timeline-lane="brake-light"]',
    )!;
    const projectBefore = useEditorStore.getState().project;
    const now = vi.spyOn(performance, "now").mockReturnValue(0);

    await act(async () => {
      lane.dispatchEvent(
        new MouseEvent("mousedown", { bubbles: true, button: 0, clientX: 304 }),
      );
    });
    now.mockReturnValue(850);
    await act(async () => {
      window.dispatchEvent(
        new MouseEvent("mousemove", { bubbles: true, clientX: 506 }),
      );
    });
    now.mockRestore();

    const preview = container.querySelector<HTMLElement>(
      '[data-state-interval-preview="brake-light"]',
    );
    expect(Number.parseFloat(preview?.style.left ?? "")).toBeCloseTo(3.333);
    expect(Number.parseFloat(preview?.style.width ?? "")).toBeCloseTo(3.5);
    expect(useEditorStore.getState().project).toBe(projectBefore);

    await act(async () => {
      window.dispatchEvent(
        new MouseEvent("mouseup", { bubbles: true, button: 0, clientX: 506 }),
      );
      surface.dispatchEvent(
        new MouseEvent("click", { bubbles: true, button: 0, clientX: 506 }),
      );
    });

    const vehicle = useEditorStore.getState().project.scene.objects[0]!;
    expect(resolveStateValueAtTime(vehicle.stateTracks.brakeLight, 2)).toBe(true);
    expect(resolveStateValueAtTime(vehicle.stateTracks.brakeLight, 4)).toBe(true);
    expect(resolveStateValueAtTime(vehicle.stateTracks.brakeLight, 4.1)).toBe(false);
    expect(
      container.querySelector('[data-state-interval-preview="brake-light"]'),
    ).toBeNull();
    expect(container.querySelector('[data-state-interval="brake-light"]')).not.toBeNull();
  });

  it("creates the same interval when dragging from right to left", async () => {
    const surface = await renderTimeline();
    const lane = container.querySelector<HTMLElement>(
      '[data-timeline-lane="headlight"]',
    )!;

    await dragLane(lane, surface, 700, 400);

    const vehicle = useEditorStore.getState().project.scene.objects[0]!;
    expect(vehicle.stateTracks.headlight.keyframes.map(({ time, value }) => ({ time, value }))).toEqual([
      { time: 0, value: false },
      { time: 3, value: true },
      { time: 6, value: false },
    ]);
  });

  it("keeps a zero-length gesture as seek without creating data", async () => {
    await renderTimeline();
    const lane = container.querySelector<HTMLElement>(
      '[data-timeline-lane="horn"]',
    )!;
    const projectBefore = useEditorStore.getState().project;

    await act(async () => {
      lane.dispatchEvent(
        new MouseEvent("mousedown", { bubbles: true, button: 0, clientX: 426 }),
      );
    });
    await act(async () => {
      window.dispatchEvent(
        new MouseEvent("mouseup", { bubbles: true, button: 0, clientX: 426 }),
      );
    });

    expect(useEditorStore.getState().currentTime).toBe(3.3);
    expect(useEditorStore.getState().project).toBe(projectBefore);
  });

  it("treats a fast drag as seek instead of interval creation", async () => {
    await renderTimeline();
    const lane = container.querySelector<HTMLElement>(
      '[data-timeline-lane="horn"]',
    )!;
    const projectBefore = useEditorStore.getState().project;
    const now = vi.spyOn(performance, "now").mockReturnValue(0);

    await act(async () => {
      lane.dispatchEvent(
        new MouseEvent("mousedown", { bubbles: true, button: 0, clientX: 300 }),
      );
    });
    now.mockReturnValue(100);
    await act(async () => {
      window.dispatchEvent(
        new MouseEvent("mousemove", { bubbles: true, clientX: 700 }),
      );
      window.dispatchEvent(
        new MouseEvent("mouseup", { bubbles: true, button: 0, clientX: 700 }),
      );
    });
    now.mockRestore();

    expect(useEditorStore.getState().currentTime).toBe(6);
    expect(useEditorStore.getState().project).toBe(projectBefore);
    expect(container.querySelector('[data-state-interval="horn"]')).toBeNull();
  });

  it("treats a held micro-drag under six pixels as seek", async () => {
    await renderTimeline();
    const lane = container.querySelector<HTMLElement>(
      '[data-timeline-lane="headlight"]',
    )!;
    const projectBefore = useEditorStore.getState().project;
    const now = vi.spyOn(performance, "now").mockReturnValue(0);

    await act(async () => {
      lane.dispatchEvent(
        new MouseEvent("mousedown", { bubbles: true, button: 0, clientX: 300 }),
      );
    });
    now.mockReturnValue(850);
    await act(async () => {
      window.dispatchEvent(
        new MouseEvent("mousemove", { bubbles: true, clientX: 305 }),
      );
      window.dispatchEvent(
        new MouseEvent("mouseup", { bubbles: true, button: 0, clientX: 305 }),
      );
    });
    now.mockRestore();

    expect(useEditorStore.getState().currentTime).toBe(2.1);
    expect(useEditorStore.getState().project).toBe(projectBefore);
    expect(container.querySelector('[data-state-interval="headlight"]')).toBeNull();
  });

  it("does not start creation from an existing interval", async () => {
    const vehicleId = useEditorStore.getState().project.scene.objects[0]!.id;
    useEditorStore
      .getState()
      .createVehicleStateInterval(vehicleId, "horn", 2, 4);
    await renderTimeline();
    const interval = container.querySelector<HTMLElement>(
      '[data-state-interval="horn"]',
    )!;
    const projectBefore = useEditorStore.getState().project;

    await act(async () => {
      interval.dispatchEvent(
        new MouseEvent("mousedown", { bubbles: true, button: 0, clientX: 350 }),
      );
    });
    await act(async () => {
      window.dispatchEvent(
        new MouseEvent("mousemove", { bubbles: true, clientX: 650 }),
      );
      window.dispatchEvent(
        new MouseEvent("mouseup", { bubbles: true, button: 0, clientX: 650 }),
      );
    });

    expect(useEditorStore.getState().project).toBe(projectBefore);
    expect(container.querySelector('[data-state-interval-preview="horn"]')).toBeNull();
  });

  it("rejects overlap on the target lane with accessible feedback", async () => {
    const vehicleId = useEditorStore.getState().project.scene.objects[0]!.id;
    useEditorStore
      .getState()
      .createVehicleStateInterval(vehicleId, "brakeLight", 2, 4);
    const surface = await renderTimeline();
    const lane = container.querySelector<HTMLElement>(
      '[data-timeline-lane="brake-light"]',
    )!;
    const projectBefore = useEditorStore.getState().project;

    await dragLane(lane, surface, 600, 400);

    expect(useEditorStore.getState().project).toBe(projectBefore);
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "already has an active interval",
    );
  });

  it("combines overlapping left and right indicator intervals as hazard", async () => {
    const vehicleId = useEditorStore.getState().project.scene.objects[0]!.id;
    useEditorStore
      .getState()
      .createVehicleStateInterval(vehicleId, "leftIndicator", 2, 5);
    const surface = await renderTimeline();
    const rightLane = container.querySelector<HTMLElement>(
      '[data-timeline-lane="right-indicator"]',
    )!;

    await dragLane(rightLane, surface, 400, 700);

    const vehicle = useEditorStore.getState().project.scene.objects[0]!;
    expect(resolveStateValueAtTime(vehicle.stateTracks.indicator, 2.5)).toBe("left");
    expect(resolveStateValueAtTime(vehicle.stateTracks.indicator, 3.5)).toBe("hazard");
    expect(resolveStateValueAtTime(vehicle.stateTracks.indicator, 5.5)).toBe("right");
  });
});
