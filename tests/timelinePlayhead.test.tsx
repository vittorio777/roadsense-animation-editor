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
  clampTimelineTime,
  timelinePositionToTime,
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

async function clickAt(element: HTMLElement, clientX: number) {
  await act(async () => {
    element.dispatchEvent(
      new MouseEvent("click", { bubbles: true, clientX }),
    );
  });
}

describe("F3.2 Timeline Playhead and current time", () => {
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

  it("maps positions linearly without applying Timeline snapping", () => {
    expect(timelinePositionToTime(0, 6000)).toBe(0);
    expect(timelinePositionToTime(3000, 6000)).toBe(30);
    expect(timelinePositionToTime(6000, 6000)).toBe(60);
    expect(timelinePositionToTime(333, 6000)).toBe(3.33);
  });

  it("clamps positions and visual time to the Timeline range", () => {
    expect(timelinePositionToTime(-20, 6000)).toBe(0);
    expect(timelinePositionToTime(6020, 6000)).toBe(60);
    expect(timelinePositionToTime(100, 0)).toBe(0);
    expect(clampTimelineTime(-1)).toBe(0);
    expect(clampTimelineTime(61)).toBe(60);
  });

  it("starts at zero with an accessible current-time surface", () => {
    const surface = container.querySelector<HTMLElement>(
      '[data-testid="timeline-time-surface"]',
    );
    const playhead = container.querySelector<HTMLElement>(
      '[data-testid="timeline-playhead"]',
    );

    expect(surface?.getAttribute("aria-label")).toBe(
      "Timeline, 0 to 60 seconds, click to set current time",
    );
    expect(container.textContent).toContain("Current time: 0.00s");
    expect(playhead?.style.left).toBe("0%");
    expect(playhead?.getAttribute("aria-hidden")).toBe("true");
    expect(playhead?.hasAttribute("tabindex")).toBe(false);
  });

  it("updates currentTime and the Playhead when the Timeline is clicked", async () => {
    const surface = container.querySelector<HTMLElement>(
      '[data-testid="timeline-time-surface"]',
    );
    expect(surface).not.toBeNull();
    setTimelineBounds(surface as HTMLElement);

    await clickAt(surface as HTMLElement, 433);

    expect(useEditorStore.getState().currentTime).toBe(3.3);
    expect(container.textContent).toContain("Current time: 3.30s");
    const playheadLeft = container.querySelector<HTMLElement>(
      '[data-testid="timeline-playhead"]',
    )?.style.left;
    expect(Number.parseFloat(playheadLeft ?? "")).toBeCloseTo(5.5);
  });

  it("uses the same surface for clicks on the Ruler and track", async () => {
    const surface = container.querySelector<HTMLElement>(
      '[data-testid="timeline-time-surface"]',
    );
    const ruler = container.querySelector<HTMLElement>(
      '[aria-label="Timeline ruler, 0 to 60 seconds"]',
    );
    const track = surface?.children[1] as HTMLElement | undefined;
    expect(surface).not.toBeNull();
    expect(ruler).not.toBeNull();
    expect(track).toBeDefined();
    setTimelineBounds(surface as HTMLElement);

    await clickAt(ruler as HTMLElement, 350);
    expect(useEditorStore.getState().currentTime).toBe(2.5);

    await clickAt(track as HTMLElement, 850);
    expect(useEditorStore.getState().currentTime).toBe(7.5);
  });

  it("reacts to currentTime updates made through the Store", async () => {
    await act(async () => {
      useEditorStore.getState().setCurrentTime(60);
    });

    const playhead = container.querySelector<HTMLElement>(
      '[data-testid="timeline-playhead"]',
    );
    expect(container.textContent).toContain("Current time: 60.00s");
    expect(playhead?.style.left).toBe("100%");
    expect(playhead?.style.transform).toBe("translateX(-100%)");
  });

  it("changes only currentTime and preserves Animation Data and selection", async () => {
    await act(async () => {
      useEditorStore.getState().setSceneBackground("intersection-01");
      useEditorStore.getState().addVehicle("car-blue-sedan");
    });
    const vehicleId = useEditorStore.getState().project.scene.objects[0]?.id;
    expect(vehicleId).toBeDefined();
    await act(async () => {
      useEditorStore.getState().selectObject(vehicleId as string);
    });

    const stateBeforeClick = useEditorStore.getState();
    const projectSnapshot = JSON.stringify(stateBeforeClick.project);
    const surface = container.querySelector<HTMLElement>(
      '[data-testid="timeline-time-surface"]',
    );
    expect(surface).not.toBeNull();
    setTimelineBounds(surface as HTMLElement);

    await clickAt(surface as HTMLElement, 725);

    const stateAfterClick = useEditorStore.getState();
    expect(stateAfterClick.currentTime).toBe(6.3);
    expect(stateAfterClick.project).toBe(stateBeforeClick.project);
    expect(JSON.stringify(stateAfterClick.project)).toBe(projectSnapshot);
    expect(stateAfterClick.project.scene.objects[0]?.movement.points).toEqual(
      stateBeforeClick.project.scene.objects[0]?.movement.points,
    );
    expect(stateAfterClick.selection).toBe(stateBeforeClick.selection);
  });
});
