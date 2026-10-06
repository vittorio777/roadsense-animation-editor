import { useEditorStore } from "../../../store/editorStore";
import { SceneViewport } from "./SceneViewport";

export function ScenePanel() {
  const width = useEditorStore((state) => state.project.scene.width);
  const height = useEditorStore((state) => state.project.scene.height);

  return (
    <section
      aria-labelledby="scene-heading"
      className="flex min-h-0 min-w-0 flex-col bg-neutral-200"
    >
      <div className="flex items-center justify-between border-b border-neutral-300 bg-neutral-50 px-4 py-3">
        <h2 id="scene-heading" className="text-sm font-semibold text-neutral-900">
          Scene
        </h2>
        <output
          aria-label="Scene logical dimensions"
          className="font-mono text-xs text-neutral-500"
        >
          {width} × {height}
        </output>
      </div>

      <SceneViewport />
    </section>
  );
}
