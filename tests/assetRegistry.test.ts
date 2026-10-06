import { describe, expect, it } from "vitest";

import {
  getAssetById,
  getAssetsByType,
  hasAsset,
  isValidVehicleVisualDefinition,
} from "../src/assets/assetRegistry";

describe("asset registry", () => {
  it("resolves independently calibrated Sedan and Sport assets", () => {
    expect(getAssetById("car-blue-sedan")).toMatchObject({
      id: "car-blue-sedan",
      type: "vehicle",
      src: "/assets/vehicles/car-blue-sedan.svg",
      name: "Car Blue Sedan",
      width: 120,
      height: 72,
      visual: {
        forwardDeg: 0,
        lights: {
          indicatorFrontLeft: { x: 52, y: -20, radius: 2.8 },
          brakeLeft: { x: -52, y: -12, radius: 3.2 },
          headlightRight: { x: 52, y: 14, radius: 3.2 },
          headlightBeamLength: 36,
          headlightBeamSpread: 8,
        },
      },
    });
    expect(getAssetById("car-blue-sport")).toMatchObject({
      id: "car-blue-sport",
      type: "vehicle",
      src: "/assets/vehicles/car-blue-sport.svg",
      name: "Car Blue Sport",
      width: 120,
      height: 72,
      visual: {
        forwardDeg: 0,
        lights: {
          indicatorFrontLeft: { x: 51, y: -21, radius: 2.6 },
          brakeLeft: { x: -52, y: -15, radius: 3.4 },
          headlightRight: { x: 52, y: 16, radius: 3.2 },
          headlightBeamLength: 38,
          headlightBeamSpread: 9,
        },
      },
    });

    const sedan = getAssetById("car-blue-sedan");
    const sport = getAssetById("car-blue-sport");
    expect(sedan?.type).toBe("vehicle");
    expect(sport?.type).toBe("vehicle");
    if (sedan?.type === "vehicle" && sport?.type === "vehicle") {
      expect(sedan.visual).not.toBe(sport.visual);
      expect(sedan.visual.lights).not.toEqual(sport.visual.lights);
    }
  });

  it("validates finite, positive Vehicle visual geometry", () => {
    const vehicle = getAssetsByType("vehicle")[0]!;
    expect(isValidVehicleVisualDefinition(vehicle.visual)).toBe(true);
    expect(
      isValidVehicleVisualDefinition({
        ...vehicle.visual,
        lights: {
          ...vehicle.visual.lights,
          headlightBeamLength: 0,
        },
      }),
    ).toBe(false);
    expect(
      isValidVehicleVisualDefinition({
        ...vehicle.visual,
        lights: {
          ...vehicle.visual.lights,
          brakeLeft: {
            ...vehicle.visual.lights.brakeLeft,
            x: Number.NaN,
          },
        },
      }),
    ).toBe(false);
  });

  it("identifies missing and mismatched assets", () => {
    expect(getAssetById("missing-asset")).toBeUndefined();
    expect(hasAsset("car-blue-sedan", "vehicle")).toBe(true);
    expect(hasAsset("car-blue-sport", "vehicle")).toBe(true);
    expect(hasAsset("car-blue-sedan", "background")).toBe(false);
  });

  it("lists assets by their registered type", () => {
    expect(getAssetsByType("background")).toEqual([
      expect.objectContaining({ id: "intersection-01", type: "background" }),
    ]);
    expect(getAssetsByType("background")).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "car-blue-sedan" })]),
    );
    expect(getAssetsByType("vehicle")).toEqual([
      expect.objectContaining({ id: "car-blue-sedan", type: "vehicle" }),
      expect.objectContaining({ id: "car-blue-sport", type: "vehicle" }),
    ]);
    expect(getAssetsByType("vehicle")).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "intersection-01" }),
      ]),
    );
  });
});
