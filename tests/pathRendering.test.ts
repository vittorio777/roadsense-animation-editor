import { describe, expect, it } from "vitest";

import type { MovementPoint } from "../src/model/movement";
import type { PathSegment } from "../src/model/path";
import { resolveBezierPathPoints } from "../src/path/bezier";

describe("F4.2 Path rendering geometry", () => {
  const points: MovementPoint[] = [
    { id: "point-from", time: 0, x: 120, y: 240 },
    { id: "point-to", time: 3, x: 900, y: 540 },
  ];
  const path: PathSegment = {
    id: "path-1",
    fromPointId: "point-from",
    toPointId: "point-to",
    type: "cubicBezier",
    control1: { x: 320, y: 100 },
    control2: { x: 740, y: 700 },
  };

  it("resolves endpoints and stored Control Points in Bézier order", () => {
    expect(resolveBezierPathPoints(points, path)).toEqual([
      120, 240, 320, 100, 740, 700, 900, 540,
    ]);
  });

  it.each([
    { ...path, fromPointId: "missing-from" },
    { ...path, toPointId: "missing-to" },
  ])("returns undefined when an endpoint cannot be resolved", (invalidPath) => {
    expect(resolveBezierPathPoints(points, invalidPath)).toBeUndefined();
  });
});
