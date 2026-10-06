import {
  getAssetById,
  type AssetDefinition,
  type AssetType,
} from "./assetRegistry";
import type { AnimationProject } from "../model/animation";

export type AssetResolutionFailureReason = "missing" | "type-mismatch";

export interface ProjectAssetResolutionError {
  path: string;
  assetId: string;
  expectedType: AssetType;
  reason: AssetResolutionFailureReason;
  message: string;
}

export type AssetReferenceResolution =
  | { status: "resolved"; asset: AssetDefinition }
  | { status: "unresolved"; error: ProjectAssetResolutionError };

export interface ResolvedProjectAssets {
  background?: AssetDefinition;
  vehicles: Array<{
    objectId: string;
    asset: AssetDefinition;
  }>;
}

export type ProjectAssetResolutionResult =
  | { status: "resolved"; assets: ResolvedProjectAssets }
  | { status: "unresolved"; errors: ProjectAssetResolutionError[] };

function createResolutionError(
  path: string,
  assetId: string,
  expectedType: AssetType,
  reason: AssetResolutionFailureReason,
): ProjectAssetResolutionError {
  return {
    path,
    assetId,
    expectedType,
    reason,
    message: `Unknown ${expectedType} assetId: ${assetId}.`,
  };
}

export function resolveAssetReference(
  assetId: string,
  expectedType: AssetType,
  path: string,
): AssetReferenceResolution {
  const asset = getAssetById(assetId);
  if (asset === undefined) {
    return {
      status: "unresolved",
      error: createResolutionError(path, assetId, expectedType, "missing"),
    };
  }
  if (asset.type !== expectedType) {
    return {
      status: "unresolved",
      error: createResolutionError(
        path,
        assetId,
        expectedType,
        "type-mismatch",
      ),
    };
  }

  return { status: "resolved", asset };
}

export function resolveAnimationProjectAssets(
  project: AnimationProject,
): ProjectAssetResolutionResult {
  const errors: ProjectAssetResolutionError[] = [];
  let background: AssetDefinition | undefined;

  if (project.scene.background !== undefined) {
    const result = resolveAssetReference(
      project.scene.background.assetId,
      "background",
      "scene.background.assetId",
    );
    if (result.status === "resolved") {
      background = result.asset;
    } else {
      errors.push(result.error);
    }
  }

  const vehicles: ResolvedProjectAssets["vehicles"] = [];
  for (const [index, object] of project.scene.objects.entries()) {
    const result = resolveAssetReference(
      object.assetId,
      "vehicle",
      `scene.objects[${index}].assetId`,
    );
    if (result.status === "resolved") {
      vehicles.push({ objectId: object.id, asset: result.asset });
    } else {
      errors.push(result.error);
    }
  }

  if (errors.length > 0) {
    return { status: "unresolved", errors };
  }

  return {
    status: "resolved",
    assets:
      background === undefined
        ? { vehicles }
        : { background, vehicles },
  };
}
