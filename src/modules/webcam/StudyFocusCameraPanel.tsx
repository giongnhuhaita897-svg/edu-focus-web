"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import type {
  FaceLandmarker,
  HandLandmarker,
  ObjectDetector,
} from "@mediapipe/tasks-vision";
import {
  Camera,
  CameraOff,
  Eye,
  EyeOff,
  Moon,
  AlertTriangle,
  CheckCircle2,
  Timer,
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Save,
  Loader2,
  Dumbbell,
  Smartphone,
  Hand,
  NotebookPen,
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
  DetectedDistractionDevice,
  extractDistractionDevices,
  HandLandmarkPoint,
  HandScrollDetector,
} from "@/modules/webcam/distraction-detectors";
import {
  CameraDeviceOption,
  createStudyVisionBundle,
  ModelLoadSource,
  pickPreferredCameraDeviceId,
  PREFERRED_CAMERA_STORAGE_KEY,
  runWithFilteredMediaPipeLogs,
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
  const [availableCameras, setAvailableCameras] = useState<
    CameraDeviceOption[]
  >([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>("");
  const [enableDeviceAndHandDetection, setEnableDeviceAndHandDetection] =
    useState<boolean>(true);
  const [noteTakingMode, setNoteTakingMode] = useState<boolean>(false);
  const [visionCapabilities, setVisionCapabilities] = useState<{
    objectDetectorReady: boolean;
    handLandmarkerReady: boolean;
  }>({ objectDetectorReady: false, handLandmarkerReady: false });

  const trackerRef = useRef<StudyFocusTracker>(
    new StudyFocusTracker(STUDY_FOCUS_THRESHOLDS)
  );
  const handScrollDetectorRef = useRef<HandScrollDetector>(
    new HandScrollDetector(STUDY_FOCUS_THRESHOLDS)
  );
  const [snapshot, setSnapshot] = useState<StudyTrackerSnapshot>(() =>
    trackerRef.current.getSnapshot()
  );

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const objectDetectorRef = useRef<ObjectDetector | null>(null);
  const handLandmarkerRef = useRef<HandLandmarker | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastDetectTimeRef = useRef<number>(0);
  const lastObjectDetectTimeRef = useRef<number>(0);
  const lastHandDetectTimeRef = useRef<number>(0);
  const lastFaceTimestampRef = useRef<number>(0);
  const lastObjectTimestampRef = useRef<number>(0);
  const lastHandTimestampRef = useRef<number>(0);
  const latestDevicesRef = useRef<DetectedDistractionDevice[]>([]);
  const latestHandsRef = useRef<HandLandmarkPoint[][]>([]);
  const latestHandScrollingRef = useRef<boolean>(false);
  const hasDrawnCanvasRef = useRef<boolean>(false);

  // Refs đồng bộ state mới nhất cho vòng lặp requestAnimationFrame
  const privacyModeRef = useRef<CameraPrivacyMode>(privacyMode);
  const soundEnabledRef = useRef<boolean>(soundEnabled);
  const enableDeviceAndHandRef = useRef<boolean>(enableDeviceAndHandDetection);
  const noteTakingModeRef = useRef<boolean>(noteTakingMode);
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
    enableDeviceAndHandRef.current = enableDeviceAndHandDetection;
    if (!enableDeviceAndHandDetection) {
      latestDevicesRef.current = [];
      latestHandsRef.current = [];
      latestHandScrollingRef.current = false;
      handScrollDetectorRef.current.reset();
    }
  }, [enableDeviceAndHandDetection]);

  useEffect(() => {
    noteTakingModeRef.current = noteTakingMode;
  }, [noteTakingMode]);

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

  const refreshCameraDevices = useCallback(
    async (activeDeviceId?: string): Promise<CameraDeviceOption[]> => {
      if (
        typeof navigator === "undefined" ||
        !navigator.mediaDevices ||
        typeof navigator.mediaDevices.enumerateDevices !== "function"
      ) {
        return [];
      }
      try {
        const allDevices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs: CameraDeviceOption[] = allDevices
          .filter((d) => d.kind === "videoinput")
          .map((d, idx) => ({
            deviceId: d.deviceId,
            label: d.label || `Camera ${idx + 1}`,
          }));

        setAvailableCameras(videoInputs);

        const savedId =
          typeof window !== "undefined"
            ? window.localStorage.getItem(PREFERRED_CAMERA_STORAGE_KEY)
            : null;
        const preferred =
          activeDeviceId ||
          pickPreferredCameraDeviceId(videoInputs, savedId) ||
          "";

        if (preferred) {
          setSelectedCameraId((prev) => activeDeviceId || prev || preferred);
        }
        return videoInputs;
      } catch {
        return [];
      }
    },
    []
  );

  // Tải trước danh sách camera nếu trình duyệt đã cấp quyền từ trước
  useEffect(() => {
    refreshCameraDevices();
  }, [refreshCameraDevices]);

  // Dọn dẹp camera và các mô hình AI khi rời trang
  useEffect(() => {
    return () => {
      stopCameraResources();
      for (const ref of [landmarkerRef, objectDetectorRef, handLandmarkerRef]) {
        if (ref.current) {
          try {
            ref.current.close();
          } catch {
            // Bỏ qua lỗi khi giải phóng WASM
          }
          ref.current = null;
        }
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
        video.videoWidth > 0 &&
        video.videoHeight > 0 &&
        nowMs - lastDetectTimeRef.current >=
          STUDY_FOCUS_THRESHOLDS.detectionIntervalMs
      ) {
        lastDetectTimeRef.current = nowMs;

        if (
          canvas.width !== video.videoWidth ||
          canvas.height !== video.videoHeight
        ) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
        }

        // 1. Quét Điện thoại / iPad theo chu kỳ nhẹ (450ms)
        if (
          enableDeviceAndHandRef.current &&
          objectDetectorRef.current &&
          nowMs - lastObjectDetectTimeRef.current >=
            STUDY_FOCUS_THRESHOLDS.objectDetectionIntervalMs
        ) {
          lastObjectDetectTimeRef.current = nowMs;
          const objTs = Math.max(
            Math.round(nowMs),
            lastObjectTimestampRef.current + 1
          );
          lastObjectTimestampRef.current = objTs;
          try {
            const objResult = runWithFilteredMediaPipeLogs(() =>
              objectDetectorRef.current!.detectForVideo(video, objTs)
            );
            latestDevicesRef.current = extractDistractionDevices(
              objResult,
              video.videoWidth,
              video.videoHeight,
              STUDY_FOCUS_THRESHOLDS
            );
          } catch {
            // Bỏ qua lỗi khung hình tạm thời của ObjectDetector
          }
        }

        // 2. Quét cử động tay lướt điện thoại / iPad theo chu kỳ 160ms
        if (
          enableDeviceAndHandRef.current &&
          handLandmarkerRef.current &&
          nowMs - lastHandDetectTimeRef.current >=
            STUDY_FOCUS_THRESHOLDS.handDetectionIntervalMs
        ) {
          lastHandDetectTimeRef.current = nowMs;
          const handTs = Math.max(
            Math.round(nowMs),
            lastHandTimestampRef.current + 1
          );
          lastHandTimestampRef.current = handTs;
          try {
            const handResult = runWithFilteredMediaPipeLogs(() =>
              handLandmarkerRef.current!.detectForVideo(video, handTs)
            );
            const hands = handResult.landmarks ?? [];
            latestHandsRef.current = hands;
            const scrollSnap = handScrollDetectorRef.current.processHands(
              hands,
              nowMs
            );
            latestHandScrollingRef.current = scrollSnap.isScrolling;
          } catch {
            // Bỏ qua lỗi khung hình tạm thời của HandLandmarker
          }
        }

        // 3. Phân tích khuôn mặt (hướng đầu, nhắm mắt, nhìn xuống)
        const faceTs = Math.max(
          Math.round(nowMs),
          lastFaceTimestampRef.current + 1
        );
        lastFaceTimestampRef.current = faceTs;

        try {
          const result = runWithFilteredMediaPipeLogs(() =>
            landmarker.detectForVideo(video, faceTs)
          );
          const metrics = extractFaceFrameMetrics(
            result,
            STUDY_FOCUS_THRESHOLDS
          );
          const nextSnap = trackerRef.current.processFrame(metrics, nowMs, {
            detectedDevices: latestDevicesRef.current,
            isHandScrolling: latestHandScrollingRef.current,
            noteTakingMode: noteTakingModeRef.current,
            enableDeviceAndHandDetection: enableDeviceAndHandRef.current,
          });
          setSnapshot(nextSnap);

          hasDrawnCanvasRef.current = true;
          renderStudyOverlayCanvas(
            canvas,
            result.faceLandmarks?.[0],
            nextSnap.status,
            privacyModeRef.current,
            {
              detectedDevices: enableDeviceAndHandRef.current
                ? latestDevicesRef.current
                : [],
              hands: enableDeviceAndHandRef.current
                ? latestHandsRef.current
                : [],
              isHandScrolling: latestHandScrollingRef.current,
            }
          );

          if (nextSnap.justTriggeredAlert !== "none") {
            if (nextSnap.justTriggeredAlert === "drowsy") {
              setLiveAlertText(
                "Phát hiện dấu hiệu buồn ngủ / gục đầu! Hãy ngồi thẳng lưng hoặc vươn vai nhẹ nhé."
              );
            } else if (nextSnap.justTriggeredAlert === "phone_distracted") {
              const detectedLabel =
                nextSnap.activeDevices[0]?.label ?? "Điện thoại / iPad";
              setLiveAlertText(
                `Phát hiện ${detectedLabel} trong khung hình! Hãy cất thiết bị sang một bên để giữ mạch tập trung nhé.`
              );
            } else if (nextSnap.justTriggeredAlert === "scrolling_distracted") {
              setLiveAlertText(
                "Phát hiện cử chỉ tay đang lướt liên tục! Hãy tạm gác màn hình phụ để hoàn thành phiên Pomodoro này nhé."
              );
            } else if (nextSnap.justTriggeredAlert === "distracted") {
              setLiveAlertText(
                "Bạn đang quay mặt hoặc nhìn xuống khá lâu. Nếu đang viết vở, hãy bật nút 'Đang ghi chép vở' để tránh nhắc nhầm nhé!"
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

  const openCameraStream = useCallback(
    async (explicitDeviceId?: string): Promise<MediaStream> => {
      const devices = await refreshCameraDevices();
      const savedId =
        typeof window !== "undefined"
          ? window.localStorage.getItem(PREFERRED_CAMERA_STORAGE_KEY)
          : null;
      const targetDeviceId =
        explicitDeviceId ||
        selectedCameraId ||
        pickPreferredCameraDeviceId(devices, savedId);

      // Thử mở đúng thiết bị webcam laptop/USB trước để tránh Windows Phone Link gọi điện thoại
      if (targetDeviceId) {
        try {
          return await navigator.mediaDevices.getUserMedia({
            video: {
              deviceId: { exact: targetDeviceId },
              width: { ideal: 640 },
              height: { ideal: 360 },
            },
            audio: false,
          });
        } catch {
          // Nếu thiết bị đã lưu không còn cắm, fallback sang camera mặc định
        }
      }

      return navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 360 },
          facingMode: "user",
        },
        audio: false,
      });
    },
    [refreshCameraDevices, selectedCameraId]
  );

  const handleStartMonitoring = async (overrideDeviceId?: string) => {
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
      // 1. Xin quyền truy cập Webcam (ưu tiên camera laptop, tránh camera ảo điện thoại)
      const stream = await openCameraStream(overrideDeviceId);
      streamRef.current = stream;

      const activeTrackDeviceId =
        stream.getVideoTracks()[0]?.getSettings?.().deviceId;
      if (activeTrackDeviceId) {
        setSelectedCameraId(activeTrackDeviceId);
        if (typeof window !== "undefined") {
          try {
            window.localStorage.setItem(
              PREFERRED_CAMERA_STORAGE_KEY,
              activeTrackDeviceId
            );
          } catch {
            // Bỏ qua lỗi quota
          }
        }
      }
      // Cập nhật lại tên đầy đủ các camera sau khi đã có quyền truy cập
      await refreshCameraDevices(activeTrackDeviceId);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }

      // 2. Nạp bộ 3 mô hình MediaPipe (Face + Object ĐT/iPad + Hand lướt tay)
      if (!landmarkerRef.current) {
        const bundle = await createStudyVisionBundle();
        landmarkerRef.current = bundle.faceLandmarker;
        objectDetectorRef.current = bundle.objectDetector;
        handLandmarkerRef.current = bundle.handLandmarker;
        setModelSource(bundle.source);
        setVisionCapabilities({
          objectDetectorReady: Boolean(bundle.objectDetector),
          handLandmarkerReady: Boolean(bundle.handLandmarker),
        });
      }

      if (secondsLeft === 0) {
        setSecondsLeft(currentPreset.workMinutes * 60);
      }
      setIsCameraActive(true);
      setIsTimerRunning(true);
      lastDetectTimeRef.current = 0;
      lastObjectDetectTimeRef.current = 0;
      lastHandDetectTimeRef.current = 0;
      latestDevicesRef.current = [];
      latestHandsRef.current = [];
      latestHandScrollingRef.current = false;
      handScrollDetectorRef.current.reset();
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

  const handleSwitchCamera = async (nextDeviceId: string) => {
    setSelectedCameraId(nextDeviceId);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(PREFERRED_CAMERA_STORAGE_KEY, nextDeviceId);
      } catch {
        // Bỏ qua lỗi quota
      }
    }
    if (isCameraActive) {
      stopCameraResources();
      await handleStartMonitoring(nextDeviceId);
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
    handScrollDetectorRef.current.reset();
    latestDevicesRef.current = [];
    latestHandsRef.current = [];
    latestHandScrollingRef.current = false;
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
    snapshot.status === "drowsy" ||
    snapshot.status === "absent" ||
    snapshot.status === "phone_distracted"
      ? "text-red-400"
      : snapshot.status === "distracted" ||
        snapshot.status === "scrolling_distracted"
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

            <div className="flex flex-wrap items-center gap-1.5">
              {modelSource && (
                <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-900/85 text-slate-300 border border-slate-700">
                  {modelSource === "local" ? "Model cục bộ ✓" : "CDN dự phòng"}
                </span>
              )}
              {isCameraActive &&
                enableDeviceAndHandDetection &&
                (visionCapabilities.objectDetectorReady ||
                  visionCapabilities.handLandmarkerReady) && (
                  <span
                    className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                      snapshot.activeDevices.length > 0
                        ? "bg-red-950/90 text-red-200 border-red-400/60"
                        : snapshot.isHandScrolling
                        ? "bg-amber-950/90 text-amber-200 border-amber-400/60"
                        : "bg-slate-900/85 text-sky-300 border-slate-700"
                    }`}
                  >
                    {snapshot.activeDevices.length > 0
                      ? `Phát hiện: ${snapshot.activeDevices[0].label}`
                      : snapshot.isHandScrolling
                      ? "Phát hiện: Đang lướt tay"
                      : "Quét ĐT/iPad & Tay: Bật"}
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
                    ? "Đang khởi động Camera & nạp 3 mô hình AI..."
                    : "Khu vực hiển thị Webcam Giám sát Học tập"}
                </p>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Xử lý 100% tại trình duyệt: nhận diện hướng nhìn, buồn ngủ /
                  gục đầu, điện thoại / iPad trong khung hình và cử chỉ tay đang
                  lướt liên tục.
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

        {/* Chọn thiết bị Camera (ưu tiên webcam laptop, tránh Windows Phone Link / điện thoại) */}
        {availableCameras.length > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl bg-edtech-bg border border-edtech-border">
            <label
              htmlFor="study-camera-device-select"
              className="text-xs font-bold text-edtech-text shrink-0"
            >
              Thiết bị Camera đang dùng:
            </label>
            <select
              id="study-camera-device-select"
              data-testid="study-camera-device-select"
              value={selectedCameraId}
              onChange={(e) => handleSwitchCamera(e.target.value)}
              className="w-full sm:w-auto sm:min-w-[260px] px-3 py-1.5 rounded-lg bg-white border border-edtech-border text-xs font-medium text-edtech-text focus:outline-none focus:ring-2 focus:ring-edtech-primary"
            >
              {availableCameras.map((cam) => (
                <option key={cam.deviceId} value={cam.deviceId}>
                  {cam.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Thanh điều khiển Camera & Lưu phiên */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {!isCameraActive ? (
              <button
                type="button"
                disabled={isLoadingModel}
                onClick={() => handleStartMonitoring()}
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

        {/* Tùy chọn thông minh phù hợp thực tế khi ngồi học */}
        <div className="flex flex-wrap items-center gap-2 p-3 rounded-xl bg-edtech-bg border border-edtech-border">
          <button
            type="button"
            data-testid="toggle-device-hand-detection"
            onClick={() => setEnableDeviceAndHandDetection((prev) => !prev)}
            aria-pressed={enableDeviceAndHandDetection}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
              enableDeviceAndHandDetection
                ? "bg-blue-50 text-edtech-primary border-blue-200"
                : "bg-white text-edtech-muted border-edtech-border hover:text-edtech-text"
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" aria-hidden={true} />
            <span>
              Quét ĐT / iPad &amp; Lướt tay:{" "}
              {enableDeviceAndHandDetection ? "Bật" : "Tắt"}
            </span>
          </button>

          <button
            type="button"
            data-testid="toggle-note-taking-mode"
            onClick={() => setNoteTakingMode((prev) => !prev)}
            aria-pressed={noteTakingMode}
            title="Bật khi bạn đang cúi xuống ghi chép vở hoặc đọc sách giấy để tránh nhắc nhầm"
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
              noteTakingMode
                ? "bg-emerald-50 text-edtech-success border-emerald-200"
                : "bg-white text-edtech-muted border-edtech-border hover:text-edtech-text"
            }`}
          >
            <NotebookPen className="w-3.5 h-3.5" aria-hidden={true} />
            <span>
              Đang ghi chép vở: {noteTakingMode ? "Đang bật" : "Tắt"}
            </span>
          </button>

          <span className="text-[11px] text-edtech-muted ml-auto">
            {noteTakingMode
              ? "Đang nới góc cúi đầu viết vở (vẫn bắt ĐT/iPad & ngủ gật)"
              : "Bật 'Ghi chép vở' nếu bạn làm bài trên giấy để học thoải mái hơn"}
          </span>
        </div>

        {/* 3 tiêu chí giám sát thông minh khi ngồi học */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          <div className="p-4 rounded-xl bg-edtech-bg border border-edtech-border space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-bold text-edtech-primary">
              <Smartphone className="w-4 h-4" aria-hidden={true} />
              <span>Nhận diện ĐT / iPad</span>
            </div>
            <p className="text-xs text-edtech-muted leading-relaxed">
              Quét điện thoại &amp; màn hình phụ/iPad (EfficientDet) sau độ trễ
              nhẹ {STUDY_FOCUS_THRESHOLDS.deviceDistractionDurationMs / 1000}s để
              tránh nhắc nhầm khi chỉ xem giờ.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-edtech-bg border border-edtech-border space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-600">
              <Hand className="w-4 h-4" aria-hidden={true} />
              <span>Cử chỉ Lướt tay &amp; Mất tập trung</span>
            </div>
            <p className="text-xs text-edtech-muted leading-relaxed">
              Phát hiện ngón cái/ngón trỏ vuốt lặp lại (HandLandmarker) và quay
              mặt quá {STUDY_FOCUS_THRESHOLDS.headYawDistractionDeg}°, không bắt
              nhầm khi lật trang sách hay uống nước.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-edtech-bg border border-edtech-border space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-bold text-edtech-success">
              <Moon className="w-4 h-4" aria-hidden={true} />
              <span>Độ Tỉnh táo &amp; Điểm Kỷ luật</span>
            </div>
            <p className="text-xs text-edtech-muted leading-relaxed">
              Nhận diện nhắm mắt / gục đầu ngủ gật và tự động lưu{" "}
              <code>FocusSession</code> khi hoàn tất chu kỳ Pomodoro.
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
