import type { AnimationProject } from "../model/animation";
import type { MovementPoint, VehicleMovement } from "../model/movement";
import type {
  IndicatorState,
  VehicleStateTrackKey,
  VehicleStateTracks,
} from "../model/stateTrack";
import { resolveStateValueAtTime } from "../model/stateTrack";
import type { VehicleObject } from "../model/vehicle";
import {
  calculatePathPosition,
  calculatePathRotation,
} from "../path/bezier";

export interface PreviewVehicleState {
  id: string;
  assetId: string;
  x: number;
  y: number;
  rotationDeg: number;
  indicator: IndicatorState;
  brakeLight: boolean;
  headlight: boolean;
  horn: boolean;
}

export interface PreviewSceneState {
  width: number;
  height: number;
  backgroundAssetId?: string;
  vehicles: PreviewVehicleState[];
}

export type PreviewSceneUnresolvedReason =
  | "invalid-time"
  | "invalid-movement"
  | "missing-path"
  | "unresolved-position"
  | "unresolved-rotation"
  | "unresolved-state";

export type PreviewSceneCompositionResult =
  | { status: "composed"; scene: PreviewSceneState }
  | {
      status: "unresolved";
      reason: PreviewSceneUnresolvedReason;
      objectId?: string;
      stateTrack?: VehicleStateTrackKey;
    };

type PreviewVehicleCompositionResult =
  | { status: "composed"; vehicle: PreviewVehicleState }
  | Extract<PreviewSceneCompositionResult, { status: "unresolved" }>;

interface ResolvedMovementPose {
  x: number;
  y: number;
  rotationDeg: number;
}

function unresolved(
  reason: PreviewSceneUnresolvedReason,
  objectId?: string,
  stateTrack?: VehicleStateTrackKey,
): Extract<PreviewSceneCompositionResult, { status: "unresolved" }> {
  return {
    status: "unresolved",
    reason,
    ...(objectId === undefined ? {} : { objectId }),
    ...(stateTrack === undefined ? {} : { stateTrack }),
  };
}

function hasValidMovementPoints(points: MovementPoint[]): boolean {
  if (points.length === 0 || points[0]?.time !== 0) {
    return false;
  }

  return points.every((point, index) => {
    const previousPoint = points[index - 1];

    return (
      point.id.length > 0 &&
      Number.isFinite(point.time) &&
      Number.isFinite(point.x) &&
      Number.isFinite(point.y) &&
      point.time >= 0 &&
      (previousPoint === undefined || point.time > previousPoint.time)
    );
  });
}

function findPathForPoints(
  movement: VehicleMovement,
  from: MovementPoint,
  to: MovementPoint,
) {
  return movement.paths.find(
    (path) => path.fromPointId === from.id && path.toPointId === to.id,
  );
}

function resolveMovementPose(
  vehicle: VehicleObject,
  currentTime: number,
):
  | { status: "resolved"; pose: ResolvedMovementPose }
  | Extract<PreviewSceneCompositionResult, { status: "unresolved" }> {
  const { movement } = vehicle;
  const { points } = movement;

  if (
    !hasValidMovementPoints(points) ||
    movement.paths.length !== Math.max(0, points.length - 1)
  ) {
    return unresolved("invalid-movement", vehicle.id);
  }

  const firstPoint = points[0]!;
  if (points.length === 1) {
    return {
      status: "resolved",
      pose: { x: firstPoint.x, y: firstPoint.y, rotationDeg: 0 },
    };
  }

  const lastPoint = points[points.length - 1]!;
  const segmentIndex =
    currentTime >= lastPoint.time
      ? points.length - 2
      : points.findIndex(
          (point, index) =>
            index < points.length - 1 &&
            currentTime >= point.time &&
            currentTime < points[index + 1]!.time,
        );

  if (segmentIndex < 0) {
    return unresolved("invalid-movement", vehicle.id);
  }

  const from = points[segmentIndex]!;
  const to = points[segmentIndex + 1]!;
  const path = findPathForPoints(movement, from, to);
  if (!path) {
    return unresolved("missing-path", vehicle.id);
  }

  const progress =
    currentTime >= lastPoint.time
      ? 1
      : (currentTime - from.time) / (to.time - from.time);
  const position = calculatePathPosition(points, path, progress);
  if (
    !position ||
    !Number.isFinite(position.x) ||
    !Number.isFinite(position.y)
  ) {
    return unresolved("unresolved-position", vehicle.id);
  }

  const rotationDeg = calculatePathRotation(points, path, progress);
  if (rotationDeg === undefined || !Number.isFinite(rotationDeg)) {
    return unresolved("unresolved-rotation", vehicle.id);
  }

  return {
    status: "resolved",
    pose: { ...position, rotationDeg },
  };
}

function resolveVehicleStateTrack<K extends VehicleStateTrackKey>(
  tracks: VehicleStateTracks,
  trackKey: K,
  currentTime: number,
): VehicleStateTracks[K]["keyframes"][number]["value"] | undefined {
  return resolveStateValueAtTime(tracks[trackKey], currentTime);
}

function composePreviewVehicleState(
  vehicle: VehicleObject,
  currentTime: number,
): PreviewVehicleCompositionResult {
  const movementResult = resolveMovementPose(vehicle, currentTime);
  if (movementResult.status === "unresolved") {
    return movementResult;
  }

  const indicator = resolveVehicleStateTrack(
    vehicle.stateTracks,
    "indicator",
    currentTime,
  );
  if (indicator === undefined) {
    return unresolved("unresolved-state", vehicle.id, "indicator");
  }

  const brakeLight = resolveVehicleStateTrack(
    vehicle.stateTracks,
    "brakeLight",
    currentTime,
  );
  if (brakeLight === undefined) {
    return unresolved("unresolved-state", vehicle.id, "brakeLight");
  }

  const headlight = resolveVehicleStateTrack(
    vehicle.stateTracks,
    "headlight",
    currentTime,
  );
  if (headlight === undefined) {
    return unresolved("unresolved-state", vehicle.id, "headlight");
  }

  const horn = resolveVehicleStateTrack(
    vehicle.stateTracks,
    "horn",
    currentTime,
  );
  if (horn === undefined) {
    return unresolved("unresolved-state", vehicle.id, "horn");
  }

  return {
    status: "composed",
    vehicle: {
      id: vehicle.id,
      assetId: vehicle.assetId,
      ...movementResult.pose,
      indicator,
      brakeLight,
      headlight,
      horn,
    },
  };
}

export function composePreviewSceneState(
  project: AnimationProject,
  currentTime: number,
): PreviewSceneCompositionResult {
  if (!Number.isFinite(currentTime) || currentTime < 0) {
    return unresolved("invalid-time");
  }

  const vehicles: PreviewVehicleState[] = [];
  for (const vehicle of project.scene.objects) {
    const result = composePreviewVehicleState(vehicle, currentTime);
    if (result.status === "unresolved") {
      return result;
    }

    vehicles.push(result.vehicle);
  }

  return {
    status: "composed",
    scene: {
      width: project.scene.width,
      height: project.scene.height,
      ...(project.scene.background
        ? { backgroundAssetId: project.scene.background.assetId }
        : {}),
      vehicles,
    },
  };
}
