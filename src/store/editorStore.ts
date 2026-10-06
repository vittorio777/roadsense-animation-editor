import { create } from "zustand";

import { EDITOR_TIME_END, EDITOR_TIME_START } from "../editor/editorTimeRange";
import {
  createEmptyAnimationProject,
  type AnimationProject,
} from "../model/animation";
import {
  createMovementPoint,
  findMovementPointAtTime,
  resolveMovementPointForEditing,
} from "../model/movement";
import {
  createVehicleStateInterval,
  editVehicleStateInterval,
  findVehicleStateKeyframe,
  getVehicleStateTrackKeyForLane,
  isVehicleStateTrackKey,
  isVehicleStateValue,
  isVehicleStateLaneKey,
  setVehicleStateValueAtTime,
  type CreateVehicleStateIntervalResult,
  type EditVehicleStateIntervalResult,
  type VehicleStateIntervalMutation,
  type VehicleStateIntervalSource,
  type VehicleStateLaneKey,
  type VehicleStateTrackKey,
  type VehicleStateValueByTrack,
} from "../model/stateTrack";
import {
  calculateVehicleSpawnPosition,
  createVehicleObject,
} from "../model/vehicle";
import { synchronizeDefaultBezierPaths } from "../path/bezier";
import { advancePreviewTime } from "../preview/playback";

export interface EditorSelection {
  objectId: string | null;
  movementPointId: string | null;
  pathId: string | null;
  stateKeyframeId: string | null;
}

export type MovementPointTimeUpdateResult =
  | { status: "updated" }
  | { status: "unchanged" }
  | { status: "duplicate-time"; time: number }
  | { status: "invalid" };

export type MovementPointDeletionResult =
  | { status: "deleted" }
  | { status: "protected-initial" }
  | { status: "invalid" };

export type VehicleDeletionResult =
  | { status: "deleted" }
  | { status: "invalid" };

export type PathControlPoint = "control1" | "control2";

interface EditorStoreState {
  project: AnimationProject;
  currentTime: number;
  isPreviewPlaying: boolean;
  selection: EditorSelection;
  loadProject: (project: AnimationProject) => void;
  setProject: (project: AnimationProject) => void;
  setSceneBackground: (assetId: string) => void;
  addVehicle: (assetId: string) => void;
  deleteVehicle: (objectId: string) => VehicleDeletionResult;
  updateVehiclePosition: (objectId: string, x: number, y: number) => void;
  updateMovementPointPosition: (
    objectId: string,
    movementPointId: string,
    x: number,
    y: number,
  ) => void;
  updateMovementPointTime: (
    objectId: string,
    movementPointId: string,
    time: number,
  ) => MovementPointTimeUpdateResult;
  deleteMovementPoint: (
    objectId: string,
    movementPointId: string,
  ) => MovementPointDeletionResult;
  setCurrentTime: (time: number) => void;
  startPreviewPlayback: () => void;
  advancePreviewPlayback: (elapsedSeconds: number) => void;
  stopPreviewPlayback: () => void;
  setSelection: (selection: EditorSelection) => void;
  selectObject: (objectId: string) => void;
  selectMovementPoint: (objectId: string, movementPointId: string) => void;
  selectPath: (objectId: string, pathId: string) => void;
  selectStateKeyframe: (objectId: string, stateKeyframeId: string) => void;
  updatePathControlPoint: (
    objectId: string,
    pathId: string,
    control: PathControlPoint,
    x: number,
    y: number,
  ) => void;
  updateVehicleStateAtCurrentTime: <K extends VehicleStateTrackKey>(
    objectId: string,
    trackKey: K,
    value: VehicleStateValueByTrack[K],
  ) => void;
  createVehicleStateInterval: (
    objectId: string,
    laneKey: VehicleStateLaneKey,
    startTime: number,
    endTime: number,
  ) => CreateVehicleStateIntervalResult["status"];
  editVehicleStateInterval: (
    objectId: string,
    laneKey: VehicleStateLaneKey,
    source: VehicleStateIntervalSource,
    mutation: VehicleStateIntervalMutation,
  ) => EditVehicleStateIntervalResult["status"];
  clearSelection: () => void;
  resetEditorState: () => void;
}

const emptySelection = (): EditorSelection => ({
  objectId: null,
  movementPointId: null,
  pathId: null,
  stateKeyframeId: null,
});

function clearRemovedPathSelection(
  selection: EditorSelection,
  objectId: string,
  pathIds: Set<string>,
): EditorSelection {
  if (
    selection.objectId !== objectId ||
    !selection.pathId ||
    pathIds.has(selection.pathId)
  ) {
    return selection;
  }

  return {
    objectId,
    movementPointId: null,
    pathId: null,
    stateKeyframeId: null,
  };
}

export const useEditorStore = create<EditorStoreState>((set, get) => ({
  project: createEmptyAnimationProject(),
  currentTime: 0,
  isPreviewPlaying: false,
  selection: emptySelection(),
  loadProject: (project) =>
    set({
      project,
      currentTime: 0,
      isPreviewPlaying: false,
      selection: emptySelection(),
    }),
  setProject: (project) => set({ project, isPreviewPlaying: false }),
  setSceneBackground: (assetId) =>
    set(({ project }) => ({
      project: {
        ...project,
        scene: {
          ...project.scene,
          background: { assetId },
        },
      },
    })),
  addVehicle: (assetId) =>
    set(({ project }) => {
      const position = calculateVehicleSpawnPosition(
        project.scene.width,
        project.scene.height,
        project.scene.objects.length,
      );

      const vehicle = createVehicleObject({
        assetId,
        x: position.x,
        y: position.y,
      });

      return {
        project: {
          ...project,
          scene: {
            ...project.scene,
            objects: [...project.scene.objects, vehicle],
          },
        },
      };
    }),
  deleteVehicle: (objectId) => {
    const { project, selection } = get();
    const objectIndex = project.scene.objects.findIndex(
      (object) => object.id === objectId,
    );

    if (objectIndex === -1) {
      return { status: "invalid" };
    }

    const objects = project.scene.objects.filter(
      (object) => object.id !== objectId,
    );
    set({
      project: {
        ...project,
        scene: {
          ...project.scene,
          objects,
        },
      },
      ...(selection.objectId === objectId
        ? { selection: emptySelection() }
        : {}),
    });

    return { status: "deleted" };
  },
  updateVehiclePosition: (objectId, x, y) =>
    set((state) => {
      const { currentTime, project, selection } = state;
      const objectIndex = project.scene.objects.findIndex(
        (object) => object.id === objectId,
      );
      const object = project.scene.objects[objectIndex];
      const editingPoint = object
        ? resolveMovementPointForEditing(object.movement, currentTime)
        : undefined;

      if (
        objectIndex === -1 ||
        !object ||
        !editingPoint ||
        !Number.isFinite(x) ||
        !Number.isFinite(y) ||
        (editingPoint.x === x && editingPoint.y === y)
      ) {
        return state;
      }

      const existingPoint = findMovementPointAtTime(object.movement, currentTime);
      const points = existingPoint
        ? object.movement.points.map((point) =>
            point.id === existingPoint.id ? { ...point, x, y } : point,
          )
        : [
            ...object.movement.points,
            createMovementPoint({ time: currentTime, x, y }),
          ].sort((left, right) => left.time - right.time);
      const paths = existingPoint
        ? object.movement.paths
        : synchronizeDefaultBezierPaths(points, object.movement.paths);
      const nextSelection = clearRemovedPathSelection(
        selection,
        objectId,
        new Set(paths.map((path) => path.id)),
      );
      const objects = [...project.scene.objects];
      objects[objectIndex] = {
        ...object,
        movement: {
          ...object.movement,
          points,
          paths,
        },
      };

      return {
        project: {
          ...project,
          scene: {
            ...project.scene,
            objects,
          },
        },
        ...(nextSelection === selection ? {} : { selection: nextSelection }),
      };
    }),
  updateMovementPointPosition: (objectId, movementPointId, x, y) =>
    set((state) => {
      const { project } = state;
      const objectIndex = project.scene.objects.findIndex(
        (object) => object.id === objectId,
      );
      const object = project.scene.objects[objectIndex];
      const point = object?.movement.points.find(
        (candidate) => candidate.id === movementPointId,
      );

      if (
        objectIndex === -1 ||
        !object ||
        !point ||
        !Number.isFinite(x) ||
        !Number.isFinite(y) ||
        (point.x === x && point.y === y)
      ) {
        return state;
      }

      const objects = [...project.scene.objects];
      objects[objectIndex] = {
        ...object,
        movement: {
          ...object.movement,
          points: object.movement.points.map((candidate) =>
            candidate.id === movementPointId ? { ...candidate, x, y } : candidate,
          ),
        },
      };

      return {
        project: {
          ...project,
          scene: {
            ...project.scene,
            objects,
          },
        },
      };
    }),
  updateMovementPointTime: (objectId, movementPointId, time) => {
    const { project, selection } = get();
    const objectIndex = project.scene.objects.findIndex(
      (object) => object.id === objectId,
    );
    const object = project.scene.objects[objectIndex];
    const point = object?.movement.points.find(
      (candidate) => candidate.id === movementPointId,
    );

    if (
      objectIndex === -1 ||
      !object ||
      !point ||
      point.time === 0 ||
      !Number.isFinite(time) ||
      time < 0
    ) {
      return { status: "invalid" };
    }

    if (point.time === time) {
      return { status: "unchanged" };
    }

    if (
      object.movement.points.some(
        (candidate) =>
          candidate.id !== movementPointId && candidate.time === time,
      )
    ) {
      return { status: "duplicate-time", time };
    }

    const updatedPoint = { ...point, time };
    const points = object.movement.points
      .map((candidate) =>
        candidate.id === movementPointId ? updatedPoint : candidate,
      )
      .sort((left, right) => left.time - right.time);
    const paths = synchronizeDefaultBezierPaths(
      points,
      object.movement.paths,
    );
    const objects = [...project.scene.objects];
    objects[objectIndex] = {
      ...object,
      movement: {
        ...object.movement,
        points,
        paths,
      },
    };
    const selectedPointIsTarget =
      selection.objectId === objectId &&
      selection.movementPointId === movementPointId;
    const nextSelection = clearRemovedPathSelection(
      selection,
      objectId,
      new Set(paths.map((path) => path.id)),
    );

    set({
      project: {
        ...project,
        scene: {
          ...project.scene,
          objects,
        },
      },
      ...(selectedPointIsTarget ? { currentTime: time } : {}),
      ...(nextSelection === selection ? {} : { selection: nextSelection }),
    });

    return { status: "updated" };
  },
  deleteMovementPoint: (objectId, movementPointId) => {
    const { project, selection } = get();
    const objectIndex = project.scene.objects.findIndex(
      (object) => object.id === objectId,
    );
    const object = project.scene.objects[objectIndex];
    const point = object?.movement.points.find(
      (candidate) => candidate.id === movementPointId,
    );

    if (objectIndex === -1 || !object || !point) {
      return { status: "invalid" };
    }

    if (point.time === 0) {
      return { status: "protected-initial" };
    }

    const points = object.movement.points.filter(
      (candidate) => candidate.id !== movementPointId,
    );
    const paths = synchronizeDefaultBezierPaths(
      points,
      object.movement.paths,
    );
    const objects = [...project.scene.objects];
    objects[objectIndex] = {
      ...object,
      movement: {
        ...object.movement,
        points,
        paths,
      },
    };
    const selectedPointIsTarget =
      selection.objectId === objectId &&
      selection.movementPointId === movementPointId;
    const nextSelection = clearRemovedPathSelection(
      selection,
      objectId,
      new Set(paths.map((path) => path.id)),
    );

    set({
      project: {
        ...project,
        scene: {
          ...project.scene,
          objects,
        },
      },
      ...(selectedPointIsTarget
        ? {
            selection: {
              objectId,
              movementPointId: null,
              pathId: null,
              stateKeyframeId: null,
            },
          }
        : nextSelection === selection
          ? {}
          : { selection: nextSelection }),
    });

    return { status: "deleted" };
  },
  setCurrentTime: (currentTime) => set({ currentTime }),
  startPreviewPlayback: () =>
    set((state) => {
      if (state.isPreviewPlaying) {
        return state;
      }

      return {
        currentTime:
          state.currentTime >= EDITOR_TIME_END ||
          !Number.isFinite(state.currentTime)
            ? EDITOR_TIME_START
            : Math.max(EDITOR_TIME_START, state.currentTime),
        isPreviewPlaying: true,
      };
    }),
  advancePreviewPlayback: (elapsedSeconds) =>
    set((state) => {
      if (!state.isPreviewPlaying) {
        return state;
      }

      const result = advancePreviewTime(state.currentTime, elapsedSeconds);
      if (result.time === state.currentTime && !result.reachedEnd) {
        return state;
      }

      return {
        currentTime: result.time,
        isPreviewPlaying: !result.reachedEnd,
      };
    }),
  stopPreviewPlayback: () =>
    set((state) =>
      state.isPreviewPlaying ? { isPreviewPlaying: false } : state,
    ),
  setSelection: (selection) => set({ selection }),
  selectObject: (objectId) =>
    set((state) => {
      if (!state.project.scene.objects.some((object) => object.id === objectId)) {
        return state;
      }

      if (
        state.selection.objectId === objectId &&
        state.selection.movementPointId === null &&
        state.selection.pathId === null &&
        state.selection.stateKeyframeId === null
      ) {
        return state;
      }

      return {
        selection: {
          objectId,
          movementPointId: null,
          pathId: null,
          stateKeyframeId: null,
        },
      };
    }),
  selectMovementPoint: (objectId, movementPointId) =>
    set(({ currentTime, project, selection }) => {
      const object = project.scene.objects.find(
        (candidate) => candidate.id === objectId,
      );
      const point = object?.movement.points.find(
        (candidate) => candidate.id === movementPointId,
      );

      if (!point) {
        return {};
      }

      if (
        selection.objectId === objectId &&
        selection.movementPointId === movementPointId &&
        selection.pathId === null &&
        selection.stateKeyframeId === null &&
        currentTime === point.time
      ) {
        return {};
      }

      return {
        currentTime: point.time,
        selection: {
          objectId,
          movementPointId,
          pathId: null,
          stateKeyframeId: null,
        },
      };
    }),
  selectPath: (objectId, pathId) =>
    set((state) => {
      const object = state.project.scene.objects.find(
        (candidate) => candidate.id === objectId,
      );
      const path = object?.movement.paths.find(
        (candidate) => candidate.id === pathId,
      );

      if (!path) {
        return state;
      }

      if (
        state.selection.objectId === objectId &&
        state.selection.movementPointId === null &&
        state.selection.pathId === pathId &&
        state.selection.stateKeyframeId === null
      ) {
        return state;
      }

      return {
        selection: {
          objectId,
          movementPointId: null,
          pathId,
          stateKeyframeId: null,
        },
      };
    }),
  selectStateKeyframe: (objectId, stateKeyframeId) =>
    set((state) => {
      const object = state.project.scene.objects.find(
        (candidate) => candidate.id === objectId,
      );
      const locatedKeyframe = object
        ? findVehicleStateKeyframe(object.stateTracks, stateKeyframeId)
        : undefined;

      if (!locatedKeyframe) {
        return state;
      }

      if (
        state.selection.objectId === objectId &&
        state.selection.movementPointId === null &&
        state.selection.pathId === null &&
        state.selection.stateKeyframeId === stateKeyframeId &&
        state.currentTime === locatedKeyframe.keyframe.time
      ) {
        return state;
      }

      return {
        currentTime: locatedKeyframe.keyframe.time,
        selection: {
          objectId,
          movementPointId: null,
          pathId: null,
          stateKeyframeId,
        },
      };
    }),
  updatePathControlPoint: (objectId, pathId, control, x, y) =>
    set((state) => {
      if (
        (control !== "control1" && control !== "control2") ||
        !Number.isFinite(x) ||
        !Number.isFinite(y)
      ) {
        return state;
      }

      const objectIndex = state.project.scene.objects.findIndex(
        (candidate) => candidate.id === objectId,
      );
      const object = state.project.scene.objects[objectIndex];
      const pathIndex = object?.movement.paths.findIndex(
        (candidate) => candidate.id === pathId,
      );
      const path =
        pathIndex === undefined || pathIndex === -1
          ? undefined
          : object?.movement.paths[pathIndex];

      if (
        objectIndex === -1 ||
        !object ||
        pathIndex === undefined ||
        pathIndex === -1 ||
        !path ||
        (path[control].x === x && path[control].y === y)
      ) {
        return state;
      }

      const paths = [...object.movement.paths];
      paths[pathIndex] = {
        ...path,
        [control]: { x, y },
      };
      const objects = [...state.project.scene.objects];
      objects[objectIndex] = {
        ...object,
        movement: {
          ...object.movement,
          paths,
        },
      };

      return {
        project: {
          ...state.project,
          scene: {
            ...state.project.scene,
            objects,
          },
        },
      };
    }),
  updateVehicleStateAtCurrentTime: (objectId, trackKey, value) =>
    set((state) => {
      if (
        !Number.isFinite(state.currentTime) ||
        state.currentTime < 0 ||
        !isVehicleStateTrackKey(trackKey) ||
        !isVehicleStateValue(trackKey, value)
      ) {
        return state;
      }

      const objectIndex = state.project.scene.objects.findIndex(
        (object) => object.id === objectId,
      );
      const object = state.project.scene.objects[objectIndex];

      if (objectIndex === -1 || !object) {
        return state;
      }

      const stateTracks = setVehicleStateValueAtTime(
        object.stateTracks,
        trackKey,
        {
          time: state.currentTime,
          value,
          createId: () =>
            `${trackKey}-keyframe-${crypto.randomUUID()}`,
        },
      );

      if (stateTracks === object.stateTracks) {
        return state;
      }

      const objects = [...state.project.scene.objects];
      objects[objectIndex] = { ...object, stateTracks };

      return {
        project: {
          ...state.project,
          scene: {
            ...state.project.scene,
            objects,
          },
        },
      };
    }),
  createVehicleStateInterval: (objectId, laneKey, startTime, endTime) => {
    if (
      !isVehicleStateLaneKey(laneKey) ||
      !Number.isFinite(startTime) ||
      !Number.isFinite(endTime)
    ) {
      return "invalid";
    }

    const state = get();
    const objectIndex = state.project.scene.objects.findIndex(
      (object) => object.id === objectId,
    );
    const object = state.project.scene.objects[objectIndex];

    if (objectIndex === -1 || !object) {
      return "invalid";
    }

    const trackKey = getVehicleStateTrackKeyForLane(laneKey);
    const result = createVehicleStateInterval(object.stateTracks, laneKey, {
      startTime,
      endTime,
      createId: () => `${trackKey}-keyframe-${crypto.randomUUID()}`,
    });

    if (result.status !== "created") {
      return result.status;
    }

    const objects = [...state.project.scene.objects];
    objects[objectIndex] = { ...object, stateTracks: result.tracks };
    set({
      project: {
        ...state.project,
        scene: {
          ...state.project.scene,
          objects,
        },
      },
    });

    return "created";
  },
  editVehicleStateInterval: (objectId, laneKey, source, mutation) => {
    if (!isVehicleStateLaneKey(laneKey)) {
      return "invalid";
    }

    const state = get();
    const objectIndex = state.project.scene.objects.findIndex(
      (object) => object.id === objectId,
    );
    const object = state.project.scene.objects[objectIndex];

    if (objectIndex === -1 || !object) {
      return "invalid";
    }

    const trackKey = getVehicleStateTrackKeyForLane(laneKey);
    const result = editVehicleStateInterval(object.stateTracks, laneKey, {
      source,
      mutation,
      createId: () => `${trackKey}-keyframe-${crypto.randomUUID()}`,
    });

    if (result.status !== "updated" && result.status !== "deleted") {
      return result.status;
    }

    const objects = [...state.project.scene.objects];
    objects[objectIndex] = { ...object, stateTracks: result.tracks };
    set({
      project: {
        ...state.project,
        scene: {
          ...state.project.scene,
          objects,
        },
      },
    });

    return result.status;
  },
  clearSelection: () => set({ selection: emptySelection() }),
  resetEditorState: () =>
    set({
      currentTime: 0,
      isPreviewPlaying: false,
      selection: emptySelection(),
    }),
}));
