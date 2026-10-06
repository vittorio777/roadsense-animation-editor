import { getAssetById } from "../assets/assetRegistry";
import type { VehicleObject } from "../model/vehicle";

export function getVehicleDisplayName(
  vehicles: readonly VehicleObject[],
  vehicle: VehicleObject,
): string {
  const asset = getAssetById(vehicle.assetId);
  const baseName = asset?.name ?? `Unknown vehicle (${vehicle.assetId})`;
  const matchingVehicles = vehicles.filter(
    (candidate) => candidate.assetId === vehicle.assetId,
  );

  if (matchingVehicles.length <= 1) {
    return baseName;
  }

  const ordinal =
    matchingVehicles.findIndex((candidate) => candidate.id === vehicle.id) + 1;

  return `${baseName} ${ordinal} of ${matchingVehicles.length}`;
}
