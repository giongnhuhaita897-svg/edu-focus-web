/**
 * Cấu hình ngưỡng nhận diện cho Tab 1: Giám sát Ngồi học & Tập trung
 * (MediaPipe FaceLandmarker + ObjectDetector Điện thoại/iPad + HandLandmarker Lướt tay).
 * Nhóm có thể tinh chỉnh trực tiếp các thông số tại đây mà không cần sửa giao diện.
 */

export interface StudyFocusThresholds {
  /** Ngưỡng điểm nhắm mắt (0..1) từ MediaPipe blendshapes (eyeBlinkLeft / eyeBlinkRight) */
  eyeBlinkScoreThreshold: number;
  /** Ngưỡng dự phòng tỷ lệ mở mắt EAR (Eye Aspect Ratio) nếu không có blendshapes */
  eyeAspectRatioThreshold: number;
  /** Ngưỡng điểm ánh mắt nhìn xuống (eyeLookDownLeft / eyeLookDownRight) */
  eyeLookDownThreshold: number;
  /** Thời gian nhắm mắt hoặc gục đầu liên tục (ms) trước khi báo buồn ngủ */
  drowsyDurationMs: number;
  /** Thời gian giãn cách giữa 2 lần cộng dồn cảnh báo buồn ngủ (ms) */
  drowsyCooldownMs: number;
  /** Góc cúi đầu xuống (độ, pitch dương) để nhận diện tư thế gục đầu */
  headPitchDownThresholdDeg: number;
  /** Góc cúi đầu nhẹ (độ) khi xem điện thoại dưới bàn hoặc viết vở */
  headPitchLookDownThresholdDeg: number;
  /** Góc quay mặt trái/phải (độ, |yaw|) để coi là quay đi mất tập trung */
  headYawDistractionDeg: number;
  /** Góc ngẩng/cúi đầu quá lớn (độ, |pitch|) để coi là không nhìn vào bài học */
  headPitchDistractionDeg: number;
  /** Thời gian quay mặt đi liên tục (ms) trước khi tính là 1 lần xao nhãng */
  distractionDurationMs: number;
  /** Thời gian nhìn cúi xuống lâu (khi không bật chế độ ghi chép vở) trước khi nhắc */
  lookDownDistractionDurationMs: number;
  /** Thời gian không thấy khuôn mặt (ms) trước khi báo vắng mặt & tính 1 lần xao nhãng */
  absenceDurationMs: number;
  /** Thời gian giãn cách giữa 2 lần cộng dồn số lần xao nhãng (ms) */
  distractionCooldownMs: number;

  // --- Nhận diện Điện thoại / iPad (ObjectDetector) ---
  /** Chu kỳ quét vật thể (ms) — 450ms ~ 2.2 FPS để nhẹ CPU laptop */
  objectDetectionIntervalMs: number;
  /** Ngưỡng độ tin cậy tối thiểu cho vật thể "cell phone" (điện thoại) */
  phoneConfidenceThreshold: number;
  /** Ngưỡng độ tin cậy cho "tv" / "laptop" cầm trước mặt (thường là iPad/tablet) */
  tabletScreenConfidenceThreshold: number;
  /** Diện tích tối thiểu (% khung hình) để tránh nhận nhầm TV xa trên tường */
  minTabletBoxAreaRatio: number;
  /** Thời gian cầm/để lộ điện thoại hoặc iPad liên tục (ms) trước khi tính xao nhãng */
  deviceDistractionDurationMs: number;

  // --- Nhận diện Cử động tay lướt điện thoại / iPad (HandLandmarker) ---
  /** Chu kỳ quét bàn tay (ms) — 160ms ~ 6 FPS để bắt kịp nhịp vuốt ngón cái/ngón trỏ */
  handDetectionIntervalMs: number;
  /** Cửa sổ thời gian (ms) phân tích chuỗi động tác lướt lặp lại */
  scrollWindowMs: number;
  /** Biên độ tối thiểu mỗi nhịp vuốt của ngón tay so với cổ tay (tọa độ chuẩn hóa 0..1) */
  scrollMinStepDelta: number;
  /** Số nhịp vuốt lặp lại tối thiểu trong cửa sổ để phân biệt lướt feed với lật 1 trang sách */
  scrollMinFlickCount: number;
  /** Thời gian lướt tay liên tục (ms) trước khi báo xao nhãng */
  scrollingDurationMs: number;

  // --- Vòng lặp & Âm thanh ---
  /** Chu kỳ phân tích khuôn mặt (ms) — 120ms ~ 8 FPS */
  detectionIntervalMs: number;
  /** Giới hạn bước thời gian tối đa mỗi lần cập nhật (ms) để tránh lệch khi chuyển tab */
  maxFrameDeltaMs: number;
  /** Tần số và độ dài âm thanh nhắc nhở nhẹ nhàng (Web Audio API) */
  alertAudioFrequencyHz: number;
  alertAudioDurationMs: number;
}

export const STUDY_FOCUS_THRESHOLDS: StudyFocusThresholds = {
  eyeBlinkScoreThreshold: 0.52,
  eyeAspectRatioThreshold: 0.21,
  eyeLookDownThreshold: 0.55,
  drowsyDurationMs: 1800,
  drowsyCooldownMs: 6000,
  headPitchDownThresholdDeg: 22,
  headPitchLookDownThresholdDeg: 12,
  headYawDistractionDeg: 28,
  headPitchDistractionDeg: 32,
  distractionDurationMs: 3000,
  lookDownDistractionDurationMs: 4500,
  absenceDurationMs: 4000,
  distractionCooldownMs: 5000,

  objectDetectionIntervalMs: 450,
  phoneConfidenceThreshold: 0.38,
  tabletScreenConfidenceThreshold: 0.52,
  minTabletBoxAreaRatio: 0.03,
  deviceDistractionDurationMs: 2200,

  handDetectionIntervalMs: 160,
  scrollWindowMs: 2400,
  scrollMinStepDelta: 0.024,
  scrollMinFlickCount: 3,
  scrollingDurationMs: 2800,

  detectionIntervalMs: 120,
  maxFrameDeltaMs: 1000,
  alertAudioFrequencyHz: 520,
  alertAudioDurationMs: 220,
};

export const FACE_LANDMARKER_ASSETS = {
  /** Đường dẫn mô hình khuôn mặt nội bộ trong public/models/ */
  localModelPath: "/models/face_landmarker.task",
  /** Đường dẫn mô hình khuôn mặt CDN dự phòng */
  cdnModelPath:
    "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
  /** Đường dẫn bộ WASM nội bộ trong public/mediapipe/wasm */
  localWasmRoot: "/mediapipe/wasm",
  /** Đường dẫn bộ WASM CDN dự phòng */
  cdnWasmRoot:
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm",
} as const;

export const OBJECT_DETECTOR_ASSETS = {
  /** Mô hình EfficientDet-Lite0 nhận diện điện thoại & màn hình phụ/iPad */
  localModelPath: "/models/efficientdet_lite0.tflite",
  cdnModelPath:
    "https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float16/1/efficientdet_lite0.tflite",
} as const;

export const HAND_LANDMARKER_ASSETS = {
  /** Mô hình HandLandmarker 21 điểm khớp bàn tay để nhận diện cử chỉ lướt */
  localModelPath: "/models/hand_landmarker.task",
  cdnModelPath:
    "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
} as const;
