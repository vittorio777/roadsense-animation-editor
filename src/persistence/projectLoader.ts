import {
  resolveAnimationProjectAssets,
  type ProjectAssetResolutionError,
  type ResolvedProjectAssets,
} from "../assets/projectAssetResolver";
import type { AnimationProject } from "../model/animation";
import {
  readAnimationProjectFile,
  type ProjectFileReadResult,
  type ProjectTextFile,
} from "./projectParser";
import {
  validateAnimationProject,
  type ValidationResult,
} from "./projectValidator";

export type ProjectLoadPreparationResult =
  | {
      status: "ready";
      project: AnimationProject;
      assets: ResolvedProjectAssets;
    }
  | Exclude<ProjectFileReadResult, { status: "parsed" }>
  | { status: "invalid-project"; errors: string[] }
  | {
      status: "unresolved-assets";
      errors: ProjectAssetResolutionError[];
    };

export type ProjectLoadFailure = Exclude<
  ProjectLoadPreparationResult,
  { status: "ready" }
>;

export interface ProjectLoadDependencies {
  readFile: (file: ProjectTextFile) => Promise<ProjectFileReadResult>;
  resolveAssets: typeof resolveAnimationProjectAssets;
  validateProject: (value: unknown) => ValidationResult;
}

const defaultDependencies: ProjectLoadDependencies = {
  readFile: readAnimationProjectFile,
  resolveAssets: resolveAnimationProjectAssets,
  validateProject: validateAnimationProject,
};

export async function prepareAnimationProjectFile(
  file: ProjectTextFile,
  dependencies: ProjectLoadDependencies = defaultDependencies,
): Promise<ProjectLoadPreparationResult> {
  const fileResult = await dependencies.readFile(file);
  if (fileResult.status !== "parsed") {
    return fileResult;
  }

  const validation = dependencies.validateProject(fileResult.value);
  if (!validation.valid) {
    return { status: "invalid-project", errors: validation.errors };
  }

  const project = fileResult.value as AnimationProject;
  const assetResolution = dependencies.resolveAssets(project);
  if (assetResolution.status === "unresolved") {
    return {
      status: "unresolved-assets",
      errors: assetResolution.errors,
    };
  }

  return {
    status: "ready",
    project,
    assets: assetResolution.assets,
  };
}
