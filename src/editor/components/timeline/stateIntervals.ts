import type { StateTrack } from "../../../model/stateTrack";

export interface TimelineStateInterval {
  sourceStartKeyframeId: string;
  startTime: number;
  endTime: number;
  sourceEndTime: number | null;
  endClipped: boolean;
  openEnded: boolean;
}

export function projectStateIntervals<T>(
  track: StateTrack<T>,
  isActive: (value: T) => boolean,
  rangeStart = 0,
  rangeEnd = 10,
): TimelineStateInterval[] {
  if (
    !Number.isFinite(rangeStart) ||
    !Number.isFinite(rangeEnd) ||
    rangeStart < 0 ||
    rangeEnd <= rangeStart
  ) {
    return [];
  }

  const keyframes = [...track.keyframes].sort(
    (left, right) => left.time - right.time,
  );
  const seenTimes = new Set<number>();

  for (const keyframe of keyframes) {
    if (
      !Number.isFinite(keyframe.time) ||
      keyframe.time < 0 ||
      seenTimes.has(keyframe.time)
    ) {
      return [];
    }
    seenTimes.add(keyframe.time);
  }

  let active = false;
  let sourceStartKeyframeId: string | null = null;
  for (const keyframe of keyframes) {
    if (keyframe.time > rangeStart) {
      break;
    }
    const nextActive = isActive(keyframe.value);
    if (!active && nextActive) {
      sourceStartKeyframeId = keyframe.id;
    } else if (active && !nextActive) {
      sourceStartKeyframeId = null;
    }
    active = nextActive;
  }

  let intervalStart = active ? rangeStart : null;
  const intervals: TimelineStateInterval[] = [];

  for (const keyframe of keyframes) {
    if (keyframe.time <= rangeStart || keyframe.time > rangeEnd) {
      continue;
    }

    const nextActive = isActive(keyframe.value);
    if (!active && nextActive) {
      intervalStart = keyframe.time;
      sourceStartKeyframeId = keyframe.id;
    } else if (active && !nextActive && intervalStart !== null) {
      if (sourceStartKeyframeId) {
        intervals.push({
          sourceStartKeyframeId,
          startTime: intervalStart,
          endTime: keyframe.time,
          sourceEndTime: keyframe.time,
          endClipped: false,
          openEnded: false,
        });
      }
      intervalStart = null;
      sourceStartKeyframeId = null;
    }
    active = nextActive;
  }

  if (
    active &&
    intervalStart !== null &&
    sourceStartKeyframeId &&
    intervalStart < rangeEnd
  ) {
    const laterEnd = keyframes.find(
      (keyframe) =>
        keyframe.time > rangeEnd && !isActive(keyframe.value),
    );
    intervals.push({
      sourceStartKeyframeId,
      startTime: intervalStart,
      endTime: rangeEnd,
      sourceEndTime: laterEnd?.time ?? null,
      endClipped: true,
      openEnded: !laterEnd,
    });
  }

  return intervals;
}
