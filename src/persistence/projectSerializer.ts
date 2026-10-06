import type { AnimationProject } from "../model/animation";
import type { StateTrack } from "../model/stateTrack";
import { validateAnimationProject } from "./projectValidator";

export type ProjectSerializationResult =
  | { status: "serialized"; json: string }
  | { status: "invalid"; errors: string[] };

function copyStateTrack<T>(track: StateTrack<T>): StateTrack<T> {
  return {
    keyframes: track.keyframes.map((keyframe) => ({
      id: keyframe.id,
      time: keyframe.time,
      value: keyframe.value,
    })),
  };
}

function createCanonicalProject(project: AnimationProject): AnimationProject {
  return {
    schemaVersion: project.schemaVersion,
    animationId: project.animationId,
    scene: {
      width: project.scene.width,
      height: project.scene.height,
      ...(project.scene.background
        ? { background: { assetId: project.scene.background.assetId } }
        : {}),
      objects: project.scene.objects.map((vehicle) => ({
        id: vehicle.id,
        type: vehicle.type,
        assetId: vehicle.assetId,
        movement: {
          points: vehicle.movement.points.map((point) => ({
            id: point.id,
            time: point.time,
            x: point.x,
            y: point.y,
          })),
          paths: vehicle.movement.paths.map((path) => ({
            id: path.id,
            fromPointId: path.fromPointId,
            toPointId: path.toPointId,
            type: path.type,
            control1: {
              x: path.control1.x,
              y: path.control1.y,
            },
            control2: {
              x: path.control2.x,
              y: path.control2.y,
            },
          })),
        },
        stateTracks: {
          indicator: copyStateTrack(vehicle.stateTracks.indicator),
          brakeLight: copyStateTrack(vehicle.stateTracks.brakeLight),
          headlight: copyStateTrack(vehicle.stateTracks.headlight),
          horn: copyStateTrack(vehicle.stateTracks.horn),
        },
      })),
    },
  };
}

export function serializeAnimationProject(
  value: unknown,
): ProjectSerializationResult {
  const validation = validateAnimationProject(value);
  if (!validation.valid) {
    return { status: "invalid", errors: validation.errors };
  }

  try {
    const project = createCanonicalProject(value as AnimationProject);
    return {
      status: "serialized",
      json: `${JSON.stringify(project, null, 2)}\n`,
    };
  } catch {
    return {
      status: "invalid",
      errors: ["Project could not be serialized to JSON."],
    };
  }
}
