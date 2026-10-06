export interface ScenePosition {
  x: number;
  y: number;
}

export function clampVehiclePosition(
  position: ScenePosition,
  sceneWidth: number,
  sceneHeight: number,
  vehicleWidth: number,
  vehicleHeight: number,
): ScenePosition {
  const halfWidth = vehicleWidth / 2;
  const halfHeight = vehicleHeight / 2;

  return {
    x: Math.min(Math.max(position.x, halfWidth), sceneWidth - halfWidth),
    y: Math.min(Math.max(position.y, halfHeight), sceneHeight - halfHeight),
  };
}
