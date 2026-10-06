import { beforeEach, describe, expect, it } from "vitest";

import { createEmptyAnimationProject } from "../src/model/animation";
import {
  calculatePathPosition,
  calculatePathRotation,
  calculatePathTangent,
  resolveBezierPathPoints,
} from "../src/path/bezier";
import type { PathSegment } from "../src/model/path";
import { useEditorStore } from "../src/store/editorStore";

function createVehicleWithThreePaths() {
  useEditorStore.getState().addVehicle("car-blue-sedan");
  const vehicleId = useEditorStore.getState().project.scene.objects[0]!.id;

  for (const point of [
    { time: 4, x: 480, y: 180 },
    { time: 8, x: 900, y: 620 },
    { time: 12, x: 1320, y: 360 },
  ]) {
    useEditorStore.getState().setCurrentTime(point.time);
    useEditorStore
      .getState()
      .updateVehiclePosition(vehicleId, point.x, point.y);
  }

  const vehicle = useEditorStore.getState().project.scene.objects[0]!;
  const editedControls = [
    [{ x: 620, y: 120 }, { x: 420, y: 700 }],
    [{ x: 1040, y: 760 }, { x: 1180, y: 100 }],
    [{ x: 980, y: 120 }, { x: 1240, y: 720 }],
  ] as const;

  for (const [pathIndex, controls] of editedControls.entries()) {
    const path = vehicle.movement.paths[pathIndex]!;
    useEditorStore
      .getState()
      .updatePathControlPoint(
        vehicle.id,
        path.id,
        "control1",
        controls[0].x,
        controls[0].y,
      );
    useEditorStore
      .getState()
      .updatePathControlPoint(
        vehicle.id,
        path.id,
        "control2",
        controls[1].x,
        controls[1].y,
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

describe("F4.8 Point insertion mutation", () => {
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

  it("splits one adjacency into two default Paths and preserves all others", () => {
    const vehicle = createVehicleWithThreePaths();
    const [pointA, pointB, pointC, pointD] = vehicle.movement.points;
    const [splitPath, preservedPathBC, preservedPathCD] =
      vehicle.movement.paths;
    const splitControlReferences = [splitPath!.control1, splitPath!.control2];
    const preservedControlReferences = [
      preservedPathBC!.control1,
      preservedPathBC!.control2,
      preservedPathCD!.control1,
      preservedPathCD!.control2,
    ];
    const stateTracksReference = vehicle.stateTracks;
    const backgroundReference =
      useEditorStore.getState().project.scene.background;
    useEditorStore.getState().selectPath(vehicle.id, splitPath!.id);
    useEditorStore.getState().setCurrentTime(2);

    useEditorStore.getState().updateVehiclePosition(vehicle.id, 300, 660);

    const stateAfterInsert = useEditorStore.getState();
    const vehicleAfterInsert = stateAfterInsert.project.scene.objects[0]!;
    const insertedPoint = vehicleAfterInsert.movement.points[1]!;
    const [pathAN, pathNB, pathBC, pathCD] = vehicleAfterInsert.movement.paths;

    expect(vehicleAfterInsert.movement.points.map((point) => point.time)).toEqual([
      0, 2, 4, 8, 12,
    ]);
    expect(insertedPoint).toMatchObject({ time: 2, x: 300, y: 660 });
    expect(insertedPoint.id).toEqual(expect.any(String));
    expect(new Set(vehicleAfterInsert.movement.points.map((point) => point.id)).size)
      .toBe(5);
    expect(vehicleAfterInsert.movement.paths).toHaveLength(4);
    expect(
      vehicleAfterInsert.movement.paths.map(({ fromPointId, toPointId }) => ({
        fromPointId,
        toPointId,
      })),
    ).toEqual([
      { fromPointId: pointA!.id, toPointId: insertedPoint.id },
      { fromPointId: insertedPoint.id, toPointId: pointB!.id },
      { fromPointId: pointB!.id, toPointId: pointC!.id },
      { fromPointId: pointC!.id, toPointId: pointD!.id },
    ]);
    expect(pathAN!.id).not.toBe(splitPath!.id);
    expect(pathNB!.id).not.toBe(splitPath!.id);
    expect(pathAN!.id).not.toBe(pathNB!.id);
    expect(
      new Set(vehicleAfterInsert.movement.paths.map((path) => path.id)).size,
    ).toBe(4);
    expectDefaultGeometry(pathAN!, pointA!, insertedPoint);
    expectDefaultGeometry(pathNB!, insertedPoint, pointB!);
    expect(vehicleAfterInsert.movement.paths).not.toContain(splitPath);
    for (const newControl of [
      pathAN!.control1,
      pathAN!.control2,
      pathNB!.control1,
      pathNB!.control2,
    ]) {
      for (const oldControl of splitControlReferences) {
        expect(newControl).not.toBe(oldControl);
      }
    }
    expect(pathBC).toBe(preservedPathBC);
    expect(pathCD).toBe(preservedPathCD);
    expect([
      pathBC!.control1,
      pathBC!.control2,
      pathCD!.control1,
      pathCD!.control2,
    ]).toEqual(preservedControlReferences);
    preservedControlReferences.forEach((control, index) => {
      expect(
        [
          pathBC!.control1,
          pathBC!.control2,
          pathCD!.control1,
          pathCD!.control2,
        ][index],
      ).toBe(control);
    });
    expect(stateAfterInsert.selection).toEqual({
      objectId: vehicle.id,
      movementPointId: null,
      pathId: null,
      stateKeyframeId: null,
    });
    expect(stateAfterInsert.currentTime).toBe(2);
    expect(vehicleAfterInsert.stateTracks).toBe(stateTracksReference);
    expect(stateAfterInsert.project.scene.background).toBe(backgroundReference);
  });

  it("produces finite rendering, position, tangent and rotation geometry", () => {
    const vehicle = createVehicleWithThreePaths();
    useEditorStore.getState().setCurrentTime(2);
    useEditorStore.getState().updateVehiclePosition(vehicle.id, 300, 660);
    const movement =
      useEditorStore.getState().project.scene.objects[0]!.movement;
    const newPaths = movement.paths.slice(0, 2);

    for (const path of newPaths) {
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

  it("preserves a still-valid selected Path through an insertion elsewhere", () => {
    const vehicle = createVehicleWithThreePaths();
    const selectedPath = vehicle.movement.paths[2]!;
    useEditorStore.getState().selectPath(vehicle.id, selectedPath.id);
    const selectionReference = useEditorStore.getState().selection;
    useEditorStore.getState().setCurrentTime(2);

    useEditorStore.getState().updateVehiclePosition(vehicle.id, 300, 660);

    const stateAfterInsert = useEditorStore.getState();
    const vehicleAfterInsert = stateAfterInsert.project.scene.objects[0]!;
    expect(stateAfterInsert.selection).toBe(selectionReference);
    expect(stateAfterInsert.selection.pathId).toBe(selectedPath.id);
    expect(vehicleAfterInsert.movement.paths[3]).toBe(selectedPath);
  });

  it("appends one default Path while preserving the complete old topology", () => {
    const vehicle = createVehicleWithThreePaths();
    const pointReferences = [...vehicle.movement.points];
    const pathReferences = [...vehicle.movement.paths];
    useEditorStore.getState().setCurrentTime(14);

    useEditorStore.getState().updateVehiclePosition(vehicle.id, 1480, 720);

    const movementAfterAppend =
      useEditorStore.getState().project.scene.objects[0]!.movement;
    const appendedPoint = movementAfterAppend.points[4]!;
    const appendedPath = movementAfterAppend.paths[3]!;
    expect(movementAfterAppend.points.slice(0, 4)).toEqual(pointReferences);
    pointReferences.forEach((point, index) => {
      expect(movementAfterAppend.points[index]).toBe(point);
    });
    expect(movementAfterAppend.paths.slice(0, 3)).toEqual(pathReferences);
    pathReferences.forEach((path, index) => {
      expect(movementAfterAppend.paths[index]).toBe(path);
    });
    expect(appendedPoint).toMatchObject({ time: 14, x: 1480, y: 720 });
    expect(appendedPath).toMatchObject({
      fromPointId: vehicle.movement.points[3]!.id,
      toPointId: appendedPoint.id,
      type: "cubicBezier",
    });
    expectDefaultGeometry(
      appendedPath,
      vehicle.movement.points[3]!,
      appendedPoint,
    );
    expect(movementAfterAppend.paths).toHaveLength(
      movementAfterAppend.points.length - 1,
    );
  });

  it("treats a same-time commit as position editing without topology changes", () => {
    const vehicle = createVehicleWithThreePaths();
    const targetPoint = vehicle.movement.points[1]!;
    const pathsReference = vehicle.movement.paths;
    useEditorStore.getState().setCurrentTime(targetPoint.time);

    useEditorStore.getState().updateVehiclePosition(vehicle.id, 540, 260);

    const movementAfterEdit =
      useEditorStore.getState().project.scene.objects[0]!.movement;
    expect(movementAfterEdit.points).toHaveLength(4);
    expect(movementAfterEdit.points[1]).toEqual({
      ...targetPoint,
      x: 540,
      y: 260,
    });
    expect(movementAfterEdit.points[1]!.id).toBe(targetPoint.id);
    expect(movementAfterEdit.paths).toBe(pathsReference);
  });

  it("keeps invalid insertion requests as complete state no-ops", () => {
    const vehicle = createVehicleWithThreePaths();
    useEditorStore.getState().setCurrentTime(2);

    const requests: Array<() => void> = [
      () =>
        useEditorStore
          .getState()
          .updateVehiclePosition("missing-object", 300, 660),
      () =>
        useEditorStore
          .getState()
          .updateVehiclePosition(vehicle.id, Number.NaN, 660),
      () =>
        useEditorStore
          .getState()
          .updateVehiclePosition(vehicle.id, 300, Infinity),
      () =>
        useEditorStore
          .getState()
          .updateVehiclePosition(vehicle.id, -Infinity, 660),
    ];

    for (const request of requests) {
      const stateBeforeRequest = useEditorStore.getState();
      request();
      expect(useEditorStore.getState()).toBe(stateBeforeRequest);
    }

    useEditorStore.getState().setCurrentTime(-1);
    const stateBeforeMissingBaseline = useEditorStore.getState();
    stateBeforeMissingBaseline.updateVehiclePosition(vehicle.id, 300, 660);
    expect(useEditorStore.getState()).toBe(stateBeforeMissingBaseline);
  });
});
