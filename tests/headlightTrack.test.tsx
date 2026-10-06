import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { PropertiesPanel } from "../src/editor/components/properties/PropertiesPanel";
import { createEmptyAnimationProject } from "../src/model/animation";
import { resolveStateValueAtTime } from "../src/model/stateTrack";
import { useEditorStore } from "../src/store/editorStore";

describe("F5.4 Headlight Track", () => {
  let container: HTMLDivElement;
  let root: Root;
  let vehicleId: string;

  const getSwitch = (label: "Brake light" | "Headlight" | "Horn") => {
    const control = container.querySelector<HTMLButtonElement>(
      `[role="switch"][aria-label="${label}"]`,
    );

    if (!control) {
      throw new Error(`Missing ${label} switch`);
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

  it("shows one accessible Headlight switch after Brake light", () => {
    const brakeLight = getSwitch("Brake light");
    const headlight = getSwitch("Headlight");
    const switches = Array.from(
      container.querySelectorAll<HTMLButtonElement>('[role="switch"]'),
    );

    expect(switches.slice(0, 2)).toEqual([brakeLight, headlight]);
    expect(headlight.getAttribute("aria-checked")).toBe("false");
    expect(headlight.closest("section")?.textContent).toContain("Off");
  });

  it("hides Headlight without a Vehicle selection", async () => {
    await act(async () => {
      useEditorStore.getState().clearSelection();
    });

    expect(
      container.querySelector('[role="switch"][aria-label="Headlight"]'),
    ).toBeNull();
  });

  it("updates the initial Keyframe and preserves every unrelated Track", async () => {
    const stateBefore = useEditorStore.getState();
    const vehicleBefore = stateBefore.project.scene.objects[0]!;
    const keyframeBefore = vehicleBefore.stateTracks.headlight.keyframes[0]!;

    await act(async () => {
      getSwitch("Headlight").click();
    });

    const stateAfter = useEditorStore.getState();
    const vehicleAfter = stateAfter.project.scene.objects[0]!;
    expect(vehicleAfter.stateTracks.headlight.keyframes).toEqual([
      { ...keyframeBefore, value: true },
    ]);
    expect(vehicleAfter.stateTracks.indicator).toBe(
      vehicleBefore.stateTracks.indicator,
    );
    expect(vehicleAfter.stateTracks.brakeLight).toBe(
      vehicleBefore.stateTracks.brakeLight,
    );
    expect(vehicleAfter.stateTracks.horn).toBe(vehicleBefore.stateTracks.horn);
    expect(vehicleAfter.movement).toBe(vehicleBefore.movement);
    expect(stateAfter.selection).toBe(stateBefore.selection);
    expect(stateAfter.currentTime).toBe(0);
    expect(getSwitch("Headlight").getAttribute("aria-checked")).toBe("true");
    expect(getSwitch("Brake light").getAttribute("aria-checked")).toBe(
      "false",
    );
  });

  it("creates sorted Keyframes and displays sustained Headlight state", async () => {
    await act(async () => {
      getSwitch("Headlight").click();
    });
    await act(async () => {
      useEditorStore.getState().setCurrentTime(6);
    });
    await act(async () => {
      getSwitch("Headlight").click();
    });
    await act(async () => {
      useEditorStore.getState().setCurrentTime(3);
    });
    await act(async () => {
      getSwitch("Headlight").click();
    });

    const track = useEditorStore.getState().project.scene.objects[0]!.stateTracks
      .headlight;
    expect(track.keyframes.map(({ time, value }) => ({ time, value }))).toEqual([
      { time: 0, value: true },
      { time: 3, value: false },
      { time: 6, value: false },
    ]);
    expect(new Set(track.keyframes.map((keyframe) => keyframe.id)).size).toBe(3);

    await act(async () => {
      useEditorStore.getState().setCurrentTime(2);
    });
    expect(getSwitch("Headlight").getAttribute("aria-checked")).toBe("true");
    await act(async () => {
      useEditorStore.getState().setCurrentTime(4);
    });
    expect(getSwitch("Headlight").getAttribute("aria-checked")).toBe("false");
  });

  it("updates an exact-time Keyframe without changing its ID or time", () => {
    useEditorStore.getState().setCurrentTime(3);
    useEditorStore
      .getState()
      .updateVehicleStateAtCurrentTime(vehicleId, "headlight", true);
    const keyframeBefore = useEditorStore.getState().project.scene.objects[0]!
      .stateTracks.headlight.keyframes[1]!;

    useEditorStore
      .getState()
      .updateVehicleStateAtCurrentTime(vehicleId, "headlight", false);

    const keyframes = useEditorStore.getState().project.scene.objects[0]!
      .stateTracks.headlight.keyframes;
    expect(keyframes).toHaveLength(2);
    expect(keyframes[1]).toEqual({ ...keyframeBefore, value: false });
  });

  it("keeps seek and same-value requests as complete data no-ops", async () => {
    const projectBeforeSeek = useEditorStore.getState().project;
    const trackBeforeSeek = projectBeforeSeek.scene.objects[0]!.stateTracks
      .headlight;

    await act(async () => {
      useEditorStore.getState().setCurrentTime(3);
    });
    expect(useEditorStore.getState().project).toBe(projectBeforeSeek);
    expect(
      useEditorStore.getState().project.scene.objects[0]!.stateTracks.headlight,
    ).toBe(trackBeforeSeek);

    const stateBeforeSameValue = useEditorStore.getState();
    stateBeforeSameValue.updateVehicleStateAtCurrentTime(
      vehicleId,
      "headlight",
      false,
    );
    expect(useEditorStore.getState()).toBe(stateBeforeSameValue);
  });

  it("keeps Headlight available for Point and Path selection", async () => {
    useEditorStore.getState().setCurrentTime(3);
    useEditorStore.getState().updateVehiclePosition(vehicleId, 900, 500);
    const vehicle = useEditorStore.getState().project.scene.objects[0]!;

    await act(async () => {
      useEditorStore
        .getState()
        .selectMovementPoint(vehicleId, vehicle.movement.points[1]!.id);
    });
    expect(getSwitch("Headlight")).toBeTruthy();

    await act(async () => {
      useEditorStore
        .getState()
        .selectPath(vehicleId, vehicle.movement.paths[0]!.id);
    });
    expect(getSwitch("Headlight")).toBeTruthy();
  });

  it("keeps Indicator and Brake light independent from Headlight", () => {
    const store = useEditorStore.getState();
    store.updateVehicleStateAtCurrentTime(vehicleId, "indicator", "right");
    store.updateVehicleStateAtCurrentTime(vehicleId, "brakeLight", true);
    const tracksBefore = useEditorStore.getState().project.scene.objects[0]!
      .stateTracks;

    useEditorStore
      .getState()
      .updateVehicleStateAtCurrentTime(vehicleId, "headlight", true);

    const tracksAfter = useEditorStore.getState().project.scene.objects[0]!
      .stateTracks;
    expect(tracksAfter.indicator).toBe(tracksBefore.indicator);
    expect(tracksAfter.brakeLight).toBe(tracksBefore.brakeLight);
    expect(resolveStateValueAtTime(tracksAfter.indicator, 0)).toBe("right");
    expect(resolveStateValueAtTime(tracksAfter.brakeLight, 0)).toBe(true);
    expect(resolveStateValueAtTime(tracksAfter.headlight, 0)).toBe(true);
  });
});
