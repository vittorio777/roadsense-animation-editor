import { describe, expect, it } from "vitest";

import { createEmptyAnimationProject } from "../src/model/animation";
import { createMovementPoint } from "../src/model/movement";
import { createVehicleObject } from "../src/model/vehicle";
import { validateAnimationProject } from "../src/persistence/projectValidator";

describe("project validator", () => {
  it("accepts a valid minimal Animation Project", () => {
    const result = validateAnimationProject(
      createEmptyAnimationProject("animation-01"),
    );

    expect(result).toEqual({ valid: true, errors: [] });
  });

  it("rejects obviously invalid project data", () => {
    const result = validateAnimationProject({
      schemaVersion: 2,
      animationId: "",
      scene: {
        width: 0,
        height: -1,
        objects: "not-an-array",
      },
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        "schemaVersion must be 1.",
        "animationId must be a non-empty string.",
        "scene.width must be greater than 0.",
        "scene.height must be greater than 0.",
        "scene.objects must be an array.",
      ]),
    );
  });

  it("rejects an unknown asset reference", () => {
    const project = {
      ...createEmptyAnimationProject("animation-01"),
      scene: {
        width: 1600,
        height: 900,
        background: { assetId: "missing-background" },
        objects: [],
      },
    };

    const result = validateAnimationProject(project);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      "Unknown background assetId: missing-background.",
    );
  });

  it("rejects duplicate Movement Point times within one Vehicle", () => {
    const project = createEmptyAnimationProject("animation-01");
    const vehicle = createVehicleObject({
      assetId: "car-blue-sedan",
      x: 800,
      y: 450,
      createId: (kind) => `vehicle-one-${kind}`,
    });
    vehicle.movement.points.push(
      createMovementPoint({
        time: 3.3,
        x: 900,
        y: 500,
        createId: () => "point-3-a",
      }),
      createMovementPoint({
        time: 3.3,
        x: 1000,
        y: 550,
        createId: () => "point-3-b",
      }),
    );
    project.scene.objects = [vehicle];

    const result = validateAnimationProject(project);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      "scene.objects[0].movement contains duplicate time 3.3.",
    );
  });

  it("allows different Vehicles to use the same Movement Point times", () => {
    const project = createEmptyAnimationProject("animation-01");
    const createVehicle = (prefix: string) => {
      const vehicle = createVehicleObject({
        assetId: "car-blue-sedan",
        x: 800,
        y: 450,
        createId: (kind) => `${prefix}-${kind}`,
      });
      vehicle.movement.points.push(
        createMovementPoint({
          time: 3.3,
          x: 900,
          y: 500,
          createId: () => `${prefix}-point-3`,
        }),
      );
      vehicle.movement.paths.push({
        id: `${prefix}-path-0-3`,
        fromPointId: vehicle.movement.points[0]!.id,
        toPointId: vehicle.movement.points[1]!.id,
        type: "cubicBezier",
        control1: { x: 825, y: 462.5 },
        control2: { x: 875, y: 487.5 },
      });
      return vehicle;
    };
    project.scene.objects = [createVehicle("first"), createVehicle("second")];

    expect(validateAnimationProject(project)).toEqual({
      valid: true,
      errors: [],
    });
  });
});
