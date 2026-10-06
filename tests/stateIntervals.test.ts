import { describe, expect, it } from "vitest";

import { projectStateIntervals } from "../src/editor/components/timeline/stateIntervals";
import type {
  IndicatorState,
  StateTrack,
} from "../src/model/stateTrack";

describe("F5.7 State interval projection", () => {
  it("projects finite and repeated boolean intervals", () => {
    const track: StateTrack<boolean> = {
      keyframes: [
        { id: "off-0", time: 0, value: false },
        { id: "on-2", time: 2, value: true },
        { id: "off-4", time: 4, value: false },
        { id: "on-6", time: 6, value: true },
        { id: "off-7", time: 7, value: false },
      ],
    };

    expect(projectStateIntervals(track, Boolean)).toEqual([
      {
        sourceStartKeyframeId: "on-2",
        startTime: 2,
        endTime: 4,
        sourceEndTime: 4,
        endClipped: false,
        openEnded: false,
      },
      {
        sourceStartKeyframeId: "on-6",
        startTime: 6,
        endTime: 7,
        sourceEndTime: 7,
        endClipped: false,
        openEnded: false,
      },
    ]);
  });

  it("clips an active state to the range without persisting an end", () => {
    const track: StateTrack<boolean> = {
      keyframes: [
        { id: "off-0", time: 0, value: false },
        { id: "on-8", time: 8, value: true },
      ],
    };
    const snapshot = JSON.stringify(track);

    expect(projectStateIntervals(track, Boolean)).toEqual([
      {
        sourceStartKeyframeId: "on-8",
        startTime: 8,
        endTime: 10,
        sourceEndTime: null,
        endClipped: true,
        openEnded: true,
      },
    ]);
    expect(JSON.stringify(track)).toBe(snapshot);
    expect(track.keyframes).toHaveLength(2);
  });

  it("distinguishes an open interval from one clipped before a later end", () => {
    const track: StateTrack<boolean> = {
      keyframes: [
        { id: "off-0", time: 0, value: false },
        { id: "on-8", time: 8, value: true },
        { id: "off-12", time: 12, value: false },
      ],
    };

    expect(projectStateIntervals(track, Boolean)).toEqual([
      {
        sourceStartKeyframeId: "on-8",
        startTime: 8,
        endTime: 10,
        sourceEndTime: 12,
        endClipped: true,
        openEnded: false,
      },
    ]);
  });

  it("projects hazard into both indicator lanes", () => {
    const track: StateTrack<IndicatorState> = {
      keyframes: [
        { id: "off-0", time: 0, value: "off" },
        { id: "left-1", time: 1, value: "left" },
        { id: "hazard-3", time: 3, value: "hazard" },
        { id: "right-5", time: 5, value: "right" },
        { id: "off-7", time: 7, value: "off" },
      ],
    };

    expect(
      projectStateIntervals(
        track,
        (value) => value === "left" || value === "hazard",
      ),
    ).toEqual([
      {
        sourceStartKeyframeId: "left-1",
        startTime: 1,
        endTime: 5,
        sourceEndTime: 5,
        endClipped: false,
        openEnded: false,
      },
    ]);
    expect(
      projectStateIntervals(
        track,
        (value) => value === "right" || value === "hazard",
      ),
    ).toEqual([
      {
        sourceStartKeyframeId: "hazard-3",
        startTime: 3,
        endTime: 7,
        sourceEndTime: 7,
        endClipped: false,
        openEnded: false,
      },
    ]);
  });

  it("returns no intervals for inactive, duplicate-time, or invalid ranges", () => {
    const inactive: StateTrack<boolean> = {
      keyframes: [{ id: "off-0", time: 0, value: false }],
    };
    const duplicate: StateTrack<boolean> = {
      keyframes: [
        { id: "off-0", time: 0, value: false },
        { id: "on-0", time: 0, value: true },
      ],
    };

    expect(projectStateIntervals(inactive, Boolean)).toEqual([]);
    expect(projectStateIntervals(duplicate, Boolean)).toEqual([]);
    expect(projectStateIntervals(inactive, Boolean, 4, 4)).toEqual([]);
  });
});
