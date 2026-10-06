import {
  EDITOR_TIME_END,
  EDITOR_TIME_START,
} from "../editor/editorTimeRange";

export interface PreviewTimeAdvance {
  time: number;
  reachedEnd: boolean;
}

export function advancePreviewTime(
  currentTime: number,
  elapsedSeconds: number,
): PreviewTimeAdvance {
  const safeCurrentTime = Number.isFinite(currentTime)
    ? Math.min(EDITOR_TIME_END, Math.max(EDITOR_TIME_START, currentTime))
    : EDITOR_TIME_START;

  if (!Number.isFinite(elapsedSeconds) || elapsedSeconds <= 0) {
    return {
      time: safeCurrentTime,
      reachedEnd: safeCurrentTime >= EDITOR_TIME_END,
    };
  }

  const time = Math.min(EDITOR_TIME_END, safeCurrentTime + elapsedSeconds);

  return {
    time,
    reachedEnd: time >= EDITOR_TIME_END,
  };
}
