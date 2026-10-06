import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";

import { getAssetById } from "../../../assets/assetRegistry";
import {
  getPreviewPlayUnavailableReason,
  presentPreviewAvailability,
} from "../../previewPresentation";
import { getVehicleDisplayName } from "../../vehicleDisplayName";
import {
  getVehicleStateTrackKeyForLane,
  type VehicleStateLaneKey,
} from "../../../model/stateTrack";
import type { VehicleObject } from "../../../model/vehicle";
import { resolvePreviewAvailability } from "../../../preview/availability";
import { useEditorStore } from "../../../store/editorStore";
import { projectStateIntervals, type TimelineStateInterval } from "./stateIntervals";
import {
  calculateTimelineContentWidth,
  clampTimelineTime,
  createTimelineRulerTicks,
  snapTimelineTime,
  TIMELINE_DEFAULT_VISIBLE_SPAN,
  TIMELINE_END_TIME,
  TIMELINE_START_TIME,
  TIMELINE_VISIBLE_SPANS,
  timeToTimelinePercent,
  timelinePositionToTime,
  type TimelineTick,
  type TimelineVisibleSpan,
} from "./timelineRuler";

const TIMELINE_MARKER_SIZE = 16;
const TRACK_LABEL_WIDTH = 176;
const TIMELINE_SCROLL_HORIZONTAL_PADDING = 32;
const FALLBACK_TIME_VIEWPORT_WIDTH = 1000;
const STATE_INTERVAL_HOLD_DELAY_MS = 800;
const STATE_INTERVAL_DRAG_THRESHOLD_PX = 6;
const STATE_INTERVAL_EDIT_THRESHOLD_PX = 4;

interface StateLaneView {
  key: string;
  laneKey: VehicleStateLaneKey;
  label: string;
  colorClass: string;
  intervals: TimelineStateInterval[];
}

interface StateIntervalDrag {
  vehicleId: string;
  laneKey: VehicleStateLaneKey;
  startTime: number;
  currentTime: number;
  startClientX: number;
  currentClientX: number;
  startedAt: number;
  armed: boolean;
}

interface SelectedStateInterval {
  vehicleId: string;
  laneKey: VehicleStateLaneKey;
  laneViewKey: string;
  label: string;
  sourceStartKeyframeId: string;
  startTime: number;
  endTime: number;
  sourceEndTime: number | null;
  endClipped: boolean;
}

interface StateIntervalEditDrag {
  mode: "move" | "resize-left" | "resize-right";
  interval: SelectedStateInterval;
  startClientX: number;
  previewStartTime: number;
  previewEndTime: number;
  armed: boolean;
}

function getLabelTransform(time: number): string {
  if (time === 0) {
    return "translateX(0)";
  }

  if (time === TIMELINE_END_TIME) {
    return "translateX(-100%)";
  }

  return "translateX(-50%)";
}

function getPlayheadAlignment(time: number) {
  if (time === 0) {
    return { transform: "translateX(0)", lineLeft: "0%" };
  }

  if (time === TIMELINE_END_TIME) {
    return { transform: "translateX(-100%)", lineLeft: "100%" };
  }

  return { transform: "translateX(-50%)", lineLeft: "50%" };
}

function getMarkerOffset(time: number): number {
  if (time === 0) {
    return 0;
  }

  if (time === TIMELINE_END_TIME) {
    return -TIMELINE_MARKER_SIZE;
  }

  return -TIMELINE_MARKER_SIZE / 2;
}

function getStateLanes(vehicle: VehicleObject): StateLaneView[] {
  return [
    {
      key: "left-indicator",
      laneKey: "leftIndicator",
      label: "Left indicator",
      colorClass: "bg-amber-400 border-amber-600",
      intervals: projectStateIntervals(
        vehicle.stateTracks.indicator,
        (value) => value === "left" || value === "hazard",
        TIMELINE_START_TIME,
        TIMELINE_END_TIME,
      ),
    },
    {
      key: "right-indicator",
      laneKey: "rightIndicator",
      label: "Right indicator",
      colorClass: "bg-amber-400 border-amber-600",
      intervals: projectStateIntervals(
        vehicle.stateTracks.indicator,
        (value) => value === "right" || value === "hazard",
        TIMELINE_START_TIME,
        TIMELINE_END_TIME,
      ),
    },
    {
      key: "brake-light",
      laneKey: "brakeLight",
      label: "Brake light",
      colorClass: "bg-rose-500 border-rose-700",
      intervals: projectStateIntervals(
        vehicle.stateTracks.brakeLight,
        Boolean,
        TIMELINE_START_TIME,
        TIMELINE_END_TIME,
      ),
    },
    {
      key: "headlight",
      laneKey: "headlight",
      label: "Headlight",
      colorClass: "bg-yellow-300 border-yellow-500",
      intervals: projectStateIntervals(
        vehicle.stateTracks.headlight,
        Boolean,
        TIMELINE_START_TIME,
        TIMELINE_END_TIME,
      ),
    },
    {
      key: "horn",
      laneKey: "horn",
      label: "Horn",
      colorClass: "bg-cyan-500 border-cyan-700",
      intervals: projectStateIntervals(
        vehicle.stateTracks.horn,
        Boolean,
        TIMELINE_START_TIME,
        TIMELINE_END_TIME,
      ),
    },
  ];
}

function TimelineRuler({ ticks }: { ticks: TimelineTick[] }) {
  return (
    <div
      aria-label={`Timeline ruler, ${TIMELINE_START_TIME} to ${TIMELINE_END_TIME} seconds`}
      className="relative h-12"
      role="img"
    >
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-7 border-t border-neutral-500"
      />

      {ticks.map((tick) => (
        <span
          key={tick.time}
          aria-hidden="true"
          className={`absolute top-7 border-l ${
            tick.kind === "major"
              ? "h-5 border-neutral-800"
              : tick.kind === "medium"
                ? "h-3 border-neutral-600"
                : "h-2 border-neutral-400"
          }`}
          data-tick-kind={tick.kind}
          data-time={tick.time}
          style={{ left: `${tick.positionPercent}%` }}
        />
      ))}

      {ticks
        .filter((tick) => tick.kind === "major")
        .map((tick) => (
          <span
            key={`label-${tick.time}`}
            aria-hidden="true"
            className="absolute top-0 whitespace-nowrap font-mono text-xs text-neutral-600"
            data-time-label={tick.time}
            style={{
              left: `${tick.positionPercent}%`,
              transform: getLabelTransform(tick.time),
            }}
          >
            {tick.label}
          </span>
        ))}
    </div>
  );
}

function StateLane({
  vehicleId,
  lane,
  preview,
  editPreview,
  selectedInterval,
  onSelectInterval,
  onBeginIntervalEdit,
  onMouseDown,
}: {
  vehicleId: string;
  lane: StateLaneView;
  preview: { startTime: number; endTime: number } | null;
  editPreview: { startTime: number; endTime: number } | null;
  selectedInterval: SelectedStateInterval | null;
  onSelectInterval: (interval: SelectedStateInterval) => void;
  onBeginIntervalEdit: (
    event: ReactMouseEvent<HTMLElement>,
    mode: StateIntervalEditDrag["mode"],
    interval: SelectedStateInterval,
  ) => void;
  onMouseDown: (event: ReactMouseEvent<HTMLDivElement>) => void;
}) {
  return (
    <div
      aria-label={`${lane.label} intervals`}
      className="relative h-8 cursor-crosshair border-b border-neutral-200 bg-white"
      data-timeline-lane={lane.key}
      data-vehicle-id={vehicleId}
      onMouseDown={onMouseDown}
      role="group"
    >
      {lane.intervals.map((interval, index) => {
        const intervalView: SelectedStateInterval = {
          vehicleId,
          laneKey: lane.laneKey,
          laneViewKey: lane.key,
          label: lane.label,
          sourceStartKeyframeId: interval.sourceStartKeyframeId,
          startTime: interval.startTime,
          endTime: interval.endTime,
          sourceEndTime: interval.sourceEndTime,
          endClipped: interval.endClipped,
        };
        const isSelected =
          selectedInterval?.vehicleId === vehicleId &&
          selectedInterval.laneKey === lane.laneKey &&
          selectedInterval.startTime === interval.startTime &&
          selectedInterval.sourceEndTime === interval.sourceEndTime;

        return (
          <span
            key={`${interval.startTime}-${interval.sourceEndTime}-${index}`}
            className={`absolute top-1.5 z-20 h-5 border ${lane.colorClass} ${
              interval.endClipped ? "border-r-2 border-r-white" : ""
            } ${isSelected ? "ring-2 ring-neutral-900 ring-offset-1" : ""}`}
            data-end-clipped={interval.endClipped ? "true" : "false"}
            data-end-time={interval.endTime}
            data-open-ended={interval.openEnded ? "true" : "false"}
            data-selected={isSelected ? "true" : "false"}
            data-source-end-time={interval.sourceEndTime ?? "open"}
            data-start-time={interval.startTime}
            data-state-interval={lane.key}
            style={{
              left: `${timeToTimelinePercent(interval.startTime)}%`,
              minWidth: "2px",
              width: `${timeToTimelinePercent(interval.endTime) - timeToTimelinePercent(interval.startTime)}%`,
            }}
            title={`${lane.label}: ${interval.startTime.toFixed(1)}s-${interval.endClipped ? "continues" : `${interval.endTime.toFixed(1)}s`}`}
          >
            <button
              type="button"
              aria-label={`Select ${lane.label} interval starting at ${interval.startTime.toFixed(1)} seconds`}
              aria-pressed={isSelected}
              className={`absolute inset-0 border-0 bg-transparent p-0 outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 ${
                interval.endClipped ? "cursor-pointer" : "cursor-grab"
              }`}
              data-interval-body={lane.key}
              onClick={(event) => {
                event.stopPropagation();
                onSelectInterval(intervalView);
              }}
              onMouseDown={(event) => {
                if (!interval.endClipped) {
                  onBeginIntervalEdit(event, "move", intervalView);
                } else {
                  event.stopPropagation();
                }
              }}
            />
            {isSelected ? (
              <button
                type="button"
                aria-label={`Resize ${lane.label} interval start`}
                className="absolute -left-1 top-0 z-30 h-full w-2 cursor-ew-resize border-0 bg-neutral-900 p-0 outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                data-interval-handle="left"
                onClick={(event) => event.stopPropagation()}
                onMouseDown={(event) =>
                  onBeginIntervalEdit(event, "resize-left", intervalView)
                }
              />
            ) : null}
            {isSelected && !interval.endClipped ? (
              <button
                type="button"
                aria-label={`Resize ${lane.label} interval end`}
                className="absolute -right-1 top-0 z-30 h-full w-2 cursor-ew-resize border-0 bg-neutral-900 p-0 outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                data-interval-handle="right"
                onClick={(event) => event.stopPropagation()}
                onMouseDown={(event) =>
                  onBeginIntervalEdit(event, "resize-right", intervalView)
                }
              />
            ) : null}
          </span>
        );
      })}
      {preview ? (
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute top-1.5 z-20 h-5 border-2 border-dashed opacity-70 ${lane.colorClass}`}
          data-state-interval-preview={lane.key}
          style={{
            left: `${timeToTimelinePercent(preview.startTime)}%`,
            minWidth: "2px",
            width: `${timeToTimelinePercent(preview.endTime) - timeToTimelinePercent(preview.startTime)}%`,
          }}
        />
      ) : null}
      {editPreview ? (
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute top-1 z-40 h-6 border-2 border-dashed opacity-70 ${lane.colorClass}`}
          data-state-interval-edit-preview={lane.key}
          style={{
            left: `${timeToTimelinePercent(editPreview.startTime)}%`,
            minWidth: "2px",
            width: `${timeToTimelinePercent(editPreview.endTime) - timeToTimelinePercent(editPreview.startTime)}%`,
          }}
        />
      ) : null}
    </div>
  );
}

export function TimelinePanel() {
  const currentTime = useEditorStore((state) => state.currentTime);
  const setCurrentTime = useEditorStore((state) => state.setCurrentTime);
  const isPreviewPlaying = useEditorStore(
    (state) => state.isPreviewPlaying,
  );
  const startPreviewPlayback = useEditorStore(
    (state) => state.startPreviewPlayback,
  );
  const stopPreviewPlayback = useEditorStore(
    (state) => state.stopPreviewPlayback,
  );
  const project = useEditorStore((state) => state.project);
  const vehicles = project.scene.objects;
  const selectedObjectId = useEditorStore((state) => state.selection.objectId);
  const selectedMovementPointId = useEditorStore(
    (state) => state.selection.movementPointId,
  );
  const selectedStateKeyframeId = useEditorStore(
    (state) => state.selection.stateKeyframeId,
  );
  const selectObject = useEditorStore((state) => state.selectObject);
  const selectMovementPoint = useEditorStore(
    (state) => state.selectMovementPoint,
  );
  const selectStateKeyframe = useEditorStore(
    (state) => state.selectStateKeyframe,
  );
  const updateMovementPointTime = useEditorStore(
    (state) => state.updateMovementPointTime,
  );
  const createVehicleStateInterval = useEditorStore(
    (state) => state.createVehicleStateInterval,
  );
  const editVehicleStateInterval = useEditorStore(
    (state) => state.editVehicleStateInterval,
  );
  const timelineScrollRef = useRef<HTMLDivElement>(null);
  const timelineSurfaceRef = useRef<HTMLDivElement>(null);
  const suppressTimelineClickRef = useRef(false);
  const [visibleSpan, setVisibleSpan] = useState<TimelineVisibleSpan>(
    TIMELINE_DEFAULT_VISIBLE_SPAN,
  );
  const [timeViewportWidth, setTimeViewportWidth] = useState(
    FALLBACK_TIME_VIEWPORT_WIDTH,
  );
  const [collapsedVehicleIds, setCollapsedVehicleIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [draggingPointId, setDraggingPointId] = useState<string | null>(null);
  const [draggingVehicleId, setDraggingVehicleId] = useState<string | null>(
    null,
  );
  const [dragPreviewTime, setDragPreviewTime] = useState<number | null>(null);
  const [timeConflict, setTimeConflict] = useState<number | null>(null);
  const [stateIntervalDrag, setStateIntervalDrag] =
    useState<StateIntervalDrag | null>(null);
  const [stateIntervalError, setStateIntervalError] = useState<
    "occupied" | "invalid" | null
  >(null);
  const [selectedStateInterval, setSelectedStateInterval] =
    useState<SelectedStateInterval | null>(null);
  const [stateIntervalEditDrag, setStateIntervalEditDrag] =
    useState<StateIntervalEditDrag | null>(null);
  const rulerTicks = useMemo(
    () => createTimelineRulerTicks(visibleSpan),
    [visibleSpan],
  );
  const timeContentWidth = calculateTimelineContentWidth(
    timeViewportWidth,
    visibleSpan,
  );
  const visibleTime = clampTimelineTime(currentTime);
  const playheadPosition = timeToTimelinePercent(visibleTime);
  const playheadAlignment = getPlayheadAlignment(visibleTime);
  const previewAvailability = useMemo(
    () => resolvePreviewAvailability(project, currentTime),
    [currentTime, project],
  );
  const playUnavailableReason = getPreviewPlayUnavailableReason(
    presentPreviewAvailability(project, previewAvailability),
  );

  useEffect(() => {
    if (isPreviewPlaying && previewAvailability.status !== "ready") {
      stopPreviewPlayback();
    }
  }, [isPreviewPlaying, previewAvailability.status, stopPreviewPlayback]);

  useLayoutEffect(() => {
    const scrollRegion = timelineScrollRef.current;
    if (!scrollRegion) {
      return undefined;
    }

    const updateTimeViewportWidth = () => {
      const measuredWidth =
        scrollRegion.clientWidth -
        TIMELINE_SCROLL_HORIZONTAL_PADDING -
        TRACK_LABEL_WIDTH;
      if (measuredWidth > 0) {
        setTimeViewportWidth(measuredWidth);
      }
    };

    updateTimeViewportWidth();
    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(updateTimeViewportWidth);
    resizeObserver?.observe(scrollRegion);
    window.addEventListener("resize", updateTimeViewportWidth);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", updateTimeViewportWidth);
    };
  }, []);

  useLayoutEffect(() => {
    const scrollRegion = timelineScrollRef.current;
    if (!scrollRegion || timeContentWidth <= 0) {
      return;
    }

    const playheadX = (visibleTime / TIMELINE_END_TIME) * timeContentWidth;
    const visibleLeft = scrollRegion.scrollLeft;
    const visibleRight = visibleLeft + timeViewportWidth;
    const revealMargin = Math.min(24, timeViewportWidth / 4);

    if (playheadX < visibleLeft + revealMargin) {
      scrollRegion.scrollLeft = Math.max(0, playheadX - revealMargin);
    } else if (playheadX > visibleRight - revealMargin) {
      scrollRegion.scrollLeft = Math.min(
        timeContentWidth - timeViewportWidth,
        playheadX - timeViewportWidth + revealMargin,
      );
    }
  }, [timeContentWidth, timeViewportWidth, visibleSpan, visibleTime]);

  const timeFromClientX = (clientX: number) => {
    const bounds = timelineSurfaceRef.current?.getBoundingClientRect();

    if (!bounds) {
      return 0;
    }

    return snapTimelineTime(
      timelinePositionToTime(clientX - bounds.left, bounds.width),
    );
  };

  useEffect(() => {
    if (!draggingPointId || !draggingVehicleId) {
      return undefined;
    }

    const handleMouseMove = (event: globalThis.MouseEvent) => {
      setDragPreviewTime(timeFromClientX(event.clientX));
    };
    const handleMouseUp = (event: globalThis.MouseEvent) => {
      const time = timeFromClientX(event.clientX);
      const result = updateMovementPointTime(
        draggingVehicleId,
        draggingPointId,
        time,
      );
      setTimeConflict(
        result.status === "duplicate-time" ? result.time : null,
      );
      setDraggingPointId(null);
      setDraggingVehicleId(null);
      setDragPreviewTime(null);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [draggingPointId, draggingVehicleId, updateMovementPointTime]);

  useEffect(() => {
    const startedAt = stateIntervalDrag?.startedAt;

    if (startedAt === undefined) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setStateIntervalDrag((current) => {
        if (
          !current ||
          current.startedAt !== startedAt ||
          current.armed ||
          Math.abs(current.currentClientX - current.startClientX) <
            STATE_INTERVAL_DRAG_THRESHOLD_PX
        ) {
          return current;
        }

        return { ...current, armed: true };
      });
    }, STATE_INTERVAL_HOLD_DELAY_MS);

    return () => window.clearTimeout(timeoutId);
  }, [stateIntervalDrag?.startedAt]);

  useEffect(() => {
    if (!stateIntervalDrag) {
      return undefined;
    }

    const handleMouseMove = (event: globalThis.MouseEvent) => {
      const currentTime = timeFromClientX(event.clientX);
      setStateIntervalDrag((current) => {
        if (!current) {
          return null;
        }

        const heldLongEnough =
          performance.now() - current.startedAt >=
          STATE_INTERVAL_HOLD_DELAY_MS;
        const movedFarEnough =
          Math.abs(event.clientX - current.startClientX) >=
          STATE_INTERVAL_DRAG_THRESHOLD_PX;

        return {
          ...current,
          currentTime,
          currentClientX: event.clientX,
          armed: current.armed || (heldLongEnough && movedFarEnough),
        };
      });
    };
    const handleMouseUp = (event: globalThis.MouseEvent) => {
      const endTime = timeFromClientX(event.clientX);
      const {
        vehicleId,
        laneKey,
        startTime,
        startClientX,
        startedAt,
        armed,
      } = stateIntervalDrag;
      const shouldCreate =
        armed ||
        (performance.now() - startedAt >= STATE_INTERVAL_HOLD_DELAY_MS &&
          Math.abs(event.clientX - startClientX) >=
            STATE_INTERVAL_DRAG_THRESHOLD_PX);

      if (!shouldCreate || startTime === endTime) {
        setCurrentTime(endTime);
      } else {
        suppressTimelineClickRef.current = true;
        const result = createVehicleStateInterval(
          vehicleId,
          laneKey,
          startTime,
          endTime,
        );
        setStateIntervalError(
          result === "created" ? null : result,
        );
      }

      setStateIntervalDrag(null);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [createVehicleStateInterval, setCurrentTime, stateIntervalDrag]);

  useEffect(() => {
    if (!stateIntervalEditDrag) {
      return undefined;
    }

    const previewFromClientX = (clientX: number) => {
      const pointerTime = timeFromClientX(clientX);
      const { interval, mode } = stateIntervalEditDrag;

      if (mode === "move") {
        const duration = interval.endTime - interval.startTime;
        const initialPointerTime = timeFromClientX(
          stateIntervalEditDrag.startClientX,
        );
        const candidateStart = snapTimelineTime(
          interval.startTime + pointerTime - initialPointerTime,
        );
        const startTime = Math.min(
          Math.max(0, candidateStart),
          TIMELINE_END_TIME - duration,
        );
        return {
          startTime: snapTimelineTime(startTime),
          endTime: snapTimelineTime(startTime + duration),
        };
      }

      if (mode === "resize-left") {
        return {
          startTime: Math.min(pointerTime, interval.endTime - 0.1),
          endTime: interval.endTime,
        };
      }

      return {
        startTime: interval.startTime,
        endTime: Math.max(pointerTime, interval.startTime + 0.1),
      };
    };
    const handleMouseMove = (event: globalThis.MouseEvent) => {
      const preview = previewFromClientX(event.clientX);
      setStateIntervalEditDrag((current) =>
        current
          ? {
              ...current,
              previewStartTime: preview.startTime,
              previewEndTime: preview.endTime,
              armed:
                current.armed ||
                Math.abs(event.clientX - current.startClientX) >=
                  STATE_INTERVAL_EDIT_THRESHOLD_PX,
            }
          : null,
      );
    };
    const handleMouseUp = (event: globalThis.MouseEvent) => {
      const preview = previewFromClientX(event.clientX);
      const { interval, mode } = stateIntervalEditDrag;
      const armed =
        stateIntervalEditDrag.armed ||
        Math.abs(event.clientX - stateIntervalEditDrag.startClientX) >=
          STATE_INTERVAL_EDIT_THRESHOLD_PX;

      if (armed) {
        suppressTimelineClickRef.current = true;
        const mutation =
          mode === "move"
            ? {
                type: "move" as const,
                startTime: preview.startTime,
                endTime: preview.endTime,
              }
            : mode === "resize-left"
              ? {
                  type: "resize-left" as const,
                  startTime: preview.startTime,
                }
              : {
                  type: "resize-right" as const,
                  endTime: preview.endTime,
                };
        const result = editVehicleStateInterval(
          interval.vehicleId,
          interval.laneKey,
          {
            startTime: interval.startTime,
            endTime: interval.sourceEndTime,
          },
          mutation,
        );

        if (result === "updated") {
          const vehicle = useEditorStore
            .getState()
            .project.scene.objects.find(
              (candidate) => candidate.id === interval.vehicleId,
            );
          const trackKey = getVehicleStateTrackKeyForLane(interval.laneKey);
          const sourceStartKeyframe = vehicle?.stateTracks[
            trackKey
          ].keyframes.find((keyframe) => keyframe.time === preview.startTime);

          if (sourceStartKeyframe) {
            const nextInterval = {
              ...interval,
              sourceStartKeyframeId: sourceStartKeyframe.id,
              startTime: preview.startTime,
              endTime: preview.endTime,
              sourceEndTime:
                mode === "resize-left"
                  ? interval.sourceEndTime
                  : preview.endTime,
            };
            setSelectedStateInterval(nextInterval);
            selectStateKeyframe(interval.vehicleId, sourceStartKeyframe.id);
          } else {
            setSelectedStateInterval(null);
          }
          setStateIntervalError(null);
        } else if (result === "occupied" || result === "invalid") {
          setStateIntervalError(result);
        }
      }

      setStateIntervalEditDrag(null);
    };
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }
      event.preventDefault();
      setStateIntervalEditDrag(null);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    editVehicleStateInterval,
    selectStateKeyframe,
    stateIntervalEditDrag,
  ]);

  useEffect(() => {
    if (!selectedStateInterval) {
      return;
    }

    const stillExists = vehicles.some((vehicle) =>
      vehicle.id === selectedStateInterval.vehicleId
        ? getStateLanes(vehicle).some(
            (lane) =>
              lane.laneKey === selectedStateInterval.laneKey &&
              lane.intervals.some(
                (interval) =>
                  interval.startTime === selectedStateInterval.startTime &&
                  interval.sourceEndTime ===
                    selectedStateInterval.sourceEndTime,
              ),
          )
        : false,
    );

    if (!stillExists) {
      setSelectedStateInterval(null);
    }
  }, [selectedStateInterval, vehicles]);

  useEffect(() => {
    if (
      selectedStateInterval &&
      (selectedObjectId !== selectedStateInterval.vehicleId ||
        selectedStateKeyframeId !==
          selectedStateInterval.sourceStartKeyframeId)
    ) {
      setSelectedStateInterval(null);
    }
  }, [
    selectedObjectId,
    selectedStateInterval,
    selectedStateKeyframeId,
  ]);

  const deleteSelectedStateInterval = () => {
    if (!selectedStateInterval) {
      return;
    }

    const result = editVehicleStateInterval(
      selectedStateInterval.vehicleId,
      selectedStateInterval.laneKey,
      {
        startTime: selectedStateInterval.startTime,
        endTime: selectedStateInterval.sourceEndTime,
      },
      { type: "delete" },
    );
    if (result === "deleted") {
      setSelectedStateInterval(null);
      setStateIntervalError(null);
      selectObject(selectedStateInterval.vehicleId);
    } else if (result === "occupied" || result === "invalid") {
      setStateIntervalError(result);
    }
  };

  useEffect(() => {
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (
        !selectedStateInterval ||
        stateIntervalEditDrag ||
        (event.key !== "Delete" && event.key !== "Backspace") ||
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      event.preventDefault();
      deleteSelectedStateInterval();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedStateInterval, stateIntervalEditDrag]);

  const handleTimelineClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (suppressTimelineClickRef.current) {
      suppressTimelineClickRef.current = false;
      return;
    }

    const bounds = event.currentTarget.getBoundingClientRect();
    const rawTime = timelinePositionToTime(
      event.clientX - bounds.left,
      bounds.width,
    );
    setTimeConflict(null);
    setStateIntervalError(null);
    setSelectedStateInterval(null);
    setCurrentTime(snapTimelineTime(rawTime));
  };

  const beginStateIntervalEdit = (
    event: ReactMouseEvent<HTMLElement>,
    mode: StateIntervalEditDrag["mode"],
    interval: SelectedStateInterval,
  ) => {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    setTimeConflict(null);
    setStateIntervalError(null);
    setSelectedStateInterval(interval);
    setStateIntervalEditDrag({
      mode,
      interval,
      startClientX: event.clientX,
      previewStartTime: interval.startTime,
      previewEndTime: interval.endTime,
      armed: mode !== "move",
    });
  };

  const beginStateIntervalDrag = (
    event: ReactMouseEvent<HTMLDivElement>,
    vehicleId: string,
    laneKey: VehicleStateLaneKey,
  ) => {
    if (
      event.button !== 0 ||
      (event.target as HTMLElement).closest("[data-state-interval]")
    ) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    const startTime = timeFromClientX(event.clientX);
    setTimeConflict(null);
    setStateIntervalError(null);
    setSelectedStateInterval(null);
    setStateIntervalDrag({
      vehicleId,
      laneKey,
      startTime,
      currentTime: startTime,
      startClientX: event.clientX,
      currentClientX: event.clientX,
      startedAt: performance.now(),
      armed: false,
    });
  };

  const toggleVehicle = (vehicleId: string) => {
    setCollapsedVehicleIds((current) => {
      const next = new Set(current);
      if (next.has(vehicleId)) {
        next.delete(vehicleId);
      } else {
        next.add(vehicleId);
      }
      return next;
    });
  };

  return (
    <section
      aria-labelledby="timeline-heading"
      className="flex min-h-0 flex-col border-t border-neutral-300 bg-white"
    >
      <div className="flex items-start justify-between gap-4 border-b border-neutral-300 px-4 py-2">
        <h2
          id="timeline-heading"
          className="text-sm font-semibold text-neutral-900"
        >
          Timeline
        </h2>
        <div className="flex items-start gap-4">
          <button
            aria-label={
              isPreviewPlaying ? "Pause preview" : "Play preview"
            }
            aria-describedby={
              playUnavailableReason === null
                ? undefined
                : "preview-play-unavailable-reason"
            }
            className="flex h-7 min-w-20 items-center justify-center gap-1.5 border border-neutral-400 bg-white px-2 text-xs font-medium text-neutral-800 hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-400"
            data-preview-playing={isPreviewPlaying}
            data-testid="preview-play-button"
            disabled={playUnavailableReason !== null}
            onClick={
              isPreviewPlaying ? stopPreviewPlayback : startPreviewPlayback
            }
            type="button"
          >
            <span aria-hidden="true">{isPreviewPlaying ? "Ⅱ" : "▶"}</span>
            <span>{isPreviewPlaying ? "Pause" : "Play"}</span>
          </button>
          {playUnavailableReason === null ? null : (
            <span className="sr-only" id="preview-play-unavailable-reason">
              {playUnavailableReason}
            </span>
          )}
          <div
            aria-label="Visible timeline span"
            className="flex h-7 border border-neutral-300 bg-white"
            role="radiogroup"
          >
            {TIMELINE_VISIBLE_SPANS.map((span) => {
              const isSelected = visibleSpan === span;

              return (
                <button
                  key={span}
                  aria-checked={isSelected}
                  className={`min-w-11 border-0 border-r border-neutral-300 px-2 font-mono text-xs outline-none last:border-r-0 focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-emerald-600 ${
                    isSelected
                      ? "bg-emerald-700 text-white"
                      : "bg-white text-neutral-700 hover:bg-neutral-100"
                  }`}
                  data-visible-span={span}
                  onClick={() => setVisibleSpan(span)}
                  role="radio"
                  type="button"
                >
                  {span}s
                </button>
              );
            })}
          </div>
          <div className="min-w-72 text-right">
            <p
              aria-live="polite"
              className="font-mono text-xs tabular-nums text-neutral-600"
            >
              Current time: {currentTime.toFixed(2)}s
            </p>
            <div className="min-h-5 pt-1 text-xs">
              {selectedStateInterval ? (
                <button
                  type="button"
                  className="mr-3 border border-neutral-400 bg-white px-2 py-0.5 font-medium text-neutral-800 hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                  onClick={deleteSelectedStateInterval}
                >
                  Delete interval
                </button>
              ) : null}
              {timeConflict === null ? null : (
                <p className="text-red-700" role="alert">
                  A movement point already exists at {timeConflict.toFixed(2)}s.
                </p>
              )}
              {stateIntervalError === "occupied" ? (
                <p className="text-red-700" role="alert">
                  That part of the track already has an active interval.
                </p>
              ) : null}
              {stateIntervalError === "invalid" ? (
                <p className="text-red-700" role="alert">
                  The interval could not be created.
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div
        ref={timelineScrollRef}
        className="min-h-0 flex-1 overflow-auto bg-neutral-50 px-4"
        data-testid="timeline-scroll-region"
      >
        <div
          className="grid"
          style={{
            gridTemplateColumns: `${TRACK_LABEL_WIDTH}px ${timeContentWidth}px`,
            width: TRACK_LABEL_WIDTH + timeContentWidth,
          }}
        >
          <div className="sticky left-0 z-30 border-r border-neutral-300 bg-neutral-100">
            <div className="flex h-12 items-center px-3 text-xs font-semibold uppercase text-neutral-500">
              Tracks
            </div>
            {vehicles.length === 0 ? (
              <div className="flex h-12 items-center px-3 text-xs text-neutral-500">
                No vehicles
              </div>
            ) : (
              vehicles.map((vehicle) => {
                const asset = getAssetById(vehicle.assetId);
                const vehicleName = getVehicleDisplayName(vehicles, vehicle);
                const isExpanded = !collapsedVehicleIds.has(vehicle.id);
                const isSelected = selectedObjectId === vehicle.id;
                const stateLanes = getStateLanes(vehicle);

                return (
                  <div
                    key={vehicle.id}
                    data-selected={isSelected ? "true" : "false"}
                    data-vehicle-timeline-group={vehicle.id}
                  >
                    <div
                      className={`flex h-8 border-b border-neutral-300 ${
                        isSelected ? "bg-emerald-100" : "bg-neutral-200"
                      }`}
                    >
                      <button
                        type="button"
                        aria-expanded={isExpanded}
                        aria-label={`${isExpanded ? "Collapse" : "Expand"} ${vehicleName} tracks`}
                        className="grid h-8 w-8 shrink-0 place-items-center bg-transparent text-sm text-neutral-900 outline-none hover:bg-neutral-300 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-600"
                        data-vehicle-timeline-toggle={vehicle.id}
                        onClick={() => toggleVehicle(vehicle.id)}
                      >
                        <span
                          aria-hidden="true"
                          className={`transition-transform ${isExpanded ? "rotate-90" : ""}`}
                        >
                          &gt;
                        </span>
                      </button>
                      <button
                        type="button"
                        aria-label={`Select ${vehicleName}`}
                        aria-pressed={isSelected}
                        className="flex h-8 min-w-0 flex-1 items-center gap-2 bg-transparent pr-2 text-left text-xs font-semibold text-neutral-900 outline-none hover:bg-neutral-300 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-600"
                        data-vehicle-timeline-select={vehicle.id}
                        onClick={() => selectObject(vehicle.id)}
                      >
                        {asset ? (
                          <img
                            alt=""
                            className="h-5 w-9 object-contain"
                            src={asset.src}
                          />
                        ) : (
                          <span
                            aria-hidden="true"
                            className="h-5 w-9 border border-dashed border-neutral-400"
                          />
                        )}
                        <span className="min-w-0 truncate">{vehicleName}</span>
                      </button>
                    </div>
                    {isExpanded ? (
                      <div id={`vehicle-track-labels-${vehicle.id}`}>
                        <div
                          className="flex h-8 items-center border-b border-neutral-200 bg-white px-4 text-xs font-medium text-neutral-800"
                          id={`lane-label-${vehicle.id}-movement`}
                        >
                          Movement
                        </div>
                        {stateLanes.map((lane) => (
                          <div
                            key={lane.key}
                            className="flex h-8 items-center border-b border-neutral-200 bg-white px-4 text-xs text-neutral-600"
                            id={`lane-label-${vehicle.id}-${lane.key}`}
                          >
                            {lane.label}
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>

          <div
            ref={timelineSurfaceRef}
            aria-label={`Timeline, ${TIMELINE_START_TIME} to ${TIMELINE_END_TIME} seconds, click to set current time`}
            className="relative min-w-0 cursor-crosshair select-none"
            data-testid="timeline-time-surface"
            onClick={handleTimelineClick}
            role="group"
          >
            <TimelineRuler ticks={rulerTicks} />

            {vehicles.length === 0 ? (
              <div
                aria-hidden="true"
                className="h-12 border-b border-neutral-200 bg-white"
              />
            ) : (
              vehicles.map((vehicle) => {
                const isExpanded = !collapsedVehicleIds.has(vehicle.id);
                const isSelected = selectedObjectId === vehicle.id;
                const stateLanes = getStateLanes(vehicle);

                return (
                  <div
                    key={vehicle.id}
                    data-vehicle-time-rows={vehicle.id}
                  >
                    <div
                      aria-hidden="true"
                      className={`h-8 border-b border-neutral-300 ${
                        isSelected ? "bg-emerald-50" : "bg-neutral-100"
                      }`}
                    />
                    {isExpanded ? (
                      <div id={`vehicle-track-rows-${vehicle.id}`}>
                        <div
                          aria-labelledby={`lane-label-${vehicle.id}-movement`}
                          className="relative h-8 border-b border-neutral-200 bg-white"
                          data-timeline-lane="movement"
                          data-vehicle-id={vehicle.id}
                          role="group"
                        >
                          {vehicle.movement.points.map((point) => {
                            const isSelected =
                              vehicle.id === selectedObjectId &&
                              point.id === selectedMovementPointId;
                            const isInitialPoint = point.time === 0;
                            const displayedTime =
                              point.id === draggingPointId &&
                              vehicle.id === draggingVehicleId &&
                              dragPreviewTime !== null
                                ? dragPreviewTime
                                : point.time;

                            return (
                              <button
                                key={point.id}
                                type="button"
                                aria-label={`Select movement point at ${point.time.toFixed(2)} seconds`}
                                aria-pressed={isSelected}
                                className={`absolute top-1/2 z-20 h-4 w-4 border-0 bg-transparent p-0 outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 ${
                                  isInitialPoint
                                    ? "cursor-pointer"
                                    : "cursor-ew-resize"
                                }`}
                                data-draggable={
                                  isInitialPoint ? "false" : "true"
                                }
                                data-movement-point-id={point.id}
                                data-selected={isSelected ? "true" : "false"}
                                data-vehicle-id={vehicle.id}
                                onMouseDown={
                                  isInitialPoint
                                    ? undefined
                                    : (event) => {
                                        event.preventDefault();
                                        event.stopPropagation();
                                        setTimeConflict(null);
                                        selectMovementPoint(
                                          vehicle.id,
                                          point.id,
                                        );
                                        setDraggingVehicleId(vehicle.id);
                                        setDraggingPointId(point.id);
                                        setDragPreviewTime(point.time);
                                      }
                                }
                                onClick={(event) => {
                                  event.stopPropagation();
                                  selectMovementPoint(vehicle.id, point.id);
                                }}
                                style={{
                                  left: `${timeToTimelinePercent(displayedTime)}%`,
                                  marginLeft: getMarkerOffset(displayedTime),
                                  marginTop: -TIMELINE_MARKER_SIZE / 2,
                                }}
                              >
                                <span
                                  aria-hidden="true"
                                  className={`block h-4 w-4 rotate-45 border-2 transition-colors ${
                                    isSelected
                                      ? "border-emerald-900 bg-emerald-500"
                                      : "border-neutral-700 bg-white hover:bg-emerald-100"
                                  }`}
                                />
                              </button>
                            );
                          })}
                        </div>
                        {stateLanes.map((lane) => (
                          <StateLane
                            key={lane.key}
                            lane={lane}
                            editPreview={
                              stateIntervalEditDrag?.armed &&
                              stateIntervalEditDrag.interval.vehicleId ===
                                vehicle.id &&
                              stateIntervalEditDrag.interval.laneKey ===
                                lane.laneKey
                                ? {
                                    startTime:
                                      stateIntervalEditDrag.previewStartTime,
                                    endTime:
                                      stateIntervalEditDrag.previewEndTime,
                                  }
                                : null
                            }
                            onBeginIntervalEdit={beginStateIntervalEdit}
                            onMouseDown={(event) =>
                              beginStateIntervalDrag(
                                event,
                                vehicle.id,
                                lane.laneKey,
                              )
                            }
                            onSelectInterval={(interval) => {
                              setStateIntervalError(null);
                              setSelectedStateInterval(interval);
                              selectStateKeyframe(
                                interval.vehicleId,
                                interval.sourceStartKeyframeId,
                              );
                            }}
                            preview={
                              stateIntervalDrag?.armed &&
                              stateIntervalDrag.vehicleId === vehicle.id &&
                              stateIntervalDrag.laneKey === lane.laneKey
                                ? {
                                    startTime: Math.min(
                                      stateIntervalDrag.startTime,
                                      stateIntervalDrag.currentTime,
                                    ),
                                    endTime: Math.max(
                                      stateIntervalDrag.startTime,
                                      stateIntervalDrag.currentTime,
                                    ),
                                  }
                                : null
                            }
                            selectedInterval={selectedStateInterval}
                            vehicleId={vehicle.id}
                          />
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}

            {rulerTicks
              .filter(
                (tick) =>
                  tick.kind === "major" &&
                  tick.time > TIMELINE_START_TIME &&
                  tick.time < TIMELINE_END_TIME,
              )
              .map((tick) => (
                <span
                  key={`grid-${tick.time}`}
                  aria-hidden="true"
                  className="pointer-events-none absolute bottom-0 top-12 z-[1] border-l border-neutral-100"
                  style={{ left: `${tick.positionPercent}%` }}
                />
              ))}

            <div
              aria-hidden="true"
              className="pointer-events-none absolute bottom-0 top-6 z-10 w-3"
              data-current-time={currentTime}
              data-testid="timeline-playhead"
              style={{
                left: `${playheadPosition}%`,
                transform: playheadAlignment.transform,
              }}
            >
              <span className="block h-3 w-3 rounded-sm bg-rose-600 shadow-sm" />
              <span
                className="absolute bottom-0 top-2 w-0.5 -translate-x-1/2 bg-rose-600"
                style={{ left: playheadAlignment.lineLeft }}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
