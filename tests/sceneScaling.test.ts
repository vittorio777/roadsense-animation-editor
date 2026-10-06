import { describe, expect, it } from "vitest";

import { calculateSceneViewportLayout } from "../src/editor/components/scene/sceneScaling";

describe("F1.3 scene scaling calculation", () => {
  it("fits a Scene constrained by available width", () => {
    expect(calculateSceneViewportLayout(1600, 900, 800, 600)).toEqual({
      displayWidth: 800,
      displayHeight: 450,
      scale: 0.5,
    });
  });

  it("fits a Scene constrained by available height", () => {
    expect(calculateSceneViewportLayout(1600, 900, 1200, 450)).toEqual({
      displayWidth: 800,
      displayHeight: 450,
      scale: 0.5,
    });
  });

  it("uses scale one when the Scene fits exactly", () => {
    expect(calculateSceneViewportLayout(1600, 900, 1600, 900)).toEqual({
      displayWidth: 1600,
      displayHeight: 900,
      scale: 1,
    });
  });

  it("does not upscale the Scene when more space is available", () => {
    expect(calculateSceneViewportLayout(1600, 900, 2000, 1200)).toEqual({
      displayWidth: 1600,
      displayHeight: 900,
      scale: 1,
    });
  });

  it.each([
    [0, 900, 800, 450],
    [1600, 0, 800, 450],
    [1600, 900, 0, 450],
    [1600, 900, 800, Number.NaN],
  ])(
    "rejects invalid dimensions (%s, %s, %s, %s)",
    (sceneWidth, sceneHeight, availableWidth, availableHeight) => {
      expect(
        calculateSceneViewportLayout(
          sceneWidth,
          sceneHeight,
          availableWidth,
          availableHeight,
        ),
      ).toBeNull();
    },
  );
});
