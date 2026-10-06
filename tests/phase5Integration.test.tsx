import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { PropertiesPanel } from "../src/editor/components/properties/PropertiesPanel";
import {
  projectStateIntervals,
  type TimelineStateInterval,
} from "../src/editor/components/timeline/stateIntervals";
import { TimelinePanel } from "../src/editor/components/timeline/TimelinePanel";
import { createEmptyAnimationProject } from "../src/model/animation";
import {
  resolveStateValueAtTime,
  type IndicatorState,
  type StateKeyframe,
  type StateTrack,
} from "../src/model/stateTrack";
import { createVehicleObject } from "../src/model/vehicle";
import { useEditorStore } from "../src/store/editorStore";

const reactTestEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT: boolean;
};

function independentValueAt<T>(
  keyframes: StateKeyframe<T>[],
  time: number,
): T | undefined {
  return [...keyframes]
    .filter((keyframe) => keyframe.time <= time)
    .sort((left, right) => right.time - left.time)[0]?.value;
}

function independentIntervals<T>(
  track: StateTrack<T>,
  isActive: (value: T) => boolean,
  rangeStart = 0,
  rangeEnd = 10,
): TimelineStateInterval[] {
  const keyframes = [...track.keyframes].sort(
    (left, right) => left.time - right.time,
  );
  const transitions: Array<{
    sourceStartKeyframeId: string;
    startTime: number;
    sourceEndTime: number | null;
  }> = [];
  let active = false;
  let startTime: number | null = null;
  let sourceStartKeyframeId: string | null = null;

  for (const keyframe of keyframes) {
    const nextActive = isActive(keyframe.value);
    if (!active && nextActive) {
      startTime = keyframe.time;
      sourceStartKeyframeId = keyframe.id;
    } else if (active && !nextActive && startTime !== null) {
      transitions.push({
        sourceStartKeyframeId: sourceStartKeyframeId as string,
        startTime,
        sourceEndTime: keyframe.time,
      });
      startTime = null;
      sourceStartKeyframeId = null;
    }
    active = nextActive;
  }
  if (active && startTime !== null) {
    transitions.push({
      sourceStartKeyframeId: sourceStartKeyframeId as string,
      startTime,
      sourceEndTime: null,
    });
  }

  return transitions
    .filter(
      (interval) =>
        interval.startTime < rangeEnd &&
        (interval.sourceEndTime === null || interval.sourceEndTime > rangeStart),
    )
    .map((interval) => {
      const visibleStart = Math.max(interval.startTime, rangeStart);
      const visibleEnd = Math.min(interval.sourceEndTime ?? rangeEnd, rangeEnd);
      return {
        sourceStartKeyframeId: interval.sourceStartKeyframeId,
        startTime: visibleStart,
        endTime: visibleEnd,
        sourceEndTime: interval.sourceEndTime,
        endClipped:
          interval.sourceEndTime === null || interval.sourceEndTime > rangeEnd,
        openEnded: interval.sourceEndTime === null,
      };
    });
}

function expectNormalized<T>(track: StateTrack<T>) {
  const ids = new Set<string>();
  const times = new Set<number>();
  for (const [index, keyframe] of track.keyframes.entries()) {
    expect(keyframe.id).not.toBe("");
    expect(ids.has(keyframe.id)).toBe(false);
    expect(times.has(keyframe.time)).toBe(false);
    expect(Number.isFinite(keyframe.time)).toBe(true);
    if (index > 0) {
      expect(track.keyframes[index - 1]!.time).toBeLessThan(keyframe.time);
      expect(Object.is(track.keyframes[index - 1]!.value, keyframe.value)).toBe(
        false,
      );
    }
    ids.add(keyframe.id);
    times.add(keyframe.time);
  }
}

describe("F5.10 Phase 5 vehicle state integration", () => {
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

  it("creates complete initial tracks without persistent interval data", () => {
    let sequence = 0;
    const vehicle = createVehicleObject({
      assetId: "car-blue-sedan",
      x: 800,
      y: 450,
      createId: (kind) => `${kind}-${++sequence}`,
    });
    const tracks = vehicle.stateTracks;

    expect(tracks.indicator.keyframes).toHaveLength(1);
    expect(tracks.brakeLight.keyframes).toHaveLength(1);
    expect(tracks.headlight.keyframes).toHaveLength(1);
    expect(tracks.horn.keyframes).toHaveLength(1);
    expect(tracks.indicator.keyframes[0]).toMatchObject({ time: 0, value: "off" });
    expect(tracks.brakeLight.keyframes[0]).toMatchObject({ time: 0, value: false });
    expect(tracks.headlight.keyframes[0]).toMatchObject({ time: 0, value: false });
    expect(tracks.horn.keyframes[0]).toMatchObject({ time: 0, value: false });

    const ids = Object.values(tracks).flatMap((track) =>
      track.keyframes.map((keyframe) => keyframe.id),
    );
    expect(new Set(ids).size).toBe(ids.length);
    expect(JSON.stringify(vehicle)).not.toContain('"intervals"');
    expect(JSON.stringify(vehicle)).not.toContain('"endClipped"');
    expect(JSON.stringify(vehicle)).not.toContain('"openEnded"');
  });

  it("agrees with independent point and interval oracles", () => {
    const indicator: StateTrack<IndicatorState> = {
      keyframes: [
        { id: "off-0", time: 0, value: "off" },
        { id: "left-1", time: 1, value: "left" },
        { id: "hazard-3", time: 3, value: "hazard" },
        { id: "right-5", time: 5, value: "right" },
        { id: "off-7", time: 7, value: "off" },
      ],
    };
    const booleanTrack: StateTrack<boolean> = {
      keyframes: [
        { id: "off-0", time: 0, value: false },
        { id: "on-2", time: 2, value: true },
        { id: "off-4", time: 4, value: false },
        { id: "on-8", time: 8, value: true },
        { id: "off-12", time: 12, value: false },
      ],
    };
    const samples = [0, 0.9, 1, 2.9, 3, 4.9, 5, 6.9, 7, 10, 12];

    for (const time of samples) {
      expect(resolveStateValueAtTime(indicator, time)).toBe(
        independentValueAt(indicator.keyframes, time),
      );
      expect(resolveStateValueAtTime(booleanTrack, time)).toBe(
        independentValueAt(booleanTrack.keyframes, time),
      );
    }

    const leftActive = (value: IndicatorState) =>
      value === "left" || value === "hazard";
    const rightActive = (value: IndicatorState) =>
      value === "right" || value === "hazard";
    expect(projectStateIntervals(indicator, leftActive)).toEqual(
      independentIntervals(indicator, leftActive),
    );
    expect(projectStateIntervals(indicator, rightActive)).toEqual(
      independentIntervals(indicator, rightActive),
    );
    expect(projectStateIntervals(booleanTrack, Boolean)).toEqual(
      independentIntervals(booleanTrack, Boolean),
    );
  });

  it("keeps Properties-style writes and Timeline mutations on one data source", () => {
    useEditorStore.getState().addVehicle("car-blue-sedan");
    const vehicleId = useEditorStore.getState().project.scene.objects[0]!.id;
    useEditorStore.getState().selectObject(vehicleId);
    const movementBefore = useEditorStore.getState().project.scene.objects[0]!
      .movement;

    useEditorStore.getState().setCurrentTime(1);
    useEditorStore
      .getState()
      .updateVehicleStateAtCurrentTime(vehicleId, "indicator", "left");
    useEditorStore.getState().setCurrentTime(3);
    useEditorStore
      .getState()
      .updateVehicleStateAtCurrentTime(vehicleId, "indicator", "hazard");
    useEditorStore.getState().setCurrentTime(5);
    useEditorStore
      .getState()
      .updateVehicleStateAtCurrentTime(vehicleId, "indicator", "right");
    useEditorStore.getState().setCurrentTime(7);
    useEditorStore
      .getState()
      .updateVehicleStateAtCurrentTime(vehicleId, "indicator", "off");

    expect(
      useEditorStore
        .getState()
        .createVehicleStateInterval(vehicleId, "headlight", 2, 4),
    ).toBe("created");
    expect(
      useEditorStore.getState().editVehicleStateInterval(
        vehicleId,
        "headlight",
        { startTime: 2, endTime: 4 },
        { type: "move", startTime: 4, endTime: 6 },
      ),
    ).toBe("updated");
    expect(
      useEditorStore.getState().editVehicleStateInterval(
        vehicleId,
        "headlight",
        { startTime: 4, endTime: 6 },
        { type: "resize-left", startTime: 3 },
      ),
    ).toBe("updated");
    expect(
      useEditorStore.getState().editVehicleStateInterval(
        vehicleId,
        "headlight",
        { startTime: 3, endTime: 6 },
        { type: "resize-right", endTime: 7 },
      ),
    ).toBe("updated");

    const vehicle = useEditorStore.getState().project.scene.objects[0]!;
    expect(vehicle.movement).toBe(movementBefore);
    expect(resolveStateValueAtTime(vehicle.stateTracks.headlight, 2.9)).toBe(
      false,
    );
    expect(resolveStateValueAtTime(vehicle.stateTracks.headlight, 3)).toBe(true);
    expect(resolveStateValueAtTime(vehicle.stateTracks.headlight, 6.9)).toBe(
      true,
    );
    expect(resolveStateValueAtTime(vehicle.stateTracks.headlight, 7)).toBe(false);
    expect(projectStateIntervals(vehicle.stateTracks.headlight, Boolean)).toEqual(
      independentIntervals(vehicle.stateTracks.headlight, Boolean),
    );
    expect(projectStateIntervals(vehicle.stateTracks.indicator, (value) =>
      value === "left" || value === "hazard",
    )).toEqual([
      {
        sourceStartKeyframeId:
          vehicle.stateTracks.indicator.keyframes.find(
            (keyframe) => keyframe.time === 1,
          )?.id,
        startTime: 1,
        endTime: 5,
        sourceEndTime: 5,
        endClipped: false,
        openEnded: false,
      },
    ]);
    expect(projectStateIntervals(vehicle.stateTracks.indicator, (value) =>
      value === "right" || value === "hazard",
    )).toEqual([
      {
        sourceStartKeyframeId:
          vehicle.stateTracks.indicator.keyframes.find(
            (keyframe) => keyframe.time === 3,
          )?.id,
        startTime: 3,
        endTime: 7,
        sourceEndTime: 7,
        endClipped: false,
        openEnded: false,
      },
    ]);
    expectNormalized(vehicle.stateTracks.indicator);
    expectNormalized(vehicle.stateTracks.headlight);
    expectNormalized(vehicle.stateTracks.brakeLight);
    expectNormalized(vehicle.stateTracks.horn);

    expect(
      useEditorStore.getState().editVehicleStateInterval(
        vehicleId,
        "headlight",
        { startTime: 3, endTime: 7 },
        { type: "delete" },
      ),
    ).toBe("deleted");
    expect(
      projectStateIntervals(
        useEditorStore.getState().project.scene.objects[0]!.stateTracks
          .headlight,
        Boolean,
      ),
    ).toEqual([]);
  });

  it("keeps failed and editor-only actions outside Animation Data", () => {
    useEditorStore.getState().addVehicle("car-blue-sedan");
    const vehicleId = useEditorStore.getState().project.scene.objects[0]!.id;
    useEditorStore
      .getState()
      .createVehicleStateInterval(vehicleId, "brakeLight", 2, 4);
    const project = useEditorStore.getState().project;

    useEditorStore.getState().setCurrentTime(3.2);
    useEditorStore.getState().selectObject(vehicleId);
    expect(useEditorStore.getState().project).toBe(project);

    const result = useEditorStore.getState().editVehicleStateInterval(
      vehicleId,
      "brakeLight",
      { startTime: 9, endTime: 10 },
      { type: "delete" },
    );
    expect(result).toBe("invalid");
    expect(useEditorStore.getState().project).toBe(project);
  });

  it("shows Properties and Timeline from the same Keyframes", async () => {
    useEditorStore.getState().addVehicle("car-blue-sedan");
    const vehicleId = useEditorStore.getState().project.scene.objects[0]!.id;
    useEditorStore.getState().selectObject(vehicleId);
    useEditorStore.getState().setCurrentTime(2);
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () =>
      root.render(
        <>
          <PropertiesPanel />
          <TimelinePanel />
        </>,
      ),
    );
    const brakeSwitch = container.querySelector<HTMLElement>(
      '[role="switch"][aria-label="Brake light"]',
    )!;
    await act(async () => brakeSwitch.click());

    expect(brakeSwitch.getAttribute("aria-checked")).toBe("true");
    expect(
      container.querySelector('[data-state-interval="brake-light"]'),
    ).not.toBeNull();
    expect(
      useEditorStore.getState().project.scene.objects[0]!.stateTracks.brakeLight
        .keyframes,
    ).toHaveLength(2);

    await act(async () => useEditorStore.getState().setCurrentTime(4));
    expect(brakeSwitch.getAttribute("aria-checked")).toBe("true");
    await act(async () => brakeSwitch.click());
    const finiteInterval = container.querySelector<HTMLElement>(
      '[data-state-interval="brake-light"]',
    )!;
    expect(finiteInterval.dataset.startTime).toBe("2");
    expect(finiteInterval.dataset.sourceEndTime).toBe("4");

    const intervalButton = finiteInterval.querySelector<HTMLButtonElement>(
      '[data-interval-body]',
    )!;
    await act(async () => intervalButton.click());
    const projectBeforeSelection = useEditorStore.getState().project;
    expect(container.textContent).toContain("Delete interval");
    expect(useEditorStore.getState().project).toBe(projectBeforeSelection);

    await act(async () => root.unmount());
    container.remove();
  });
});
