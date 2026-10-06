import { beforeEach, describe, expect, it } from "vitest";

import { resolveAnimationProjectAssets } from "../src/assets/projectAssetResolver";
import type { AnimationProject } from "../src/model/animation";
import type { VehicleStateTrackKey } from "../src/model/stateTrack";
import { composePreviewSceneState } from "../src/preview/sceneState";
import { prepareAnimationProjectFile } from "../src/persistence/projectLoader";
import { serializeAnimationProject } from "../src/persistence/projectSerializer";
import { validateAnimationProject } from "../src/persistence/projectValidator";
import { useEditorStore } from "../src/store/editorStore";
import scaleProjectJson from "./fixtures/phase-7/mvp-scale-project.json";
import {
  createMvpScaleProject,
  MVP_SCALE_DURATION_SECONDS,
  MVP_SCALE_KEYFRAME_COUNT,
  MVP_SCALE_MOVEMENT_POINT_COUNT,
  MVP_SCALE_PATH_COUNT,
  MVP_SCALE_STATE_TRACK_COUNT,
  MVP_SCALE_VEHICLE_COUNT,
} from "./fixtures/mvpScaleProject";

const stateTrackKeys = [
  "indicator",
  "brakeLight",
  "headlight",
  "horn",
] as const satisfies readonly VehicleStateTrackKey[];

function requireSerialized(
  result: ReturnType<typeof serializeAnimationProject>,
): string {
  expect(result.status).toBe("serialized");
  if (result.status !== "serialized") {
    throw new Error(result.errors.join("\n"));
  }
  return result.json;
}

function expectScaleCounts(project: AnimationProject) {
  expect(project.scene.objects).toHaveLength(MVP_SCALE_VEHICLE_COUNT);
  expect(
    project.scene.objects.reduce(
      (count, vehicle) => count + vehicle.movement.points.length,
      0,
    ),
  ).toBe(MVP_SCALE_VEHICLE_COUNT * MVP_SCALE_MOVEMENT_POINT_COUNT);
  expect(
    project.scene.objects.reduce(
      (count, vehicle) => count + vehicle.movement.paths.length,
      0,
    ),
  ).toBe(MVP_SCALE_VEHICLE_COUNT * MVP_SCALE_PATH_COUNT);
  expect(
    project.scene.objects.reduce(
      (count, vehicle) =>
        count +
        stateTrackKeys.reduce(
          (trackCount, trackKey) =>
            trackCount + vehicle.stateTracks[trackKey].keyframes.length,
          0,
        ),
      0,
    ),
  ).toBe(
    MVP_SCALE_VEHICLE_COUNT *
      MVP_SCALE_STATE_TRACK_COUNT *
      MVP_SCALE_KEYFRAME_COUNT,
  );
}

describe("F7.13 MVP scale project", () => {
  beforeEach(() => {
    useEditorStore.setState({
      project: createMvpScaleProject(),
      currentTime: 0,
      isPreviewPlaying: false,
      selection: {
        objectId: null,
        movementPointId: null,
        pathId: null,
        stateKeyframeId: null,
      },
    });
  });

  it("builds the exact deterministic Roadmap scale", () => {
    const project = createMvpScaleProject();
    const repeatedProject = createMvpScaleProject();

    expect(repeatedProject).toEqual(project);
    expect(project).toEqual(scaleProjectJson);
    expect(project.animationId).toBe("phase-7-mvp-scale");
    expect(project.scene.background).toEqual({ assetId: "intersection-01" });
    expectScaleCounts(project);

    const stableIds = new Set<string>();
    const registerId = (id: string) => {
      expect(id).not.toBe("");
      expect(stableIds.has(id)).toBe(false);
      stableIds.add(id);
    };

    for (const [vehicleIndex, vehicle] of project.scene.objects.entries()) {
      registerId(vehicle.id);
      expect(vehicle.assetId).toBe(
        vehicleIndex % 2 === 0 ? "car-blue-sedan" : "car-blue-sport",
      );
      expect(vehicle.movement.points).toHaveLength(
        MVP_SCALE_MOVEMENT_POINT_COUNT,
      );
      expect(vehicle.movement.paths).toHaveLength(MVP_SCALE_PATH_COUNT);
      expect(vehicle.movement.points[0]?.time).toBe(0);
      expect(vehicle.movement.points.at(-1)?.time).toBe(
        MVP_SCALE_DURATION_SECONDS,
      );

      for (const [pointIndex, point] of vehicle.movement.points.entries()) {
        registerId(point.id);
        expect(Number.isFinite(point.time)).toBe(true);
        expect(Number.isFinite(point.x)).toBe(true);
        expect(Number.isFinite(point.y)).toBe(true);
        expect(point.time).toBeGreaterThanOrEqual(0);
        expect(point.time).toBeLessThanOrEqual(MVP_SCALE_DURATION_SECONDS);
        if (pointIndex > 0) {
          expect(point.time).toBeGreaterThan(
            vehicle.movement.points[pointIndex - 1]!.time,
          );
        }
      }

      for (const [pathIndex, path] of vehicle.movement.paths.entries()) {
        registerId(path.id);
        expect(path.fromPointId).toBe(vehicle.movement.points[pathIndex]!.id);
        expect(path.toPointId).toBe(
          vehicle.movement.points[pathIndex + 1]!.id,
        );
        expect(
          [path.control1.x, path.control1.y, path.control2.x, path.control2.y].every(
            Number.isFinite,
          ),
        ).toBe(true);
      }

      for (const trackKey of stateTrackKeys) {
        const keyframes = vehicle.stateTracks[trackKey].keyframes;
        expect(keyframes).toHaveLength(MVP_SCALE_KEYFRAME_COUNT);
        expect(keyframes[0]?.time).toBe(0);
        expect(keyframes.at(-1)?.time).toBe(MVP_SCALE_DURATION_SECONDS);
        for (const [keyframeIndex, keyframe] of keyframes.entries()) {
          registerId(keyframe.id);
          expect(keyframe.time).toBeGreaterThanOrEqual(0);
          expect(keyframe.time).toBeLessThanOrEqual(
            MVP_SCALE_DURATION_SECONDS,
          );
          if (keyframeIndex > 0) {
            expect(keyframe.time).toBeGreaterThan(
              keyframes[keyframeIndex - 1]!.time,
            );
          }
        }
      }
    }
  });

  it("validates, resolves assets, and deterministically composes every second", () => {
    const project = createMvpScaleProject();
    const snapshot = structuredClone(project);

    expect(validateAnimationProject(project)).toEqual({ valid: true, errors: [] });
    const resolution = resolveAnimationProjectAssets(project);
    expect(resolution.status).toBe("resolved");
    if (resolution.status === "resolved") {
      expect(resolution.assets.vehicles).toHaveLength(MVP_SCALE_VEHICLE_COUNT);
      expect(
        new Set(resolution.assets.vehicles.map(({ asset }) => asset.id)),
      ).toEqual(new Set(["car-blue-sedan", "car-blue-sport"]));
    }

    for (let time = 0; time <= MVP_SCALE_DURATION_SECONDS; time += 1) {
      const first = composePreviewSceneState(project, time);
      const second = composePreviewSceneState(project, time);
      expect(first).toEqual(second);
      expect(first.status).toBe("composed");
      if (first.status !== "composed") {
        throw new Error(`Preview failed at ${time}s: ${first.reason}`);
      }
      expect(first.scene.vehicles).toHaveLength(MVP_SCALE_VEHICLE_COUNT);
      for (const vehicle of first.scene.vehicles) {
        expect(
          [vehicle.x, vehicle.y, vehicle.rotationDeg].every(Number.isFinite),
        ).toBe(true);
      }
    }

    expect(project).toEqual(snapshot);
  });

  it("keeps playback and representative edits isolated at scale", () => {
    const store = useEditorStore.getState();
    const projectBeforePlayback = store.project;

    store.setCurrentTime(20);
    store.startPreviewPlayback();
    store.advancePreviewPlayback(1.25);
    expect(useEditorStore.getState()).toMatchObject({
      currentTime: 21.25,
      isPreviewPlaying: true,
      project: projectBeforePlayback,
    });
    useEditorStore.getState().stopPreviewPlayback();
    expect(useEditorStore.getState()).toMatchObject({
      currentTime: 21.25,
      isPreviewPlaying: false,
    });

    useEditorStore.getState().setCurrentTime(59.5);
    useEditorStore.getState().startPreviewPlayback();
    useEditorStore.getState().advancePreviewPlayback(1);
    expect(useEditorStore.getState()).toMatchObject({
      currentTime: 60,
      isPreviewPlaying: false,
    });

    const beforeEdit = structuredClone(useEditorStore.getState().project);
    const targetBefore = beforeEdit.scene.objects[0]!;
    const otherVehiclesBefore = beforeEdit.scene.objects.slice(1);
    const point = targetBefore.movement.points[10]!;
    const path = targetBefore.movement.paths[9]!;
    const indicatorKeyframe = targetBefore.stateTracks.indicator.keyframes[10]!;

    useEditorStore
      .getState()
      .updateMovementPointPosition(targetBefore.id, point.id, point.x + 7, point.y - 9);
    useEditorStore
      .getState()
      .updatePathControlPoint(
        targetBefore.id,
        path.id,
        "control1",
        path.control1.x + 11,
        path.control1.y + 13,
      );
    useEditorStore.getState().setCurrentTime(indicatorKeyframe.time);
    useEditorStore
      .getState()
      .updateVehicleStateAtCurrentTime(
        targetBefore.id,
        "indicator",
        indicatorKeyframe.value === "hazard" ? "left" : "hazard",
      );

    const editedProject = useEditorStore.getState().project;
    const targetAfter = editedProject.scene.objects[0]!;
    expect(targetAfter.movement.points[10]).toEqual({
      ...point,
      x: point.x + 7,
      y: point.y - 9,
    });
    expect(targetAfter.movement.paths[9]?.control1).toEqual({
      x: path.control1.x + 11,
      y: path.control1.y + 13,
    });
    expect(targetAfter.stateTracks.indicator.keyframes[10]?.value).not.toBe(
      indicatorKeyframe.value,
    );
    expect(editedProject.scene.objects.slice(1)).toEqual(otherVehiclesBefore);
    expectScaleCounts(editedProject);
    expect(validateAnimationProject(editedProject)).toEqual({
      valid: true,
      errors: [],
    });

    const preview = composePreviewSceneState(
      editedProject,
      indicatorKeyframe.time,
    );
    expect(preview.status).toBe("composed");
    if (preview.status === "composed") {
      expect(preview.scene.vehicles).toHaveLength(MVP_SCALE_VEHICLE_COUNT);
    }
  });

  it("round-trips the edited scale project and records bounded diagnostics", async () => {
    const project = createMvpScaleProject();
    const target = project.scene.objects[0]!;
    const point = target.movement.points[10]!;
    useEditorStore.getState().updateMovementPointPosition(
      target.id,
      point.id,
      point.x + 5,
      point.y + 5,
    );
    const editedProject = useEditorStore.getState().project;
    const validationStart = performance.now();

    for (let run = 0; run < 5; run += 1) {
      expect(validateAnimationProject(editedProject).valid).toBe(true);
      for (let time = 0; time <= MVP_SCALE_DURATION_SECONDS; time += 1) {
        expect(composePreviewSceneState(editedProject, time).status).toBe(
          "composed",
        );
      }
    }
    const validationAndCompositionMs = performance.now() - validationStart;

    const persistenceStart = performance.now();
    const json = requireSerialized(serializeAnimationProject(editedProject));
    const prepared = await prepareAnimationProjectFile({ text: async () => json });
    const persistenceMs = performance.now() - persistenceStart;

    expect(prepared.status).toBe("ready");
    if (prepared.status !== "ready") {
      throw new Error(`Expected ready project, received ${prepared.status}.`);
    }
    expect(prepared.project).toEqual(editedProject);
    expectScaleCounts(prepared.project);
    expect(prepared.assets.vehicles).toHaveLength(MVP_SCALE_VEHICLE_COUNT);

    useEditorStore.getState().loadProject(prepared.project);
    expect(useEditorStore.getState()).toMatchObject({
      project: editedProject,
      currentTime: 0,
      isPreviewPlaying: false,
      selection: {
        objectId: null,
        movementPointId: null,
        pathId: null,
        stateKeyframeId: null,
      },
    });
    expect(requireSerialized(serializeAnimationProject(prepared.project))).toBe(
      json,
    );
    expect(validationAndCompositionMs).toBeLessThan(5000);
    expect(persistenceMs).toBeLessThan(5000);

    console.info(
      `F7.13 diagnostics: 5 validation/composition sweeps ${validationAndCompositionMs.toFixed(2)}ms; persistence round trip ${persistenceMs.toFixed(2)}ms`,
    );
  });
});
