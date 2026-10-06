import { beforeEach, describe, expect, it } from "vitest";

import { createEmptyAnimationProject } from "../src/model/animation";
import type { MovementPoint } from "../src/model/movement";
import type { PathSegment, Point } from "../src/model/path";
import {
  calculatePathPosition,
  calculatePathRotation,
  calculatePathTangent,
  resolveBezierPathPoints,
} from "../src/path/bezier";
import { validateAnimationProject } from "../src/persistence/projectValidator";
import { useEditorStore } from "../src/store/editorStore";

const SAMPLE_PARAMETERS = [0, 0.25, 0.5, 0.75, 1] as const;

function calculateIndependentPosition(
  [p0, p1, p2, p3]: readonly [Point, Point, Point, Point],
  t: number,
): Point {
  const inverseT = 1 - t;

  return {
    x:
      inverseT ** 3 * p0.x +
      3 * inverseT ** 2 * t * p1.x +
      3 * inverseT * t ** 2 * p2.x +
      t ** 3 * p3.x,
    y:
      inverseT ** 3 * p0.y +
      3 * inverseT ** 2 * t * p1.y +
      3 * inverseT * t ** 2 * p2.y +
      t ** 3 * p3.y,
  };
}

function calculateIndependentTangent(
  [p0, p1, p2, p3]: readonly [Point, Point, Point, Point],
  t: number,
): Point {
  const inverseT = 1 - t;

  return {
    x:
      3 * inverseT ** 2 * (p1.x - p0.x) +
      6 * inverseT * t * (p2.x - p1.x) +
      3 * t ** 2 * (p3.x - p2.x),
    y:
      3 * inverseT ** 2 * (p1.y - p0.y) +
      6 * inverseT * t * (p2.y - p1.y) +
      3 * t ** 2 * (p3.y - p2.y),
  };
}

function expectPointClose(actual: Point | undefined, expected: Point) {
  expect(actual).toBeDefined();
  expect(actual!.x).toBeCloseTo(expected.x, 10);
  expect(actual!.y).toBeCloseTo(expected.y, 10);
}

function resolveRendererGeometry(
  points: MovementPoint[],
  path: PathSegment,
): readonly [Point, Point, Point, Point] {
  const rendererPoints = resolveBezierPathPoints(points, path);
  expect(rendererPoints).toHaveLength(8);

  return [
    { x: rendererPoints![0]!, y: rendererPoints![1]! },
    { x: rendererPoints![2]!, y: rendererPoints![3]! },
    { x: rendererPoints![4]!, y: rendererPoints![5]! },
    { x: rendererPoints![6]!, y: rendererPoints![7]! },
  ];
}

function expectRendererAndCoreAgreement(
  points: MovementPoint[],
  path: PathSegment,
) {
  const geometry = resolveRendererGeometry(points, path);

  for (const t of SAMPLE_PARAMETERS) {
    const expectedPosition = calculateIndependentPosition(geometry, t);
    const expectedTangent = calculateIndependentTangent(geometry, t);
    const expectedRotation =
      Math.atan2(expectedTangent.y, expectedTangent.x) * (180 / Math.PI);

    expectPointClose(calculatePathPosition(points, path, t), expectedPosition);
    expectPointClose(calculatePathTangent(points, path, t), expectedTangent);
    expect(calculatePathRotation(points, path, t)).toBeCloseTo(
      Object.is(expectedRotation, -0) ? 0 : expectedRotation,
      10,
    );
  }

  expect(calculatePathPosition(points, path, 0)).toEqual(geometry[0]);
  expect(calculatePathPosition(points, path, 1)).toEqual(geometry[3]);
}

function expectMovementIntegrity(points: MovementPoint[], paths: PathSegment[]) {
  expect(paths).toHaveLength(points.length - 1);
  expect(points.map((point) => point.time)).toEqual(
    [...points].map((point) => point.time).sort((left, right) => left - right),
  );
  expect(new Set(points.map((point) => point.id)).size).toBe(points.length);
  expect(new Set(paths.map((path) => path.id)).size).toBe(paths.length);

  for (const [index, path] of paths.entries()) {
    expect(path).toMatchObject({
      fromPointId: points[index]!.id,
      toPointId: points[index + 1]!.id,
      type: "cubicBezier",
    });
    expect(
      [
        path.control1.x,
        path.control1.y,
        path.control2.x,
        path.control2.y,
      ].every(Number.isFinite),
    ).toBe(true);
    expectRendererAndCoreAgreement(points, path);
  }
}

describe("Phase 4 Movement Path integration", () => {
  beforeEach(() => {
    useEditorStore.setState({
      project: createEmptyAnimationProject("phase-4-verification"),
      currentTime: 0,
      selection: {
        objectId: null,
        movementPointId: null,
        pathId: null,
        stateKeyframeId: null,
      },
    });
  });

  it("keeps renderer geometry and Path Core aligned through the full workflow", () => {
    const initialStore = useEditorStore.getState();
    initialStore.setSceneBackground("intersection-01");
    initialStore.addVehicle("car-blue-sedan");
    const vehicleId = useEditorStore.getState().project.scene.objects[0]!.id;

    for (const point of [
      { time: 3, x: 440, y: 180 },
      { time: 6, x: 880, y: 700 },
      { time: 9, x: 1320, y: 260 },
    ]) {
      useEditorStore.getState().setCurrentTime(point.time);
      useEditorStore
        .getState()
        .updateVehiclePosition(vehicleId, point.x, point.y);
    }

    let vehicle = useEditorStore.getState().project.scene.objects[0]!;
    const initialStateTracks = vehicle.stateTracks;
    const initialBackground = useEditorStore.getState().project.scene.background;
    const editedPath = vehicle.movement.paths[1]!;
    useEditorStore
      .getState()
      .updatePathControlPoint(vehicleId, editedPath.id, "control1", 560, 780);
    useEditorStore
      .getState()
      .updatePathControlPoint(vehicleId, editedPath.id, "control2", 1040, 80);

    vehicle = useEditorStore.getState().project.scene.objects[0]!;
    const editedPathAfterControls = vehicle.movement.paths[1]!;
    expect(editedPathAfterControls.id).toBe(editedPath.id);
    expect(editedPathAfterControls.control1).toEqual({ x: 560, y: 780 });
    expect(editedPathAfterControls.control2).toEqual({ x: 1040, y: 80 });
    expectMovementIntegrity(vehicle.movement.points, vehicle.movement.paths);

    const projectBeforeSelection = useEditorStore.getState().project;
    useEditorStore.getState().selectPath(vehicleId, editedPath.id);
    expect(useEditorStore.getState().project).toBe(projectBeforeSelection);
    expect(useEditorStore.getState().selection.pathId).toBe(editedPath.id);

    const endpoint = vehicle.movement.points[2]!;
    const pathsBeforeEndpointMove = vehicle.movement.paths;
    const controlsBeforeEndpointMove = pathsBeforeEndpointMove.flatMap((path) => [
      path.control1,
      path.control2,
    ]);
    useEditorStore
      .getState()
      .updateMovementPointPosition(vehicleId, endpoint.id, 940, 640);
    vehicle = useEditorStore.getState().project.scene.objects[0]!;
    expect(vehicle.movement.paths).toBe(pathsBeforeEndpointMove);
    expect(
      vehicle.movement.paths.flatMap((path) => [path.control1, path.control2]),
    ).toEqual(controlsBeforeEndpointMove);
    expectMovementIntegrity(vehicle.movement.points, vehicle.movement.paths);

    useEditorStore.getState().setCurrentTime(1.5);
    useEditorStore.getState().updateVehiclePosition(vehicleId, 260, 680);
    vehicle = useEditorStore.getState().project.scene.objects[0]!;
    const insertedPoint = vehicle.movement.points[1]!;
    expect(insertedPoint.time).toBe(1.5);
    expectMovementIntegrity(vehicle.movement.points, vehicle.movement.paths);

    expect(
      useEditorStore
        .getState()
        .updateMovementPointTime(vehicleId, insertedPoint.id, 7.5),
    ).toEqual({ status: "updated" });
    vehicle = useEditorStore.getState().project.scene.objects[0]!;
    expect(vehicle.movement.points.map((point) => point.time)).toEqual([
      0, 3, 6, 7.5, 9,
    ]);
    expectMovementIntegrity(vehicle.movement.points, vehicle.movement.paths);

    const pointAtSix = vehicle.movement.points[2]!;
    expect(
      useEditorStore
        .getState()
        .deleteMovementPoint(vehicleId, pointAtSix.id),
    ).toEqual({ status: "deleted" });
    vehicle = useEditorStore.getState().project.scene.objects[0]!;
    expect(vehicle.movement.points.map((point) => point.time)).toEqual([
      0, 3, 7.5, 9,
    ]);
    expectMovementIntegrity(vehicle.movement.points, vehicle.movement.paths);

    const finalState = useEditorStore.getState();
    expect(vehicle.stateTracks).toBe(initialStateTracks);
    expect(finalState.project.scene.background).toBe(initialBackground);
    expect(finalState.project).not.toHaveProperty("currentTime");
    expect(finalState.project).not.toHaveProperty("selection");
    expect(validateAnimationProject(finalState.project)).toEqual({
      valid: true,
      errors: [],
    });
  });

  it("keeps invalid Path and mutation boundaries defensive", () => {
    useEditorStore.getState().addVehicle("car-blue-sedan");
    const vehicle = useEditorStore.getState().project.scene.objects[0]!;
    useEditorStore.getState().setCurrentTime(3);
    useEditorStore
      .getState()
      .updateVehiclePosition(vehicle.id, 1100, 600);
    const movement =
      useEditorStore.getState().project.scene.objects[0]!.movement;
    const path = movement.paths[0]!;
    const invalidPath = { ...path, toPointId: "missing-point" };

    expect(resolveBezierPathPoints(movement.points, invalidPath)).toBeUndefined();
    expect(calculatePathPosition(movement.points, invalidPath, 0.5)).toBeUndefined();
    expect(calculatePathTangent(movement.points, invalidPath, 0.5)).toBeUndefined();
    expect(calculatePathRotation(movement.points, invalidPath, 0.5)).toBeUndefined();

    for (const invalidT of [-0.1, 1.1, Number.NaN, Infinity, -Infinity]) {
      expect(calculatePathPosition(movement.points, path, invalidT)).toBeUndefined();
      expect(calculatePathTangent(movement.points, path, invalidT)).toBeUndefined();
      expect(calculatePathRotation(movement.points, path, invalidT)).toBeUndefined();
    }

    const initialPoint = movement.points[0]!;
    const stateBeforeProtectedDeletion = useEditorStore.getState();
    expect(
      stateBeforeProtectedDeletion.deleteMovementPoint(
        vehicle.id,
        initialPoint.id,
      ),
    ).toEqual({ status: "protected-initial" });
    expect(useEditorStore.getState()).toBe(stateBeforeProtectedDeletion);

    const stateBeforeInvalidControl = useEditorStore.getState();
    stateBeforeInvalidControl.updatePathControlPoint(
      vehicle.id,
      path.id,
      "control1",
      Number.NaN,
      100,
    );
    expect(useEditorStore.getState()).toBe(stateBeforeInvalidControl);
  });
});
