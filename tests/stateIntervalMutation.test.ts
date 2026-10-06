import { beforeEach, describe, expect, it } from "vitest";

import { createEmptyAnimationProject } from "../src/model/animation";
import {
  createInitialVehicleStateTracks,
  createVehicleStateInterval,
  resolveStateValueAtTime,
  type CreateVehicleStateIntervalResult,
  type IndicatorState,
  type StateTrack,
  type VehicleStateTracks,
} from "../src/model/stateTrack";
import { useEditorStore } from "../src/store/editorStore";

function createTracks(): VehicleStateTracks {
  let sequence = 0;
  return createInitialVehicleStateTracks({
    createId: (kind) => `${kind}-${++sequence}`,
  });
}

function createInterval(
  tracks: VehicleStateTracks,
  laneKey: Parameters<typeof createVehicleStateInterval>[1],
  startTime: number,
  endTime: number,
): CreateVehicleStateIntervalResult {
  let sequence = 0;
  return createVehicleStateInterval(tracks, laneKey, {
    startTime,
    endTime,
    createId: () => `boundary-${++sequence}`,
  });
}

function expectCreated(
  result: CreateVehicleStateIntervalResult,
): VehicleStateTracks {
  expect(result.status).toBe("created");
  if (result.status !== "created") {
    throw new Error("Expected interval creation to succeed.");
  }
  return result.tracks;
}

describe("F5.8 State interval mutation", () => {
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

  it("creates normalized boolean boundaries in either drag direction", () => {
    const forwardTracks = createTracks();
    const forward = expectCreated(
      createInterval(forwardTracks, "brakeLight", 2, 4),
    );
    const reverse = expectCreated(
      createInterval(createTracks(), "brakeLight", 4, 2),
    );

    const expected = [
      { time: 0, value: false },
      { time: 2, value: true },
      { time: 4, value: false },
    ];
    expect(
      forward.brakeLight.keyframes.map(({ time, value }) => ({ time, value })),
    ).toEqual(expected);
    expect(
      reverse.brakeLight.keyframes.map(({ time, value }) => ({ time, value })),
    ).toEqual(expected);
    expect(forward.brakeLight.keyframes.map((keyframe) => keyframe.id)).toEqual([
      forwardTracks.brakeLight.keyframes[0]!.id,
      "boundary-1",
      "boundary-2",
    ]);
  });

  it("supports an interval starting at zero and ending explicitly at ten", () => {
    const tracks = createTracks();
    const initialId = tracks.headlight.keyframes[0]!.id;
    const nextTracks = expectCreated(
      createInterval(tracks, "headlight", 0, 10),
    );

    expect(nextTracks.headlight.keyframes).toEqual([
      { id: initialId, time: 0, value: true },
      { id: "boundary-1", time: 10, value: false },
    ]);
  });

  it("preserves existing boundary IDs and removes redundant values", () => {
    const tracks = createTracks();
    tracks.horn = {
      keyframes: [
        { id: "initial", time: 0, value: false },
        { id: "start", time: 2, value: false },
        { id: "redundant", time: 3, value: false },
        { id: "end", time: 4, value: false },
      ],
    };

    const nextTracks = expectCreated(createInterval(tracks, "horn", 2, 4));

    expect(nextTracks.horn.keyframes).toEqual([
      { id: "initial", time: 0, value: false },
      { id: "start", time: 2, value: true },
      { id: "end", time: 4, value: false },
    ]);
  });

  it("preserves intervals outside the created range", () => {
    const tracks = createTracks();
    tracks.brakeLight = {
      keyframes: [
        { id: "initial", time: 0, value: false },
        { id: "later-on", time: 6, value: true },
        { id: "later-off", time: 8, value: false },
      ],
    };

    const nextTracks = expectCreated(
      createInterval(tracks, "brakeLight", 2, 4),
    );

    expect(
      nextTracks.brakeLight.keyframes.map(({ time, value }) => ({ time, value })),
    ).toEqual([
      { time: 0, value: false },
      { time: 2, value: true },
      { time: 4, value: false },
      { time: 6, value: true },
      { time: 8, value: false },
    ]);
    expect(resolveStateValueAtTime(nextTracks.brakeLight, 7)).toBe(true);
    expect(resolveStateValueAtTime(nextTracks.brakeLight, 9)).toBe(false);
  });

  it("merges a new interval with an adjacent active interval", () => {
    const tracks = createTracks();
    tracks.horn = {
      keyframes: [
        { id: "initial", time: 0, value: false },
        { id: "existing-start", time: 4, value: true },
        { id: "existing-end", time: 6, value: false },
      ],
    };

    const nextTracks = expectCreated(createInterval(tracks, "horn", 2, 4));

    expect(nextTracks.horn.keyframes).toEqual([
      { id: "initial", time: 0, value: false },
      { id: "boundary-1", time: 2, value: true },
      { id: "existing-end", time: 6, value: false },
    ]);
  });

  it("rejects positive-area overlap on the target lane atomically", () => {
    const tracks = createTracks();
    tracks.brakeLight = {
      keyframes: [
        { id: "initial", time: 0, value: false },
        { id: "on", time: 3, value: true },
        { id: "off", time: 5, value: false },
      ],
    };
    const snapshot = JSON.stringify(tracks);

    const result = createInterval(tracks, "brakeLight", 2, 4);

    expect(result).toEqual({ status: "occupied", tracks });
    expect(result.tracks).toBe(tracks);
    expect(JSON.stringify(tracks)).toBe(snapshot);
  });

  it("creates hazard only where left and right indicator intervals overlap", () => {
    const tracks = createTracks();
    tracks.indicator = {
      keyframes: [
        { id: "off-0", time: 0, value: "off" },
        { id: "right-1", time: 1, value: "right" },
        { id: "off-5", time: 5, value: "off" },
      ],
    };

    const nextTracks = expectCreated(
      createInterval(tracks, "leftIndicator", 2, 4),
    );

    expect(nextTracks.indicator.keyframes).toEqual([
      { id: "off-0", time: 0, value: "off" },
      { id: "right-1", time: 1, value: "right" },
      { id: "boundary-1", time: 2, value: "hazard" },
      { id: "boundary-2", time: 4, value: "right" },
      { id: "off-5", time: 5, value: "off" },
    ]);
  });

  it("preserves opposite-indicator transitions inside the new interval", () => {
    const tracks = createTracks();
    const indicator: StateTrack<IndicatorState> = {
      keyframes: [
        { id: "off-0", time: 0, value: "off" },
        { id: "right-1", time: 1, value: "right" },
        { id: "off-3", time: 3, value: "off" },
        { id: "right-4", time: 4, value: "right" },
        { id: "off-6", time: 6, value: "off" },
      ],
    };
    tracks.indicator = indicator;

    const nextTracks = expectCreated(
      createInterval(tracks, "leftIndicator", 2, 5),
    );

    expect(
      nextTracks.indicator.keyframes.map(({ time, value }) => ({ time, value })),
    ).toEqual([
      { time: 0, value: "off" },
      { time: 1, value: "right" },
      { time: 2, value: "hazard" },
      { time: 3, value: "left" },
      { time: 4, value: "hazard" },
      { time: 5, value: "right" },
      { time: 6, value: "off" },
    ]);
  });

  it("rejects zero-length, malformed tracks, and invalid boundary IDs", () => {
    const tracks = createTracks();
    expect(createInterval(tracks, "horn", 2, 2)).toEqual({
      status: "invalid",
      tracks,
    });

    const malformed = createTracks();
    malformed.horn.keyframes.push({
      id: malformed.horn.keyframes[0]!.id,
      time: 2,
      value: true,
    });
    expect(createInterval(malformed, "horn", 3, 4)).toEqual({
      status: "invalid",
      tracks: malformed,
    });

    const duplicateId = createVehicleStateInterval(tracks, "horn", {
      startTime: 2,
      endTime: 4,
      createId: () => tracks.horn.keyframes[0]!.id,
    });
    expect(duplicateId).toEqual({ status: "invalid", tracks });
  });

  it("updates only the requested Store track and preserves editor state", () => {
    useEditorStore.getState().addVehicle("car-blue-sedan");
    useEditorStore.getState().setCurrentTime(7.5);
    const stateBefore = useEditorStore.getState();
    const vehicleBefore = stateBefore.project.scene.objects[0]!;

    const status = stateBefore.createVehicleStateInterval(
      vehicleBefore.id,
      "headlight",
      2,
      4,
    );

    const stateAfter = useEditorStore.getState();
    const vehicleAfter = stateAfter.project.scene.objects[0]!;
    expect(status).toBe("created");
    expect(stateAfter.currentTime).toBe(7.5);
    expect(stateAfter.selection).toBe(stateBefore.selection);
    expect(vehicleAfter.movement).toBe(vehicleBefore.movement);
    expect(vehicleAfter.stateTracks.indicator).toBe(
      vehicleBefore.stateTracks.indicator,
    );
    expect(vehicleAfter.stateTracks.brakeLight).toBe(
      vehicleBefore.stateTracks.brakeLight,
    );
    expect(vehicleAfter.stateTracks.horn).toBe(vehicleBefore.stateTracks.horn);
    expect(resolveStateValueAtTime(vehicleAfter.stateTracks.headlight, 3)).toBe(
      true,
    );
  });
});
