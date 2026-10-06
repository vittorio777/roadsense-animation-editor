import { beforeEach, describe, expect, it } from "vitest";

import { createEmptyAnimationProject } from "../src/model/animation";
import type { PathSegment } from "../src/model/path";
import {
  calculatePathPosition,
  calculatePathRotation,
  calculatePathTangent,
  resolveBezierPathPoints,
} from "../src/path/bezier";
import { validateAnimationProject } from "../src/persistence/projectValidator";
import { useEditorStore } from "../src/store/editorStore";

function createVehicleWithFourPaths() {
  useEditorStore.getState().setSceneBackground("intersection-01");
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

describe("F4.10 Point deletion mutation", () => {
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

  it("reconnects a deleted middle Point and preserves unaffected Paths", () => {
    const vehicle = createVehicleWithFourPaths();
    const [pointA, pointB, pointC, pointD, pointE] = vehicle.movement.points;
    const [pathAB, pathBC, pathCD, pathDE] = vehicle.movement.paths;
    const removedControlReferences = [
      pathAB!.control1,
      pathAB!.control2,
      pathBC!.control1,
      pathBC!.control2,
    ];
    const stateTracksReference = vehicle.stateTracks;
    const backgroundReference =
      useEditorStore.getState().project.scene.background;
    useEditorStore
      .getState()
      .selectMovementPoint(vehicle.id, pointB!.id);

    expect(
      useEditorStore.getState().deleteMovementPoint(vehicle.id, pointB!.id),
    ).toEqual({ status: "deleted" });

    const stateAfterDeletion = useEditorStore.getState();
    const vehicleAfterDeletion = stateAfterDeletion.project.scene.objects[0]!;
    const [replacementPath, preservedPathCD, preservedPathDE] =
      vehicleAfterDeletion.movement.paths;
    expect(vehicleAfterDeletion.movement.points).toEqual([
      pointA,
      pointC,
      pointD,
      pointE,
    ]);
    expect(vehicleAfterDeletion.movement.points[0]).toBe(pointA);
    expect(vehicleAfterDeletion.movement.points[1]).toBe(pointC);
    expect(vehicleAfterDeletion.movement.points[2]).toBe(pointD);
    expect(vehicleAfterDeletion.movement.points[3]).toBe(pointE);
    expect(
      vehicleAfterDeletion.movement.paths.map(({ fromPointId, toPointId }) => ({
        fromPointId,
        toPointId,
      })),
    ).toEqual([
      { fromPointId: pointA!.id, toPointId: pointC!.id },
      { fromPointId: pointC!.id, toPointId: pointD!.id },
      { fromPointId: pointD!.id, toPointId: pointE!.id },
    ]);
    expect(replacementPath!.id).not.toBe(pathAB!.id);
    expect(replacementPath!.id).not.toBe(pathBC!.id);
    expectDefaultGeometry(replacementPath!, pointA!, pointC!);
    for (const control of [
      replacementPath!.control1,
      replacementPath!.control2,
    ]) {
      for (const removedControl of removedControlReferences) {
        expect(control).not.toBe(removedControl);
      }
    }
    expect(preservedPathCD).toBe(pathCD);
    expect(preservedPathDE).toBe(pathDE);
    expect(preservedPathCD!.control1).toBe(pathCD!.control1);
    expect(preservedPathCD!.control2).toBe(pathCD!.control2);
    expect(preservedPathDE!.control1).toBe(pathDE!.control1);
    expect(preservedPathDE!.control2).toBe(pathDE!.control2);
    expect(stateAfterDeletion.selection).toEqual({
      objectId: vehicle.id,
      movementPointId: null,
      pathId: null,
      stateKeyframeId: null,
    });
    expect(stateAfterDeletion.currentTime).toBe(pointB!.time);
    expect(vehicleAfterDeletion.stateTracks).toBe(stateTracksReference);
    expect(stateAfterDeletion.project.scene.background).toBe(
      backgroundReference,
    );
    expect(validateAnimationProject(stateAfterDeletion.project)).toEqual({
      valid: true,
      errors: [],
    });
  });

  it("removes only the final Path and preserves valid Path selection", () => {
    const vehicle = createVehicleWithFourPaths();
    const finalPoint = vehicle.movement.points[4]!;
    const remainingPointReferences = vehicle.movement.points.slice(0, 4);
    const remainingPathReferences = vehicle.movement.paths.slice(0, 3);
    const removedFinalPath = vehicle.movement.paths[3]!;
    const selectedPath = vehicle.movement.paths[1]!;
    useEditorStore.getState().selectPath(vehicle.id, selectedPath.id);
    const selectionReference = useEditorStore.getState().selection;

    expect(
      useEditorStore
        .getState()
        .deleteMovementPoint(vehicle.id, finalPoint.id),
    ).toEqual({ status: "deleted" });

    const stateAfterDeletion = useEditorStore.getState();
    const movement = stateAfterDeletion.project.scene.objects[0]!.movement;
    expect(movement.points).toEqual(remainingPointReferences);
    remainingPointReferences.forEach((point, index) => {
      expect(movement.points[index]).toBe(point);
    });
    expect(movement.paths).toEqual(remainingPathReferences);
    remainingPathReferences.forEach((path, index) => {
      expect(movement.paths[index]).toBe(path);
    });
    expect(movement.paths).not.toContain(removedFinalPath);
    expect(movement.paths).toHaveLength(movement.points.length - 1);
    expect(stateAfterDeletion.selection).toBe(selectionReference);
    expect(stateAfterDeletion.selection.pathId).toBe(selectedPath.id);
    expect(stateAfterDeletion.currentTime).toBe(8);
  });

  it("clears a selected Path when deleting either connected Point", () => {
    for (const deleteEndpoint of ["from", "to"] as const) {
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
      const vehicle = createVehicleWithFourPaths();
      const path = vehicle.movement.paths[1]!;
      const pointId =
        deleteEndpoint === "from" ? path.fromPointId : path.toPointId;
      useEditorStore.getState().selectPath(vehicle.id, path.id);

      useEditorStore.getState().deleteMovementPoint(vehicle.id, pointId);

      expect(useEditorStore.getState().selection).toEqual({
        objectId: vehicle.id,
        movementPointId: null,
        pathId: null,
        stateKeyframeId: null,
      });
      expect(
        useEditorStore
          .getState()
          .project.scene.objects[0]!.movement.paths.some(
            (candidate) => candidate.id === path.id,
          ),
      ).toBe(false);
    }
  });

  it("leaves one valid initial Point after deleting the only later Point", () => {
    useEditorStore.getState().addVehicle("car-blue-sedan");
    const vehicleId = useEditorStore.getState().project.scene.objects[0]!.id;
    useEditorStore.getState().setCurrentTime(3);
    useEditorStore.getState().updateVehiclePosition(vehicleId, 1100, 600);
    const vehicle = useEditorStore.getState().project.scene.objects[0]!;
    const initialPoint = vehicle.movement.points[0]!;
    const laterPoint = vehicle.movement.points[1]!;

    expect(
      useEditorStore
        .getState()
        .deleteMovementPoint(vehicleId, laterPoint.id),
    ).toEqual({ status: "deleted" });

    const stateAfterDeletion = useEditorStore.getState();
    const movement = stateAfterDeletion.project.scene.objects[0]!.movement;
    expect(movement.points).toEqual([initialPoint]);
    expect(movement.points[0]).toBe(initialPoint);
    expect(movement.paths).toEqual([]);
    expect(validateAnimationProject(stateAfterDeletion.project)).toEqual({
      valid: true,
      errors: [],
    });
  });

  it("keeps protected and invalid deletion requests as complete no-ops", () => {
    const vehicle = createVehicleWithFourPaths();
    const initialPoint = vehicle.movement.points[0]!;
    const targetPoint = vehicle.movement.points[1]!;
    const secondVehicle = {
      ...structuredClone(vehicle),
      id: "second-vehicle",
      movement: {
        points: vehicle.movement.points.map((point) => ({
          ...structuredClone(point),
          id: `second-${point.id}`,
        })),
        paths: [],
      },
    };
    useEditorStore.getState().setProject({
      ...useEditorStore.getState().project,
      scene: {
        ...useEditorStore.getState().project.scene,
        objects: [vehicle, secondVehicle],
      },
    });
    const requests = [
      [vehicle.id, initialPoint.id, "protected-initial"],
      ["missing-object", targetPoint.id, "invalid"],
      [vehicle.id, "missing-point", "invalid"],
      [secondVehicle.id, targetPoint.id, "invalid"],
    ] as const;

    for (const [objectId, pointId, expectedStatus] of requests) {
      const stateBeforeRequest = useEditorStore.getState();
      expect(
        stateBeforeRequest.deleteMovementPoint(objectId, pointId).status,
      ).toBe(expectedStatus);
      expect(useEditorStore.getState()).toBe(stateBeforeRequest);
    }
  });

  it("produces finite render and Path Core geometry after middle deletion", () => {
    const vehicle = createVehicleWithFourPaths();
    const targetPoint = vehicle.movement.points[2]!;
    useEditorStore
      .getState()
      .deleteMovementPoint(vehicle.id, targetPoint.id);
    const movement =
      useEditorStore.getState().project.scene.objects[0]!.movement;

    expect(movement.paths).toHaveLength(movement.points.length - 1);
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
