import { resolveAssetReference } from "../assets/projectAssetResolver";
import type { AnimationProject } from "../model/animation";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

type UnknownRecord = Record<string, unknown>;

interface ValidationContext {
  errors: string[];
  stableIds: Map<string, string>;
}

interface ValidMovementPoint {
  id: string;
  time: number;
}

const indicatorValues = new Set(["off", "left", "right", "hazard"]);
const stateTrackKeys = [
  "indicator",
  "brakeLight",
  "headlight",
  "horn",
] as const;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isPositiveNumber(value: unknown): value is number {
  return isFiniteNumber(value) && value > 0;
}

function isNonNegativeNumber(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function validateKnownFields(
  record: UnknownRecord,
  allowedFields: readonly string[],
  path: string,
  errors: string[],
) {
  const allowed = new Set(allowedFields);
  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) {
      errors.push(`${path} contains unknown field ${key}.`);
    }
  }
}

function registerStableId(
  value: unknown,
  path: string,
  context: ValidationContext,
): value is string {
  if (!isNonEmptyString(value)) {
    context.errors.push(`${path} must be a non-empty string.`);
    return false;
  }

  const firstPath = context.stableIds.get(value);
  if (firstPath !== undefined) {
    context.errors.push(
      `${path} duplicates stable ID ${value} already used at ${firstPath}.`,
    );
    return false;
  }

  context.stableIds.set(value, path);
  return true;
}

function validateFiniteCoordinate(
  record: UnknownRecord,
  key: "x" | "y",
  path: string,
  errors: string[],
) {
  if (!isFiniteNumber(record[key])) {
    errors.push(`${path}.${key} must be a finite number.`);
  }
}

function validateControlPoint(
  value: unknown,
  path: string,
  context: ValidationContext,
) {
  if (!isRecord(value)) {
    context.errors.push(`${path} must be an object.`);
    return;
  }

  validateKnownFields(value, ["x", "y"], path, context.errors);
  validateFiniteCoordinate(value, "x", path, context.errors);
  validateFiniteCoordinate(value, "y", path, context.errors);
}

function validateMovementPoints(
  value: unknown,
  path: string,
  context: ValidationContext,
): ValidMovementPoint[] | undefined {
  if (!Array.isArray(value)) {
    context.errors.push(`${path} must be an array.`);
    return undefined;
  }

  if (value.length === 0) {
    context.errors.push(`${path} must not be empty.`);
  }

  const validPoints: ValidMovementPoint[] = [];
  const localIds = new Set<string>();
  const times = new Set<number>();
  let zeroTimeCount = 0;
  let previousTime: number | undefined;
  let allPointsStructurallyValid = true;

  for (const [index, point] of value.entries()) {
    const pointPath = `${path}[${index}]`;
    if (!isRecord(point)) {
      context.errors.push(`${pointPath} must be an object.`);
      allPointsStructurallyValid = false;
      continue;
    }

    validateKnownFields(
      point,
      ["id", "time", "x", "y"],
      pointPath,
      context.errors,
    );

    const pointId = point.id;
    const pointTime = point.time;
    const idValid = registerStableId(pointId, `${pointPath}.id`, context);
    if (isNonEmptyString(pointId)) {
      if (localIds.has(pointId)) {
        allPointsStructurallyValid = false;
      }
      localIds.add(pointId);
    }

    const timeValid = isNonNegativeNumber(pointTime);
    if (!timeValid) {
      context.errors.push(`${pointPath}.time must be a non-negative number.`);
      allPointsStructurallyValid = false;
    } else {
      if (times.has(pointTime)) {
        context.errors.push(
          `${path.slice(0, -".points".length)} contains duplicate time ${pointTime}.`,
        );
        allPointsStructurallyValid = false;
      }
      times.add(pointTime);

      if (previousTime !== undefined && pointTime <= previousTime) {
        context.errors.push(`${path} must be strictly ordered by time.`);
        allPointsStructurallyValid = false;
      }
      previousTime = pointTime;

      if (pointTime === 0) {
        zeroTimeCount += 1;
      }
    }

    const xValid = isFiniteNumber(point.x);
    const yValid = isFiniteNumber(point.y);
    validateFiniteCoordinate(point, "x", pointPath, context.errors);
    validateFiniteCoordinate(point, "y", pointPath, context.errors);
    if (!xValid || !yValid) {
      allPointsStructurallyValid = false;
    }

    if (idValid && timeValid) {
      validPoints.push({ id: pointId, time: pointTime });
    } else {
      allPointsStructurallyValid = false;
    }
  }

  if (zeroTimeCount === 0) {
    context.errors.push(
      `${path.slice(0, -".points".length)} must include a 0-second Movement Point.`,
    );
  } else if (zeroTimeCount > 1) {
    context.errors.push(
      `${path.slice(0, -".points".length)} must include exactly one 0-second Movement Point.`,
    );
  }

  return allPointsStructurallyValid && validPoints.length === value.length
    ? validPoints
    : undefined;
}

function validatePaths(
  value: unknown,
  path: string,
  points: ValidMovementPoint[] | undefined,
  context: ValidationContext,
) {
  if (!Array.isArray(value)) {
    context.errors.push(`${path} must be an array.`);
    return;
  }

  const pointById = new Map(
    points?.map((point, index) => [point.id, { point, index }]),
  );
  const adjacencyCounts = new Map<string, number>();

  for (const [index, segment] of value.entries()) {
    const segmentPath = `${path}[${index}]`;
    if (!isRecord(segment)) {
      context.errors.push(`${segmentPath} must be an object.`);
      continue;
    }

    validateKnownFields(
      segment,
      ["id", "fromPointId", "toPointId", "type", "control1", "control2"],
      segmentPath,
      context.errors,
    );
    registerStableId(segment.id, `${segmentPath}.id`, context);

    const fromPointId = segment.fromPointId;
    const toPointId = segment.toPointId;
    const fromValid = isNonEmptyString(fromPointId);
    const toValid = isNonEmptyString(toPointId);
    if (!fromValid) {
      context.errors.push(`${segmentPath}.fromPointId must be a non-empty string.`);
    }
    if (!toValid) {
      context.errors.push(`${segmentPath}.toPointId must be a non-empty string.`);
    }
    if (segment.type !== "cubicBezier") {
      context.errors.push(`${segmentPath}.type must be cubicBezier.`);
    }
    validateControlPoint(segment.control1, `${segmentPath}.control1`, context);
    validateControlPoint(segment.control2, `${segmentPath}.control2`, context);

    if (!points || !fromValid || !toValid) {
      continue;
    }

    const from = pointById.get(fromPointId);
    const to = pointById.get(toPointId);
    if (!from) {
      context.errors.push(
        `${segmentPath}.fromPointId must reference a Movement Point in the same Vehicle.`,
      );
    }
    if (!to) {
      context.errors.push(
        `${segmentPath}.toPointId must reference a Movement Point in the same Vehicle.`,
      );
    }
    if (!from || !to) {
      continue;
    }

    if (from.index === to.index) {
      context.errors.push(`${segmentPath} must not connect a Point to itself.`);
      continue;
    }
    if (from.point.time >= to.point.time) {
      context.errors.push(`${segmentPath} must connect from an earlier to a later Point.`);
    }
    if (to.index !== from.index + 1) {
      context.errors.push(`${segmentPath} must connect adjacent Movement Points.`);
      continue;
    }

    const key = `${fromPointId}\u0000${toPointId}`;
    adjacencyCounts.set(key, (adjacencyCounts.get(key) ?? 0) + 1);
  }

  if (!points) {
    return;
  }

  const expectedCount = Math.max(0, points.length - 1);
  if (value.length !== expectedCount) {
    context.errors.push(`${path} must contain exactly ${expectedCount} Path Segment(s).`);
  }

  for (let index = 0; index < points.length - 1; index += 1) {
    const from = points[index]!;
    const to = points[index + 1]!;
    const key = `${from.id}\u0000${to.id}`;
    const count = adjacencyCounts.get(key) ?? 0;
    if (count !== 1) {
      context.errors.push(
        `${path} must connect adjacent Points ${from.id} -> ${to.id} exactly once.`,
      );
    }
  }
}

function validateMovement(
  value: unknown,
  path: string,
  context: ValidationContext,
) {
  if (!isRecord(value)) {
    context.errors.push(`${path} must be an object.`);
    return;
  }

  validateKnownFields(value, ["points", "paths"], path, context.errors);
  const points = validateMovementPoints(value.points, `${path}.points`, context);
  validatePaths(value.paths, `${path}.paths`, points, context);
}

function validateStateTrack(
  value: unknown,
  path: string,
  acceptsValue: (value: unknown) => boolean,
  expectedValue: string,
  context: ValidationContext,
) {
  if (!isRecord(value)) {
    context.errors.push(`${path} must be an object.`);
    return;
  }

  validateKnownFields(value, ["keyframes"], path, context.errors);
  if (!Array.isArray(value.keyframes)) {
    context.errors.push(`${path}.keyframes must be an array.`);
    return;
  }
  if (value.keyframes.length === 0) {
    context.errors.push(`${path}.keyframes must not be empty.`);
  }

  const times = new Set<number>();
  let zeroTimeCount = 0;
  let previousTime: number | undefined;

  for (const [index, keyframe] of value.keyframes.entries()) {
    const keyframePath = `${path}.keyframes[${index}]`;
    if (!isRecord(keyframe)) {
      context.errors.push(`${keyframePath} must be an object.`);
      continue;
    }

    validateKnownFields(
      keyframe,
      ["id", "time", "value"],
      keyframePath,
      context.errors,
    );
    registerStableId(keyframe.id, `${keyframePath}.id`, context);

    if (!isNonNegativeNumber(keyframe.time)) {
      context.errors.push(`${keyframePath}.time must be a non-negative number.`);
    } else {
      if (times.has(keyframe.time)) {
        context.errors.push(`${path} contains duplicate time ${keyframe.time}.`);
      }
      times.add(keyframe.time);
      if (previousTime !== undefined && keyframe.time <= previousTime) {
        context.errors.push(`${path}.keyframes must be strictly ordered by time.`);
      }
      previousTime = keyframe.time;
      if (keyframe.time === 0) {
        zeroTimeCount += 1;
      }
    }

    if (!acceptsValue(keyframe.value)) {
      context.errors.push(`${keyframePath}.value must be ${expectedValue}.`);
    }
  }

  if (zeroTimeCount !== 1) {
    context.errors.push(`${path} must include exactly one 0-second Keyframe.`);
  }
}

function validateStateTracks(
  value: unknown,
  path: string,
  context: ValidationContext,
) {
  if (!isRecord(value)) {
    context.errors.push(`${path} must be an object.`);
    return;
  }

  validateKnownFields(value, stateTrackKeys, path, context.errors);
  validateStateTrack(
    value.indicator,
    `${path}.indicator`,
    (state) => typeof state === "string" && indicatorValues.has(state),
    "one of off, left, right, or hazard",
    context,
  );
  for (const key of ["brakeLight", "headlight", "horn"] as const) {
    validateStateTrack(
      value[key],
      `${path}.${key}`,
      (state) => typeof state === "boolean",
      "a boolean",
      context,
    );
  }
}

function validateVehicle(
  value: unknown,
  path: string,
  context: ValidationContext,
) {
  if (!isRecord(value)) {
    context.errors.push(`${path} must be an object.`);
    return;
  }

  validateKnownFields(
    value,
    ["id", "type", "assetId", "movement", "stateTracks"],
    path,
    context.errors,
  );
  registerStableId(value.id, `${path}.id`, context);
  if (value.type !== "vehicle") {
    context.errors.push(`${path}.type must be vehicle.`);
  }
  if (!isNonEmptyString(value.assetId)) {
    context.errors.push(`${path}.assetId must be a non-empty string.`);
  } else {
    const resolution = resolveAssetReference(
      value.assetId,
      "vehicle",
      `${path}.assetId`,
    );
    if (resolution.status === "unresolved") {
      context.errors.push(resolution.error.message);
    }
  }

  validateMovement(value.movement, `${path}.movement`, context);
  validateStateTracks(value.stateTracks, `${path}.stateTracks`, context);
}

function validateBackground(
  value: unknown,
  path: string,
  context: ValidationContext,
) {
  if (!isRecord(value)) {
    context.errors.push(`${path} must be an object.`);
    return;
  }

  validateKnownFields(value, ["assetId"], path, context.errors);
  if (!isNonEmptyString(value.assetId)) {
    context.errors.push(`${path}.assetId must be a non-empty string.`);
  } else {
    const resolution = resolveAssetReference(
      value.assetId,
      "background",
      `${path}.assetId`,
    );
    if (resolution.status === "unresolved") {
      context.errors.push(resolution.error.message);
    }
  }
}

function validateScene(
  value: unknown,
  path: string,
  context: ValidationContext,
) {
  if (!isRecord(value)) {
    context.errors.push(`${path} must be an object.`);
    return;
  }

  validateKnownFields(
    value,
    ["width", "height", "background", "objects"],
    path,
    context.errors,
  );
  if (!isPositiveNumber(value.width)) {
    context.errors.push(`${path}.width must be greater than 0.`);
  }
  if (!isPositiveNumber(value.height)) {
    context.errors.push(`${path}.height must be greater than 0.`);
  }

  if (Object.hasOwn(value, "background")) {
    validateBackground(value.background, `${path}.background`, context);
  }

  if (!Array.isArray(value.objects)) {
    context.errors.push(`${path}.objects must be an array.`);
    return;
  }
  for (const [index, object] of value.objects.entries()) {
    validateVehicle(object, `${path}.objects[${index}]`, context);
  }
}

export function validateAnimationProject(value: unknown): ValidationResult {
  const context: ValidationContext = {
    errors: [],
    stableIds: new Map(),
  };

  if (!isRecord(value)) {
    return { valid: false, errors: ["Project must be an object."] };
  }

  validateKnownFields(
    value,
    ["schemaVersion", "animationId", "scene"],
    "Project",
    context.errors,
  );
  if (value.schemaVersion !== 1) {
    context.errors.push("schemaVersion must be 1.");
  }
  if (!isNonEmptyString(value.animationId)) {
    context.errors.push("animationId must be a non-empty string.");
  }
  validateScene(value.scene, "scene", context);

  return { valid: context.errors.length === 0, errors: context.errors };
}

export function isAnimationProject(value: unknown): value is AnimationProject {
  return validateAnimationProject(value).valid;
}
