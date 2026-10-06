import { beforeEach, describe, expect, it } from "vitest";

import { createEmptyAnimationProject } from "../src/model/animation";
import {
  createInitialVehicleStateTracks,
  resolveStateValueAtTime,
  setVehicleStateValueAtTime,
  type VehicleStateTrackKey,
  type VehicleStateTracks,
  type VehicleStateValueByTrack,
} from "../src/model/stateTrack";
import { useEditorStore } from "../src/store/editorStore";

const trackKeys: VehicleStateTrackKey[] = [
  "indicator",
  "brakeLight",
  "headlight",
  "horn",
];

function createTracks(): VehicleStateTracks {
  let sequence = 0;
  return createInitialVehicleStateTracks({
    createId: (kind) => `${kind}-${++sequence}`,
  });
}

describe("F5.6 Initial State Keyframes", () => {
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

  it("creates the complete zero-second state contract with deterministic IDs", () => {
    const tracks = createTracks();

    expect(Object.keys(tracks)).toEqual(trackKeys);
    expect(tracks).toEqual({
      indicator: {
        keyframes: [
          { id: "indicator-keyframe-1", time: 0, value: "off" },
        ],
      },
      brakeLight: {
        keyframes: [
          { id: "brake-light-keyframe-2", time: 0, value: false },
        ],
      },
      headlight: {
        keyframes: [
          { id: "headlight-keyframe-3", time: 0, value: false },
        ],
      },
      horn: {
        keyframes: [{ id: "horn-keyframe-4", time: 0, value: false }],
      },
    });

    const ids = trackKeys.map((key) => tracks[key].keyframes[0]?.id);
    expect(ids.every((id) => typeof id === "string" && id.length > 0)).toBe(
      true,
    );
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("returns fresh tracks, arrays, and keyframes for each vehicle", () => {
    const first = createTracks();
    const second = createTracks();

    expect(first).not.toBe(second);
    for (const key of trackKeys) {
      expect(first[key]).not.toBe(second[key]);
      expect(first[key].keyframes).not.toBe(second[key].keyframes);
      expect(first[key].keyframes[0]).not.toBe(second[key].keyframes[0]);
    }

    first.horn.keyframes[0]!.value = true;
    expect(second.horn.keyframes[0]!.value).toBe(false);
  });

  it("creates initial state at zero without changing a nonzero editor time", () => {
    useEditorStore.getState().setCurrentTime(4.5);
    useEditorStore.getState().addVehicle("car-blue-sedan");

    const state = useEditorStore.getState();
    const vehicle = state.project.scene.objects[0]!;

    expect(state.currentTime).toBe(4.5);
    for (const key of trackKeys) {
      expect(vehicle.stateTracks[key].keyframes).toHaveLength(1);
      expect(vehicle.stateTracks[key].keyframes[0]?.time).toBe(0);
    }
  });

  it.each([
    ["indicator", "left"],
    ["brakeLight", true],
    ["headlight", true],
    ["horn", true],
  ] as const)("updates the existing %s keyframe at zero", (key, value) => {
    const tracks = createTracks();
    const initialKeyframe = tracks[key].keyframes[0]!;
    const nextTracks = setVehicleStateValueAtTime(tracks, key, {
      time: 0,
      value,
      createId: () => "unused-keyframe-id",
    });
    const nextKeyframe = nextTracks[key].keyframes[0]!;

    expect(nextTracks[key].keyframes).toHaveLength(1);
    expect(nextKeyframe).toEqual({ ...initialKeyframe, value });
    expect(nextKeyframe.id).toBe(initialKeyframe.id);
    expect(nextKeyframe.time).toBe(0);
  });

  it.each([
    ["indicator", "right"],
    ["brakeLight", true],
    ["headlight", true],
    ["horn", true],
  ] as const)(
    "preserves every initial keyframe after a later %s change",
    (key, value) => {
      const tracks = createTracks();
      const initialKeyframes = Object.fromEntries(
        trackKeys.map((trackKey) => [
          trackKey,
          tracks[trackKey].keyframes[0],
        ]),
      );
      const otherTrackReferences = Object.fromEntries(
        trackKeys
          .filter((trackKey) => trackKey !== key)
          .map((trackKey) => [trackKey, tracks[trackKey]]),
      );
      const nextTracks = setVehicleStateValueAtTime(tracks, key, {
        time: 3,
        value,
        createId: () => `${key}-later`,
      });

      expect(nextTracks[key].keyframes).toHaveLength(2);
      expect(nextTracks[key].keyframes[0]).toBe(initialKeyframes[key]);
      expect(nextTracks[key].keyframes[1]).toEqual({
        id: `${key}-later`,
        time: 3,
        value,
      });
      for (const trackKey of trackKeys) {
        expect(nextTracks[trackKey].keyframes[0]).toBe(
          initialKeyframes[trackKey],
        );
        if (trackKey !== key) {
          expect(nextTracks[trackKey]).toBe(otherTrackReferences[trackKey]);
        }
      }
    },
  );

  it("resolves state without mutating or supplementing initial data", () => {
    const tracks = createTracks();
    const snapshot = JSON.stringify(tracks);
    const references = trackKeys.map((key) => tracks[key]);

    const values: VehicleStateValueByTrack = {
      indicator: resolveStateValueAtTime(tracks.indicator, 8)!,
      brakeLight: resolveStateValueAtTime(tracks.brakeLight, 8)!,
      headlight: resolveStateValueAtTime(tracks.headlight, 8)!,
      horn: resolveStateValueAtTime(tracks.horn, 8)!,
    };

    expect(values).toEqual({
      indicator: "off",
      brakeLight: false,
      headlight: false,
      horn: false,
    });
    expect(JSON.stringify(tracks)).toBe(snapshot);
    trackKeys.forEach((key, index) => {
      expect(tracks[key]).toBe(references[index]);
      expect(tracks[key].keyframes).toHaveLength(1);
    });
  });
});
