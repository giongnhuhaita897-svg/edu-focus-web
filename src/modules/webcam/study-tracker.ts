import {
  STUDY_FOCUS_THRESHOLDS,
  StudyFocusThresholds,
} from "@/modules/webcam/thresholds";
import { DetectedDistractionDevice } from "@/modules/webcam/distraction-detectors";

export type StudyFocusStatus =
  | "idle"
  | "focused"
  | "distracted"
  | "drowsy"
  | "absent"
  | "phone_distracted"
  | "scrolling_distracted";

export type StudyAlertType =
  | "none"
  | "distracted"
  | "drowsy"
  | "absent"
  | "phone_distracted"
  | "scrolling_distracted";

export interface NormalizedLandmarkPoint {
  x: number;
  y: number;
  z?: number;
}

export interface BlendshapeCategoryLike {
  categoryName: string;
  score: number;
}

export interface FaceLandmarkerResultLike {
  faceLandmarks?: NormalizedLandmarkPoint[][];
  faceBlendshapes?: Array<{
    categories: BlendshapeCategoryLike[];
  }>;
}

export interface FaceFrameMetrics {
  hasFace: boolean;
  /** Mức độ nhắm mắt (0 = mở to, 1 = nhắm kín) */
  eyeClosureScore: number;
  /** Mức độ ánh mắt nhìn xuống (0..1) từ blendshapes eyeLookDownLeft/Right */
  eyeLookDownScore?: number;
  /** Góc quay mặt trái/phải (độ) */
  yawDeg: number;
  /** Góc cúi/ngẩng đầu (độ, dương = cúi xuống) */
  pitchDeg: number;
  /** Góc nghiêng đầu trái/phải (độ) */
  rollDeg: number;
}

export interface FrameDistractionExtras {
  /** Danh sách điện thoại / iPad phát hiện trong khung hình */
  detectedDevices?: DetectedDistractionDevice[];
  /** Có đang phát hiện cử chỉ tay lướt lặp lại không */
  isHandScrolling?: boolean;
  /** Chế độ Ghi chép vở: nới lỏng cảnh báo nhìn xuống/cúi đầu nhẹ để học sinh thoải mái viết bài */
  noteTakingMode?: boolean;
  /** Bật/tắt nhận diện điện thoại/iPad & lướt tay */
  enableDeviceAndHandDetection?: boolean;
}

export interface StudyTrackerSnapshot {
  status: StudyFocusStatus;
  statusLabel: string;
  focusScorePercent: number;
  focusedMs: number;
  totalTrackedMs: number;
  distractionCount: number;
  drowsinessAlertCount: number;
  deviceDistractionCount: number;
  activeDevices: DetectedDistractionDevice[];
  isHandScrolling: boolean;
  currentIssueDurationMs: number;
  metrics: FaceFrameMetrics;
  justTriggeredAlert: StudyAlertType;
}

export const EMPTY_FACE_METRICS: FaceFrameMetrics = {
  hasFace: false,
  eyeClosureScore: 0,
  eyeLookDownScore: 0,
  yawDeg: 0,
  pitchDeg: 0,
  rollDeg: 0,
};

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function dist2D(a: NormalizedLandmarkPoint, b: NormalizedLandmarkPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Tính tỷ lệ mở mắt EAR (Eye Aspect Ratio) từ 6 điểm mốc chuẩn quanh mắt.
 * Dùng làm phương án dự phòng khi blendshapes không khả dụng.
 */
export function computeEyeAspectRatio(
  landmarks: NormalizedLandmarkPoint[],
  indices: [number, number, number, number, number, number]
): number {
  const [p1, p2, p3, p4, p5, p6] = indices.map((idx) => landmarks[idx]);
  if (!p1 || !p2 || !p3 || !p4 || !p5 || !p6) return 0.3;

  const verticalA = dist2D(p2, p6);
  const verticalB = dist2D(p3, p5);
  const horizontal = dist2D(p1, p4);
  if (horizontal <= 1e-6) return 0.3;

  return (verticalA + verticalB) / (2 * horizontal);
}

/**
 * Ước lượng góc quay đầu (yaw, pitch, roll) từ các điểm mốc khuôn mặt chuẩn hóa.
 * Độc lập với khoảng cách ngồi và không phụ thuộc chiều ma trận.
 */
export function estimateHeadPoseFromLandmarks(
  landmarks: NormalizedLandmarkPoint[]
): { yawDeg: number; pitchDeg: number; rollDeg: number } {
  const noseTip = landmarks[1];
  const forehead = landmarks[10];
  const chin = landmarks[152];
  const leftEyeOuter = landmarks[33];
  const rightEyeOuter = landmarks[263];

  if (!noseTip || !forehead || !chin || !leftEyeOuter || !rightEyeOuter) {
    return { yawDeg: 0, pitchDeg: 0, rollDeg: 0 };
  }

  const eyeMidX = (leftEyeOuter.x + rightEyeOuter.x) / 2;
  const faceWidth = dist2D(leftEyeOuter, rightEyeOuter);
  const faceHeight = dist2D(forehead, chin);

  const yawRatio =
    faceWidth > 1e-6 ? (noseTip.x - eyeMidX) / (faceWidth * 0.5) : 0;
  const yawDeg = Math.round(clamp(yawRatio * 55, -90, 90) * 10) / 10;

  // Khi nhìn thẳng, mũi nằm khoảng 56% khoảng cách từ trán xuống cằm
  const noseVerticalRatio =
    faceHeight > 1e-6 ? (noseTip.y - forehead.y) / faceHeight : 0.56;
  const pitchDeg =
    Math.round(clamp((noseVerticalRatio - 0.56) * 140, -90, 90) * 10) / 10;

  const rollRad = Math.atan2(
    rightEyeOuter.y - leftEyeOuter.y,
    rightEyeOuter.x - leftEyeOuter.x
  );
  const rollDeg = Math.round(((rollRad * 180) / Math.PI) * 10) / 10;

  return { yawDeg, pitchDeg, rollDeg };
}

/**
 * Trích xuất bộ chỉ số khuôn mặt từ kết quả MediaPipe FaceLandmarker.
 */
export function extractFaceFrameMetrics(
  result: FaceLandmarkerResultLike | null | undefined,
  thresholds: StudyFocusThresholds = STUDY_FOCUS_THRESHOLDS
): FaceFrameMetrics {
  const landmarks = result?.faceLandmarks?.[0];
  if (!landmarks || landmarks.length === 0) {
    return { ...EMPTY_FACE_METRICS };
  }

  const { yawDeg, pitchDeg, rollDeg } = estimateHeadPoseFromLandmarks(landmarks);

  const categories = result?.faceBlendshapes?.[0]?.categories ?? [];
  const leftBlink = categories.find((c) => c.categoryName === "eyeBlinkLeft")?.score;
  const rightBlink = categories.find((c) => c.categoryName === "eyeBlinkRight")?.score;
  const leftLookDown = categories.find(
    (c) => c.categoryName === "eyeLookDownLeft"
  )?.score;
  const rightLookDown = categories.find(
    (c) => c.categoryName === "eyeLookDownRight"
  )?.score;

  let eyeClosureScore = 0;
  if (typeof leftBlink === "number" && typeof rightBlink === "number") {
    eyeClosureScore = Math.round(Math.min(leftBlink, rightBlink) * 100) / 100;
  } else {
    const leftEar = computeEyeAspectRatio(landmarks, [33, 160, 158, 133, 153, 144]);
    const rightEar = computeEyeAspectRatio(landmarks, [362, 385, 387, 263, 373, 380]);
    const avgEar = (leftEar + rightEar) / 2;
    eyeClosureScore =
      avgEar <= thresholds.eyeAspectRatioThreshold
        ? 0.85
        : clamp(1 - avgEar / 0.35, 0, 0.45);
  }

  const eyeLookDownScore =
    typeof leftLookDown === "number" && typeof rightLookDown === "number"
      ? Math.round(((leftLookDown + rightLookDown) / 2) * 100) / 100
      : 0;

  return {
    hasFace: true,
    eyeClosureScore,
    eyeLookDownScore,
    yawDeg,
    pitchDeg,
    rollDeg,
  };
}

export function getStatusDisplayLabel(status: StudyFocusStatus): string {
  switch (status) {
    case "focused":
      return "Đang tập trung tốt";
    case "phone_distracted":
      return "Xao nhãng (Điện thoại / iPad)";
    case "scrolling_distracted":
      return "Xao nhãng (Đang lướt tay)";
    case "distracted":
      return "Mất tập trung (Quay mặt / Nhìn xuống)";
    case "drowsy":
      return "Cảnh báo buồn ngủ / Gục đầu";
    case "absent":
      return "Vắng mặt khỏi bàn học";
    case "idle":
    default:
      return "Chờ khởi động Camera";
  }
}

/**
 * Bộ theo dõi trạng thái tập trung theo thời gian thực.
 * Thuần TypeScript (không phụ thuộc React/DOM) để dễ kiểm thử và tinh chỉnh ngưỡng.
 */
export class StudyFocusTracker {
  private readonly thresholds: StudyFocusThresholds;
  private lastTimestampMs: number | null = null;
  private totalTrackedMs = 0;
  private focusedMs = 0;
  private distractionCount = 0;
  private drowsinessAlertCount = 0;
  private deviceDistractionCount = 0;

  private drowsyStreakMs = 0;
  private distractedStreakMs = 0;
  private lookDownStreakMs = 0;
  private absentStreakMs = 0;
  private deviceStreakMs = 0;
  private scrollingStreakMs = 0;

  private lastDrowsyAlertAtMs = -Infinity;
  private lastDistractionAlertAtMs = -Infinity;

  private currentStatus: StudyFocusStatus = "idle";
  private lastMetrics: FaceFrameMetrics = { ...EMPTY_FACE_METRICS };
  private lastDevices: DetectedDistractionDevice[] = [];
  private lastIsHandScrolling = false;

  constructor(thresholds: StudyFocusThresholds = STUDY_FOCUS_THRESHOLDS) {
    this.thresholds = thresholds;
  }

  public reset(): void {
    this.lastTimestampMs = null;
    this.totalTrackedMs = 0;
    this.focusedMs = 0;
    this.distractionCount = 0;
    this.drowsinessAlertCount = 0;
    this.deviceDistractionCount = 0;
    this.drowsyStreakMs = 0;
    this.distractedStreakMs = 0;
    this.lookDownStreakMs = 0;
    this.absentStreakMs = 0;
    this.deviceStreakMs = 0;
    this.scrollingStreakMs = 0;
    this.lastDrowsyAlertAtMs = -Infinity;
    this.lastDistractionAlertAtMs = -Infinity;
    this.currentStatus = "idle";
    this.lastMetrics = { ...EMPTY_FACE_METRICS };
    this.lastDevices = [];
    this.lastIsHandScrolling = false;
  }

  public processFrame(
    metrics: FaceFrameMetrics,
    nowMs: number,
    extras?: FrameDistractionExtras
  ): StudyTrackerSnapshot {
    const rawDelta =
      this.lastTimestampMs === null ? 0 : Math.max(0, nowMs - this.lastTimestampMs);
    const deltaMs = Math.min(rawDelta, this.thresholds.maxFrameDeltaMs);
    this.lastTimestampMs = nowMs;
    this.lastMetrics = metrics;

    const enableDeviceAndHand = extras?.enableDeviceAndHandDetection !== false;
    const noteTakingMode = Boolean(extras?.noteTakingMode);
    const detectedDevices = enableDeviceAndHand
      ? extras?.detectedDevices ?? []
      : [];
    const isHandScrolling = enableDeviceAndHand
      ? Boolean(extras?.isHandScrolling)
      : false;

    this.lastDevices = detectedDevices;
    this.lastIsHandScrolling = isHandScrolling;

    let justTriggeredAlert: StudyAlertType = "none";

    if (!metrics.hasFace) {
      this.absentStreakMs += deltaMs;
      this.drowsyStreakMs = 0;
      this.distractedStreakMs = 0;
      this.lookDownStreakMs = 0;
      this.deviceStreakMs = 0;
      this.scrollingStreakMs = 0;

      if (this.absentStreakMs >= this.thresholds.absenceDurationMs) {
        this.currentStatus = "absent";
        if (
          nowMs - this.lastDistractionAlertAtMs >=
          this.thresholds.distractionCooldownMs
        ) {
          this.distractionCount += 1;
          this.lastDistractionAlertAtMs = nowMs;
          justTriggeredAlert = "absent";
        }
      } else if (this.currentStatus === "idle") {
        this.currentStatus = "absent";
      }
    } else {
      this.absentStreakMs = 0;

      const isEyesClosed =
        metrics.eyeClosureScore >= this.thresholds.eyeBlinkScoreThreshold;
      // Ở chế độ Ghi chép vở, chỉ báo gục đầu ngủ khi cúi sâu hơn bình thường (+12 độ)
      const effectiveHeadDropDeg = noteTakingMode
        ? this.thresholds.headPitchDownThresholdDeg + 12
        : this.thresholds.headPitchDownThresholdDeg;
      const isHeadDropped = metrics.pitchDeg >= effectiveHeadDropDeg;
      const isDrowsySignal = isEyesClosed || isHeadDropped;

      const hasDistractionDevice = detectedDevices.length > 0;
      const isLookingDownSubtle =
        (metrics.eyeLookDownScore ?? 0) >= this.thresholds.eyeLookDownThreshold &&
        metrics.pitchDeg >= this.thresholds.headPitchLookDownThresholdDeg;

      const isLookingAway =
        Math.abs(metrics.yawDeg) >= this.thresholds.headYawDistractionDeg ||
        (!noteTakingMode &&
          Math.abs(metrics.pitchDeg) >= this.thresholds.headPitchDistractionDeg);

      if (isDrowsySignal) {
        this.drowsyStreakMs += deltaMs;
        this.distractedStreakMs = 0;
        this.lookDownStreakMs = 0;

        if (this.drowsyStreakMs >= this.thresholds.drowsyDurationMs) {
          this.currentStatus = "drowsy";
          if (nowMs - this.lastDrowsyAlertAtMs >= this.thresholds.drowsyCooldownMs) {
            this.drowsinessAlertCount += 1;
            this.lastDrowsyAlertAtMs = nowMs;
            justTriggeredAlert = "drowsy";
          }
        } else if (this.currentStatus === "idle") {
          this.currentStatus = "focused";
        }
      } else if (hasDistractionDevice) {
        this.deviceStreakMs += deltaMs;
        this.drowsyStreakMs = 0;
        this.distractedStreakMs = 0;
        this.lookDownStreakMs = 0;

        // Nếu vừa cầm điện thoại/iPad vừa lướt tay thì nhắc sớm hơn một chút
        const neededDeviceMs = isHandScrolling
          ? Math.round(this.thresholds.deviceDistractionDurationMs * 0.65)
          : this.thresholds.deviceDistractionDurationMs;

        if (this.deviceStreakMs >= neededDeviceMs) {
          this.currentStatus = "phone_distracted";
          if (
            nowMs - this.lastDistractionAlertAtMs >=
            this.thresholds.distractionCooldownMs
          ) {
            this.distractionCount += 1;
            this.deviceDistractionCount += 1;
            this.lastDistractionAlertAtMs = nowMs;
            justTriggeredAlert = "phone_distracted";
          }
        } else if (this.currentStatus === "idle") {
          this.currentStatus = "focused";
        }
      } else if (isHandScrolling) {
        this.scrollingStreakMs += deltaMs;
        this.deviceStreakMs = Math.max(0, this.deviceStreakMs - deltaMs);
        this.drowsyStreakMs = 0;
        this.distractedStreakMs = 0;

        // Lướt tay kèm nhìn xuống sẽ nhận diện nhanh hơn; chỉ lướt tay thuần cần bền hơn để tránh nhắc nhầm
        const neededScrollMs = isLookingDownSubtle
          ? Math.round(this.thresholds.scrollingDurationMs * 0.65)
          : this.thresholds.scrollingDurationMs;

        if (this.scrollingStreakMs >= neededScrollMs) {
          this.currentStatus = "scrolling_distracted";
          if (
            nowMs - this.lastDistractionAlertAtMs >=
            this.thresholds.distractionCooldownMs
          ) {
            this.distractionCount += 1;
            this.deviceDistractionCount += 1;
            this.lastDistractionAlertAtMs = nowMs;
            justTriggeredAlert = "scrolling_distracted";
          }
        } else if (this.currentStatus === "idle") {
          this.currentStatus = "focused";
        }
      } else if (isLookingAway) {
        this.distractedStreakMs += deltaMs;
        this.drowsyStreakMs = 0;
        this.deviceStreakMs = Math.max(0, this.deviceStreakMs - deltaMs);
        this.scrollingStreakMs = Math.max(0, this.scrollingStreakMs - deltaMs);

        if (this.distractedStreakMs >= this.thresholds.distractionDurationMs) {
          this.currentStatus = "distracted";
          if (
            nowMs - this.lastDistractionAlertAtMs >=
            this.thresholds.distractionCooldownMs
          ) {
            this.distractionCount += 1;
            this.lastDistractionAlertAtMs = nowMs;
            justTriggeredAlert = "distracted";
          }
        } else if (this.currentStatus === "idle") {
          this.currentStatus = "focused";
        }
      } else if (!noteTakingMode && isLookingDownSubtle) {
        this.lookDownStreakMs += deltaMs;
        this.drowsyStreakMs = 0;
        this.distractedStreakMs = 0;
        this.deviceStreakMs = Math.max(0, this.deviceStreakMs - deltaMs);
        this.scrollingStreakMs = Math.max(0, this.scrollingStreakMs - deltaMs);

        if (this.lookDownStreakMs >= this.thresholds.lookDownDistractionDurationMs) {
          this.currentStatus = "distracted";
          if (
            nowMs - this.lastDistractionAlertAtMs >=
            this.thresholds.distractionCooldownMs
          ) {
            this.distractionCount += 1;
            this.lastDistractionAlertAtMs = nowMs;
            justTriggeredAlert = "distracted";
          }
        } else if (this.currentStatus === "idle") {
          this.currentStatus = "focused";
        }
      } else {
        this.drowsyStreakMs = 0;
        this.distractedStreakMs = 0;
        this.lookDownStreakMs = 0;
        this.deviceStreakMs = Math.max(0, this.deviceStreakMs - deltaMs * 2);
        this.scrollingStreakMs = Math.max(0, this.scrollingStreakMs - deltaMs * 2);
        this.currentStatus = "focused";
      }
    }

    if (deltaMs > 0) {
      this.totalTrackedMs += deltaMs;
      if (this.currentStatus === "focused") {
        this.focusedMs += deltaMs;
      }
    }

    return this.buildSnapshot(justTriggeredAlert);
  }

  public getSnapshot(): StudyTrackerSnapshot {
    return this.buildSnapshot("none");
  }

  private buildSnapshot(justTriggeredAlert: StudyAlertType): StudyTrackerSnapshot {
    const focusScorePercent =
      this.totalTrackedMs > 0
        ? clamp(Math.round((this.focusedMs / this.totalTrackedMs) * 100), 0, 100)
        : 100;

    const currentIssueDurationMs =
      this.currentStatus === "drowsy"
        ? this.drowsyStreakMs
        : this.currentStatus === "phone_distracted"
        ? this.deviceStreakMs
        : this.currentStatus === "scrolling_distracted"
        ? this.scrollingStreakMs
        : this.currentStatus === "distracted"
        ? Math.max(this.distractedStreakMs, this.lookDownStreakMs)
        : this.currentStatus === "absent"
        ? this.absentStreakMs
        : 0;

    return {
      status: this.currentStatus,
      statusLabel: getStatusDisplayLabel(this.currentStatus),
      focusScorePercent,
      focusedMs: this.focusedMs,
      totalTrackedMs: this.totalTrackedMs,
      distractionCount: this.distractionCount,
      drowsinessAlertCount: this.drowsinessAlertCount,
      deviceDistractionCount: this.deviceDistractionCount,
      activeDevices: this.lastDevices,
      isHandScrolling: this.lastIsHandScrolling,
      currentIssueDurationMs,
      metrics: this.lastMetrics,
      justTriggeredAlert,
    };
  }
}
