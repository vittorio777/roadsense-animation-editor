import { getAssetById } from "../assets/assetRegistry";
import type { AnimationProject } from "../model/animation";
import type { VehicleStateTrackKey } from "../model/stateTrack";
import type {
  PreviewAvailability,
  PreviewUnavailableIssue,
} from "../preview/availability";
import { getVehicleDisplayName } from "./vehicleDisplayName";

export interface PreviewPresentation {
  kind: "empty" | "error";
  title: string;
  message: string;
}

const stateTrackLabels: Record<VehicleStateTrackKey, string> = {
  indicator: "indicator",
  brakeLight: "brake light",
  headlight: "headlight",
  horn: "horn",
};

function getSafeVehicleName(
  project: AnimationProject,
  objectId: string | undefined,
): string {
  const index = project.scene.objects.findIndex(
    (vehicle) => vehicle.id === objectId,
  );
  const vehicle = project.scene.objects[index];
  if (!vehicle) {
    return "A vehicle";
  }

  const asset = getAssetById(vehicle.assetId);
  return asset?.type === "vehicle"
    ? getVehicleDisplayName(project.scene.objects, vehicle)
    : `Vehicle ${index + 1}`;
}

function presentCompositionIssue(
  project: AnimationProject,
  issue: Extract<PreviewUnavailableIssue, { kind: "composition" }>,
): PreviewPresentation {
  const vehicleName = getSafeVehicleName(project, issue.objectId);
  const messages = {
    "invalid-time":
      "Choose a valid time on the Timeline to continue previewing.",
    "invalid-movement": `${vehicleName} has incomplete movement data. Check its movement points and paths.`,
    "missing-path": `${vehicleName} is missing a path between movement points. Reconnect the path to continue.`,
    "unresolved-position": `${vehicleName}'s position could not be calculated. Check its path geometry.`,
    "unresolved-rotation": `${vehicleName}'s direction could not be calculated. Check its path geometry.`,
    "unresolved-state": `${vehicleName}'s ${stateTrackLabels[issue.stateTrack ?? "indicator"]} state is incomplete. Check its state track.`,
  } satisfies Record<typeof issue.reason, string>;

  return {
    kind: "error",
    title: "Preview unavailable",
    message: messages[issue.reason],
  };
}

export function presentPreviewAvailability(
  project: AnimationProject,
  availability: PreviewAvailability,
): PreviewPresentation | null {
  if (availability.status === "ready") {
    return null;
  }

  if (availability.status === "empty") {
    return {
      kind: "empty",
      title: "No vehicles in scene",
      message:
        project.scene.background === undefined
          ? "Choose a background and add a vehicle from the Object Library to begin."
          : "Add a vehicle from the Object Library to begin.",
    };
  }

  if (availability.issue.kind === "composition") {
    return presentCompositionIssue(project, availability.issue);
  }

  return {
    kind: "error",
    title: "Preview unavailable",
    message: `${getSafeVehicleName(project, availability.issue.objectId)} uses a vehicle asset that is not available. Choose a registered vehicle asset to continue.`,
  };
}

export function getPreviewPlayUnavailableReason(
  presentation: PreviewPresentation | null,
): string | null {
  return presentation === null
    ? null
    : `${presentation.title}. ${presentation.message}`;
}
