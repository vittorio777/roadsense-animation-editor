import type { ProjectLoadFailure } from "./projectLoader";

export interface ProjectLoadErrorPresentation {
  title: "Project could not be loaded";
  summary: string;
  details: string[];
}

export function presentProjectLoadFailure(
  failure: ProjectLoadFailure,
): ProjectLoadErrorPresentation {
  switch (failure.status) {
    case "read-failed":
      return {
        title: "Project could not be loaded",
        summary: "The selected file could not be read.",
        details: [failure.message],
      };
    case "invalid-json":
      return {
        title: "Project could not be loaded",
        summary: "The selected file is not valid JSON.",
        details: [failure.message],
      };
    case "invalid-project":
      return {
        title: "Project could not be loaded",
        summary:
          "The selected file does not match the RoadSense project format.",
        details: [...failure.errors],
      };
    case "unresolved-assets":
      return {
        title: "Project could not be loaded",
        summary: "Some assets referenced by the project are unavailable.",
        details: failure.errors.map(
          (error) => `${error.message} (${error.path})`,
        ),
      };
  }
}
