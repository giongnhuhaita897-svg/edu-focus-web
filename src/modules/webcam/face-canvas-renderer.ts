import {
  NormalizedLandmarkPoint,
  StudyFocusStatus,
} from "@/modules/webcam/study-tracker";
import {
  DetectedDistractionDevice,
  HandLandmarkPoint,
} from "@/modules/webcam/distraction-detectors";

export type CameraPrivacyMode = "standard" | "skeleton_only" | "minimal";

export interface StudyOverlayExtras {
  detectedDevices?: DetectedDistractionDevice[];
  hands?: HandLandmarkPoint[][];
  isHandScrolling?: boolean;
}

// Các đường nét khuôn mặt tối giản (không làm lộ danh tính, chỉ thể hiện hướng đầu & độ mở mắt)
const FACE_OVAL_INDICES = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378,
  400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21,
  54, 103, 67, 109, 10,
];
const LEFT_EYE_INDICES = [33, 160, 158, 133, 153, 144, 33];
const RIGHT_EYE_INDICES = [362, 385, 387, 263, 373, 380, 362];
const NOSE_BRIDGE_INDICES = [168, 6, 197, 195, 5, 4, 1];
const MOUTH_OUTER_INDICES = [
  61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84,
  181, 91, 146, 61,
];

// Các đoạn nối khung xương bàn tay tối giản (21 điểm khớp MediaPipe HandLandmarker)
const HAND_BONE_CHAINS: number[][] = [
  [0, 1, 2, 3, 4], // Ngón cái
  [0, 5, 6, 7, 8], // Ngón trỏ
  [0, 9, 10, 11, 12], // Ngón giữa
  [0, 13, 14, 15, 16], // Ngón áp út
  [0, 17, 18, 19, 20], // Ngón út
  [5, 9, 13, 17], // Lòng bàn tay
];

function getStatusStrokeColor(status: StudyFocusStatus): string {
  switch (status) {
    case "focused":
      return "#10B981"; // Xanh lá kỷ luật
    case "distracted":
    case "scrolling_distracted":
      return "#F59E0B"; // Vàng cảnh báo
    case "phone_distracted":
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

function drawDetectedDeviceBoxes(
  ctx: CanvasRenderingContext2D,
  devices: DetectedDistractionDevice[],
  canvasWidth: number,
  mirrored: boolean
) {
  for (const dev of devices) {
    const { originX, originY, width: boxW, height: boxH } = dev.boundingBox;
    const drawX = mirrored ? canvasWidth - (originX + boxW) : originX;
    const drawY = originY;

    ctx.save();
    ctx.strokeStyle = "#EF4444";
    ctx.lineWidth = 2.5;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(drawX, drawY, boxW, boxH);
    ctx.setLineDash([]);

    const pct = Math.round(dev.score * 100);
    const labelText = `${dev.label} (${pct}%)`;
    ctx.font = "bold 12px system-ui, -apple-system, sans-serif";
    const textWidth = ctx.measureText(labelText).width;
    const pillW = textWidth + 14;
    const pillH = 22;
    const pillY = Math.max(4, drawY - pillH - 4);

    ctx.fillStyle = "rgba(239, 68, 68, 0.92)";
    ctx.beginPath();
    ctx.roundRect(drawX, pillY, pillW, pillH, 6);
    ctx.fill();

    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(labelText, drawX + 7, pillY + 15);
    ctx.restore();
  }
}

function drawHandsOverlay(
  ctx: CanvasRenderingContext2D,
  hands: HandLandmarkPoint[][],
  width: number,
  height: number,
  isScrolling: boolean,
  privacyMode: CameraPrivacyMode
) {
  const strokeColor = isScrolling
    ? "#F59E0B"
    : privacyMode === "skeleton_only"
    ? "rgba(56, 189, 248, 0.8)"
    : "rgba(56, 189, 248, 0.45)";

  ctx.save();
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = isScrolling ? 2.4 : 1.5;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  for (const hand of hands) {
    for (const chain of HAND_BONE_CHAINS) {
      drawPolyline(ctx, hand, chain, width, height, true);
    }

    // Đánh dấu đầu ngón cái (4) & ngón trỏ (8) khi phát hiện động tác lướt
    if (isScrolling) {
      for (const tipIdx of [4, 8]) {
        const pt = hand[tipIdx];
        if (!pt) continue;
        const x = (1 - pt.x) * width;
        const y = pt.y * height;
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fillStyle = "#F59E0B";
        ctx.fill();
      }
    }
  }
  ctx.restore();
}

/**
 * Vẽ lớp hiển thị lên Canvas theo đúng Chế độ Quyền riêng tư đang bật.
 */
export function renderStudyOverlayCanvas(
  canvas: HTMLCanvasElement,
  landmarks: NormalizedLandmarkPoint[] | undefined,
  status: StudyFocusStatus,
  privacyMode: CameraPrivacyMode,
  extras?: StudyOverlayExtras
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const { width, height } = canvas;
  ctx.clearRect(0, 0, width, height);

  const accent = getStatusStrokeColor(status);

  if (privacyMode === "minimal") {
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
    ctx.fillStyle = "#0F172A";
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = "rgba(148, 163, 184, 0.12)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(width / 2, 0);
    ctx.lineTo(width / 2, height);
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();
  }

  if (landmarks && landmarks.length > 0) {
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

  // Vẽ khung xương bàn tay (giúp thấy rõ khi hệ thống nhận diện động tác lướt)
  if (extras?.hands && extras.hands.length > 0) {
    drawHandsOverlay(
      ctx,
      extras.hands,
      width,
      height,
      Boolean(extras.isHandScrolling),
      privacyMode
    );
  }

  // Vẽ khung khoanh vùng Điện thoại / iPad (chính xác theo hướng lật gương)
  if (extras?.detectedDevices && extras.detectedDevices.length > 0) {
    drawDetectedDeviceBoxes(ctx, extras.detectedDevices, width, true);
  }
}

/**
 * Phát chuỗi 3 tiếng "típ típ típ" bằng Web Audio API (dự phòng khi file mp3 không phát được).
 */
export function playSynthesizedTipTipTip(
  frequencyHz = 2400,
  beepDurationMs = 95,
  bursts = 1
): void {
  if (typeof window === "undefined") return;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const beepSec = beepDurationMs / 1000;
    const gapSec = 0.085;
    const burstGapSec = 0.28;
    const beepsPerBurst = 3;
    const now = ctx.currentTime;

    let endTime = now;
    for (let b = 0; b < Math.max(1, bursts); b++) {
      const burstStart = now + b * (beepsPerBurst * (beepSec + gapSec) + burstGapSec);
      for (let i = 0; i < beepsPerBurst; i++) {
        const start = burstStart + i * (beepSec + gapSec);
        const stop = start + beepSec;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(frequencyHz, start);

        gain.gain.setValueAtTime(0.001, start);
        gain.gain.exponentialRampToValueAtTime(0.16, start + 0.012);
        gain.gain.setValueAtTime(0.16, Math.max(start + 0.015, stop - 0.018));
        gain.gain.exponentialRampToValueAtTime(0.001, stop);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(stop + 0.01);
        endTime = Math.max(endTime, stop + 0.05);
      }
    }

    window.setTimeout(() => {
      ctx.close().catch(() => {});
    }, Math.ceil((endTime - now + 0.1) * 1000));
  } catch {
    // Bỏ qua nếu trình duyệt chặn autoplay audio
  }
}

/**
 * Phát âm thanh cảnh báo "típ típ típ" từ tệp MP3 nội bộ (/sounds/tip-tip-tip.mp3).
 * Tự động dự phòng sang Web Audio API nếu trình duyệt không phát được tệp MP3.
 */
export function playTipTipTipAlert(
  audioPath = "/sounds/tip-tip-tip.mp3",
  repeatCount = 1
): void {
  if (typeof window === "undefined") return;
  const safeRepeats = Math.max(1, Math.min(3, Math.round(repeatCount)));

  const isJsdom =
    typeof navigator !== "undefined" &&
    /jsdom/i.test(navigator.userAgent ?? "");

  if (typeof window.Audio !== "function" || isJsdom) {
    playSynthesizedTipTipTip(2400, 95, safeRepeats);
    return;
  }

  try {
    const audio = new window.Audio(audioPath);
    audio.volume = 0.85;
    let played = 1;

    audio.onended = () => {
      if (played < safeRepeats) {
        played += 1;
        audio.currentTime = 0;
        audio.play().catch(() => {
          playSynthesizedTipTipTip(2400, 95, 1);
        });
      }
    };

    const playPromise = audio.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(() => {
        playSynthesizedTipTipTip(2400, 95, safeRepeats);
      });
    }
  } catch {
    playSynthesizedTipTipTip(2400, 95, safeRepeats);
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
