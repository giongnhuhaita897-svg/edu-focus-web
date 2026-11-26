
"use client";

import { useEffect, useRef, useState } from "react";
import type { PoseLandmarker } from "@mediapipe/tasks-vision";
import { createExercisePoseLandmarker } from "./pose-landmarker-loader";
import {
  createExerciseState,
  evaluateExercise,
  type ExerciseId,
} from "./exercise-engine";

interface ExerciseCameraPanelProps {
  exercise: ExerciseId;
  onRepsChange: (reps: number) => void;
  active: boolean;
  showVideo?: boolean;
}

const CONNECTIONS = [
  [11, 12],
  [11, 13],
  [13, 15],
  [12, 14],
  [14, 16],
  [11, 23],
  [12, 24],
  [23, 24],
  [23, 25],
  [25, 27],
  [24, 26],
  [26, 28],
  [27, 31],
  [28, 32],
];

export function ExerciseCameraPanel({
  exercise,
  onRepsChange,
  active,
  showVideo = false,
}: ExerciseCameraPanelProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const modelRef = useRef<PoseLandmarker | null>(null);
  const frameRef = useRef<number>(0);
  const generationRef = useRef(0);

  const engineRef = useRef(createExerciseState());
  const exerciseRef = useRef(exercise);
  const callbackRef = useRef(onRepsChange);

  const [status, setStatus] = useState<
    "idle" | "loading" | "running" | "error"
  >("idle");

  const [reps, setReps] = useState(0);
  const [feedback, setFeedback] = useState("Ready");
  const [error, setError] = useState("");

  useEffect(() => {
    callbackRef.current = onRepsChange;
  }, [onRepsChange]);

  useEffect(() => {
    exerciseRef.current = exercise;
    engineRef.current = createExerciseState();
    setReps(0);
    setFeedback("Ready");
    callbackRef.current(0);
  }, [exercise]);

  const releaseResources = () => {
    generationRef.current += 1;

    cancelAnimationFrame(frameRef.current);

    streamRef.current?.getTracks().forEach((track) => {
      track.stop();
    });

    streamRef.current = null;

    modelRef.current?.close();
    modelRef.current = null;

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    const canvas = canvasRef.current;

    if (canvas) {
      canvas.getContext("2d")?.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
      );
    }
  };

  useEffect(() => {
    if (!active) {
      releaseResources();
      setStatus("idle");
    }

    return () => {
      releaseResources();
    };
  }, [active]);

  const stopCamera = () => {
    releaseResources();
    setStatus("idle");
    setFeedback("Camera stopped");
  };

  const resetCounter = () => {
    engineRef.current = createExerciseState();
    setReps(0);
    setFeedback("Ready");
    callbackRef.current(0);
  };

  const startCamera = async () => {
    if (!active || status === "loading" || status === "running") {
      return;
    }

    const generation = ++generationRef.current;

    setStatus("loading");
    setError("");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user",
        },
        audio: false,
      });

      if (generation !== generationRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      streamRef.current = stream;

      const video = videoRef.current;

      if (!video) {
        throw new Error("Video element unavailable");
      }

      video.srcObject = stream;
      await video.play();

      if (generation !== generationRef.current) return;

      const model = await createExercisePoseLandmarker();

      if (generation !== generationRef.current) {
        model.close();
        return;
      }

      modelRef.current = model;
      setStatus("running");

      let lastVideoTime = -1;

      const detect = () => {
        if (generation !== generationRef.current) return;

        const canvas = canvasRef.current;

        if (!canvas || !modelRef.current) return;

        const ctx = canvas.getContext("2d");

        if (!ctx) return;

        try {
          if (
            video.readyState >= 2 &&
            video.currentTime !== lastVideoTime
          ) {
            lastVideoTime = video.currentTime;

            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;

            const result = model.detectForVideo(
              video,
              performance.now()
            );

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            const landmarks = result.landmarks[0] ?? [];

            const next = evaluateExercise(
              exerciseRef.current,
              landmarks,
              engineRef.current
            );

            if (next.reps !== engineRef.current.reps) {
              setReps(next.reps);
              callbackRef.current(next.reps);
            }

            engineRef.current = next;
            setFeedback(next.feedback);

            ctx.strokeStyle = "#6ee7b7";
            ctx.lineWidth = 3;

            for (const [a, b] of CONNECTIONS) {
              const first = landmarks[a];
              const second = landmarks[b];

              if (!first || !second) continue;

              if (
                first.visibility < 0.6 ||
                second.visibility < 0.6
              ) {
                continue;
              }

              ctx.beginPath();
              ctx.moveTo(
                first.x * canvas.width,
                first.y * canvas.height
              );
              ctx.lineTo(
                second.x * canvas.width,
                second.y * canvas.height
              );
              ctx.stroke();
            }

            ctx.fillStyle = "#ffffff";

            for (const point of landmarks) {
              if (point.visibility < 0.6) continue;

              ctx.beginPath();
              ctx.arc(
                point.x * canvas.width,
                point.y * canvas.height,
                4,
                0,
                Math.PI * 2
              );
              ctx.fill();
            }
          }

          frameRef.current = requestAnimationFrame(detect);
        } catch (err) {
          releaseResources();
          setStatus("error");
          setError(
            err instanceof Error
              ? err.message
              : "Pose detection failed"
          );
        }
      };

      frameRef.current = requestAnimationFrame(detect);
    } catch (err) {
      if (generation !== generationRef.current) return;

      releaseResources();
      setStatus("error");

      setError(
        err instanceof Error
          ? err.message
          : "Unable to start camera"
      );
    }
  };

  return (
    <div className="space-y-4">
      <div className="relative aspect-video overflow-hidden rounded-xl bg-slate-900">
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className={`absolute inset-0 h-full w-full object-contain ${
            showVideo ? "opacity-100" : "opacity-0"
          }`}
          style={{ transform: "scaleX(-1)" }}
        />

        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full object-contain"
          style={{ transform: "scaleX(-1)" }}
        />

        {status !== "running" && (
          <div className="absolute inset-0 flex items-center justify-center text-white">
            {status === "loading"
              ? "Loading camera and pose model..."
              : "Camera is off"}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-slate-100 p-3 text-center">
          <p className="text-xs text-slate-500">
            Repetitions
          </p>
          <p className="text-2xl font-bold text-emerald-600">
            {reps}
          </p>
        </div>

        <div className="rounded-xl bg-slate-100 p-3 text-center">
          <p className="text-xs text-slate-500">
            Status
          </p>
          <p className="text-sm font-semibold">
            {feedback}
          </p>
        </div>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={startCamera}
          disabled={
            !active ||
            status === "loading" ||
            status === "running"
          }
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          Start Camera
        </button>

        <button
          type="button"
          onClick={stopCamera}
          disabled={
            status !== "running" &&
            status !== "loading"
          }
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          Stop Camera
        </button>

        <button
          type="button"
          onClick={resetCounter}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
