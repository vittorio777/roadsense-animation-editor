import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it } from "vitest";

import { ObjectLibraryPanel } from "../src/editor/components/object-library/ObjectLibraryPanel";
import { createEmptyAnimationProject } from "../src/model/animation";
import { useEditorStore } from "../src/store/editorStore";

describe("F2.1 background selection", () => {
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

  it("lists Background assets with no initial selection", () => {
    const projectBeforeRender = useEditorStore.getState().project;
    const markup = renderToStaticMarkup(<ObjectLibraryPanel />);

    expect(markup).toContain("Backgrounds");
    expect(markup).toContain("Foundation intersection");
    expect(markup).toContain('aria-pressed="false"');
    expect(useEditorStore.getState().project).toBe(projectBeforeRender);
  });

  it("writes the selected assetId and reflects project selection state", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<ObjectLibraryPanel />);
    });

    const backgroundButton = container.querySelector<HTMLButtonElement>(
      '[data-asset-id="intersection-01"]',
    );
    expect(backgroundButton?.getAttribute("aria-pressed")).toBe("false");

    await act(async () => {
      backgroundButton?.click();
    });

    expect(useEditorStore.getState().project.scene.background).toEqual({
      assetId: "intersection-01",
    });
    expect(backgroundButton?.getAttribute("aria-pressed")).toBe("true");
    expect(backgroundButton?.textContent).toContain("Selected");

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
