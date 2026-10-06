import { beforeEach, describe, expect, it } from "vitest";

import { createEmptyAnimationProject } from "../src/model/animation";
import type { MovementPoint } from "../src/model/movement";
import type { PathSegment } from "../src/model/path";
import {
  createDefaultBezierPath,
  synchronizeDefaultBezierPaths,
} from "../src/path/bezier";
import { useEditorStore } from "../src/store/editorStore";

const point = (
  id: string,
  time: number,
  x: number,
  y: number,
): MovementPoint => ({ id, time, x, y });

describe("F4.1 Default Bézier Path", () => {
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
    useEditorStore.getState().addVehicle("car-blue-sedan");
  });

  it.each([
    {
      name: "horizontal",
      from: point("from", 0, 0, 0),
      to: point("to", 1, 12, 0),
      control1: { x: 4, y: 0 },
      control2: { x: 8, y: 0 },
    },
    {
      name: "vertical",
      from: point("from", 0, 3, -6),
      to: point("to", 1, 3, 6),
      control1: { x: 3, y: -2 },
      control2: { x: 3, y: 2 },
    },
    {
      name: "diagonal with negative coordinates",
      from: point("from", 0, -6, -3),
      to: point("to", 1, 6, 9),
      control1: { x: -2, y: 1 },
      control2: { x: 2, y: 5 },
    },
    {
      name: "coincident endpoints",
      from: point("from", 0, 5, 7),
      to: point("to", 1, 5, 7),
      control1: { x: 5, y: 7 },
      control2: { x: 5, y: 7 },
    },
  ])("creates deterministic $name control points", (example) => {
    const path = createDefaultBezierPath(
      example.from,
      example.to,
      () => "path-fixed",
    );

    expect(path).toEqual({
      id: "path-fixed",
      fromPointId: "from",
      toPointId: "to",
      type: "cubicBezier",
      control1: example.control1,
      control2: example.control2,
    });
    expect(Object.values(path.control1).every(Number.isFinite)).toBe(true);
    expect(Object.values(path.control2).every(Number.isFinite)).toBe(true);
  });

  it("creates exactly one unique Path for each adjacent Point pair", () => {
    const points = [
      point("point-0", 0, 0, 0),
      point("point-2", 2, 30, 15),
      point("point-5", 5, 90, 45),
    ];
    const ids = ["path-0-2", "path-2-5"];

    const paths = synchronizeDefaultBezierPaths(points, [], () => ids.shift()!);

    expect(paths).toHaveLength(2);
    expect(paths.map(({ id, fromPointId, toPointId }) => ({
      id,
      fromPointId,
      toPointId,
    }))).toEqual([
      { id: "path-0-2", fromPointId: "point-0", toPointId: "point-2" },
      { id: "path-2-5", fromPointId: "point-2", toPointId: "point-5" },
    ]);
    expect(new Set(paths.map((path) => path.id)).size).toBe(paths.length);
    expect(synchronizeDefaultBezierPaths([points[0]!], [], () => "unused"))
      .toEqual([]);
  });

  it("preserves valid adjacent Paths and replaces only missing topology", () => {
    const points = [
      point("point-0", 0, 0, 0),
      point("point-2", 2, 20, 20),
      point("point-5", 5, 50, 10),
      point("point-8", 8, 80, 40),
    ];
    const preservedPath: PathSegment = {
      id: "path-preserved",
      fromPointId: "point-5",
      toPointId: "point-8",
      type: "cubicBezier",
      control1: { x: 61, y: 12 },
      control2: { x: 73, y: 35 },
    };
    const obsoletePath: PathSegment = {
      id: "path-obsolete",
      fromPointId: "point-0",
      toPointId: "point-5",
      type: "cubicBezier",
      control1: { x: 10, y: 10 },
      control2: { x: 40, y: 20 },
    };
    const ids = ["path-0-2", "path-2-5"];

    const paths = synchronizeDefaultBezierPaths(
      points,
      [obsoletePath, preservedPath],
      () => ids.shift()!,
    );

    expect(paths.map((path) => path.id)).toEqual([
      "path-0-2",
      "path-2-5",
      "path-preserved",
    ]);
    expect(paths[2]).toBe(preservedPath);
    expect(paths).not.toContain(obsoletePath);
  });

  it("creates default Paths when Store creates new Movement Points", () => {
    const stateBeforeCreation = useEditorStore.getState();
    const vehicleBeforeCreation = stateBeforeCreation.project.scene.objects[0]!;
    const initialPoint = vehicleBeforeCreation.movement.points[0]!;
    const initialStateTracks = vehicleBeforeCreation.stateTracks;

    stateBeforeCreation.setCurrentTime(3.3);
    useEditorStore
      .getState()
      .updateVehiclePosition(vehicleBeforeCreation.id, 1000, 520);

    const vehicleAfterFirstCreation =
      useEditorStore.getState().project.scene.objects[0]!;
    const pointAtThree = vehicleAfterFirstCreation.movement.points[1]!;
    const firstPath = vehicleAfterFirstCreation.movement.paths[0]!;

    expect(firstPath).toMatchObject({
      fromPointId: initialPoint.id,
      toPointId: pointAtThree.id,
      type: "cubicBezier",
      control1: { x: 866.6666666666666, y: 473.3333333333333 },
      control2: { x: 933.3333333333333, y: 496.6666666666667 },
    });

    useEditorStore.getState().setCurrentTime(5);
    useEditorStore
      .getState()
      .updateVehiclePosition(vehicleBeforeCreation.id, 1200, 600);

    const stateAfterSecondCreation = useEditorStore.getState();
    const vehicleAfterSecondCreation = stateAfterSecondCreation.project.scene.objects[0]!;
    expect(vehicleAfterSecondCreation.movement.paths).toHaveLength(2);
    expect(vehicleAfterSecondCreation.movement.paths[0]).toBe(firstPath);
    expect(vehicleAfterSecondCreation.movement.paths[1]).toMatchObject({
      fromPointId: pointAtThree.id,
      toPointId: vehicleAfterSecondCreation.movement.points[2]?.id,
      type: "cubicBezier",
    });
    expect(vehicleAfterSecondCreation.stateTracks).toBe(initialStateTracks);
    expect(stateAfterSecondCreation.currentTime).toBe(5);
    expect(stateAfterSecondCreation.selection).toBe(stateBeforeCreation.selection);
  });

  it("does not recreate Paths for same-time edits, seeks, selections or no-ops", () => {
    const vehicleId = useEditorStore.getState().project.scene.objects[0]!.id;
    useEditorStore.getState().setCurrentTime(3.3);
    useEditorStore.getState().updateVehiclePosition(vehicleId, 1000, 520);
    const stateWithPath = useEditorStore.getState();
    const vehicleWithPath = stateWithPath.project.scene.objects[0]!;
    const path = vehicleWithPath.movement.paths[0]!;

    stateWithPath.updateVehiclePosition(vehicleId, 1100, 560);
    const stateAfterEdit = useEditorStore.getState();
    expect(stateAfterEdit.project.scene.objects[0]!.movement.paths).toBe(
      vehicleWithPath.movement.paths,
    );
    expect(stateAfterEdit.project.scene.objects[0]!.movement.paths[0]).toBe(path);

    stateAfterEdit.setCurrentTime(4);
    const stateAfterSeek = useEditorStore.getState();
    expect(stateAfterSeek.project).toBe(stateAfterEdit.project);

    stateAfterSeek.selectObject(vehicleId);
    const stateAfterSelection = useEditorStore.getState();
    expect(stateAfterSelection.project).toBe(stateAfterEdit.project);

    stateAfterSelection.updateVehiclePosition(vehicleId, 1100, 560);
    expect(useEditorStore.getState().project).toBe(stateAfterEdit.project);
  });

  it("keeps topology valid after Point time reordering and deletion", () => {
    const vehicleId = useEditorStore.getState().project.scene.objects[0]!.id;
    useEditorStore.getState().setCurrentTime(3);
    useEditorStore.getState().updateVehiclePosition(vehicleId, 1000, 520);
    useEditorStore.getState().setCurrentTime(5);
    useEditorStore.getState().updateVehiclePosition(vehicleId, 1200, 600);

    const vehicleBeforeReorder = useEditorStore.getState().project.scene.objects[0]!;
    const [initialPoint, pointAtThree, pointAtFive] =
      vehicleBeforeReorder.movement.points;

    expect(
      useEditorStore
        .getState()
        .updateMovementPointTime(vehicleId, pointAtThree!.id, 7),
    ).toEqual({ status: "updated" });

    const vehicleAfterReorder = useEditorStore.getState().project.scene.objects[0]!;
    expect(
      vehicleAfterReorder.movement.paths.map(({ fromPointId, toPointId }) => ({
        fromPointId,
        toPointId,
      })),
    ).toEqual([
      { fromPointId: initialPoint!.id, toPointId: pointAtFive!.id },
      { fromPointId: pointAtFive!.id, toPointId: pointAtThree!.id },
    ]);

    expect(
      useEditorStore
        .getState()
        .deleteMovementPoint(vehicleId, pointAtFive!.id),
    ).toEqual({ status: "deleted" });

    const vehicleAfterDeletion = useEditorStore.getState().project.scene.objects[0]!;
    expect(vehicleAfterDeletion.movement.paths).toHaveLength(1);
    expect(vehicleAfterDeletion.movement.paths[0]).toMatchObject({
      fromPointId: initialPoint!.id,
      toPointId: pointAtThree!.id,
      type: "cubicBezier",
    });
  });
});
