import { describe, expect, it } from "vitest";

import type { MovementPoint } from "../src/model/movement";
import type { PathSegment, Point } from "../src/model/path";
import {
  calculatePathPosition,
  calculatePathRotation,
  calculatePathTangent,
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

function createLinearGeometry(
  from: Point,
  direction: Point,
  scale = 1,
): { points: MovementPoint[]; path: PathSegment } {
  const geometryPoints: MovementPoint[] = [
    { id: "linear-from", time: 0, ...from },
    {
      id: "linear-to",
      time: 3,
      x: from.x + direction.x * scale * 3,
      y: from.y + direction.y * scale * 3,
    },
  ];

  return {
    points: geometryPoints,
    path: {
      id: "linear-path",
      fromPointId: "linear-from",
      toPointId: "linear-to",
      type: "cubicBezier",
      control1: {
        x: from.x + direction.x * scale,
        y: from.y + direction.y * scale,
      },
      control2: {
        x: from.x + direction.x * scale * 2,
        y: from.y + direction.y * scale * 2,
      },
    },
  };
}

describe("F4.6 Path direction and rotation", () => {
  it("calculates the exact derivative at both Path endpoints", () => {
    expect(calculatePathTangent(points, path, 0)).toEqual({ x: 0, y: 36 });
    expect(calculatePathTangent(points, path, 1)).toEqual({ x: 0, y: -36 });
  });

  it.each([
    { t: 0.25, expected: { x: 13.5, y: 18 } },
    { t: 0.5, expected: { x: 18, y: 0 } },
    { t: 0.75, expected: { x: 13.5, y: -18 } },
  ])("calculates the standard cubic derivative at t=$t", ({ t, expected }) => {
    const tangent = calculatePathTangent(points, path, t);

    expect(tangent?.x).toBeCloseTo(expected.x, 12);
    expect(tangent?.y).toBeCloseTo(expected.y, 12);
  });

  it.each([
    { direction: { x: 1, y: 0 }, expected: 0 },
    { direction: { x: 0, y: 1 }, expected: 90 },
    { direction: { x: 0, y: -1 }, expected: -90 },
    { direction: { x: -1, y: 0 }, expected: 180 },
  ])(
    "maps Scene direction $direction to $expected degrees",
    ({ direction, expected }) => {
      const geometry = createLinearGeometry({ x: 20, y: 30 }, direction);

      expect(
        calculatePathRotation(geometry.points, geometry.path, 0.5),
      ).toBe(expected);
    },
  );

  it.each([
    { direction: { x: 1, y: 1 }, expected: 45 },
    { direction: { x: -1, y: 1 }, expected: 135 },
    { direction: { x: -1, y: -1 }, expected: -135 },
    { direction: { x: 1, y: -1 }, expected: -45 },
  ])(
    "preserves the signed atan2 angle for direction $direction",
    ({ direction, expected }) => {
      const geometry = createLinearGeometry({ x: 0, y: 0 }, direction);

      expect(
        calculatePathRotation(geometry.points, geometry.path, 0.37),
      ).toBeCloseTo(expected, 12);
    },
  );

  it("keeps rotation independent from tangent magnitude", () => {
    const shortGeometry = createLinearGeometry(
      { x: 0, y: 0 },
      { x: 2, y: 1 },
    );
    const longGeometry = createLinearGeometry(
      { x: 0, y: 0 },
      { x: 2, y: 1 },
      100,
    );

    const shortRotation = calculatePathRotation(
      shortGeometry.points,
      shortGeometry.path,
      0.42,
    );
    const longRotation = calculatePathRotation(
      longGeometry.points,
      longGeometry.path,
      0.42,
    );

    expect(shortRotation).toBeCloseTo(26.565051177078, 12);
    expect(longRotation).toBeCloseTo(shortRotation!, 12);
  });

  it("uses the latest edited Control Point coordinates", () => {
    const tangentBeforeEdit = calculatePathTangent(points, path, 0.5);
    const rotationBeforeEdit = calculatePathRotation(points, path, 0.5);
    const editedPath: PathSegment = {
      ...path,
      control1: { x: -8, y: 20 },
      control2: { x: 18, y: -4 },
    };

    const tangentAfterEdit = calculatePathTangent(points, editedPath, 0.5);
    const rotationAfterEdit = calculatePathRotation(points, editedPath, 0.5);

    expect(tangentBeforeEdit).toEqual({ x: 18, y: 0 });
    expect(rotationBeforeEdit).toBe(0);
    expect(tangentAfterEdit).toEqual({ x: 28.5, y: -18 });
    expect(rotationAfterEdit).toBeCloseTo(
      Math.atan2(-18, 28.5) * (180 / Math.PI),
      12,
    );
  });

  it("shares P0, P1, P2, P3 across rendering, position and tangent", () => {
    expect(resolveBezierPathPoints(points, path)).toEqual([
      0, 0, 0, 12, 12, 12, 12, 0,
    ]);
    expect(calculatePathPosition(points, path, 0.5)).toEqual({ x: 6, y: 9 });
    expect(calculatePathTangent(points, path, 0.5)).toEqual({ x: 18, y: 0 });
    expect(calculatePathRotation(points, path, 0.5)).toBe(0);
  });

  it.each([-0.01, 1.01, Number.NaN, Infinity, -Infinity])(
    "rejects an invalid parameter: %s",
    (t) => {
      expect(calculatePathTangent(points, path, t)).toBeUndefined();
      expect(calculatePathRotation(points, path, t)).toBeUndefined();
    },
  );

  it.each([
    { ...path, fromPointId: "missing-from" },
    { ...path, toPointId: "missing-to" },
  ])("returns undefined when an endpoint is missing", (invalidPath) => {
    expect(calculatePathTangent(points, invalidPath, 0.5)).toBeUndefined();
    expect(calculatePathRotation(points, invalidPath, 0.5)).toBeUndefined();
  });

  it("preserves a true zero tangent and rejects its undefined rotation", () => {
    const stationaryPoints: MovementPoint[] = [
      { id: "stationary-from", time: 0, x: 50, y: 60 },
      { id: "stationary-to", time: 2, x: 50, y: 60 },
    ];
    const stationaryPath: PathSegment = {
      id: "stationary-path",
      fromPointId: "stationary-from",
      toPointId: "stationary-to",
      type: "cubicBezier",
      control1: { x: 50, y: 60 },
      control2: { x: 50, y: 60 },
    };

    expect(calculatePathTangent(stationaryPoints, stationaryPath, 0.5)).toEqual({
      x: 0,
      y: 0,
    });
    expect(
      calculatePathRotation(stationaryPoints, stationaryPath, 0.5),
    ).toBeUndefined();
  });

  it("is deterministic and does not mutate its inputs", () => {
    const pointsSnapshot = structuredClone(points);
    const pathSnapshot = structuredClone(path);
    const fromReference = points[0];
    const control1Reference = path.control1;

    const firstTangent = calculatePathTangent(points, path, 0.37);
    const secondTangent = calculatePathTangent(points, path, 0.37);
    const firstRotation = calculatePathRotation(points, path, 0.37);
    const secondRotation = calculatePathRotation(points, path, 0.37);

    expect(secondTangent).toEqual(firstTangent);
    expect(secondRotation).toBe(firstRotation);
    expect(points).toEqual(pointsSnapshot);
    expect(path).toEqual(pathSnapshot);
    expect(points[0]).toBe(fromReference);
    expect(path.control1).toBe(control1Reference);
  });
});
