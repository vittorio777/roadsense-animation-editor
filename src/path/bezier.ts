import type { MovementPoint } from "../model/movement";
import type { PathSegment, Point } from "../model/path";

type CreatePathId = () => string;
type CubicBezierGeometry = readonly [Point, Point, Point, Point];

const createPathId = () => `path-${crypto.randomUUID()}`;

function isValidPathParameter(t: number): boolean {
  return Number.isFinite(t) && t >= 0 && t <= 1;
}

function pointAlongLine(from: Point, to: Point, progress: number): Point {
  return {
    x: from.x + (to.x - from.x) * progress,
    y: from.y + (to.y - from.y) * progress,
  };
}

export function createDefaultBezierPath(
  from: MovementPoint,
  to: MovementPoint,
  createId: CreatePathId = createPathId,
): PathSegment {
  return {
    id: createId(),
    fromPointId: from.id,
    toPointId: to.id,
    type: "cubicBezier",
    control1: pointAlongLine(from, to, 1 / 3),
    control2: pointAlongLine(from, to, 2 / 3),
  };
}

export function synchronizeDefaultBezierPaths(
  points: MovementPoint[],
  existingPaths: PathSegment[],
  createId: CreatePathId = createPathId,
): PathSegment[] {
  const synchronizedPaths = points.slice(0, -1).map((from, index) => {
    const to = points[index + 1]!;
    const existingPath = existingPaths.find(
      (path) =>
        path.fromPointId === from.id && path.toPointId === to.id,
    );

    return existingPath ?? createDefaultBezierPath(from, to, createId);
  });

  const topologyIsUnchanged =
    synchronizedPaths.length === existingPaths.length &&
    synchronizedPaths.every((path, index) => path === existingPaths[index]);

  return topologyIsUnchanged ? existingPaths : synchronizedPaths;
}

function resolveCubicBezierGeometry(
  points: MovementPoint[],
  path: PathSegment,
): CubicBezierGeometry | undefined {
  const from = points.find((point) => point.id === path.fromPointId);
  const to = points.find((point) => point.id === path.toPointId);

  if (!from || !to) {
    return undefined;
  }

  return [from, path.control1, path.control2, to];
}

export function resolveBezierPathPoints(
  points: MovementPoint[],
  path: PathSegment,
): number[] | undefined {
  const geometry = resolveCubicBezierGeometry(points, path);

  if (!geometry) {
    return undefined;
  }

  const [from, control1, control2, to] = geometry;

  return [
    from.x,
    from.y,
    control1.x,
    control1.y,
    control2.x,
    control2.y,
    to.x,
    to.y,
  ];
}

export function calculatePathPosition(
  points: MovementPoint[],
  path: PathSegment,
  t: number,
): Point | undefined {
  if (!isValidPathParameter(t)) {
    return undefined;
  }

  const geometry = resolveCubicBezierGeometry(points, path);

  if (!geometry) {
    return undefined;
  }

  const [from, control1, control2, to] = geometry;
  const inverseT = 1 - t;
  const fromWeight = inverseT ** 3;
  const control1Weight = 3 * inverseT ** 2 * t;
  const control2Weight = 3 * inverseT * t ** 2;
  const toWeight = t ** 3;

  return {
    x:
      fromWeight * from.x +
      control1Weight * control1.x +
      control2Weight * control2.x +
      toWeight * to.x,
    y:
      fromWeight * from.y +
      control1Weight * control1.y +
      control2Weight * control2.y +
      toWeight * to.y,
  };
}

export function calculatePathTangent(
  points: MovementPoint[],
  path: PathSegment,
  t: number,
): Point | undefined {
  if (!isValidPathParameter(t)) {
    return undefined;
  }

  const geometry = resolveCubicBezierGeometry(points, path);

  if (!geometry) {
    return undefined;
  }

  const [from, control1, control2, to] = geometry;
  const inverseT = 1 - t;
  const firstWeight = 3 * inverseT ** 2;
  const secondWeight = 6 * inverseT * t;
  const thirdWeight = 3 * t ** 2;

  return {
    x:
      firstWeight * (control1.x - from.x) +
      secondWeight * (control2.x - control1.x) +
      thirdWeight * (to.x - control2.x),
    y:
      firstWeight * (control1.y - from.y) +
      secondWeight * (control2.y - control1.y) +
      thirdWeight * (to.y - control2.y),
  };
}

export function calculatePathRotation(
  points: MovementPoint[],
  path: PathSegment,
  t: number,
): number | undefined {
  const tangent = calculatePathTangent(points, path, t);

  if (!tangent || (tangent.x === 0 && tangent.y === 0)) {
    return undefined;
  }

  const rotation = Math.atan2(tangent.y, tangent.x) * (180 / Math.PI);

  return Object.is(rotation, -0) ? 0 : rotation;
}
