export type IndicatorState = "off" | "left" | "right" | "hazard";

export interface StateKeyframe<T> {
  id: string;
  time: number;
  value: T;
}

export interface StateTrack<T> {
  keyframes: StateKeyframe<T>[];
}

export interface VehicleStateValueByTrack {
  indicator: IndicatorState;
  brakeLight: boolean;
  headlight: boolean;
  horn: boolean;
}

export type VehicleStateTrackKey = keyof VehicleStateValueByTrack;

export type VehicleStateLaneKey =
  | "leftIndicator"
  | "rightIndicator"
  | "brakeLight"
  | "headlight"
  | "horn";

export type VehicleStateTracks = {
  [K in VehicleStateTrackKey]: StateTrack<VehicleStateValueByTrack[K]>;
};

export interface LocatedVehicleStateKeyframe {
  trackKey: VehicleStateTrackKey;
  keyframe: StateKeyframe<IndicatorState | boolean>;
}

export type VehicleStateKeyframeKind =
  | "indicator-keyframe"
  | "brake-light-keyframe"
  | "headlight-keyframe"
  | "horn-keyframe";

export interface CreateInitialVehicleStateTracksOptions {
  createId: (kind: VehicleStateKeyframeKind) => string;
}

export interface SetStateTrackValueOptions<T> {
  time: number;
  value: T;
  createId: () => string;
}

export interface CreateVehicleStateIntervalOptions {
  startTime: number;
  endTime: number;
  createId: () => string;
}

export type CreateVehicleStateIntervalResult =
  | { status: "created"; tracks: VehicleStateTracks }
  | { status: "occupied" | "invalid"; tracks: VehicleStateTracks };

export interface VehicleStateIntervalSource {
  startTime: number;
  endTime: number | null;
}

export type VehicleStateIntervalMutation =
  | { type: "move"; startTime: number; endTime: number }
  | { type: "resize-left"; startTime: number }
  | { type: "resize-right"; endTime: number }
  | { type: "delete" };

export interface EditVehicleStateIntervalOptions {
  source: VehicleStateIntervalSource;
  mutation: VehicleStateIntervalMutation;
  createId: () => string;
}

export type EditVehicleStateIntervalResult =
  | { status: "updated" | "deleted"; tracks: VehicleStateTracks }
  | {
      status: "occupied" | "invalid" | "unchanged";
      tracks: VehicleStateTracks;
    };

const vehicleStateTrackKeys: VehicleStateTrackKey[] = [
  "indicator",
  "brakeLight",
  "headlight",
  "horn",
];

const vehicleStateLaneKeys: VehicleStateLaneKey[] = [
  "leftIndicator",
  "rightIndicator",
  "brakeLight",
  "headlight",
  "horn",
];

export function createInitialVehicleStateTracks({
  createId,
}: CreateInitialVehicleStateTracksOptions): VehicleStateTracks {
  return {
    indicator: {
      keyframes: [
        {
          id: createId("indicator-keyframe"),
          time: 0,
          value: "off",
        },
      ],
    },
    brakeLight: {
      keyframes: [
        {
          id: createId("brake-light-keyframe"),
          time: 0,
          value: false,
        },
      ],
    },
    headlight: {
      keyframes: [
        {
          id: createId("headlight-keyframe"),
          time: 0,
          value: false,
        },
      ],
    },
    horn: {
      keyframes: [
        {
          id: createId("horn-keyframe"),
          time: 0,
          value: false,
        },
      ],
    },
  };
}

export function isVehicleStateTrackKey(
  value: unknown,
): value is VehicleStateTrackKey {
  return vehicleStateTrackKeys.some((key) => key === value);
}

export function isVehicleStateLaneKey(
  value: unknown,
): value is VehicleStateLaneKey {
  return vehicleStateLaneKeys.some((key) => key === value);
}

export function getVehicleStateTrackKeyForLane(
  laneKey: VehicleStateLaneKey,
): VehicleStateTrackKey {
  return laneKey === "leftIndicator" || laneKey === "rightIndicator"
    ? "indicator"
    : laneKey;
}

export function findVehicleStateKeyframe(
  tracks: VehicleStateTracks,
  keyframeId: string,
): LocatedVehicleStateKeyframe | undefined {
  for (const trackKey of vehicleStateTrackKeys) {
    const keyframe = tracks[trackKey].keyframes.find(
      (candidate) => candidate.id === keyframeId,
    ) as StateKeyframe<IndicatorState | boolean> | undefined;

    if (keyframe) {
      return { trackKey, keyframe };
    }
  }

  return undefined;
}

export function isVehicleStateValue(
  key: VehicleStateTrackKey,
  value: unknown,
): boolean {
  if (key === "indicator") {
    return (
      value === "off" ||
      value === "left" ||
      value === "right" ||
      value === "hazard"
    );
  }

  return typeof value === "boolean";
}

export function getVehicleStateTrack<K extends VehicleStateTrackKey>(
  tracks: VehicleStateTracks,
  key: K,
): StateTrack<VehicleStateValueByTrack[K]> {
  return tracks[key];
}

export function resolveStateKeyframeAtTime<T>(
  track: StateTrack<T>,
  time: number,
): StateKeyframe<T> | undefined {
  if (!Number.isFinite(time) || time < 0) {
    return undefined;
  }

  const seenTimes = new Set<number>();
  let resolved: StateKeyframe<T> | undefined;

  for (const keyframe of track.keyframes) {
    if (
      !Number.isFinite(keyframe.time) ||
      keyframe.time < 0 ||
      seenTimes.has(keyframe.time)
    ) {
      return undefined;
    }

    seenTimes.add(keyframe.time);

    if (
      keyframe.time <= time &&
      (!resolved || keyframe.time > resolved.time)
    ) {
      resolved = keyframe;
    }
  }

  return resolved;
}

export function resolveStateValueAtTime<T>(
  track: StateTrack<T>,
  time: number,
): T | undefined {
  return resolveStateKeyframeAtTime(track, time)?.value;
}

export function setStateTrackValueAtTime<T>(
  track: StateTrack<T>,
  { time, value, createId }: SetStateTrackValueOptions<T>,
): StateTrack<T> {
  if (!Number.isFinite(time) || time < 0 || track.keyframes.length === 0) {
    return track;
  }

  const seenTimes = new Set<number>();
  const seenIds = new Set<string>();
  let exactKeyframe: StateKeyframe<T> | undefined;
  let activeKeyframe: StateKeyframe<T> | undefined;

  for (const keyframe of track.keyframes) {
    if (
      keyframe.id.length === 0 ||
      seenIds.has(keyframe.id) ||
      !Number.isFinite(keyframe.time) ||
      keyframe.time < 0 ||
      seenTimes.has(keyframe.time)
    ) {
      return track;
    }

    seenIds.add(keyframe.id);
    seenTimes.add(keyframe.time);

    if (keyframe.time === time) {
      exactKeyframe = keyframe;
    }

    if (
      keyframe.time <= time &&
      (!activeKeyframe || keyframe.time > activeKeyframe.time)
    ) {
      activeKeyframe = keyframe;
    }
  }

  if (!activeKeyframe || Object.is(activeKeyframe.value, value)) {
    return track;
  }

  if (exactKeyframe) {
    return {
      keyframes: track.keyframes.map((keyframe) =>
        keyframe === exactKeyframe ? { ...keyframe, value } : keyframe,
      ),
    };
  }

  const id = createId();

  if (id.length === 0 || seenIds.has(id)) {
    return track;
  }

  return {
    keyframes: [...track.keyframes, { id, time, value }].sort(
      (left, right) => left.time - right.time,
    ),
  };
}

export function setVehicleStateValueAtTime<K extends VehicleStateTrackKey>(
  tracks: VehicleStateTracks,
  key: K,
  options: SetStateTrackValueOptions<VehicleStateValueByTrack[K]>,
): VehicleStateTracks {
  if (!isVehicleStateValue(key, options.value)) {
    return tracks;
  }

  const track = getVehicleStateTrack(tracks, key);
  const nextTrack = setStateTrackValueAtTime(track, options);

  if (nextTrack === track) {
    return tracks;
  }

  return {
    ...tracks,
    [key]: nextTrack,
  } as VehicleStateTracks;
}

interface CreateStateTrackIntervalOptions<T>
  extends CreateVehicleStateIntervalOptions {
  isActive: (value: T) => boolean;
  setActive: (value: T, active: boolean) => T;
  isValidValue: (value: unknown) => value is T;
}

type CreateStateTrackIntervalResult<T> =
  | { status: "created"; track: StateTrack<T> }
  | { status: "occupied" | "invalid"; track: StateTrack<T> };

function createStateTrackInterval<T>(
  track: StateTrack<T>,
  options: CreateStateTrackIntervalOptions<T>,
): CreateStateTrackIntervalResult<T> {
  const startTime = Math.min(options.startTime, options.endTime);
  const endTime = Math.max(options.startTime, options.endTime);

  if (
    !Number.isFinite(startTime) ||
    !Number.isFinite(endTime) ||
    startTime < 0 ||
    startTime === endTime ||
    track.keyframes.length === 0
  ) {
    return { status: "invalid", track };
  }

  const seenIds = new Set<string>();
  const seenTimes = new Set<number>();
  const keyframes = [...track.keyframes].sort(
    (left, right) => left.time - right.time,
  );

  for (const keyframe of keyframes) {
    if (
      keyframe.id.length === 0 ||
      seenIds.has(keyframe.id) ||
      !Number.isFinite(keyframe.time) ||
      keyframe.time < 0 ||
      seenTimes.has(keyframe.time) ||
      !options.isValidValue(keyframe.value)
    ) {
      return { status: "invalid", track };
    }
    seenIds.add(keyframe.id);
    seenTimes.add(keyframe.time);
  }

  if (keyframes[0]?.time !== 0) {
    return { status: "invalid", track };
  }

  const valueAt = (time: number): T | undefined => {
    let value: T | undefined;
    for (const keyframe of keyframes) {
      if (keyframe.time > time) {
        break;
      }
      value = keyframe.value;
    }
    return value;
  };

  const startValue = valueAt(startTime);
  const endValue = valueAt(endTime);
  if (startValue === undefined || endValue === undefined) {
    return { status: "invalid", track };
  }

  if (
    options.isActive(startValue) ||
    keyframes.some(
      (keyframe) =>
        keyframe.time > startTime &&
        keyframe.time < endTime &&
        options.isActive(keyframe.value),
    )
  ) {
    return { status: "occupied", track };
  }

  const startKeyframe = keyframes.find(
    (keyframe) => keyframe.time === startTime,
  );
  const endKeyframe = keyframes.find((keyframe) => keyframe.time === endTime);
  const createdIds = new Set<string>();
  const createBoundaryId = (): string | undefined => {
    const id = options.createId();
    if (id.length === 0 || seenIds.has(id) || createdIds.has(id)) {
      return undefined;
    }
    createdIds.add(id);
    return id;
  };
  const newStartId = startKeyframe ? undefined : createBoundaryId();
  const newEndId = endKeyframe ? undefined : createBoundaryId();

  if ((!startKeyframe && !newStartId) || (!endKeyframe && !newEndId)) {
    return { status: "invalid", track };
  }

  const nextKeyframes = keyframes.map((keyframe) => {
    if (keyframe.time >= startTime && keyframe.time < endTime) {
      const value = options.setActive(keyframe.value, true);
      return Object.is(value, keyframe.value)
        ? keyframe
        : { ...keyframe, value };
    }
    return keyframe;
  });

  if (!startKeyframe) {
    nextKeyframes.push({
      id: newStartId as string,
      time: startTime,
      value: options.setActive(startValue, true),
    });
  }
  if (!endKeyframe) {
    nextKeyframes.push({
      id: newEndId as string,
      time: endTime,
      value: endValue,
    });
  }

  nextKeyframes.sort((left, right) => left.time - right.time);
  const normalizedKeyframes: StateKeyframe<T>[] = [];
  for (const keyframe of nextKeyframes) {
    const previous = normalizedKeyframes[normalizedKeyframes.length - 1];
    if (previous && Object.is(previous.value, keyframe.value)) {
      continue;
    }
    normalizedKeyframes.push(keyframe);
  }

  return {
    status: "created",
    track: { keyframes: normalizedKeyframes },
  };
}

function setIndicatorSide(
  value: IndicatorState,
  side: "left" | "right",
  active: boolean,
): IndicatorState {
  const leftActive = side === "left" ? active : value === "left" || value === "hazard";
  const rightActive = side === "right" ? active : value === "right" || value === "hazard";

  if (leftActive && rightActive) {
    return "hazard";
  }
  if (leftActive) {
    return "left";
  }
  if (rightActive) {
    return "right";
  }
  return "off";
}

export function createVehicleStateInterval(
  tracks: VehicleStateTracks,
  laneKey: VehicleStateLaneKey,
  options: CreateVehicleStateIntervalOptions,
): CreateVehicleStateIntervalResult {
  if (!isVehicleStateLaneKey(laneKey)) {
    return { status: "invalid", tracks };
  }

  if (laneKey === "leftIndicator" || laneKey === "rightIndicator") {
    const side = laneKey === "leftIndicator" ? "left" : "right";
    const result = createStateTrackInterval(tracks.indicator, {
      ...options,
      isActive: (value) => value === side || value === "hazard",
      setActive: (value, active) => setIndicatorSide(value, side, active),
      isValidValue: (value): value is IndicatorState =>
        value === "off" ||
        value === "left" ||
        value === "right" ||
        value === "hazard",
    });

    return result.status === "created"
      ? {
          status: "created",
          tracks: { ...tracks, indicator: result.track },
        }
      : { status: result.status, tracks };
  }

  const result = createStateTrackInterval(tracks[laneKey], {
    ...options,
    isActive: Boolean,
    setActive: (_value, active) => active,
    isValidValue: (value): value is boolean => typeof value === "boolean",
  });

  return result.status === "created"
    ? {
        status: "created",
        tracks: { ...tracks, [laneKey]: result.track },
      }
    : { status: result.status, tracks };
}

interface ActiveInterval {
  startTime: number;
  endTime: number | null;
}

interface EditStateTrackIntervalOptions<T>
  extends EditVehicleStateIntervalOptions {
  isActive: (value: T) => boolean;
  setActive: (value: T, active: boolean) => T;
  isValidValue: (value: unknown) => value is T;
}

type EditStateTrackIntervalResult<T> =
  | { status: "updated" | "deleted"; track: StateTrack<T> }
  | {
      status: "occupied" | "invalid" | "unchanged";
      track: StateTrack<T>;
    };

function rangesOverlap(left: ActiveInterval, right: ActiveInterval): boolean {
  const leftEnd = left.endTime ?? Number.POSITIVE_INFINITY;
  const rightEnd = right.endTime ?? Number.POSITIVE_INFINITY;
  return Math.max(left.startTime, right.startTime) < Math.min(leftEnd, rightEnd);
}

function isTimeInInterval(time: number, interval: ActiveInterval): boolean {
  return (
    time >= interval.startTime &&
    (interval.endTime === null || time < interval.endTime)
  );
}

function editStateTrackInterval<T>(
  track: StateTrack<T>,
  options: EditStateTrackIntervalOptions<T>,
): EditStateTrackIntervalResult<T> {
  const keyframes = [...track.keyframes].sort(
    (left, right) => left.time - right.time,
  );
  const seenIds = new Set<string>();
  const seenTimes = new Set<number>();

  for (const keyframe of keyframes) {
    if (
      keyframe.id.length === 0 ||
      seenIds.has(keyframe.id) ||
      !Number.isFinite(keyframe.time) ||
      keyframe.time < 0 ||
      seenTimes.has(keyframe.time) ||
      !options.isValidValue(keyframe.value)
    ) {
      return { status: "invalid", track };
    }
    seenIds.add(keyframe.id);
    seenTimes.add(keyframe.time);
  }

  if (keyframes[0]?.time !== 0) {
    return { status: "invalid", track };
  }

  const { source, mutation } = options;
  if (
    !Number.isFinite(source.startTime) ||
    source.startTime < 0 ||
    (source.endTime !== null &&
      (!Number.isFinite(source.endTime) ||
        source.endTime <= source.startTime))
  ) {
    return { status: "invalid", track };
  }

  const intervals: ActiveInterval[] = [];
  let active = options.isActive(keyframes[0]!.value);
  let intervalStart = active ? 0 : null;
  for (const keyframe of keyframes.slice(1)) {
    const nextActive = options.isActive(keyframe.value);
    if (!active && nextActive) {
      intervalStart = keyframe.time;
    } else if (active && !nextActive && intervalStart !== null) {
      intervals.push({ startTime: intervalStart, endTime: keyframe.time });
      intervalStart = null;
    }
    active = nextActive;
  }
  if (active && intervalStart !== null) {
    intervals.push({ startTime: intervalStart, endTime: null });
  }

  const sourceIndex = intervals.findIndex(
    (interval) =>
      interval.startTime === source.startTime &&
      interval.endTime === source.endTime,
  );
  if (sourceIndex === -1) {
    return { status: "invalid", track };
  }

  let target: ActiveInterval | null = null;
  if (mutation.type === "move") {
    if (
      source.endTime === null ||
      !Number.isFinite(mutation.startTime) ||
      !Number.isFinite(mutation.endTime) ||
      mutation.startTime < 0 ||
      mutation.endTime <= mutation.startTime ||
      Math.abs(
        mutation.endTime -
          mutation.startTime -
          (source.endTime - source.startTime),
      ) > 1e-9
    ) {
      return { status: "invalid", track };
    }
    target = {
      startTime: mutation.startTime,
      endTime: mutation.endTime,
    };
  } else if (mutation.type === "resize-left") {
    if (
      !Number.isFinite(mutation.startTime) ||
      mutation.startTime < 0 ||
      (source.endTime !== null && mutation.startTime >= source.endTime)
    ) {
      return { status: "invalid", track };
    }
    target = { startTime: mutation.startTime, endTime: source.endTime };
  } else if (mutation.type === "resize-right") {
    if (
      source.endTime === null ||
      !Number.isFinite(mutation.endTime) ||
      mutation.endTime <= source.startTime
    ) {
      return { status: "invalid", track };
    }
    target = { startTime: source.startTime, endTime: mutation.endTime };
  }

  if (
    target?.startTime === source.startTime &&
    target.endTime === source.endTime
  ) {
    return { status: "unchanged", track };
  }

  if (
    target &&
    intervals.some(
      (interval, index) =>
        index !== sourceIndex && rangesOverlap(interval, target as ActiveInterval),
    )
  ) {
    return { status: "occupied", track };
  }

  const valueAt = (time: number): T => {
    let value = keyframes[0]!.value;
    for (const keyframe of keyframes) {
      if (keyframe.time > time) {
        break;
      }
      value = keyframe.value;
    }
    return value;
  };
  const times = new Set(keyframes.map((keyframe) => keyframe.time));
  times.add(source.startTime);
  if (source.endTime !== null) {
    times.add(source.endTime);
  }
  if (target) {
    times.add(target.startTime);
    if (target.endTime !== null) {
      times.add(target.endTime);
    }
  }

  const existingByTime = new Map(
    keyframes.map((keyframe) => [keyframe.time, keyframe]),
  );
  const createdIds = new Set<string>();
  const nextKeyframes: StateKeyframe<T>[] = [];
  for (const time of [...times].sort((left, right) => left - right)) {
    const existing = existingByTime.get(time);
    const originalValue = existing?.value ?? valueAt(time);
    let nextActive = options.isActive(originalValue);
    if (isTimeInInterval(time, source)) {
      nextActive = false;
    }
    if (target && isTimeInInterval(time, target)) {
      nextActive = true;
    }
    const nextValue = options.setActive(originalValue, nextActive);

    if (existing) {
      nextKeyframes.push(
        Object.is(existing.value, nextValue)
          ? existing
          : { ...existing, value: nextValue },
      );
      continue;
    }

    const id = options.createId();
    if (id.length === 0 || seenIds.has(id) || createdIds.has(id)) {
      return { status: "invalid", track };
    }
    createdIds.add(id);
    nextKeyframes.push({ id, time, value: nextValue });
  }

  const normalizedKeyframes: StateKeyframe<T>[] = [];
  for (const keyframe of nextKeyframes) {
    const previous = normalizedKeyframes[normalizedKeyframes.length - 1];
    if (previous && Object.is(previous.value, keyframe.value)) {
      continue;
    }
    normalizedKeyframes.push(keyframe);
  }

  return {
    status: mutation.type === "delete" ? "deleted" : "updated",
    track: { keyframes: normalizedKeyframes },
  };
}

export function editVehicleStateInterval(
  tracks: VehicleStateTracks,
  laneKey: VehicleStateLaneKey,
  options: EditVehicleStateIntervalOptions,
): EditVehicleStateIntervalResult {
  if (!isVehicleStateLaneKey(laneKey)) {
    return { status: "invalid", tracks };
  }

  if (laneKey === "leftIndicator" || laneKey === "rightIndicator") {
    const side = laneKey === "leftIndicator" ? "left" : "right";
    const result = editStateTrackInterval(tracks.indicator, {
      ...options,
      isActive: (value) => value === side || value === "hazard",
      setActive: (value, active) => setIndicatorSide(value, side, active),
      isValidValue: (value): value is IndicatorState =>
        value === "off" ||
        value === "left" ||
        value === "right" ||
        value === "hazard",
    });

    return result.status === "updated" || result.status === "deleted"
      ? {
          status: result.status,
          tracks: { ...tracks, indicator: result.track },
        }
      : { status: result.status, tracks };
  }

  const result = editStateTrackInterval(tracks[laneKey], {
    ...options,
    isActive: Boolean,
    setActive: (_value, active) => active,
    isValidValue: (value): value is boolean => typeof value === "boolean",
  });

  return result.status === "updated" || result.status === "deleted"
    ? {
        status: result.status,
        tracks: { ...tracks, [laneKey]: result.track },
      }
    : { status: result.status, tracks };
}
