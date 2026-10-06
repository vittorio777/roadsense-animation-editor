import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { PropertiesPanel } from "../src/editor/components/properties/PropertiesPanel";
import { TimelinePanel } from "../src/editor/components/timeline/TimelinePanel";
import { createEmptyAnimationProject } from "../src/model/animation";
import { prepareAnimationProjectFile } from "../src/persistence/projectLoader";
import { serializeAnimationProject } from "../src/persistence/projectSerializer";
import { validateAnimationProject } from "../src/persistence/projectValidator";
import { useEditorStore } from "../src/store/editorStore";

function addVehicles(count: number) {
  for (let index = 0; index < count; index += 1) {
    useEditorStore.getState().addVehicle("car-blue-sedan");
  }
}

function collectStableIds() {
  return useEditorStore.getState().project.scene.objects.flatMap((vehicle) => [
    vehicle.id,
    ...vehicle.movement.points.map((point) => point.id),
    ...vehicle.movement.paths.map((path) => path.id),
    ...Object.values(vehicle.stateTracks).flatMap((track) =>
      track.keyframes.map((keyframe) => keyframe.id),
    ),
  ]);
}

describe("F7.1 multiple Vehicles", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    useEditorStore.setState({
      project: createEmptyAnimationProject("multiple-vehicles"),
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

  it("creates five complete instances with unique IDs and logical positions", () => {
    addVehicles(5);

    const project = useEditorStore.getState().project;
    const ids = collectStableIds();
    expect(project.scene.objects).toHaveLength(5);
    expect(new Set(ids).size).toBe(ids.length);
    expect(
      project.scene.objects.map((vehicle) => vehicle.movement.points[0]),
    ).toEqual([
      expect.objectContaining({ time: 0, x: 800, y: 450 }),
      expect.objectContaining({ time: 0, x: 960, y: 450 }),
      expect.objectContaining({ time: 0, x: 640, y: 450 }),
      expect.objectContaining({ time: 0, x: 1120, y: 450 }),
      expect.objectContaining({ time: 0, x: 480, y: 450 }),
    ]);
    for (const vehicle of project.scene.objects) {
      expect(vehicle.movement.paths).toEqual([]);
      expect(
        Object.values(vehicle.stateTracks).every(
          (track) => track.keyframes.length === 1 && track.keyframes[0]?.time === 0,
        ),
      ).toBe(true);
    }
    expect(validateAnimationProject(project)).toEqual({ valid: true, errors: [] });
  });

  it("derives placement from logical Scene dimensions", () => {
    useEditorStore.setState({
      project: {
        ...createEmptyAnimationProject("custom-scene"),
        scene: { width: 1000, height: 500, objects: [] },
      },
    });

    addVehicles(5);

    expect(
      useEditorStore
        .getState()
        .project.scene.objects.map((vehicle) => vehicle.movement.points[0]!)
        .map(({ x, y }) => ({ x, y })),
    ).toEqual([
      { x: 500, y: 250 },
      { x: 600, y: 250 },
      { x: 400, y: 250 },
      { x: 700, y: 250 },
      { x: 300, y: 250 },
    ]);
  });

  it("keeps Movement, Path, State and selection mutations isolated by Vehicle ID", () => {
    addVehicles(2);
    const [first, second] = useEditorStore.getState().project.scene.objects;
    const secondBefore = second!;
    useEditorStore.getState().setCurrentTime(3);
    useEditorStore.getState().updateVehiclePosition(first!.id, 360, 280);

    let firstAfter = useEditorStore.getState().project.scene.objects[0]!;
    expect(useEditorStore.getState().project.scene.objects[1]).toBe(secondBefore);
    expect(firstAfter.movement.points).toHaveLength(2);
    expect(firstAfter.movement.paths).toHaveLength(1);

    useEditorStore.getState().updatePathControlPoint(
      first!.id,
      firstAfter.movement.paths[0]!.id,
      "control1",
      410,
      120,
    );
    useEditorStore
      .getState()
      .updateVehicleStateAtCurrentTime(first!.id, "headlight", true);
    firstAfter = useEditorStore.getState().project.scene.objects[0]!;

    expect(firstAfter.movement.paths[0]!.control1).toEqual({ x: 410, y: 120 });
    expect(firstAfter.stateTracks.headlight.keyframes).toHaveLength(2);
    expect(useEditorStore.getState().project.scene.objects[1]).toBe(secondBefore);

    useEditorStore.getState().setSelection({
      objectId: first!.id,
      movementPointId: firstAfter.movement.points[1]!.id,
      pathId: firstAfter.movement.paths[0]!.id,
      stateKeyframeId: firstAfter.stateTracks.headlight.keyframes[1]!.id,
    });
    useEditorStore.getState().selectObject(second!.id);
    expect(useEditorStore.getState()).toMatchObject({
      currentTime: 3,
      selection: {
        objectId: second!.id,
        movementPointId: null,
        pathId: null,
        stateKeyframeId: null,
      },
    });
  });

  it("renders ordered, distinguishable Timeline groups with local collapse", async () => {
    addVehicles(3);
    const vehicles = useEditorStore.getState().project.scene.objects;

    await act(async () => {
      root.render(<TimelinePanel />);
    });

    const groups = container.querySelectorAll<HTMLElement>(
      "[data-vehicle-timeline-group]",
    );
    expect([...groups].map((group) => group.dataset.vehicleTimelineGroup)).toEqual(
      vehicles.map((vehicle) => vehicle.id),
    );
    expect([...groups].map((group) => group.textContent)).toEqual([
      expect.stringContaining("Car Blue Sedan 1 of 3"),
      expect.stringContaining("Car Blue Sedan 2 of 3"),
      expect.stringContaining("Car Blue Sedan 3 of 3"),
    ]);
    for (const vehicle of vehicles) {
      expect(
        container.querySelectorAll(
          `[data-vehicle-id="${vehicle.id}"][data-timeline-lane]`,
        ),
      ).toHaveLength(6);
    }

    const firstToggle = container.querySelector<HTMLButtonElement>(
      `[data-vehicle-timeline-toggle="${vehicles[0]!.id}"]`,
    )!;
    await act(async () => {
      firstToggle.click();
    });
    expect(
      container.querySelectorAll(
        `[data-vehicle-id="${vehicles[0]!.id}"][data-timeline-lane]`,
      ),
    ).toHaveLength(0);
    expect(
      container.querySelectorAll(
        `[data-vehicle-id="${vehicles[1]!.id}"][data-timeline-lane]`,
      ),
    ).toHaveLength(6);
  });

  it("shows Properties for the selected instance rather than the shared asset", async () => {
    addVehicles(2);
    const [first, second] = useEditorStore.getState().project.scene.objects;

    await act(async () => {
      root.render(<PropertiesPanel />);
      useEditorStore.getState().selectObject(first!.id);
    });
    expect(container.textContent).toContain(first!.id);
    expect(
      container.querySelector<HTMLInputElement>('input[aria-label="Position X"]')
        ?.value,
    ).toBe("800");

    await act(async () => {
      useEditorStore.getState().selectObject(second!.id);
    });
    expect(container.textContent).toContain(second!.id);
    expect(container.textContent).not.toContain(first!.id);
    expect(
      container.querySelector<HTMLInputElement>('input[aria-label="Position X"]')
        ?.value,
    ).toBe("960");
  });

  it("round-trips multiple Vehicles with ordered Asset resolution", async () => {
    useEditorStore.getState().setSceneBackground("intersection-01");
    addVehicles(3);
    const source = structuredClone(useEditorStore.getState().project);
    const serialized = serializeAnimationProject(source);
    expect(serialized.status).toBe("serialized");
    if (serialized.status !== "serialized") {
      throw new Error(serialized.errors.join(" "));
    }

    const prepared = await prepareAnimationProjectFile({
      text: async () => serialized.json,
    });
    expect(prepared.status).toBe("ready");
    if (prepared.status !== "ready") {
      throw new Error(`Expected ready result, received ${prepared.status}.`);
    }
    expect(prepared.project).toEqual(source);
    expect(prepared.assets.vehicles.map(({ objectId }) => objectId)).toEqual(
      source.scene.objects.map((vehicle) => vehicle.id),
    );
  });
});
