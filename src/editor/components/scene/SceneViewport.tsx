import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Circle,
  Group,
  Image as KonvaImage,
  Layer,
  Line,
  Rect,
  Stage,
} from "react-konva";

import { getAssetById } from "../../../assets/assetRegistry";
import { presentPreviewAvailability } from "../../previewPresentation";
import { resolveBezierPathPoints } from "../../../path/bezier";
import { resolvePreviewAvailability } from "../../../preview/availability";
import { useEditorStore } from "../../../store/editorStore";
import { getVehicleDisplayName } from "../../vehicleDisplayName";
import { calculateSceneViewportLayout } from "./sceneScaling";
import { clampVehiclePosition } from "./vehicleDragging";
import { VehicleVisual } from "./VehicleVisual";

interface ViewportSize {
  width: number;
  height: number;
}

function useLoadedImage(src: string | undefined): HTMLImageElement | null {
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    setImage(null);

    if (!src) {
      return;
    }

    const nextImage = new window.Image();
    let isCurrent = true;

    nextImage.onload = () => {
      if (isCurrent) {
        setImage(nextImage);
      }
    };
    nextImage.src = src;

    return () => {
      isCurrent = false;
      nextImage.onload = null;
    };
  }, [src]);

  return image;
}

function useLoadedImages(sources: string[]): ReadonlyMap<string, HTMLImageElement> {
  const sourceKey = [...new Set(sources)].sort().join("\u0000");
  const [images, setImages] = useState<ReadonlyMap<string, HTMLImageElement>>(
    new Map(),
  );

  useEffect(() => {
    const uniqueSources = sourceKey ? sourceKey.split("\u0000") : [];
    let isCurrent = true;
    const nextImages = new Map<string, HTMLImageElement>();
    setImages(new Map());

    for (const src of uniqueSources) {
      const image = new window.Image();
      image.onload = () => {
        if (!isCurrent) {
          return;
        }

        nextImages.set(src, image);
        setImages(new Map(nextImages));
      };
      image.src = src;
    }

    return () => {
      isCurrent = false;
      for (const image of nextImages.values()) {
        image.onload = null;
      }
    };
  }, [sourceKey]);

  return images;
}

export function SceneViewport() {
  const project = useEditorStore((state) => state.project);
  const { width, height } = project.scene;
  const backgroundAssetId = project.scene.background?.assetId;
  const backgroundAsset = backgroundAssetId
    ? getAssetById(backgroundAssetId)
    : undefined;
  const backgroundImage = useLoadedImage(
    backgroundAsset?.type === "background" ? backgroundAsset.src : undefined,
  );
  const vehicles = project.scene.objects;
  const currentTime = useEditorStore((state) => state.currentTime);
  const previewAvailability = useMemo(
    () => resolvePreviewAvailability(project, currentTime),
    [currentTime, project],
  );
  const previewPresentation = useMemo(
    () => presentPreviewAvailability(project, previewAvailability),
    [previewAvailability, project],
  );
  const previewVehicleById = useMemo(
    () =>
      new Map(
        previewAvailability.status === "ready"
          ? previewAvailability.scene.vehicles.map((vehicle) => [
              vehicle.id,
              vehicle,
            ])
          : [],
      ),
    [previewAvailability],
  );
  const selectedObjectId = useEditorStore(
    (state) => state.selection.objectId,
  );
  const selectedMovementPointId = useEditorStore(
    (state) => state.selection.movementPointId,
  );
  const selectedPathId = useEditorStore((state) => state.selection.pathId);
  const selectObject = useEditorStore((state) => state.selectObject);
  const selectMovementPoint = useEditorStore(
    (state) => state.selectMovementPoint,
  );
  const selectPath = useEditorStore((state) => state.selectPath);
  const clearSelection = useEditorStore((state) => state.clearSelection);
  const updateVehiclePosition = useEditorStore(
    (state) => state.updateVehiclePosition,
  );
  const updateMovementPointPosition = useEditorStore(
    (state) => state.updateMovementPointPosition,
  );
  const updatePathControlPoint = useEditorStore(
    (state) => state.updatePathControlPoint,
  );
  const vehicleImages = useLoadedImages(
    vehicles.flatMap((vehicle) => {
      const asset = getAssetById(vehicle.assetId);
      return asset?.type === "vehicle" ? [asset.src] : [];
    }),
  );
  const viewportRef = useRef<HTMLDivElement>(null);
  const [viewportSize, setViewportSize] = useState<ViewportSize | null>(null);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;

    if (!viewport || typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(([entry]) => {
      if (!entry) {
        return;
      }

      const nextSize = {
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      };

      if (nextSize.width <= 0 || nextSize.height <= 0) {
        return;
      }

      setViewportSize((currentSize) =>
        currentSize?.width === nextSize.width &&
        currentSize.height === nextSize.height
          ? currentSize
          : nextSize,
      );
    });

    observer.observe(viewport);

    return () => observer.disconnect();
  }, []);

  const layout = useMemo(
    () =>
      viewportSize
        ? calculateSceneViewportLayout(
            width,
            height,
            viewportSize.width,
            viewportSize.height,
          )
        : null,
    [height, viewportSize, width],
  );

  const displayWidth = layout?.displayWidth ?? width;
  const displayHeight = layout?.displayHeight ?? height;
  const scale = layout?.scale ?? 1;
  const selectedVehicle = vehicles.find(
    (vehicle) => vehicle.id === selectedObjectId,
  );
  const selectedVehicleAsset = selectedVehicle
    ? getAssetById(selectedVehicle.assetId)
    : undefined;
  const selectedVehicleName = selectedVehicle
    ? getVehicleDisplayName(vehicles, selectedVehicle)
    : "Vehicle";
  const selectedMovementPoint = selectedVehicle?.movement.points.find(
    (point) => point.id === selectedMovementPointId,
  );
  const selectedPath = selectedVehicle?.movement.paths.find(
    (path) => path.id === selectedPathId,
  );
  const selectedPathPoints =
    selectedVehicle && selectedPath
      ? resolveBezierPathPoints(selectedVehicle.movement.points, selectedPath)
      : undefined;
  const sceneLabel = selectedPath
    ? `Scene viewport, ${selectedVehicleName} movement path selected`
    : selectedMovementPoint
      ? `Scene viewport, ${selectedVehicleName} and movement point at ${selectedMovementPoint.time.toFixed(2)} seconds selected`
      : selectedVehicle
        ? `Scene viewport, ${selectedVehicleName} selected`
        : "Scene viewport, no object selected";

  return (
    <div
      ref={viewportRef}
      aria-label={sceneLabel}
      className="relative flex min-h-0 min-w-0 flex-1 items-center justify-center overflow-hidden bg-neutral-300 p-6"
    >
      <div
        className="bg-white shadow-sm"
        style={{ width: displayWidth, height: displayHeight }}
      >
        <Stage
          width={displayWidth}
          height={displayHeight}
          scaleX={scale}
          scaleY={scale}
          onClick={(event) => {
            if (event.target === event.target.getStage()) {
              clearSelection();
            }
          }}
        >
          <Layer>
            <Rect
              x={0}
              y={0}
              width={width}
              height={height}
              fill="#fafafa"
              stroke="#a3a3a3"
              strokeWidth={2}
              listening={false}
            />
            {backgroundImage ? (
              <KonvaImage
                image={backgroundImage}
                x={0}
                y={0}
                width={width}
                height={height}
                listening={false}
              />
            ) : null}
            {vehicles.flatMap((vehicle) =>
              vehicle.movement.paths.map((path) => {
                  const points = resolveBezierPathPoints(
                    vehicle.movement.points,
                    path,
                  );

                  const isSelected =
                    vehicle.id === selectedVehicle?.id &&
                    path.id === selectedPath?.id;

                  return points ? (
                    <Line
                      key={`${vehicle.id}:${path.id}`}
                      id={path.id}
                      name={`Movement path from ${path.fromPointId} to ${path.toPointId}`}
                      points={points}
                      bezier
                      stroke={isSelected ? "#059669" : "#f59e0b"}
                      strokeWidth={isSelected ? 6 : 4}
                      strokeScaleEnabled={false}
                      hitStrokeWidth={20 / scale}
                      lineCap="round"
                      lineJoin="round"
                      listening
                      onClick={(event) => {
                        event.cancelBubble = true;
                        selectPath(vehicle.id, path.id);
                      }}
                      onTap={(event) => {
                        event.cancelBubble = true;
                        selectPath(vehicle.id, path.id);
                      }}
                    />
                  ) : null;
                }),
            )}
            {vehicles.map((vehicle) => {
              const vehicleAsset = getAssetById(vehicle.assetId);
              const vehicleImage =
                vehicleAsset?.type === "vehicle"
                  ? vehicleImages.get(vehicleAsset.src)
                  : undefined;
              const previewVehicle = previewVehicleById.get(vehicle.id);
              const isVehicleSelected = vehicle.id === selectedVehicle?.id;

              return vehicleImage &&
                vehicleAsset?.type === "vehicle" &&
                previewVehicle ? (
                <Group
                  key={vehicle.id}
                  id={vehicle.id}
                  name={getVehicleDisplayName(vehicles, vehicle)}
                  x={previewVehicle.x}
                  y={previewVehicle.y}
                  rotation={previewVehicle.rotationDeg}
                  draggable
                  onDragMove={(event) => {
                    event.target.position(
                      clampVehiclePosition(
                        { x: event.target.x(), y: event.target.y() },
                        width,
                        height,
                        vehicleAsset.width,
                        vehicleAsset.height,
                      ),
                    );
                  }}
                  onDragStart={() => selectObject(vehicle.id)}
                  onDragEnd={(event) => {
                    const position = clampVehiclePosition(
                      { x: event.target.x(), y: event.target.y() },
                      width,
                      height,
                      vehicleAsset.width,
                      vehicleAsset.height,
                    );

                    event.target.position(position);
                    updateVehiclePosition(vehicle.id, position.x, position.y);
                  }}
                  onClick={(event) => {
                    event.cancelBubble = true;
                    selectObject(vehicle.id);
                  }}
                  onTap={(event) => {
                    event.cancelBubble = true;
                    selectObject(vehicle.id);
                  }}
                >
                  <Rect
                    name="Vehicle hit area"
                    x={-vehicleAsset.width / 2}
                    y={-vehicleAsset.height / 2}
                    width={vehicleAsset.width}
                    height={vehicleAsset.height}
                    fill="rgba(0, 0, 0, 0.001)"
                  />
                  <VehicleVisual
                    asset={vehicleAsset}
                    image={vehicleImage}
                    preview={previewVehicle}
                    selected={isVehicleSelected}
                  />
                </Group>
              ) : null;
            })}
            {selectedVehicle && selectedPath && selectedPathPoints ? (
              <>
                <Line
                  name="Control 1 guide"
                  points={[
                    selectedPathPoints[0]!,
                    selectedPathPoints[1]!,
                    selectedPath.control1.x,
                    selectedPath.control1.y,
                  ]}
                  stroke="#0891b2"
                  strokeWidth={2}
                  strokeScaleEnabled={false}
                  dash={[6 / scale, 4 / scale]}
                  listening={false}
                />
                <Line
                  name="Control 2 guide"
                  points={[
                    selectedPathPoints[6]!,
                    selectedPathPoints[7]!,
                    selectedPath.control2.x,
                    selectedPath.control2.y,
                  ]}
                  stroke="#e11d48"
                  strokeWidth={2}
                  strokeScaleEnabled={false}
                  dash={[6 / scale, 4 / scale]}
                  listening={false}
                />
                {(
                  [
                    ["control1", "Control 1", "#0891b2"],
                    ["control2", "Control 2", "#e11d48"],
                  ] as const
                ).map(([control, label, color]) => (
                  <Circle
                    key={control}
                    x={selectedPath[control].x}
                    y={selectedPath[control].y}
                    radius={10 / scale}
                    fill={color}
                    stroke="#ffffff"
                    strokeWidth={3 / scale}
                    hitStrokeWidth={12 / scale}
                    draggable
                    name={`${label} at ${selectedPath[control].x}, ${selectedPath[control].y}`}
                    onDragStart={(event) => {
                      event.cancelBubble = true;
                      selectPath(selectedVehicle.id, selectedPath.id);
                    }}
                    onDragMove={(event) => {
                      event.cancelBubble = true;
                      updatePathControlPoint(
                        selectedVehicle.id,
                        selectedPath.id,
                        control,
                        event.target.x(),
                        event.target.y(),
                      );
                    }}
                    onDragEnd={(event) => {
                      event.cancelBubble = true;
                      updatePathControlPoint(
                        selectedVehicle.id,
                        selectedPath.id,
                        control,
                        event.target.x(),
                        event.target.y(),
                      );
                    }}
                    onClick={(event) => {
                      event.cancelBubble = true;
                      selectPath(selectedVehicle.id, selectedPath.id);
                    }}
                    onTap={(event) => {
                      event.cancelBubble = true;
                      selectPath(selectedVehicle.id, selectedPath.id);
                    }}
                  />
                ))}
              </>
            ) : null}
            {selectedVehicle
              ? selectedVehicle.movement.points.map((point) => {
                  const isSelected = point.id === selectedMovementPointId;

                  return (
                    <Circle
                      key={point.id}
                      x={point.x}
                      y={point.y}
                      radius={(isSelected ? 11 : 9) / scale}
                      fill={isSelected ? "#10b981" : "#ffffff"}
                      stroke={isSelected ? "#064e3b" : "#404040"}
                      strokeWidth={2 / scale}
                      hitStrokeWidth={12 / scale}
                      draggable
                      name={`Movement point at ${point.time.toFixed(2)} seconds, position ${point.x}, ${point.y}`}
                      onDragStart={(event) => {
                        event.cancelBubble = true;
                        selectMovementPoint(selectedVehicle.id, point.id);
                      }}
                      onDragMove={(event) => {
                        event.cancelBubble = true;
                        event.target.position(
                          clampVehiclePosition(
                            { x: event.target.x(), y: event.target.y() },
                            width,
                            height,
                            selectedVehicleAsset?.width ?? 0,
                            selectedVehicleAsset?.height ?? 0,
                          ),
                        );
                      }}
                      onDragEnd={(event) => {
                        event.cancelBubble = true;
                        const position = clampVehiclePosition(
                          { x: event.target.x(), y: event.target.y() },
                          width,
                          height,
                          selectedVehicleAsset?.width ?? 0,
                          selectedVehicleAsset?.height ?? 0,
                        );

                        event.target.position(position);
                        updateMovementPointPosition(
                          selectedVehicle.id,
                          point.id,
                          position.x,
                          position.y,
                        );
                      }}
                      onClick={(event) => {
                        event.cancelBubble = true;
                        selectMovementPoint(selectedVehicle.id, point.id);
                      }}
                      onTap={(event) => {
                        event.cancelBubble = true;
                        selectMovementPoint(selectedVehicle.id, point.id);
                      }}
                    />
                  );
                })
              : null}
            <Rect
              x={0}
              y={0}
              width={width}
              height={height}
              stroke="#a3a3a3"
              strokeWidth={2}
              fillEnabled={false}
              listening={false}
            />
          </Layer>
        </Stage>
      </div>
      {previewPresentation?.kind === "empty" ? (
        <div className="pointer-events-none absolute inset-6 flex items-center justify-center text-center">
          <div className="max-w-80 text-neutral-700" role="status">
            <p className="text-sm font-semibold text-neutral-900">
              {previewPresentation.title}
            </p>
            <p className="mt-1 text-xs leading-5">
              {previewPresentation.message}
            </p>
          </div>
        </div>
      ) : null}
      {previewPresentation?.kind === "error" ? (
        <div className="pointer-events-none absolute left-1/2 top-9 z-10 w-[min(32rem,calc(100%-4rem))] -translate-x-1/2 border border-red-300 bg-red-50 px-4 py-3 text-red-950 shadow-sm" role="alert">
          <p className="text-sm font-semibold">{previewPresentation.title}</p>
          <p className="mt-1 text-xs leading-5">
            {previewPresentation.message}
          </p>
        </div>
      ) : null}
      {previewAvailability.status === "ready" &&
      project.scene.background === undefined ? (
        <div className="pointer-events-none absolute left-9 top-9 z-10 border border-neutral-300 bg-white/95 px-3 py-2 text-xs font-medium text-neutral-700 shadow-sm" role="status">
          No background selected
        </div>
      ) : null}
    </div>
  );
}
