import { describe, expect, it } from "vitest";

import { createEmptyAnimationProject } from "../src/model/animation";
import { createVehicleObject } from "../src/model/vehicle";
import { validateAnimationProject } from "../src/persistence/projectValidator";

describe("F2.3 Vehicle factory", () => {
  it("creates complete initial Movement and State Track data", () => {
    const vehicle = createVehicleObject({
      assetId: "car-blue-sedan",
      x: 800,
      y: 450,
      createId: (kind) => `${kind}-01`,
    });

    expect(vehicle).toEqual({
      id: "vehicle-01",
      type: "vehicle",
      assetId: "car-blue-sedan",
      movement: {
        points: [
          {
            id: "movement-point-01",
            time: 0,
            x: 800,
            y: 450,
          },
        ],
        paths: [],
      },
      stateTracks: {
        indicator: {
          keyframes: [
            { id: "indicator-keyframe-01", time: 0, value: "off" },
          ],
        },
        brakeLight: {
          keyframes: [
            { id: "brake-light-keyframe-01", time: 0, value: false },
          ],
        },
        headlight: {
          keyframes: [
            { id: "headlight-keyframe-01", time: 0, value: false },
          ],
        },
        horn: {
          keyframes: [
            { id: "horn-keyframe-01", time: 0, value: false },
          ],
        },
      },
    });
  });

  it("creates unique IDs and a project accepted by the base Validator", () => {
    let sequence = 0;
    const vehicle = createVehicleObject({
      assetId: "car-blue-sedan",
      x: 800,
      y: 450,
      createId: (kind) => `${kind}-${++sequence}`,
    });
    const ids = [
      vehicle.id,
      vehicle.movement.points[0]?.id,
      vehicle.stateTracks.indicator.keyframes[0]?.id,
      vehicle.stateTracks.brakeLight.keyframes[0]?.id,
      vehicle.stateTracks.headlight.keyframes[0]?.id,
      vehicle.stateTracks.horn.keyframes[0]?.id,
    ];
    const project = createEmptyAnimationProject();
    project.scene.objects.push(vehicle);

    expect(ids.every((id) => typeof id === "string" && id.length > 0)).toBe(
      true,
    );
    expect(new Set(ids).size).toBe(ids.length);
    expect(validateAnimationProject(project)).toEqual({ valid: true, errors: [] });
  });
});
