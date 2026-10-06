import { describe, expect, it } from "vitest";

import {
  createEmptyAnimationProject,
  type AnimationProject,
} from "../src/model/animation";
import type { VehicleObject } from "../src/model/vehicle";
import {
  serializeAnimationProject,
  type ProjectSerializationResult,
} from "../src/persistence/projectSerializer";
import { validateAnimationProject } from "../src/persistence/projectValidator";

function createVehicle(prefix: string, offset: number): VehicleObject {
  return {
    id: `${prefix}-vehicle`,
    type: "vehicle",
    assetId: "car-blue-sedan",
    movement: {
      points: [
        { id: `${prefix}-point-0`, time: 0, x: offset - 25.5, y: 450 },
        { id: `${prefix}-point-2`, time: 2.25, x: offset + 200, y: 350.75 },
        { id: `${prefix}-point-6`, time: 6, x: offset + 425, y: 500 },
      ],
      paths: [
        {
          id: `${prefix}-path-0-2`,
          fromPointId: `${prefix}-point-0`,
          toPointId: `${prefix}-point-2`,
          type: "cubicBezier",
          control1: { x: offset + 40, y: 420 },
          control2: { x: offset + 160, y: 380 },
        },
        {
          id: `${prefix}-path-2-6`,
          fromPointId: `${prefix}-point-2`,
          toPointId: `${prefix}-point-6`,
          type: "cubicBezier",
          control1: { x: offset + 260, y: 375 },
          control2: { x: offset + 365, y: 475 },
        },
      ],
    },
    stateTracks: {
      indicator: {
        keyframes: [
          { id: `${prefix}-indicator-0`, time: 0, value: "off" },
          { id: `${prefix}-indicator-2`, time: 2.25, value: "right" },
          { id: `${prefix}-indicator-6`, time: 6, value: "hazard" },
        ],
      },
      brakeLight: {
        keyframes: [
          { id: `${prefix}-brake-0`, time: 0, value: false },
          { id: `${prefix}-brake-4`, time: 4.5, value: true },
        ],
      },
      headlight: {
        keyframes: [
          { id: `${prefix}-headlight-0`, time: 0, value: false },
          { id: `${prefix}-headlight-1`, time: 1.5, value: true },
        ],
      },
      horn: {
        keyframes: [
          { id: `${prefix}-horn-0`, time: 0, value: false },
          { id: `${prefix}-horn-5`, time: 5, value: true },
        ],
      },
    },
  };
}

function createCompleteProject(): AnimationProject {
  const secondVehicle = createVehicle("第二辆-\\\"", 900);
  secondVehicle.movement.points.splice(1);
  secondVehicle.movement.paths = [];
  for (const track of Object.values(secondVehicle.stateTracks)) {
    track.keyframes.splice(1);
  }

  return {
    schemaVersion: 1,
    animationId: "道路动画-\\\"01",
    scene: {
      width: 1600,
      height: 900,
      background: { assetId: "intersection-01" },
      objects: [createVehicle("first", 200), secondVehicle],
    },
  };
}

function expectSerialized(
  result: ProjectSerializationResult,
): asserts result is Extract<
  ProjectSerializationResult,
  { status: "serialized" }
> {
  expect(result.status).toBe("serialized");
  if (result.status !== "serialized") {
    throw new Error(
      `Expected serialization success: ${result.errors.join(", ")}`,
    );
  }
}

function deepFreeze(value: unknown): unknown {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) {
    return value;
  }
  Object.freeze(value);
  for (const child of Object.values(value)) {
    deepFreeze(child);
  }
  return value;
}

describe("F6.2 JSON serialization", () => {
  it("serializes an empty Project with exact stable formatting", () => {
    const result = serializeAnimationProject(
      createEmptyAnimationProject("animation-01"),
    );

    expect(result).toEqual({
      status: "serialized",
      json: [
        "{",
        '  "schemaVersion": 1,',
        '  "animationId": "animation-01",',
        '  "scene": {',
        '    "width": 1600,',
        '    "height": 900,',
        '    "objects": []',
        "  }",
        "}",
        "",
      ].join("\n"),
    });
  });

  it("serializes every field of a complete Project and parses equivalently", () => {
    const project = createCompleteProject();
    const result = serializeAnimationProject(project);
    expectSerialized(result);

    const parsed: unknown = JSON.parse(result.json);
    expect(parsed).toEqual(project);
    expect(validateAnimationProject(parsed)).toEqual({ valid: true, errors: [] });
    expect(result.json).not.toContain("currentTime");
    expect(result.json).not.toContain("selection");
    expect(result.json).not.toContain("intervals");
    expect(result.json).not.toContain("src");
    expect(result.json).not.toContain("Foundation intersection");
  });

  it("uses canonical object ordering regardless of insertion order", () => {
    const project = createCompleteProject();
    const reordered = {
      scene: {
        objects: project.scene.objects.map((vehicle) => ({
          stateTracks: {
            horn: vehicle.stateTracks.horn,
            headlight: vehicle.stateTracks.headlight,
            brakeLight: vehicle.stateTracks.brakeLight,
            indicator: vehicle.stateTracks.indicator,
          },
          movement: {
            paths: vehicle.movement.paths,
            points: vehicle.movement.points,
          },
          assetId: vehicle.assetId,
          type: vehicle.type,
          id: vehicle.id,
        })),
        background: project.scene.background,
        height: project.scene.height,
        width: project.scene.width,
      },
      animationId: project.animationId,
      schemaVersion: project.schemaVersion,
    };

    expect(serializeAnimationProject(reordered)).toEqual(
      serializeAnimationProject(project),
    );
  });

  it("preserves every array order without sorting", () => {
    const project = createCompleteProject();
    project.scene.objects.reverse();
    project.scene.objects[1]!.movement.paths.reverse();

    const result = serializeAnimationProject(project);
    expectSerialized(result);
    const parsed = JSON.parse(result.json) as AnimationProject;

    expect(parsed.scene.objects.map((vehicle) => vehicle.id)).toEqual(
      project.scene.objects.map((vehicle) => vehicle.id),
    );
    expect(
      parsed.scene.objects[1]!.movement.paths.map((path) => path.id),
    ).toEqual(project.scene.objects[1]!.movement.paths.map((path) => path.id));
    expect(
      parsed.scene.objects[1]!.stateTracks.indicator.keyframes.map(
        (keyframe) => keyframe.id,
      ),
    ).toEqual(
      project.scene.objects[1]!.stateTracks.indicator.keyframes.map(
        (keyframe) => keyframe.id,
      ),
    );
  });

  it("preserves Unicode, escaped strings, decimals and negative coordinates", () => {
    const project = createCompleteProject();
    project.scene.objects[0]!.movement.points[0]!.x = -25.5;
    const result = serializeAnimationProject(project);
    expectSerialized(result);

    const parsed = JSON.parse(result.json) as AnimationProject;
    expect(parsed.animationId).toBe(project.animationId);
    expect(parsed.scene.objects[1]!.id).toBe(project.scene.objects[1]!.id);
    expect(parsed.scene.objects[0]!.movement.points[0]!.x).toBe(-25.5);
    expect(parsed.scene.objects[0]!.movement.points[1]!.time).toBe(2.25);
  });

  it("rejects invalid data with Validator errors and no partial JSON", () => {
    const project = createCompleteProject();
    Object.assign(project, { currentTime: 3 });

    const result = serializeAnimationProject(project);

    expect(result).toEqual({
      status: "invalid",
      errors: ["Project contains unknown field currentTime."],
    });
    expect("json" in result).toBe(false);
  });

  it("rejects a whole Editor Store instead of serializing temporary state", () => {
    const project = createCompleteProject();
    const editorStore = {
      project,
      currentTime: 4,
      selection: { objectId: project.scene.objects[0]!.id },
    };

    const result = serializeAnimationProject(editorStore);

    expect(result.status).toBe("invalid");
    if (result.status === "invalid") {
      expect(result.errors).toContain("Project contains unknown field project.");
      expect(result.errors).toContain("Project contains unknown field currentTime.");
      expect(result.errors).toContain("Project contains unknown field selection.");
    }
  });

  it("is deterministic, newline-terminated and does not mutate frozen input", () => {
    const project = createCompleteProject();
    const before = JSON.stringify(project);
    deepFreeze(project);

    const first = serializeAnimationProject(project);
    const second = serializeAnimationProject(project);

    expect(first).toEqual(second);
    expectSerialized(first);
    expect(first.json.endsWith("\n")).toBe(true);
    expect(first.json.endsWith("\n\n")).toBe(false);
    expect(first.json.split("\n").some((line) => / +$/.test(line))).toBe(false);
    expect(JSON.stringify(project)).toBe(before);
  });

  it("omits absent Background and emits only its assetId when present", () => {
    const empty = serializeAnimationProject(createEmptyAnimationProject());
    expectSerialized(empty);
    expect(JSON.parse(empty.json).scene).not.toHaveProperty("background");

    const complete = serializeAnimationProject(createCompleteProject());
    expectSerialized(complete);
    expect(JSON.parse(complete.json).scene.background).toEqual({
      assetId: "intersection-01",
    });
  });

  it("returns invalid instead of throwing for malformed unknown input", () => {
    expect(() => serializeAnimationProject(null)).not.toThrow();
    expect(serializeAnimationProject(null)).toEqual({
      status: "invalid",
      errors: ["Project must be an object."],
    });
  });
});
