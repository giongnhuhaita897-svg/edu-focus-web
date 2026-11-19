import {
  NormalizedLandmarkPoint,
  StudyFocusStatus,
} from "@/modules/webcam/study-tracker";

export type CameraPrivacyMode = "standard" | "skeleton_only" | "minimal";

// Các đường nét khuôn mặt tối giản (không làm lộ danh tính, chỉ thể hiện hướng đầu & độ mở mắt)
const FACE_OVAL_INDICES = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378,
  400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21,
  54, 103, 67, 109, 10,
];
const LEFT_EYE_INDICES = [33, 160, 158, 133, 153, 144, 33];
const RIGHT_EYE_INDICES = [362, 385, 387, 263, 373, 380, 362];
const NOSE_BRIDGE_INDICES = [168, 6, 197, 195, 5, 4, 1];
const MOUTH_OUTER_INDICES = [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84, 181, 91, 146, 61];

function getStatusStrokeColor(status: StudyFocusStatus): string {
  switch (status) {
    case "focused":
      return "#10B981"; // Xanh lá kỷ luật
    case "distracted":
      return "#F59E0B"; // Vàng cảnh báo
    case "drowsy":
    case "absent":
      return "#EF4444"; // Đỏ cảnh báo
    case "idle":
    default:
      return "#3B82F6"; // Xanh học thuật
  }
}

function drawPolyline(
  ctx: CanvasRenderingContext2D,
  landmarks: NormalizedLandmarkPoint[],
  indices: number[],
  width: number,
  height: number,
  mirrored: boolean
) {
  ctx.beginPath();
  let started = false;
  for (const idx of indices) {
    const pt = landmarks[idx];
    if (!pt) continue;
    const x = (mirrored ? 1 - pt.x : pt.x) * width;
    const y = pt.y * height;
    if (!started) {
      ctx.moveTo(x, y);
      started = true;
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.stroke();
}

/**
 * Vẽ lớp hiển thị lên Canvas theo đúng Chế độ Quyền riêng tư đang bật.
 */
export function renderStudyOverlayCanvas(
  canvas: HTMLCanvasElement,
  landmarks: NormalizedLandmarkPoint[] | undefined,
  status: StudyFocusStatus,
  privacyMode: CameraPrivacyMode
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const { width, height } = canvas;
  ctx.clearRect(0, 0, width, height);

  const accent = getStatusStrokeColor(status);

  if (privacyMode === "minimal") {
    // Nền tối giản hoàn toàn — chỉ hiển thị vòng trạng thái trung tâm
    ctx.fillStyle = "#0F172A";
    ctx.fillRect(0, 0, width, height);

    const cx = width / 2;
    const cy = height / 2;
    const radius = Math.min(width, height) * 0.2;

    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.68, 0, Math.PI * 2);
    ctx.fillStyle = `${accent}22`;
    ctx.fill();
    return;
  }

  if (privacyMode === "skeleton_only") {
    // Chế độ Ẩn mặt: phủ nền tối và chỉ vẽ khung nét hình học tối giản
    ctx.fillStyle = "#0F172A";
    ctx.fillRect(0, 0, width, height);

    // Lưới tọa độ mờ giúp học sinh dễ căn giữa màn hình
    ctx.strokeStyle = "rgba(148, 163, 184, 0.12)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(width / 2, 0);
    ctx.lineTo(width / 2, height);
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();
  }

  if (!landmarks || landmarks.length === 0) return;

  // Vẽ khung nét khuôn mặt tối giản (cả skeleton_only lẫn standard)
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.strokeStyle =
    privacyMode === "skeleton_only" ? accent : `${accent}AA`;
  ctx.lineWidth = privacyMode === "skeleton_only" ? 2.4 : 1.5;

  drawPolyline(ctx, landmarks, FACE_OVAL_INDICES, width, height, true);
  drawPolyline(ctx, landmarks, LEFT_EYE_INDICES, width, height, true);
  drawPolyline(ctx, landmarks, RIGHT_EYE_INDICES, width, height, true);
  drawPolyline(ctx, landmarks, NOSE_BRIDGE_INDICES, width, height, true);

  if (privacyMode === "skeleton_only") {
    ctx.strokeStyle = `${accent}99`;
    ctx.lineWidth = 1.6;
    drawPolyline(ctx, landmarks, MOUTH_OUTER_INDICES, width, height, true);
  }
}

/**
 * Phát âm thanh nhắc nhở nhẹ nhàng bằng Web Audio API (không cần file mp3).
 */
export function playGentleAlertTone(
  frequencyHz: number,
  durationMs: number
): void {
  if (typeof window === "undefined") return;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(frequencyHz, ctx.currentTime);

    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.03);
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      ctx.currentTime + durationMs / 1000
    );

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + durationMs / 1000 + 0.02);
    osc.onended = () => {
      ctx.close().catch(() => {});
    };
  } catch {
    // Bỏ qua nếu trình duyệt chặn autoplay audio
  }
}
