import { act, Fragment } from "react";
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

describe("F7.2 cross-panel selection synchronization", () => {
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
    useEditorStore.getState().addVehicle("car-blue-sedan");
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  async function renderPanels() {
    await act(async () => {
      root.render(
        <Fragment>
          <TimelinePanel />
          <PropertiesPanel />
        </Fragment>,
      );
    });
  }

  it("validates object and state keyframe ownership in Store actions", () => {
    const [first, second] = useEditorStore.getState().project.scene.objects;
    useEditorStore.getState().selectObject(first!.id);
    const validState = useEditorStore.getState();

    useEditorStore.getState().selectObject("missing-vehicle");
    expect(useEditorStore.getState()).toBe(validState);

    useEditorStore
      .getState()
      .selectStateKeyframe(second!.id, "missing-keyframe");
    expect(useEditorStore.getState()).toBe(validState);

    const hornKeyframe = second!.stateTracks.horn.keyframes[0]!;
    useEditorStore
      .getState()
      .selectStateKeyframe(second!.id, hornKeyframe.id);
    expect(useEditorStore.getState().selection).toEqual({
      objectId: second!.id,
      movementPointId: null,
      pathId: null,
      stateKeyframeId: hornKeyframe.id,
    });
    expect(useEditorStore.getState().currentTime).toBe(hornKeyframe.time);
  });

  it("selects Timeline vehicles independently from collapse state", async () => {
    const [first, second] = useEditorStore.getState().project.scene.objects;
    await renderPanels();

    const secondSelect = container.querySelector<HTMLButtonElement>(
      `[data-vehicle-timeline-select="${second!.id}"]`,
    )!;
    const secondToggle = container.querySelector<HTMLButtonElement>(
      `[data-vehicle-timeline-toggle="${second!.id}"]`,
    )!;

    await act(async () => secondSelect.click());
    expect(useEditorStore.getState().selection.objectId).toBe(second!.id);
    expect(secondSelect.getAttribute("aria-pressed")).toBe("true");
    expect(secondToggle.getAttribute("aria-expanded")).toBe("true");
    expect(
      container.querySelector(
        `[data-vehicle-timeline-group="${first!.id}"]`,
      )?.getAttribute("data-selected"),
    ).toBe("false");
    expect(container.textContent).toContain(second!.id);

    const selectionBeforeCollapse = useEditorStore.getState().selection;
    await act(async () => secondToggle.click());
    expect(secondToggle.getAttribute("aria-expanded")).toBe("false");
    expect(useEditorStore.getState().selection).toBe(selectionBeforeCollapse);
  });

  it("synchronizes multi-Vehicle Point and Path ownership", async () => {
    const [first, second] = useEditorStore.getState().project.scene.objects;
    useEditorStore.getState().setCurrentTime(3);
    useEditorStore.getState().updateVehiclePosition(first!.id, 500, 400);
    useEditorStore.getState().updateVehiclePosition(second!.id, 1100, 500);
    const vehicles = useEditorStore.getState().project.scene.objects;
    const secondPoint = vehicles[1]!.movement.points[1]!;
    await renderPanels();

    const secondPointButton = container.querySelector<HTMLButtonElement>(
      `[data-vehicle-id="${second!.id}"][data-timeline-lane="movement"] [data-movement-point-id="${secondPoint.id}"]`,
    )!;
    await act(async () => secondPointButton.click());

    expect(useEditorStore.getState().selection).toMatchObject({
      objectId: second!.id,
      movementPointId: secondPoint.id,
      pathId: null,
      stateKeyframeId: null,
    });
    expect(useEditorStore.getState().currentTime).toBe(3);
    expect(container.textContent).toContain("Selected movement point");
    expect(container.textContent).toContain(secondPoint.id);
    expect(
      container.querySelectorAll('[data-movement-point-id][data-selected="true"]'),
    ).toHaveLength(1);

    const firstPath = vehicles[0]!.movement.paths[0]!;
    await act(async () => {
      useEditorStore.getState().selectPath(first!.id, firstPath.id);
    });
    expect(
      container.querySelector(
        `[data-vehicle-timeline-group="${first!.id}"]`,
      )?.getAttribute("data-selected"),
    ).toBe("true");
    expect(container.textContent).toContain("Selected path");
    expect(container.textContent).toContain(firstPath.id);
  });

  it("selects a State interval source keyframe across Timeline and Properties", async () => {
    const second = useEditorStore.getState().project.scene.objects[1]!;
    useEditorStore
      .getState()
      .createVehicleStateInterval(second.id, "brakeLight", 2, 4);
    const projectBeforeSelection = useEditorStore.getState().project;
    const startKeyframe = projectBeforeSelection.scene.objects[1]!.stateTracks.brakeLight.keyframes.find(
      (keyframe) => keyframe.time === 2,
    );
    await renderPanels();

    const intervalButton = container.querySelector<HTMLButtonElement>(
      `[data-vehicle-id="${second.id}"][data-timeline-lane="brake-light"] [data-interval-body]`,
    )!;
    await act(async () => intervalButton.click());

    expect(useEditorStore.getState().project).toBe(projectBeforeSelection);
    expect(useEditorStore.getState().currentTime).toBe(2);
    expect(useEditorStore.getState().selection).toEqual({
      objectId: second.id,
      movementPointId: null,
      pathId: null,
      stateKeyframeId: startKeyframe?.id,
    });
    expect(container.textContent).toContain("Selected state keyframe");
    expect(container.textContent).toContain("Brake light");
    expect(container.textContent).toContain("2.00s");
    expect(container.textContent).toContain(startKeyframe?.id);
  });

  it("keeps one projected Hazard lane selected for one shared keyframe", async () => {
    const first = useEditorStore.getState().project.scene.objects[0]!;
    useEditorStore.getState().setCurrentTime(1);
    useEditorStore
      .getState()
      .updateVehicleStateAtCurrentTime(first.id, "indicator", "hazard");
    useEditorStore.getState().setCurrentTime(3);
    useEditorStore
      .getState()
      .updateVehicleStateAtCurrentTime(first.id, "indicator", "off");
    const hazardKeyframe = useEditorStore
      .getState()
      .project.scene.objects[0]!.stateTracks.indicator.keyframes.find(
        (keyframe) => keyframe.time === 1,
      )!;
    await renderPanels();

    const rightInterval = container.querySelector<HTMLButtonElement>(
      `[data-vehicle-id="${first.id}"][data-timeline-lane="right-indicator"] [data-interval-body]`,
    )!;
    await act(async () => rightInterval.click());

    expect(useEditorStore.getState().selection.stateKeyframeId).toBe(
      hazardKeyframe.id,
    );
    expect(container.querySelectorAll('[data-state-interval][data-selected="true"]')).toHaveLength(1);
    expect(
      container.querySelector<HTMLElement>(
        '[data-state-interval="right-indicator"]',
      )?.dataset.selected,
    ).toBe("true");
    expect(container.textContent).toContain("Hazard");
  });
});
