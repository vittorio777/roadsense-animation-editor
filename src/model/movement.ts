import type { PathSegment } from "./path";

export interface MovementPoint {
  id: string;
  time: number;
  x: number;
  y: number;
}

export interface VehicleMovement {
  points: MovementPoint[];
  paths: PathSegment[];
}

export interface CreateMovementPointOptions {
  time: number;
  x: number;
  y: number;
  createId?: () => string;
}

const createMovementPointId = () => `movement-point-${crypto.randomUUID()}`;

export function createMovementPoint({
  time,
  x,
  y,
  createId = createMovementPointId,
}: CreateMovementPointOptions): MovementPoint {
  return {
    id: createId(),
    time,
    x,
    y,
  };
}

export function findMovementPointAtTime(
  movement: VehicleMovement,
  time: number,
): MovementPoint | undefined {
  return movement.points.find((point) => point.time === time);
}

export function resolveMovementPointForEditing(
  movement: VehicleMovement,
  time: number,
): MovementPoint | undefined {
  return movement.points.reduce<MovementPoint | undefined>(
    (resolvedPoint, point) => {
      if (point.time > time) {
        return resolvedPoint;
      }

      if (!resolvedPoint || point.time > resolvedPoint.time) {
        return point;
      }

      return resolvedPoint;
    },
    undefined,
  );
}
