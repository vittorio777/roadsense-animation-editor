import { act, type ReactNode, useRef } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createEmptyAnimationProject } from "../src/model/animation";
import { useEditorStore } from "../src/store/editorStore";

vi.mock("react-konva", () => ({
  Stage: ({
    children,
    width,
    height,
    scaleX,
    scaleY,
    onClick,
  }: {
    children: ReactNode;
    width: number;
    height: number;
    scaleX: number;
    scaleY: number;
    onClick?: (event: {
      target: { getStage: () => unknown };
    }) => void;
  }) => (
    <div
      data-konva-stage="true"
      data-width={width}
      data-height={height}
      data-scale-x={scaleX}
      data-scale-y={scaleY}
      onClick={() => {
        const stage = { getStage: () => stage };
        onClick?.({ target: stage });
      }}
    >
      {children}
    </div>
  ),
  Layer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Line: ({
    id,
    name,
    points,
    bezier,
    stroke,
    strokeWidth,
    strokeScaleEnabled,
    hitStrokeWidth,
    lineCap,
    lineJoin,
    dash,
    listening,
    closed,
    fill,
    opacity,
    onClick,
    onTap,
  }: {
    id?: string;
    name: string;
    points: number[];
    bezier?: boolean;
    stroke?: string;
    strokeWidth?: number;
    strokeScaleEnabled?: boolean;
    hitStrokeWidth?: number;
    lineCap?: string;
    lineJoin?: string;
    dash?: number[];
    listening: boolean;
    closed?: boolean;
    fill?: string;
    opacity?: number;
    onClick?: (event: { cancelBubble: boolean }) => void;
    onTap?: (event: { cancelBubble: boolean }) => void;
  }) => {
    const isMovementPath = Boolean(id && bezier);
    const isControlGuide = name.startsWith("Control ") && name.endsWith("guide");
    const isHeadlightBeam = name.startsWith("Headlight ") && name.endsWith("beam");

    return (
      <button
        type="button"
        aria-label={name}
        data-movement-path={isMovementPath ? "true" : undefined}
        data-control-guide={isControlGuide ? name : undefined}
        data-headlight-beam={isHeadlightBeam ? name : undefined}
        data-path-id={id}
        data-points={JSON.stringify(points)}
        data-bezier={String(Boolean(bezier))}
        data-stroke={stroke}
        data-stroke-width={strokeWidth}
        data-stroke-scale-enabled={String(strokeScaleEnabled)}
        data-hit-stroke-width={hitStrokeWidth}
        data-line-cap={lineCap}
        data-line-join={lineJoin}
        data-dash={dash ? JSON.stringify(dash) : undefined}
        data-listening={String(listening)}
        data-closed={String(Boolean(closed))}
        data-fill={fill}
        data-opacity={opacity}
        data-selected={
          isMovementPath ? String(stroke === "#059669") : undefined
        }
        onClick={(event) => {
          event.stopPropagation();
          onClick?.({ cancelBubble: false });
        }}
        onTouchEnd={(event) => {
          event.stopPropagation();
          onTap?.({ cancelBubble: false });
        }}
      />
    );
  },
  Circle: ({
    x,
    y,
    radius,
    fill,
    stroke,
    strokeWidth,
    hitStrokeWidth,
    name,
    draggable,
    listening,
    opacity,
    shadowColor,
    shadowBlur,
    onClick,
    onDragStart,
    onDragMove,
    onDragEnd,
    onTap,
  }: {
    x: number;
    y: number;
    radius: number;
    fill: string;
    stroke?: string;
    strokeWidth?: number;
    hitStrokeWidth?: number;
    name: string;
    draggable?: boolean;
    listening?: boolean;
    opacity?: number;
    shadowColor?: string;
    shadowBlur?: number;
    onClick?: (event: { cancelBubble: boolean }) => void;
    onDragStart?: (event: { cancelBubble: boolean; target: unknown }) => void;
    onDragMove?: (event: { cancelBubble: boolean; target: unknown }) => void;
    onDragEnd?: (event: { cancelBubble: boolean; target: unknown }) => void;
    onTap?: (event: { cancelBubble: boolean }) => void;
  }) => {
    const positionRef = useRef({ x, y });
    const isControlPoint = name.startsWith("Control ");
    const isMovementPoint = name.startsWith("Movement point ");
    const isVehicleLamp =
      name.startsWith("Indicator ") ||
      name.startsWith("Brake light ") ||
      name.startsWith("Headlight ");

    const createTarget = (element: HTMLButtonElement) => ({
      x: () => positionRef.current.x,
      y: () => positionRef.current.y,
      position: (position: { x: number; y: number }) => {
        positionRef.current = position;
        element.dataset.nodeX = String(position.x);
        element.dataset.nodeY = String(position.y);
      },
    });

    return (
      <button
        type="button"
        aria-label={name}
        data-movement-point-marker={isMovementPoint ? "true" : undefined}
        data-control-point={isControlPoint ? name.slice(0, 9) : undefined}
        data-vehicle-lamp={isVehicleLamp ? name : undefined}
        data-selected={
          isControlPoint ? undefined : fill === "#10b981" ? "true" : "false"
        }
        data-draggable={String(draggable)}
        data-x={x}
        data-y={y}
        data-radius={radius}
        data-fill={fill}
        data-stroke={stroke}
        data-stroke-width={strokeWidth}
        data-hit-stroke-width={hitStrokeWidth}
        data-listening={String(listening)}
        data-opacity={opacity}
        data-shadow-color={shadowColor}
        data-shadow-blur={shadowBlur}
        onClick={(event) => {
          event.stopPropagation();
          onClick?.({ cancelBubble: false });
        }}
        onMouseDown={(event) => {
          positionRef.current = { x, y };
          onDragStart?.({
            cancelBubble: false,
            target: createTarget(event.currentTarget),
          });
        }}
        onMouseMove={(event) => {
          const nextX = Number(event.currentTarget.dataset.nextX);
          const nextY = Number(event.currentTarget.dataset.nextY);

          if (!Number.isNaN(nextX) && !Number.isNaN(nextY)) {
            positionRef.current = { x: nextX, y: nextY };
          }

          onDragMove?.({
            cancelBubble: false,
            target: createTarget(event.currentTarget),
          });
        }}
        onMouseUp={(event) => {
          onDragEnd?.({
            cancelBubble: false,
            target: createTarget(event.currentTarget),
          });
        }}
        onTouchEnd={(event) => {
          event.stopPropagation();
          onTap?.({ cancelBubble: false });
        }}
      />
    );
  },
  Group: ({
    children,
    id,
    name,
    x,
    y,
    rotation,
    draggable,
    listening,
    onClick,
    onTap,
    onDragStart,
    onDragMove,
    onDragEnd,
  }: {
    children: ReactNode;
    id?: string;
    name?: string;
    x: number;
    y: number;
    rotation?: number;
    draggable?: boolean;
    listening?: boolean;
    onClick?: (event: { cancelBubble: boolean }) => void;
    onTap?: (event: { cancelBubble: boolean }) => void;
    onDragStart?: (event: { target: unknown }) => void;
    onDragMove?: (event: { target: unknown }) => void;
    onDragEnd?: (event: { target: unknown }) => void;
  }) => {
    const positionRef = useRef({ x, y });

    const createTarget = (element: HTMLDivElement) => ({
      x: () => positionRef.current.x,
      y: () => positionRef.current.y,
      position: (position: { x: number; y: number }) => {
        positionRef.current = position;
        element.dataset.nodeX = String(position.x);
        element.dataset.nodeY = String(position.y);
      },
    });

    return (
      <div
        data-konva-group={id ? "true" : undefined}
        data-model-group={name === "Vehicle model visual" ? "true" : undefined}
        data-vehicle-id={id}
        aria-label={name}
        data-x={x}
        data-y={y}
        data-rotation={rotation}
        data-draggable={String(draggable)}
        data-listening={String(listening)}
        onClick={(event) => {
          event.stopPropagation();
          onClick?.({ cancelBubble: false });
        }}
        onMouseDown={(event) => {
          positionRef.current = { x, y };
          onDragStart?.({ target: createTarget(event.currentTarget) });
        }}
        onMouseMove={(event) => {
          const nextX = Number(event.currentTarget.dataset.nextX);
          const nextY = Number(event.currentTarget.dataset.nextY);

          if (!Number.isNaN(nextX) && !Number.isNaN(nextY)) {
            positionRef.current = { x: nextX, y: nextY };
          }

          onDragMove?.({ target: createTarget(event.currentTarget) });
        }}
        onMouseUp={(event) => {
          onDragEnd?.({ target: createTarget(event.currentTarget) });
        }}
        onTouchEnd={(event) => {
          event.stopPropagation();
          onTap?.({ cancelBubble: false });
        }}
      >
        {children}
      </div>
    );
  },
  Rect: ({
    name,
    fillEnabled,
    dash,
    fill,
    x,
    y,
    width,
    height,
    listening,
  }: {
    name?: string;
    fillEnabled?: boolean;
    dash?: number[];
    fill?: string;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    listening?: boolean;
  }) => (
    <div
      data-scene-surface={
        name === undefined && fillEnabled !== false ? "true" : undefined
      }
      data-vehicle-hit-area={name === "Vehicle hit area" ? "true" : undefined}
      data-scene-border={
        fillEnabled === false && dash === undefined ? "true" : undefined
      }
      data-selection-outline={dash ? "true" : undefined}
      data-x={x}
      data-y={y}
      data-width={width}
      data-height={height}
      data-listening={String(listening)}
      data-fill={fill}
    />
  ),
  Image: ({
    image,
    x,
    y,
    width,
    height,
    offsetX,
    offsetY,
    listening,
    onClick,
  }: {
    image: HTMLImageElement;
    x: number;
    y: number;
    width: number;
    height: number;
    offsetX?: number;
    offsetY?: number;
    listening?: boolean;
    onClick?: (event: { cancelBubble: boolean }) => void;
  }) => (
    <button
      type="button"
      data-scene-background={image.src}
      data-x={x}
      data-y={y}
      data-width={width}
      data-height={height}
      data-offset-x={offsetX}
      data-offset-y={offsetY}
      data-listening={String(listening)}
      onClick={(event) => {
        if (onClick) {
          event.stopPropagation();
          onClick({ cancelBubble: false });
        }
      }}
    />
  ),
}));

let resizeCallback: ResizeObserverCallback;

class ResizeObserverMock implements ResizeObserver {
  constructor(callback: ResizeObserverCallback) {
    resizeCallback = callback;
  }

  observe() {}
  unobserve() {}
  disconnect() {}
}

vi.stubGlobal("ResizeObserver", ResizeObserverMock);

class ImageMock {
  onload: ((this: GlobalEventHandlers, ev: Event) => unknown) | null = null;
  private value = "";

  get src() {
    return this.value;
  }

  set src(value: string) {
    this.value = value;
    queueMicrotask(() => this.onload?.call(this as never, new Event("load")));
  }
}

vi.stubGlobal("Image", ImageMock);

import { ScenePanel } from "../src/editor/components/scene/ScenePanel";
import { TimelinePanel } from "../src/editor/components/timeline/TimelinePanel";
import {
  calculatePathPosition,
  calculatePathRotation,
} from "../src/path/bezier";

describe("F1.2 scene viewport", () => {
  beforeEach(() => {
    useEditorStore.setState({
      project: createEmptyAnimationProject(),
      currentTime: 0,
      selection: {
        objectId: null,
        movementPointId: null,
        pathId: null,
        stateKeyframeId: null,
      },
    });
  });

  it("renders the default logical Scene at 1600 by 900 without scaling", () => {
    const markup = renderToStaticMarkup(<ScenePanel />);

    expect(markup).toContain("1600 × 900");
    expect(markup).toContain('data-width="1600"');
    expect(markup).toContain('data-height="900"');
    expect(markup).toContain('data-scale-x="1"');
    expect(markup).toContain('data-scale-y="1"');
    expect(markup).toContain("No vehicles in scene");
    expect(markup).toContain(
      "Choose a background and add a vehicle from the Object Library to begin.",
    );
  });

  it("updates empty and no-background states without blocking Scene interaction", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<ScenePanel />);
    });
    expect(container.textContent).toContain("No vehicles in scene");
    expect(container.querySelectorAll('[role="status"]')).toHaveLength(1);
    expect(container.innerHTML).toContain("pointer-events-none");

    await act(async () => {
      useEditorStore.getState().setSceneBackground("intersection-01");
    });
    expect(container.textContent).toContain(
      "Add a vehicle from the Object Library to begin.",
    );
    expect(container.textContent).not.toContain("Choose a background");

    await act(async () => {
      const project = useEditorStore.getState().project;
      const { background: _background, ...sceneWithoutBackground } =
        project.scene;
      useEditorStore.setState({
        project: { ...project, scene: sceneWithoutBackground },
      });
      useEditorStore.getState().addVehicle("car-blue-sedan");
    });
    expect(container.textContent).not.toContain("No vehicles in scene");
    expect(container.textContent).toContain("No background selected");
    expect(container.querySelector("[data-konva-group]")).not.toBeNull();

    await act(async () => {
      useEditorStore.getState().setSceneBackground("intersection-01");
    });
    expect(container.textContent).not.toContain("No background selected");

    await act(async () => root.unmount());
    container.remove();
  });

  it("shows recoverable Preview errors without stale Vehicle visuals", async () => {
    useEditorStore.getState().addVehicle("car-blue-sedan");
    const initialProject = useEditorStore.getState().project;
    const vehicle = initialProject.scene.objects[0]!;
    const invalidProject = {
      ...initialProject,
      scene: {
        ...initialProject.scene,
        objects: [
          {
            ...vehicle,
            movement: { points: [], paths: [] },
          },
        ],
      },
    };
    useEditorStore.setState({ project: invalidProject });
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<ScenePanel />);
    });

    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "Preview unavailable",
    );
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "Car Blue Sedan has incomplete movement data",
    );
    expect(container.querySelector('[role="alert"]')?.textContent).not.toContain(
      vehicle.id,
    );
    expect(container.querySelector("[data-konva-group]")).toBeNull();
    expect(useEditorStore.getState().project).toBe(invalidProject);

    await act(async () => {
      useEditorStore.setState({ project: initialProject });
    });
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(container.querySelector("[data-konva-group]")).not.toBeNull();

    await act(async () => root.unmount());
    container.remove();
  });

  it("explains unavailable Vehicle assets without rendering a fallback", async () => {
    useEditorStore.getState().addVehicle("car-blue-sedan");
    const project = useEditorStore.getState().project;
    const vehicle = project.scene.objects[0]!;
    useEditorStore.setState({
      project: {
        ...project,
        scene: {
          ...project.scene,
          objects: [{ ...vehicle, assetId: "missing-private-car" }],
        },
      },
    });
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<ScenePanel />);
    });

    const alert = container.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain("Vehicle 1 uses a vehicle asset");
    expect(alert?.textContent).not.toContain("missing-private-car");
    expect(container.querySelector("[data-konva-group]")).toBeNull();

    await act(async () => root.unmount());
    container.remove();
  });

  it("uses the current Animation Project Scene dimensions", async () => {
    useEditorStore.setState({
      project: {
        ...createEmptyAnimationProject("custom-scene"),
        scene: {
          width: 1200,
          height: 675,
          objects: [],
        },
      },
    });

    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<ScenePanel />);
    });

    expect(container.innerHTML).toContain("1200 × 675");
    expect(container.innerHTML).toContain('data-width="1200"');
    expect(container.innerHTML).toContain('data-height="675"');

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("does not mutate Animation Data or temporary Editor State", () => {
    const stateBeforeRender = useEditorStore.getState();

    renderToStaticMarkup(<ScenePanel />);

    const stateAfterRender = useEditorStore.getState();
    expect(stateAfterRender.project).toBe(stateBeforeRender.project);
    expect(stateAfterRender.currentTime).toBe(stateBeforeRender.currentTime);
    expect(stateAfterRender.selection).toBe(stateBeforeRender.selection);
  });

  it("fits the Stage uniformly and responds to viewport size changes", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<ScenePanel />);
    });

    await act(async () => {
      resizeCallback(
        [{ contentRect: { width: 800, height: 600 } } as ResizeObserverEntry],
        {} as ResizeObserver,
      );
    });

    expect(container.innerHTML).toContain('data-width="800"');
    expect(container.innerHTML).toContain('data-height="450"');
    expect(container.innerHTML).toContain('data-scale-x="0.5"');
    expect(container.innerHTML).toContain('data-scale-y="0.5"');

    await act(async () => {
      resizeCallback(
        [{ contentRect: { width: 1200, height: 675 } } as ResizeObserverEntry],
        {} as ResizeObserver,
      );
    });

    expect(container.innerHTML).toContain('data-width="1200"');
    expect(container.innerHTML).toContain('data-height="675"');
    expect(container.innerHTML).toContain('data-scale-x="0.75"');
    expect(container.innerHTML).toContain('data-scale-y="0.75"');

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("does not mutate editor state when viewport scaling changes", async () => {
    const stateBeforeResize = useEditorStore.getState();
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<ScenePanel />);
    });

    await act(async () => {
      resizeCallback(
        [{ contentRect: { width: 800, height: 450 } } as ResizeObserverEntry],
        {} as ResizeObserver,
      );
    });

    const stateAfterResize = useEditorStore.getState();
    expect(stateAfterResize.project).toBe(stateBeforeResize.project);
    expect(stateAfterResize.currentTime).toBe(stateBeforeResize.currentTime);
    expect(stateAfterResize.selection).toBe(stateBeforeResize.selection);

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("renders the selected background across the logical Scene", async () => {
    useEditorStore.getState().setSceneBackground("intersection-01");
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<ScenePanel />);
    });

    const background = container.querySelector("[data-scene-background]");
    expect(background?.getAttribute("data-scene-background")).toContain(
      "/assets/backgrounds/intersection-01.svg",
    );
    expect(background?.getAttribute("data-x")).toBe("0");
    expect(background?.getAttribute("data-y")).toBe("0");
    expect(background?.getAttribute("data-width")).toBe("1600");
    expect(background?.getAttribute("data-height")).toBe("900");

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("renders the added Vehicle from its logical center point", async () => {
    useEditorStore.getState().setSceneBackground("intersection-01");
    useEditorStore.getState().addVehicle("car-blue-sedan");
    const projectBeforeRender = useEditorStore.getState().project;
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<ScenePanel />);
    });

    const vehicleImage = Array.from(
      container.querySelectorAll("[data-scene-background]"),
    ).find((element) =>
      element
        .getAttribute("data-scene-background")
        ?.includes("/assets/vehicles/car-blue-sedan.svg"),
    );
    const vehicleGroup = container.querySelector("[data-konva-group]");
    expect(vehicleGroup?.getAttribute("data-x")).toBe("800");
    expect(vehicleGroup?.getAttribute("data-y")).toBe("450");
    expect(vehicleGroup?.getAttribute("data-draggable")).toBe("true");
    expect(vehicleImage?.getAttribute("data-x")).toBe("0");
    expect(vehicleImage?.getAttribute("data-y")).toBe("0");
    expect(vehicleImage?.getAttribute("data-width")).toBe("120");
    expect(vehicleImage?.getAttribute("data-height")).toBe("72");
    expect(vehicleImage?.getAttribute("data-offset-x")).toBe("60");
    expect(vehicleImage?.getAttribute("data-offset-y")).toBe("36");
    expect(useEditorStore.getState().project).toBe(projectBeforeRender);

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("binds composed Vehicle states to lights at the current time", async () => {
    useEditorStore.getState().addVehicle("car-blue-sedan");
    const vehicle = useEditorStore.getState().project.scene.objects[0]!;
    useEditorStore.getState().setCurrentTime(2);
    useEditorStore
      .getState()
      .updateVehicleStateAtCurrentTime(vehicle.id, "indicator", "left");
    useEditorStore
      .getState()
      .updateVehicleStateAtCurrentTime(vehicle.id, "brakeLight", true);
    useEditorStore
      .getState()
      .updateVehicleStateAtCurrentTime(vehicle.id, "headlight", true);
    useEditorStore
      .getState()
      .updateVehicleStateAtCurrentTime(vehicle.id, "horn", true);
    useEditorStore.getState().setCurrentTime(0);
    const projectBeforeRender = useEditorStore.getState().project;
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<ScenePanel />);
    });

    expect(container.querySelectorAll("[data-vehicle-lamp]")).toHaveLength(8);
    expect(container.querySelectorAll("[data-headlight-beam]")).toHaveLength(0);
    expect(container.querySelector("[data-model-group]")?.getAttribute("data-rotation")).toBe("0");
    expect(container.querySelector("[data-model-group]")?.getAttribute("data-listening")).toBe("false");
    expect(container.querySelector("[data-vehicle-hit-area]")).not.toBeNull();

    await act(async () => {
      useEditorStore.getState().setCurrentTime(2);
    });

    expect(
      container.querySelector('[data-vehicle-lamp="Indicator front left"]')
        ?.getAttribute("data-fill"),
    ).toBe("#fbbf24");
    expect(
      container.querySelector('[data-vehicle-lamp="Indicator rear left"]')
        ?.getAttribute("data-fill"),
    ).toBe("#fbbf24");
    expect(
      container.querySelector('[data-vehicle-lamp="Indicator front right"]')
        ?.getAttribute("data-fill"),
    ).toBe("#78350f");
    expect(
      container.querySelectorAll('[data-vehicle-lamp^="Brake light"][data-fill="#ef4444"]'),
    ).toHaveLength(2);
    expect(
      container.querySelectorAll('[data-vehicle-lamp^="Headlight"][data-fill="#fef3c7"]'),
    ).toHaveLength(2);
    expect(container.querySelectorAll("[data-headlight-beam]")).toHaveLength(2);
    expect(container.innerHTML).not.toContain("Horn");
    expect(useEditorStore.getState().project).toBe(projectBeforeRender);

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("keeps multiple Vehicle visual states independent", async () => {
    useEditorStore.getState().addVehicle("car-blue-sedan");
    useEditorStore.getState().addVehicle("car-blue-sport");
    const [firstVehicle, secondVehicle] =
      useEditorStore.getState().project.scene.objects;
    useEditorStore
      .getState()
      .updateVehicleStateAtCurrentTime(firstVehicle!.id, "indicator", "left");
    useEditorStore
      .getState()
      .updateVehicleStateAtCurrentTime(secondVehicle!.id, "indicator", "right");
    useEditorStore
      .getState()
      .updateVehicleStateAtCurrentTime(secondVehicle!.id, "headlight", true);
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<ScenePanel />);
    });

    const firstGroup = container.querySelector(
      `[data-vehicle-id="${firstVehicle!.id}"]`,
    );
    const secondGroup = container.querySelector(
      `[data-vehicle-id="${secondVehicle!.id}"]`,
    );
    expect(
      firstGroup
        ?.querySelector('[data-vehicle-lamp="Indicator front left"]')
        ?.getAttribute("data-fill"),
    ).toBe("#fbbf24");
    expect(
      firstGroup
        ?.querySelector('[data-vehicle-lamp="Indicator front left"]')
        ?.getAttribute("data-x"),
    ).toBe("52");
    expect(
      firstGroup
        ?.querySelector('[data-vehicle-lamp="Indicator front right"]')
        ?.getAttribute("data-fill"),
    ).toBe("#78350f");
    expect(firstGroup?.querySelectorAll("[data-headlight-beam]")).toHaveLength(0);
    expect(
      secondGroup
        ?.querySelector('[data-vehicle-lamp="Indicator front right"]')
        ?.getAttribute("data-fill"),
    ).toBe("#fbbf24");
    expect(
      secondGroup
        ?.querySelector('[data-vehicle-lamp="Indicator front right"]')
        ?.getAttribute("data-x"),
    ).toBe("51");
    expect(secondGroup?.querySelectorAll("[data-headlight-beam]")).toHaveLength(2);

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("renders and selects every Vehicle while keeping one active editing overlay", async () => {
    useEditorStore.getState().addVehicle("car-blue-sedan");
    useEditorStore.getState().addVehicle("car-blue-sedan");
    useEditorStore.getState().addVehicle("car-blue-sedan");
    const initialVehicles = useEditorStore.getState().project.scene.objects;
    useEditorStore.getState().setCurrentTime(3);
    useEditorStore
      .getState()
      .updateVehiclePosition(initialVehicles[0]!.id, 360, 280);
    useEditorStore
      .getState()
      .updateVehiclePosition(initialVehicles[1]!.id, 1040, 620);
    const vehicles = useEditorStore.getState().project.scene.objects;
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<ScenePanel />);
    });

    const groups = container.querySelectorAll<HTMLElement>(
      "[data-konva-group]",
    );
    expect([...groups].map((group) => group.dataset.vehicleId)).toEqual(
      vehicles.map((vehicle) => vehicle.id),
    );
    expect([...groups].map((group) => [group.dataset.x, group.dataset.y])).toEqual([
      ["360", "280"],
      ["1040", "620"],
      ["640", "450"],
    ]);
    expect(container.querySelectorAll("[data-movement-path]")).toHaveLength(2);
    expect(container.querySelector("[data-selection-outline]")).toBeNull();
    expect(container.querySelector("[data-movement-point-marker]")).toBeNull();

    await act(async () => {
      groups[1]?.click();
    });
    expect(useEditorStore.getState().selection.objectId).toBe(vehicles[1]!.id);
    expect(container.querySelectorAll("[data-selection-outline]")).toHaveLength(1);
    expect(container.querySelectorAll("[data-movement-point-marker]")).toHaveLength(2);
    expect(container.getAttribute("aria-label")).toBeNull();
    expect(container.innerHTML).toContain("Scene viewport, Car Blue Sedan 2 of 3 selected");

    const firstPath = container.querySelector<HTMLButtonElement>(
      `[data-path-id="${vehicles[0]!.movement.paths[0]!.id}"]`,
    );
    await act(async () => {
      firstPath?.click();
    });
    expect(useEditorStore.getState().selection).toMatchObject({
      objectId: vehicles[0]!.id,
      movementPointId: null,
      pathId: vehicles[0]!.movement.paths[0]!.id,
    });
    expect(container.querySelectorAll("[data-selection-outline]")).toHaveLength(1);
    expect(container.querySelectorAll("[data-control-point]")).toHaveLength(2);
    expect(container.querySelectorAll("[data-movement-point-marker]")).toHaveLength(2);

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("selects the Vehicle, renders an outline, and clears on empty Scene", async () => {
    useEditorStore.getState().addVehicle("car-blue-sedan");
    const projectBeforeSelection = useEditorStore.getState().project;
    const vehicleId = projectBeforeSelection.scene.objects[0]?.id;
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<ScenePanel />);
    });

    const vehicle = container.querySelector<HTMLDivElement>(
      "[data-konva-group]",
    );

    await act(async () => {
      vehicle?.click();
    });

    expect(useEditorStore.getState().selection.objectId).toBe(vehicleId);
    const outline = container.querySelector("[data-selection-outline]");
    expect(outline?.getAttribute("data-x")).toBe("-70");
    expect(outline?.getAttribute("data-y")).toBe("-46");
    expect(outline?.getAttribute("data-width")).toBe("140");
    expect(outline?.getAttribute("data-height")).toBe("92");
    expect(outline?.getAttribute("data-listening")).toBe("false");
    expect(container.innerHTML).toContain(
      "Scene viewport, Car Blue Sedan selected",
    );
    expect(useEditorStore.getState().project).toBe(projectBeforeSelection);

    await act(async () => {
      container.querySelector<HTMLDivElement>("[data-konva-stage]")?.click();
    });

    expect(useEditorStore.getState().selection.objectId).toBeNull();
    expect(container.querySelector("[data-selection-outline]")).toBeNull();
    expect(container.innerHTML).toContain(
      "Scene viewport, no object selected",
    );
    expect(useEditorStore.getState().project).toBe(projectBeforeSelection);

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("drags the Vehicle in logical coordinates and clamps it inside the Scene", async () => {
    useEditorStore.getState().addVehicle("car-blue-sedan");
    const projectBeforeDrag = useEditorStore.getState().project;
    const vehicleBeforeDrag = projectBeforeDrag.scene.objects[0];
    const pointBeforeDrag = vehicleBeforeDrag?.movement.points[0];
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<ScenePanel />);
    });

    await act(async () => {
      resizeCallback(
        [{ contentRect: { width: 800, height: 450 } } as ResizeObserverEntry],
        {} as ResizeObserver,
      );
    });

    const vehicleGroup = container.querySelector<HTMLDivElement>(
      "[data-konva-group]",
    );
    expect(vehicleGroup).not.toBeNull();

    await act(async () => {
      vehicleGroup?.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    });
    expect(useEditorStore.getState().selection.objectId).toBe(
      vehicleBeforeDrag?.id,
    );

    if (vehicleGroup) {
      vehicleGroup.dataset.nextX = "-200";
      vehicleGroup.dataset.nextY = "1000";
    }

    await act(async () => {
      vehicleGroup?.dispatchEvent(new MouseEvent("mousemove", { bubbles: true }));
    });
    expect(vehicleGroup?.dataset.nodeX).toBe("60");
    expect(vehicleGroup?.dataset.nodeY).toBe("864");
    expect(useEditorStore.getState().project).toBe(projectBeforeDrag);

    await act(async () => {
      vehicleGroup?.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    });

    const stateAfterDrag = useEditorStore.getState();
    const vehicleAfterDrag = stateAfterDrag.project.scene.objects[0];
    const pointAfterDrag = vehicleAfterDrag?.movement.points[0];
    expect(vehicleAfterDrag?.movement.points).toHaveLength(1);
    expect(pointAfterDrag).toEqual({
      ...pointBeforeDrag,
      x: 60,
      y: 864,
    });
    expect(vehicleAfterDrag?.id).toBe(vehicleBeforeDrag?.id);
    expect(vehicleAfterDrag?.movement.paths).toBe(vehicleBeforeDrag?.movement.paths);
    expect(vehicleAfterDrag?.stateTracks).toBe(vehicleBeforeDrag?.stateTracks);
    expect(stateAfterDrag.selection.objectId).toBe(vehicleBeforeDrag?.id);
    expect(stateAfterDrag.currentTime).toBe(0);

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("renders the composed Movement pose for currentTime", async () => {
    useEditorStore.getState().addVehicle("car-blue-sedan");
    const vehicleId = useEditorStore.getState().project.scene.objects[0]?.id;
    useEditorStore.getState().setCurrentTime(3.3);
    useEditorStore
      .getState()
      .updateVehiclePosition(vehicleId as string, 1000, 520);
    const projectAfterCreation = useEditorStore.getState().project;
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<ScenePanel />);
    });
    await act(async () => {
      resizeCallback(
        [{ contentRect: { width: 800, height: 450 } } as ResizeObserverEntry],
        {} as ResizeObserver,
      );
    });

    expect(
      container.querySelector<HTMLElement>("[data-konva-group]")?.dataset.x,
    ).toBe("1000");
    expect(
      container.querySelector<HTMLElement>("[data-konva-group]")?.dataset.y,
    ).toBe("520");

    await act(async () => {
      useEditorStore.getState().setCurrentTime(0);
    });
    expect(
      container.querySelector<HTMLElement>("[data-konva-group]")?.dataset.x,
    ).toBe("800");
    expect(
      container.querySelector<HTMLElement>("[data-konva-group]")?.dataset.y,
    ).toBe("450");

    await act(async () => {
      useEditorStore.getState().setCurrentTime(1.65);
    });
    const midpointGroup = container.querySelector<HTMLElement>(
      "[data-konva-group]",
    )!;
    expect(Number(midpointGroup.dataset.x)).toBeCloseTo(900);
    expect(Number(midpointGroup.dataset.y)).toBeCloseTo(485);
    expect(Number(midpointGroup.dataset.rotation)).toBeCloseTo(
      Math.atan2(70, 200) * (180 / Math.PI),
    );

    await act(async () => {
      useEditorStore.getState().setCurrentTime(5);
    });
    expect(
      container.querySelector<HTMLElement>("[data-konva-group]")?.dataset.x,
    ).toBe("1000");
    expect(
      container.querySelector<HTMLElement>("[data-konva-group]")?.dataset.y,
    ).toBe("520");
    expect(useEditorStore.getState().project).toBe(projectAfterCreation);

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("creates a Movement Point when the Vehicle is dragged at a new time", async () => {
    useEditorStore.getState().addVehicle("car-blue-sedan");
    useEditorStore.getState().setCurrentTime(3.3);
    const vehicleBeforeDrag =
      useEditorStore.getState().project.scene.objects[0];
    const initialPoint = vehicleBeforeDrag?.movement.points[0];
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<ScenePanel />);
    });
    await act(async () => {
      resizeCallback(
        [{ contentRect: { width: 800, height: 450 } } as ResizeObserverEntry],
        {} as ResizeObserver,
      );
    });

    const vehicleGroup = container.querySelector<HTMLDivElement>(
      "[data-konva-group]",
    );
    expect(vehicleGroup?.dataset.x).toBe("800");
    expect(vehicleGroup?.dataset.y).toBe("450");

    await act(async () => {
      vehicleGroup?.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
      if (vehicleGroup) {
        vehicleGroup.dataset.nextX = "1000";
        vehicleGroup.dataset.nextY = "520";
      }
      vehicleGroup?.dispatchEvent(new MouseEvent("mousemove", { bubbles: true }));
      vehicleGroup?.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    });

    const stateAfterDrag = useEditorStore.getState();
    const points = stateAfterDrag.project.scene.objects[0]?.movement.points;
    expect(points).toHaveLength(2);
    expect(points?.[0]).toBe(initialPoint);
    expect(points?.[1]).toMatchObject({ time: 3.3, x: 1000, y: 520 });
    expect(stateAfterDrag.selection).toEqual({
      objectId: vehicleBeforeDrag?.id,
      movementPointId: null,
      pathId: null,
      stateKeyframeId: null,
    });

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("shows selectable Movement Point markers only for the selected Vehicle", async () => {
    useEditorStore.getState().addVehicle("car-blue-sedan");
    const vehicle = useEditorStore.getState().project.scene.objects[0];
    expect(vehicle).toBeDefined();
    useEditorStore.getState().setCurrentTime(3.3);
    useEditorStore
      .getState()
      .updateVehiclePosition(vehicle?.id as string, 1000, 520);
    const updatedVehicle = useEditorStore.getState().project.scene.objects[0];
    const projectBeforeSelection = useEditorStore.getState().project;

    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(<ScenePanel />);
    });
    await act(async () => Promise.resolve());

    expect(
      container.querySelectorAll('[data-movement-point-marker="true"]'),
    ).toHaveLength(0);

    await act(async () => {
      useEditorStore.getState().selectObject(vehicle?.id as string);
    });

    const markers = container.querySelectorAll<HTMLButtonElement>(
      '[data-movement-point-marker="true"]',
    );
    expect(markers).toHaveLength(2);
    expect(markers[0]?.dataset.x).toBe("800");
    expect(markers[0]?.dataset.y).toBe("450");
    expect(markers[1]?.dataset.x).toBe("1000");
    expect(markers[1]?.dataset.y).toBe("520");

    await act(async () => {
      markers[1]?.click();
    });

    const selectedPoint = updatedVehicle?.movement.points[1];
    expect(useEditorStore.getState().selection).toEqual({
      objectId: vehicle?.id,
      movementPointId: selectedPoint?.id,
      pathId: null,
      stateKeyframeId: null,
    });
    expect(useEditorStore.getState().currentTime).toBe(3.3);
    expect(useEditorStore.getState().project).toBe(projectBeforeSelection);
    expect(
      container.querySelectorAll('[data-selected="true"]'),
    ).toHaveLength(1);
    expect(
      container
        .querySelector('[aria-label^="Scene viewport"]')
        ?.getAttribute("aria-label"),
    ).toContain("movement point at 3.30 seconds selected");

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("removes a deleted Movement Point marker and keeps the Vehicle selected", async () => {
    useEditorStore.getState().addVehicle("car-blue-sedan");
    const vehicleId = useEditorStore.getState().project.scene.objects[0]?.id;
    useEditorStore.getState().setCurrentTime(3.3);
    useEditorStore
      .getState()
      .updateVehiclePosition(vehicleId as string, 1000, 520);
    const targetPoint =
      useEditorStore.getState().project.scene.objects[0]?.movement.points[1];
    useEditorStore
      .getState()
      .selectMovementPoint(vehicleId as string, targetPoint?.id as string);

    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(<ScenePanel />);
    });
    await act(async () => Promise.resolve());

    expect(
      container.querySelectorAll('[data-movement-point-marker="true"]'),
    ).toHaveLength(2);

    await act(async () => {
      useEditorStore
        .getState()
        .deleteMovementPoint(vehicleId as string, targetPoint?.id as string);
    });

    const remainingMarkers = container.querySelectorAll<HTMLButtonElement>(
      '[data-movement-point-marker="true"]',
    );
    expect(remainingMarkers).toHaveLength(1);
    expect(remainingMarkers[0]?.dataset.x).toBe("800");
    expect(remainingMarkers[0]?.dataset.y).toBe("450");
    expect(useEditorStore.getState().selection).toMatchObject({
      objectId: vehicleId,
      movementPointId: null,
    });
    expect(
      container
        .querySelector('[aria-label^="Scene viewport"]')
        ?.getAttribute("aria-label"),
    ).toContain("selected");

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("drags a Point marker by logical coordinates and clamps it to Vehicle bounds", async () => {
    useEditorStore.getState().addVehicle("car-blue-sedan");
    const vehicleId = useEditorStore.getState().project.scene.objects[0]?.id;
    useEditorStore.getState().setCurrentTime(3.3);
    useEditorStore
      .getState()
      .updateVehiclePosition(vehicleId as string, 1000, 520);
    const vehicleBeforeDrag = useEditorStore.getState().project.scene.objects[0];
    const initialPoint = vehicleBeforeDrag?.movement.points[0];
    const targetPoint = vehicleBeforeDrag?.movement.points[1];
    useEditorStore.getState().selectObject(vehicleId as string);

    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(<ScenePanel />);
    });
    await act(async () => Promise.resolve());

    const markers = container.querySelectorAll<HTMLButtonElement>(
      '[data-movement-point-marker="true"]',
    );
    const targetMarker = markers[1];
    expect(targetMarker?.dataset.draggable).toBe("true");

    await act(async () => {
      targetMarker?.dispatchEvent(
        new MouseEvent("mousedown", { bubbles: true }),
      );
      if (targetMarker) {
        targetMarker.dataset.nextX = "-10";
        targetMarker.dataset.nextY = "950";
      }
      targetMarker?.dispatchEvent(
        new MouseEvent("mousemove", { bubbles: true }),
      );
      targetMarker?.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    });

    const stateAfterDrag = useEditorStore.getState();
    const vehicleAfterDrag = stateAfterDrag.project.scene.objects[0];
    expect(vehicleAfterDrag?.movement.points).toHaveLength(2);
    expect(vehicleAfterDrag?.movement.points[0]).toBe(initialPoint);
    expect(vehicleAfterDrag?.movement.points[1]).toEqual({
      ...targetPoint,
      x: 60,
      y: 864,
    });
    expect(vehicleAfterDrag?.movement.points[1]?.id).toBe(targetPoint?.id);
    expect(vehicleAfterDrag?.movement.points[1]?.time).toBe(3.3);
    expect(vehicleAfterDrag?.movement.paths).toBe(vehicleBeforeDrag?.movement.paths);
    expect(vehicleAfterDrag?.stateTracks).toBe(vehicleBeforeDrag?.stateTracks);
    expect(stateAfterDrag.currentTime).toBe(3.3);
    expect(stateAfterDrag.selection).toEqual({
      objectId: vehicleId,
      movementPointId: targetPoint?.id,
      pathId: null,
      stateKeyframeId: null,
    });

    const selectedMarker = container.querySelector<HTMLButtonElement>(
      '[data-movement-point-marker="true"][data-selected="true"]',
    );
    expect(selectedMarker?.dataset.x).toBe("60");
    expect(selectedMarker?.dataset.y).toBe("864");

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("renders exact Bézier Paths below the Vehicle and Point markers", async () => {
    useEditorStore.getState().addVehicle("car-blue-sedan");
    const vehicleId = useEditorStore.getState().project.scene.objects[0]!.id;
    useEditorStore.getState().setCurrentTime(3.3);
    useEditorStore.getState().updateVehiclePosition(vehicleId, 1100, 600);
    const projectWithDefaultPath = useEditorStore.getState().project;
    const vehicle = projectWithDefaultPath.scene.objects[0]!;
    const defaultPath = vehicle.movement.paths[0]!;
    const projectWithEditedControls = {
      ...projectWithDefaultPath,
      scene: {
        ...projectWithDefaultPath.scene,
        objects: [
          {
            ...vehicle,
            movement: {
              ...vehicle.movement,
              paths: [
                {
                  ...defaultPath,
                  control1: { x: 860, y: 300 },
                  control2: { x: 1040, y: 720 },
                },
              ],
            },
          },
        ],
      },
    };
    useEditorStore.getState().setProject(projectWithEditedControls);
    useEditorStore.getState().selectObject(vehicleId);
    const projectBeforeRender = useEditorStore.getState().project;
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<ScenePanel />);
    });
    await act(async () => Promise.resolve());

    const path = container.querySelector<HTMLElement>("[data-movement-path]")!;
    const sceneSurface = container.querySelector<HTMLElement>(
      "[data-scene-surface]",
    )!;
    const vehicleGroup = container.querySelector<HTMLElement>(
      "[data-konva-group]",
    )!;
    const marker = container.querySelector<HTMLElement>(
      "[data-movement-point-marker]",
    )!;
    const sceneBorder = container.querySelector<HTMLElement>(
      "[data-scene-border]",
    )!;

    expect(JSON.parse(path.dataset.points!)).toEqual([
      800, 450, 860, 300, 1040, 720, 1100, 600,
    ]);
    expect(path.dataset.pathId).toBe(defaultPath.id);
    expect(path.dataset.bezier).toBe("true");
    expect(path.dataset.stroke).toBe("#f59e0b");
    expect(path.dataset.strokeWidth).toBe("4");
    expect(path.dataset.strokeScaleEnabled).toBe("false");
    expect(path.dataset.lineCap).toBe("round");
    expect(path.dataset.lineJoin).toBe("round");
    expect(path.dataset.listening).toBe("true");
    expect(path.dataset.hitStrokeWidth).toBe("20");
    expect(
      sceneSurface.compareDocumentPosition(path) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      path.compareDocumentPosition(vehicleGroup) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      path.compareDocumentPosition(marker) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      path.compareDocumentPosition(sceneBorder) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(useEditorStore.getState().project).toBe(projectBeforeRender);

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("keeps Paths visible without selection and follows geometry and topology updates", async () => {
    useEditorStore.getState().addVehicle("car-blue-sedan");
    const vehicleId = useEditorStore.getState().project.scene.objects[0]!.id;
    useEditorStore.getState().setCurrentTime(3);
    useEditorStore.getState().updateVehiclePosition(vehicleId, 1000, 520);
    useEditorStore.getState().setCurrentTime(5);
    useEditorStore.getState().updateVehiclePosition(vehicleId, 1200, 600);
    const vehicle = useEditorStore.getState().project.scene.objects[0]!;
    const middlePoint = vehicle.movement.points[1]!;
    const lastPoint = vehicle.movement.points[2]!;
    const firstPath = vehicle.movement.paths[0]!;
    const firstControlPoints = [
      firstPath.control1.x,
      firstPath.control1.y,
      firstPath.control2.x,
      firstPath.control2.y,
    ];
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<ScenePanel />);
    });

    expect(useEditorStore.getState().selection.objectId).toBeNull();
    expect(container.querySelectorAll("[data-movement-path]")).toHaveLength(2);
    expect(
      container.querySelectorAll("[data-movement-point-marker]"),
    ).toHaveLength(0);

    await act(async () => {
      useEditorStore
        .getState()
        .updateMovementPointPosition(vehicleId, middlePoint.id, 1040, 560);
    });

    const firstPathAfterMove = container.querySelector<HTMLElement>(
      `[data-path-id="${firstPath.id}"]`,
    )!;
    const pointsAfterMove = JSON.parse(firstPathAfterMove.dataset.points!);
    expect(pointsAfterMove.slice(2, 6)).toEqual(firstControlPoints);
    expect(pointsAfterMove.slice(6)).toEqual([1040, 560]);

    await act(async () => {
      useEditorStore.getState().deleteMovementPoint(vehicleId, middlePoint.id);
    });

    const remainingPaths = container.querySelectorAll<HTMLElement>(
      "[data-movement-path]",
    );
    expect(remainingPaths).toHaveLength(1);
    expect(JSON.parse(remainingPaths[0]!.dataset.points!)).toEqual([
      800,
      450,
      expect.any(Number),
      expect.any(Number),
      expect.any(Number),
      expect.any(Number),
      lastPoint.x,
      lastPoint.y,
    ]);

    await act(async () => {
      resizeCallback(
        [{ contentRect: { width: 800, height: 450 } } as ResizeObserverEntry],
        {} as ResizeObserver,
      );
    });
    expect(remainingPaths[0]!.dataset.strokeWidth).toBe("4");
    expect(remainingPaths[0]!.dataset.strokeScaleEnabled).toBe("false");

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("reconciles rendered Path nodes after Point time reordering", async () => {
    useEditorStore.getState().addVehicle("car-blue-sedan");
    const vehicleId = useEditorStore.getState().project.scene.objects[0]!.id;

    for (const point of [
      { time: 2, x: 420, y: 180 },
      { time: 4, x: 720, y: 700 },
      { time: 6, x: 1120, y: 220 },
    ]) {
      useEditorStore.getState().setCurrentTime(point.time);
      useEditorStore
        .getState()
        .updateVehiclePosition(vehicleId, point.x, point.y);
    }

    const vehicle = useEditorStore.getState().project.scene.objects[0]!;
    const pointAtTwo = vehicle.movement.points[1]!;
    const pointAtFour = vehicle.movement.points[2]!;
    const pointAtSix = vehicle.movement.points[3]!;
    const [pathZeroToTwo, pathTwoToFour, preservedPath] =
      vehicle.movement.paths;
    useEditorStore
      .getState()
      .updatePathControlPoint(
        vehicleId,
        preservedPath!.id,
        "control1",
        900,
        100,
      );
    useEditorStore
      .getState()
      .updatePathControlPoint(
        vehicleId,
        preservedPath!.id,
        "control2",
        1300,
        800,
      );
    useEditorStore.getState().selectPath(vehicleId, preservedPath!.id);
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<ScenePanel />);
    });

    expect(container.querySelectorAll("[data-movement-path]")).toHaveLength(3);
    expect(
      container.querySelector(`[data-path-id="${preservedPath!.id}"]`),
    ).not.toBeNull();

    await act(async () => {
      useEditorStore
        .getState()
        .updateMovementPointTime(vehicleId, pointAtTwo.id, 7);
    });

    const movement =
      useEditorStore.getState().project.scene.objects[0]!.movement;
    const renderedPaths = [
      ...container.querySelectorAll<HTMLElement>("[data-movement-path]"),
    ];
    expect(renderedPaths).toHaveLength(3);
    expect(renderedPaths.map((path) => path.dataset.pathId)).toEqual(
      movement.paths.map((path) => path.id),
    );
    expect(
      container.querySelector(`[data-path-id="${pathZeroToTwo!.id}"]`),
    ).toBeNull();
    expect(
      container.querySelector(`[data-path-id="${pathTwoToFour!.id}"]`),
    ).toBeNull();

    const preservedPathNode = container.querySelector<HTMLElement>(
      `[data-path-id="${preservedPath!.id}"]`,
    )!;
    expect(preservedPathNode.dataset.selected).toBe("true");
    expect(JSON.parse(preservedPathNode.dataset.points!)).toEqual([
      pointAtFour.x,
      pointAtFour.y,
      900,
      100,
      1300,
      800,
      pointAtSix.x,
      pointAtSix.y,
    ]);
    expect(container.querySelectorAll("[data-control-point]")).toHaveLength(2);

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("reconnects rendered Paths after deleting a middle Point", async () => {
    useEditorStore.getState().addVehicle("car-blue-sedan");
    const vehicleId = useEditorStore.getState().project.scene.objects[0]!.id;

    for (const point of [
      { time: 2, x: 420, y: 180 },
      { time: 4, x: 720, y: 700 },
      { time: 6, x: 1120, y: 220 },
    ]) {
      useEditorStore.getState().setCurrentTime(point.time);
      useEditorStore
        .getState()
        .updateVehiclePosition(vehicleId, point.x, point.y);
    }

    const vehicle = useEditorStore.getState().project.scene.objects[0]!;
    const initialPoint = vehicle.movement.points[0]!;
    const pointAtTwo = vehicle.movement.points[1]!;
    const pointAtFour = vehicle.movement.points[2]!;
    const pointAtSix = vehicle.movement.points[3]!;
    const [pathZeroToTwo, pathTwoToFour, preservedPath] =
      vehicle.movement.paths;
    useEditorStore
      .getState()
      .updatePathControlPoint(
        vehicleId,
        preservedPath!.id,
        "control1",
        900,
        100,
      );
    useEditorStore
      .getState()
      .updatePathControlPoint(
        vehicleId,
        preservedPath!.id,
        "control2",
        1300,
        800,
      );
    useEditorStore.getState().selectPath(vehicleId, preservedPath!.id);
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<ScenePanel />);
    });

    expect(container.querySelectorAll("[data-movement-path]")).toHaveLength(3);
    expect(container.querySelectorAll("[data-movement-point-marker]")).toHaveLength(
      4,
    );

    await act(async () => {
      useEditorStore
        .getState()
        .deleteMovementPoint(vehicleId, pointAtTwo.id);
    });

    const movement =
      useEditorStore.getState().project.scene.objects[0]!.movement;
    const replacementPath = movement.paths[0]!;
    const renderedPaths = [
      ...container.querySelectorAll<HTMLElement>("[data-movement-path]"),
    ];
    expect(renderedPaths).toHaveLength(2);
    expect(renderedPaths.map((path) => path.dataset.pathId)).toEqual(
      movement.paths.map((path) => path.id),
    );
    expect(
      container.querySelector(`[data-path-id="${pathZeroToTwo!.id}"]`),
    ).toBeNull();
    expect(
      container.querySelector(`[data-path-id="${pathTwoToFour!.id}"]`),
    ).toBeNull();
    expect(
      container.querySelector(
        `[aria-label^="Movement point at ${pointAtTwo.time.toFixed(2)} seconds"]`,
      ),
    ).toBeNull();
    expect(container.querySelectorAll("[data-movement-point-marker]")).toHaveLength(
      3,
    );

    const replacementPathNode = container.querySelector<HTMLElement>(
      `[data-path-id="${replacementPath.id}"]`,
    )!;
    expect(JSON.parse(replacementPathNode.dataset.points!)).toEqual([
      initialPoint.x,
      initialPoint.y,
      replacementPath.control1.x,
      replacementPath.control1.y,
      replacementPath.control2.x,
      replacementPath.control2.y,
      pointAtFour.x,
      pointAtFour.y,
    ]);

    const preservedPathNode = container.querySelector<HTMLElement>(
      `[data-path-id="${preservedPath!.id}"]`,
    )!;
    expect(preservedPathNode.dataset.selected).toBe("true");
    expect(JSON.parse(preservedPathNode.dataset.points!)).toEqual([
      pointAtFour.x,
      pointAtFour.y,
      900,
      100,
      1300,
      800,
      pointAtSix.x,
      pointAtSix.y,
    ]);
    expect(container.querySelectorAll("[data-control-point]")).toHaveLength(2);

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("skips a Path with a missing endpoint without changing the Project", () => {
    useEditorStore.getState().addVehicle("car-blue-sedan");
    const project = useEditorStore.getState().project;
    const vehicle = project.scene.objects[0]!;
    useEditorStore.getState().setProject({
      ...project,
      scene: {
        ...project.scene,
        objects: [
          {
            ...vehicle,
            movement: {
              ...vehicle.movement,
              paths: [
                {
                  id: "invalid-path",
                  fromPointId: vehicle.movement.points[0]!.id,
                  toPointId: "missing-point",
                  type: "cubicBezier",
                  control1: { x: 900, y: 450 },
                  control2: { x: 1000, y: 450 },
                },
              ],
            },
          },
        ],
      },
    });
    const projectBeforeRender = useEditorStore.getState().project;

    const markup = renderToStaticMarkup(<ScenePanel />);

    expect(markup).not.toContain("data-movement-path");
    expect(useEditorStore.getState().project).toBe(projectBeforeRender);
  });

  it("selects and switches Paths without changing current time or Project", async () => {
    useEditorStore.getState().addVehicle("car-blue-sedan");
    const vehicleId = useEditorStore.getState().project.scene.objects[0]!.id;
    useEditorStore.getState().setCurrentTime(3);
    useEditorStore.getState().updateVehiclePosition(vehicleId, 1000, 520);
    useEditorStore.getState().setCurrentTime(5);
    useEditorStore.getState().updateVehiclePosition(vehicleId, 1200, 600);
    useEditorStore.getState().setCurrentTime(4.4);
    const projectBeforeSelection = useEditorStore.getState().project;
    const vehicle = projectBeforeSelection.scene.objects[0]!;
    const [firstPath, secondPath] = vehicle.movement.paths;
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<ScenePanel />);
    });

    const firstPathNode = container.querySelector<HTMLButtonElement>(
      `[data-path-id="${firstPath!.id}"]`,
    )!;
    const secondPathNode = container.querySelector<HTMLButtonElement>(
      `[data-path-id="${secondPath!.id}"]`,
    )!;

    await act(async () => {
      firstPathNode.click();
    });

    expect(useEditorStore.getState().selection).toEqual({
      objectId: vehicleId,
      movementPointId: null,
      pathId: firstPath!.id,
      stateKeyframeId: null,
    });
    expect(useEditorStore.getState().currentTime).toBe(4.4);
    expect(useEditorStore.getState().project).toBe(projectBeforeSelection);
    expect(firstPathNode.dataset.selected).toBe("true");
    expect(firstPathNode.dataset.stroke).toBe("#059669");
    expect(firstPathNode.dataset.strokeWidth).toBe("6");
    expect(secondPathNode.dataset.selected).toBe("false");
    expect(container.querySelector('[aria-label^="Scene viewport"]')?.getAttribute("aria-label"))
      .toContain("movement path selected");

    await act(async () => {
      secondPathNode.dispatchEvent(new Event("touchend", { bubbles: true }));
    });

    expect(useEditorStore.getState().selection.pathId).toBe(secondPath!.id);
    expect(firstPathNode.dataset.selected).toBe("false");
    expect(secondPathNode.dataset.selected).toBe("true");

    await act(async () => {
      container.querySelector<HTMLDivElement>("[data-konva-group]")?.click();
    });
    expect(useEditorStore.getState().selection).toMatchObject({
      objectId: vehicleId,
      movementPointId: null,
      pathId: null,
    });

    await act(async () => {
      firstPathNode.click();
    });
    const markers = container.querySelectorAll<HTMLButtonElement>(
      '[data-movement-point-marker="true"]',
    );
    await act(async () => {
      markers[1]?.click();
    });
    expect(useEditorStore.getState().selection).toMatchObject({
      objectId: vehicleId,
      movementPointId: vehicle.movement.points[1]!.id,
      pathId: null,
    });

    await act(async () => {
      firstPathNode.click();
      container.querySelector<HTMLDivElement>("[data-konva-stage]")?.click();
    });
    expect(useEditorStore.getState().selection).toEqual({
      objectId: null,
      movementPointId: null,
      pathId: null,
      stateKeyframeId: null,
    });
    expect(container.querySelectorAll('[data-selected="true"]')).toHaveLength(0);
    expect(container.querySelectorAll("[data-movement-path]")).toHaveLength(2);

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});

describe("F4.4 Scene Control Point editing", () => {
  beforeEach(() => {
    useEditorStore.setState({
      project: createEmptyAnimationProject(),
      currentTime: 0,
      selection: {
        objectId: null,
        movementPointId: null,
        pathId: null,
        stateKeyframeId: null,
      },
    });
    useEditorStore.getState().addVehicle("car-blue-sedan");
    const vehicleId = useEditorStore.getState().project.scene.objects[0]!.id;
    useEditorStore.getState().setCurrentTime(3);
    useEditorStore.getState().updateVehiclePosition(vehicleId, 1000, 520);
    useEditorStore.getState().setCurrentTime(5);
    useEditorStore.getState().updateVehiclePosition(vehicleId, 1200, 600);
  });

  it("renders fixed-size controls and endpoint guides only for the selected Path", async () => {
    const vehicle = useEditorStore.getState().project.scene.objects[0]!;
    const path = vehicle.movement.paths[0]!;
    useEditorStore.getState().selectPath(vehicle.id, path.id);
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<ScenePanel />);
    });

    const controls = container.querySelectorAll<HTMLElement>(
      "[data-control-point]",
    );
    const guides = container.querySelectorAll<HTMLElement>(
      "[data-control-guide]",
    );
    expect(controls).toHaveLength(2);
    expect(guides).toHaveLength(2);
    expect(controls[0]!.dataset.controlPoint).toBe("Control 1");
    expect(controls[0]!.dataset.fill).toBe("#0891b2");
    expect(controls[0]!.dataset.x).toBe(String(path.control1.x));
    expect(controls[0]!.dataset.y).toBe(String(path.control1.y));
    expect(controls[0]!.dataset.radius).toBe("10");
    expect(controls[0]!.dataset.strokeWidth).toBe("3");
    expect(controls[1]!.dataset.controlPoint).toBe("Control 2");
    expect(controls[1]!.dataset.fill).toBe("#e11d48");
    expect(JSON.parse(guides[0]!.dataset.points!)).toEqual([
      vehicle.movement.points[0]!.x,
      vehicle.movement.points[0]!.y,
      path.control1.x,
      path.control1.y,
    ]);
    expect(JSON.parse(guides[1]!.dataset.points!)).toEqual([
      vehicle.movement.points[1]!.x,
      vehicle.movement.points[1]!.y,
      path.control2.x,
      path.control2.y,
    ]);
    expect(guides[0]!.dataset.listening).toBe("false");
    expect(guides[1]!.dataset.listening).toBe("false");

    await act(async () => {
      resizeCallback(
        [{ contentRect: { width: 800, height: 450 } } as ResizeObserverEntry],
        {} as ResizeObserver,
      );
    });

    const scaledControls = container.querySelectorAll<HTMLElement>(
      "[data-control-point]",
    );
    const scaledGuides = container.querySelectorAll<HTMLElement>(
      "[data-control-guide]",
    );
    expect(scaledControls[0]!.dataset.radius).toBe("20");
    expect(scaledControls[0]!.dataset.strokeWidth).toBe("6");
    expect(scaledGuides[0]!.dataset.strokeWidth).toBe("2");
    expect(scaledGuides[0]!.dataset.strokeScaleEnabled).toBe("false");
    expect(scaledGuides[0]!.dataset.dash).toBe("[12,8]");

    await act(async () => {
      useEditorStore.getState().selectPath(vehicle.id, vehicle.movement.paths[1]!.id);
    });
    expect(container.querySelectorAll("[data-control-point]")).toHaveLength(2);
    expect(
      container.querySelector("[data-control-point]")?.getAttribute("data-x"),
    ).toBe(String(vehicle.movement.paths[1]!.control1.x));

    await act(async () => {
      container.querySelector<HTMLDivElement>("[data-konva-stage]")?.click();
    });
    expect(container.querySelectorAll("[data-control-point]")).toHaveLength(0);
    expect(container.querySelectorAll("[data-control-guide]")).toHaveLength(0);

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("updates the selected curve live while dragging one Control Point", async () => {
    const vehicle = useEditorStore.getState().project.scene.objects[0]!;
    const path = vehicle.movement.paths[0]!;
    const untouchedControl = path.control2;
    const untouchedPath = vehicle.movement.paths[1]!;
    useEditorStore.getState().selectPath(vehicle.id, path.id);
    const selectionBeforeDrag = useEditorStore.getState().selection;
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<ScenePanel />);
    });

    const control1 = container.querySelector<HTMLButtonElement>(
      '[data-control-point="Control 1"]',
    )!;
    control1.dataset.nextX = "440.25";
    control1.dataset.nextY = "160.75";

    await act(async () => {
      control1.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
      control1.dispatchEvent(new MouseEvent("mousemove", { bubbles: true }));
    });

    const stateDuringDrag = useEditorStore.getState();
    const updatedVehicle = stateDuringDrag.project.scene.objects[0]!;
    const updatedPath = updatedVehicle.movement.paths[0]!;
    expect(updatedPath.control1).toEqual({ x: 440.25, y: 160.75 });
    expect(updatedPath.control2).toBe(untouchedControl);
    expect(updatedVehicle.movement.paths[1]).toBe(untouchedPath);
    expect(stateDuringDrag.selection).toBe(selectionBeforeDrag);
    const curve = container.querySelector<HTMLElement>(
      `[data-path-id="${path.id}"]`,
    )!;
    expect(JSON.parse(curve.dataset.points!).slice(2, 4)).toEqual([
      440.25, 160.75,
    ]);
    const guide = container.querySelector<HTMLElement>(
      '[data-control-guide="Control 1 guide"]',
    )!;
    expect(JSON.parse(guide.dataset.points!).slice(2)).toEqual([
      440.25, 160.75,
    ]);

    const renderedControl = container.querySelector<HTMLButtonElement>(
      '[data-control-point="Control 1"]',
    )!;
    await act(async () => {
      renderedControl.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    });
    expect(
      useEditorStore.getState().project.scene.objects[0]!.movement.paths[0]!
        .control1,
    ).toEqual({ x: 440.25, y: 160.75 });
    expect(useEditorStore.getState().selection.pathId).toBe(path.id);

    await act(async () => {
      useEditorStore
        .getState()
        .updateMovementPointPosition(
          vehicle.id,
          vehicle.movement.points[0]!.id,
          720,
          360,
        );
    });
    const pathAfterEndpointMove =
      useEditorStore.getState().project.scene.objects[0]!.movement.paths[0]!;
    expect(pathAfterEndpointMove.control1).toEqual({ x: 440.25, y: 160.75 });
    expect(
      JSON.parse(
        container.querySelector<HTMLElement>(
          '[data-control-guide="Control 1 guide"]',
        )!.dataset.points!,
      ),
    ).toEqual([720, 360, 440.25, 160.75]);

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});

function setTimelineBounds(element: HTMLElement, left = 100, width = 6000) {
  Object.defineProperty(element, "getBoundingClientRect", {
    configurable: true,
    value: () => ({
      bottom: 320,
      height: 320,
      left,
      right: left + width,
      top: 0,
      width,
      x: left,
      y: 0,
      toJSON: () => ({}),
    }),
  });
}

describe("F7.7 Preview Seek", () => {
  beforeEach(() => {
    useEditorStore.setState({
      project: createEmptyAnimationProject(),
      currentTime: 0,
      selection: {
        objectId: null,
        movementPointId: null,
        pathId: null,
        stateKeyframeId: null,
      },
    });
  });

  function createCurvedVehicle() {
    useEditorStore.getState().addVehicle("car-blue-sedan");
    const vehicleId = useEditorStore.getState().project.scene.objects[0]!.id;
    useEditorStore.getState().setCurrentTime(10);
    useEditorStore.getState().updateVehiclePosition(vehicleId, 1200, 600);
    const pathId = useEditorStore.getState().project.scene.objects[0]!.movement
      .paths[0]!.id;
    useEditorStore
      .getState()
      .updatePathControlPoint(vehicleId, pathId, "control1", 300, 100);
    useEditorStore
      .getState()
      .updatePathControlPoint(vehicleId, pathId, "control2", 1100, 800);
    useEditorStore.getState().setCurrentTime(0);
    return vehicleId;
  }

  it("renders arbitrary Bézier position and tangent rotation from F7.6", async () => {
    createCurvedVehicle();
    const project = useEditorStore.getState().project;
    const vehicle = project.scene.objects[0]!;
    const path = vehicle.movement.paths[0]!;
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<ScenePanel />);
    });

    for (const [time, progress] of [
      [2.5, 0.25],
      [5, 0.5],
      [7.3, 0.73],
    ] as const) {
      await act(async () => {
        useEditorStore.getState().setCurrentTime(time);
      });
      const group = container.querySelector<HTMLElement>("[data-konva-group]")!;
      const expectedPosition = calculatePathPosition(
        vehicle.movement.points,
        path,
        progress,
      )!;
      const expectedRotation = calculatePathRotation(
        vehicle.movement.points,
        path,
        progress,
      )!;

      expect(Number(group.dataset.x)).toBeCloseTo(expectedPosition.x);
      expect(Number(group.dataset.y)).toBeCloseTo(expectedPosition.y);
      expect(Number(group.dataset.rotation)).toBeCloseTo(expectedRotation);
    }
    expect(useEditorStore.getState().project).toBe(project);

    await act(async () => root.unmount());
    container.remove();
  });

  it("connects a snapped Timeline click to the composed Scene pose", async () => {
    createCurvedVehicle();
    const stateBefore = useEditorStore.getState();
    const projectSnapshot = JSON.stringify(stateBefore.project);
    const vehicle = stateBefore.project.scene.objects[0]!;
    const path = vehicle.movement.paths[0]!;
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <>
          <ScenePanel />
          <TimelinePanel />
        </>,
      );
    });
    const surface = container.querySelector<HTMLElement>(
      '[data-testid="timeline-time-surface"]',
    )!;
    setTimelineBounds(surface);

    await act(async () => {
      surface.dispatchEvent(
        new MouseEvent("click", { bubbles: true, clientX: 600 }),
      );
    });

    const group = container.querySelector<HTMLElement>("[data-konva-group]")!;
    const expectedPosition = calculatePathPosition(
      vehicle.movement.points,
      path,
      0.5,
    )!;
    expect(useEditorStore.getState().currentTime).toBe(5);
    expect(Number(group.dataset.x)).toBeCloseTo(expectedPosition.x);
    expect(Number(group.dataset.y)).toBeCloseTo(expectedPosition.y);
    expect(container.textContent).toContain("Current time: 5.00s");
    expect(useEditorStore.getState().project).toBe(stateBefore.project);
    expect(JSON.stringify(useEditorStore.getState().project)).toBe(projectSnapshot);
    expect(useEditorStore.getState().selection).toBe(stateBefore.selection);

    const poseBeforeZoom = {
      x: group.dataset.x,
      y: group.dataset.y,
      rotation: group.dataset.rotation,
    };
    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-visible-span="60"]')?.click();
    });
    expect({
      x: group.dataset.x,
      y: group.dataset.y,
      rotation: group.dataset.rotation,
    }).toEqual(poseBeforeZoom);

    await act(async () => root.unmount());
    container.remove();
  });

  it("seeks multiple Vehicles independently without losing identity", async () => {
    useEditorStore.getState().addVehicle("car-blue-sedan");
    useEditorStore.getState().addVehicle("car-blue-sedan");
    const [first, second] = useEditorStore.getState().project.scene.objects;
    useEditorStore.getState().setCurrentTime(10);
    useEditorStore.getState().updateVehiclePosition(first!.id, 1400, 200);
    useEditorStore.getState().updateVehiclePosition(second!.id, 200, 800);
    useEditorStore.getState().setCurrentTime(5);
    const project = useEditorStore.getState().project;
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<ScenePanel />);
    });

    const groups = container.querySelectorAll<HTMLElement>("[data-konva-group]");
    expect(groups).toHaveLength(2);
    expect([...groups].map((group) => group.dataset.vehicleId)).toEqual([
      first!.id,
      second!.id,
    ]);
    for (const [index, vehicle] of project.scene.objects.entries()) {
      const expected = calculatePathPosition(
        vehicle.movement.points,
        vehicle.movement.paths[0]!,
        0.5,
      )!;
      expect(Number(groups[index]!.dataset.x)).toBeCloseTo(expected.x);
      expect(Number(groups[index]!.dataset.y)).toBeCloseTo(expected.y);
    }

    await act(async () => root.unmount());
    container.remove();
  });

  it("creates a Movement Point when dragging from an interpolated pose", async () => {
    const vehicleId = createCurvedVehicle();
    useEditorStore.getState().setCurrentTime(5);
    const projectBefore = useEditorStore.getState().project;
    const vehicleBefore = projectBefore.scene.objects[0]!;
    const expectedStart = calculatePathPosition(
      vehicleBefore.movement.points,
      vehicleBefore.movement.paths[0]!,
      0.5,
    )!;
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<ScenePanel />);
    });
    const group = container.querySelector<HTMLDivElement>("[data-konva-group]")!;
    expect(Number(group.dataset.x)).toBeCloseTo(expectedStart.x);
    expect(Number(group.dataset.y)).toBeCloseTo(expectedStart.y);

    await act(async () => {
      group.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
      group.dataset.nextX = "700";
      group.dataset.nextY = "250";
      group.dispatchEvent(new MouseEvent("mousemove", { bubbles: true }));
      group.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    });

    const stateAfter = useEditorStore.getState();
    const vehicleAfter = stateAfter.project.scene.objects[0]!;
    expect(vehicleAfter.movement.points.map((point) => point.time)).toEqual([
      0, 5, 10,
    ]);
    expect(vehicleAfter.movement.points[1]).toMatchObject({ x: 700, y: 250 });
    expect(vehicleAfter.movement.paths).toHaveLength(2);
    expect(stateAfter.currentTime).toBe(5);
    expect(stateAfter.selection.objectId).toBe(vehicleId);
    expect(Number(group.dataset.x)).toBeCloseTo(700);
    expect(Number(group.dataset.y)).toBeCloseTo(250);

    await act(async () => root.unmount());
    container.remove();
  });

  it("does not render a stale previous-Point pose when composition is unresolved", async () => {
    createCurvedVehicle();
    const project = useEditorStore.getState().project;
    project.scene.objects[0]!.movement.paths = [];
    useEditorStore.setState({ project: { ...project, scene: { ...project.scene } } });
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<ScenePanel />);
    });

    expect(container.querySelector("[data-konva-group]")).toBeNull();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "Preview unavailable",
    );
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "incomplete movement data",
    );

    await act(async () => root.unmount());
    container.remove();
  });
});
