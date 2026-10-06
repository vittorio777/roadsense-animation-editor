import { beforeEach, describe, expect, it } from "vitest";

import { createEmptyAnimationProject } from "../src/model/animation";
import {
  calculatePathPosition,
  calculatePathRotation,
  calculatePathTangent,
  resolveBezierPathPoints,
} from "../src/path/bezier";
import { useEditorStore } from "../src/store/editorStore";

function createVehicleWithThreePaths() {
  useEditorStore.getState().addVehicle("car-blue-sedan");
  const vehicleId = useEditorStore.getState().project.scene.objects[0]!.id;

  for (const point of [
    { time: 2, x: 400, y: 180 },
    { time: 4, x: 760, y: 520 },
    { time: 6, x: 1180, y: 360 },
  ]) {
    useEditorStore.getState().setCurrentTime(point.time);
    useEditorStore
      .getState()
      .updateVehiclePosition(vehicleId, point.x, point.y);
  }

  const vehicle = useEditorStore.getState().project.scene.objects[0]!;
  const editedControls = [
    [{ x: 930, y: 700 }, { x: 1080, y: 120 }],
    [{ x: 480, y: 80 }, { x: 620, y: 700 }],
  ] as const;

  for (const [index, controls] of editedControls.entries()) {
    const path = vehicle.movement.paths[index]!;
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

describe("F4.7 Point position mutation", () => {
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

  it("updates both adjacent Path endpoints without rebuilding Path data", () => {
    const vehicle = createVehicleWithThreePaths();
    const targetPoint = vehicle.movement.points[1]!;
    const incomingPath = vehicle.movement.paths[0]!;
    const outgoingPath = vehicle.movement.paths[1]!;
    const unrelatedPath = vehicle.movement.paths[2]!;
    const pathsReference = vehicle.movement.paths;
    const pathReferences = [...pathsReference];
    const controlReferences = pathReferences.flatMap((path) => [
      path.control1,
      path.control2,
    ]);
    const pathIdentitySnapshot = pathReferences.map(
      ({ id, fromPointId, toPointId }) => ({ id, fromPointId, toPointId }),
    );
    const unrelatedGeometryBefore = resolveBezierPathPoints(
      vehicle.movement.points,
      unrelatedPath,
    );
    useEditorStore.getState().selectPath(vehicle.id, incomingPath.id);
    useEditorStore.getState().setCurrentTime(5.5);
    const selectionReference = useEditorStore.getState().selection;

    useEditorStore
      .getState()
      .updateMovementPointPosition(vehicle.id, targetPoint.id, 520, 640);

    const stateAfterMove = useEditorStore.getState();
    const vehicleAfterMove = stateAfterMove.project.scene.objects[0]!;
    expect(vehicleAfterMove.movement.points[1]).toEqual({
      ...targetPoint,
      x: 520,
      y: 640,
    });
    expect(vehicleAfterMove.movement.points[0]).toBe(
      vehicle.movement.points[0],
    );
    expect(vehicleAfterMove.movement.points[2]).toBe(
      vehicle.movement.points[2],
    );
    expect(vehicleAfterMove.movement.points[3]).toBe(
      vehicle.movement.points[3],
    );
    expect(vehicleAfterMove.movement.paths).toBe(pathsReference);
    expect(vehicleAfterMove.movement.paths).toEqual(pathReferences);
    expect(
      vehicleAfterMove.movement.paths.map(
        ({ id, fromPointId, toPointId }) => ({ id, fromPointId, toPointId }),
      ),
    ).toEqual(pathIdentitySnapshot);
    expect(
      vehicleAfterMove.movement.paths.flatMap((path) => [
        path.control1,
        path.control2,
      ]),
    ).toEqual(controlReferences);
    controlReferences.forEach((control, index) => {
      expect(
        vehicleAfterMove.movement.paths.flatMap((path) => [
          path.control1,
          path.control2,
        ])[index],
      ).toBe(control);
    });
    expect(
      resolveBezierPathPoints(vehicleAfterMove.movement.points, incomingPath),
    ).toEqual([
      vehicle.movement.points[0]!.x,
      vehicle.movement.points[0]!.y,
      incomingPath.control1.x,
      incomingPath.control1.y,
      incomingPath.control2.x,
      incomingPath.control2.y,
      520,
      640,
    ]);
    expect(
      resolveBezierPathPoints(vehicleAfterMove.movement.points, outgoingPath),
    ).toEqual([
      520,
      640,
      outgoingPath.control1.x,
      outgoingPath.control1.y,
      outgoingPath.control2.x,
      outgoingPath.control2.y,
      vehicle.movement.points[2]!.x,
      vehicle.movement.points[2]!.y,
    ]);
    expect(
      resolveBezierPathPoints(vehicleAfterMove.movement.points, unrelatedPath),
    ).toEqual(unrelatedGeometryBefore);
    expect(stateAfterMove.selection).toBe(selectionReference);
    expect(stateAfterMove.currentTime).toBe(5.5);
    expect(vehicleAfterMove.stateTracks).toBe(vehicle.stateTracks);
  });

  it("updates Path Core results for connected Paths only", () => {
    const vehicle = createVehicleWithThreePaths();
    const targetPoint = vehicle.movement.points[1]!;
    const incomingPath = vehicle.movement.paths[0]!;
    const outgoingPath = vehicle.movement.paths[1]!;
    const unrelatedPath = vehicle.movement.paths[2]!;
    const before = {
      incomingPosition: calculatePathPosition(
        vehicle.movement.points,
        incomingPath,
        0.5,
      ),
      incomingTangent: calculatePathTangent(
        vehicle.movement.points,
        incomingPath,
        0.5,
      ),
      incomingRotation: calculatePathRotation(
        vehicle.movement.points,
        incomingPath,
        0.5,
      ),
      outgoingPosition: calculatePathPosition(
        vehicle.movement.points,
        outgoingPath,
        0.5,
      ),
      outgoingTangent: calculatePathTangent(
        vehicle.movement.points,
        outgoingPath,
        0.5,
      ),
      outgoingRotation: calculatePathRotation(
        vehicle.movement.points,
        outgoingPath,
        0.5,
      ),
      unrelatedPosition: calculatePathPosition(
        vehicle.movement.points,
        unrelatedPath,
        0.5,
      ),
      unrelatedTangent: calculatePathTangent(
        vehicle.movement.points,
        unrelatedPath,
        0.5,
      ),
      unrelatedRotation: calculatePathRotation(
        vehicle.movement.points,
        unrelatedPath,
        0.5,
      ),
    };

    useEditorStore
      .getState()
      .updateMovementPointPosition(vehicle.id, targetPoint.id, 520, 640);

    const pointsAfterMove =
      useEditorStore.getState().project.scene.objects[0]!.movement.points;
    expect(calculatePathPosition(pointsAfterMove, incomingPath, 0.5)).not.toEqual(
      before.incomingPosition,
    );
    expect(calculatePathTangent(pointsAfterMove, incomingPath, 0.5)).not.toEqual(
      before.incomingTangent,
    );
    expect(calculatePathRotation(pointsAfterMove, incomingPath, 0.5)).not.toBe(
      before.incomingRotation,
    );
    expect(calculatePathPosition(pointsAfterMove, outgoingPath, 0.5)).not.toEqual(
      before.outgoingPosition,
    );
    expect(calculatePathTangent(pointsAfterMove, outgoingPath, 0.5)).not.toEqual(
      before.outgoingTangent,
    );
    expect(calculatePathRotation(pointsAfterMove, outgoingPath, 0.5)).not.toBe(
      before.outgoingRotation,
    );
    expect(calculatePathPosition(pointsAfterMove, unrelatedPath, 0.5)).toEqual(
      before.unrelatedPosition,
    );
    expect(calculatePathTangent(pointsAfterMove, unrelatedPath, 0.5)).toEqual(
      before.unrelatedTangent,
    );
    expect(calculatePathRotation(pointsAfterMove, unrelatedPath, 0.5)).toBe(
      before.unrelatedRotation,
    );
  });

  it("updates only the connected endpoint for first and last Points", () => {
    const vehicle = createVehicleWithThreePaths();
    const [firstPoint, , , lastPoint] = vehicle.movement.points;
    const [firstPath, secondPath, lastPath] = vehicle.movement.paths;
    const secondGeometryBefore = resolveBezierPathPoints(
      vehicle.movement.points,
      secondPath!,
    );

    useEditorStore
      .getState()
      .updateMovementPointPosition(vehicle.id, firstPoint!.id, 220, 260);
    let pointsAfterMove =
      useEditorStore.getState().project.scene.objects[0]!.movement.points;
    expect(resolveBezierPathPoints(pointsAfterMove, firstPath!)?.slice(0, 2)).toEqual([
      220, 260,
    ]);
    expect(resolveBezierPathPoints(pointsAfterMove, secondPath!)).toEqual(
      secondGeometryBefore,
    );

    useEditorStore
      .getState()
      .updateMovementPointPosition(vehicle.id, lastPoint!.id, 1320, 700);
    pointsAfterMove =
      useEditorStore.getState().project.scene.objects[0]!.movement.points;
    expect(resolveBezierPathPoints(pointsAfterMove, lastPath!)?.slice(6)).toEqual([
      1320, 700,
    ]);
    expect(resolveBezierPathPoints(pointsAfterMove, secondPath!)).toEqual(
      secondGeometryBefore,
    );
  });

  it("keeps invalid, ownership-mismatched and repeated requests atomic", () => {
    const vehicle = createVehicleWithThreePaths();
    const point = vehicle.movement.points[1]!;
    const secondVehicle = {
      ...structuredClone(vehicle),
      id: "second-vehicle",
      movement: {
        ...structuredClone(vehicle.movement),
        points: vehicle.movement.points.map((candidate) => ({
          ...candidate,
          id: `second-${candidate.id}`,
        })),
      },
    };
    useEditorStore.getState().setProject({
      ...useEditorStore.getState().project,
      scene: {
        ...useEditorStore.getState().project.scene,
        objects: [vehicle, secondVehicle],
      },
    });

    const requests: Array<() => void> = [
      () =>
        useEditorStore
          .getState()
          .updateMovementPointPosition(
            vehicle.id,
            point.id,
            point.x,
            point.y,
          ),
      () =>
        useEditorStore
          .getState()
          .updateMovementPointPosition("missing-object", point.id, 1, 2),
      () =>
        useEditorStore
          .getState()
          .updateMovementPointPosition(vehicle.id, "missing-point", 1, 2),
      () =>
        useEditorStore
          .getState()
          .updateMovementPointPosition(secondVehicle.id, point.id, 1, 2),
      () =>
        useEditorStore
          .getState()
          .updateMovementPointPosition(vehicle.id, point.id, Number.NaN, 2),
      () =>
        useEditorStore
          .getState()
          .updateMovementPointPosition(vehicle.id, point.id, 1, Infinity),
      () =>
        useEditorStore
          .getState()
          .updateMovementPointPosition(vehicle.id, point.id, -Infinity, 2),
    ];

    for (const request of requests) {
      const stateBeforeRequest = useEditorStore.getState();
      request();
      expect(useEditorStore.getState()).toBe(stateBeforeRequest);
    }
  });
});
