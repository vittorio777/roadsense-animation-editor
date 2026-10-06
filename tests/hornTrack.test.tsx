import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { PropertiesPanel } from "../src/editor/components/properties/PropertiesPanel";
import { createEmptyAnimationProject } from "../src/model/animation";
import { resolveStateValueAtTime } from "../src/model/stateTrack";
import { useEditorStore } from "../src/store/editorStore";

describe("F5.5 Horn Track", () => {
  let container: HTMLDivElement;
  let root: Root;
  let vehicleId: string;

  const getSwitch = (
    label: "Brake light" | "Headlight" | "Horn",
  ): HTMLButtonElement => {
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

  it("groups four controls under the current Playhead time", () => {
    const stateSection = container.querySelector(
      '[aria-labelledby="vehicle-state-heading"]',
    );
    const switches = Array.from(
      container.querySelectorAll<HTMLButtonElement>('[role="switch"]'),
    );

    expect(stateSection?.textContent).toContain("State at 0.00s");
    expect(container.querySelector('[role="radiogroup"][aria-label="Indicator"]'))
      .not.toBeNull();
    expect(switches.map((control) => control.getAttribute("aria-label"))).toEqual([
      "Brake light",
      "Headlight",
      "Horn",
    ]);
    expect(getSwitch("Horn").getAttribute("aria-checked")).toBe("false");
    expect(getSwitch("Horn").parentElement?.textContent).toContain("Off");
  });

  it("updates the State heading on seek without writing Animation Data", async () => {
    const projectBeforeSeek = useEditorStore.getState().project;
    const tracksBeforeSeek = projectBeforeSeek.scene.objects[0]!.stateTracks;

    await act(async () => {
      useEditorStore.getState().setCurrentTime(3.2);
    });

    expect(container.textContent).toContain("State at 3.20s");
    expect(useEditorStore.getState().project).toBe(projectBeforeSeek);
    expect(useEditorStore.getState().project.scene.objects[0]!.stateTracks).toBe(
      tracksBeforeSeek,
    );
  });

  it("hides the State section and Horn without a Vehicle selection", async () => {
    await act(async () => {
      useEditorStore.getState().clearSelection();
    });

    expect(container.querySelector("#vehicle-state-heading")).toBeNull();
    expect(container.querySelector('[role="switch"][aria-label="Horn"]')).toBeNull();
  });

  it("updates the initial Horn Keyframe without affecting other Tracks", async () => {
    const stateBefore = useEditorStore.getState();
    const vehicleBefore = stateBefore.project.scene.objects[0]!;
    const keyframeBefore = vehicleBefore.stateTracks.horn.keyframes[0]!;

    await act(async () => {
      getSwitch("Horn").click();
    });

    const stateAfter = useEditorStore.getState();
    const vehicleAfter = stateAfter.project.scene.objects[0]!;
    expect(vehicleAfter.stateTracks.horn.keyframes).toEqual([
      { ...keyframeBefore, value: true },
    ]);
    expect(vehicleAfter.stateTracks.indicator).toBe(
      vehicleBefore.stateTracks.indicator,
    );
    expect(vehicleAfter.stateTracks.brakeLight).toBe(
      vehicleBefore.stateTracks.brakeLight,
    );
    expect(vehicleAfter.stateTracks.headlight).toBe(
      vehicleBefore.stateTracks.headlight,
    );
    expect(vehicleAfter.movement).toBe(vehicleBefore.movement);
    expect(stateAfter.selection).toBe(stateBefore.selection);
    expect(stateAfter.currentTime).toBe(0);
    expect(getSwitch("Horn").getAttribute("aria-checked")).toBe("true");
  });

  it("creates sorted Keyframes and displays sustained Horn state", async () => {
    await act(async () => {
      getSwitch("Horn").click();
    });
    await act(async () => {
      useEditorStore.getState().setCurrentTime(6);
    });
    await act(async () => {
      getSwitch("Horn").click();
    });
    await act(async () => {
      useEditorStore.getState().setCurrentTime(3);
    });
    await act(async () => {
      getSwitch("Horn").click();
    });

    const track = useEditorStore.getState().project.scene.objects[0]!.stateTracks
      .horn;
    expect(track.keyframes.map(({ time, value }) => ({ time, value }))).toEqual([
      { time: 0, value: true },
      { time: 3, value: false },
      { time: 6, value: false },
    ]);
    expect(new Set(track.keyframes.map((keyframe) => keyframe.id)).size).toBe(3);

    await act(async () => {
      useEditorStore.getState().setCurrentTime(2);
    });
    expect(getSwitch("Horn").getAttribute("aria-checked")).toBe("true");
    await act(async () => {
      useEditorStore.getState().setCurrentTime(4);
    });
    expect(getSwitch("Horn").getAttribute("aria-checked")).toBe("false");
  });

  it("updates an exact-time Horn Keyframe without duplicating time", () => {
    useEditorStore.getState().setCurrentTime(3);
    useEditorStore
      .getState()
      .updateVehicleStateAtCurrentTime(vehicleId, "horn", true);
    const keyframeBefore = useEditorStore.getState().project.scene.objects[0]!
      .stateTracks.horn.keyframes[1]!;

    useEditorStore
      .getState()
      .updateVehicleStateAtCurrentTime(vehicleId, "horn", false);

    const keyframes = useEditorStore.getState().project.scene.objects[0]!
      .stateTracks.horn.keyframes;
    expect(keyframes).toHaveLength(2);
    expect(keyframes[1]).toEqual({ ...keyframeBefore, value: false });
  });

  it("keeps same-value Horn requests as complete state no-ops", () => {
    useEditorStore.getState().setCurrentTime(3);
    const stateBefore = useEditorStore.getState();

    stateBefore.updateVehicleStateAtCurrentTime(vehicleId, "horn", false);

    expect(useEditorStore.getState()).toBe(stateBefore);
  });

  it("keeps Horn available for Point and Path selections", async () => {
    useEditorStore.getState().setCurrentTime(3);
    useEditorStore.getState().updateVehiclePosition(vehicleId, 900, 500);
    const vehicle = useEditorStore.getState().project.scene.objects[0]!;

    await act(async () => {
      useEditorStore
        .getState()
        .selectMovementPoint(vehicleId, vehicle.movement.points[1]!.id);
    });
    expect(getSwitch("Horn")).toBeTruthy();

    await act(async () => {
      useEditorStore
        .getState()
        .selectPath(vehicleId, vehicle.movement.paths[0]!.id);
    });
    expect(getSwitch("Horn")).toBeTruthy();
  });

  it("keeps existing State controls independent from Horn", () => {
    const store = useEditorStore.getState();
    store.updateVehicleStateAtCurrentTime(vehicleId, "indicator", "left");
    store.updateVehicleStateAtCurrentTime(vehicleId, "brakeLight", true);
    store.updateVehicleStateAtCurrentTime(vehicleId, "headlight", true);
    const tracksBefore = useEditorStore.getState().project.scene.objects[0]!
      .stateTracks;

    useEditorStore
      .getState()
      .updateVehicleStateAtCurrentTime(vehicleId, "horn", true);

    const tracksAfter = useEditorStore.getState().project.scene.objects[0]!
      .stateTracks;
    expect(tracksAfter.indicator).toBe(tracksBefore.indicator);
    expect(tracksAfter.brakeLight).toBe(tracksBefore.brakeLight);
    expect(tracksAfter.headlight).toBe(tracksBefore.headlight);
    expect(resolveStateValueAtTime(tracksAfter.indicator, 0)).toBe("left");
    expect(resolveStateValueAtTime(tracksAfter.brakeLight, 0)).toBe(true);
    expect(resolveStateValueAtTime(tracksAfter.headlight, 0)).toBe(true);
    expect(resolveStateValueAtTime(tracksAfter.horn, 0)).toBe(true);
  });

  it("does not add audio elements or invoke browser audio APIs", () => {
    expect(container.querySelector("audio")).toBeNull();
    expect(document.querySelector("audio")).toBeNull();
  });
});
