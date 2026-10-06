import { describe, expect, it } from "vitest";

import type { MovementPoint } from "../src/model/movement";
import type { PathSegment } from "../src/model/path";
import {
  calculatePathPosition,
  resolveBezierPathPoints,
} from "../src/path/bezier";

const points: MovementPoint[] = [
  { id: "from", time: 0, x: 0, y: 0 },
  { id: "to", time: 4, x: 12, y: 0 },
];

const path: PathSegment = {
  id: "path-1",
  fromPointId: "from",
  toPointId: "to",
  type: "cubicBezier",
  control1: { x: 0, y: 12 },
  control2: { x: 12, y: 12 },
};

describe("F4.5 Path position calculation", () => {
  it("returns the exact Movement Point endpoints at t 0 and 1", () => {
    expect(calculatePathPosition(points, path, 0)).toEqual({ x: 0, y: 0 });
    expect(calculatePathPosition(points, path, 1)).toEqual({ x: 12, y: 0 });
  });

  it.each([
    { t: 0.25, expected: { x: 1.875, y: 6.75 } },
    { t: 0.5, expected: { x: 6, y: 9 } },
    { t: 0.75, expected: { x: 10.125, y: 6.75 } },
  ])("calculates the standard cubic Bézier position at t=$t", ({ t, expected }) => {
    const position = calculatePathPosition(points, path, t);

    expect(position?.x).toBeCloseTo(expected.x, 12);
    expect(position?.y).toBeCloseTo(expected.y, 12);
  });

  it.each([0, 0.1, 0.33, 0.5, 0.9, 1])(
    "matches linear progress for collinear equally spaced geometry at t=%s",
    (t) => {
      const linearPoints: MovementPoint[] = [
        { id: "linear-from", time: 0, x: 0, y: 5 },
        { id: "linear-to", time: 3, x: 30, y: 5 },
      ];
      const linearPath: PathSegment = {
        id: "linear-path",
        fromPointId: "linear-from",
        toPointId: "linear-to",
        type: "cubicBezier",
        control1: { x: 10, y: 5 },
        control2: { x: 20, y: 5 },
      };

      const position = calculatePathPosition(linearPoints, linearPath, t);

      expect(position?.x).toBeCloseTo(30 * t, 12);
      expect(position?.y).toBeCloseTo(5, 12);
    },
  );

  it("uses the latest edited Control Point coordinates", () => {
    const positionBeforeEdit = calculatePathPosition(points, path, 0.5);
    const editedPath: PathSegment = {
      ...path,
      control1: { x: -8, y: 20 },
      control2: { x: 18, y: -4 },
    };

    const positionAfterEdit = calculatePathPosition(points, editedPath, 0.5);

    expect(positionBeforeEdit).toEqual({ x: 6, y: 9 });
    expect(positionAfterEdit).toEqual({ x: 5.25, y: 6 });
    expect(positionAfterEdit).not.toEqual(positionBeforeEdit);
  });

  it("shares the renderer's P0, P1, P2, P3 geometry order", () => {
    expect(resolveBezierPathPoints(points, path)).toEqual([
      0, 0, 0, 12, 12, 12, 12, 0,
    ]);
    expect(calculatePathPosition(points, path, 0.5)).toEqual({ x: 6, y: 9 });
  });

  it.each([-0.01, 1.01, Number.NaN, Infinity, -Infinity])(
    "rejects an invalid parameter without clamping or extrapolating: %s",
    (t) => {
      expect(calculatePathPosition(points, path, t)).toBeUndefined();
    },
  );

  it.each([
    { ...path, fromPointId: "missing-from" },
    { ...path, toPointId: "missing-to" },
  ])("returns undefined when a Path endpoint is missing", (invalidPath) => {
    expect(calculatePathPosition(points, invalidPath, 0.5)).toBeUndefined();
  });

  it("is deterministic and does not mutate its inputs", () => {
    const pointsSnapshot = structuredClone(points);
    const pathSnapshot = structuredClone(path);
    const fromReference = points[0];
    const control1Reference = path.control1;

    const firstResult = calculatePathPosition(points, path, 0.37);
    const secondResult = calculatePathPosition(points, path, 0.37);

    expect(secondResult).toEqual(firstResult);
    expect(points).toEqual(pointsSnapshot);
    expect(path).toEqual(pathSnapshot);
    expect(points[0]).toBe(fromReference);
    expect(path.control1).toBe(control1Reference);
  });
});
