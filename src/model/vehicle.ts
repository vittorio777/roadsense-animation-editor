import { createMovementPoint, type VehicleMovement } from "./movement";
import {
  createInitialVehicleStateTracks,
  type VehicleStateKeyframeKind,
  type VehicleStateTracks,
} from "./stateTrack";

export interface VehicleObject {
  id: string;
  type: "vehicle";
  assetId: string;
  movement: VehicleMovement;
  stateTracks: VehicleStateTracks;
}

type VehicleEntityKind =
  | "vehicle"
  | "movement-point"
  | VehicleStateKeyframeKind;

type CreateEntityId = (kind: VehicleEntityKind) => string;

export interface CreateVehicleObjectOptions {
  assetId: string;
  x: number;
  y: number;
  createId?: CreateEntityId;
}

export interface VehicleSpawnPosition {
  x: number;
  y: number;
}

const VEHICLES_PER_SPAWN_ROW = 5;

function centerOutOffset(index: number): number {
  if (index === 0) {
    return 0;
  }

  const distance = Math.ceil(index / 2);
  return index % 2 === 1 ? distance : -distance;
}

export function calculateVehicleSpawnPosition(
  sceneWidth: number,
  sceneHeight: number,
  instanceIndex: number,
): VehicleSpawnPosition {
  const safeIndex = Number.isFinite(instanceIndex)
    ? Math.max(0, Math.floor(instanceIndex))
    : 0;
  const column = safeIndex % VEHICLES_PER_SPAWN_ROW;
  const row = Math.floor(safeIndex / VEHICLES_PER_SPAWN_ROW);
  const xFraction = Math.min(
    0.9,
    Math.max(0.1, 0.5 + centerOutOffset(column) * 0.1),
  );
  const yFraction = Math.min(
    0.9,
    Math.max(0.1, 0.5 + centerOutOffset(row) * 0.15),
  );

  return {
    x: sceneWidth * xFraction,
    y: sceneHeight * yFraction,
  };
}

const createEntityId: CreateEntityId = (kind) =>
  `${kind}-${crypto.randomUUID()}`;

export function createVehicleObject({
  assetId,
  x,
  y,
  createId = createEntityId,
}: CreateVehicleObjectOptions): VehicleObject {
  return {
    id: createId("vehicle"),
    type: "vehicle",
    assetId,
    movement: {
      points: [
        createMovementPoint({
          time: 0,
          x,
          y,
          createId: () => createId("movement-point"),
        }),
      ],
      paths: [],
    },
    stateTracks: createInitialVehicleStateTracks({ createId }),
  };
}
