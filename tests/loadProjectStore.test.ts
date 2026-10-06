import { beforeEach, describe, expect, it, vi } from "vitest";

import { createEmptyAnimationProject } from "../src/model/animation";
import { useEditorStore } from "../src/store/editorStore";

describe("F6.6 Project replacement", () => {
  beforeEach(() => {
    useEditorStore.setState({
      project: createEmptyAnimationProject("old-project"),
      currentTime: 6.4,
      isPreviewPlaying: true,
      selection: {
        objectId: "old-vehicle",
        movementPointId: "old-point",
        pathId: "old-path",
        stateKeyframeId: "old-keyframe",
      },
    });
  });

  it("atomically replaces Project and resets core Editor State", () => {
    const project = createEmptyAnimationProject("loaded-project");
    const listener = vi.fn();
    const unsubscribe = useEditorStore.subscribe(listener);

    useEditorStore.getState().loadProject(project);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(useEditorStore.getState()).toMatchObject({
      project,
      currentTime: 0,
      isPreviewPlaying: false,
      selection: {
        objectId: null,
        movementPointId: null,
        pathId: null,
        stateKeyframeId: null,
      },
    });
    expect(useEditorStore.getState().project).toBe(project);
    unsubscribe();
  });
});
