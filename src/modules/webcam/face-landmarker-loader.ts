import type { FaceLandmarker } from "@mediapipe/tasks-vision";
import { FACE_LANDMARKER_ASSETS } from "@/modules/webcam/thresholds";

export type ModelLoadSource = "local" | "cdn";

export interface LoadedFaceLandmarker {
  landmarker: FaceLandmarker;
  source: ModelLoadSource;
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
