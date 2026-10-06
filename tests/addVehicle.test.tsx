import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it } from "vitest";

import { ObjectLibraryPanel } from "../src/editor/components/object-library/ObjectLibraryPanel";
import { createEmptyAnimationProject } from "../src/model/animation";
import { useEditorStore } from "../src/store/editorStore";

describe("F2.3 Add Vehicle interaction", () => {
  beforeEach(() => {
    useEditorStore.setState({
      project: createEmptyAnimationProject(),
      currentTime: 0,
      selection: {
        objectId: null,
        movementPointId: null,
        pathId: null,
        stateKeyframeId: null,
      },
    });
  });

  it("adds repeated Vehicle instances and keeps the command available", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<ObjectLibraryPanel />);
    });

    const addButton = container.querySelector<HTMLButtonElement>(
      '[data-asset-id="car-blue-sedan"]',
    );
    expect(addButton?.getAttribute("aria-label")).toBe(
      "Add Car Blue Sedan to Scene",
    );
    expect(addButton?.disabled).toBe(false);

    for (let index = 0; index < 5; index += 1) {
      await act(async () => {
        addButton?.click();
      });
    }

    const vehicles = useEditorStore.getState().project.scene.objects;
    expect(vehicles).toHaveLength(5);
    expect(addButton?.disabled).toBe(false);
    expect(addButton?.getAttribute("aria-label")).toBe(
      "Add another Car Blue Sedan to Scene, 5 currently in Scene",
    );
    expect(addButton?.textContent).toContain("5 in scene");
    expect(
      vehicles
        .map((vehicle) => vehicle.movement.points[0]!)
        .map(({ x, y }) => ({ x, y })),
    ).toEqual([
      { x: 800, y: 450 },
      { x: 960, y: 450 },
      { x: 640, y: 450 },
      { x: 1120, y: 450 },
      { x: 480, y: 450 },
    ]);

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("creates Sedan and Sport instances with independent identities", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<ObjectLibraryPanel />);
    });

    const sedanButton = container.querySelector<HTMLButtonElement>(
      '[data-asset-id="car-blue-sedan"]',
    );
    const sportButton = container.querySelector<HTMLButtonElement>(
      '[data-asset-id="car-blue-sport"]',
    );

    await act(async () => {
      sedanButton?.click();
      sportButton?.click();
    });

    expect(
      useEditorStore
        .getState()
        .project.scene.objects.map((vehicle) => vehicle.assetId),
    ).toEqual(["car-blue-sedan", "car-blue-sport"]);
    expect(sedanButton?.textContent).toContain("1 in scene");
    expect(sportButton?.textContent).toContain("1 in scene");

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
