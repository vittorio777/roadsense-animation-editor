export interface SceneViewportLayout {
  displayWidth: number;
  displayHeight: number;
  scale: number;
}

export function calculateSceneViewportLayout(
  sceneWidth: number,
  sceneHeight: number,
  availableWidth: number,
  availableHeight: number,
): SceneViewportLayout | null {
  const dimensions = [
    sceneWidth,
    sceneHeight,
    availableWidth,
    availableHeight,
  ];

  if (dimensions.some((dimension) => !Number.isFinite(dimension) || dimension <= 0)) {
    return null;
  }

  const scale = Math.min(
    availableWidth / sceneWidth,
    availableHeight / sceneHeight,
    1,
  );

  return {
    displayWidth: sceneWidth * scale,
    displayHeight: sceneHeight * scale,
    scale,
  };
}
