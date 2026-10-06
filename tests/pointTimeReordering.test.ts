import { beforeEach, describe, expect, it } from "vitest";

import { createEmptyAnimationProject } from "../src/model/animation";
import type { PathSegment } from "../src/model/path";
import {
  calculatePathPosition,
  calculatePathRotation,
  calculatePathTangent,
  resolveBezierPathPoints,
} from "../src/path/bezier";
import { useEditorStore } from "../src/store/editorStore";

function createVehicleWithFourPaths() {
  useEditorStore.getState().addVehicle("car-blue-sedan");
  const vehicleId = useEditorStore.getState().project.scene.objects[0]!.id;

  for (const point of [
    { time: 2, x: 420, y: 180 },
    { time: 4, x: 720, y: 700 },
    { time: 6, x: 1120, y: 220 },
    { time: 8, x: 1400, y: 640 },
  ]) {
    useEditorStore.getState().setCurrentTime(point.time);
    useEditorStore
      .getState()
      .updateVehiclePosition(vehicleId, point.x, point.y);
  }

  const controls = [
    [{ x: 160, y: 120 }, { x: 520, y: 760 }],
    [{ x: 560, y: 760 }, { x: 900, y: 80 }],
    [{ x: 880, y: 100 }, { x: 1260, y: 760 }],
    [{ x: 1220, y: 760 }, { x: 1520, y: 160 }],
  ] as const;
  const vehicle = useEditorStore.getState().project.scene.objects[0]!;

  for (const [pathIndex, pathControls] of controls.entries()) {
    const path = vehicle.movement.paths[pathIndex]!;
    useEditorStore
      .getState()
      .updatePathControlPoint(
        vehicle.id,
        path.id,
        "control1",
        pathControls[0].x,
        pathControls[0].y,
      );
    useEditorStore
      .getState()
      .updatePathControlPoint(
        vehicle.id,
        path.id,
        "control2",
        pathControls[1].x,
        pathControls[1].y,
      );
  }

  return useEditorStore.getState().project.scene.objects[0]!;
}

function expectDefaultGeometry(
  path: PathSegment,
  from: { x: number; y: number },
  to: { x: number; y: number },
) {
  expect(path.control1.x).toBeCloseTo(from.x + (to.x - from.x) / 3, 12);
  expect(path.control1.y).toBeCloseTo(from.y + (to.y - from.y) / 3, 12);
  expect(path.control2.x).toBeCloseTo(from.x + ((to.x - from.x) * 2) / 3, 12);
  expect(path.control2.y).toBeCloseTo(from.y + ((to.y - from.y) * 2) / 3, 12);
}

describe("F4.9 Point time reordering", () => {
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

  it("preserves the complete Path graph when a time change keeps Point order", () => {
    const vehicle = createVehicleWithFourPaths();
    const targetPoint = vehicle.movement.points[1]!;
    const pointsBefore = [...vehicle.movement.points];
    const pathsReference = vehicle.movement.paths;
    const pathReferences = [...pathsReference];
    const controlReferences = pathsReference.flatMap((path) => [
      path.control1,
      path.control2,
    ]);
    const stateTracksReference = vehicle.stateTracks;
    const backgroundReference =
      useEditorStore.getState().project.scene.background;
    useEditorStore
      .getState()
      .selectMovementPoint(vehicle.id, targetPoint.id);

    expect(
      useEditorStore
        .getState()
        .updateMovementPointTime(vehicle.id, targetPoint.id, 3),
    ).toEqual({ status: "updated" });

    const stateAfterUpdate = useEditorStore.getState();
    const vehicleAfterUpdate = stateAfterUpdate.project.scene.objects[0]!;
    expect(vehicleAfterUpdate.movement.points.map((point) => point.time)).toEqual([
      0, 3, 4, 6, 8,
    ]);
    expect(vehicleAfterUpdate.movement.points[1]).toEqual({
      ...targetPoint,
      time: 3,
    });
    expect(vehicleAfterUpdate.movement.points[1]!.id).toBe(targetPoint.id);
    expect(vehicleAfterUpdate.movement.points[1]!.x).toBe(targetPoint.x);
    expect(vehicleAfterUpdate.movement.points[1]!.y).toBe(targetPoint.y);
    expect(vehicleAfterUpdate.movement.points[0]).toBe(pointsBefore[0]);
    expect(vehicleAfterUpdate.movement.points.slice(2)).toEqual(
      pointsBefore.slice(2),
    );
    expect(vehicleAfterUpdate.movement.paths).toBe(pathsReference);
    pathReferences.forEach((path, index) => {
      expect(vehicleAfterUpdate.movement.paths[index]).toBe(path);
    });
    expect(
      vehicleAfterUpdate.movement.paths.flatMap((path) => [
        path.control1,
        path.control2,
      ]),
    ).toEqual(controlReferences);
    expect(stateAfterUpdate.selection.movementPointId).toBe(targetPoint.id);
    expect(stateAfterUpdate.currentTime).toBe(3);
    expect(vehicleAfterUpdate.stateTracks).toBe(stateTracksReference);
    expect(stateAfterUpdate.project.scene.background).toBe(backgroundReference);
  });

  it("moves a Point across multiple neighbors and preserves unaffected Paths", () => {
    const vehicle = createVehicleWithFourPaths();
    const [pointA, pointB, pointC, pointD, pointE] = vehicle.movement.points;
    const [pathAB, pathBC, pathCD, pathDE] = vehicle.movement.paths;
    const removedControls = [
      pathAB!.control1,
      pathAB!.control2,
      pathBC!.control1,
      pathBC!.control2,
    ];
    useEditorStore.getState().selectPath(vehicle.id, pathAB!.id);
    useEditorStore.getState().setCurrentTime(1.3);

    expect(
      useEditorStore
        .getState()
        .updateMovementPointTime(vehicle.id, pointB!.id, 9),
    ).toEqual({ status: "updated" });

    const stateAfterReorder = useEditorStore.getState();
    const movement = stateAfterReorder.project.scene.objects[0]!.movement;
    const [pathAC, preservedPathCD, preservedPathDE, pathEB] = movement.paths;
    expect(movement.points.map((point) => point.id)).toEqual([
      pointA!.id,
      pointC!.id,
      pointD!.id,
      pointE!.id,
      pointB!.id,
    ]);
    expect(movement.points.map((point) => point.time)).toEqual([0, 4, 6, 8, 9]);
    expect(
      movement.paths.map(({ fromPointId, toPointId }) => ({
        fromPointId,
        toPointId,
      })),
    ).toEqual([
      { fromPointId: pointA!.id, toPointId: pointC!.id },
      { fromPointId: pointC!.id, toPointId: pointD!.id },
      { fromPointId: pointD!.id, toPointId: pointE!.id },
      { fromPointId: pointE!.id, toPointId: pointB!.id },
    ]);
    expect(preservedPathCD).toBe(pathCD);
    expect(preservedPathDE).toBe(pathDE);
    expectDefaultGeometry(pathAC!, pointA!, pointC!);
    expectDefaultGeometry(pathEB!, pointE!, pointB!);
    expect(new Set(movement.paths.map((path) => path.id)).size).toBe(4);
    expect(movement.paths).not.toContain(pathAB);
    expect(movement.paths).not.toContain(pathBC);
    for (const path of [pathAC!, pathEB!]) {
      expect(path.id).not.toBe(pathAB!.id);
      expect(path.id).not.toBe(pathBC!.id);
      for (const control of [path.control1, path.control2]) {
        for (const removedControl of removedControls) {
          expect(control).not.toBe(removedControl);
        }
      }
    }
    expect(stateAfterReorder.selection).toEqual({
      objectId: vehicle.id,
      movementPointId: null,
      pathId: null,
      stateKeyframeId: null,
    });
    expect(stateAfterReorder.currentTime).toBe(1.3);
  });

  it("does not reuse a Path when its former endpoints become reversed", () => {
    const vehicle = createVehicleWithFourPaths();
    const [pointA, pointB, pointC, pointD, pointE] = vehicle.movement.points;
    const [, pathBC, , pathDE] = vehicle.movement.paths;

    expect(
      useEditorStore
        .getState()
        .updateMovementPointTime(vehicle.id, pointB!.id, 5),
    ).toEqual({ status: "updated" });

    const movement =
      useEditorStore.getState().project.scene.objects[0]!.movement;
    const [pathAC, reversedPathCB, pathBD, preservedPathDE] = movement.paths;
    expect(movement.points.map((point) => point.id)).toEqual([
      pointA!.id,
      pointC!.id,
      pointB!.id,
      pointD!.id,
      pointE!.id,
    ]);
    expect(reversedPathCB!.fromPointId).toBe(pointC!.id);
    expect(reversedPathCB!.toPointId).toBe(pointB!.id);
    expect(reversedPathCB).not.toBe(pathBC);
    expect(reversedPathCB!.id).not.toBe(pathBC!.id);
    expectDefaultGeometry(pathAC!, pointA!, pointC!);
    expectDefaultGeometry(reversedPathCB!, pointC!, pointB!);
    expectDefaultGeometry(pathBD!, pointB!, pointD!);
    expect(preservedPathDE).toBe(pathDE);
  });

  it("preserves a still-valid selected Path during forward reordering", () => {
    const vehicle = createVehicleWithFourPaths();
    const pointD = vehicle.movement.points[3]!;
    const preservedPath = vehicle.movement.paths[1]!;
    useEditorStore.getState().selectPath(vehicle.id, preservedPath.id);
    const selectionReference = useEditorStore.getState().selection;

    expect(
      useEditorStore
        .getState()
        .updateMovementPointTime(vehicle.id, pointD.id, 1),
    ).toEqual({ status: "updated" });

    const stateAfterReorder = useEditorStore.getState();
    const movement = stateAfterReorder.project.scene.objects[0]!.movement;
    expect(movement.points.map((point) => point.time)).toEqual([0, 1, 2, 4, 8]);
    expect(movement.paths[2]).toBe(preservedPath);
    expect(stateAfterReorder.selection).toBe(selectionReference);
    expect(stateAfterReorder.selection.pathId).toBe(preservedPath.id);
  });

  it("keeps rejected requests atomic and recalculates finite Path geometry", () => {
    const vehicle = createVehicleWithFourPaths();
    const targetPoint = vehicle.movement.points[1]!;
    const initialPoint = vehicle.movement.points[0]!;
    const requests: Array<
      [string, string, number, "invalid" | "duplicate-time" | "unchanged"]
    > = [
      [vehicle.id, initialPoint.id, 1, "invalid"],
      [vehicle.id, targetPoint.id, 4, "duplicate-time"],
      [vehicle.id, targetPoint.id, -1, "invalid"],
      [vehicle.id, targetPoint.id, Number.NaN, "invalid"],
      [vehicle.id, targetPoint.id, Infinity, "invalid"],
      [vehicle.id, targetPoint.id, targetPoint.time, "unchanged"],
      ["missing-object", targetPoint.id, 3, "invalid"],
      [vehicle.id, "missing-point", 3, "invalid"],
    ];

    for (const [objectId, pointId, time, expectedStatus] of requests) {
      const stateBeforeRequest = useEditorStore.getState();
      expect(
        stateBeforeRequest.updateMovementPointTime(objectId, pointId, time)
          .status,
      ).toBe(expectedStatus);
      expect(useEditorStore.getState()).toBe(stateBeforeRequest);
    }

    useEditorStore
      .getState()
      .updateMovementPointTime(vehicle.id, targetPoint.id, 9);
    const movement =
      useEditorStore.getState().project.scene.objects[0]!.movement;

    for (const path of movement.paths) {
      const renderedPoints = resolveBezierPathPoints(movement.points, path);
      const position = calculatePathPosition(movement.points, path, 0.5);
      const tangent = calculatePathTangent(movement.points, path, 0.5);
      const rotation = calculatePathRotation(movement.points, path, 0.5);

      expect(renderedPoints).toHaveLength(8);
      expect(renderedPoints?.every(Number.isFinite)).toBe(true);
      expect(position && Object.values(position).every(Number.isFinite)).toBe(
        true,
      );
      expect(tangent && Object.values(tangent).every(Number.isFinite)).toBe(
        true,
      );
      expect(Number.isFinite(rotation)).toBe(true);
    }
  });
});
