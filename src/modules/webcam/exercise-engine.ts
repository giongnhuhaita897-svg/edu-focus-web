import type { ExerciseType } from "@/types/database";

export interface PosePoint {
  x: number;
  y: number;
  visibility?: number;
}

export type ExercisePhase = "ready" | "moving";

export interface RepCounterState {
  phase: ExercisePhase;
  stableFrames: number;
  lastRepAt: number;
}

export interface RepCounterResult {
  state: RepCounterState;
  counted: boolean;
  message: string;
}

export const initialRepCounterState = (): RepCounterState => ({
  phase: "ready",
  stableFrames: 0,
  lastRepAt: -Infinity,
});

function point(points: PosePoint[], index: number): PosePoint | null {
  const value = points[index];
  return value && (value.visibility ?? 1) >= 0.45 ? value : null;
}

function dist(a: PosePoint, b: PosePoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function angle(a: PosePoint, vertex: PosePoint, c: PosePoint): number {
  const ax = a.x - vertex.x;
  const ay = a.y - vertex.y;
  const cx = c.x - vertex.x;
  const cy = c.y - vertex.y;
  const mag = Math.hypot(ax, ay) * Math.hypot(cx, cy);
  if (mag < 1e-5) return 0;
  const cosine = Math.min(1, Math.max(-1, (ax * cx + ay * cy) / mag));
  return (Math.acos(cosine) * 180) / Math.PI;
}

function exerciseSignals(
  exercise: ExerciseType,
  points: PosePoint[]
): { moving: boolean; ready: boolean; message: string } | null {
  const leftShoulder = point(points, 11);
  const rightShoulder = point(points, 12);
  const leftElbow = point(points, 13);
  const rightElbow = point(points, 14);
  const leftWrist = point(points, 15);
  const rightWrist = point(points, 16);

  if (exercise === "overhead_reach") {
    if (!leftShoulder || !rightShoulder || !leftWrist || !rightWrist || !leftElbow || !rightElbow) return null;
    const moving = leftWrist.y < leftShoulder.y - 0.10 &&
      rightWrist.y < rightShoulder.y - 0.10 &&
      angle(leftShoulder, leftElbow, leftWrist) > 135 &&
      angle(rightShoulder, rightElbow, rightWrist) > 135;
    const ready = leftWrist.y > leftShoulder.y + 0.07 && rightWrist.y > rightShoulder.y + 0.07;
    return { moving, ready, message: "Raise both arms overhead, then lower them." };
  }

  if (exercise === "shoulder_stretch") {
    if (!leftShoulder || !rightShoulder || !leftElbow || !rightElbow) return null;
    const shoulderWidth = dist(leftShoulder, rightShoulder);
    if (shoulderWidth < 0.04) return null;
    const elbowWidthRatio = dist(leftElbow, rightElbow) / shoulderWidth;
    const elbowsAtShoulderHeight = Math.abs(leftElbow.y - leftShoulder.y) < 0.15 &&
      Math.abs(rightElbow.y - rightShoulder.y) < 0.15;
    return {
      moving: elbowWidthRatio > 1.65 && elbowsAtShoulderHeight,
      ready: elbowWidthRatio < 1.22,
      message: "Open both arms to shoulder height, then relax.",
    };
  }

  const leftHip = point(points, 23);
  const rightHip = point(points, 24);
  const leftKnee = point(points, 25);
  const rightKnee = point(points, 26);
  const leftAnkle = point(points, 27);
  const rightAnkle = point(points, 28);
  const angles: number[] = [];
  if (leftHip && leftKnee && leftAnkle) angles.push(angle(leftHip, leftKnee, leftAnkle));
  if (rightHip && rightKnee && rightAnkle) angles.push(angle(rightHip, rightKnee, rightAnkle));
  if (!angles.length) return null;
  const kneeAngle = Math.min(...angles);
  return {
    moving: kneeAngle < 115,
    ready: kneeAngle > 155,
    message: "Keep your legs in view; bend your knees, then stand up.",
  };
}

/** Counts only a complete ready -> moving -> ready cycle. A stable signal
 * on two consecutive sampled frames reduces accidental increments. */
export function countExerciseRep(
  exercise: ExerciseType,
  points: PosePoint[],
  prev: RepCounterState,
  nowMs: number
): RepCounterResult {
  const signal = exerciseSignals(exercise, points);
  if (!signal) {
    return { state: { ...prev, stableFrames: 0 }, counted: false, message: "Move into the camera frame so the relevant joints are visible." };
  }
  const candidate = prev.phase === "ready" ? signal.moving : signal.ready;
  const stableFrames = candidate ? prev.stableFrames + 1 : 0;
  if (stableFrames < 2) {
    return { state: { ...prev, stableFrames }, counted: false, message: signal.message };
  }
  if (prev.phase === "ready") {
    return { state: { ...prev, phase: "moving", stableFrames: 0 }, counted: false, message: "Return to the starting position." };
  }
  if (nowMs - prev.lastRepAt < 650) {
    return { state: { ...prev, stableFrames: 0 }, counted: false, message: signal.message };
  }
  return {
    state: { phase: "ready", stableFrames: 0, lastRepAt: nowMs },
    counted: true,
    message: "Rep completed.",
  };
}
