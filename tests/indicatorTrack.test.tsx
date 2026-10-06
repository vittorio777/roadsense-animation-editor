import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { PropertiesPanel } from "../src/editor/components/properties/PropertiesPanel";
import { createEmptyAnimationProject } from "../src/model/animation";
import { resolveStateValueAtTime } from "../src/model/stateTrack";
import { useEditorStore } from "../src/store/editorStore";

function getIndicatorOption(
  container: HTMLElement,
  label: "Off" | "Left" | "Right" | "Hazard",
): HTMLButtonElement {
  const options = Array.from(
    container.querySelectorAll<HTMLButtonElement>('[role="radio"]'),
  );
  const option = options.find((candidate) => candidate.textContent === label);

  if (!option) {
    throw new Error(`Missing Indicator option: ${label}`);
  }

  return option;
}

describe("F5.2 Indicator Track", () => {
  let container: HTMLDivElement;
  let root: Root;
  let vehicleId: string;

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
    vehicleId = useEditorStore.getState().project.scene.objects[0]!.id;
    useEditorStore.getState().selectObject(vehicleId);

    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);

    await act(async () => {
      root.render(<PropertiesPanel />);
    });
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("shows exactly four accessible Indicator options for a selected Vehicle", () => {
    const group = container.querySelector('[role="radiogroup"]');
    const options = Array.from(
      container.querySelectorAll<HTMLButtonElement>('[role="radio"]'),
    );

    expect(group?.getAttribute("aria-label")).toBe("Indicator");
    expect(options.map((option) => option.textContent)).toEqual([
      "Off",
      "Left",
      "Right",
      "Hazard",
    ]);
    expect(getIndicatorOption(container, "Off").getAttribute("aria-checked")).toBe(
      "true",
    );
    expect(options.filter((option) => option.getAttribute("aria-checked") === "true"))
      .toHaveLength(1);
  });

  it("hides the Indicator control without a Vehicle selection", async () => {
    await act(async () => {
      useEditorStore.getState().clearSelection();
    });

    expect(container.querySelector('[role="radiogroup"]')).toBeNull();
  });

  it("updates the existing initial Keyframe while preserving its identity", async () => {
    const stateBefore = useEditorStore.getState();
    const vehicleBefore = stateBefore.project.scene.objects[0]!;
    const keyframeBefore = vehicleBefore.stateTracks.indicator.keyframes[0]!;

    await act(async () => {
      getIndicatorOption(container, "Left").click();
    });

    const stateAfter = useEditorStore.getState();
    const vehicleAfter = stateAfter.project.scene.objects[0]!;
    const keyframeAfter = vehicleAfter.stateTracks.indicator.keyframes[0]!;
    expect(keyframeAfter).toEqual({ ...keyframeBefore, value: "left" });
    expect(keyframeAfter.id).toBe(keyframeBefore.id);
    expect(keyframeAfter.time).toBe(0);
    expect(vehicleAfter.stateTracks.indicator.keyframes).toHaveLength(1);
    expect(vehicleAfter.movement).toBe(vehicleBefore.movement);
    expect(vehicleAfter.stateTracks.brakeLight).toBe(
      vehicleBefore.stateTracks.brakeLight,
    );
    expect(vehicleAfter.stateTracks.headlight).toBe(
      vehicleBefore.stateTracks.headlight,
    );
    expect(vehicleAfter.stateTracks.horn).toBe(vehicleBefore.stateTracks.horn);
    expect(stateAfter.selection).toBe(stateBefore.selection);
    expect(stateAfter.currentTime).toBe(0);
    expect(getIndicatorOption(container, "Left").getAttribute("aria-checked")).toBe(
      "true",
    );
  });

  it("creates and time-sorts a unique Keyframe at a new current time", async () => {
    await act(async () => {
      getIndicatorOption(container, "Left").click();
      useEditorStore.getState().setCurrentTime(5);
      getIndicatorOption(container, "Hazard").click();
      useEditorStore.getState().setCurrentTime(2);
      getIndicatorOption(container, "Right").click();
    });

    const keyframes = useEditorStore.getState().project.scene.objects[0]!
      .stateTracks.indicator.keyframes;
    expect(keyframes.map(({ time, value }) => ({ time, value }))).toEqual([
      { time: 0, value: "left" },
      { time: 2, value: "right" },
      { time: 5, value: "hazard" },
    ]);
    expect(keyframes.every((keyframe) => keyframe.id.length > 0)).toBe(true);
    expect(new Set(keyframes.map((keyframe) => keyframe.id)).size).toBe(3);
  });

  it("resolves exact, sustained and after-last Indicator states in the UI", async () => {
    await act(async () => {
      getIndicatorOption(container, "Left").click();
      useEditorStore.getState().setCurrentTime(2);
      getIndicatorOption(container, "Right").click();
      useEditorStore.getState().setCurrentTime(5);
      getIndicatorOption(container, "Off").click();
    });

    for (const [time, label] of [
      [0, "Left"],
      [1.9, "Left"],
      [2, "Right"],
      [4.9, "Right"],
      [5, "Off"],
      [9, "Off"],
    ] as const) {
      await act(async () => {
        useEditorStore.getState().setCurrentTime(time);
      });
      expect(getIndicatorOption(container, label).getAttribute("aria-checked")).toBe(
        "true",
      );
    }
  });

  it("keeps seek and repeated same-value selection as complete data no-ops", async () => {
    const projectBeforeSeek = useEditorStore.getState().project;
    const trackBeforeSeek = projectBeforeSeek.scene.objects[0]!.stateTracks.indicator;

    await act(async () => {
      useEditorStore.getState().setCurrentTime(3);
    });

    expect(useEditorStore.getState().project).toBe(projectBeforeSeek);
    expect(
      useEditorStore.getState().project.scene.objects[0]!.stateTracks.indicator,
    ).toBe(trackBeforeSeek);

    const stateBeforeRepeat = useEditorStore.getState();
    await act(async () => {
      getIndicatorOption(container, "Off").click();
    });
    expect(useEditorStore.getState()).toBe(stateBeforeRepeat);
  });

  it("keeps Indicator available for Movement Point and Path selections", async () => {
    useEditorStore.getState().setCurrentTime(3);
    useEditorStore.getState().updateVehiclePosition(vehicleId, 900, 500);
    const vehicle = useEditorStore.getState().project.scene.objects[0]!;

    await act(async () => {
      useEditorStore
        .getState()
        .selectMovementPoint(vehicleId, vehicle.movement.points[1]!.id);
    });
    expect(container.querySelector('[role="radiogroup"]')).not.toBeNull();

    await act(async () => {
      useEditorStore
        .getState()
        .selectPath(vehicleId, vehicle.movement.paths[0]!.id);
    });
    expect(container.querySelector('[role="radiogroup"]')).not.toBeNull();
  });

  it("rejects missing Vehicles, invalid time, Track key and value atomically", async () => {
    const update = useEditorStore.getState().updateVehicleStateAtCurrentTime as (
      objectId: string,
      trackKey: unknown,
      value: unknown,
    ) => void;
    const requests: Array<() => void> = [
      () => update("missing", "indicator", "left"),
      () => update(vehicleId, "missing-track", "left"),
      () => update(vehicleId, "indicator", "invalid"),
    ];

    for (const request of requests) {
      const stateBefore = useEditorStore.getState();
      request();
      expect(useEditorStore.getState()).toBe(stateBefore);
    }

    for (const currentTime of [Number.NaN, Infinity, -1]) {
      await act(async () => {
        useEditorStore.setState({ currentTime });
      });
      const stateBefore = useEditorStore.getState();
      update(vehicleId, "indicator", "left");
      expect(useEditorStore.getState()).toBe(stateBefore);
    }
  });

  it("updates only Indicator data and leaves other animation data isolated", () => {
    useEditorStore.getState().setCurrentTime(3);
    const stateBefore = useEditorStore.getState();
    const vehicleBefore = stateBefore.project.scene.objects[0]!;

    stateBefore.updateVehicleStateAtCurrentTime(vehicleId, "indicator", "right");

    const stateAfter = useEditorStore.getState();
    const vehicleAfter = stateAfter.project.scene.objects[0]!;
    expect(resolveStateValueAtTime(vehicleAfter.stateTracks.indicator, 3)).toBe(
      "right",
    );
    expect(vehicleAfter.movement).toBe(vehicleBefore.movement);
    expect(vehicleAfter.stateTracks.brakeLight).toBe(
      vehicleBefore.stateTracks.brakeLight,
    );
    expect(vehicleAfter.stateTracks.headlight).toBe(
      vehicleBefore.stateTracks.headlight,
    );
    expect(vehicleAfter.stateTracks.horn).toBe(vehicleBefore.stateTracks.horn);
    expect(stateAfter.project.scene.background).toBe(
      stateBefore.project.scene.background,
    );
    expect(stateAfter.selection).toBe(stateBefore.selection);
    expect(stateAfter.currentTime).toBe(3);
  });
});
