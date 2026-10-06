import { describe, expect, it, vi } from "vitest";

import { createEmptyAnimationProject } from "../src/model/animation";
import { createVehicleObject } from "../src/model/vehicle";
import {
  INVALID_PROJECT_JSON_MESSAGE,
  parseAnimationProjectJson,
  PROJECT_FILE_READ_FAILED_MESSAGE,
  readAnimationProjectFile,
  type ProjectTextFile,
} from "../src/persistence/projectParser";
import { serializeAnimationProject } from "../src/persistence/projectSerializer";
import { validateAnimationProject } from "../src/persistence/projectValidator";
import { useEditorStore } from "../src/store/editorStore";

function createCompleteProject() {
  const project = createEmptyAnimationProject("道路动画-01");
  let id = 0;
  project.scene.background = { assetId: "intersection-01" };
  project.scene.objects.push(
    createVehicleObject({
      assetId: "car-blue-sedan",
      x: -25.5,
      y: 450.75,
      createId: (kind) => `${kind}-${++id}`,
    }),
  );
  return project;
}

describe("F6.4 JSON parsing", () => {
  it("parses Serializer output without changing the Animation Project", () => {
    const project = createCompleteProject();
    const serialization = serializeAnimationProject(project);
    expect(serialization.status).toBe("serialized");
    if (serialization.status !== "serialized") {
      throw new Error(serialization.errors.join(" "));
    }

    const result = parseAnimationProjectJson(serialization.json);

    expect(result).toEqual({ status: "parsed", value: project });
    if (result.status === "parsed") {
      expect(validateAnimationProject(result.value)).toEqual({
        valid: true,
        errors: [],
      });
    }
  });

  it("preserves native JSON values, nesting, escapes and array order", () => {
    const text = JSON.stringify({
      title: "道路 \\\"north\\\"",
      values: [3.25, -4.5, true, false, null, { nested: "路径\\\\A" }],
    });

    expect(parseAnimationProjectJson(text)).toEqual({
      status: "parsed",
      value: {
        title: "道路 \\\"north\\\"",
        values: [
          3.25,
          -4.5,
          true,
          false,
          null,
          { nested: "路径\\\\A" },
        ],
      },
    });
  });

  it.each([
    ["null", null],
    ["true", true],
    ["42.5", 42.5],
    ['"project"', "project"],
    ["[3, 1, 2]", [3, 1, 2]],
    ['{"schemaVersion":99}', { schemaVersion: 99 }],
  ])("keeps syntax-level parsing separate for %s", (text, expected) => {
    const result = parseAnimationProjectJson(text);

    expect(result).toEqual({ status: "parsed", value: expected });
    expect(validateAnimationProject(result.status === "parsed" ? result.value : null).valid).toBe(false);
  });

  it.each(["", "   \n\t", '{"scene":', '{"value":1,}', "[1,2"])(
    "returns a stable result for malformed JSON %j",
    (text) => {
      expect(parseAnimationProjectJson(text)).toEqual({
        status: "invalid-json",
        message: INVALID_PROJECT_JSON_MESSAGE,
      });
    },
  );

  it("reads a selected file exactly once and parses its text", async () => {
    const text = vi.fn(async () => '{"animationId":"file-project"}');

    const result = await readAnimationProjectFile({ text });

    expect(text).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      status: "parsed",
      value: { animationId: "file-project" },
    });
  });

  it("returns the same invalid-json result for malformed file text", async () => {
    const text = vi.fn(async () => "not json");

    const result = await readAnimationProjectFile({ text });

    expect(text).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      status: "invalid-json",
      message: INVALID_PROJECT_JSON_MESSAGE,
    });
  });

  it.each([
    {
      name: "synchronous exception",
      file: {
        text: () => {
          throw new Error("unavailable");
        },
      },
    },
    {
      name: "rejected read",
      file: {
        text: () => Promise.reject(new Error("denied")),
      },
    },
  ])("isolates a $name", async ({ file }) => {
    await expect(
      readAnimationProjectFile(file as ProjectTextFile),
    ).resolves.toEqual({
      status: "read-failed",
      message: PROJECT_FILE_READ_FAILED_MESSAGE,
    });
  });

  it("is deterministic and leaves Editor Store state unchanged", async () => {
    const storeBefore = useEditorStore.getState();
    const text = '{"values":[1,2,3],"label":"stable"}';
    const file = Object.freeze({ text: vi.fn(async () => text) });

    const first = parseAnimationProjectJson(text);
    const second = parseAnimationProjectJson(text);
    const fromFile = await readAnimationProjectFile(file);

    expect(second).toEqual(first);
    expect(fromFile).toEqual(first);
    expect(file.text).toHaveBeenCalledTimes(1);
    expect(useEditorStore.getState()).toBe(storeBefore);
  });
});
