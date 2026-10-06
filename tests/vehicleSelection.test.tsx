import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it } from "vitest";

import { PropertiesPanel } from "../src/editor/components/properties/PropertiesPanel";
import { createEmptyAnimationProject } from "../src/model/animation";
import { useEditorStore } from "../src/store/editorStore";

describe("F2.4 Vehicle selection", () => {
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
    useEditorStore.getState().addVehicle("car-blue-sedan");
  });

  it("shows the empty Properties state without a selection", () => {
    const markup = renderToStaticMarkup(<PropertiesPanel />);

    expect(markup).toContain("Select an object to inspect its properties.");
    expect(markup).not.toContain("Instance ID");
  });

  it("synchronizes a read-only Vehicle summary into Properties", async () => {
    const vehicleId = useEditorStore.getState().project.scene.objects[0]?.id;
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<PropertiesPanel />);
    });

    await act(async () => {
      useEditorStore.getState().selectObject(vehicleId as string);
    });

    expect(container.textContent).toContain("Selected object");
    expect(container.textContent).toContain("Vehicle");
    expect(container.textContent).toContain("Car Blue Sedan");
    expect(container.textContent).toContain("Instance ID");
    expect(container.textContent).toContain(vehicleId);
    expect(container.querySelectorAll("input")).toHaveLength(2);
    expect(container.querySelector("select, textarea")).toBeNull();

    await act(async () => {
      useEditorStore.getState().clearSelection();
    });

    expect(container.textContent).toContain(
      "Select an object to inspect its properties.",
    );

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
