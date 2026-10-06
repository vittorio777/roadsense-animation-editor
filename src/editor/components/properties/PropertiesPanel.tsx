import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

import { getAssetById } from "../../../assets/assetRegistry";
import {
  findVehicleStateKeyframe,
  resolveStateValueAtTime,
  type IndicatorState,
  type VehicleStateTrackKey,
} from "../../../model/stateTrack";
import { composePreviewSceneState } from "../../../preview/sceneState";
import { useEditorStore } from "../../../store/editorStore";
import { ConfirmationDialog } from "../ConfirmationDialog";
import { clampVehiclePosition } from "../scene/vehicleDragging";
import {
  snapTimelineTime,
  TIMELINE_END_TIME,
} from "../timeline/timelineRuler";

interface PositionFieldsProps {
  vehicleId: string;
  movementPointId: string | undefined;
  x: number;
  y: number;
  sceneWidth: number;
  sceneHeight: number;
  vehicleWidth: number;
  vehicleHeight: number;
}

const indicatorOptions: Array<{
  label: string;
  value: IndicatorState;
}> = [
  { label: "Off", value: "off" },
  { label: "Left", value: "left" },
  { label: "Right", value: "right" },
  { label: "Hazard", value: "hazard" },
];

const stateTrackLabels: Record<VehicleStateTrackKey, string> = {
  indicator: "Indicator",
  brakeLight: "Brake light",
  headlight: "Headlight",
  horn: "Horn",
};

function formatStateKeyframeValue(value: IndicatorState | boolean): string {
  if (typeof value === "boolean") {
    return value ? "On" : "Off";
  }

  return value.charAt(0).toUpperCase() + value.slice(1);
}

interface IndicatorFieldProps {
  vehicleId: string;
  value: IndicatorState | undefined;
}

function IndicatorField({ vehicleId, value }: IndicatorFieldProps) {
  const updateVehicleStateAtCurrentTime = useEditorStore(
    (state) => state.updateVehicleStateAtCurrentTime,
  );

  return (
    <fieldset className="mt-4">
      <legend className="text-xs font-semibold uppercase text-neutral-500">
        Indicator
      </legend>
      <div
        aria-label="Indicator"
        className="mt-3 grid grid-cols-2 gap-2"
        role="radiogroup"
      >
        {indicatorOptions.map((option) => {
          const isSelected = value === option.value;

          return (
            <button
              aria-checked={isSelected}
              className={`h-9 border px-2 text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-1 ${
                isSelected
                  ? "border-emerald-700 bg-emerald-700 text-white"
                  : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100"
              }`}
              key={option.value}
              onClick={() =>
                updateVehicleStateAtCurrentTime(
                  vehicleId,
                  "indicator",
                  option.value,
                )
              }
              role="radio"
              type="button"
            >
              {option.label}
            </button>
          );
        })}
      </div>
      {value === undefined ? (
        <p className="mt-2 text-xs leading-5 text-red-700" role="alert">
          Indicator data is unavailable.
        </p>
      ) : null}
    </fieldset>
  );
}

type BooleanStateTrackKey = Exclude<VehicleStateTrackKey, "indicator">;

interface BooleanStateFieldProps {
  label: string;
  trackKey: BooleanStateTrackKey;
  value: boolean | undefined;
  vehicleId: string;
}

function BooleanStateField({
  label,
  trackKey,
  value,
  vehicleId,
}: BooleanStateFieldProps) {
  const updateVehicleStateAtCurrentTime = useEditorStore(
    (state) => state.updateVehicleStateAtCurrentTime,
  );
  const isOn = value === true;

  return (
    <div className="mt-4 border-t border-neutral-200 pt-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-xs font-semibold uppercase text-neutral-500">
            {label}
          </h3>
          <p className="mt-1 text-sm font-medium text-neutral-900">
            {isOn ? "On" : "Off"}
          </p>
        </div>
        <button
          aria-checked={isOn}
          aria-label={label}
          className={`relative h-7 w-12 shrink-0 border p-1 outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
            isOn
              ? "border-emerald-700 bg-emerald-700"
              : "border-neutral-400 bg-neutral-200"
          }`}
          disabled={value === undefined}
          onClick={() =>
            updateVehicleStateAtCurrentTime(vehicleId, trackKey, !isOn)
          }
          role="switch"
          type="button"
        >
          <span
            className={`block h-4 w-4 bg-white shadow-sm transition-transform ${
              isOn ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </div>
      {value === undefined ? (
        <p className="mt-2 text-xs leading-5 text-red-700" role="alert">
          {label} data is unavailable.
        </p>
      ) : null}
    </div>
  );
}

function formatCoordinate(value: number): string {
  return String(Math.round(value * 100) / 100);
}

function formatTime(value: number): string {
  return String(Math.round(value * 10) / 10);
}

interface PointTimeFieldProps {
  vehicleId: string;
  movementPointId: string;
  time: number;
}

function PointTimeField({
  vehicleId,
  movementPointId,
  time,
}: PointTimeFieldProps) {
  const updateMovementPointTime = useEditorStore(
    (state) => state.updateMovementPointTime,
  );
  const [timeInput, setTimeInput] = useState(formatTime(time));
  const [timeConflict, setTimeConflict] = useState<number | null>(null);

  useEffect(() => {
    setTimeInput(formatTime(time));
    setTimeConflict(null);
  }, [movementPointId, time]);

  const commitTime = () => {
    const value = Number(timeInput.trim());

    if (timeInput.trim() === "" || !Number.isFinite(value)) {
      setTimeInput(formatTime(time));
      setTimeConflict(null);
      return;
    }

    const snappedTime = snapTimelineTime(value);
    const result = updateMovementPointTime(
      vehicleId,
      movementPointId,
      snappedTime,
    );
    const savedPoint = useEditorStore
      .getState()
      .project.scene.objects.find((object) => object.id === vehicleId)
      ?.movement.points.find((point) => point.id === movementPointId);
    setTimeInput(formatTime(savedPoint?.time ?? time));
    setTimeConflict(
      result.status === "duplicate-time" ? result.time : null,
    );
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commitTime();
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setTimeInput(formatTime(time));
      setTimeConflict(null);
    }
  };

  return (
    <label className="block text-xs font-medium text-neutral-500">
      Time
      <div className="relative mt-1">
        <input
          aria-label="Movement point time"
          className="h-9 w-full border border-neutral-300 bg-white px-2 pr-7 font-mono text-sm text-neutral-900 outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
          inputMode="decimal"
          max={TIMELINE_END_TIME}
          min="0"
          step="0.1"
          type="number"
          value={timeInput}
          onBlur={commitTime}
          aria-describedby={timeConflict === null ? undefined : "movement-time-error"}
          aria-invalid={timeConflict === null ? undefined : true}
          onChange={(event) => {
            setTimeInput(event.target.value);
            setTimeConflict(null);
          }}
          onKeyDown={handleKeyDown}
        />
        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 font-mono text-xs text-neutral-500">
          s
        </span>
      </div>
      {timeConflict === null ? null : (
        <span
          id="movement-time-error"
          className="mt-2 block text-xs leading-5 text-red-700"
          role="alert"
        >
          A movement point already exists at {timeConflict.toFixed(2)}s.
        </span>
      )}
    </label>
  );
}

function PositionFields({
  vehicleId,
  movementPointId,
  x,
  y,
  sceneWidth,
  sceneHeight,
  vehicleWidth,
  vehicleHeight,
}: PositionFieldsProps) {
  const updateVehiclePosition = useEditorStore(
    (state) => state.updateVehiclePosition,
  );
  const updateMovementPointPosition = useEditorStore(
    (state) => state.updateMovementPointPosition,
  );
  const [xInput, setXInput] = useState(formatCoordinate(x));
  const [yInput, setYInput] = useState(formatCoordinate(y));

  useEffect(() => {
    setXInput(formatCoordinate(x));
    setYInput(formatCoordinate(y));
  }, [movementPointId, vehicleId, x, y]);

  const commitPosition = (axis: "x" | "y") => {
    const input = axis === "x" ? xInput : yInput;
    const value = Number(input.trim());
    const savedValue = axis === "x" ? x : y;

    if (input.trim() === "" || !Number.isFinite(value)) {
      if (axis === "x") {
        setXInput(formatCoordinate(x));
      } else {
        setYInput(formatCoordinate(y));
      }
      return;
    }

    if (input.trim() === formatCoordinate(savedValue)) {
      return;
    }

    const position = clampVehiclePosition(
      axis === "x" ? { x: value, y } : { x, y: value },
      sceneWidth,
      sceneHeight,
      vehicleWidth,
      vehicleHeight,
    );

    if (movementPointId) {
      updateMovementPointPosition(
        vehicleId,
        movementPointId,
        position.x,
        position.y,
      );
    } else {
      updateVehiclePosition(vehicleId, position.x, position.y);
    }
    setXInput(formatCoordinate(position.x));
    setYInput(formatCoordinate(position.y));
  };

  const handleKeyDown = (
    event: KeyboardEvent<HTMLInputElement>,
    axis: "x" | "y",
  ) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commitPosition(axis);
    }

    if (event.key === "Escape") {
      event.preventDefault();
      if (axis === "x") {
        setXInput(formatCoordinate(x));
      } else {
        setYInput(formatCoordinate(y));
      }
    }
  };

  const inputClassName =
    "mt-1 h-9 w-full border border-neutral-300 bg-white px-2 text-sm text-neutral-900 outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600";

  return (
    <fieldset className="mt-5 border-t border-neutral-200 pt-4">
      <legend className="text-xs font-semibold uppercase text-neutral-500">
        {movementPointId ? "Point position" : "Position"}
      </legend>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <label className="block text-xs font-medium text-neutral-600">
          X
          <input
            aria-label="Position X"
            className={inputClassName}
            inputMode="decimal"
            step="any"
            type="number"
            value={xInput}
            onBlur={() => commitPosition("x")}
            onChange={(event) => setXInput(event.target.value)}
            onKeyDown={(event) => handleKeyDown(event, "x")}
          />
        </label>
        <label className="block text-xs font-medium text-neutral-600">
          Y
          <input
            aria-label="Position Y"
            className={inputClassName}
            inputMode="decimal"
            step="any"
            type="number"
            value={yInput}
            onBlur={() => commitPosition("y")}
            onChange={(event) => setYInput(event.target.value)}
            onKeyDown={(event) => handleKeyDown(event, "y")}
          />
        </label>
      </div>
    </fieldset>
  );
}

export function PropertiesPanel() {
  const deleteVehicleButtonRef = useRef<HTMLButtonElement>(null);
  const deleteMovementPointButtonRef = useRef<HTMLButtonElement>(null);
  const [deletionConfirmation, setDeletionConfirmation] = useState<
    | {
        type: "vehicle";
        assetName: string;
        vehicleId: string;
      }
    | {
        type: "movement-point";
        pointId: string;
        time: number;
        vehicleId: string;
      }
    | null
  >(null);
  const selectedObjectId = useEditorStore(
    (state) => state.selection.objectId,
  );
  const selectedMovementPointId = useEditorStore(
    (state) => state.selection.movementPointId,
  );
  const selectedPathId = useEditorStore((state) => state.selection.pathId);
  const selectedStateKeyframeId = useEditorStore(
    (state) => state.selection.stateKeyframeId,
  );
  const project = useEditorStore((state) => state.project);
  const selectedVehicle = project.scene.objects.find(
    (object) => object.id === selectedObjectId,
  );
  const selectedAsset = selectedVehicle
    ? getAssetById(selectedVehicle.assetId)
    : undefined;
  const currentTime = useEditorStore((state) => state.currentTime);
  const previewResult = useMemo(
    () => composePreviewSceneState(project, currentTime),
    [currentTime, project],
  );
  const previewVehicle =
    previewResult.status === "composed"
      ? previewResult.scene.vehicles.find(
          (vehicle) => vehicle.id === selectedObjectId,
        )
      : undefined;
  const deleteMovementPoint = useEditorStore(
    (state) => state.deleteMovementPoint,
  );
  const deleteVehicle = useEditorStore((state) => state.deleteVehicle);
  const selectedMovementPoint = selectedVehicle?.movement.points.find(
    (point) => point.id === selectedMovementPointId,
  );
  const selectedPath = selectedVehicle?.movement.paths.find(
    (path) => path.id === selectedPathId,
  );
  const selectedStateKeyframe =
    selectedVehicle && selectedStateKeyframeId
      ? findVehicleStateKeyframe(
          selectedVehicle.stateTracks,
          selectedStateKeyframeId,
        )
      : undefined;
  const indicatorValue = selectedVehicle
    ? resolveStateValueAtTime(selectedVehicle.stateTracks.indicator, currentTime)
    : undefined;
  const brakeLightValue = selectedVehicle
    ? resolveStateValueAtTime(
        selectedVehicle.stateTracks.brakeLight,
        currentTime,
      )
    : undefined;
  const headlightValue = selectedVehicle
    ? resolveStateValueAtTime(selectedVehicle.stateTracks.headlight, currentTime)
    : undefined;
  const hornValue = selectedVehicle
    ? resolveStateValueAtTime(selectedVehicle.stateTracks.horn, currentTime)
    : undefined;
  const editingPosition = selectedMovementPoint ?? previewVehicle;
  const sceneWidth = project.scene.width;
  const sceneHeight = project.scene.height;

  return (
    <aside
      aria-labelledby="properties-heading"
      className="flex min-h-0 flex-col border-l border-neutral-300 bg-neutral-50"
    >
      <div className="border-b border-neutral-300 px-4 py-3">
        <h2
          id="properties-heading"
          className="text-sm font-semibold text-neutral-900"
        >
          Properties
        </h2>
      </div>

      {selectedVehicle ? (
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className="border-b border-neutral-200 pb-3">
            <p className="text-xs font-semibold uppercase text-neutral-500">
              Selected object
            </p>
            <p className="mt-1 text-base font-semibold text-neutral-900">
              {selectedAsset?.name ?? "Vehicle"}
            </p>
          </div>

          <dl className="mt-4 grid gap-4 text-sm">
            <div>
              <dt className="text-xs font-medium text-neutral-500">Type</dt>
              <dd className="mt-1 text-neutral-900">Vehicle</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-neutral-500">Asset</dt>
              <dd className="mt-1 text-neutral-900">
                {selectedAsset?.name ?? selectedVehicle.assetId}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-neutral-500">
                Instance ID
              </dt>
              <dd className="mt-1 break-all font-mono text-xs leading-5 text-neutral-700">
                {selectedObjectId}
              </dd>
            </div>
          </dl>

          <button
            aria-haspopup="dialog"
            className="mt-4 h-9 w-full border border-red-300 bg-white px-3 text-sm font-medium text-red-700 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-600 focus:ring-offset-2"
            onClick={() =>
              setDeletionConfirmation({
                type: "vehicle",
                assetName: selectedAsset?.name ?? selectedVehicle.assetId,
                vehicleId: selectedVehicle.id,
              })
            }
            ref={deleteVehicleButtonRef}
            type="button"
          >
            Delete vehicle
          </button>

          <section
            aria-labelledby="vehicle-state-heading"
            className="mt-5 border-t border-neutral-200 pt-4"
          >
            <h3
              id="vehicle-state-heading"
              className="text-xs font-semibold uppercase text-neutral-500"
            >
              State at {currentTime.toFixed(2)}s
            </h3>
            <IndicatorField
              vehicleId={selectedVehicle.id}
              value={indicatorValue}
            />
            <BooleanStateField
              label="Brake light"
              trackKey="brakeLight"
              value={brakeLightValue}
              vehicleId={selectedVehicle.id}
            />
            <BooleanStateField
              label="Headlight"
              trackKey="headlight"
              value={headlightValue}
              vehicleId={selectedVehicle.id}
            />
            <BooleanStateField
              label="Horn"
              trackKey="horn"
              value={hornValue}
              vehicleId={selectedVehicle.id}
            />
          </section>

          {selectedStateKeyframe ? (
            <section
              aria-labelledby="state-keyframe-properties-heading"
              className="mt-5 border-t border-neutral-200 pt-4"
            >
              <h3
                id="state-keyframe-properties-heading"
                className="text-xs font-semibold uppercase text-neutral-500"
              >
                Selected state keyframe
              </h3>
              <dl className="mt-3 grid gap-3 text-sm">
                <div>
                  <dt className="text-xs font-medium text-neutral-500">
                    Track
                  </dt>
                  <dd className="mt-1 text-neutral-900">
                    {stateTrackLabels[selectedStateKeyframe.trackKey]}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-neutral-500">
                    Time
                  </dt>
                  <dd className="mt-1 font-mono text-neutral-900">
                    {selectedStateKeyframe.keyframe.time.toFixed(2)}s
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-neutral-500">
                    Value
                  </dt>
                  <dd className="mt-1 text-neutral-900">
                    {formatStateKeyframeValue(
                      selectedStateKeyframe.keyframe.value,
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-neutral-500">
                    Keyframe ID
                  </dt>
                  <dd className="mt-1 break-all font-mono text-xs leading-5 text-neutral-700">
                    {selectedStateKeyframe.keyframe.id}
                  </dd>
                </div>
              </dl>
            </section>
          ) : null}

          {selectedPath ? (
            <section
              aria-labelledby="path-properties-heading"
              className="mt-5 border-t border-neutral-200 pt-4"
            >
              <h3
                id="path-properties-heading"
                className="text-xs font-semibold uppercase text-neutral-500"
              >
                Selected path
              </h3>
              <dl className="mt-3 grid gap-3 text-sm">
                <div>
                  <dt className="text-xs font-medium text-neutral-500">Type</dt>
                  <dd className="mt-1 text-neutral-900">Cubic Bézier</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-neutral-500">
                    Path ID
                  </dt>
                  <dd className="mt-1 break-all font-mono text-xs leading-5 text-neutral-700">
                    {selectedPath.id}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-neutral-500">
                    From point
                  </dt>
                  <dd className="mt-1 break-all font-mono text-xs leading-5 text-neutral-700">
                    {selectedPath.fromPointId}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-neutral-500">
                    To point
                  </dt>
                  <dd className="mt-1 break-all font-mono text-xs leading-5 text-neutral-700">
                    {selectedPath.toPointId}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-neutral-500">
                    Control 1
                  </dt>
                  <dd className="mt-1 font-mono text-xs leading-5 text-neutral-700">
                    X {formatCoordinate(selectedPath.control1.x)}, Y{" "}
                    {formatCoordinate(selectedPath.control1.y)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-neutral-500">
                    Control 2
                  </dt>
                  <dd className="mt-1 font-mono text-xs leading-5 text-neutral-700">
                    X {formatCoordinate(selectedPath.control2.x)}, Y{" "}
                    {formatCoordinate(selectedPath.control2.y)}
                  </dd>
                </div>
              </dl>
            </section>
          ) : null}

          {selectedMovementPoint ? (
            <section
              aria-labelledby="movement-point-properties-heading"
              className="mt-5 border-t border-neutral-200 pt-4"
            >
              <h3
                id="movement-point-properties-heading"
                className="text-xs font-semibold uppercase text-neutral-500"
              >
                Selected movement point
              </h3>
              <dl className="mt-3 grid gap-3 text-sm">
                {selectedMovementPoint.time === 0 ? (
                  <div>
                    <dt className="text-xs font-medium text-neutral-500">Time</dt>
                    <dd className="mt-1 font-mono text-neutral-900">
                      {selectedMovementPoint.time.toFixed(2)}s
                    </dd>
                  </div>
                ) : (
                  <div>
                    <dt className="sr-only">Time</dt>
                    <dd>
                      <PointTimeField
                        vehicleId={selectedVehicle.id}
                        movementPointId={selectedMovementPoint.id}
                        time={selectedMovementPoint.time}
                      />
                    </dd>
                  </div>
                )}
                <div>
                  <dt className="text-xs font-medium text-neutral-500">
                    Point ID
                  </dt>
                  <dd className="mt-1 break-all font-mono text-xs leading-5 text-neutral-700">
                    {selectedMovementPoint.id}
                  </dd>
                </div>
              </dl>
              {selectedMovementPoint.time > 0 ? (
                <button
                  aria-haspopup="dialog"
                  className="mt-4 h-9 w-full border border-red-300 bg-white px-3 text-sm font-medium text-red-700 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-600 focus:ring-offset-2"
                  onClick={() =>
                    setDeletionConfirmation({
                      type: "movement-point",
                      pointId: selectedMovementPoint.id,
                      time: selectedMovementPoint.time,
                      vehicleId: selectedVehicle.id,
                    })
                  }
                  ref={deleteMovementPointButtonRef}
                  type="button"
                >
                  Delete point
                </button>
              ) : null}
            </section>
          ) : null}

          {!selectedPath && selectedAsset && editingPosition ? (
            <PositionFields
              vehicleId={selectedVehicle.id}
              movementPointId={selectedMovementPoint?.id}
              x={editingPosition.x}
              y={editingPosition.y}
              sceneWidth={sceneWidth}
              sceneHeight={sceneHeight}
              vehicleWidth={selectedAsset.width}
              vehicleHeight={selectedAsset.height}
            />
          ) : null}
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 place-items-center px-5 text-center">
          <p className="max-w-48 text-sm leading-6 text-neutral-500">
            Select an object to inspect its properties.
          </p>
        </div>
      )}

      {deletionConfirmation?.type === "vehicle" ? (
        <ConfirmationDialog
          confirmLabel="Delete vehicle"
          onCancel={() => setDeletionConfirmation(null)}
          onConfirm={() => {
            deleteVehicle(deletionConfirmation.vehicleId);
            setDeletionConfirmation(null);
          }}
          returnFocusRef={deleteVehicleButtonRef}
          title="Delete vehicle?"
        >
          <p>
            <span className="font-semibold text-neutral-950">
              {deletionConfirmation.assetName}
            </span>{" "}
            and all of its movement points, paths, and state tracks will be
            permanently removed.
          </p>
          <p className="mt-2 break-all font-mono text-xs text-neutral-600">
            Instance ID: {deletionConfirmation.vehicleId}
          </p>
        </ConfirmationDialog>
      ) : deletionConfirmation?.type === "movement-point" ? (
        <ConfirmationDialog
          confirmLabel="Delete point"
          onCancel={() => setDeletionConfirmation(null)}
          onConfirm={() => {
            deleteMovementPoint(
              deletionConfirmation.vehicleId,
              deletionConfirmation.pointId,
            );
            setDeletionConfirmation(null);
          }}
          returnFocusRef={deleteMovementPointButtonRef}
          title="Delete movement point?"
        >
          <p>
            The movement point at{" "}
            <span className="font-semibold text-neutral-950">
              {deletionConfirmation.time.toFixed(2)}s
            </span>{" "}
            will be permanently removed. Connected paths will be rebuilt
            automatically from the remaining movement points.
          </p>
          <p className="mt-2 break-all font-mono text-xs text-neutral-600">
            Point ID: {deletionConfirmation.pointId}
          </p>
        </ConfirmationDialog>
      ) : null}
    </aside>
  );
}
