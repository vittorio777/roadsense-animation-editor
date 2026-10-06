import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { TimelinePanel } from "../src/editor/components/timeline/TimelinePanel";
import {
  snapTimelineTime,
  TIMELINE_MINOR_INTERVAL,
  TIMELINE_SNAP_INTERVAL,
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

describe("F3.3 Timeline snapping", () => {
  beforeAll(() => {
    reactTestEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterAll(() => {
    reactTestEnvironment.IS_REACT_ACT_ENVIRONMENT = false;
  });

  it("uses an interaction interval matching the visual minor grid", () => {
    expect(TIMELINE_SNAP_INTERVAL).toBe(0.1);
    expect(TIMELINE_SNAP_INTERVAL).toBe(TIMELINE_MINOR_INTERVAL);
  });

  it("snaps to the nearest tenth on either side of a midpoint", () => {
    expect(snapTimelineTime(3.24)).toBe(3.2);
    expect(snapTimelineTime(3.26)).toBe(3.3);
  });

  it("uses the later tick for exact decimal midpoints", () => {
    expect(snapTimelineTime(3.25)).toBe(3.3);
    expect(snapTimelineTime(9.95)).toBe(10);
  });

  it("keeps existing tick values stable without floating-point tails", () => {
    expect(snapTimelineTime(0)).toBe(0);
    expect(snapTimelineTime(0.1)).toBe(0.1);
    expect(snapTimelineTime(3.3)).toBe(3.3);
    expect(snapTimelineTime(5)).toBe(5);
    expect(snapTimelineTime(10)).toBe(10);
  });

  it("clamps snapping results to the Timeline endpoints", () => {
    expect(snapTimelineTime(-1)).toBe(0);
    expect(snapTimelineTime(0.04)).toBe(0);
    expect(snapTimelineTime(59.96)).toBe(60);
    expect(snapTimelineTime(61)).toBe(60);
  });

  it("snaps Timeline clicks while preserving Project and selection", async () => {
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
    expect(vehicleId).toBeDefined();
    useEditorStore.getState().selectObject(vehicleId as string);
    const stateBeforeClick = useEditorStore.getState();
    const projectSnapshot = JSON.stringify(stateBeforeClick.project);

    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(<TimelinePanel />);
    });
    const surface = container.querySelector<HTMLElement>(
      '[data-testid="timeline-time-surface"]',
    );
    expect(surface).not.toBeNull();
    setTimelineBounds(surface as HTMLElement);

    await act(async () => {
      surface?.dispatchEvent(
        new MouseEvent("click", { bubbles: true, clientX: 424 }),
      );
    });
    expect(useEditorStore.getState().currentTime).toBe(3.2);
    expect(container.textContent).toContain("Current time: 3.20s");

    await act(async () => {
      surface?.dispatchEvent(
        new MouseEvent("click", { bubbles: true, clientX: 426 }),
      );
    });
    const stateAfterClick = useEditorStore.getState();
    expect(stateAfterClick.currentTime).toBe(3.3);
    expect(container.textContent).toContain("Current time: 3.30s");
    expect(stateAfterClick.project).toBe(stateBeforeClick.project);
    expect(JSON.stringify(stateAfterClick.project)).toBe(projectSnapshot);
    expect(stateAfterClick.selection).toBe(stateBeforeClick.selection);

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("does not snap direct Store time updates", () => {
    useEditorStore.getState().setCurrentTime(3.25);

    expect(useEditorStore.getState().currentTime).toBe(3.25);
  });
});
