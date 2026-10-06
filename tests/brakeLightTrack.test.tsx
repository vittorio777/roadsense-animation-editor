import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { PropertiesPanel } from "../src/editor/components/properties/PropertiesPanel";
import { createEmptyAnimationProject } from "../src/model/animation";
import { resolveStateValueAtTime } from "../src/model/stateTrack";
import { useEditorStore } from "../src/store/editorStore";

describe("F5.3 Brake Light Track", () => {
  let container: HTMLDivElement;
  let root: Root;
  let vehicleId: string;

  const getBrakeLightSwitch = () => {
    const control = container.querySelector<HTMLButtonElement>(
      '[role="switch"][aria-label="Brake light"]',
    );

    if (!control) {
      throw new Error("Missing Brake light switch");
    }

    return control;
  };

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

  it("shows one accessible Brake light switch in the initial Off state", () => {
    const control = getBrakeLightSwitch();

    expect(
      container.querySelectorAll('[role="switch"][aria-label="Brake light"]'),
    ).toHaveLength(1);
    expect(control.getAttribute("aria-checked")).toBe("false");
    expect(container.textContent).toContain("Brake light");
    expect(container.textContent).toContain("Off");
  });

  it("hides the Brake light switch without a Vehicle selection", async () => {
    await act(async () => {
      useEditorStore.getState().clearSelection();
    });

    expect(
      container.querySelector('[role="switch"][aria-label="Brake light"]'),
    ).toBeNull();
  });

  it("updates the initial Keyframe and preserves unrelated data", async () => {
    const stateBefore = useEditorStore.getState();
    const vehicleBefore = stateBefore.project.scene.objects[0]!;
    const keyframeBefore = vehicleBefore.stateTracks.brakeLight.keyframes[0]!;

    await act(async () => {
      getBrakeLightSwitch().click();
    });

    const stateAfter = useEditorStore.getState();
    const vehicleAfter = stateAfter.project.scene.objects[0]!;
    const keyframeAfter = vehicleAfter.stateTracks.brakeLight.keyframes[0]!;
    expect(keyframeAfter).toEqual({ ...keyframeBefore, value: true });
    expect(keyframeAfter.id).toBe(keyframeBefore.id);
    expect(keyframeAfter.time).toBe(0);
    expect(vehicleAfter.stateTracks.brakeLight.keyframes).toHaveLength(1);
    expect(vehicleAfter.stateTracks.indicator).toBe(
      vehicleBefore.stateTracks.indicator,
    );
    expect(vehicleAfter.stateTracks.headlight).toBe(
      vehicleBefore.stateTracks.headlight,
    );
    expect(vehicleAfter.stateTracks.horn).toBe(vehicleBefore.stateTracks.horn);
    expect(vehicleAfter.movement).toBe(vehicleBefore.movement);
    expect(stateAfter.project.scene.background).toBe(
      stateBefore.project.scene.background,
    );
    expect(stateAfter.selection).toBe(stateBefore.selection);
    expect(stateAfter.currentTime).toBe(0);
    expect(getBrakeLightSwitch().getAttribute("aria-checked")).toBe("true");
    expect(container.textContent).toContain("On");
  });

  it("creates sorted boolean Keyframes and resolves their sustained state", async () => {
    await act(async () => {
      getBrakeLightSwitch().click();
    });
    await act(async () => {
      useEditorStore.getState().setCurrentTime(6);
    });
    await act(async () => {
      getBrakeLightSwitch().click();
    });
    await act(async () => {
      useEditorStore.getState().setCurrentTime(3);
    });
    await act(async () => {
      getBrakeLightSwitch().click();
    });

    const track = useEditorStore.getState().project.scene.objects[0]!.stateTracks
      .brakeLight;
    expect(track.keyframes.map(({ time, value }) => ({ time, value }))).toEqual([
      { time: 0, value: true },
      { time: 3, value: false },
      { time: 6, value: false },
    ]);
    expect(track.keyframes.every((keyframe) => keyframe.id.length > 0)).toBe(
      true,
    );
    expect(new Set(track.keyframes.map((keyframe) => keyframe.id)).size).toBe(3);

    await act(async () => {
      useEditorStore.getState().setCurrentTime(2);
    });
    expect(getBrakeLightSwitch().getAttribute("aria-checked")).toBe("true");
    await act(async () => {
      useEditorStore.getState().setCurrentTime(4);
    });
    expect(getBrakeLightSwitch().getAttribute("aria-checked")).toBe("false");
  });

  it("updates an existing current-time Keyframe without duplicating its time", () => {
    useEditorStore.getState().setCurrentTime(3);
    useEditorStore
      .getState()
      .updateVehicleStateAtCurrentTime(vehicleId, "brakeLight", true);
    const keyframeBefore = useEditorStore.getState().project.scene.objects[0]!
      .stateTracks.brakeLight.keyframes[1]!;

    useEditorStore
      .getState()
      .updateVehicleStateAtCurrentTime(vehicleId, "brakeLight", false);

    const keyframes = useEditorStore.getState().project.scene.objects[0]!
      .stateTracks.brakeLight.keyframes;
    expect(keyframes).toHaveLength(2);
    expect(keyframes.filter((keyframe) => keyframe.time === 3)).toHaveLength(1);
    expect(keyframes[1]).toEqual({ ...keyframeBefore, value: false });
  });

  it("keeps seek and same-value Store requests as data no-ops", async () => {
    const projectBeforeSeek = useEditorStore.getState().project;
    const trackBeforeSeek = projectBeforeSeek.scene.objects[0]!.stateTracks
      .brakeLight;

    await act(async () => {
      useEditorStore.getState().setCurrentTime(3);
    });
    expect(useEditorStore.getState().project).toBe(projectBeforeSeek);
    expect(
      useEditorStore.getState().project.scene.objects[0]!.stateTracks.brakeLight,
    ).toBe(trackBeforeSeek);

    const stateBeforeSameValue = useEditorStore.getState();
    stateBeforeSameValue.updateVehicleStateAtCurrentTime(
      vehicleId,
      "brakeLight",
      false,
    );
    expect(useEditorStore.getState()).toBe(stateBeforeSameValue);
  });

  it("keeps Brake light available for Point and Path selection", async () => {
    useEditorStore.getState().setCurrentTime(3);
    useEditorStore.getState().updateVehiclePosition(vehicleId, 900, 500);
    const vehicle = useEditorStore.getState().project.scene.objects[0]!;

    await act(async () => {
      useEditorStore
        .getState()
        .selectMovementPoint(vehicleId, vehicle.movement.points[1]!.id);
    });
    expect(getBrakeLightSwitch()).toBeTruthy();

    await act(async () => {
      useEditorStore
        .getState()
        .selectPath(vehicleId, vehicle.movement.paths[0]!.id);
    });
    expect(getBrakeLightSwitch()).toBeTruthy();
  });

  it("keeps Indicator independent while Brake light changes", () => {
    useEditorStore.getState().updateVehicleStateAtCurrentTime(
      vehicleId,
      "indicator",
      "left",
    );
    const indicatorBefore = useEditorStore.getState().project.scene.objects[0]!
      .stateTracks.indicator;

    useEditorStore.getState().updateVehicleStateAtCurrentTime(
      vehicleId,
      "brakeLight",
      true,
    );

    const tracks = useEditorStore.getState().project.scene.objects[0]!
      .stateTracks;
    expect(tracks.indicator).toBe(indicatorBefore);
    expect(resolveStateValueAtTime(tracks.indicator, 0)).toBe("left");
    expect(resolveStateValueAtTime(tracks.brakeLight, 0)).toBe(true);
  });
});
