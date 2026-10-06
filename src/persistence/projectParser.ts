export const INVALID_PROJECT_JSON_MESSAGE =
  "Project file is not valid JSON.";
export const PROJECT_FILE_READ_FAILED_MESSAGE =
  "Project file could not be read.";

export type ProjectJsonParseResult =
  | { status: "parsed"; value: unknown }
  | { status: "invalid-json"; message: string };

export type ProjectFileReadResult =
  | ProjectJsonParseResult
  | { status: "read-failed"; message: string };

export interface ProjectTextFile {
  text: () => Promise<string>;
}

export function parseAnimationProjectJson(
  text: string,
): ProjectJsonParseResult {
  try {
    return { status: "parsed", value: JSON.parse(text) as unknown };
  } catch {
    return {
      status: "invalid-json",
      message: INVALID_PROJECT_JSON_MESSAGE,
    };
  }
}

export async function readAnimationProjectFile(
  file: ProjectTextFile,
): Promise<ProjectFileReadResult> {
  let text: string;

  try {
    text = await file.text();
  } catch {
    return {
      status: "read-failed",
      message: PROJECT_FILE_READ_FAILED_MESSAGE,
    };
  }

  return parseAnimationProjectJson(text);
}
