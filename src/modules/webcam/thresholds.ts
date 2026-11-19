/**
 * Cấu hình ngưỡng nhận diện cho Tab 1: Giám sát Ngồi học & Tập trung (MediaPipe FaceLandmarker).
 * Nhóm có thể tinh chỉnh trực tiếp các thông số tại đây mà không cần sửa giao diện.
 */

export interface StudyFocusThresholds {
  /** Ngưỡng điểm nhắm mắt (0..1) từ MediaPipe blendshapes (eyeBlinkLeft / eyeBlinkRight) */
  eyeBlinkScoreThreshold: number;
  /** Ngưỡng dự phòng tỷ lệ mở mắt EAR (Eye Aspect Ratio) nếu không có blendshapes */
  eyeAspectRatioThreshold: number;
  /** Thời gian nhắm mắt hoặc gục đầu liên tục (ms) trước khi báo buồn ngủ */
  drowsyDurationMs: number;
  /** Thời gian giãn cách giữa 2 lần cộng dồn cảnh báo buồn ngủ (ms) */
  drowsyCooldownMs: number;
  /** Góc cúi đầu xuống (độ, pitch dương) để nhận diện tư thế gục đầu */
  headPitchDownThresholdDeg: number;
  /** Góc quay mặt trái/phải (độ, |yaw|) để coi là quay đi mất tập trung */
  headYawDistractionDeg: number;
  /** Góc ngẩng/cúi đầu quá lớn (độ, |pitch|) để coi là không nhìn vào bài học */
  headPitchDistractionDeg: number;
  /** Thời gian quay mặt đi liên tục (ms) trước khi tính là 1 lần xao nhãng */
  distractionDurationMs: number;
  /** Thời gian không thấy khuôn mặt (ms) trước khi báo vắng mặt & tính 1 lần xao nhãng */
  absenceDurationMs: number;
  /** Thời gian giãn cách giữa 2 lần cộng dồn số lần xao nhãng (ms) */
  distractionCooldownMs: number;
  /** Chu kỳ phân tích khung hình webcam (ms) — 120ms ~ 8 FPS để nhẹ CPU laptop */
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
  drowsyDurationMs: 1800,
  drowsyCooldownMs: 6000,
  headPitchDownThresholdDeg: 22,
  headYawDistractionDeg: 28,
  headPitchDistractionDeg: 32,
  distractionDurationMs: 3000,
  absenceDurationMs: 4000,
  distractionCooldownMs: 5000,
  detectionIntervalMs: 120,
  maxFrameDeltaMs: 1000,
  alertAudioFrequencyHz: 520,
  alertAudioDurationMs: 220,
};

export const FACE_LANDMARKER_ASSETS = {
  /** Đường dẫn mô hình nội bộ trong public/models/ (ưu tiên tải trước, không cần mạng) */
  localModelPath: "/models/face_landmarker.task",
  /** Đường dẫn mô hình CDN dự phòng nếu thiếu file nội bộ */
  cdnModelPath:
    "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
  /** Đường dẫn bộ WASM nội bộ trong public/mediapipe/wasm */
  localWasmRoot: "/mediapipe/wasm",
  /** Đường dẫn bộ WASM CDN dự phòng */
  cdnWasmRoot:
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm",
} as const;
