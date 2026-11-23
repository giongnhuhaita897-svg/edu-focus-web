"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import type { PoseLandmarker } from "@mediapipe/tasks-vision";
import { Camera, CameraOff, Loader2 } from "lucide-react";
import type { ExerciseType } from "@/types/database";
import type { CameraPrivacyMode } from "@/modules/webcam/face-canvas-renderer";
import {
  countExerciseRep,
  initialRepCounterState,
  type PosePoint,
} from "@/modules/webcam/exercise-engine";
import {
  pickPreferredCameraDeviceId,
  PREFERRED_CAMERA_STORAGE_KEY,
} from "@/modules/webcam/face-landmarker-loader";

interface Props {
  exercise: ExerciseType;
  active: boolean;
  privacyMode: CameraPrivacyMode;
  onRep: () => void;
}

const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";
const WASM_URL = "/mediapipe/wasm";
const CDN_WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.3/wasm";
const CONNECTIONS: readonly [number, number][] = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
  [11, 23], [12, 24], [23, 24], [23, 25], [25, 27],
  [24, 26], [26, 28],
];

export function ExerciseCameraPanel({ exercise, active, privacyMode, onRep }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const landmarkerRef = useRef<PoseLandmarker | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastFrameRef = useRef(0);
  const lastTimestampRef = useRef(0);
  const counterRef = useRef(initialRepCounterState());
  const onRepRef = useRef(onRep);
  const exerciseRef = useRef(exercise);
  const activeRef = useRef(active);
  const privacyRef = useRef(privacyMode);
  const runningRef = useRef(false);
  const mountRef = useRef(true);
  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("Camera not started");

  useEffect(() => { onRepRef.current = onRep; }, [onRep]);
  useEffect(() => { activeRef.current = active; }, [active]);
  useEffect(() => { exerciseRef.current = exercise; }, [exercise]);
  useEffect(() => { privacyRef.current = privacyMode; }, [privacyMode]);
  useEffect(() => { counterRef.current = initialRepCounterState(); }, [exercise]);

  const stop = useCallback(() => {
    runningRef.current = false;
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    if (mountRef.current) {
      setRunning(false);
      setLoading(false);
      setStatus("Camera stopped");
    }
  }, []);

  useEffect(() => {
    mountRef.current = true;
    return () => {
      mountRef.current = false;
      stop();
      landmarkerRef.current?.close();
      landmarkerRef.current = null;
    };
  }, [stop]);

  useEffect(() => {
    if (!active) stop();
  }, [active, stop]);

  const draw = (points: PosePoint[], width: number, height: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    if (privacyRef.current === "minimal") return;
    ctx.strokeStyle = "#6ee7b7";
    ctx.fillStyle = "#6ee7b7";
    ctx.lineWidth = 3;
    // Coordinate system is mirrored by CSS on canvas and video consistently.
    for (const [a, b] of CONNECTIONS) {
      const p = points[a];
      const q = points[b];
      if (!p || !q || (p.visibility ?? 1) < 0.45 || (q.visibility ?? 1) < 0.45) continue;
      ctx.beginPath();
      ctx.moveTo(p.x * width, p.y * height);
      ctx.lineTo(q.x * width, q.y * height);
      ctx.stroke();
    }
    for (const i of [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]) {
      const p = points[i];
      if (!p || (p.visibility ?? 1) < 0.45) continue;
      ctx.beginPath();
      ctx.arc(p.x * width, p.y * height, 4, 0, 2 * Math.PI);
      ctx.fill();
    }
  };

  const detectLoop = () => {
    const step = (now: number) => {
      if (!runningRef.current) return;
      const video = videoRef.current;
      const model = landmarkerRef.current;
      if (video && model && video.readyState >= 2 && video.videoWidth && now - lastFrameRef.current > 120) {
        lastFrameRef.current = now;
        const timestamp = Math.max(Math.round(now), lastTimestampRef.current + 1);
        lastTimestampRef.current = timestamp;
        try {
          const result = model.detectForVideo(video, timestamp);
          const points = result.landmarks?.[0] as PosePoint[] | undefined;
          if (points) {
            draw(points, video.videoWidth, video.videoHeight);
            const next = countExerciseRep(exerciseRef.current, points, counterRef.current, now);
            counterRef.current = next.state;
            if (next.counted) onRepRef.current();
            setStatus(next.message);
          } else {
            const canvas = canvasRef.current;
            canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
            counterRef.current = { ...counterRef.current, stableFrames: 0 };
            setStatus("No person detected. Move into the frame.");
          }
        } catch {
          setStatus("Waiting for a clear frame...");
        }
      }
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
  };

  const start = async () => {
    if (runningRef.current || loading) return;
    setError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("This browser does not support camera access. Use localhost or HTTPS.");
      return;
    }
    setLoading(true);
    try {
      // Request camera access from the button click before awaiting model downloads.
      const devices = await navigator.mediaDevices.enumerateDevices();
      let savedId: string | null = null;
      try { savedId = window.localStorage.getItem(PREFERRED_CAMERA_STORAGE_KEY); } catch { /* ignore */ }
      const preferredId = pickPreferredCameraDeviceId(
        devices.filter(d => d.kind === "videoinput").map(d => ({ deviceId: d.deviceId, label: d.label })),
        savedId
      );
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: preferredId ? { deviceId: { exact: preferredId }, width: { ideal: 640 }, height: { ideal: 360 } } : { width: { ideal: 640 }, height: { ideal: 360 } },
          audio: false,
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }
      if (!mountRef.current || !activeRef.current) {
        stream.getTracks().forEach(t => t.stop());
        return;
      }
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) throw new Error("Camera video element was not available.");
      video.srcObject = stream;
      await video.play();
      setStatus("Camera ready. Loading pose model...");
      const { FilesetResolver, PoseLandmarker } = await import("@mediapipe/tasks-vision");
      if (!landmarkerRef.current) {
        const models = await (async () => {
          try {
            return await FilesetResolver.forVisionTasks(WASM_URL);
          } catch {
            return FilesetResolver.forVisionTasks(CDN_WASM_URL);
          }
        })();
        // First use needs an internet connection to download the pose model.
        landmarkerRef.current = await PoseLandmarker.createFromOptions(models, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: "CPU" },
          runningMode: "VIDEO",
          numPoses: 1,
          minPoseDetectionConfidence: 0.55,
          minTrackingConfidence: 0.5,
        });
      }
      if (!mountRef.current || !activeRef.current) {
        stop();
        return;
      }
      counterRef.current = initialRepCounterState();
      lastFrameRef.current = 0;
      lastTimestampRef.current = 0;
      runningRef.current = true;
      setRunning(true);
      setStatus("Pose model ready. Move into the camera frame.");
      detectLoop();
    } catch (e) {
      stop();
      const message = e instanceof Error ? e.message : String(e);
      setError(`Unable to start exercise camera: ${message}`);
    } finally {
      if (mountRef.current) setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-slate-950 border border-slate-700">
        <video
          ref={videoRef}
          muted
          playsInline
          className={`absolute inset-0 w-full h-full object-cover -scale-x-100 ${running && privacyMode === "standard" ? "opacity-100" : "opacity-0"}`}
        />
        <canvas
          ref={canvasRef}
          className={`absolute inset-0 w-full h-full object-cover -scale-x-100 ${running && privacyMode !== "minimal" ? "opacity-100" : "opacity-0"}`}
        />
        {!running && (
          <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-slate-300">
            {loading ? "Loading pose model and starting camera..." : "Start exercise camera to track your movement."}
          </div>
        )}
      </div>
      <p role="status" aria-live="polite" className="text-xs text-edtech-muted">{status}</p>
      {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
      <button
        type="button"
        disabled={loading}
        onClick={running ? stop : start}
        className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 ${running ? "bg-red-600" : "bg-emerald-600"}`}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : running ? <CameraOff className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
        {loading ? "Loading..." : running ? "Tắt Camera tập thể dục" : "Bật Camera tập thể dục"}
      </button>
    </div>
  );
}
