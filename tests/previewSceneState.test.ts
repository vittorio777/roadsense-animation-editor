import { beforeEach, describe, expect, it } from "vitest";

import { createEmptyAnimationProject } from "../src/model/animation";
import type { MovementPoint } from "../src/model/movement";
import type { PathSegment } from "../src/model/path";
import type {
  IndicatorState,
  StateKeyframe,
  VehicleStateTracks,
} from "../src/model/stateTrack";
import { resolveStateValueAtTime } from "../src/model/stateTrack";
import type { VehicleObject } from "../src/model/vehicle";
import {
  calculatePathPosition,
  calculatePathRotation,
} from "../src/path/bezier";
import { composePreviewSceneState } from "../src/preview/sceneState";
import { useEditorStore } from "../src/store/editorStore";

function keyframe<T>(id: string, time: number, value: T): StateKeyframe<T> {
  return { id, time, value };
}

function createStateTracks(prefix: string): VehicleStateTracks {
  return {
    indicator: { keyframes: [keyframe(`${prefix}-indicator-0`, 0, "off")] },
    brakeLight: { keyframes: [keyframe(`${prefix}-brake-0`, 0, false)] },
    headlight: { keyframes: [keyframe(`${prefix}-headlight-0`, 0, false)] },
    horn: { keyframes: [keyframe(`${prefix}-horn-0`, 0, false)] },
  };
}

function createPoint(id: string, time: number, x: number, y: number): MovementPoint {
  return { id, time, x, y };
}

function createPath(
  id: string,
  from: MovementPoint,
  to: MovementPoint,
  control1 = { x: from.x + 100, y: from.y },
  control2 = { x: to.x - 100, y: to.y },
): PathSegment {
  return {
    id,
    fromPointId: from.id,
    toPointId: to.id,
    type: "cubicBezier",
    control1,
    control2,
  };
}

function createVehicle(
  id: string,
  points: MovementPoint[],
  paths: PathSegment[],
  stateTracks = createStateTracks(id),
): VehicleObject {
  return {
    id,
    type: "vehicle",
    assetId: "car-blue-sedan",
    movement: { points, paths },
    stateTracks,
  };
}

function requireComposed(
  result: ReturnType<typeof composePreviewSceneState>,
) {
  expect(result.status).toBe("composed");
  if (result.status !== "composed") {
    throw new Error(`Expected composed result, received ${result.reason}.`);
  }
  return result.scene;
}

describe("F7.6 Preview Scene State Composition", () => {
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

  it("composes an empty Scene with dimensions and optional background identity", () => {
    const project = createEmptyAnimationProject();
    project.scene.width = 1200;
    project.scene.height = 700;
    project.scene.background = { assetId: "intersection-01" };

    expect(requireComposed(composePreviewSceneState(project, 0))).toEqual({
      width: 1200,
      height: 700,
      backgroundAssetId: "intersection-01",
      vehicles: [],
    });

    delete project.scene.background;
    expect(requireComposed(composePreviewSceneState(project, 0))).toEqual({
      width: 1200,
      height: 700,
      vehicles: [],
    });
  });

  it("holds a single-point Vehicle at a stable zero-degree pose", () => {
    const project = createEmptyAnimationProject();
    const point = createPoint("point-0", 0, 400, 300);
    project.scene.objects = [createVehicle("vehicle-1", [point], [])];

    const atStart = requireComposed(composePreviewSceneState(project, 0));
    const later = requireComposed(composePreviewSceneState(project, 90));

    expect(atStart.vehicles[0]).toMatchObject({
      id: "vehicle-1",
      assetId: "car-blue-sedan",
      x: 400,
      y: 300,
      rotationDeg: 0,
      indicator: "off",
      brakeLight: false,
      headlight: false,
      horn: false,
    });
    expect(later.vehicles[0]).toEqual(atStart.vehicles[0]);
  });

  it("uses the shared Path Core for position and rotation between Points", () => {
    const project = createEmptyAnimationProject();
    const from = createPoint("point-0", 0, 100, 600);
    const to = createPoint("point-1", 10, 1300, 200);
    const path = createPath(
      "path-1",
      from,
      to,
      { x: 300, y: 100 },
      { x: 1100, y: 800 },
    );
    project.scene.objects = [createVehicle("vehicle-1", [from, to], [path])];

    for (const [time, progress] of [
      [2.5, 0.25],
      [5, 0.5],
      [7.3, 0.73],
    ] as const) {
      const vehicle = requireComposed(
        composePreviewSceneState(project, time),
      ).vehicles[0]!;
      const expectedPosition = calculatePathPosition([from, to], path, progress)!;
      const expectedRotation = calculatePathRotation([from, to], path, progress)!;

      expect(vehicle.x).toBeCloseTo(expectedPosition.x);
      expect(vehicle.y).toBeCloseTo(expectedPosition.y);
      expect(vehicle.rotationDeg).toBeCloseTo(expectedRotation);
    }
  });

  it("uses the outgoing direction at an interior Point and incoming direction at the end", () => {
    const project = createEmptyAnimationProject();
    const first = createPoint("point-0", 0, 100, 100);
    const middle = createPoint("point-1", 5, 500, 500);
    const last = createPoint("point-2", 10, 1000, 500);
    const incoming = createPath(
      "path-in",
      first,
      middle,
      { x: 100, y: 300 },
      { x: 500, y: 300 },
    );
    const outgoing = createPath(
      "path-out",
      middle,
      last,
      { x: 700, y: 500 },
      { x: 900, y: 300 },
    );
    const points = [first, middle, last];
    project.scene.objects = [
      createVehicle("vehicle-1", points, [incoming, outgoing]),
    ];

    const atMiddle = requireComposed(
      composePreviewSceneState(project, 5),
    ).vehicles[0]!;
    const atEnd = requireComposed(
      composePreviewSceneState(project, 10),
    ).vehicles[0]!;
    const afterEnd = requireComposed(
      composePreviewSceneState(project, 75),
    ).vehicles[0]!;

    expect(atMiddle).toMatchObject({ x: middle.x, y: middle.y });
    expect(atMiddle.rotationDeg).toBe(
      calculatePathRotation(points, outgoing, 0),
    );
    expect(atEnd).toMatchObject({ x: last.x, y: last.y });
    expect(atEnd.rotationDeg).toBe(calculatePathRotation(points, outgoing, 1));
    expect(afterEnd).toEqual(atEnd);
  });

  it("delegates all discrete values to the shared State Track resolver", () => {
    const project = createEmptyAnimationProject();
    const point = createPoint("point-0", 0, 400, 300);
    const tracks = createStateTracks("vehicle-1");
    tracks.indicator.keyframes.push(
      keyframe("indicator-2", 2, "left" as IndicatorState),
      keyframe("indicator-8", 8, "off" as IndicatorState),
    );
    tracks.brakeLight.keyframes.push(keyframe("brake-4", 4, true));
    tracks.headlight.keyframes.push(keyframe("headlight-6", 6, true));
    tracks.horn.keyframes.push(
      keyframe("horn-3", 3, true),
      keyframe("horn-5", 5, false),
    );
    project.scene.objects = [createVehicle("vehicle-1", [point], [], tracks)];

    for (const time of [0, 2, 4.5, 6, 9, 90]) {
      const vehicle = requireComposed(
        composePreviewSceneState(project, time),
      ).vehicles[0]!;

      expect(vehicle.indicator).toBe(
        resolveStateValueAtTime(tracks.indicator, time),
      );
      expect(vehicle.brakeLight).toBe(
        resolveStateValueAtTime(tracks.brakeLight, time),
      );
      expect(vehicle.headlight).toBe(
        resolveStateValueAtTime(tracks.headlight, time),
      );
      expect(vehicle.horn).toBe(resolveStateValueAtTime(tracks.horn, time));
    }

    expect(
      requireComposed(composePreviewSceneState(project, 4)).vehicles[0]?.horn,
    ).toBe(true);
  });

  it("composes multiple Vehicles independently and in Scene order", () => {
    const project = createEmptyAnimationProject();
    const firstStart = createPoint("first-0", 0, 0, 0);
    const firstEnd = createPoint("first-1", 10, 1000, 0);
    const secondStart = createPoint("second-0", 0, 900, 800);
    const secondEnd = createPoint("second-1", 20, 100, 200);
    const firstTracks = createStateTracks("first");
    firstTracks.indicator.keyframes.push(keyframe("first-left", 1, "left"));
    const secondTracks = createStateTracks("second");
    secondTracks.headlight.keyframes.push(keyframe("second-light", 1, true));
    project.scene.objects = [
      createVehicle(
        "first",
        [firstStart, firstEnd],
        [createPath("first-path", firstStart, firstEnd)],
        firstTracks,
      ),
      createVehicle(
        "second",
        [secondStart, secondEnd],
        [createPath("second-path", secondStart, secondEnd)],
        secondTracks,
      ),
    ];

    const firstResult = requireComposed(composePreviewSceneState(project, 5));
    const secondResult = requireComposed(composePreviewSceneState(project, 5));

    expect(firstResult).toEqual(secondResult);
    expect(firstResult.vehicles.map((vehicle) => vehicle.id)).toEqual([
      "first",
      "second",
    ]);
    expect(firstResult.vehicles[0]).toMatchObject({
      indicator: "left",
      headlight: false,
    });
    expect(firstResult.vehicles[1]).toMatchObject({
      indicator: "off",
      headlight: true,
    });
    expect(firstResult.vehicles[0]?.x).not.toBe(firstResult.vehicles[1]?.x);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -0.1])(
    "returns invalid-time for %s",
    (time) => {
      expect(composePreviewSceneState(createEmptyAnimationProject(), time)).toEqual({
        status: "unresolved",
        reason: "invalid-time",
      });
    },
  );

  it("returns explicit Movement and Path failures without a partial Scene", () => {
    const project = createEmptyAnimationProject();
    const from = createPoint("point-0", 0, 100, 100);
    const to = createPoint("point-1", 10, 900, 500);
    project.scene.objects = [createVehicle("vehicle-1", [from, to], [])];

    expect(composePreviewSceneState(project, 5)).toEqual({
      status: "unresolved",
      reason: "invalid-movement",
      objectId: "vehicle-1",
    });

    project.scene.objects[0]!.movement.paths = [
      createPath("wrong-path", from, { ...to, id: "other-point" }),
    ];
    expect(composePreviewSceneState(project, 5)).toEqual({
      status: "unresolved",
      reason: "missing-path",
      objectId: "vehicle-1",
    });
  });

  it("returns explicit failures for degenerate rotation and unresolved State", () => {
    const project = createEmptyAnimationProject();
    const from = createPoint("point-0", 0, 100, 100);
    const to = createPoint("point-1", 10, 900, 500);
    const degenerate = createPath(
      "path-1",
      from,
      to,
      { x: from.x, y: from.y },
      { x: to.x - 100, y: to.y },
    );
    const vehicle = createVehicle("vehicle-1", [from, to], [degenerate]);
    project.scene.objects = [vehicle];

    expect(composePreviewSceneState(project, 0)).toEqual({
      status: "unresolved",
      reason: "unresolved-rotation",
      objectId: "vehicle-1",
    });

    vehicle.movement.paths[0] = createPath("path-1", from, to);
    vehicle.stateTracks.horn.keyframes = [];
    expect(composePreviewSceneState(project, 5)).toEqual({
      status: "unresolved",
      reason: "unresolved-state",
      objectId: "vehicle-1",
      stateTrack: "horn",
    });
  });

  it("rejects non-finite Path Core output", () => {
    const project = createEmptyAnimationProject();
    const from = createPoint("point-0", 0, 100, 100);
    const to = createPoint("point-1", 10, 900, 500);
    const invalidPath = createPath(
      "path-1",
      from,
      to,
      { x: Number.NaN, y: 200 },
      { x: 800, y: 400 },
    );
    project.scene.objects = [
      createVehicle("vehicle-1", [from, to], [invalidPath]),
    ];

    expect(composePreviewSceneState(project, 5)).toEqual({
      status: "unresolved",
      reason: "unresolved-position",
      objectId: "vehicle-1",
    });
  });

  it("does not mutate Project, Store, selection, or currentTime", () => {
    const project = createEmptyAnimationProject();
    const from = createPoint("point-0", 0, 100, 100);
    const to = createPoint("point-1", 10, 900, 500);
    const path = createPath("path-1", from, to);
    project.scene.objects = [createVehicle("vehicle-1", [from, to], [path])];
    useEditorStore.setState({
      project,
      currentTime: 4.25,
      selection: {
        objectId: "vehicle-1",
        movementPointId: null,
        pathId: path.id,
        stateKeyframeId: null,
      },
    });
    const stateBefore = useEditorStore.getState();
    const snapshot = JSON.stringify(project);
    const pointsReference = project.scene.objects[0]!.movement.points;
    const pathsReference = project.scene.objects[0]!.movement.paths;
    const tracksReference = project.scene.objects[0]!.stateTracks;

    requireComposed(composePreviewSceneState(project, 4.25));
    requireComposed(composePreviewSceneState(project, 75));

    expect(JSON.stringify(project)).toBe(snapshot);
    expect(project.scene.objects[0]!.movement.points).toBe(pointsReference);
    expect(project.scene.objects[0]!.movement.paths).toBe(pathsReference);
    expect(project.scene.objects[0]!.stateTracks).toBe(tracksReference);
    expect(useEditorStore.getState()).toBe(stateBefore);
  });
});
