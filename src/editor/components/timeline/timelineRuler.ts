import {
  EDITOR_TIME_END,
  EDITOR_TIME_START,
} from "../../editorTimeRange";

export const TIMELINE_START_TIME = EDITOR_TIME_START;
export const TIMELINE_END_TIME = EDITOR_TIME_END;
export const TIMELINE_DEFAULT_VISIBLE_SPAN = 10;
export const TIMELINE_VISIBLE_SPANS = [5, 10, 20, 60] as const;
export const TIMELINE_MINOR_INTERVAL = 0.1;
export const TIMELINE_SNAP_INTERVAL = 0.1;

export type TimelineVisibleSpan = (typeof TIMELINE_VISIBLE_SPANS)[number];

export type TimelineTickKind = "major" | "medium" | "minor";

export interface TimelineTick {
  time: number;
  positionPercent: number;
  kind: TimelineTickKind;
  label?: string;
}

export function clampTimelineTime(
  time: number,
  startTime = TIMELINE_START_TIME,
  endTime = TIMELINE_END_TIME,
): number {
  return Math.min(endTime, Math.max(startTime, time));
}

export function timelinePositionToTime(
  position: number,
  width: number,
  startTime = TIMELINE_START_TIME,
  endTime = TIMELINE_END_TIME,
): number {
  if (width <= 0) {
    return startTime;
  }

  const positionRatio = Math.min(1, Math.max(0, position / width));
  return startTime + positionRatio * (endTime - startTime);
}

export function snapTimelineTime(
  time: number,
  interval = TIMELINE_SNAP_INTERVAL,
  startTime = TIMELINE_START_TIME,
  endTime = TIMELINE_END_TIME,
): number {
  const clampedTime = clampTimelineTime(time, startTime, endTime);
  const relativeStep = (clampedTime - startTime) / interval;
  const midpointTolerance =
    Number.EPSILON * Math.max(1, Math.abs(relativeStep)) * 2;
  const snappedStep = Math.floor(relativeStep + 0.5 + midpointTolerance);
  const snappedTime = startTime + snappedStep * interval;

  return clampTimelineTime(
    Number(snappedTime.toFixed(10)),
    startTime,
    endTime,
  );
}

export function timeToTimelinePercent(
  time: number,
  startTime = TIMELINE_START_TIME,
  endTime = TIMELINE_END_TIME,
): number {
  return ((time - startTime) / (endTime - startTime)) * 100;
}

export function calculateTimelineContentWidth(
  viewportWidth: number,
  visibleSpan: TimelineVisibleSpan,
): number {
  if (!Number.isFinite(viewportWidth) || viewportWidth <= 0) {
    return 0;
  }

  return viewportWidth * (TIMELINE_END_TIME / visibleSpan);
}

export function createTimelineRulerTicks(
  visibleSpan: TimelineVisibleSpan = TIMELINE_DEFAULT_VISIBLE_SPAN,
): TimelineTick[] {
  const isOverview = visibleSpan === TIMELINE_END_TIME;
  const visualMinorInterval = isOverview ? 0.5 : TIMELINE_MINOR_INTERVAL;
  const majorInterval = isOverview ? 5 : 1;
  const mediumInterval = isOverview ? 1 : 0.5;
  const stepCount = Math.round(
    (TIMELINE_END_TIME - TIMELINE_START_TIME) / visualMinorInterval,
  );

  return Array.from({ length: stepCount + 1 }, (_, step) => {
    const time = Number(
      (TIMELINE_START_TIME + step * visualMinorInterval).toFixed(10),
    );
    const isMajor = Number.isInteger(time / majorInterval);
    const isMedium =
      !isMajor && Number.isInteger(time / mediumInterval);

    return {
      time,
      positionPercent: timeToTimelinePercent(time),
      kind: isMajor ? "major" : isMedium ? "medium" : "minor",
      ...(isMajor ? { label: `${time}s` } : {}),
    };
  });
}
