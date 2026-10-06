export type AssetType = "background" | "vehicle";

interface AssetDefinitionBase {
  id: string;
  src: string;
  name: string;
  width: number;
  height: number;
}

export interface BackgroundAssetDefinition extends AssetDefinitionBase {
  type: "background";
}

export interface VehicleLampAnchor {
  x: number;
  y: number;
  radius: number;
}

export interface VehicleLightRig {
  indicatorFrontLeft: VehicleLampAnchor;
  indicatorRearLeft: VehicleLampAnchor;
  indicatorFrontRight: VehicleLampAnchor;
  indicatorRearRight: VehicleLampAnchor;
  brakeLeft: VehicleLampAnchor;
  brakeRight: VehicleLampAnchor;
  headlightLeft: VehicleLampAnchor;
  headlightRight: VehicleLampAnchor;
  headlightBeamLength: number;
  headlightBeamSpread: number;
}

export interface VehicleVisualDefinition {
  forwardDeg: number;
  lights: VehicleLightRig;
}

export interface VehicleAssetDefinition extends AssetDefinitionBase {
  type: "vehicle";
  visual: VehicleVisualDefinition;
}

export type AssetDefinition =
  | BackgroundAssetDefinition
  | VehicleAssetDefinition;

const lampAnchorKeys = [
  "indicatorFrontLeft",
  "indicatorRearLeft",
  "indicatorFrontRight",
  "indicatorRearRight",
  "brakeLeft",
  "brakeRight",
  "headlightLeft",
  "headlightRight",
] as const satisfies readonly (keyof VehicleLightRig)[];

export function isValidVehicleVisualDefinition(
  visual: VehicleVisualDefinition,
): boolean {
  if (!Number.isFinite(visual.forwardDeg)) {
    return false;
  }

  for (const key of lampAnchorKeys) {
    const anchor = visual.lights[key];
    if (
      typeof anchor !== "object" ||
      !Number.isFinite(anchor.x) ||
      !Number.isFinite(anchor.y) ||
      !Number.isFinite(anchor.radius) ||
      anchor.radius <= 0
    ) {
      return false;
    }
  }

  return Number.isFinite(visual.lights.headlightBeamLength) &&
    visual.lights.headlightBeamLength > 0 &&
    Number.isFinite(visual.lights.headlightBeamSpread) &&
    visual.lights.headlightBeamSpread > 0;
}

function defineVehicleAsset(
  asset: VehicleAssetDefinition,
): VehicleAssetDefinition {
  if (!isValidVehicleVisualDefinition(asset.visual)) {
    throw new Error(`Invalid Vehicle visual definition: ${asset.id}.`);
  }

  return asset;
}

export const assetDefinitions: readonly AssetDefinition[] = [
  {
    id: "intersection-01",
    type: "background",
    src: "/assets/backgrounds/intersection-01.svg",
    name: "Foundation intersection",
    width: 1600,
    height: 900,
  },
  defineVehicleAsset({
    id: "car-blue-sedan",
    type: "vehicle",
    src: "/assets/vehicles/car-blue-sedan.svg",
    name: "Car Blue Sedan",
    width: 120,
    height: 72,
    visual: {
      forwardDeg: 0,
      lights: {
        indicatorFrontLeft: { x: 52, y: -20, radius: 2.8 },
        indicatorRearLeft: { x: -52, y: -19, radius: 2.8 },
        indicatorFrontRight: { x: 52, y: 20, radius: 2.8 },
        indicatorRearRight: { x: -52, y: 19, radius: 2.8 },
        brakeLeft: { x: -52, y: -12, radius: 3.2 },
        brakeRight: { x: -52, y: 12, radius: 3.2 },
        headlightLeft: { x: 52, y: -14, radius: 3.2 },
        headlightRight: { x: 52, y: 14, radius: 3.2 },
        headlightBeamLength: 36,
        headlightBeamSpread: 8,
      },
    },
  }),
  defineVehicleAsset({
    id: "car-blue-sport",
    type: "vehicle",
    src: "/assets/vehicles/car-blue-sport.svg",
    name: "Car Blue Sport",
    width: 120,
    height: 72,
    visual: {
      forwardDeg: 0,
      lights: {
        indicatorFrontLeft: { x: 51, y: -21, radius: 2.6 },
        indicatorRearLeft: { x: -52, y: -20, radius: 3 },
        indicatorFrontRight: { x: 51, y: 21, radius: 2.6 },
        indicatorRearRight: { x: -52, y: 20, radius: 3 },
        brakeLeft: { x: -52, y: -15, radius: 3.4 },
        brakeRight: { x: -52, y: 15, radius: 3.4 },
        headlightLeft: { x: 52, y: -16, radius: 3.2 },
        headlightRight: { x: 52, y: 16, radius: 3.2 },
        headlightBeamLength: 38,
        headlightBeamSpread: 9,
      },
    },
  }),
];

const assetsById = new Map(assetDefinitions.map((asset) => [asset.id, asset]));

export function getAssetById(assetId: string): AssetDefinition | undefined {
  return assetsById.get(assetId);
}

export function getAssetsByType(
  type: "background",
): readonly BackgroundAssetDefinition[];
export function getAssetsByType(
  type: "vehicle",
): readonly VehicleAssetDefinition[];
export function getAssetsByType(type: AssetType): readonly AssetDefinition[];
export function getAssetsByType(type: AssetType): readonly AssetDefinition[] {
  return assetDefinitions.filter((asset) => asset.type === type);
}

export function hasAsset(assetId: string, expectedType?: AssetType): boolean {
  const asset = getAssetById(assetId);
  return asset !== undefined &&
    (expectedType === undefined || asset.type === expectedType);
}
