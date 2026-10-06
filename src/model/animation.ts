import type { Scene } from "./scene";

export interface AnimationProject {
  schemaVersion: 1;
  animationId: string;
  scene: Scene;
}

export function createEmptyAnimationProject(
  animationId = "untitled-animation",
): AnimationProject {
  return {
    schemaVersion: 1,
    animationId,
    scene: {
      width: 1600,
      height: 900,
      objects: [],
    },
  };
}
