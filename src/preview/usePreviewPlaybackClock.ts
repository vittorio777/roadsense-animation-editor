import { useEffect } from "react";

import { useEditorStore } from "../store/editorStore";

export function usePreviewPlaybackClock() {
  const isPreviewPlaying = useEditorStore(
    (state) => state.isPreviewPlaying,
  );

  useEffect(() => {
    if (!isPreviewPlaying) {
      return;
    }

    let frameId: number | null = null;
    let previousTimestamp: number | null = null;

    const tick = (timestamp: number) => {
      if (previousTimestamp === null) {
        previousTimestamp = timestamp;
      } else {
        const elapsedSeconds = (timestamp - previousTimestamp) / 1000;
        previousTimestamp = timestamp;
        useEditorStore.getState().advancePreviewPlayback(elapsedSeconds);
      }

      if (useEditorStore.getState().isPreviewPlaying) {
        frameId = requestAnimationFrame(tick);
      }
    };

    frameId = requestAnimationFrame(tick);

    return () => {
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
      }
    };
  }, [isPreviewPlaying]);

  useEffect(
    () => () => {
      if (useEditorStore.getState().isPreviewPlaying) {
        useEditorStore.getState().stopPreviewPlayback();
      }
    },
    [],
  );
}
