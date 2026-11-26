
import type { PoseLandmarker } from "@mediapipe/tasks-vision";
import { FACE_LANDMARKER_ASSETS } from "@/modules/webcam/thresholds";

const MODEL_PATH =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task";

export async function createExercisePoseLandmarker(): Promise<PoseLandmarker> {
  const vision = await import("@mediapipe/tasks-vision");

  const filesetResolver =
    await vision.FilesetResolver.forVisionTasks(
      FACE_LANDMARKER_ASSETS.cdnWasmRoot
    );

  const createLandmarker = (delegate: "GPU" | "CPU") => {
    return vision.PoseLandmarker.createFromOptions(
      filesetResolver,
      {
        baseOptions: {
          modelAssetPath: MODEL_PATH,
          delegate,
        },
        runningMode: "VIDEO",
        numPoses: 1,
        minPoseDetectionConfidence: 0.5,
        minPosePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
        outputSegmentationMasks: false,
      }
    );
  };

  try {
    return await createLandmarker("GPU");
  } catch {
    return await createLandmarker("CPU");
  }
}
