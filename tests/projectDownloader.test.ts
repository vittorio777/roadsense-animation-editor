import { describe, expect, it, vi } from "vitest";

import { createEmptyAnimationProject } from "../src/model/animation";
import {
  createProjectFilename,
  downloadAnimationProject,
  PROJECT_JSON_MIME_TYPE,
  type DownloadAnchor,
  type ProjectDownloadEnvironment,
} from "../src/persistence/projectDownloader";
import { serializeAnimationProject } from "../src/persistence/projectSerializer";

interface DownloadHarness {
  anchor: DownloadAnchor;
  appendedAnchors: DownloadAnchor[];
  blobContents: string[];
  blobTypes: string[];
  environment: ProjectDownloadEnvironment;
  objectUrls: string[];
  revokedUrls: string[];
}

function createDownloadHarness(options?: { clickError?: Error }): DownloadHarness {
  const blobContents: string[] = [];
  const blobTypes: string[] = [];
  const objectUrls: string[] = [];
  const revokedUrls: string[] = [];
  const appendedAnchors: DownloadAnchor[] = [];
  const anchor: DownloadAnchor = {
    download: "",
    hidden: false,
    href: "",
    click: vi.fn(() => {
      if (options?.clickError) {
        throw options.clickError;
      }
    }),
    remove: vi.fn(),
  };
  const environment: ProjectDownloadEnvironment = {
    appendAnchor: vi.fn((nextAnchor) => appendedAnchors.push(nextAnchor)),
    createAnchor: vi.fn(() => anchor),
    createBlob: vi.fn((contents, mimeType) => {
      blobContents.push(contents);
      blobTypes.push(mimeType);
      return new Blob([contents], { type: mimeType });
    }),
    createObjectUrl: vi.fn(() => {
      const url = `blob:project-${objectUrls.length + 1}`;
      objectUrls.push(url);
      return url;
    }),
    revokeObjectUrl: vi.fn((url) => revokedUrls.push(url)),
  };

  return {
    anchor,
    appendedAnchors,
    blobContents,
    blobTypes,
    environment,
    objectUrls,
    revokedUrls,
  };
}

describe("F6.3 project download", () => {
  it.each([
    ["animation-01", "animation-01.json"],
    ["  My Project  ", "My-Project.json"],
    ["道路 / 场景:*?", "道路-场景.json"],
    ["folder\\project/name", "folder-project-name.json"],
    ["....***", "animation-project.json"],
  ])("creates a safe filename from %j", (animationId, expected) => {
    expect(createProjectFilename(animationId)).toBe(expected);
  });

  it("limits the filename base to 100 Unicode characters", () => {
    const filename = createProjectFilename("路".repeat(120));

    expect(Array.from(filename.slice(0, -".json".length))).toHaveLength(100);
    expect(filename.endsWith(".json")).toBe(true);
  });

  it("downloads the exact Serializer bytes and cleans browser resources", () => {
    const project = createEmptyAnimationProject("animation-01");
    const harness = createDownloadHarness();
    const serialized = serializeAnimationProject(project);

    const result = downloadAnimationProject(project, harness.environment);

    expect(result).toEqual({
      status: "downloaded",
      filename: "animation-01.json",
    });
    expect(serialized.status).toBe("serialized");
    if (serialized.status === "serialized") {
      expect(harness.blobContents).toEqual([serialized.json]);
    }
    expect(harness.blobTypes).toEqual([PROJECT_JSON_MIME_TYPE]);
    expect(harness.objectUrls).toEqual(["blob:project-1"]);
    expect(harness.appendedAnchors).toEqual([harness.anchor]);
    expect(harness.anchor).toMatchObject({
      download: "animation-01.json",
      hidden: true,
      href: "blob:project-1",
    });
    expect(harness.anchor.click).toHaveBeenCalledTimes(1);
    expect(harness.anchor.remove).toHaveBeenCalledTimes(1);
    expect(harness.revokedUrls).toEqual(["blob:project-1"]);
  });

  it("does not create browser resources for invalid Animation Data", () => {
    const project = createEmptyAnimationProject();
    Object.assign(project, { currentTime: 4 });
    const harness = createDownloadHarness();

    const result = downloadAnimationProject(project, harness.environment);

    expect(result).toEqual({
      status: "invalid",
      errors: ["Project contains unknown field currentTime."],
    });
    expect(harness.blobContents).toEqual([]);
    expect(harness.objectUrls).toEqual([]);
    expect(harness.appendedAnchors).toEqual([]);
    expect(harness.anchor.click).not.toHaveBeenCalled();
    expect(harness.anchor.remove).not.toHaveBeenCalled();
  });

  it("returns a browser failure and still removes the anchor and URL", () => {
    const project = createEmptyAnimationProject();
    const harness = createDownloadHarness({ clickError: new Error("blocked") });

    const result = downloadAnimationProject(project, harness.environment);

    expect(result).toEqual({
      status: "failed",
      message: "Project download could not be started.",
    });
    expect(harness.anchor.remove).toHaveBeenCalledTimes(1);
    expect(harness.revokedUrls).toEqual(["blob:project-1"]);
  });

  it("performs and cleans one independent download per invocation", () => {
    const project = createEmptyAnimationProject("repeatable");
    const harness = createDownloadHarness();

    const first = downloadAnimationProject(project, harness.environment);
    const second = downloadAnimationProject(project, harness.environment);

    expect(first).toEqual(second);
    expect(harness.environment.createAnchor).toHaveBeenCalledTimes(2);
    expect(harness.anchor.click).toHaveBeenCalledTimes(2);
    expect(harness.anchor.remove).toHaveBeenCalledTimes(2);
    expect(harness.objectUrls).toEqual(["blob:project-1", "blob:project-2"]);
    expect(harness.revokedUrls).toEqual(["blob:project-1", "blob:project-2"]);
    expect(harness.blobContents[0]).toBe(harness.blobContents[1]);
  });
});
