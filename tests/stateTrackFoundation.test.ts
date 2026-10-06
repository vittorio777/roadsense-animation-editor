import { describe, expect, expectTypeOf, it } from "vitest";

import {
  getVehicleStateTrack,
  resolveStateKeyframeAtTime,
  resolveStateValueAtTime,
  type IndicatorState,
  type StateTrack,
  type VehicleStateTracks,
  type VehicleStateTrackKey,
} from "../src/model/stateTrack";
import { createVehicleObject } from "../src/model/vehicle";

const tracks: VehicleStateTracks = {
  indicator: {
    keyframes: [
      { id: "indicator-off-0", time: 0, value: "off" },
      { id: "indicator-right-2", time: 2, value: "right" },
      { id: "indicator-off-5", time: 5, value: "off" },
    ],
  },
  brakeLight: {
    keyframes: [
      { id: "brake-off-0", time: 0, value: false },
      { id: "brake-on-3", time: 3, value: true },
    ],
  },
  headlight: {
    keyframes: [
      { id: "headlight-off-0", time: 0, value: false },
      { id: "headlight-on-4", time: 4, value: true },
    ],
  },
  horn: {
    keyframes: [
      { id: "horn-off-0", time: 0, value: false },
      { id: "horn-on-1", time: 1, value: true },
      { id: "horn-off-2", time: 2, value: false },
    ],
  },
};

describe("F5.1 State Track foundation", () => {
  it("exposes only the four contract-defined Track keys", () => {
    const keys = [
      "indicator",
      "brakeLight",
      "headlight",
      "horn",
    ] satisfies VehicleStateTrackKey[];

    expect(keys).toEqual([
      "indicator",
      "brakeLight",
      "headlight",
      "horn",
    ]);
  });

  it("provides type-safe Track access without copying data", () => {
    const indicator = getVehicleStateTrack(tracks, "indicator");
    const brakeLight = getVehicleStateTrack(tracks, "brakeLight");

    expectTypeOf(indicator).toEqualTypeOf<StateTrack<IndicatorState>>();
    expectTypeOf(brakeLight).toEqualTypeOf<StateTrack<boolean>>();
    expect(indicator).toBe(tracks.indicator);
    expect(brakeLight).toBe(tracks.brakeLight);
  });

  it.each([
    { time: 0, id: "indicator-off-0", value: "off" },
    { time: 1.999, id: "indicator-off-0", value: "off" },
    { time: 2, id: "indicator-right-2", value: "right" },
    { time: 4.999, id: "indicator-right-2", value: "right" },
    { time: 5, id: "indicator-off-5", value: "off" },
    { time: 60, id: "indicator-off-5", value: "off" },
  ] as const)(
    "resolves sustained Indicator state at $time seconds",
    ({ time, id, value }) => {
      expect(resolveStateKeyframeAtTime(tracks.indicator, time)?.id).toBe(id);
      expect(resolveStateValueAtTime(tracks.indicator, time)).toBe(value);
    },
  );

  it("resolves unordered Keyframes by time without sorting the input", () => {
    const unordered: StateTrack<boolean> = {
      keyframes: [
        { id: "on-8", time: 8, value: true },
        { id: "off-0", time: 0, value: false },
        { id: "on-3", time: 3, value: true },
        { id: "off-6", time: 6, value: false },
      ],
    };
    const originalOrder = unordered.keyframes.map((keyframe) => keyframe.id);
    const originalReferences = [...unordered.keyframes];

    expect(resolveStateKeyframeAtTime(unordered, 7)).toBe(
      unordered.keyframes[3],
    );
    expect(resolveStateValueAtTime(unordered, 7)).toBe(false);
    expect(unordered.keyframes.map((keyframe) => keyframe.id)).toEqual(
      originalOrder,
    );
    expect(unordered.keyframes).toEqual(originalReferences);
    unordered.keyframes.forEach((keyframe, index) => {
      expect(keyframe).toBe(originalReferences[index]);
    });
  });

  it.each([-1, Number.NaN, Infinity, -Infinity])(
    "rejects invalid target time %s",
    (time) => {
      expect(
        resolveStateKeyframeAtTime(tracks.indicator, time),
      ).toBeUndefined();
      expect(resolveStateValueAtTime(tracks.indicator, time)).toBeUndefined();
    },
  );

  it("returns undefined for an empty Track or before its first Keyframe", () => {
    expect(resolveStateValueAtTime<boolean>({ keyframes: [] }, 0)).toBeUndefined();
    expect(
      resolveStateValueAtTime(
        { keyframes: [{ id: "future", time: 3, value: true }] },
        2,
      ),
    ).toBeUndefined();
  });

  it.each([
    {
      keyframes: [{ id: "negative", time: -1, value: false }],
    },
    {
      keyframes: [{ id: "nan", time: Number.NaN, value: false }],
    },
    {
      keyframes: [
        { id: "duplicate-a", time: 1, value: false },
        { id: "duplicate-b", time: 1, value: true },
      ],
    },
  ] satisfies StateTrack<boolean>[])(
    "rejects invalid Track data instead of silently resolving it",
    ({ keyframes }) => {
      expect(resolveStateValueAtTime({ keyframes }, 2)).toBeUndefined();
    },
  );

  it("resolves the four Tracks independently at the same time", () => {
    expect(resolveStateValueAtTime(tracks.indicator, 4)).toBe("right");
    expect(resolveStateValueAtTime(tracks.brakeLight, 4)).toBe(true);
    expect(resolveStateValueAtTime(tracks.headlight, 4)).toBe(true);
    expect(resolveStateValueAtTime(tracks.horn, 4)).toBe(false);
  });

  it("does not mutate Track data while resolving repeatedly", () => {
    const snapshot = structuredClone(tracks);
    const trackReferences = { ...tracks };
    const keyframeReferences = Object.fromEntries(
      Object.entries(tracks).map(([key, track]) => [key, [...track.keyframes]]),
    );

    for (const key of [
      "indicator",
      "brakeLight",
      "headlight",
      "horn",
    ] satisfies VehicleStateTrackKey[]) {
      const track = getVehicleStateTrack(tracks, key);
      resolveStateKeyframeAtTime(track, 4);
      resolveStateValueAtTime(track, 4);
      expect(track).toBe(trackReferences[key]);
      track.keyframes.forEach((keyframe, index) => {
        expect(keyframe).toBe(keyframeReferences[key]?.[index]);
      });
    }

    expect(tracks).toEqual(snapshot);
  });

  it("resolves the existing Vehicle factory initial states", () => {
    const vehicle = createVehicleObject({
      assetId: "car-blue-sedan",
      x: 800,
      y: 450,
      createId: (kind) => `${kind}-initial`,
    });

    expect(resolveStateValueAtTime(vehicle.stateTracks.indicator, 0)).toBe(
      "off",
    );
    expect(resolveStateValueAtTime(vehicle.stateTracks.indicator, 10)).toBe(
      "off",
    );
    expect(resolveStateValueAtTime(vehicle.stateTracks.brakeLight, 10)).toBe(
      false,
    );
    expect(resolveStateValueAtTime(vehicle.stateTracks.headlight, 10)).toBe(
      false,
    );
    expect(resolveStateValueAtTime(vehicle.stateTracks.horn, 10)).toBe(false);
  });
});
