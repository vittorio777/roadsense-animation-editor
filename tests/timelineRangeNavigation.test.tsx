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
import {
  calculateTimelineContentWidth,
  TIMELINE_VISIBLE_SPANS,
} from "../src/editor/components/timeline/timelineRuler";
import { createEmptyAnimationProject } from "../src/model/animation";
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

describe("F7.5 Timeline range and navigation", () => {
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

  it("calculates full-range content widths for every visible span", () => {
    expect(TIMELINE_VISIBLE_SPANS).toEqual([5, 10, 20, 60]);
    expect(calculateTimelineContentWidth(1000, 5)).toBe(12000);
    expect(calculateTimelineContentWidth(1000, 10)).toBe(6000);
    expect(calculateTimelineContentWidth(1000, 20)).toBe(3000);
    expect(calculateTimelineContentWidth(1000, 60)).toBe(1000);
    expect(calculateTimelineContentWidth(0, 10)).toBe(0);
  });

  it("defaults to ten seconds and switches zoom without changing editor state", async () => {
    const controls = container.querySelectorAll<HTMLButtonElement>(
      '[aria-label="Visible timeline span"] [role="radio"]',
    );
    const grid = container.querySelector<HTMLElement>(
      '[data-testid="timeline-scroll-region"] > div',
    )!;
    expect([...controls].map((control) => control.textContent)).toEqual([
      "5s",
      "10s",
      "20s",
      "60s",
    ]);
    expect(controls[1]?.getAttribute("aria-checked")).toBe("true");
    expect(grid.style.gridTemplateColumns).toBe("176px 6000px");

    const stateBefore = useEditorStore.getState();
    await act(async () => {
      controls[3]?.click();
    });

    expect(controls[1]?.getAttribute("aria-checked")).toBe("false");
    expect(controls[3]?.getAttribute("aria-checked")).toBe("true");
    expect(grid.style.gridTemplateColumns).toBe("176px 1000px");
    expect(useEditorStore.getState()).toBe(stateBefore);
  });

  it("maps clicks beyond ten seconds and reveals an offscreen playhead", async () => {
    const surface = container.querySelector<HTMLElement>(
      '[data-testid="timeline-time-surface"]',
    )!;
    const scrollRegion = container.querySelector<HTMLElement>(
      '[data-testid="timeline-scroll-region"]',
    )!;
    setTimelineBounds(surface);

    await act(async () => {
      surface.dispatchEvent(
        new MouseEvent("click", { bubbles: true, clientX: 5650 }),
      );
    });

    expect(useEditorStore.getState().currentTime).toBe(55.5);
    expect(container.textContent).toContain("Current time: 55.50s");
    expect(Number.parseFloat(
      container.querySelector<HTMLElement>('[data-testid="timeline-playhead"]')
        ?.style.left ?? "",
    )).toBeCloseTo(92.5);
    expect(scrollRegion.scrollLeft).toBeGreaterThan(0);
  });

  it("keeps horizontal navigation and zoom as local UI state", async () => {
    useEditorStore.getState().addVehicle("car-blue-sedan");
    const vehicleId = useEditorStore.getState().project.scene.objects[0]!.id;
    useEditorStore.getState().selectObject(vehicleId);
    await act(async () => {
      root.render(<TimelinePanel />);
    });
    const stateBefore = useEditorStore.getState();
    const snapshot = JSON.stringify(stateBefore.project);
    const scrollRegion = container.querySelector<HTMLElement>(
      '[data-testid="timeline-scroll-region"]',
    )!;

    scrollRegion.scrollLeft = 2500;
    scrollRegion.dispatchEvent(new Event("scroll", { bubbles: true }));

    expect(useEditorStore.getState()).toBe(stateBefore);
    expect(JSON.stringify(useEditorStore.getState().project)).toBe(snapshot);
    expect(
      container.querySelector<HTMLElement>(".sticky.left-0")?.textContent,
    ).toContain("Car Blue Sedan");
  });

  it("renders movement and open-ended state data across the 60-second range", async () => {
    useEditorStore.getState().addVehicle("car-blue-sedan");
    const vehicleId = useEditorStore.getState().project.scene.objects[0]!.id;
    useEditorStore.getState().setCurrentTime(55.5);
    useEditorStore.getState().updateVehiclePosition(vehicleId, 1000, 520);
    useEditorStore
      .getState()
      .updateVehicleStateAtCurrentTime(vehicleId, "headlight", true);

    await act(async () => {
      root.render(<TimelinePanel />);
    });

    const vehicle = useEditorStore.getState().project.scene.objects[0]!;
    const point = vehicle.movement.points.find((candidate) => candidate.time === 55.5)!;
    const marker = container.querySelector<HTMLElement>(
      `[data-movement-point-id="${point.id}"]`,
    )!;
    const interval = container.querySelector<HTMLElement>(
      '[data-state-interval="headlight"]',
    )!;
    expect(Number.parseFloat(marker.style.left)).toBeCloseTo(92.5);
    expect(Number.parseFloat(interval.style.left)).toBeCloseTo(92.5);
    expect(Number.parseFloat(interval.style.width)).toBeCloseTo(7.5);
    expect(interval.dataset.openEnded).toBe("true");
  });
});
