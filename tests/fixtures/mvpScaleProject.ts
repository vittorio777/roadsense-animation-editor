import type { AnimationProject } from "../../src/model/animation";
import type { MovementPoint } from "../../src/model/movement";
import type { PathSegment } from "../../src/model/path";
import type {
  IndicatorState,
  StateKeyframe,
  StateTrack,
  VehicleStateTracks,
} from "../../src/model/stateTrack";
import type { VehicleObject } from "../../src/model/vehicle";

export const MVP_SCALE_DURATION_SECONDS = 60;
export const MVP_SCALE_VEHICLE_COUNT = 5;
export const MVP_SCALE_MOVEMENT_POINT_COUNT = 20;
export const MVP_SCALE_PATH_COUNT = MVP_SCALE_MOVEMENT_POINT_COUNT - 1;
export const MVP_SCALE_KEYFRAME_COUNT = 20;
export const MVP_SCALE_STATE_TRACK_COUNT = 4;

const vehicleAssetIds = ["car-blue-sedan", "car-blue-sport"] as const;
const verticalOffsets = [
  -24, 12, 38, 4, -32, -8, 30, 18, -18, -38,
  -2, 34, 22, -26, -10, 28, 8, -34, -16, 20,
] as const;

function scaleTime(index: number): number {
  if (index === MVP_SCALE_MOVEMENT_POINT_COUNT - 1) {
    return MVP_SCALE_DURATION_SECONDS;
  }

  return Number(
    ((index * MVP_SCALE_DURATION_SECONDS) /
      (MVP_SCALE_MOVEMENT_POINT_COUNT - 1)).toFixed(6),
  );
}

function createMovementPoints(vehicleIndex: number): MovementPoint[] {
  const travelsRight = vehicleIndex % 2 === 0;
  const baseY = 150 + vehicleIndex * 145;

  return Array.from(
    { length: MVP_SCALE_MOVEMENT_POINT_COUNT },
    (_, pointIndex) => {
      const xOffset = pointIndex * 68;
      return {
        id: `scale-vehicle-${vehicleIndex + 1}-point-${pointIndex + 1}`,
        time: scaleTime(pointIndex),
        x: travelsRight ? 120 + xOffset : 1480 - xOffset,
        y: baseY + verticalOffsets[pointIndex]!,
      };
    },
  );
}

function interpolate(from: number, to: number, progress: number): number {
  return Number((from + (to - from) * progress).toFixed(6));
}

function createPaths(
  vehicleIndex: number,
  points: MovementPoint[],
): PathSegment[] {
  return points.slice(0, -1).map((from, pathIndex) => {
    const to = points[pathIndex + 1]!;
    return {
      id: `scale-vehicle-${vehicleIndex + 1}-path-${pathIndex + 1}`,
      fromPointId: from.id,
      toPointId: to.id,
      type: "cubicBezier",
      control1: {
        x: interpolate(from.x, to.x, 1 / 3),
        y: interpolate(from.y, to.y, 1 / 3),
      },
      control2: {
        x: interpolate(from.x, to.x, 2 / 3),
        y: interpolate(from.y, to.y, 2 / 3),
      },
    };
  });
}

function createTrack<T>(
  vehicleIndex: number,
  trackName: string,
  valueAt: (keyframeIndex: number) => T,
): StateTrack<T> {
  return {
    keyframes: Array.from(
      { length: MVP_SCALE_KEYFRAME_COUNT },
      (_, keyframeIndex): StateKeyframe<T> => ({
        id: `scale-vehicle-${vehicleIndex + 1}-${trackName}-${keyframeIndex + 1}`,
        time: scaleTime(keyframeIndex),
        value: valueAt(keyframeIndex),
      }),
    ),
  };
}

function indicatorValueAt(keyframeIndex: number): IndicatorState {
  if (keyframeIndex === 0) {
    return "off";
  }

  return ["left", "off", "right", "off", "hazard", "off"][
    (keyframeIndex - 1) % 6
  ] as IndicatorState;
}

function booleanValueAt(
  keyframeIndex: number,
  vehicleIndex: number,
  trackOffset: number,
): boolean {
  return (
    keyframeIndex !== 0 &&
    (keyframeIndex + vehicleIndex + trackOffset) % 2 === 0
  );
}

function createStateTracks(vehicleIndex: number): VehicleStateTracks {
  return {
    indicator: createTrack(vehicleIndex, "indicator", indicatorValueAt),
    brakeLight: createTrack(vehicleIndex, "brake", (keyframeIndex) =>
      booleanValueAt(keyframeIndex, vehicleIndex, 0),
    ),
    headlight: createTrack(vehicleIndex, "headlight", (keyframeIndex) =>
      booleanValueAt(keyframeIndex, vehicleIndex, 1),
    ),
    horn: createTrack(vehicleIndex, "horn", (keyframeIndex) =>
      booleanValueAt(keyframeIndex, vehicleIndex, 2),
    ),
  };
}

function createVehicle(vehicleIndex: number): VehicleObject {
  const points = createMovementPoints(vehicleIndex);
  return {
    id: `scale-vehicle-${vehicleIndex + 1}`,
    type: "vehicle",
    assetId: vehicleAssetIds[vehicleIndex % vehicleAssetIds.length]!,
    movement: {
      points,
      paths: createPaths(vehicleIndex, points),
    },
    stateTracks: createStateTracks(vehicleIndex),
  };
}

export function createMvpScaleProject(): AnimationProject {
  return {
    schemaVersion: 1,
    animationId: "phase-7-mvp-scale",
    scene: {
      width: 1600,
      height: 900,
      background: { assetId: "intersection-01" },
      objects: Array.from(
        { length: MVP_SCALE_VEHICLE_COUNT },
        (_, vehicleIndex) => createVehicle(vehicleIndex),
      ),
    },
  };
}
