import { beforeEach, describe, expect, it } from "vitest";

import { createEmptyAnimationProject } from "../src/model/animation";
import {
  createInitialVehicleStateTracks,
  editVehicleStateInterval,
  resolveStateValueAtTime,
  type EditVehicleStateIntervalOptions,
  type VehicleStateLaneKey,
  type VehicleStateTracks,
} from "../src/model/stateTrack";
import { useEditorStore } from "../src/store/editorStore";

function createTracks(): VehicleStateTracks {
  let sequence = 0;
  return createInitialVehicleStateTracks({
    createId: (kind) => `${kind}-${++sequence}`,
  });
}

function edit(
  tracks: VehicleStateTracks,
  laneKey: VehicleStateLaneKey,
  options: Omit<EditVehicleStateIntervalOptions, "createId">,
) {
  let sequence = 0;
  const existingIds = new Set(
    Object.values(tracks).flatMap((track) =>
      track.keyframes.map((keyframe) => keyframe.id),
    ),
  );
  return editVehicleStateInterval(tracks, laneKey, {
    ...options,
    createId: () => {
      let id = `edit-boundary-${++sequence}`;
      while (existingIds.has(id)) {
        id = `edit-boundary-${++sequence}`;
      }
      return id;
    },
  });
}

describe("F5.9 State interval editing mutation", () => {
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

  it("moves a finite boolean interval while preserving its duration", () => {
    const tracks = createTracks();
    tracks.brakeLight = {
      keyframes: [
        { id: "off-0", time: 0, value: false },
        { id: "on-2", time: 2, value: true },
        { id: "off-4", time: 4, value: false },
      ],
    };

    const result = edit(tracks, "brakeLight", {
      source: { startTime: 2, endTime: 4 },
      mutation: { type: "move", startTime: 5, endTime: 7 },
    });

    expect(result.status).toBe("updated");
    expect(result.tracks.brakeLight.keyframes).toEqual([
      { id: "off-0", time: 0, value: false },
      { id: "edit-boundary-1", time: 5, value: true },
      { id: "edit-boundary-2", time: 7, value: false },
    ]);
  });

  it("resizes either finite boundary and preserves existing IDs", () => {
    const tracks = createTracks();
    tracks.headlight = {
      keyframes: [
        { id: "off-0", time: 0, value: false },
        { id: "on-2", time: 2, value: true },
        { id: "off-6", time: 6, value: false },
      ],
    };

    const left = edit(tracks, "headlight", {
      source: { startTime: 2, endTime: 6 },
      mutation: { type: "resize-left", startTime: 3 },
    });
    expect(left.status).toBe("updated");
    expect(left.tracks.headlight.keyframes).toEqual([
      { id: "off-0", time: 0, value: false },
      { id: "edit-boundary-1", time: 3, value: true },
      { id: "off-6", time: 6, value: false },
    ]);

    const right = edit(left.tracks, "headlight", {
      source: { startTime: 3, endTime: 6 },
      mutation: { type: "resize-right", endTime: 8 },
    });
    expect(right.status).toBe("updated");
    expect(right.tracks.headlight.keyframes).toEqual([
      { id: "off-0", time: 0, value: false },
      { id: "edit-boundary-1", time: 3, value: true },
      { id: "edit-boundary-2", time: 8, value: false },
    ]);
  });

  it("deletes a finite interval without changing later intervals", () => {
    const tracks = createTracks();
    tracks.horn = {
      keyframes: [
        { id: "off-0", time: 0, value: false },
        { id: "on-2", time: 2, value: true },
        { id: "off-4", time: 4, value: false },
        { id: "on-7", time: 7, value: true },
        { id: "off-8", time: 8, value: false },
      ],
    };

    const result = edit(tracks, "horn", {
      source: { startTime: 2, endTime: 4 },
      mutation: { type: "delete" },
    });

    expect(result.status).toBe("deleted");
    expect(result.tracks.horn.keyframes).toEqual([
      { id: "off-0", time: 0, value: false },
      { id: "on-7", time: 7, value: true },
      { id: "off-8", time: 8, value: false },
    ]);
  });

  it("rejects overlap with another interval and merges adjacency", () => {
    const tracks = createTracks();
    tracks.brakeLight = {
      keyframes: [
        { id: "off-0", time: 0, value: false },
        { id: "on-2", time: 2, value: true },
        { id: "off-4", time: 4, value: false },
        { id: "on-6", time: 6, value: true },
        { id: "off-8", time: 8, value: false },
      ],
    };

    const occupied = edit(tracks, "brakeLight", {
      source: { startTime: 2, endTime: 4 },
      mutation: { type: "move", startTime: 5, endTime: 7 },
    });
    expect(occupied).toEqual({ status: "occupied", tracks });

    const adjacent = edit(tracks, "brakeLight", {
      source: { startTime: 2, endTime: 4 },
      mutation: { type: "move", startTime: 4, endTime: 6 },
    });
    expect(adjacent.status).toBe("updated");
    expect(adjacent.tracks.brakeLight.keyframes).toEqual([
      { id: "off-0", time: 0, value: false },
      { id: "off-4", time: 4, value: true },
      { id: "off-8", time: 8, value: false },
    ]);
  });

  it("preserves the opposite indicator side while editing", () => {
    const tracks = createTracks();
    tracks.indicator = {
      keyframes: [
        { id: "off-0", time: 0, value: "off" },
        { id: "left-2", time: 2, value: "left" },
        { id: "hazard-3", time: 3, value: "hazard" },
        { id: "right-5", time: 5, value: "right" },
        { id: "off-7", time: 7, value: "off" },
      ],
    };

    const result = edit(tracks, "leftIndicator", {
      source: { startTime: 2, endTime: 5 },
      mutation: { type: "delete" },
    });

    expect(result.status).toBe("deleted");
    expect(result.tracks.indicator.keyframes).toEqual([
      { id: "off-0", time: 0, value: "off" },
      { id: "hazard-3", time: 3, value: "right" },
      { id: "off-7", time: 7, value: "off" },
    ]);
    expect(resolveStateValueAtTime(result.tracks.indicator, 4)).toBe("right");
  });

  it("resizes and deletes open intervals without inventing an end", () => {
    const tracks = createTracks();
    tracks.horn = {
      keyframes: [
        { id: "off-0", time: 0, value: false },
        { id: "on-8", time: 8, value: true },
      ],
    };

    const resized = edit(tracks, "horn", {
      source: { startTime: 8, endTime: null },
      mutation: { type: "resize-left", startTime: 7 },
    });
    expect(resized.status).toBe("updated");
    expect(resized.tracks.horn.keyframes).toEqual([
      { id: "off-0", time: 0, value: false },
      { id: "edit-boundary-1", time: 7, value: true },
    ]);

    const deleted = edit(resized.tracks, "horn", {
      source: { startTime: 7, endTime: null },
      mutation: { type: "delete" },
    });
    expect(deleted.status).toBe("deleted");
    expect(deleted.tracks.horn.keyframes).toEqual([
      { id: "off-0", time: 0, value: false },
    ]);
    expect(deleted.tracks.horn.keyframes.some(({ time }) => time === 10)).toBe(
      false,
    );
  });

  it("rejects stale sources, open moves, reversed resize, and bad IDs", () => {
    const tracks = createTracks();
    tracks.horn = {
      keyframes: [
        { id: "off-0", time: 0, value: false },
        { id: "on-2", time: 2, value: true },
      ],
    };

    expect(
      edit(tracks, "horn", {
        source: { startTime: 3, endTime: null },
        mutation: { type: "delete" },
      }),
    ).toEqual({ status: "invalid", tracks });
    expect(
      edit(tracks, "horn", {
        source: { startTime: 2, endTime: null },
        mutation: { type: "move", startTime: 3, endTime: 4 },
      }),
    ).toEqual({ status: "invalid", tracks });
    expect(
      edit(tracks, "horn", {
        source: { startTime: 2, endTime: null },
        mutation: { type: "resize-right", endTime: 1 },
      }),
    ).toEqual({ status: "invalid", tracks });

    const finite = createTracks();
    finite.horn = {
      keyframes: [
        { id: "off-0", time: 0, value: false },
        { id: "on-2", time: 2, value: true },
        { id: "off-4", time: 4, value: false },
      ],
    };
    const invalidId = editVehicleStateInterval(finite, "horn", {
      source: { startTime: 2, endTime: 4 },
      mutation: { type: "move", startTime: 5, endTime: 7 },
      createId: () => "",
    });
    expect(invalidId).toEqual({ status: "invalid", tracks: finite });
  });

  it("isolates Store edits to the target Vehicle state track", () => {
    useEditorStore.getState().addVehicle("car-blue-sedan");
    const initialState = useEditorStore.getState();
    const vehicleId = initialState.project.scene.objects[0]!.id;
    useEditorStore
      .getState()
      .createVehicleStateInterval(vehicleId, "brakeLight", 2, 4);
    useEditorStore.getState().setCurrentTime(3);
    useEditorStore.getState().selectObject(vehicleId);

    const stateBefore = useEditorStore.getState();
    const vehicleBefore = stateBefore.project.scene.objects[0]!;
    const result = stateBefore.editVehicleStateInterval(
      vehicleId,
      "brakeLight",
      { startTime: 2, endTime: 4 },
      { type: "move", startTime: 5, endTime: 7 },
    );
    const stateAfter = useEditorStore.getState();
    const vehicleAfter = stateAfter.project.scene.objects[0]!;

    expect(result).toBe("updated");
    expect(stateAfter.currentTime).toBe(3);
    expect(stateAfter.selection).toBe(stateBefore.selection);
    expect(vehicleAfter.movement).toBe(vehicleBefore.movement);
    expect(vehicleAfter.stateTracks.indicator).toBe(
      vehicleBefore.stateTracks.indicator,
    );
    expect(vehicleAfter.stateTracks.headlight).toBe(
      vehicleBefore.stateTracks.headlight,
    );
    expect(vehicleAfter.stateTracks.horn).toBe(vehicleBefore.stateTracks.horn);
    expect(vehicleAfter.stateTracks.brakeLight).not.toBe(
      vehicleBefore.stateTracks.brakeLight,
    );

    const projectBeforeFailure = stateAfter.project;
    const failed = stateAfter.editVehicleStateInterval(
      vehicleId,
      "brakeLight",
      { startTime: 2, endTime: 4 },
      { type: "delete" },
    );
    expect(failed).toBe("invalid");
    expect(useEditorStore.getState().project).toBe(projectBeforeFailure);
  });
});
