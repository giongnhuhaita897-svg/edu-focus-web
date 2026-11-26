
export type ExerciseId =
  | "overhead_reach"
  | "shoulder_stretch"
  | "squat";

export interface Landmark {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}

export interface ExerciseState {
  reps: number;
  stage: "ready" | "active";
  feedback: string;
}

export function createExerciseState(): ExerciseState {
  return {
    reps: 0,
    stage: "ready",
    feedback: "Ready",
  };
}

function calculateAngle(
  a: Landmark,
  b: Landmark,
  c: Landmark
): number {
  const ab = {
    x: a.x - b.x,
    y: a.y - b.y,
    z: (a.z ?? 0) - (b.z ?? 0),
  };

  const cb = {
    x: c.x - b.x,
    y: c.y - b.y,
    z: (c.z ?? 0) - (b.z ?? 0),
  };

  const dot = ab.x * cb.x + ab.y * cb.y + ab.z * cb.z;

  const magnitude =
    Math.hypot(ab.x, ab.y, ab.z) *
    Math.hypot(cb.x, cb.y, cb.z);

  if (magnitude === 0) return 0;

  const cosine = Math.max(
    -1,
    Math.min(1, dot / magnitude)
  );

  return Math.acos(cosine) * (180 / Math.PI);
}

function isVisible(
  landmarks: Landmark[],
  indices: number[]
): boolean {
  return indices.every((index) => {
    const point = landmarks[index];

    return (
      point !== undefined &&
      (point.visibility ?? 1) >= 0.6
    );
  });
}

function updateCycle(
  state: ExerciseState,
  active: boolean,
  ready: boolean,
  feedback: string
): ExerciseState {
  if (state.stage === "ready" && active) {
    return {
      ...state,
      stage: "active",
      feedback,
    };
  }

  if (state.stage === "active" && ready) {
    return {
      reps: state.reps + 1,
      stage: "ready",
      feedback: "Rep completed",
    };
  }

  return {
    ...state,
    feedback,
  };
}

export function evaluateExercise(
  exercise: ExerciseId,
  landmarks: Landmark[],
  state: ExerciseState
): ExerciseState {
  if (landmarks.length < 33) {
    return {
      ...state,
      stage: "ready",
      feedback: "Body not detected",
    };
  }

  const leftShoulder = landmarks[11];
  const rightShoulder = landmarks[12];
  const leftElbow = landmarks[13];
  const rightElbow = landmarks[14];
  const leftWrist = landmarks[15];
  const rightWrist = landmarks[16];

  const leftHip = landmarks[23];
  const rightHip = landmarks[24];
  const leftKnee = landmarks[25];
  const rightKnee = landmarks[26];
  const leftAnkle = landmarks[27];
  const rightAnkle = landmarks[28];

  if (exercise === "overhead_reach") {
    if (!isVisible(landmarks, [11, 12, 13, 14, 15, 16])) {
      return {
        ...state,
        stage: "ready",
        feedback: "Keep both arms visible",
      };
    }

    const leftAngle = calculateAngle(
      leftShoulder,
      leftElbow,
      leftWrist
    );

    const rightAngle = calculateAngle(
      rightShoulder,
      rightElbow,
      rightWrist
    );

    const active =
      leftWrist.y < leftShoulder.y - 0.08 &&
      rightWrist.y < rightShoulder.y - 0.08 &&
      leftAngle > 145 &&
      rightAngle > 145;

    const ready =
      leftWrist.y > leftShoulder.y &&
      rightWrist.y > rightShoulder.y;

    return updateCycle(
      state,
      active,
      ready,
      active ? "Arms raised" : "Raise or lower your arms"
    );
  }

  if (exercise === "shoulder_stretch") {
    if (!isVisible(landmarks, [11, 12, 13, 14, 15, 16])) {
      return {
        ...state,
        stage: "ready",
        feedback: "Keep both arms visible",
      };
    }

    const shoulderWidth = Math.hypot(
      leftShoulder.x - rightShoulder.x,
      leftShoulder.y - rightShoulder.y
    );

    const wristDistance = Math.hypot(
      leftWrist.x - rightWrist.x,
      leftWrist.y - rightWrist.y
    );

    const ratio =
      wristDistance / Math.max(shoulderWidth, 0.01);

    const armsLevel =
      Math.abs(leftWrist.y - leftShoulder.y) < 0.15 &&
      Math.abs(rightWrist.y - rightShoulder.y) < 0.15;

    const active = ratio > 2.2 && armsLevel;
    const ready = ratio < 1.3;

    return updateCycle(
      state,
      active,
      ready,
      active ? "Arms extended" : "Open or close your arms"
    );
  }

  if (exercise === "squat") {
    if (!isVisible(landmarks, [23, 24, 25, 26, 27, 28])) {
      return {
        ...state,
        stage: "ready",
        feedback: "Keep your legs visible",
      };
    }

    const leftAngle = calculateAngle(
      leftHip,
      leftKnee,
      leftAnkle
    );

    const rightAngle = calculateAngle(
      rightHip,
      rightKnee,
      rightAnkle
    );

    const averageAngle = (leftAngle + rightAngle) / 2;

    const active = averageAngle < 120;
    const ready = averageAngle > 160;

    return updateCycle(
      state,
      active,
      ready,
      active ? "Lower position detected" : "Ready position"
    );
  }

  return state;
}
