import { describe, expect, it } from "vitest";

import type { AnimationProject } from "../src/model/animation";
import type { VehicleObject } from "../src/model/vehicle";
import {
  isAnimationProject,
  validateAnimationProject,
} from "../src/persistence/projectValidator";

function createVehicle(prefix: string, startX: number): VehicleObject {
  return {
    id: `${prefix}-vehicle`,
    type: "vehicle",
    assetId: "car-blue-sedan",
    movement: {
      points: [
        { id: `${prefix}-point-0`, time: 0, x: startX, y: 450 },
        { id: `${prefix}-point-2`, time: 2, x: startX + 200, y: 350 },
        { id: `${prefix}-point-5`, time: 5, x: startX + 400, y: 500 },
      ],
      paths: [
        {
          id: `${prefix}-path-0-2`,
          fromPointId: `${prefix}-point-0`,
          toPointId: `${prefix}-point-2`,
          type: "cubicBezier",
          control1: { x: startX + 50, y: 425 },
          control2: { x: startX + 150, y: 375 },
        },
        {
          id: `${prefix}-path-2-5`,
          fromPointId: `${prefix}-point-2`,
          toPointId: `${prefix}-point-5`,
          type: "cubicBezier",
          control1: { x: startX + 250, y: 375 },
          control2: { x: startX + 350, y: 475 },
        },
      ],
    },
    stateTracks: {
      indicator: {
        keyframes: [
          { id: `${prefix}-indicator-0`, time: 0, value: "off" },
          { id: `${prefix}-indicator-2`, time: 2, value: "left" },
          { id: `${prefix}-indicator-5`, time: 5, value: "hazard" },
        ],
      },
      brakeLight: {
        keyframes: [
          { id: `${prefix}-brake-0`, time: 0, value: false },
          { id: `${prefix}-brake-3`, time: 3, value: true },
        ],
      },
      headlight: {
        keyframes: [
          { id: `${prefix}-headlight-0`, time: 0, value: false },
          { id: `${prefix}-headlight-1`, time: 1, value: true },
        ],
      },
      horn: {
        keyframes: [
          { id: `${prefix}-horn-0`, time: 0, value: false },
          { id: `${prefix}-horn-4`, time: 4, value: true },
        ],
      },
    },
  };
}

function createCompleteProject(): AnimationProject {
  const secondVehicle = createVehicle("second", 900);
  secondVehicle.movement.points.splice(1);
  secondVehicle.movement.paths = [];
  for (const track of Object.values(secondVehicle.stateTracks)) {
    track.keyframes.splice(1);
  }

  return {
    schemaVersion: 1,
    animationId: "complete-animation",
    scene: {
      width: 1600,
      height: 900,
      background: { assetId: "intersection-01" },
      objects: [createVehicle("first", 200), secondVehicle],
    },
  };
}

function firstVehicle(project: AnimationProject): VehicleObject {
  return project.scene.objects[0]!;
}

function expectInvalid(project: unknown, message: string) {
  const result = validateAnimationProject(project);
  expect(result.valid).toBe(false);
  expect(result.errors).toContain(message);
  expect(isAnimationProject(project)).toBe(false);
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

describe("F6.1 full project validation", () => {
  it("accepts a complete project and narrows the type", () => {
    const project: unknown = createCompleteProject();

    expect(validateAnimationProject(project)).toEqual({ valid: true, errors: [] });
    expect(isAnimationProject(project)).toBe(true);
  });

  it("rejects unknown and Editor-only fields at every contract level", () => {
    const topLevel = createCompleteProject();
    Object.assign(topLevel, { currentTime: 2 });
    expectInvalid(topLevel, "Project contains unknown field currentTime.");

    const point = createCompleteProject();
    Object.assign(firstVehicle(point).movement.points[0]!, { selected: true });
    expectInvalid(
      point,
      "scene.objects[0].movement.points[0] contains unknown field selected.",
    );

    const keyframe = createCompleteProject();
    Object.assign(firstVehicle(keyframe).stateTracks.horn.keyframes[0]!, {
      preview: true,
    });
    expectInvalid(
      keyframe,
      "scene.objects[0].stateTracks.horn.keyframes[0] contains unknown field preview.",
    );
  });

  it("requires finite positive dimensions and finite coordinates", () => {
    const dimensions = createCompleteProject();
    dimensions.scene.width = Number.POSITIVE_INFINITY;
    expectInvalid(dimensions, "scene.width must be greater than 0.");

    const movement = createCompleteProject();
    firstVehicle(movement).movement.points[1]!.x = Number.NaN;
    expectInvalid(
      movement,
      "scene.objects[0].movement.points[1].x must be a finite number.",
    );

    const control = createCompleteProject();
    firstVehicle(control).movement.paths[0]!.control2.y = Number.NEGATIVE_INFINITY;
    expectInvalid(
      control,
      "scene.objects[0].movement.paths[0].control2.y must be a finite number.",
    );
  });

  it("enforces project-wide stable ID uniqueness", () => {
    const project = createCompleteProject();
    project.scene.objects[1]!.id = firstVehicle(project).movement.points[0]!.id;

    expectInvalid(
      project,
      "scene.objects[1].id duplicates stable ID first-point-0 already used at scene.objects[0].movement.points[0].id.",
    );
  });

  it("requires ordered unique Movement Points and exactly one initial Point", () => {
    const unordered = createCompleteProject();
    const points = firstVehicle(unordered).movement.points;
    [points[1], points[2]] = [points[2]!, points[1]!];
    expectInvalid(
      unordered,
      "scene.objects[0].movement.points must be strictly ordered by time.",
    );

    const duplicate = createCompleteProject();
    firstVehicle(duplicate).movement.points[1]!.time = 0;
    expectInvalid(
      duplicate,
      "scene.objects[0].movement contains duplicate time 0.",
    );
    expect(validateAnimationProject(duplicate).errors).toContain(
      "scene.objects[0].movement must include exactly one 0-second Movement Point.",
    );

    const missing = createCompleteProject();
    firstVehicle(missing).movement.points[0]!.time = 1;
    expectInvalid(
      missing,
      "scene.objects[0].movement must include a 0-second Movement Point.",
    );
  });

  it("validates Path shape, references, direction and adjacency", () => {
    const missingReference = createCompleteProject();
    firstVehicle(missingReference).movement.paths[0]!.toPointId = "missing-point";
    expectInvalid(
      missingReference,
      "scene.objects[0].movement.paths[0].toPointId must reference a Movement Point in the same Vehicle.",
    );

    const reverse = createCompleteProject();
    const reversePath = firstVehicle(reverse).movement.paths[0]!;
    [reversePath.fromPointId, reversePath.toPointId] = [
      reversePath.toPointId,
      reversePath.fromPointId,
    ];
    expectInvalid(
      reverse,
      "scene.objects[0].movement.paths[0] must connect from an earlier to a later Point.",
    );

    const nonAdjacent = createCompleteProject();
    firstVehicle(nonAdjacent).movement.paths[0]!.toPointId = "first-point-5";
    expectInvalid(
      nonAdjacent,
      "scene.objects[0].movement.paths[0] must connect adjacent Movement Points.",
    );
  });

  it("requires one Path for every adjacent Point pair", () => {
    const missing = createCompleteProject();
    firstVehicle(missing).movement.paths.pop();
    expectInvalid(
      missing,
      "scene.objects[0].movement.paths must contain exactly 2 Path Segment(s).",
    );
    expect(validateAnimationProject(missing).errors).toContain(
      "scene.objects[0].movement.paths must connect adjacent Points first-point-2 -> first-point-5 exactly once.",
    );

    const duplicate = createCompleteProject();
    const existing = firstVehicle(duplicate).movement.paths[0]!;
    firstVehicle(duplicate).movement.paths.push({
      ...structuredClone(existing),
      id: "first-duplicate-path",
    });
    expectInvalid(
      duplicate,
      "scene.objects[0].movement.paths must connect adjacent Points first-point-0 -> first-point-2 exactly once.",
    );
  });

  it("requires all four non-empty State Tracks with one initial Keyframe", () => {
    const missingTrack = createCompleteProject();
    Reflect.deleteProperty(firstVehicle(missingTrack).stateTracks, "horn");
    expectInvalid(
      missingTrack,
      "scene.objects[0].stateTracks.horn must be an object.",
    );

    const emptyTrack = createCompleteProject();
    firstVehicle(emptyTrack).stateTracks.brakeLight.keyframes = [];
    expectInvalid(
      emptyTrack,
      "scene.objects[0].stateTracks.brakeLight.keyframes must not be empty.",
    );

    const missingInitial = createCompleteProject();
    firstVehicle(missingInitial).stateTracks.headlight.keyframes[0]!.time = 0.5;
    expectInvalid(
      missingInitial,
      "scene.objects[0].stateTracks.headlight must include exactly one 0-second Keyframe.",
    );
  });

  it("enforces State Keyframe order, time uniqueness and value types", () => {
    const duplicate = createCompleteProject();
    firstVehicle(duplicate).stateTracks.indicator.keyframes[1]!.time = 0;
    expectInvalid(
      duplicate,
      "scene.objects[0].stateTracks.indicator contains duplicate time 0.",
    );

    const indicator = createCompleteProject();
    Reflect.set(
      firstVehicle(indicator).stateTracks.indicator.keyframes[1]!,
      "value",
      "blink",
    );
    expectInvalid(
      indicator,
      "scene.objects[0].stateTracks.indicator.keyframes[1].value must be one of off, left, right, or hazard.",
    );

    const booleanTrack = createCompleteProject();
    Reflect.set(
      firstVehicle(booleanTrack).stateTracks.horn.keyframes[1]!,
      "value",
      1,
    );
    expectInvalid(
      booleanTrack,
      "scene.objects[0].stateTracks.horn.keyframes[1].value must be a boolean.",
    );
  });

  it("retains existing asset validation without changing resolution flow", () => {
    const background = createCompleteProject();
    background.scene.background!.assetId = "missing-background";
    expectInvalid(background, "Unknown background assetId: missing-background.");

    const vehicle = createCompleteProject();
    firstVehicle(vehicle).assetId = "missing-vehicle";
    expectInvalid(vehicle, "Unknown vehicle assetId: missing-vehicle.");
  });

  it("does not mutate frozen input and returns deterministic errors", () => {
    const project = createCompleteProject();
    Object.assign(firstVehicle(project), { selection: { active: true } });
    const before = JSON.stringify(project);
    deepFreeze(project);

    const first = validateAnimationProject(project);
    const second = validateAnimationProject(project);

    expect(first).toEqual(second);
    expect(JSON.stringify(project)).toBe(before);
  });

  it("handles deeply malformed branches without throwing", () => {
    const project = createCompleteProject();
    Reflect.set(project.scene, "background", null);
    Reflect.set(firstVehicle(project), "movement", { points: [null], paths: [false] });
    Reflect.set(firstVehicle(project), "stateTracks", []);

    expect(() => validateAnimationProject(project)).not.toThrow();
    expect(validateAnimationProject(project).valid).toBe(false);
  });
});
