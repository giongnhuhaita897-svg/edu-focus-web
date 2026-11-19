import {
  STUDY_FOCUS_THRESHOLDS,
  StudyFocusThresholds,
} from "@/modules/webcam/thresholds";

export type DistractionDeviceKind = "phone" | "tablet_screen";

export interface DeviceBoundingBox {
  originX: number;
  originY: number;
  width: number;
  height: number;
}

export interface DetectedDistractionDevice {
  kind: DistractionDeviceKind;
  label: string;
  rawCategory: string;
  score: number;
  boundingBox: DeviceBoundingBox;
}

export interface ObjectDetectorResultLike {
  detections?: Array<{
    categories?: Array<{
      categoryName?: string;
      score?: number;
    }>;
    boundingBox?: DeviceBoundingBox;
  }>;
}

export interface HandLandmarkPoint {
  x: number;
  y: number;
  z?: number;
}

export interface HandScrollSnapshot {
  hasHands: boolean;
  isScrolling: boolean;
  flickCount: number;
  dominantAxis: "vertical" | "horizontal" | "none";
}

/**
 * Lọc các vật thể gây xao nhãng từ kết quả MediaPipe ObjectDetector (COCO EfficientDet):
 * - "cell phone" -> Điện thoại
 * - "tv" / "laptop" có kích thước đủ lớn phía trước khung hình -> iPad / Màn hình phụ
 *   (trong bộ nhãn COCO không có lớp "ipad/tablet" riêng nên iPad thường được nhận diện là cell phone, tv hoặc laptop).
 */
export function extractDistractionDevices(
  result: ObjectDetectorResultLike | null | undefined,
  frameWidth: number,
  frameHeight: number,
  thresholds: StudyFocusThresholds = STUDY_FOCUS_THRESHOLDS
): DetectedDistractionDevice[] {
  const detections = result?.detections;
  if (!detections || detections.length === 0) return [];

  const frameArea = Math.max(1, frameWidth * frameHeight);
  const found: DetectedDistractionDevice[] = [];

  for (const det of detections) {
    const topCategory = det.categories?.[0];
    const box = det.boundingBox;
    if (!topCategory?.categoryName || typeof topCategory.score !== "number" || !box) {
      continue;
    }

    const name = topCategory.categoryName.toLowerCase().trim();
    const score = topCategory.score;
    const areaRatio = (box.width * box.height) / frameArea;

    if (name === "cell phone" && score >= thresholds.phoneConfidenceThreshold) {
      found.push({
        kind: "phone",
        label: "Điện thoại",
        rawCategory: name,
        score,
        boundingBox: box,
      });
      continue;
    }

    if (
      (name === "tv" || name === "laptop") &&
      score >= thresholds.tabletScreenConfidenceThreshold &&
      areaRatio >= thresholds.minTabletBoxAreaRatio &&
      areaRatio <= 0.72
    ) {
      found.push({
        kind: "tablet_screen",
        label: "iPad / Màn hình phụ",
        rawCategory: name,
        score,
        boundingBox: box,
      });
    }
  }

  return found;
}

interface FingerSample {
  timestampMs: number;
  /** Tọa độ ngón tay tương đối so với cổ tay (loại bỏ chuyển động cả cánh tay) */
  relThumbX: number;
  relThumbY: number;
  relIndexX: number;
  relIndexY: number;
  wristX: number;
  wristY: number;
}

/**
 * Đếm số nhịp vuốt/lướt lặp lại trên 1 trục tọa độ (loại nhiễu rung tay nhỏ).
 * Một động tác lướt feed (TikTok/Facebook/Shorts/Web) tạo ra các xung chuyển động
 * rõ ràng theo trục dọc hoặc ngang lặp đi lặp lại trong khi cổ tay tương đối ổn định.
 */
function countRhythmicFlicks(
  values: number[],
  minStepDelta: number
): number {
  if (values.length < 3) return 0;

  let anchor = values[0];
  let flicks = 0;

  for (let i = 1; i < values.length; i++) {
    const delta = values[i] - anchor;
    if (Math.abs(delta) >= minStepDelta) {
      flicks += 1;
      anchor = values[i];
    }
  }

  return flicks;
}

/**
 * Bộ nhận diện cử động tay lướt điện thoại / iPad (HandLandmarker 21 điểm).
 * Thiết kế chú trọng sự thoải mái thực tế:
 * - Tính vị trí đầu ngón cái (4) và ngón trỏ (8) TƯƠNG ĐỐI so với cổ tay (0),
 *   nhờ vậy đưa tay uống nước, chống cằm, gãi đầu không bị báo nhầm là đang lướt.
 * - Yêu cầu tối thiểu `scrollMinFlickCount` nhịp vuốt trong cửa sổ `scrollWindowMs`
 *   nên hành động lật 1 trang sách/vở không bị bắt nhầm.
 */
export class HandScrollDetector {
  private readonly thresholds: StudyFocusThresholds;
  private samples: FingerSample[] = [];

  constructor(thresholds: StudyFocusThresholds = STUDY_FOCUS_THRESHOLDS) {
    this.thresholds = thresholds;
  }

  public reset(): void {
    this.samples = [];
  }

  public processHands(
    hands: HandLandmarkPoint[][] | null | undefined,
    nowMs: number
  ): HandScrollSnapshot {
    // Dọn các mẫu quá cửa sổ thời gian
    const cutoff = nowMs - this.thresholds.scrollWindowMs;
    this.samples = this.samples.filter((s) => s.timestampMs >= cutoff);

    if (!hands || hands.length === 0) {
      return {
        hasHands: false,
        isScrolling: false,
        flickCount: 0,
        dominantAxis: "none",
      };
    }

    // Lấy bàn tay chính (ưu tiên bàn tay đầu tiên có đủ khớp cổ tay, ngón cái, ngón trỏ)
    const primaryHand = hands.find((h) => h[0] && h[4] && h[8]);
    if (!primaryHand) {
      return {
        hasHands: true,
        isScrolling: false,
        flickCount: 0,
        dominantAxis: "none",
      };
    }

    const wrist = primaryHand[0];
    const thumbTip = primaryHand[4];
    const indexTip = primaryHand[8];

    this.samples.push({
      timestampMs: nowMs,
      relThumbX: thumbTip.x - wrist.x,
      relThumbY: thumbTip.y - wrist.y,
      relIndexX: indexTip.x - wrist.x,
      relIndexY: indexTip.y - wrist.y,
      wristX: wrist.x,
      wristY: wrist.y,
    });

    if (this.samples.length < 4) {
      return {
        hasHands: true,
        isScrolling: false,
        flickCount: 0,
        dominantAxis: "none",
      };
    }

    // Kiểm tra cổ tay có bị di chuyển quá mạnh không (nếu vẫy tay/lấy đồ thì bỏ qua)
    const first = this.samples[0];
    const last = this.samples[this.samples.length - 1];
    const wristDrift = Math.hypot(
      last.wristX - first.wristX,
      last.wristY - first.wristY
    );
    if (wristDrift > 0.25) {
      return {
        hasHands: true,
        isScrolling: false,
        flickCount: 0,
        dominantAxis: "none",
      };
    }

    const step = this.thresholds.scrollMinStepDelta;
    const thumbVertFlicks = countRhythmicFlicks(
      this.samples.map((s) => s.relThumbY),
      step
    );
    const indexVertFlicks = countRhythmicFlicks(
      this.samples.map((s) => s.relIndexY),
      step
    );
    const thumbHorizFlicks = countRhythmicFlicks(
      this.samples.map((s) => s.relThumbX),
      step
    );
    const indexHorizFlicks = countRhythmicFlicks(
      this.samples.map((s) => s.relIndexX),
      step
    );

    const bestVertical = Math.max(thumbVertFlicks, indexVertFlicks);
    const bestHorizontal = Math.max(thumbHorizFlicks, indexHorizFlicks);
    const bestFlicks = Math.max(bestVertical, bestHorizontal);

    const isScrolling = bestFlicks >= this.thresholds.scrollMinFlickCount;
    const dominantAxis = !isScrolling
      ? "none"
      : bestVertical >= bestHorizontal
      ? "vertical"
      : "horizontal";

    return {
      hasHands: true,
      isScrolling,
      flickCount: bestFlicks,
      dominantAxis,
    };
  }
}
