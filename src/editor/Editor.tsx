import { usePreviewPlaybackClock } from "../preview/usePreviewPlaybackClock";
import { ObjectLibraryPanel } from "./components/object-library/ObjectLibraryPanel";
import { PropertiesPanel } from "./components/properties/PropertiesPanel";
import { ScenePanel } from "./components/scene/ScenePanel";
import { TimelinePanel } from "./components/timeline/TimelinePanel";
import { Toolbar } from "./components/toolbar/Toolbar";
import { EDITOR_LAYOUT } from "./editorLayout";

export function Editor() {
  usePreviewPlaybackClock();

  return (
    <main
      className="grid h-screen overflow-hidden bg-neutral-200 text-neutral-900"
      style={{
        minWidth: EDITOR_LAYOUT.minimumWidth,
        minHeight: EDITOR_LAYOUT.minimumHeight,
        gridTemplateColumns: "minmax(0, 1fr)",
        gridTemplateRows: `${EDITOR_LAYOUT.toolbarHeight}px minmax(0, 1fr) ${EDITOR_LAYOUT.timelineHeight}px`,
      }}
    >
      <Toolbar />

      <div
        className="grid min-h-0"
        style={{
          gridTemplateColumns: `${EDITOR_LAYOUT.objectLibraryWidth}px minmax(0, 1fr) ${EDITOR_LAYOUT.propertiesWidth}px`,
        }}
      >
        <ObjectLibraryPanel />
        <ScenePanel />
        <PropertiesPanel />
      </div>

      <TimelinePanel />
    </main>
  );
}
