import type { VehicleObject } from "./vehicle";

export interface BackgroundReference {
  assetId: string;
}

export type SceneObject = VehicleObject;

export interface Scene {
  width: number;
  height: number;
  background?: BackgroundReference;
  objects: SceneObject[];
}
