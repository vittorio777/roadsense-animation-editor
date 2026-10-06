import { getAssetById } from "../assets/assetRegistry";
import type { AnimationProject } from "../model/animation";
import type { VehicleStateTrackKey } from "../model/stateTrack";
import {
  composePreviewSceneState,
  type PreviewSceneState,
  type PreviewSceneUnresolvedReason,
} from "./sceneState";

export type PreviewUnavailableIssue =
  | {
      kind: "composition";
      reason: PreviewSceneUnresolvedReason;
      objectId?: string;
      stateTrack?: VehicleStateTrackKey;
    }
  | {
      kind: "vehicle-asset";
      objectId: string;
      assetId: string;
    };

export type PreviewAvailability =
  | { status: "empty"; scene: PreviewSceneState }
  | { status: "ready"; scene: PreviewSceneState }
  | { status: "unavailable"; issue: PreviewUnavailableIssue };

export function resolvePreviewAvailability(
  project: AnimationProject,
  currentTime: number,
): PreviewAvailability {
  const composition = composePreviewSceneState(project, currentTime);
  if (composition.status === "unresolved") {
    return {
      status: "unavailable",
      issue: {
        kind: "composition",
        reason: composition.reason,
        ...(composition.objectId === undefined
          ? {}
          : { objectId: composition.objectId }),
        ...(composition.stateTrack === undefined
          ? {}
          : { stateTrack: composition.stateTrack }),
      },
    };
  }

  if (composition.scene.vehicles.length === 0) {
    return { status: "empty", scene: composition.scene };
  }

  for (const vehicle of composition.scene.vehicles) {
    const asset = getAssetById(vehicle.assetId);
    if (asset?.type !== "vehicle") {
      return {
        status: "unavailable",
        issue: {
          kind: "vehicle-asset",
          objectId: vehicle.id,
          assetId: vehicle.assetId,
        },
      };
    }
  }

  return { status: "ready", scene: composition.scene };
}
