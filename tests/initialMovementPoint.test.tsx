import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { TimelinePanel } from "../src/editor/components/timeline/TimelinePanel";
import { createEmptyAnimationProject } from "../src/model/animation";
import { createVehicleObject } from "../src/model/vehicle";
import { validateAnimationProject } from "../src/persistence/projectValidator";
import { useEditorStore } from "../src/store/editorStore";

const reactTestEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT: boolean;
};

function createProjectWithVehicle() {
  const project = createEmptyAnimationProject();
  project.scene.objects.push(
    createVehicleObject({
      assetId: "car-blue-sedan",
      x: 800,
      y: 450,
      createId: (kind) => `${kind}-initial`,
    }),
  );
  return project;
}

describe("F3.4 Initial Movement Point", () => {
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
  });

  it("creates exactly one zero-second Point at the Vehicle spawn position", () => {
    const vehicle = createVehicleObject({
      assetId: "car-blue-sedan",
      x: 320,
      y: 640,
      createId: (kind) => `${kind}-initial`,
    });

    expect(vehicle.movement).toEqual({
      points: [
        {
          id: "movement-point-initial",
          time: 0,
          x: 320,
          y: 640,
        },
      ],
      paths: [],
    });

    const entityIds = [
      vehicle.id,
      vehicle.movement.points[0]?.id,
      vehicle.stateTracks.indicator.keyframes[0]?.id,
      vehicle.stateTracks.brakeLight.keyframes[0]?.id,
      vehicle.stateTracks.headlight.keyframes[0]?.id,
      vehicle.stateTracks.horn.keyframes[0]?.id,
    ];
    expect(entityIds.every((id) => typeof id === "string" && id.length > 0)).toBe(
      true,
    );
    expect(new Set(entityIds).size).toBe(entityIds.length);
  });

  it("creates the initial Point at zero even when currentTime is nonzero", () => {
    useEditorStore.getState().setCurrentTime(3.3);

    useEditorStore.getState().addVehicle("car-blue-sedan");

    const state = useEditorStore.getState();
    expect(state.currentTime).toBe(3.3);
    expect(state.project.scene.objects[0]?.movement).toMatchObject({
      points: [{ time: 0, x: 800, y: 450 }],
      paths: [],
    });
    expect(state.project.scene.objects[0]?.movement.points).toHaveLength(1);
  });

  it("keeps the initial Point unchanged while Timeline clicks change time", async () => {
    useEditorStore.getState().addVehicle("car-blue-sedan");
    const stateBeforeClick = useEditorStore.getState();
    const initialPoint = stateBeforeClick.project.scene.objects[0]?.movement.points[0];
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
    Object.defineProperty(surface, "getBoundingClientRect", {
      configurable: true,
      value: () => ({
        bottom: 120,
        height: 120,
        left: 100,
        right: 6100,
        top: 0,
        width: 6000,
        x: 100,
        y: 0,
        toJSON: () => ({}),
      }),
    });

    await act(async () => {
      surface?.dispatchEvent(
        new MouseEvent("click", { bubbles: true, clientX: 430 }),
      );
    });

    const stateAfterClick = useEditorStore.getState();
    expect(stateAfterClick.currentTime).toBe(3.3);
    expect(stateAfterClick.project).toBe(stateBeforeClick.project);
    expect(JSON.stringify(stateAfterClick.project)).toBe(projectSnapshot);
    expect(stateAfterClick.project.scene.objects[0]?.movement.points).toEqual([
      initialPoint,
    ]);

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("accepts factory-created initial Movement data", () => {
    expect(validateAnimationProject(createProjectWithVehicle())).toEqual({
      valid: true,
      errors: [],
    });
  });

  it("rejects an empty Movement Point list", () => {
    const project = createProjectWithVehicle();
    project.scene.objects[0]!.movement.points = [];

    const result = validateAnimationProject(project);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      "scene.objects[0].movement must include a 0-second Movement Point.",
    );
  });

  it("rejects Movement data without a zero-second Point", () => {
    const project = createProjectWithVehicle();
    project.scene.objects[0]!.movement.points[0]!.time = 1;

    const result = validateAnimationProject(project);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      "scene.objects[0].movement must include a 0-second Movement Point.",
    );
  });

  it.each([
    ["empty ID", { id: "" }, "scene.objects[0].movement.points[0].id must be a non-empty string."],
    ["negative time", { time: -1 }, "scene.objects[0].movement.points[0].time must be a non-negative number."],
    ["non-finite time", { time: Number.NaN }, "scene.objects[0].movement.points[0].time must be a non-negative number."],
    ["non-finite x", { x: Number.POSITIVE_INFINITY }, "scene.objects[0].movement.points[0].x must be a finite number."],
    ["non-finite y", { y: Number.NaN }, "scene.objects[0].movement.points[0].y must be a finite number."],
  ])("rejects an initial Point with %s", (_label, patch, expectedError) => {
    const project = createProjectWithVehicle();
    Object.assign(project.scene.objects[0]!.movement.points[0]!, patch);

    const result = validateAnimationProject(project);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain(expectedError);
  });
});
