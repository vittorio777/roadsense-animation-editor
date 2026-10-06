import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-konva", () => ({
  Group: ({
    children,
    rotation,
    listening,
    name,
  }: {
    children: ReactNode;
    rotation?: number;
    listening?: boolean;
    name?: string;
  }) => (
    <div
      data-model-group={name}
      data-rotation={rotation}
      data-listening={String(listening)}
    >
      {children}
    </div>
  ),
  Image: ({
    width,
    height,
    listening,
  }: {
    width: number;
    height: number;
    listening?: boolean;
  }) => (
    <div
      data-vehicle-body="true"
      data-width={width}
      data-height={height}
      data-listening={String(listening)}
    />
  ),
  Circle: ({
    name,
    x,
    y,
    radius,
    fill,
    listening,
  }: {
    name: string;
    x: number;
    y: number;
    radius: number;
    fill: string;
    listening?: boolean;
  }) => (
    <div
      data-lamp={name}
      data-x={x}
      data-y={y}
      data-radius={radius}
      data-fill={fill}
      data-listening={String(listening)}
    />
  ),
  Line: ({
    name,
    points,
    listening,
  }: {
    name: string;
    points: number[];
    listening?: boolean;
  }) => (
    <div
      data-beam={name}
      data-points={JSON.stringify(points)}
      data-listening={String(listening)}
    />
  ),
  Rect: ({ listening }: { listening?: boolean }) => (
    <div data-selection-outline="true" data-listening={String(listening)} />
  ),
}));

import type { VehicleAssetDefinition } from "../src/assets/assetRegistry";
import {
  createHeadlightBeamPoints,
  VehicleVisual,
} from "../src/editor/components/scene/VehicleVisual";
import type { PreviewVehicleState } from "../src/preview/sceneState";

const alternateAsset: VehicleAssetDefinition = {
  id: "test-car-facing-down",
  type: "vehicle",
  src: "/test-car.svg",
  name: "Test car",
  width: 80,
  height: 140,
  visual: {
    forwardDeg: 90,
    lights: {
      indicatorFrontLeft: { x: 12, y: 54, radius: 3 },
      indicatorRearLeft: { x: 12, y: -54, radius: 3 },
      indicatorFrontRight: { x: -12, y: 54, radius: 3 },
      indicatorRearRight: { x: -12, y: -54, radius: 3 },
      brakeLeft: { x: 9, y: -58, radius: 4 },
      brakeRight: { x: -9, y: -58, radius: 4 },
      headlightLeft: { x: 9, y: 58, radius: 4 },
      headlightRight: { x: -9, y: 58, radius: 4 },
      headlightBeamLength: 30,
      headlightBeamSpread: 8,
    },
  },
};

function preview(
  overrides: Partial<PreviewVehicleState> = {},
): PreviewVehicleState {
  return {
    id: "vehicle-1",
    assetId: alternateAsset.id,
    x: 100,
    y: 200,
    rotationDeg: 35,
    indicator: "off",
    brakeLight: false,
    headlight: false,
    horn: false,
    ...overrides,
  };
}

function renderVisual(state: PreviewVehicleState, selected = false): string {
  return renderToStaticMarkup(
    <VehicleVisual
      asset={alternateAsset}
      image={{} as HTMLImageElement}
      preview={state}
      selected={selected}
    />,
  );
}

describe("F7.10 Vehicle visual binding", () => {
  it("uses model-local geometry and native forward correction without an asset branch", () => {
    const markup = renderVisual(preview({ indicator: "left" }), true);

    expect(markup).toContain('data-rotation="-90"');
    expect(markup).toContain('data-width="80"');
    expect(markup).toContain('data-height="140"');
    expect(markup).toContain('data-lamp="Indicator front left"');
    expect(markup).toContain('data-x="12"');
    expect(markup).toContain('data-y="54"');
    expect(markup).toContain('data-fill="#fbbf24"');
    expect(markup).toContain('data-selection-outline="true"');
    expect(markup).not.toContain("car-blue-sedan");
  });

  it("maps off, right, hazard, brake and headlight states independently", () => {
    const offMarkup = renderVisual(preview());
    expect(offMarkup).not.toContain("data-beam=");
    expect(offMarkup.match(/data-fill="#78350f"/g)).toHaveLength(4);

    const rightMarkup = renderVisual(preview({ indicator: "right" }));
    expect(rightMarkup.match(/data-fill="#fbbf24"/g)).toHaveLength(2);

    const activeMarkup = renderVisual(
      preview({ indicator: "hazard", brakeLight: true, headlight: true }),
    );
    expect(activeMarkup.match(/data-fill="#fbbf24"/g)).toHaveLength(4);
    expect(activeMarkup.match(/data-fill="#ef4444"/g)).toHaveLength(2);
    expect(activeMarkup.match(/data-fill="#fef3c7"/g)).toHaveLength(2);
    expect(activeMarkup.match(/data-beam=/g)).toHaveLength(2);
  });

  it("keeps every model visual node non-interactive", () => {
    const markup = renderVisual(
      preview({ indicator: "hazard", brakeLight: true, headlight: true }),
      true,
    );
    const nodes = markup.match(/data-listening="false"/g) ?? [];

    expect(nodes).toHaveLength(13);
    expect(markup).not.toContain('data-listening="true"');
  });

  it("projects beams along the asset native forward direction", () => {
    const points = createHeadlightBeamPoints(
      { x: 9, y: 58, radius: 4 },
      90,
      30,
      8,
    );

    [6.4, 58, 1, 88, 17, 88, 11.6, 58].forEach((expected, index) => {
      expect(points[index]).toBeCloseTo(expected);
    });
  });
});
