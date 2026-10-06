import type { AnimationProject } from "../model/animation";
import { serializeAnimationProject } from "./projectSerializer";

export const PROJECT_JSON_MIME_TYPE = "application/json;charset=utf-8";

export type ProjectDownloadResult =
  | { status: "downloaded"; filename: string }
  | { status: "invalid"; errors: string[] }
  | { status: "failed"; message: string };

export interface DownloadAnchor {
  download: string;
  hidden: string | boolean;
  href: string;
  click: () => void;
  remove: () => void;
}

export interface ProjectDownloadEnvironment {
  appendAnchor: (anchor: DownloadAnchor) => void;
  createAnchor: () => DownloadAnchor;
  createBlob: (contents: string, mimeType: string) => Blob;
  createObjectUrl: (blob: Blob) => string;
  revokeObjectUrl: (url: string) => void;
}

const browserDownloadEnvironment: ProjectDownloadEnvironment = {
  appendAnchor: (anchor) => document.body.append(anchor as HTMLAnchorElement),
  createAnchor: () => document.createElement("a"),
  createBlob: (contents, mimeType) =>
    new Blob([contents], { type: mimeType }),
  createObjectUrl: (blob) => URL.createObjectURL(blob),
  revokeObjectUrl: (url) => URL.revokeObjectURL(url),
};

export function createProjectFilename(animationId: string): string {
  const safeBase = animationId
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[.\s-]+|[.\s-]+$/g, "");
  const truncated = Array.from(safeBase)
    .slice(0, 100)
    .join("")
    .replace(/[.\s-]+$/g, "");

  return `${truncated || "animation-project"}.json`;
}

export function downloadAnimationProject(
  value: unknown,
  environment: ProjectDownloadEnvironment = browserDownloadEnvironment,
): ProjectDownloadResult {
  const serialization = serializeAnimationProject(value);
  if (serialization.status === "invalid") {
    return serialization;
  }

  let anchor: DownloadAnchor | undefined;
  let objectUrl: string | undefined;

  try {
    const filename = createProjectFilename(
      (value as AnimationProject).animationId,
    );
    const blob = environment.createBlob(
      serialization.json,
      PROJECT_JSON_MIME_TYPE,
    );
    objectUrl = environment.createObjectUrl(blob);
    anchor = environment.createAnchor();
    anchor.href = objectUrl;
    anchor.download = filename;
    anchor.hidden = true;
    environment.appendAnchor(anchor);
    anchor.click();
    return { status: "downloaded", filename };
  } catch {
    return {
      status: "failed",
      message: "Project download could not be started.",
    };
  } finally {
    try {
      anchor?.remove();
    } catch {
      // Download cleanup must not replace the primary result.
    }
    if (objectUrl !== undefined) {
      try {
        environment.revokeObjectUrl(objectUrl);
      } catch {
        // Download cleanup must not replace the primary result.
      }
    }
  }
}
