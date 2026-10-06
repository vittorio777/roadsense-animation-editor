import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { App } from "../src/App";
import { Editor } from "../src/editor/Editor";
import { EDITOR_LAYOUT } from "../src/editor/editorLayout";

function countOccurrences(value: string, search: string): number {
  return value.split(search).length - 1;
}

describe("F1.1 editor layout", () => {
  it("renders each required editor region exactly once", () => {
    const markup = renderToStaticMarkup(<Editor />);

    expect(countOccurrences(markup, 'aria-label="Toolbar"')).toBe(1);
    expect(countOccurrences(markup, 'id="object-library-heading"')).toBe(1);
    expect(countOccurrences(markup, 'id="scene-heading"')).toBe(1);
    expect(countOccurrences(markup, 'id="properties-heading"')).toBe(1);
    expect(countOccurrences(markup, 'id="timeline-heading"')).toBe(1);
  });

  it("keeps implemented library content and the current Timeline boundary", () => {
    const markup = renderToStaticMarkup(<Editor />);

    expect(markup).toContain("Backgrounds");
    expect(markup).toContain("Vehicles");
    expect(markup).toContain("Car Blue Sedan");
    expect(markup).toContain("Car Blue Sport");
    expect(markup).toContain("Timeline ruler, 0 to 60 seconds");
    expect(markup).not.toContain("Timeline editing begins in Phase 3.");
    expect(markup).toContain("Current time: 0.00s");
  });

  it("loads the Editor from the application entry", () => {
    const markup = renderToStaticMarkup(<App />);

    expect(markup).toContain("Animation Editor");
    expect(markup).not.toContain("The project foundation is ready");
  });

  it("defines the supported desktop workspace layout in one contract", () => {
    const markup = renderToStaticMarkup(<Editor />);

    expect(EDITOR_LAYOUT).toEqual({
      minimumWidth: 1280,
      minimumHeight: 720,
      toolbarHeight: 52,
      timelineHeight: 208,
      objectLibraryWidth: 224,
      propertiesWidth: 280,
    });
    expect(markup).toContain("min-width:1280px");
    expect(markup).toContain("min-height:720px");
    expect(markup).toContain(
      "grid-template-rows:52px minmax(0, 1fr) 208px",
    );
    expect(markup).toContain("grid-template-columns:minmax(0, 1fr)");
    expect(markup).toContain(
      "grid-template-columns:224px minmax(0, 1fr) 280px",
    );
  });

  it("leaves usable Scene space at the minimum supported width", () => {
    const sceneWidthAtMinimum =
      EDITOR_LAYOUT.minimumWidth -
      EDITOR_LAYOUT.objectLibraryWidth -
      EDITOR_LAYOUT.propertiesWidth;

    expect(sceneWidthAtMinimum).toBe(776);
    expect(sceneWidthAtMinimum).toBeGreaterThan(0);
  });
});
