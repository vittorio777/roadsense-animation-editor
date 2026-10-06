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
import { createVehicleObject } from "../src/model/vehicle";
import { useEditorStore } from "../src/store/editorStore";

const reactTestEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT: boolean;
};

const laneOrder = [
  "movement",
  "left-indicator",
  "right-indicator",
  "brake-light",
  "headlight",
  "horn",
];

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

describe("F5.7 Vehicle State Timeline Hierarchy", () => {
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
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  async function renderTimeline() {
    await act(async () => {
      root.render(<TimelinePanel />);
    });
  }

  it("keeps the ruler and seek surface while showing an honest empty state", async () => {
    await renderTimeline();

    expect(container.textContent).toContain("No vehicles");
    expect(
      container.querySelector('[aria-label="Timeline ruler, 0 to 60 seconds"]'),
    ).not.toBeNull();
    expect(container.querySelector('[data-testid="timeline-playhead"]')).not.toBeNull();
    expect(container.querySelectorAll("[data-vehicle-timeline-group]")).toHaveLength(0);
    expect(
      container
        .querySelector('[data-testid="timeline-scroll-region"]')
        ?.className.includes("overflow-auto"),
    ).toBe(true);
  });

  it("renders a registry-backed vehicle and its six ordered lanes", async () => {
    useEditorStore.getState().addVehicle("car-blue-sedan");
    const vehicle = useEditorStore.getState().project.scene.objects[0]!;

    await renderTimeline();

    const group = container.querySelector(
      `[data-vehicle-timeline-group="${vehicle.id}"]`,
    );
    const toggle = group?.querySelector("button");
    const icon = group?.querySelector("img");
    const lanes = container.querySelectorAll(
      `[data-vehicle-id="${vehicle.id}"][data-timeline-lane]`,
    );

    expect(group?.textContent).toContain("Car Blue Sedan");
    expect(icon?.getAttribute("src")).toBe("/assets/vehicles/car-blue-sedan.svg");
    expect(toggle?.getAttribute("aria-expanded")).toBe("true");
    expect([...lanes].map((lane) => lane.getAttribute("data-timeline-lane"))).toEqual(
      laneOrder,
    );
  });

  it("projects state keyframes into aligned read-only intervals", async () => {
    const store = useEditorStore.getState();
    store.addVehicle("car-blue-sedan");
    const vehicleId = useEditorStore.getState().project.scene.objects[0]!.id;

    const updateAt = (
      time: number,
      update: () => void,
    ) => {
      useEditorStore.getState().setCurrentTime(time);
      update();
    };

    updateAt(1, () =>
      useEditorStore
        .getState()
        .updateVehicleStateAtCurrentTime(vehicleId, "indicator", "left"),
    );
    updateAt(3, () =>
      useEditorStore
        .getState()
        .updateVehicleStateAtCurrentTime(vehicleId, "indicator", "hazard"),
    );
    updateAt(5, () =>
      useEditorStore
        .getState()
        .updateVehicleStateAtCurrentTime(vehicleId, "indicator", "right"),
    );
    updateAt(7, () =>
      useEditorStore
        .getState()
        .updateVehicleStateAtCurrentTime(vehicleId, "indicator", "off"),
    );
    updateAt(2, () =>
      useEditorStore
        .getState()
        .updateVehicleStateAtCurrentTime(vehicleId, "brakeLight", true),
    );
    updateAt(4, () =>
      useEditorStore
        .getState()
        .updateVehicleStateAtCurrentTime(vehicleId, "brakeLight", false),
    );
    updateAt(8, () =>
      useEditorStore
        .getState()
        .updateVehicleStateAtCurrentTime(vehicleId, "headlight", true),
    );
    updateAt(6, () =>
      useEditorStore
        .getState()
        .updateVehicleStateAtCurrentTime(vehicleId, "horn", true),
    );
    updateAt(9, () =>
      useEditorStore
        .getState()
        .updateVehicleStateAtCurrentTime(vehicleId, "horn", false),
    );

    const projectBeforeRender = useEditorStore.getState().project;
    const snapshot = JSON.stringify(projectBeforeRender);
    await renderTimeline();

    const left = container.querySelector<HTMLElement>(
      '[data-state-interval="left-indicator"]',
    );
    const right = container.querySelector<HTMLElement>(
      '[data-state-interval="right-indicator"]',
    );
    const brake = container.querySelector<HTMLElement>(
      '[data-state-interval="brake-light"]',
    );
    const headlight = container.querySelector<HTMLElement>(
      '[data-state-interval="headlight"]',
    );
    const horn = container.querySelector<HTMLElement>(
      '[data-state-interval="horn"]',
    );

    expect(Number.parseFloat(left?.style.left ?? "")).toBeCloseTo(1.667);
    expect(Number.parseFloat(left?.style.width ?? "")).toBeCloseTo(6.667);
    expect(Number.parseFloat(right?.style.left ?? "")).toBeCloseTo(5);
    expect(Number.parseFloat(right?.style.width ?? "")).toBeCloseTo(6.667);
    expect(Number.parseFloat(brake?.style.left ?? "")).toBeCloseTo(3.333);
    expect(Number.parseFloat(brake?.style.width ?? "")).toBeCloseTo(3.333);
    expect(Number.parseFloat(headlight?.style.left ?? "")).toBeCloseTo(13.333);
    expect(Number.parseFloat(headlight?.style.width ?? "")).toBeCloseTo(86.667);
    expect(headlight?.dataset.openEnded).toBe("true");
    expect(Number.parseFloat(horn?.style.left ?? "")).toBeCloseTo(10);
    expect(Number.parseFloat(horn?.style.width ?? "")).toBeCloseTo(5);
    expect(
      container.querySelectorAll('[data-state-interval] [data-interval-body]'),
    ).toHaveLength(5);
    expect(container.querySelectorAll('[data-interval-handle]')).toHaveLength(0);
    expect(useEditorStore.getState().project).toBe(projectBeforeRender);
    expect(JSON.stringify(useEditorStore.getState().project)).toBe(snapshot);
  });

  it("collapses and expands locally without changing editor state", async () => {
    useEditorStore.getState().addVehicle("car-blue-sedan");
    const stateBefore = useEditorStore.getState();
    const vehicle = stateBefore.project.scene.objects[0]!;
    await renderTimeline();

    const toggle = container.querySelector<HTMLButtonElement>(
      `[data-vehicle-timeline-toggle="${vehicle.id}"]`,
    )!;
    await act(async () => {
      toggle.click();
    });

    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(
      container.querySelectorAll(
        `[data-vehicle-id="${vehicle.id}"][data-timeline-lane]`,
      ),
    ).toHaveLength(0);
    expect(useEditorStore.getState()).toBe(stateBefore);

    await act(async () => {
      toggle.click();
    });
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(
      container.querySelectorAll(
        `[data-vehicle-id="${vehicle.id}"][data-timeline-lane]`,
      ),
    ).toHaveLength(6);
    expect(useEditorStore.getState()).toBe(stateBefore);
  });

  it("renders independent groups from scene order with a safe asset fallback", async () => {
    const project = createEmptyAnimationProject();
    const first = createVehicleObject({
      assetId: "car-blue-sedan",
      x: 400,
      y: 450,
      createId: (kind) => `first-${kind}`,
    });
    const second = createVehicleObject({
      assetId: "missing-car",
      x: 900,
      y: 450,
      createId: (kind) => `second-${kind}`,
    });
    project.scene.objects = [first, second];
    useEditorStore.getState().setProject(project);

    await renderTimeline();

    const groups = container.querySelectorAll<HTMLElement>(
      "[data-vehicle-timeline-group]",
    );
    expect([...groups].map((group) => group.dataset.vehicleTimelineGroup)).toEqual([
      first.id,
      second.id,
    ]);
    expect(groups[0]?.textContent).toContain("Car Blue Sedan");
    expect(groups[1]?.textContent).toContain("Unknown vehicle (missing-car)");
    expect(
      container.querySelectorAll(
        `[data-vehicle-id="${first.id}"][data-timeline-lane]`,
      ),
    ).toHaveLength(6);
    expect(
      container.querySelectorAll(
        `[data-vehicle-id="${second.id}"][data-timeline-lane]`,
      ),
    ).toHaveLength(6);
  });

  it("keeps state lanes seekable without changing animation data", async () => {
    useEditorStore.getState().addVehicle("car-blue-sedan");
    const projectBefore = useEditorStore.getState().project;
    const snapshot = JSON.stringify(projectBefore);
    await renderTimeline();

    const surface = container.querySelector<HTMLElement>(
      '[data-testid="timeline-time-surface"]',
    )!;
    const lane = container.querySelector<HTMLElement>(
      '[data-timeline-lane="horn"]',
    )!;
    setTimelineBounds(surface);

    await act(async () => {
      lane.dispatchEvent(
        new MouseEvent("click", { bubbles: true, clientX: 426 }),
      );
    });

    expect(useEditorStore.getState().currentTime).toBe(3.3);
    expect(useEditorStore.getState().project).toBe(projectBefore);
    expect(JSON.stringify(useEditorStore.getState().project)).toBe(snapshot);
  });
});
