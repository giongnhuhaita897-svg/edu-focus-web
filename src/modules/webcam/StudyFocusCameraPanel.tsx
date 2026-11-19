"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import type { FaceLandmarker } from "@mediapipe/tasks-vision";
import {
  Camera,
  CameraOff,
  Eye,
  EyeOff,
  Moon,
  AlertTriangle,
  CheckCircle2,
  Timer,
  Sparkles,
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Save,
  Loader2,
  Dumbbell,
} from "lucide-react";
import {
  AppDatabaseState,
  PomodoroPresetId,
} from "@/types/database";
import {
  formatSecondsToMMSS,
  POMODORO_PRESETS,
} from "@/modules/pomodoro/PomodoroHub";
import { recordPomodoroWorkSessionInState } from "@/lib/storage/local-db";
import { STUDY_FOCUS_THRESHOLDS } from "@/modules/webcam/thresholds";
import {
  extractFaceFrameMetrics,
  StudyFocusTracker,
  StudyTrackerSnapshot,
} from "@/modules/webcam/study-tracker";
import {
  createStudyFaceLandmarker,
  ModelLoadSource,
} from "@/modules/webcam/face-landmarker-loader";
import {
  CameraPrivacyMode,
  playGentleAlertTone,
  renderStudyOverlayCanvas,
} from "@/modules/webcam/face-canvas-renderer";

interface StudyFocusCameraPanelProps {
  dbState: AppDatabaseState;
  selectedPreset: PomodoroPresetId;
  onSelectPreset: (preset: PomodoroPresetId) => void;
  privacyMode: CameraPrivacyMode;
  onChangePrivacyMode: (mode: CameraPrivacyMode) => void;
  onSessionSaved: (nextState: AppDatabaseState, message: string) => void;
  onSuggestExerciseTab: () => void;
}

export function StudyFocusCameraPanel({
  dbState,
  selectedPreset,
  onSelectPreset,
  privacyMode,
  onChangePrivacyMode,
  onSessionSaved,
  onSuggestExerciseTab,
}: StudyFocusCameraPanelProps) {
  const currentPreset = POMODORO_PRESETS[selectedPreset];
  const initialSeconds = currentPreset.workMinutes * 60;

  const [selectedGoalId, setSelectedGoalId] = useState<string>(
    () => dbState.goals[0]?.id ?? ""
  );
  const [secondsLeft, setSecondsLeft] = useState<number>(initialSeconds);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [isLoadingModel, setIsLoadingModel] = useState<boolean>(false);
  const [modelSource, setModelSource] = useState<ModelLoadSource | null>(null);
  const [cameraError, setCameraError] = useState<string>("");
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [liveAlertText, setLiveAlertText] = useState<string>("");
  const [pomodoroJustFinished, setPomodoroJustFinished] =
    useState<boolean>(false);

  const trackerRef = useRef<StudyFocusTracker>(
    new StudyFocusTracker(STUDY_FOCUS_THRESHOLDS)
  );
  const [snapshot, setSnapshot] = useState<StudyTrackerSnapshot>(() =>
    trackerRef.current.getSnapshot()
  );

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastDetectTimeRef = useRef<number>(0);
  const hasDrawnCanvasRef = useRef<boolean>(false);

  // Refs đồng bộ state mới nhất cho vòng lặp requestAnimationFrame
  const privacyModeRef = useRef<CameraPrivacyMode>(privacyMode);
  const soundEnabledRef = useRef<boolean>(soundEnabled);
  const dbStateRef = useRef<AppDatabaseState>(dbState);
  const selectedGoalIdRef = useRef<string>(selectedGoalId);
  const selectedPresetRef = useRef<PomodoroPresetId>(selectedPreset);

  useEffect(() => {
    privacyModeRef.current = privacyMode;
  }, [privacyMode]);

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  useEffect(() => {
    dbStateRef.current = dbState;
    setSelectedGoalId((prev) => {
      if (dbState.goals.some((g) => g.id === prev)) return prev;
      return dbState.goals[0]?.id ?? "";
    });
  }, [dbState]);

  useEffect(() => {
    selectedGoalIdRef.current = selectedGoalId;
  }, [selectedGoalId]);

  useEffect(() => {
    selectedPresetRef.current = selectedPreset;
    setIsTimerRunning(false);
    setSecondsLeft(POMODORO_PRESETS[selectedPreset].workMinutes * 60);
    setPomodoroJustFinished(false);
  }, [selectedPreset]);

  const stopCameraResources = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    if (canvasRef.current && hasDrawnCanvasRef.current) {
      hasDrawnCanvasRef.current = false;
      const ctx = canvasRef.current.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    }
    setIsCameraActive(false);
    setLiveAlertText("");
  }, []);

  // Dọn dẹp camera và mô hình khi rời trang
  useEffect(() => {
    return () => {
      stopCameraResources();
      if (landmarkerRef.current) {
        try {
          landmarkerRef.current.close();
        } catch {
          // Bỏ qua lỗi khi giải phóng WASM
        }
        landmarkerRef.current = null;
      }
    };
  }, [stopCameraResources]);

  const persistCurrentFocusSession = useCallback(
    (workMinutes: number, reasonLabel: string) => {
      const latestSnap = trackerRef.current.getSnapshot();
      const presetId = selectedPresetRef.current;
      const goalId = selectedGoalIdRef.current || undefined;

      const nextState = recordPomodoroWorkSessionInState(dbStateRef.current, {
        presetId,
        workMinutes: Math.max(1, Math.round(workMinutes)),
        goalId,
        focusScorePercent: latestSnap.focusScorePercent,
        distractionCount: latestSnap.distractionCount,
        drowsinessAlertCount: latestSnap.drowsinessAlertCount,
      });

      if (typeof window !== "undefined" && typeof window.fetch === "function") {
        window
          .fetch("/api/state", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(nextState),
          })
          .catch(() => {});
      }

      const summaryMessage =
        `${reasonLabel} Đã lưu phiên học ${Math.max(1, Math.round(workMinutes))} phút ` +
        `(Độ tập trung ${latestSnap.focusScorePercent}%, ${latestSnap.distractionCount} lần xao nhãng, ` +
        `${latestSnap.drowsinessAlertCount} lần cảnh báo buồn ngủ) vào hồ sơ kỷ luật!`;

      onSessionSaved(nextState, summaryMessage);
    },
    [onSessionSaved]
  );

  // Đếm ngược đồng hồ Pomodoro thuần túy (tránh gọi side-effect bên trong state updater ở React StrictMode)
  useEffect(() => {
    if (!isTimerRunning) return;

    const intervalId = window.setInterval(() => {
      setSecondsLeft((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [isTimerRunning]);

  // Tự động dừng camera & lưu FocusSession vào local-db.ts khi đồng hồ chạm 00:00
  useEffect(() => {
    if (!isTimerRunning || secondsLeft > 0) return;

    setIsTimerRunning(false);
    setPomodoroJustFinished(true);
    stopCameraResources();

    const finishedMinutes =
      POMODORO_PRESETS[selectedPresetRef.current].workMinutes;
    persistCurrentFocusSession(
      finishedMinutes,
      "Hoàn tất chu kỳ Pomodoro!"
    );
    if (soundEnabledRef.current) {
      playGentleAlertTone(660, 320);
    }
  }, [
    isTimerRunning,
    secondsLeft,
    persistCurrentFocusSession,
    stopCameraResources,
  ]);

  const runDetectionLoop = useCallback(() => {
    const step = (nowMs: number) => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const landmarker = landmarkerRef.current;

      if (!video || !canvas || !landmarker || !streamRef.current) {
        return;
      }

      if (
        video.readyState >= 2 &&
        nowMs - lastDetectTimeRef.current >=
          STUDY_FOCUS_THRESHOLDS.detectionIntervalMs
      ) {
        lastDetectTimeRef.current = nowMs;

        if (
          video.videoWidth > 0 &&
          video.videoHeight > 0 &&
          (canvas.width !== video.videoWidth ||
            canvas.height !== video.videoHeight)
        ) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
        }

        try {
          const result = landmarker.detectForVideo(video, nowMs);
          const metrics = extractFaceFrameMetrics(
            result,
            STUDY_FOCUS_THRESHOLDS
          );
          const nextSnap = trackerRef.current.processFrame(metrics, nowMs);
          setSnapshot(nextSnap);

          hasDrawnCanvasRef.current = true;
          renderStudyOverlayCanvas(
            canvas,
            result.faceLandmarks?.[0],
            nextSnap.status,
            privacyModeRef.current
          );

          if (nextSnap.justTriggeredAlert !== "none") {
            if (nextSnap.justTriggeredAlert === "drowsy") {
              setLiveAlertText(
                "Phát hiện dấu hiệu buồn ngủ / gục đầu! Hãy ngồi thẳng lưng hoặc vươn vai nhẹ nhé."
              );
            } else if (nextSnap.justTriggeredAlert === "distracted") {
              setLiveAlertText(
                "Bạn đang quay mặt khỏi bàn học. Hãy đưa ánh mắt trở lại bài học nhé!"
              );
            } else if (nextSnap.justTriggeredAlert === "absent") {
              setLiveAlertText(
                "Không thấy bạn trước bàn học. Hệ thống tạm ghi nhận 1 lần gián đoạn."
              );
            }

            if (soundEnabledRef.current) {
              playGentleAlertTone(
                STUDY_FOCUS_THRESHOLDS.alertAudioFrequencyHz,
                STUDY_FOCUS_THRESHOLDS.alertAudioDurationMs
              );
            }
          } else if (nextSnap.status === "focused") {
            setLiveAlertText("");
          }
        } catch {
          // Bỏ qua khung hình lỗi tạm thời khi camera đang điều chỉnh
        }
      }

      rafRef.current = requestAnimationFrame(step);
    };

    rafRef.current = requestAnimationFrame(step);
  }, []);

  const handleStartMonitoring = async () => {
    setCameraError("");
    setPomodoroJustFinished(false);

    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getUserMedia !== "function"
    ) {
      setCameraError(
        "Trình duyệt hiện tại không hỗ trợ truy cập Webcam (getUserMedia). Hãy mở trên Chrome/Edge với localhost hoặc HTTPS."
      );
      return;
    }

    setIsLoadingModel(true);
    try {
      // 1. Xin quyền truy cập Webcam
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 360 },
          facingMode: "user",
        },
        audio: false,
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }

      // 2. Nạp MediaPipe FaceLandmarker (ưu tiên public/models/ -> fallback CDN)
      if (!landmarkerRef.current) {
        const loaded = await createStudyFaceLandmarker();
        landmarkerRef.current = loaded.landmarker;
        setModelSource(loaded.source);
      }

      if (secondsLeft === 0) {
        setSecondsLeft(currentPreset.workMinutes * 60);
      }
      setIsCameraActive(true);
      setIsTimerRunning(true);
      lastDetectTimeRef.current = 0;
      runDetectionLoop();
    } catch (err) {
      stopCameraResources();
      const message =
        err instanceof Error ? err.message : "Không thể khởi động Webcam.";
      if (
        message.toLowerCase().includes("permission") ||
        message.toLowerCase().includes("notallowed")
      ) {
        setCameraError(
          "Bạn chưa cấp quyền sử dụng Webcam. Hãy cho phép truy cập Camera trên thanh địa chỉ trình duyệt rồi thử lại."
        );
      } else {
        setCameraError(`Không thể khởi động Webcam AI: ${message}`);
      }
    } finally {
      setIsLoadingModel(false);
    }
  };

  const handleStopCamera = () => {
    setIsTimerRunning(false);
    stopCameraResources();
  };

  const handleResetSession = () => {
    setIsTimerRunning(false);
    stopCameraResources();
    trackerRef.current.reset();
    setSnapshot(trackerRef.current.getSnapshot());
    setSecondsLeft(currentPreset.workMinutes * 60);
    setPomodoroJustFinished(false);
    setCameraError("");
  };

  const handleFinishAndSaveNow = () => {
    const elapsedSeconds = currentPreset.workMinutes * 60 - secondsLeft;
    const elapsedMinutes = Math.max(1, Math.round(elapsedSeconds / 60));
    const minutesToSave =
      elapsedSeconds >= 60 ? elapsedMinutes : currentPreset.workMinutes;

    setIsTimerRunning(false);
    stopCameraResources();
    persistCurrentFocusSession(minutesToSave, "Đã kết thúc phiên học sớm!");
    trackerRef.current.reset();
    setSnapshot(trackerRef.current.getSnapshot());
    setSecondsLeft(currentPreset.workMinutes * 60);
    setPomodoroJustFinished(true);
  };

  const isFaceHidden = privacyMode !== "standard";

  const handleQuickToggleFacePrivacy = () => {
    onChangePrivacyMode(isFaceHidden ? "standard" : "skeleton_only");
  };

  const statusColorClass =
    snapshot.status === "drowsy" || snapshot.status === "absent"
      ? "text-red-400"
      : snapshot.status === "distracted"
      ? "text-amber-300"
      : "text-emerald-400";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Khung Camera Giám sát Ngồi học */}
      <div className="lg:col-span-2 p-6 rounded-2xl bg-edtech-surface border border-edtech-border shadow-sm space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Camera
              className="w-5 h-5 text-edtech-primary"
              aria-hidden={true}
            />
            <h2 className="text-lg font-bold text-edtech-text">
              Khung Giám sát Tư thế Ngồi học &amp; Độ Tỉnh táo
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Nút bật/tắt nhanh Chế độ Ẩn mặt (Privacy Mode) */}
            <button
              type="button"
              data-testid="toggle-privacy-face-mode"
              onClick={handleQuickToggleFacePrivacy}
              aria-pressed={isFaceHidden}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
                isFaceHidden
                  ? "bg-emerald-50 text-edtech-success border-emerald-200 hover:bg-emerald-100"
                  : "bg-slate-100 text-edtech-text border-slate-300 hover:bg-slate-200"
              }`}
            >
              {isFaceHidden ? (
                <EyeOff className="w-3.5 h-3.5" aria-hidden={true} />
              ) : (
                <Eye className="w-3.5 h-3.5" aria-hidden={true} />
              )}
              <span>
                {isFaceHidden
                  ? "Ẩn mặt: Đang bật"
                  : "Ẩn mặt: Đang tắt"}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setSoundEnabled((prev) => !prev)}
              aria-pressed={soundEnabled}
              title={soundEnabled ? "Tắt âm thanh nhắc nhở" : "Bật âm thanh nhắc nhở"}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-semibold bg-edtech-bg text-edtech-muted hover:text-edtech-text border border-edtech-border transition-colors"
            >
              {soundEnabled ? (
                <Volume2 className="w-3.5 h-3.5 text-edtech-primary" aria-hidden={true} />
              ) : (
                <VolumeX className="w-3.5 h-3.5" aria-hidden={true} />
              )}
              <span>{soundEnabled ? "Âm nhắc: Bật" : "Âm nhắc: Tắt"}</span>
            </button>
          </div>
        </div>

        {cameraError && (
          <div
            role="alert"
            className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700 flex items-start gap-2"
          >
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden={true} />
            <span>{cameraError}</span>
          </div>
        )}

        {/* Khung Camera thực tế + Canvas Ẩn mặt / Khung nét tối giản */}
        <div className="relative aspect-video w-full rounded-2xl bg-slate-900 text-white overflow-hidden border border-slate-800 flex flex-col justify-between p-4 sm:p-5">
          {/* Video thật (luôn chạy ẩn khi bật Chế độ Ẩn mặt để AI vẫn phân tích) */}
          <video
            ref={videoRef}
            playsInline
            muted
            className={`absolute inset-0 w-full h-full object-cover -scale-x-100 transition-opacity duration-200 ${
              isCameraActive && privacyMode === "standard"
                ? "opacity-100"
                : "opacity-0 pointer-events-none"
            }`}
          />

          {/* Canvas vẽ khung nét tối giản / chỉ báo trạng thái */}
          <canvas
            ref={canvasRef}
            width={640}
            height={360}
            className={`absolute inset-0 w-full h-full object-cover ${
              isCameraActive ? "opacity-100" : "opacity-0 pointer-events-none"
            }`}
          />

          {/* Thanh trạng thái trên cùng */}
          <div className="relative z-10 flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-slate-900/85 text-emerald-400 border border-slate-700 backdrop-blur-sm">
              <span
                className={`w-2 h-2 rounded-full ${
                  isCameraActive ? "bg-emerald-400 animate-pulse" : "bg-slate-400"
                }`}
                aria-hidden="true"
              />
              AI Vision:{" "}
              {privacyMode === "skeleton_only"
                ? "Chế độ Khung xương Ẩn mặt"
                : privacyMode === "minimal"
                ? "Chế độ Chỉ báo Tối giản"
                : "Hiển thị Camera trực tiếp"}
            </span>

            <div className="flex items-center gap-2">
              {modelSource && (
                <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-900/85 text-slate-300 border border-slate-700">
                  {modelSource === "local" ? "Model cục bộ ✓" : "CDN dự phòng"}
                </span>
              )}
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-900/85 text-blue-300 border border-slate-700">
                Chu kỳ: {currentPreset.label}
              </span>
            </div>
          </div>

          {/* Nội dung giữa khung khi chưa bật camera hoặc đang cảnh báo */}
          <div className="relative z-10 my-auto text-center space-y-2 max-w-md mx-auto">
            {!isCameraActive ? (
              <>
                {isLoadingModel ? (
                  <Loader2
                    className="w-10 h-10 text-blue-400 mx-auto animate-spin"
                    aria-hidden={true}
                  />
                ) : (
                  <Camera
                    className="w-10 h-10 text-blue-400 mx-auto"
                    aria-hidden={true}
                  />
                )}
                <p className="text-base font-bold">
                  {isLoadingModel
                    ? "Đang khởi động Camera & nạp FaceLandmarker..."
                    : "Khu vực hiển thị Webcam Giám sát Học tập"}
                </p>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Hệ thống xử lý 100% tại trình duyệt: theo dõi hướng nhìn, phát
                  hiện quay đi mất tập trung hoặc nhắm mắt / gục đầu ngủ gật.
                </p>
              </>
            ) : liveAlertText ? (
              <div
                role="status"
                aria-live="assertive"
                className="px-4 py-3 rounded-xl bg-red-950/85 border border-red-400/60 text-xs font-semibold text-red-100 shadow-lg backdrop-blur-sm"
              >
                {liveAlertText}
              </div>
            ) : privacyMode === "minimal" ? (
              <div className="space-y-1">
                <p className={`text-sm font-bold ${statusColorClass}`}>
                  {snapshot.statusLabel}
                </p>
                <p className="text-xs text-slate-300">
                  Điểm tập trung hiện tại: {snapshot.focusScorePercent}%
                </p>
              </div>
            ) : null}
          </div>

          {/* 3 thẻ chỉ số trực tiếp ở đáy khung */}
          <div className="relative z-10 grid grid-cols-3 gap-2 text-center text-xs">
            <div className="p-2.5 rounded-xl bg-slate-900/85 border border-slate-700 backdrop-blur-sm">
              <p className="text-slate-400">Trạng thái tập trung</p>
              <p
                data-testid="study-live-status"
                className={`mt-0.5 font-bold ${statusColorClass}`}
              >
                {isCameraActive
                  ? `${snapshot.statusLabel} (${snapshot.focusScorePercent}%)`
                  : "Đang tập trung tốt"}
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-900/85 border border-slate-700 backdrop-blur-sm">
              <p className="text-slate-400">Cảnh báo buồn ngủ</p>
              <p
                data-testid="study-drowsy-count"
                className="mt-0.5 font-bold text-white"
              >
                {snapshot.drowsinessAlertCount === 0
                  ? "Tỉnh táo (0 lần)"
                  : `${snapshot.drowsinessAlertCount} lần cảnh báo`}
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-900/85 border border-slate-700 backdrop-blur-sm">
              <p className="text-slate-400">Số lần xao nhãng</p>
              <p
                data-testid="study-distraction-count"
                className="mt-0.5 font-bold text-amber-300"
              >
                {snapshot.distractionCount} lần
              </p>
            </div>
          </div>
        </div>

        {/* Thanh điều khiển Camera & Lưu phiên */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {!isCameraActive ? (
              <button
                type="button"
                disabled={isLoadingModel}
                onClick={handleStartMonitoring}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-edtech-primary hover:bg-edtech-primaryHover disabled:opacity-60 text-white text-xs font-bold shadow-sm transition-colors"
              >
                {isLoadingModel ? (
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden={true} />
                ) : (
                  <Camera className="w-4 h-4" aria-hidden={true} />
                )}
                <span>Bắt đầu Giám sát &amp; Pomodoro</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStopCamera}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-sm transition-colors"
              >
                <CameraOff className="w-4 h-4" aria-hidden={true} />
                <span>Tắt Camera &amp; Tạm dừng</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleResetSession}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-edtech-bg hover:bg-slate-200/80 text-edtech-text text-xs font-semibold border border-edtech-border transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden={true} />
              <span>Đặt lại phiên</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleFinishAndSaveNow}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-edtech-success hover:bg-emerald-600 text-white text-xs font-bold shadow-sm transition-colors"
          >
            <Save className="w-4 h-4" aria-hidden={true} />
            <span>Hoàn tất &amp; Lưu phiên học</span>
          </button>
        </div>

        {/* 3 tiêu chí giám sát thông minh khi ngồi học */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          <div className="p-4 rounded-xl bg-edtech-bg border border-edtech-border space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-bold text-edtech-primary">
              <Eye className="w-4 h-4" aria-hidden={true} />
              <span>Phát hiện Mất tập trung</span>
            </div>
            <p className="text-xs text-edtech-muted leading-relaxed">
              Ghi nhận khi quay mặt quá {STUDY_FOCUS_THRESHOLDS.headYawDistractionDeg}°
              trên {STUDY_FOCUS_THRESHOLDS.distractionDurationMs / 1000}s hoặc rời khỏi
              bàn học quá {STUDY_FOCUS_THRESHOLDS.absenceDurationMs / 1000}s.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-edtech-bg border border-edtech-border space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-600">
              <Moon className="w-4 h-4" aria-hidden={true} />
              <span>Phát hiện Đang ngủ / Gục đầu</span>
            </div>
            <p className="text-xs text-edtech-muted leading-relaxed">
              Theo dõi độ nhắm mắt (Blendshapes/EAR) và góc cúi đầu quá{" "}
              {STUDY_FOCUS_THRESHOLDS.headPitchDownThresholdDeg}° liên tục{" "}
              {(STUDY_FOCUS_THRESHOLDS.drowsyDurationMs / 1000).toFixed(1)}s.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-edtech-bg border border-edtech-border space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-bold text-edtech-success">
              <Sparkles className="w-4 h-4" aria-hidden={true} />
              <span>Tổng hợp Điểm Kỷ luật</span>
            </div>
            <p className="text-xs text-edtech-muted leading-relaxed">
              Tự động lưu <code>FocusSession</code> vào hồ sơ khi kết thúc phiên
              Pomodoro để Cố vấn AI đánh giá.
            </p>
          </div>
        </div>
      </div>

      {/* Khung tích hợp Pomodoro 25/5 & 50/15 ngay trong Phòng Kỷ luật */}
      <div className="p-6 rounded-2xl bg-edtech-surface border border-edtech-border shadow-sm space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Timer
              className="w-5 h-5 text-edtech-primary"
              aria-hidden={true}
            />
            <h2 className="text-base font-bold text-edtech-text">
              Tích hợp Chu kỳ Pomodoro
            </h2>
          </div>
          <span className="text-xs font-semibold text-edtech-primary">
            Học/Làm &amp; Nghỉ
          </span>
        </div>

        <p className="text-xs text-edtech-muted leading-relaxed">
          Chọn cấu trúc thời gian Học/Làm &amp; Nghỉ để đồng bộ cùng phiên giám
          sát webcam và tự động lưu hồ sơ khi hết giờ:
        </p>

        {/* Chọn mục tiêu để cộng giờ tích lũy */}
        {dbState.goals.length > 0 && (
          <div className="space-y-1.5">
            <label
              htmlFor="study-webcam-goal-select"
              className="block text-xs font-bold text-edtech-text"
            >
              Mục tiêu cộng giờ khi hoàn tất:
            </label>
            <select
              id="study-webcam-goal-select"
              value={selectedGoalId}
              onChange={(e) => setSelectedGoalId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-edtech-bg border border-edtech-border text-xs font-medium text-edtech-text focus:outline-none focus:ring-2 focus:ring-edtech-primary"
            >
              {dbState.goals.map((goal) => (
                <option key={goal.id} value={goal.id}>
                  {goal.title} ({goal.progressPercent}%)
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="space-y-2.5">
          {(["25_5", "50_15"] as PomodoroPresetId[]).map((id) => {
            const preset = POMODORO_PRESETS[id];
            const isSelected = selectedPreset === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onSelectPreset(id)}
                aria-pressed={isSelected}
                className={`w-full text-left p-3.5 rounded-xl border transition-colors ${
                  isSelected
                    ? "bg-blue-50/80 border-edtech-primary"
                    : "bg-edtech-bg border-edtech-border hover:bg-slate-100/70"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-edtech-text">
                    {preset.label}
                  </span>
                  <span className="text-xs font-semibold text-edtech-primary">
                    {preset.workMinutes}p / {preset.breakMinutes}p
                  </span>
                </div>
                <p className="mt-1 text-xs text-edtech-muted">
                  {preset.workMinutes} phút Học/Làm • {preset.breakMinutes} phút
                  Nghỉ
                </p>
              </button>
            );
          })}
        </div>

        <div className="p-4 rounded-xl bg-edtech-bg border border-edtech-border text-center space-y-2.5">
          <p className="text-xs font-medium text-edtech-muted">
            Đồng hồ pha Học / Làm ({currentPreset.workMinutes} phút)
          </p>
          <p
            data-testid="webcam-pomodoro-timer"
            className="text-3xl font-extrabold text-edtech-text tabular-nums"
          >
            {formatSecondsToMMSS(secondsLeft)}
          </p>
          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (!isTimerRunning && secondsLeft === 0) {
                  setSecondsLeft(currentPreset.workMinutes * 60);
                  setPomodoroJustFinished(false);
                }
                setIsTimerRunning((prev) => !prev);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-edtech-primary text-xs font-bold border border-blue-200 transition-colors"
            >
              {isTimerRunning ? (
                <>
                  <Pause className="w-3.5 h-3.5" aria-hidden={true} />
                  <span>Tạm dừng</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" aria-hidden={true} />
                  <span>Chạy đồng hồ</span>
                </>
              )}
            </button>
          </div>
          <p className="text-xs text-edtech-success font-medium">
            Nghỉ giải lao kế tiếp: {currentPreset.breakMinutes} phút
          </p>
        </div>

        {pomodoroJustFinished ? (
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 space-y-2.5">
            <div className="flex items-start gap-2">
              <CheckCircle2
                className="w-4 h-4 text-edtech-success shrink-0 mt-0.5"
                aria-hidden={true}
              />
              <p className="text-xs font-semibold text-edtech-text leading-relaxed">
                Phiên học đã được lưu! Đã đến giờ nghỉ{" "}
                {currentPreset.breakMinutes} phút — hãy đứng dậy vận động giãn
                cơ nhé.
              </p>
            </div>
            <button
              type="button"
              onClick={onSuggestExerciseTab}
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-edtech-success hover:bg-emerald-600 text-white text-xs font-bold transition-colors"
            >
              <Dumbbell className="w-3.5 h-3.5" aria-hidden={true} />
              <span>Chuyển sang Tab Tập thể dục</span>
            </button>
          </div>
        ) : (
          <div className="p-3.5 rounded-xl bg-amber-50/80 border border-amber-200 flex items-start gap-2.5">
            <AlertTriangle
              className="w-4 h-4 text-amber-600 shrink-0 mt-0.5"
              aria-hidden={true}
            />
            <p className="text-xs text-edtech-text leading-relaxed">
              Khi hết {currentPreset.workMinutes} phút ngồi học, hệ thống tự
              động lưu phiên và gợi ý chuyển sang tab{" "}
              <strong>
                Giám sát Tập thể dục ({currentPreset.breakMinutes} phút)
              </strong>{" "}
              để vận động chống buồn ngủ.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
