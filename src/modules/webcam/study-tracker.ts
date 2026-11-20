import {
  STUDY_FOCUS_THRESHOLDS,
  StudyFocusThresholds,
} from "@/modules/webcam/thresholds";
import {
  HUMAN_OBSERVER_THRESHOLDS,
  HumanObserverThresholds,
} from "@/modules/webcam/observer-thresholds";
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

/** Lý do cụ thể khiến người quan sát kết luận bạn đang buồn ngủ */
export type DrowsyReason =
  | "eyes_closed"
  | "half_closed"
  | "head_drop"
  | "head_rest"
  | "perclos"
  | "long_blinks"
  | "nodding"
  | "yawning"
  | "face_down_desk";

/** Lý do cụ thể khiến người quan sát kết luận bạn đang xao nhãng */
export type DistractionReason =
  | "looking_away"
  | "looking_down"
  | "glance_pattern"
  | "phone_posture"
  | "face_hidden_hands"
  | "device"
  | "scrolling"
  | "absent";

/** Mức độ để ý của người quan sát: bình thường -> đang để ý -> nhắc nhở */
export type ObserverAttentionLevel = "calm" | "watching" | "alert";

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
  /** Mức độ nhắm mắt (0 = mở to, 1 = nhắm kín) — lấy mắt mở to hơn (min) */
  eyeClosureScore: number;
  /** Mức độ nhắm mắt trung bình 2 mắt (nhạy hơn khi 1 mắt bị che/khép) */
  eyeClosureAvgScore?: number;
  /** Mức độ ánh mắt nhìn xuống (0..1) từ blendshapes eyeLookDownLeft/Right */
  eyeLookDownScore?: number;
  /** Độ mở miệng (0..1) từ blendshape jawOpen — dùng nhận diện ngáp */
  jawOpenScore?: number;
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
  /** Có thấy bàn tay trong khung hình không */
  handsVisible?: boolean;
  /** Có bàn tay đặt thấp trong khung hình (tư thế cầm điện thoại) không */
  handsInLowerZone?: boolean;
  /** Chế độ Ghi chép vở: nới lỏng cảnh báo nhìn xuống/cúi đầu nhẹ để học sinh thoải mái viết bài */
  noteTakingMode?: boolean;
  /** Bật/tắt nhận diện điện thoại/iPad & lướt tay */
  enableDeviceAndHandDetection?: boolean;
}

export interface StudyPenaltyEvaluation {
  shouldTerminateWithPenalty: boolean;
  tooManyDistractions: boolean;
  penaltyReason: string | null;
}

export interface StudyTrackerSnapshot {
  status: StudyFocusStatus;
  statusLabel: string;
  focusScorePercent: number;
  focusedMs: number;
  totalTrackedMs: number;
  /** Số ĐỢT xao nhãng (1 lần ngồi bấm điện thoại liên tục chỉ tính 1 đợt) */
  distractionCount: number;
  /** Số ĐỢT buồn ngủ */
  drowsinessAlertCount: number;
  deviceDistractionCount: number;
  activeDevices: DetectedDistractionDevice[];
  isHandScrolling: boolean;
  currentIssueDurationMs: number;
  metrics: FaceFrameMetrics;
  justTriggeredAlert: StudyAlertType;
  shouldTerminateWithPenalty: boolean;
  penaltyReason: string | null;
  penaltyTriggers: {
    tooManyDistractions: boolean;
  };
  /** Mức độ để ý hiện tại của người quan sát */
  attentionLevel: ObserverAttentionLevel;
  /** Lời nhận xét tự nhiên của người quan sát về những gì đang thấy */
  observerNote: string;
  drowsyReason: DrowsyReason | null;
  distractionReason: DistractionReason | null;
  /** Đã làm quen xong tư thế ngồi học bình thường của bạn chưa */
  isCalibrated: boolean;
  yawnCount: number;
  nodCount: number;
}

/**
 * Đánh giá điều kiện kỷ luật kết thúc phiên và phạt số phút tích lũy về 0:
 * - Chỉ còn 1 quy tắc: số ĐỢT xao nhãng vượt quá 10 (> 10).
 * - Đã BỎ quy tắc phạt khi độ tập trung < 75%.
 */
export function evaluateStudyPenalty(
  distractionCount: number,
  thresholds: StudyFocusThresholds = STUDY_FOCUS_THRESHOLDS
): StudyPenaltyEvaluation {
  const tooManyDistractions =
    distractionCount > thresholds.maxDistractionsBeforePenalty;

  return {
    shouldTerminateWithPenalty: tooManyDistractions,
    tooManyDistractions,
    penaltyReason: tooManyDistractions
      ? `Số lần xao nhãng vượt quá ${thresholds.maxDistractionsBeforePenalty} (${distractionCount} lần).`
      : null,
  };
}

export const EMPTY_FACE_METRICS: FaceFrameMetrics = {
  hasFace: false,
  eyeClosureScore: 0,
  eyeClosureAvgScore: 0,
  eyeLookDownScore: 0,
  jawOpenScore: 0,
  yawDeg: 0,
  pitchDeg: 0,
  rollDeg: 0,
};

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function round2(val: number): number {
  return Math.round(val * 100) / 100;
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
  const score = (name: string) =>
    categories.find((c) => c.categoryName === name)?.score;
  const leftBlink = score("eyeBlinkLeft");
  const rightBlink = score("eyeBlinkRight");
  const leftLookDown = score("eyeLookDownLeft");
  const rightLookDown = score("eyeLookDownRight");
  const jawOpen = score("jawOpen");

  let eyeClosureScore = 0;
  let eyeClosureAvgScore = 0;
  if (typeof leftBlink === "number" && typeof rightBlink === "number") {
    eyeClosureScore = round2(Math.min(leftBlink, rightBlink));
    eyeClosureAvgScore = round2((leftBlink + rightBlink) / 2);
  } else {
    const leftEar = computeEyeAspectRatio(landmarks, [33, 160, 158, 133, 153, 144]);
    const rightEar = computeEyeAspectRatio(landmarks, [362, 385, 387, 263, 373, 380]);
    const avgEar = (leftEar + rightEar) / 2;
    eyeClosureScore =
      avgEar <= thresholds.eyeAspectRatioThreshold
        ? 0.85
        : clamp(1 - avgEar / 0.35, 0, 0.45);
    eyeClosureAvgScore = eyeClosureScore;
  }

  const eyeLookDownScore =
    typeof leftLookDown === "number" && typeof rightLookDown === "number"
      ? round2((leftLookDown + rightLookDown) / 2)
      : 0;

  return {
    hasFace: true,
    eyeClosureScore,
    eyeClosureAvgScore,
    eyeLookDownScore,
    jawOpenScore: typeof jawOpen === "number" ? round2(jawOpen) : 0,
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

export function describeDrowsyReason(reason: DrowsyReason | null): string {
  switch (reason) {
    case "eyes_closed":
      return "Mắt bạn nhắm lại khá lâu rồi đấy";
    case "half_closed":
      return "Mắt bạn lim dim nặng trĩu một lúc lâu";
    case "head_drop":
      return "Đầu bạn đang gục xuống";
    case "head_rest":
      return "Bạn đang tựa/nghiêng đầu và mắt díp lại";
    case "perclos":
      return "Nửa phút qua mắt bạn khép lại quá nhiều";
    case "long_blinks":
      return "Bạn chớp mắt chậm nhiều lần liền (díp mắt)";
    case "nodding":
      return "Bạn vừa gật gù vài lần";
    case "yawning":
      return "Bạn ngáp liên tục";
    case "face_down_desk":
      return "Bạn vừa gục hẳn xuống bàn";
    default:
      return "Có dấu hiệu buồn ngủ";
  }
}

export function describeDistractionReason(reason: DistractionReason | null): string {
  switch (reason) {
    case "looking_away":
      return "Bạn đang quay mặt đi chỗ khác";
    case "looking_down":
      return "Bạn nhìn xuống dưới bàn khá lâu";
    case "glance_pattern":
      return "Bạn liếc xuống dưới bàn liên tục (như đang kiểm tra điện thoại)";
    case "phone_posture":
      return "Bạn cúi nhìn xuống với tay đặt thấp — trông như đang bấm điện thoại";
    case "face_hidden_hands":
      return "Bạn cúi gằm xuống, chỉ thấy tay — có vẻ đang dùng điện thoại";
    case "device":
      return "Có điện thoại / iPad trong khung hình";
    case "scrolling":
      return "Ngón tay bạn đang lướt liên tục";
    case "absent":
      return "Không thấy bạn trước bàn học";
    default:
      return "Bạn đang mất tập trung";
  }
}

/** Bằng chứng tích lũy có rò rỉ: tăng khi thấy tín hiệu, giảm dần khi không thấy (không reset đột ngột). */
class LeakyEvidence {
  public level = 0;

  update(active: boolean, dtMs: number, rise: number, decay: number, cap: number) {
    if (active) {
      this.level = Math.min(cap, this.level + dtMs * rise);
    } else {
      this.level = Math.max(0, this.level - dtMs * decay);
    }
  }

  push(to: number) {
    this.level = Math.max(this.level, to);
  }

  reset() {
    this.level = 0;
  }
}

interface RelativePose {
  yaw: number;
  pitch: number;
  roll: number;
  closure: number;
  lookDown: number;
}

/** Tư thế ngồi bình thường của riêng từng bạn (góc camera laptop, dáng mắt, thói quen ngồi). */
class PostureBaseline {
  private yaw = 0;
  private pitch = 0;
  private roll = 0;
  private closure = 0;
  private lookDown = 0;
  private neutralMs = 0;
  private hasSample = false;

  constructor(private readonly cfg: HumanObserverThresholds) {}

  get ready(): boolean {
    return this.neutralMs >= this.cfg.calibrationWarmupMs;
  }

  reset() {
    this.yaw = 0;
    this.pitch = 0;
    this.roll = 0;
    this.closure = 0;
    this.lookDown = 0;
    this.neutralMs = 0;
    this.hasSample = false;
  }

  isNeutral(m: FaceFrameMetrics, closure: number, lookDown: number): boolean {
    const c = this.cfg;
    return (
      Math.abs(m.yawDeg) <= c.neutralMaxAbsYawDeg &&
      m.pitchDeg >= c.neutralMinPitchDeg &&
      m.pitchDeg <= c.neutralMaxPitchDeg &&
      closure <= c.neutralMaxEyeClosure &&
      lookDown <= c.neutralMaxLookDown
    );
  }

  observe(m: FaceFrameMetrics, closure: number, lookDown: number, dtMs: number) {
    const c = this.cfg;
    const clampAll = () => {
      this.yaw = clamp(this.yaw, -c.baselineMaxAbsYawDeg, c.baselineMaxAbsYawDeg);
      this.pitch = clamp(this.pitch, -c.baselineMaxAbsPitchDeg, c.baselineMaxAbsPitchDeg);
      this.roll = clamp(this.roll, -c.baselineMaxAbsRollDeg, c.baselineMaxAbsRollDeg);
      this.closure = clamp(this.closure, 0, c.baselineMaxEyeClosure);
      this.lookDown = clamp(this.lookDown, 0, c.baselineMaxLookDown);
    };

    if (!this.hasSample) {
      this.hasSample = true;
      this.yaw = m.yawDeg;
      this.pitch = m.pitchDeg;
      this.roll = m.rollDeg;
      this.closure = closure;
      this.lookDown = lookDown;
      clampAll();
      this.neutralMs += dtMs;
      return;
    }
    if (dtMs <= 0) return;

    const tau =
      this.neutralMs < c.calibrationFastPhaseMs
        ? c.calibrationFastTauMs
        : c.calibrationSlowTauMs;
    const a = clamp(dtMs / tau, 0, 1);
    this.yaw += (m.yawDeg - this.yaw) * a;
    this.pitch += (m.pitchDeg - this.pitch) * a;
    this.roll += (m.rollDeg - this.roll) * a;
    this.closure += (closure - this.closure) * a;
    this.lookDown += (lookDown - this.lookDown) * a;
    clampAll();
    this.neutralMs += dtMs;
  }

  relative(m: FaceFrameMetrics, closure: number, lookDown: number): RelativePose {
    return {
      yaw: m.yawDeg - this.yaw,
      pitch: m.pitchDeg - this.pitch,
      roll: m.rollDeg - this.roll,
      closure: clamp((closure - this.closure) / (1 - this.closure), 0, 1),
      lookDown: clamp((lookDown - this.lookDown) / (1 - this.lookDown), 0, 1),
    };
  }
}

type EpisodeGroup = "device_use" | "looking_away" | "absent";

function pruneTimes(times: number[], cutoff: number): number[] {
  return times.filter((t) => t >= cutoff);
}

/**
 * Bộ theo dõi trạng thái tập trung theo thời gian thực theo kiểu "người quan sát người".
 * Thuần TypeScript (không phụ thuộc React/DOM) để dễ kiểm thử và tinh chỉnh ngưỡng.
 */
export class StudyFocusTracker {
  private readonly thresholds: StudyFocusThresholds;
  private readonly observer: HumanObserverThresholds;
  private readonly baseline: PostureBaseline;

  private lastTimestampMs: number | null = null;
  private totalTrackedMs = 0;
  private focusedMs = 0;
  private distractionCount = 0;
  private drowsinessAlertCount = 0;
  private deviceDistractionCount = 0;

  // Bằng chứng tích lũy cho từng loại hành vi
  private readonly drowsyEv = new LeakyEvidence();
  private readonly halfClosedEv = new LeakyEvidence();
  private readonly deviceEv = new LeakyEvidence();
  private readonly scrollEv = new LeakyEvidence();
  private readonly awayEv = new LeakyEvidence();
  private readonly lookDownEv = new LeakyEvidence();
  private readonly absentEv = new LeakyEvidence();

  // Trí nhớ ngắn hạn của người quan sát
  private lastDeviceSeenAtMs = -Infinity;
  private lastDeviceBestScore = 0;
  private heldDevices: DetectedDistractionDevice[] = [];
  private lastDrowsyCueAtMs = -Infinity;
  private lastPhonePostureCueAtMs = -Infinity;
  private lastHeavyEyesAtMs = -Infinity;
  private faceLostMode: "sleep" | "hands" | "absent" | null = null;
  private pushedDrowsyReason: DrowsyReason | null = null;
  private pushedLookDownReason: DistractionReason | null = null;

  // Chớp mắt chậm, PERCLOS, gật gù, ngáp, liếc xuống
  private closedRunStartMs: number | null = null;
  private longBlinkTimes: number[] = [];
  private perclosSamples: Array<{ t: number; dt: number; closed: boolean }> = [];
  private perclosCoverageMs = 0;
  private perclosClosedMs = 0;
  private lastPerclosPushAtMs = -Infinity;
  private nodLastDownMs: number | null = null;
  private nodTimes: number[] = [];
  private lastSingleNodAtMs = -Infinity;
  private nodTotal = 0;
  private yawnRunStartMs: number | null = null;
  private yawnRunCounted = false;
  private yawnTimes: number[] = [];
  private lastYawnAtMs = -Infinity;
  private yawnTotal = 0;
  private lookDownRunStartMs: number | null = null;
  private lookDownRunCounted = false;
  private glanceTimes: number[] = [];

  // Đợt xao nhãng / buồn ngủ
  private inDrowsyEpisode = false;
  private distractionEpisode: { group: EpisodeGroup; status: StudyFocusStatus } | null = null;
  private lastDistractionEpisodeStartMs = -Infinity;
  private focusedSinceMs: number | null = null;
  private statusSinceMs = 0;
  private lastDrowsyAlertAtMs = -Infinity;
  private lastDistractionAlertAtMs = -Infinity;

  private currentStatus: StudyFocusStatus = "idle";
  private currentDrowsyReason: DrowsyReason | null = null;
  private currentDistractionReason: DistractionReason | null = null;
  private watchingNote = "";
  private lastMetrics: FaceFrameMetrics = { ...EMPTY_FACE_METRICS };
  private lastDevices: DetectedDistractionDevice[] = [];
  private lastIsHandScrolling = false;

  constructor(
    thresholds: StudyFocusThresholds = STUDY_FOCUS_THRESHOLDS,
    observer: HumanObserverThresholds = HUMAN_OBSERVER_THRESHOLDS
  ) {
    this.thresholds = thresholds;
    this.observer = observer;
    this.baseline = new PostureBaseline(observer);
  }

  public reset(): void {
    this.lastTimestampMs = null;
    this.totalTrackedMs = 0;
    this.focusedMs = 0;
    this.distractionCount = 0;
    this.drowsinessAlertCount = 0;
    this.deviceDistractionCount = 0;
    for (const ev of [
      this.drowsyEv,
      this.halfClosedEv,
      this.deviceEv,
      this.scrollEv,
      this.awayEv,
      this.lookDownEv,
      this.absentEv,
    ]) {
      ev.reset();
    }
    this.baseline.reset();
    this.lastDeviceSeenAtMs = -Infinity;
    this.lastDeviceBestScore = 0;
    this.heldDevices = [];
    this.lastDrowsyCueAtMs = -Infinity;
    this.lastPhonePostureCueAtMs = -Infinity;
    this.lastHeavyEyesAtMs = -Infinity;
    this.faceLostMode = null;
    this.pushedDrowsyReason = null;
    this.pushedLookDownReason = null;
    this.closedRunStartMs = null;
    this.longBlinkTimes = [];
    this.perclosSamples = [];
    this.perclosCoverageMs = 0;
    this.perclosClosedMs = 0;
    this.lastPerclosPushAtMs = -Infinity;
    this.nodLastDownMs = null;
    this.nodTimes = [];
    this.lastSingleNodAtMs = -Infinity;
    this.nodTotal = 0;
    this.yawnRunStartMs = null;
    this.yawnRunCounted = false;
    this.yawnTimes = [];
    this.lastYawnAtMs = -Infinity;
    this.yawnTotal = 0;
    this.lookDownRunStartMs = null;
    this.lookDownRunCounted = false;
    this.glanceTimes = [];
    this.inDrowsyEpisode = false;
    this.distractionEpisode = null;
    this.lastDistractionEpisodeStartMs = -Infinity;
    this.focusedSinceMs = null;
    this.statusSinceMs = 0;
    this.lastDrowsyAlertAtMs = -Infinity;
    this.lastDistractionAlertAtMs = -Infinity;
    this.currentStatus = "idle";
    this.currentDrowsyReason = null;
    this.currentDistractionReason = null;
    this.watchingNote = "";
    this.lastMetrics = { ...EMPTY_FACE_METRICS };
    this.lastDevices = [];
    this.lastIsHandScrolling = false;
  }

  public processFrame(
    metrics: FaceFrameMetrics,
    nowMs: number,
    extras?: FrameDistractionExtras
  ): StudyTrackerSnapshot {
    const T = this.thresholds;
    const O = this.observer;

    const rawDelta =
      this.lastTimestampMs === null ? 0 : Math.max(0, nowMs - this.lastTimestampMs);
    const dt = Math.min(rawDelta, T.maxFrameDeltaMs);
    this.lastTimestampMs = nowMs;
    this.lastMetrics = metrics;

    const enable = extras?.enableDeviceAndHandDetection !== false;
    const note = Boolean(extras?.noteTakingMode);
    const devices = enable ? extras?.detectedDevices ?? [] : [];
    const isScrolling = enable && Boolean(extras?.isHandScrolling);
    const handsVisible = enable && (Boolean(extras?.handsVisible) || isScrolling);
    const handsLower = enable && Boolean(extras?.handsInLowerZone);

    // --- Trí nhớ ngắn hạn về điện thoại (mô hình hay bỏ sót 1-2 lần quét) ---
    if (devices.length > 0) {
      this.lastDeviceSeenAtMs = nowMs;
      this.lastDeviceBestScore = Math.max(...devices.map((d) => d.score));
      this.heldDevices = devices;
    }
    const devicePresent =
      enable &&
      (devices.length > 0 || nowMs - this.lastDeviceSeenAtMs <= O.deviceSightingHoldMs);
    if (!devicePresent) this.heldDevices = [];
    this.lastDevices = devicePresent ? this.heldDevices : [];
    this.lastIsHandScrolling = isScrolling;

    const suspicion =
      nowMs - this.lastDistractionEpisodeStartMs <= O.suspicionWindowMs
        ? O.suspicionRiseMultiplier
        : 1;
    const decay = O.evidenceDecayRate;
    const cap = (thr: number) => thr * O.evidenceCapRatio;

    let frameDrowsyReason: DrowsyReason | null = null;
    let frameLookDownReason: DistractionReason = "looking_down";

    if (metrics.hasFace) {
      this.faceLostMode = null;
      const closureAbs = metrics.eyeClosureAvgScore ?? metrics.eyeClosureScore;
      const lookDownAbs = metrics.eyeLookDownScore ?? 0;
      const jaw = metrics.jawOpenScore ?? 0;

      // 1. Làm quen tư thế ngồi bình thường (chỉ học từ khung hình trông như đang nhìn bài)
      if (
        !devicePresent &&
        !isScrolling &&
        this.baseline.isNeutral(metrics, closureAbs, lookDownAbs)
      ) {
        this.baseline.observe(metrics, closureAbs, lookDownAbs, dt);
      }
      const rel = this.baseline.relative(metrics, closureAbs, lookDownAbs);

      // 2. Đọc các tín hiệu như mắt người nhìn
      const lookingDownEyes = lookDownAbs >= O.eyeLookDownMaskThreshold;
      // Khi nhìn xuống, mí mắt trông như khép lại => chỉ tin là nhắm mắt khi khép rất sâu
      const closureTrusted =
        !lookingDownEyes || rel.closure >= O.eyeClosedWhileLookingDownThreshold;
      const eyesClosed = rel.closure >= T.eyeBlinkScoreThreshold && closureTrusted;
      const eyesHeavy =
        !lookingDownEyes && rel.closure >= O.halfClosedEyeThreshold && !eyesClosed;
      if (eyesClosed || eyesHeavy || (!lookingDownEyes && rel.closure >= O.nodHeavyEyeClosure)) {
        this.lastHeavyEyesAtMs = nowMs;
      }

      const noteExtra = note ? 12 : 0;
      const phoneContext = devicePresent || isScrolling || handsLower;
      const sleepyLookingEyes = !lookingDownEyes || rel.closure >= 0.6;
      const headDeepDrop =
        rel.pitch >= O.deepHeadDropDeg + noteExtra && !phoneContext && sleepyLookingEyes;
      const headDropHeavy =
        rel.pitch >= T.headPitchDownThresholdDeg + noteExtra &&
        rel.closure >= O.headDropWithHeavyEyesClosure &&
        !phoneContext &&
        sleepyLookingEyes;
      const headRest =
        Math.abs(rel.roll) >= O.headRestRollDeg &&
        rel.closure >= O.halfClosedEyeThreshold &&
        !lookingDownEyes;

      this.halfClosedEv.update(eyesHeavy, dt, 1, decay, cap(O.halfClosedDurationMs));
      const halfClosedLong =
        eyesHeavy && this.halfClosedEv.level >= O.halfClosedDurationMs;

      const drowsySignal =
        eyesClosed || headDeepDrop || headDropHeavy || headRest || halfClosedLong;
      if (eyesClosed) frameDrowsyReason = "eyes_closed";
      else if (headDeepDrop || headDropHeavy) frameDrowsyReason = "head_drop";
      else if (headRest) frameDrowsyReason = "head_rest";
      else if (halfClosedLong) frameDrowsyReason = "half_closed";

      const lookingAway =
        !drowsySignal &&
        (Math.abs(rel.yaw) >= T.headYawDistractionDeg ||
          rel.pitch <= -T.headPitchDistractionDeg);

      const lookDownSignal =
        !note &&
        !drowsySignal &&
        !lookingAway &&
        ((rel.lookDown >= T.eyeLookDownThreshold &&
          rel.pitch >= T.headPitchLookDownThresholdDeg) ||
          rel.lookDown >= O.lookDownEyesOnlyThreshold ||
          rel.pitch >= O.lookDownHeadOnlyDeg);
      if (lookDownSignal && (handsLower || isScrolling)) {
        this.lastPhonePostureCueAtMs = nowMs;
      }

      // 3. Tích lũy bằng chứng (không reset đột ngột vì 1 khung hình nhiễu)
      this.drowsyEv.update(drowsySignal, dt, 1, decay, cap(T.drowsyDurationMs));
      const deviceRise =
        (this.lastDeviceBestScore >= O.deviceStrongConfidence ? 1 : O.deviceWeakRise) *
        (lookDownSignal || isScrolling || handsLower || lookingAway
          ? O.deviceContextBoost
          : 1) *
        suspicion;
      this.deviceEv.update(
        devicePresent,
        dt,
        deviceRise,
        decay,
        cap(T.deviceDistractionDurationMs)
      );
      this.scrollEv.update(
        isScrolling,
        dt,
        (lookDownSignal ? 1.5 : 1) * suspicion,
        decay,
        cap(T.scrollingDurationMs)
      );
      this.awayEv.update(lookingAway, dt, suspicion, decay, cap(T.distractionDurationMs));
      this.lookDownEv.update(
        lookDownSignal,
        dt,
        (handsLower ? O.lowerZoneHandBoost : 1) * suspicion,
        decay,
        cap(T.lookDownDistractionDurationMs)
      );
      this.absentEv.update(false, dt, 1, decay, cap(T.absenceDurationMs));

      // 4. Các dấu hiệu buồn ngủ tinh tế theo thời gian
      this.trackLongBlinks(eyesClosed, nowMs);
      this.trackPerclos(
        rel.closure >= O.perclosClosedThreshold && closureTrusted,
        dt,
        nowMs
      );
      this.trackNods(rel.pitch, nowMs);
      this.trackYawns(jaw, nowMs);
      this.trackGlances(lookDownSignal, nowMs);

      if (
        drowsySignal ||
        this.drowsyEv.level >= T.drowsyDurationMs * O.drowsyCueRatio ||
        (rel.pitch >= T.headPitchDownThresholdDeg && eyesHeavy)
      ) {
        this.lastDrowsyCueAtMs = nowMs;
      }
    } else {
      // Không thấy khuôn mặt: người quan sát suy luận bạn đang làm gì thay vì kết luận ngay "vắng mặt"
      this.closedRunStartMs = null;
      this.yawnRunStartMs = null;
      this.lookDownRunStartMs = null;
      if (this.faceLostMode === null) {
        if (
          this.currentStatus === "drowsy" ||
          nowMs - this.lastDrowsyCueAtMs <= O.faceLostAfterDrowsyCueMs
        ) {
          this.faceLostMode = "sleep";
        } else if (devicePresent || handsVisible) {
          this.faceLostMode = "hands";
        } else {
          this.faceLostMode = "absent";
        }
      }
      // Nếu ban đầu tưởng vắng mặt nhưng sau đó thấy tay/điện thoại => bạn vẫn ngồi đó
      if (this.faceLostMode === "absent" && (devicePresent || handsVisible)) {
        this.faceLostMode = "hands";
      }

      const sleepMode = this.faceLostMode === "sleep";
      const handsMode = this.faceLostMode === "hands" && (devicePresent || handsVisible);
      const absentMode = !sleepMode && !handsMode;

      this.drowsyEv.update(sleepMode, dt, 1, decay, cap(T.drowsyDurationMs));
      if (sleepMode) frameDrowsyReason = "face_down_desk";
      this.halfClosedEv.update(false, dt, 1, decay, cap(O.halfClosedDurationMs));
      this.deviceEv.update(
        handsMode && devicePresent,
        dt,
        O.deviceContextBoost * suspicion,
        decay,
        cap(T.deviceDistractionDurationMs)
      );
      this.scrollEv.update(
        handsMode && isScrolling,
        dt,
        suspicion,
        decay,
        cap(T.scrollingDurationMs)
      );
      this.awayEv.update(false, dt, 1, decay, cap(T.distractionDurationMs));
      // Chế độ ghi chép vở: cúi sâu viết bài (chỉ thấy tay) vẫn được coi là đang học
      const handsOnlyDown = handsMode && !devicePresent && !isScrolling && !note;
      this.lookDownEv.update(
        handsOnlyDown,
        dt,
        O.lowerZoneHandBoost * suspicion,
        decay,
        cap(T.lookDownDistractionDurationMs)
      );
      if (handsOnlyDown) frameLookDownReason = "face_hidden_hands";
      this.absentEv.update(absentMode, dt, 1, decay, cap(T.absenceDurationMs));
    }

    // --- Kết luận trạng thái ---
    const drowsyConfirmed = this.drowsyEv.level >= T.drowsyDurationMs;
    const deviceConfirmed = this.deviceEv.level >= T.deviceDistractionDurationMs;
    const scrollConfirmed = this.scrollEv.level >= T.scrollingDurationMs;
    const absentConfirmed = this.absentEv.level >= T.absenceDurationMs;
    const awayConfirmed = this.awayEv.level >= T.distractionDurationMs;
    const lookDownConfirmed = this.lookDownEv.level >= T.lookDownDistractionDurationMs;
    const phoneUseContext =
      isScrolling || handsLower || nowMs - this.lastPhonePostureCueAtMs <= 1500;

    let nextStatus: StudyFocusStatus;
    let drowsyReason: DrowsyReason | null = null;
    let distractionReason: DistractionReason | null = null;

    if (drowsyConfirmed && !(deviceConfirmed && phoneUseContext)) {
      nextStatus = "drowsy";
      drowsyReason =
        frameDrowsyReason ?? this.pushedDrowsyReason ?? this.currentDrowsyReason ?? "eyes_closed";
    } else if (deviceConfirmed) {
      nextStatus = "phone_distracted";
      distractionReason = "device";
    } else if (scrollConfirmed) {
      nextStatus = "scrolling_distracted";
      distractionReason = "scrolling";
    } else if (absentConfirmed) {
      nextStatus = "absent";
      distractionReason = "absent";
    } else if (awayConfirmed) {
      nextStatus = "distracted";
      distractionReason = "looking_away";
    } else if (lookDownConfirmed) {
      if (frameLookDownReason === "face_hidden_hands") {
        nextStatus = "phone_distracted";
        distractionReason = "face_hidden_hands";
      } else if (phoneUseContext) {
        nextStatus = "phone_distracted";
        distractionReason = "phone_posture";
      } else {
        nextStatus = "distracted";
        distractionReason = this.pushedLookDownReason ?? "looking_down";
      }
    } else if (!metrics.hasFace && this.currentStatus === "idle") {
      nextStatus = "absent";
    } else {
      nextStatus = "focused";
    }

    if (nextStatus !== "drowsy") this.pushedDrowsyReason = null;
    if (!lookDownConfirmed) this.pushedLookDownReason = null;

    const justTriggeredAlert = this.applyEpisodes(
      nextStatus,
      distractionReason,
      nowMs
    );

    if (nextStatus !== this.currentStatus) this.statusSinceMs = nowMs;
    this.currentStatus = nextStatus;
    this.currentDrowsyReason = drowsyReason;
    this.currentDistractionReason = distractionReason;
    this.watchingNote = this.computeWatchingNote(nowMs);

    if (dt > 0) {
      this.totalTrackedMs += dt;
      if (this.currentStatus === "focused") {
        this.focusedMs += dt;
      }
    }

    return this.buildSnapshot(justTriggeredAlert, nowMs);
  }

  public getSnapshot(): StudyTrackerSnapshot {
    return this.buildSnapshot("none", this.lastTimestampMs ?? 0);
  }

  private pushDrowsy(reason: DrowsyReason) {
    this.drowsyEv.push(this.thresholds.drowsyDurationMs * this.observer.evidenceCapRatio);
    this.pushedDrowsyReason = reason;
  }

  private trackLongBlinks(eyesClosed: boolean, nowMs: number) {
    const O = this.observer;
    if (eyesClosed) {
      if (this.closedRunStartMs === null) this.closedRunStartMs = nowMs;
      return;
    }
    if (this.closedRunStartMs !== null) {
      const dur = nowMs - this.closedRunStartMs;
      this.closedRunStartMs = null;
      if (dur >= O.longBlinkMinMs && dur < this.thresholds.drowsyDurationMs) {
        this.longBlinkTimes.push(nowMs);
      }
    }
    this.longBlinkTimes = pruneTimes(this.longBlinkTimes, nowMs - O.longBlinkWindowMs);
    if (this.longBlinkTimes.length >= O.longBlinkCountForAlert) {
      this.longBlinkTimes = [];
      this.pushDrowsy("long_blinks");
    }
  }

  private trackPerclos(closed: boolean, dt: number, nowMs: number) {
    const O = this.observer;
    if (dt > 0) {
      this.perclosSamples.push({ t: nowMs, dt, closed });
      this.perclosCoverageMs += dt;
      if (closed) this.perclosClosedMs += dt;
    }
    const cutoff = nowMs - O.perclosWindowMs;
    while (this.perclosSamples.length > 0 && this.perclosSamples[0].t < cutoff) {
      const old = this.perclosSamples.shift()!;
      this.perclosCoverageMs -= old.dt;
      if (old.closed) this.perclosClosedMs -= old.dt;
    }
    if (
      this.perclosCoverageMs >= O.perclosMinCoverageMs &&
      this.perclosClosedMs / this.perclosCoverageMs >= O.perclosAlertRatio &&
      nowMs - this.lastPerclosPushAtMs >= O.perclosCooldownMs
    ) {
      this.lastPerclosPushAtMs = nowMs;
      this.pushDrowsy("perclos");
    }
  }

  private trackNods(relPitch: number, nowMs: number) {
    const O = this.observer;
    if (relPitch >= O.nodMinDropDeg) {
      this.nodLastDownMs = nowMs;
      return;
    }
    if (relPitch <= O.nodRecoverDeg && this.nodLastDownMs !== null) {
      const recoveredQuickly = nowMs - this.nodLastDownMs <= O.nodMaxRecoverMs;
      const eyesWereHeavy = nowMs - this.lastHeavyEyesAtMs <= 2000;
      this.nodLastDownMs = null;
      if (recoveredQuickly && eyesWereHeavy) {
        this.nodTotal += 1;
        this.lastSingleNodAtMs = nowMs;
        this.nodTimes.push(nowMs);
      }
    }
    this.nodTimes = pruneTimes(this.nodTimes, nowMs - O.nodWindowMs);
    if (this.nodTimes.length >= O.nodCountForAlert) {
      this.nodTimes = [];
      this.pushDrowsy("nodding");
    }
  }

  private trackYawns(jaw: number, nowMs: number) {
    const O = this.observer;
    if (jaw >= O.yawnJawOpenThreshold) {
      if (this.yawnRunStartMs === null) {
        this.yawnRunStartMs = nowMs;
        this.yawnRunCounted = false;
      }
      if (!this.yawnRunCounted && nowMs - this.yawnRunStartMs >= O.yawnMinDurationMs) {
        this.yawnRunCounted = true;
        this.yawnTotal += 1;
        this.lastYawnAtMs = nowMs;
        this.yawnTimes.push(nowMs);
      }
    } else {
      this.yawnRunStartMs = null;
      this.yawnRunCounted = false;
    }
    this.yawnTimes = pruneTimes(this.yawnTimes, nowMs - O.yawnWindowMs);
    if (this.yawnTimes.length >= O.yawnCountForAlert) {
      this.yawnTimes = [];
      this.pushDrowsy("yawning");
    }
  }

  private trackGlances(lookDownSignal: boolean, nowMs: number) {
    const O = this.observer;
    if (lookDownSignal) {
      if (this.lookDownRunStartMs === null) {
        this.lookDownRunStartMs = nowMs;
        this.lookDownRunCounted = false;
      }
      if (!this.lookDownRunCounted && nowMs - this.lookDownRunStartMs >= O.glanceMinMs) {
        this.lookDownRunCounted = true;
        this.glanceTimes.push(nowMs);
      }
    } else {
      this.lookDownRunStartMs = null;
      this.lookDownRunCounted = false;
    }
    this.glanceTimes = pruneTimes(this.glanceTimes, nowMs - O.glanceWindowMs);
    if (this.glanceTimes.length >= O.glanceCountForAlert) {
      this.glanceTimes = [];
      this.lookDownEv.push(
        this.thresholds.lookDownDistractionDurationMs * O.evidenceCapRatio
      );
      this.pushedLookDownReason = "glance_pattern";
    }
  }

  /**
   * Đếm theo ĐỢT như người thật: ngồi bấm điện thoại liên tục 1 phút là 1 lần xao nhãng
   * (vẫn nhắc lại định kỳ), chứ không phải 12 lần như cách đếm máy móc cũ.
   */
  private applyEpisodes(
    nextStatus: StudyFocusStatus,
    distractionReason: DistractionReason | null,
    nowMs: number
  ): StudyAlertType {
    const T = this.thresholds;
    const O = this.observer;

    if (nextStatus === "focused") {
      if (this.focusedSinceMs === null) this.focusedSinceMs = nowMs;
      if (nowMs - this.focusedSinceMs >= O.episodeGapMs) {
        this.inDrowsyEpisode = false;
        this.distractionEpisode = null;
      }
      return "none";
    }
    this.focusedSinceMs = null;

    if (nextStatus === "drowsy") {
      if (!this.inDrowsyEpisode) {
        this.inDrowsyEpisode = true;
        this.drowsinessAlertCount += 1;
        this.lastDrowsyAlertAtMs = nowMs;
        return "drowsy";
      }
      if (nowMs - this.lastDrowsyAlertAtMs >= T.drowsyCooldownMs) {
        this.lastDrowsyAlertAtMs = nowMs;
        return "drowsy";
      }
      return "none";
    }

    if (
      nextStatus !== "distracted" &&
      nextStatus !== "phone_distracted" &&
      nextStatus !== "scrolling_distracted" &&
      nextStatus !== "absent"
    ) {
      return "none";
    }

    const group: EpisodeGroup =
      nextStatus === "absent"
        ? "absent"
        : nextStatus === "distracted" && distractionReason === "looking_away"
        ? "looking_away"
        : "device_use";
    const isDeviceStatus =
      nextStatus === "phone_distracted" || nextStatus === "scrolling_distracted";
    const alertType = nextStatus as StudyAlertType;

    if (!this.distractionEpisode || this.distractionEpisode.group !== group) {
      this.distractionEpisode = { group, status: nextStatus };
      this.distractionCount += 1;
      if (isDeviceStatus) this.deviceDistractionCount += 1;
      this.lastDistractionEpisodeStartMs = nowMs;
      this.lastDistractionAlertAtMs = nowMs;
      return alertType;
    }

    // Cùng 1 đợt: nếu vừa "lộ" ra là đang dùng điện thoại thì nhắc ngay (không đếm thêm đợt)
    const prevStatus = this.distractionEpisode.status;
    const prevWasDevice =
      prevStatus === "phone_distracted" || prevStatus === "scrolling_distracted";
    this.distractionEpisode.status = nextStatus;
    if (isDeviceStatus && !prevWasDevice) {
      this.deviceDistractionCount += 1;
      this.lastDistractionAlertAtMs = nowMs;
      return alertType;
    }
    if (nowMs - this.lastDistractionAlertAtMs >= T.distractionCooldownMs) {
      this.lastDistractionAlertAtMs = nowMs;
      return alertType;
    }
    return "none";
  }

  private computeWatchingNote(nowMs: number): string {
    const T = this.thresholds;
    const O = this.observer;
    if (this.currentStatus !== "focused") return "";

    const candidates: Array<{ ratio: number; note: string }> = [
      { ratio: this.drowsyEv.level / T.drowsyDurationMs, note: "Hình như mắt bạn đang díp lại…" },
      {
        ratio: this.halfClosedEv.level / O.halfClosedDurationMs,
        note: "Mắt bạn hơi lim dim, cố lên nhé…",
      },
      {
        ratio: this.deviceEv.level / T.deviceDistractionDurationMs,
        note: "Mình thấy có gì như điện thoại trong khung hình…",
      },
      {
        ratio: this.scrollEv.level / T.scrollingDurationMs,
        note: "Ngón tay bạn đang lướt lướt gì đó…",
      },
      {
        ratio: this.lookDownEv.level / T.lookDownDistractionDurationMs,
        note: "Bạn đang nhìn xuống dưới bàn…",
      },
      {
        ratio: this.awayEv.level / T.distractionDurationMs,
        note: "Bạn đang nhìn đi chỗ khác…",
      },
      {
        ratio: this.absentEv.level / T.absenceDurationMs,
        note: "Ơ, bạn đâu rồi?",
      },
    ];
    const top = candidates.reduce((a, b) => (b.ratio > a.ratio ? b : a));
    if (top.ratio >= O.watchingRatio) return top.note;
    if (nowMs - this.lastSingleNodAtMs <= 8000) return "Bạn vừa gật gù một cái — buồn ngủ rồi à?";
    if (nowMs - this.lastYawnAtMs <= 8000) return "Bạn vừa ngáp — nếu mệt hãy uống ngụm nước nhé.";
    if (this.glanceTimes.length >= 2) return "Bạn liếc xuống dưới bàn mấy lần rồi đấy…";
    return "";
  }

  private buildSnapshot(
    justTriggeredAlert: StudyAlertType,
    nowMs: number
  ): StudyTrackerSnapshot {
    const focusScorePercent =
      this.totalTrackedMs > 0
        ? clamp(Math.round((this.focusedMs / this.totalTrackedMs) * 100), 0, 100)
        : 100;

    const currentIssueDurationMs =
      this.currentStatus === "focused" || this.currentStatus === "idle"
        ? 0
        : Math.max(0, nowMs - this.statusSinceMs);

    const penalty = evaluateStudyPenalty(this.distractionCount, this.thresholds);

    let attentionLevel: ObserverAttentionLevel = "calm";
    let observerNote: string;
    if (this.currentStatus === "idle") {
      observerNote = "Chưa bắt đầu quan sát.";
    } else if (this.currentStatus === "drowsy") {
      attentionLevel = "alert";
      observerNote = `${describeDrowsyReason(this.currentDrowsyReason)}.`;
    } else if (this.currentStatus !== "focused") {
      attentionLevel = "alert";
      observerNote = `${describeDistractionReason(this.currentDistractionReason)}.`;
    } else if (this.watchingNote) {
      attentionLevel = "watching";
      observerNote = this.watchingNote;
    } else {
      observerNote = this.baseline.ready
        ? "Bạn đang tập trung tốt — mình vẫn đang dõi theo."
        : "Đang làm quen với tư thế ngồi học của bạn…";
    }

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
      shouldTerminateWithPenalty: penalty.shouldTerminateWithPenalty,
      penaltyReason: penalty.penaltyReason,
      penaltyTriggers: {
        tooManyDistractions: penalty.tooManyDistractions,
      },
      attentionLevel,
      observerNote,
      drowsyReason: this.currentStatus === "drowsy" ? this.currentDrowsyReason : null,
      distractionReason:
        this.currentStatus === "drowsy" || this.currentStatus === "focused"
          ? null
          : this.currentDistractionReason,
      isCalibrated: this.baseline.ready,
      yawnCount: this.yawnTotal,
      nodCount: this.nodTotal,
    };
  }
}
