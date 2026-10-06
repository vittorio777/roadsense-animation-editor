import { Circle, Group, Image as KonvaImage, Line, Rect } from "react-konva";

import type {
  VehicleAssetDefinition,
  VehicleLampAnchor,
} from "../../../assets/assetRegistry";
import type { PreviewVehicleState } from "../../../preview/sceneState";

const inactiveIndicator = "#78350f";
const activeIndicator = "#fbbf24";
const inactiveBrake = "#7f1d1d";
const activeBrake = "#ef4444";
const inactiveHeadlight = "#a8a29e";
const activeHeadlight = "#fef3c7";

interface VehicleVisualProps {
  asset: VehicleAssetDefinition;
  image: HTMLImageElement;
  preview: PreviewVehicleState;
  selected: boolean;
}

interface LampProps {
  anchor: VehicleLampAnchor;
  active: boolean;
  activeFill: string;
  inactiveFill: string;
  name: string;
}

export function createHeadlightBeamPoints(
  anchor: VehicleLampAnchor,
  forwardDeg: number,
  length: number,
  spread: number,
): number[] {
  const angle = (forwardDeg * Math.PI) / 180;
  const forwardX = Math.cos(angle);
  const forwardY = Math.sin(angle);
  const sideX = -forwardY;
  const sideY = forwardX;
  const startSpread = anchor.radius * 0.65;
  const endX = anchor.x + forwardX * length;
  const endY = anchor.y + forwardY * length;

  return [
    anchor.x + sideX * startSpread,
    anchor.y + sideY * startSpread,
    endX + sideX * spread,
    endY + sideY * spread,
    endX - sideX * spread,
    endY - sideY * spread,
    anchor.x - sideX * startSpread,
    anchor.y - sideY * startSpread,
  ];
}

function Lamp({
  anchor,
  active,
  activeFill,
  inactiveFill,
  name,
}: LampProps) {
  return (
    <Circle
      name={name}
      x={anchor.x}
      y={anchor.y}
      radius={anchor.radius}
      fill={active ? activeFill : inactiveFill}
      stroke={active ? "#ffffff" : "#292524"}
      strokeWidth={active ? 1.25 : 0.75}
      opacity={active ? 1 : 0.72}
      shadowColor={activeFill}
      shadowBlur={active ? anchor.radius * 2.5 : 0}
      listening={false}
    />
  );
}

export function VehicleVisual({
  asset,
  image,
  preview,
  selected,
}: VehicleVisualProps) {
  const { lights, forwardDeg } = asset.visual;
  const leftIndicatorActive =
    preview.indicator === "left" || preview.indicator === "hazard";
  const rightIndicatorActive =
    preview.indicator === "right" || preview.indicator === "hazard";

  return (
    <Group
      x={0}
      y={0}
      rotation={-forwardDeg}
      listening={false}
      name="Vehicle model visual"
    >
      {preview.headlight ? (
        <>
          <Line
            name="Headlight left beam"
            points={createHeadlightBeamPoints(
              lights.headlightLeft,
              forwardDeg,
              lights.headlightBeamLength,
              lights.headlightBeamSpread,
            )}
            closed
            fill="#fef3c7"
            opacity={0.28}
            listening={false}
          />
          <Line
            name="Headlight right beam"
            points={createHeadlightBeamPoints(
              lights.headlightRight,
              forwardDeg,
              lights.headlightBeamLength,
              lights.headlightBeamSpread,
            )}
            closed
            fill="#fef3c7"
            opacity={0.28}
            listening={false}
          />
        </>
      ) : null}
      <KonvaImage
        image={image}
        x={0}
        y={0}
        width={asset.width}
        height={asset.height}
        offsetX={asset.width / 2}
        offsetY={asset.height / 2}
        listening={false}
      />
      <Lamp
        name="Indicator front left"
        anchor={lights.indicatorFrontLeft}
        active={leftIndicatorActive}
        activeFill={activeIndicator}
        inactiveFill={inactiveIndicator}
      />
      <Lamp
        name="Indicator rear left"
        anchor={lights.indicatorRearLeft}
        active={leftIndicatorActive}
        activeFill={activeIndicator}
        inactiveFill={inactiveIndicator}
      />
      <Lamp
        name="Indicator front right"
        anchor={lights.indicatorFrontRight}
        active={rightIndicatorActive}
        activeFill={activeIndicator}
        inactiveFill={inactiveIndicator}
      />
      <Lamp
        name="Indicator rear right"
        anchor={lights.indicatorRearRight}
        active={rightIndicatorActive}
        activeFill={activeIndicator}
        inactiveFill={inactiveIndicator}
      />
      <Lamp
        name="Brake light left"
        anchor={lights.brakeLeft}
        active={preview.brakeLight}
        activeFill={activeBrake}
        inactiveFill={inactiveBrake}
      />
      <Lamp
        name="Brake light right"
        anchor={lights.brakeRight}
        active={preview.brakeLight}
        activeFill={activeBrake}
        inactiveFill={inactiveBrake}
      />
      <Lamp
        name="Headlight left"
        anchor={lights.headlightLeft}
        active={preview.headlight}
        activeFill={activeHeadlight}
        inactiveFill={inactiveHeadlight}
      />
      <Lamp
        name="Headlight right"
        anchor={lights.headlightRight}
        active={preview.headlight}
        activeFill={activeHeadlight}
        inactiveFill={inactiveHeadlight}
      />
      {selected ? (
        <Rect
          x={-asset.width / 2 - 10}
          y={-asset.height / 2 - 10}
          width={asset.width + 20}
          height={asset.height + 20}
          cornerRadius={10}
          stroke="#047857"
          strokeWidth={3}
          strokeScaleEnabled={false}
          dash={[12, 8]}
          fillEnabled={false}
          listening={false}
        />
      ) : null}
    </Group>
  );
}
