import type { FaceLandmarker } from "@mediapipe/tasks-vision";
import { FACE_LANDMARKER_ASSETS } from "@/modules/webcam/thresholds";

export type ModelLoadSource = "local" | "cdn";

export interface LoadedFaceLandmarker {
  landmarker: FaceLandmarker;
  source: ModelLoadSource;
}

export interface CameraDeviceOption {
  deviceId: string;
  label: string;
}

export const PREFERRED_CAMERA_STORAGE_KEY = "edu_focus_preferred_camera_id";

const VIRTUAL_OR_PHONE_CAMERA_PATTERN =
  /(phone\s*link|link\s*to\s*windows|windows\s*virtual|galaxy|s2\d|iphone|ipad|continuity|droidcam|iriun|ivcam|epoccam|obs\s*virtual|snap\s*camera|virtual\s*camera)/i;

const PHYSICAL_LAPTOP_CAMERA_PATTERN =
  /(integrated|built-?in|facetime|hd\s*webcam|hd\s*camera|usb|logitech|realtek|chicony|sunplus|hp\s*truevision|lenovo|dell|asus|acer)/i;

/**
 * Nhận diện các dòng log INFO vô hại do MediaPipe/TFLite WASM đẩy ra stderr
 * (bị Next.js Dev Overlay hiểu nhầm thành lỗi đỏ khi đi qua console.error).
 */
export function isBenignMediaPipeStderr(args: unknown[]): boolean {
  const text = args
    .map((arg) => (typeof arg === "string" ? arg : String(arg ?? "")))
    .join(" ");
  return (
    /^\s*INFO:\s*Created TensorFlow Lite XNNPACK delegate/i.test(text) ||
    /^\s*INFO:\s*Replacing \d+ node/i.test(text) ||
    /^\s*W\d{4}\s+.*(landmark_projection_calculator|feedback_manager|gl_context)/i.test(
      text
    )
  );
}

/**
 * Chặn tạm các dòng INFO vô hại của MediaPipe WASM khi gọi đồng bộ (detectForVideo)
 * để không làm bật khung Console Error giả trong Next.js dev mode.
 */
export function runWithFilteredMediaPipeLogs<T>(fn: () => T): T {
  const originalError = console.error;
  console.error = (...args: unknown[]) => {
    if (isBenignMediaPipeStderr(args)) {
      return;
    }
    originalError.apply(console, args);
  };
  try {
    return fn();
  } finally {
    console.error = originalError;
  }
}

/**
 * Chặn tạm các dòng INFO vô hại của MediaPipe WASM khi khởi tạo bất đồng bộ.
 */
export async function runAsyncWithFilteredMediaPipeLogs<T>(
  fn: () => Promise<T>
): Promise<T> {
  const originalError = console.error;
  console.error = (...args: unknown[]) => {
    if (isBenignMediaPipeStderr(args)) {
      return;
    }
    originalError.apply(console, args);
  };
  try {
    return await fn();
  } finally {
    console.error = originalError;
  }
}

/**
 * Tự động chọn camera vật lý của laptop/USB và tránh camera ảo từ điện thoại
 * (ví dụ Samsung Galaxy S23 Ultra qua Windows Phone Link).
 */
export function pickPreferredCameraDeviceId(
  devices: CameraDeviceOption[],
  savedDeviceId?: string | null
): string | undefined {
  const validDevices = devices.filter((d) => Boolean(d.deviceId));
  if (validDevices.length === 0) return undefined;

  if (savedDeviceId && validDevices.some((d) => d.deviceId === savedDeviceId)) {
    return savedDeviceId;
  }

  // 1. Ưu tiên webcam laptop/USB vật lý rõ ràng
  const laptopCam = validDevices.find(
    (d) =>
      PHYSICAL_LAPTOP_CAMERA_PATTERN.test(d.label) &&
      !VIRTUAL_OR_PHONE_CAMERA_PATTERN.test(d.label)
  );
  if (laptopCam) return laptopCam.deviceId;

  // 2. Nếu không khớp tên quen thuộc, chọn thiết bị đầu tiên KHÔNG phải camera ảo/điện thoại
  const nonVirtualCam = validDevices.find(
    (d) => d.label && !VIRTUAL_OR_PHONE_CAMERA_PATTERN.test(d.label)
  );
  if (nonVirtualCam) return nonVirtualCam.deviceId;

  return validDevices[0]?.deviceId;
}

async function isLocalAssetAvailable(url: string): Promise<boolean> {
  if (typeof window === "undefined" || typeof window.fetch !== "function") {
    return false;
  }
  try {
    const res = await window.fetch(url, { method: "HEAD" });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Khởi tạo MediaPipe FaceLandmarker với cơ chế ưu tiên file cục bộ (public/models/)
 * và tự động dự phòng sang CDN nếu thiếu tệp cục bộ hoặc lỗi GPU.
 */
export async function createStudyFaceLandmarker(): Promise<LoadedFaceLandmarker> {
  const vision = await import("@mediapipe/tasks-vision");

  const hasLocalModel = await isLocalAssetAvailable(
    FACE_LANDMARKER_ASSETS.localModelPath
  );
  const hasLocalWasm = await isLocalAssetAvailable(
    `${FACE_LANDMARKER_ASSETS.localWasmRoot}/vision_wasm_internal.js`
  );

  const wasmRoot = hasLocalWasm
    ? FACE_LANDMARKER_ASSETS.localWasmRoot
    : FACE_LANDMARKER_ASSETS.cdnWasmRoot;
  const modelPath = hasLocalModel
    ? FACE_LANDMARKER_ASSETS.localModelPath
    : FACE_LANDMARKER_ASSETS.cdnModelPath;
  const source: ModelLoadSource = hasLocalModel ? "local" : "cdn";

  const createWithPaths = async (
    resolvedWasmRoot: string,
    resolvedModelPath: string,
    delegate: "GPU" | "CPU"
  ): Promise<FaceLandmarker> => {
    return runAsyncWithFilteredMediaPipeLogs(async () => {
      const filesetResolver = await vision.FilesetResolver.forVisionTasks(
        resolvedWasmRoot
      );
      return vision.FaceLandmarker.createFromOptions(filesetResolver, {
        baseOptions: {
          modelAssetPath: resolvedModelPath,
          delegate,
        },
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: false,
        runningMode: "VIDEO",
        numFaces: 1,
      });
    });
  };

  // Thử GPU trước để mượt 30fps, fallback CPU nếu trình duyệt/laptop không hỗ trợ WebGL2 tốt
  try {
    const landmarker = await createWithPaths(wasmRoot, modelPath, "GPU");
    return { landmarker, source };
  } catch {
    try {
      const landmarker = await createWithPaths(wasmRoot, modelPath, "CPU");
      return { landmarker, source };
    } catch {
      // Fallback cuối cùng sang CDN nếu tệp nội bộ gặp sự cố
      const landmarker = await createWithPaths(
        FACE_LANDMARKER_ASSETS.cdnWasmRoot,
        FACE_LANDMARKER_ASSETS.cdnModelPath,
        "CPU"
      );
      return { landmarker, source: "cdn" };
    }
  }
}
