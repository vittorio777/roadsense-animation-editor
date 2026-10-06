import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it } from "vitest";

import { ObjectLibraryPanel } from "../src/editor/components/object-library/ObjectLibraryPanel";
import { createEmptyAnimationProject } from "../src/model/animation";
import { useEditorStore } from "../src/store/editorStore";

describe("F2.2 vehicle library", () => {
  beforeEach(() => {
    useEditorStore.setState({
      project: {
        ...createEmptyAnimationProject(),
        scene: {
          ...createEmptyAnimationProject().scene,
          background: { assetId: "intersection-01" },
        },
      },
      currentTime: 4.25,
      selection: {
        objectId: null,
        movementPointId: null,
        pathId: null,
        stateKeyframeId: null,
      },
    });
  });

  it("renders Registry-backed Vehicle content in its own section", () => {
    const markup = renderToStaticMarkup(<ObjectLibraryPanel />);

    expect(markup).toContain('id="background-library-heading"');
    expect(markup).toContain('id="vehicle-library-heading"');
    expect(markup).toContain('data-asset-id="car-blue-sedan"');
    expect(markup).toContain('data-asset-id="car-blue-sport"');
    expect(markup).toContain('data-asset-type="vehicle"');
    expect(markup).toContain('/assets/vehicles/car-blue-sedan.svg');
    expect(markup).toContain('/assets/vehicles/car-blue-sport.svg');
    expect(markup).toContain("Car Blue Sedan");
    expect(markup).toContain("Car Blue Sport");
  });

  it("does not add a Vehicle just by rendering the library", () => {
    const stateBeforeRender = useEditorStore.getState();
    const container = document.createElement("div");
    container.innerHTML = renderToStaticMarkup(<ObjectLibraryPanel />);

    const vehicleEntry = container.querySelector('[data-asset-id="car-blue-sedan"]');
    expect(vehicleEntry?.tagName).toBe("BUTTON");
    expect(vehicleEntry?.getAttribute("aria-label")).toBe(
      "Add Car Blue Sedan to Scene",
    );
    const sportEntry = container.querySelector(
      '[data-asset-id="car-blue-sport"]',
    );
    expect(sportEntry?.getAttribute("aria-label")).toBe(
      "Add Car Blue Sport to Scene",
    );

    const stateAfterRender = useEditorStore.getState();
    expect(stateAfterRender.project).toBe(stateBeforeRender.project);
    expect(stateAfterRender.project.scene.objects).toHaveLength(0);
    expect(stateAfterRender.currentTime).toBe(4.25);
    expect(stateAfterRender.selection).toBe(stateBeforeRender.selection);
  });
});
