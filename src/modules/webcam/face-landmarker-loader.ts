import type {
  FaceLandmarker,
  HandLandmarker,
  ObjectDetector,
} from "@mediapipe/tasks-vision";
import {
  FACE_LANDMARKER_ASSETS,
  HAND_LANDMARKER_ASSETS,
  OBJECT_DETECTOR_ASSETS,
  STUDY_FOCUS_THRESHOLDS,
} from "@/modules/webcam/thresholds";

export type ModelLoadSource = "local" | "cdn";

export interface LoadedFaceLandmarker {
  landmarker: FaceLandmarker;
  source: ModelLoadSource;
}

export interface LoadedStudyVisionModels {
  faceLandmarker: FaceLandmarker;
  objectDetector: ObjectDetector | null;
  handLandmarker: HandLandmarker | null;
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
 * Nhận diện các dòng log INFO/WARNING vô hại do MediaPipe/TFLite WASM đẩy ra stderr
 * (bị Next.js Dev Overlay hiểu nhầm thành lỗi đỏ khi đi qua console.error).
 */
export function isBenignMediaPipeStderr(args: unknown[]): boolean {
  const text = args
    .map((arg) => (typeof arg === "string" ? arg : String(arg ?? "")))
    .join(" ");
  return (
    /^\s*INFO:\s*Created TensorFlow Lite XNNPACK delegate/i.test(text) ||
    /^\s*INFO:\s*Replacing \d+ node/i.test(text) ||
    /^\s*W\d{4}\s+.*(landmark_projection_calculator|feedback_manager|gl_context|inference_feedback|palm_detection|ssd_anchors)/i.test(
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

  const laptopCam = validDevices.find(
    (d) =>
      PHYSICAL_LAPTOP_CAMERA_PATTERN.test(d.label) &&
      !VIRTUAL_OR_PHONE_CAMERA_PATTERN.test(d.label)
  );
  if (laptopCam) return laptopCam.deviceId;

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

async function resolveWasmRoot(): Promise<string> {
  const hasLocalWasm = await isLocalAssetAvailable(
    `${FACE_LANDMARKER_ASSETS.localWasmRoot}/vision_wasm_internal.js`
  );
  return hasLocalWasm
    ? FACE_LANDMARKER_ASSETS.localWasmRoot
    : FACE_LANDMARKER_ASSETS.cdnWasmRoot;
}

/**
 * Khởi tạo MediaPipe FaceLandmarker với cơ chế ưu tiên file cục bộ (public/models/)
 * và tự động dự phòng sang CDN nếu thiếu tệp cục bộ hoặc lỗi GPU.
 */
export async function createStudyFaceLandmarker(): Promise<LoadedFaceLandmarker> {
  const vision = await import("@mediapipe/tasks-vision");

  const [hasLocalModel, wasmRoot] = await Promise.all([
    isLocalAssetAvailable(FACE_LANDMARKER_ASSETS.localModelPath),
    resolveWasmRoot(),
  ]);

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

  try {
    const landmarker = await createWithPaths(wasmRoot, modelPath, "GPU");
    return { landmarker, source };
  } catch {
    try {
      const landmarker = await createWithPaths(wasmRoot, modelPath, "CPU");
      return { landmarker, source };
    } catch {
      const landmarker = await createWithPaths(
        FACE_LANDMARKER_ASSETS.cdnWasmRoot,
        FACE_LANDMARKER_ASSETS.cdnModelPath,
        "CPU"
      );
      return { landmarker, source: "cdn" };
    }
  }
}

/**
 * Khởi tạo ObjectDetector (EfficientDet-Lite0) nhận diện điện thoại & iPad/màn hình phụ.
 * Trả về null an toàn nếu thiết bị yếu không nạp được (không làm ảnh hưởng FaceLandmarker).
 */
export async function createStudyObjectDetector(): Promise<ObjectDetector | null> {
  try {
    const vision = await import("@mediapipe/tasks-vision");
    const [hasLocalModel, wasmRoot] = await Promise.all([
      isLocalAssetAvailable(OBJECT_DETECTOR_ASSETS.localModelPath),
      resolveWasmRoot(),
    ]);
    const modelPath = hasLocalModel
      ? OBJECT_DETECTOR_ASSETS.localModelPath
      : OBJECT_DETECTOR_ASSETS.cdnModelPath;

    const createWithPaths = async (
      resolvedWasmRoot: string,
      resolvedModelPath: string,
      delegate: "GPU" | "CPU"
    ): Promise<ObjectDetector> => {
      return runAsyncWithFilteredMediaPipeLogs(async () => {
        const filesetResolver = await vision.FilesetResolver.forVisionTasks(
          resolvedWasmRoot
        );
        return vision.ObjectDetector.createFromOptions(filesetResolver, {
          baseOptions: {
            modelAssetPath: resolvedModelPath,
            delegate,
          },
          runningMode: "VIDEO",
          scoreThreshold: Math.min(
            STUDY_FOCUS_THRESHOLDS.phoneConfidenceThreshold,
            STUDY_FOCUS_THRESHOLDS.tabletScreenConfidenceThreshold
          ),
          maxResults: 5,
          categoryAllowlist: ["cell phone", "tv", "laptop"],
        });
      });
    };

    try {
      return await createWithPaths(wasmRoot, modelPath, "GPU");
    } catch {
      try {
        return await createWithPaths(wasmRoot, modelPath, "CPU");
      } catch {
        return await createWithPaths(
          FACE_LANDMARKER_ASSETS.cdnWasmRoot,
          OBJECT_DETECTOR_ASSETS.cdnModelPath,
          "CPU"
        );
      }
    }
  } catch {
    return null;
  }
}

/**
 * Khởi tạo HandLandmarker (21 điểm bàn tay) để nhận diện cử chỉ lướt điện thoại/iPad.
 * Trả về null an toàn nếu không nạp được.
 */
export async function createStudyHandLandmarker(): Promise<HandLandmarker | null> {
  try {
    const vision = await import("@mediapipe/tasks-vision");
    const [hasLocalModel, wasmRoot] = await Promise.all([
      isLocalAssetAvailable(HAND_LANDMARKER_ASSETS.localModelPath),
      resolveWasmRoot(),
    ]);
    const modelPath = hasLocalModel
      ? HAND_LANDMARKER_ASSETS.localModelPath
      : HAND_LANDMARKER_ASSETS.cdnModelPath;

    const createWithPaths = async (
      resolvedWasmRoot: string,
      resolvedModelPath: string,
      delegate: "GPU" | "CPU"
    ): Promise<HandLandmarker> => {
      return runAsyncWithFilteredMediaPipeLogs(async () => {
        const filesetResolver = await vision.FilesetResolver.forVisionTasks(
          resolvedWasmRoot
        );
        return vision.HandLandmarker.createFromOptions(filesetResolver, {
          baseOptions: {
            modelAssetPath: resolvedModelPath,
            delegate,
          },
          runningMode: "VIDEO",
          numHands: 2,
          minHandDetectionConfidence: 0.45,
          minHandPresenceConfidence: 0.45,
          minTrackingConfidence: 0.45,
        });
      });
    };

    try {
      return await createWithPaths(wasmRoot, modelPath, "GPU");
    } catch {
      try {
        return await createWithPaths(wasmRoot, modelPath, "CPU");
      } catch {
        return await createWithPaths(
          FACE_LANDMARKER_ASSETS.cdnWasmRoot,
          HAND_LANDMARKER_ASSETS.cdnModelPath,
          "CPU"
        );
      }
    }
  } catch {
    return null;
  }
}

/**
 * Nạp đồng thời bộ 3 mô hình cho Tab Giám sát Học tập:
 * FaceLandmarker (bắt buộc) + ObjectDetector (ĐT/iPad) + HandLandmarker (lướt tay).
 */
export async function createStudyVisionBundle(): Promise<LoadedStudyVisionModels> {
  const [faceResult, objectDetector, handLandmarker] = await Promise.all([
    createStudyFaceLandmarker(),
    createStudyObjectDetector(),
    createStudyHandLandmarker(),
  ]);

  return {
    faceLandmarker: faceResult.landmarker,
    objectDetector,
    handLandmarker,
    source: faceResult.source,
  };
}
