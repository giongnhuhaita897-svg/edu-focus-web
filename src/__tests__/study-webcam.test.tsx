import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  FACE_LANDMARKER_ASSETS,
  HAND_LANDMARKER_ASSETS,
  OBJECT_DETECTOR_ASSETS,
  STUDY_FOCUS_THRESHOLDS,
} from "@/modules/webcam/thresholds";
import {
  evaluateStudyPenalty,
  extractFaceFrameMetrics,
  NormalizedLandmarkPoint,
  StudyFocusTracker,
} from "@/modules/webcam/study-tracker";
import {
  extractDistractionDevices,
  HandLandmarkPoint,
  HandScrollDetector,
} from "@/modules/webcam/distraction-detectors";
import {
  isBenignMediaPipeStderr,
  pickPreferredCameraDeviceId,
  runWithFilteredMediaPipeLogs,
} from "@/modules/webcam/face-landmarker-loader";
import { WebcamPlaceholder } from "@/modules/webcam/WebcamPlaceholder";
import {
  createDefaultState,
  loadAppState,
  recordPenalizedStudySessionInState,
} from "@/lib/storage/local-db";

function createSyntheticFaceLandmarks(opts?: {
  noseOffsetX?: number;
  noseOffsetY?: number;
}): NormalizedLandmarkPoint[] {
  const arr: NormalizedLandmarkPoint[] = Array.from({ length: 478 }, () => ({
    x: 0.5,
    y: 0.5,
    z: 0,
  }));
  // Các điểm mốc chính: trán (10), cằm (152), mắt trái ngoài (33), mắt phải ngoài (263), đầu mũi (1)
  arr[10] = { x: 0.5, y: 0.2 };
  arr[152] = { x: 0.5, y: 0.8 };
  arr[33] = { x: 0.35, y: 0.45 };
  arr[263] = { x: 0.65, y: 0.45 };
  arr[1] = {
    x: 0.5 + (opts?.noseOffsetX ?? 0),
    y: 0.2 + 0.6 * 0.56 + (opts?.noseOffsetY ?? 0),
  };
  return arr;
}

describe("Webcam AI — Tab Giám sát Ngồi học & Tập trung (FaceLandmarker)", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("khai báo đầy đủ thông số ngưỡng và đường dẫn mô hình cục bộ kèm CDN dự phòng", () => {
    expect(STUDY_FOCUS_THRESHOLDS.eyeBlinkScoreThreshold).toBeGreaterThan(0);
    expect(STUDY_FOCUS_THRESHOLDS.drowsyDurationMs).toBeGreaterThan(0);
    expect(FACE_LANDMARKER_ASSETS.localModelPath).toBe(
      "/models/face_landmarker.task"
    );
    expect(FACE_LANDMARKER_ASSETS.cdnModelPath).toContain(
      "face_landmarker.task"
    );
  });

  it("trích xuất chỉ số khuôn mặt từ kết quả FaceLandmarker (nhìn thẳng, quay mặt, nhắm mắt)", () => {
    const straightResult = extractFaceFrameMetrics({
      faceLandmarks: [createSyntheticFaceLandmarks()],
      faceBlendshapes: [
        {
          categories: [
            { categoryName: "eyeBlinkLeft", score: 0.1 },
            { categoryName: "eyeBlinkRight", score: 0.12 },
          ],
        },
      ],
    });
    expect(straightResult.hasFace).toBe(true);
    expect(straightResult.eyeClosureScore).toBe(0.1);
    expect(Math.abs(straightResult.yawDeg)).toBeLessThan(5);
    expect(Math.abs(straightResult.pitchDeg)).toBeLessThan(5);

    const turnedAndClosed = extractFaceFrameMetrics({
      faceLandmarks: [createSyntheticFaceLandmarks({ noseOffsetX: 0.12 })],
      faceBlendshapes: [
        {
          categories: [
            { categoryName: "eyeBlinkLeft", score: 0.82 },
            { categoryName: "eyeBlinkRight", score: 0.78 },
          ],
        },
      ],
    });
    expect(turnedAndClosed.hasFace).toBe(true);
    expect(turnedAndClosed.eyeClosureScore).toBe(0.78);
    expect(Math.abs(turnedAndClosed.yawDeg)).toBeGreaterThan(
      STUDY_FOCUS_THRESHOLDS.headYawDistractionDeg
    );
  });

  it("phát hiện chính xác trạng thái tập trung, buồn ngủ, mất tập trung và vắng mặt theo ngưỡng thời gian", () => {
    const tracker = new StudyFocusTracker(STUDY_FOCUS_THRESHOLDS);
    const focusedMetrics = {
      hasFace: true,
      eyeClosureScore: 0.1,
      yawDeg: 2,
      pitchDeg: 0,
      rollDeg: 0,
    };

    // Tập trung trong 2 giây
    let snap = tracker.processFrame(focusedMetrics, 0);
    snap = tracker.processFrame(focusedMetrics, 1000);
    snap = tracker.processFrame(focusedMetrics, 2000);
    expect(snap.status).toBe("focused");
    expect(snap.focusScorePercent).toBe(100);
    expect(snap.drowsinessAlertCount).toBe(0);
    expect(snap.distractionCount).toBe(0);

    // Nhắm mắt liên tục vượt drowsyDurationMs (1800ms) -> cảnh báo buồn ngủ
    const drowsyMetrics = {
      hasFace: true,
      eyeClosureScore: 0.85,
      yawDeg: 0,
      pitchDeg: 5,
      rollDeg: 0,
    };
    tracker.processFrame(drowsyMetrics, 2600);
    tracker.processFrame(drowsyMetrics, 3200);
    snap = tracker.processFrame(drowsyMetrics, 4000);
    expect(snap.status).toBe("drowsy");
    expect(snap.drowsinessAlertCount).toBe(1);
    expect(snap.justTriggeredAlert).toBe("drowsy");

    // Quay mặt đi liên tục vượt distractionDurationMs (3000ms) -> tăng xao nhãng
    const distractedMetrics = {
      hasFace: true,
      eyeClosureScore: 0.1,
      yawDeg: 40,
      pitchDeg: 0,
      rollDeg: 0,
    };
    tracker.processFrame(distractedMetrics, 5000);
    tracker.processFrame(distractedMetrics, 6000);
    snap = tracker.processFrame(distractedMetrics, 7000);
    expect(snap.status).toBe("distracted");
    expect(snap.distractionCount).toBe(1);
    expect(snap.justTriggeredAlert).toBe("distracted");

    // Rời khỏi bàn học vượt absenceDurationMs (4000ms) + cooldown -> báo vắng mặt
    const absentMetrics = {
      hasFace: false,
      eyeClosureScore: 0,
      yawDeg: 0,
      pitchDeg: 0,
      rollDeg: 0,
    };
    tracker.processFrame(absentMetrics, 10000);
    tracker.processFrame(absentMetrics, 11000);
    tracker.processFrame(absentMetrics, 12000);
    tracker.processFrame(absentMetrics, 13000);
    snap = tracker.processFrame(absentMetrics, 14200);
    expect(snap.status).toBe("absent");
    expect(snap.distractionCount).toBe(2);
    expect(snap.focusScorePercent).toBeLessThan(100);
  });

  it("hỗ trợ bật/tắt nhanh Chế độ Ẩn mặt và lưu FocusSession vào local-db.ts khi hoàn tất phiên học", () => {
    const initialState = loadAppState();
    const initialSessionCount = initialState.focusSessions.length;

    render(<WebcamPlaceholder />);

    // Kiểm tra nút bật/tắt nhanh Chế độ Ẩn mặt
    const privacyToggleBtn = screen.getByTestId("toggle-privacy-face-mode");
    expect(privacyToggleBtn).toHaveAttribute("aria-pressed", "true");
    expect(privacyToggleBtn).toHaveTextContent(/Ẩn mặt: Đang bật/i);

    fireEvent.click(privacyToggleBtn);
    expect(privacyToggleBtn).toHaveAttribute("aria-pressed", "false");
    expect(privacyToggleBtn).toHaveTextContent(/Ẩn mặt: Đang tắt/i);

    fireEvent.click(privacyToggleBtn);
    expect(privacyToggleBtn).toHaveAttribute("aria-pressed", "true");

    // Lưu phiên học Pomodoro vào local-db.ts
    const saveStudyBtn = screen.getByRole("button", {
      name: /Hoàn tất & Lưu phiên học/i,
    });
    fireEvent.click(saveStudyBtn);

    const updatedState = loadAppState();
    expect(updatedState.focusSessions.length).toBe(initialSessionCount + 1);
    const saved =
      updatedState.focusSessions[updatedState.focusSessions.length - 1];
    expect(saved.mode).toBe("study_focus");
    expect(saved.pomodoroPreset).toBe("25_5");
    expect(saved.focusScorePercent).toBe(100);
    expect(saved.drowsinessAlertCount).toBe(0);
    expect(screen.getByText(/Đã lưu phiên học/i)).toBeInTheDocument();
  });

  it("tự động lưu FocusSession đúng 1 lần khi đồng hồ Pomodoro đếm ngược kết thúc", () => {
    vi.useFakeTimers();
    try {
      const initialState = loadAppState();
      const initialSessionCount = initialState.focusSessions.length;

      render(<WebcamPlaceholder />);

      const startTimerBtn = screen.getByRole("button", {
        name: /Chạy đồng hồ/i,
      });
      fireEvent.click(startTimerBtn);

      act(() => {
        vi.advanceTimersByTime(25 * 60 * 1000);
      });

      const updatedState = loadAppState();
      expect(updatedState.focusSessions.length).toBe(initialSessionCount + 1);
      const saved =
        updatedState.focusSessions[updatedState.focusSessions.length - 1];
      expect(saved.durationMinutes).toBe(25);
      expect(saved.mode).toBe("study_focus");
      expect(
        screen.getByText(/Hoàn tất chu kỳ Pomodoro!/i)
      ).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("lọc bỏ log INFO vô hại của MediaPipe XNNPACK nhưng vẫn giữ nguyên lỗi thật", () => {
    expect(
      isBenignMediaPipeStderr([
        "INFO: Created TensorFlow Lite XNNPACK delegate for CPU.",
      ])
    ).toBe(true);
    expect(isBenignMediaPipeStderr(["TypeError: Real bug"])).toBe(false);

    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      runWithFilteredMediaPipeLogs(() => {
        console.error(
          "INFO: Created TensorFlow Lite XNNPACK delegate for CPU."
        );
        console.error("Real unexpected error");
      });
      expect(errSpy).toHaveBeenCalledTimes(1);
      expect(errSpy).toHaveBeenCalledWith("Real unexpected error");
    } finally {
      errSpy.mockRestore();
    }
  });

  it("ưu tiên chọn webcam laptop vật lý và tránh camera ảo điện thoại (như Galaxy S23 Ultra / Phone Link)", () => {
    const devices = [
      { deviceId: "cam-phone", label: "Samsung Galaxy S23 Ultra (Phone Link)" },
      { deviceId: "cam-virtual", label: "Windows Virtual Camera" },
      { deviceId: "cam-laptop", label: "Integrated HD Webcam" },
    ];

    expect(pickPreferredCameraDeviceId(devices)).toBe("cam-laptop");
    expect(pickPreferredCameraDeviceId(devices, "cam-phone")).toBe("cam-phone");
  });

  it("nhận diện chính xác Điện thoại và iPad/Màn hình phụ (bỏ qua TV nhỏ xa và sách vở)", () => {
    expect(OBJECT_DETECTOR_ASSETS.localModelPath).toBe(
      "/models/efficientdet_lite0.tflite"
    );
    expect(HAND_LANDMARKER_ASSETS.localModelPath).toBe(
      "/models/hand_landmarker.task"
    );

    const detected = extractDistractionDevices(
      {
        detections: [
          {
            categories: [{ categoryName: "cell phone", score: 0.72 }],
            boundingBox: { originX: 120, originY: 140, width: 90, height: 150 },
          },
          {
            categories: [{ categoryName: "tv", score: 0.65 }],
            // iPad/màn hình phụ lớn trước mặt (~10% diện tích 640x360)
            boundingBox: { originX: 200, originY: 120, width: 160, height: 150 },
          },
          {
            categories: [{ categoryName: "tv", score: 0.65 }],
            // TV nhỏ xa tít phía sau (~0.5% diện tích) -> phải bỏ qua
            boundingBox: { originX: 10, originY: 10, width: 40, height: 30 },
          },
          {
            categories: [{ categoryName: "book", score: 0.9 }],
            boundingBox: { originX: 100, originY: 200, width: 180, height: 120 },
          },
        ],
      },
      640,
      360
    );

    expect(detected).toHaveLength(2);
    expect(detected[0].kind).toBe("phone");
    expect(detected[0].label).toBe("Điện thoại");
    expect(detected[1].kind).toBe("tablet_screen");
    expect(detected[1].label).toBe("iPad / Màn hình phụ");
  });

  it("nhận diện cử chỉ tay lướt lặp lại và không báo nhầm khi chống cằm hoặc đưa cả cánh tay", () => {
    const createHand = (
      wristX: number,
      wristY: number,
      thumbDy: number
    ): HandLandmarkPoint[] => {
      const pts: HandLandmarkPoint[] = Array.from({ length: 21 }, () => ({
        x: wristX,
        y: wristY,
      }));
      pts[0] = { x: wristX, y: wristY };
      pts[4] = { x: wristX + 0.03, y: wristY - 0.1 + thumbDy };
      pts[8] = { x: wristX + 0.06, y: wristY - 0.14 };
      return pts;
    };

    // 1. Giả lập vuốt ngón cái lên xuống lặp lại -> phát hiện đang lướt
    const scrollDetector = new HandScrollDetector(STUDY_FOCUS_THRESHOLDS);
    const pattern = [0, -0.04, 0.01, -0.045, 0.01, -0.04];
    let lastSnap = scrollDetector.processHands([createHand(0.5, 0.7, 0)], 0);
    pattern.forEach((dy, idx) => {
      lastSnap = scrollDetector.processHands(
        [createHand(0.5, 0.7, dy)],
        (idx + 1) * 200
      );
    });
    expect(lastSnap.hasHands).toBe(true);
    expect(lastSnap.isScrolling).toBe(true);
    expect(lastSnap.dominantAxis).toBe("vertical");

    // 2. Giả lập tay đứng yên chống cằm -> không báo lướt
    const stillDetector = new HandScrollDetector(STUDY_FOCUS_THRESHOLDS);
    let stillSnap = stillDetector.processHands([createHand(0.5, 0.5, 0)], 0);
    for (let i = 1; i <= 5; i++) {
      stillSnap = stillDetector.processHands(
        [createHand(0.5, 0.5, 0.004 * (i % 2))],
        i * 200
      );
    }
    expect(stillSnap.isScrolling).toBe(false);
  });

  it("cảnh báo khi cầm điện thoại/lướt tay và hỗ trợ Chế độ Ghi chép vở không nhắc nhầm khi cúi viết bài", () => {
    const tracker = new StudyFocusTracker(STUDY_FOCUS_THRESHOLDS);
    const straightFace = {
      hasFace: true,
      eyeClosureScore: 0.1,
      eyeLookDownScore: 0.1,
      yawDeg: 0,
      pitchDeg: 0,
      rollDeg: 0,
    };
    const fakePhone = {
      kind: "phone" as const,
      label: "Điện thoại",
      rawCategory: "cell phone",
      score: 0.82,
      boundingBox: { originX: 100, originY: 120, width: 80, height: 140 },
    };

    // Xem giờ lướt qua 1s -> chưa phạt
    tracker.processFrame(straightFace, 0, { detectedDevices: [fakePhone] });
    let snap = tracker.processFrame(straightFace, 1000, {
      detectedDevices: [fakePhone],
    });
    expect(snap.status).toBe("focused");
    expect(snap.deviceDistractionCount).toBe(0);

    // Giữ điện thoại quá 2.2s -> báo phone_distracted
    tracker.processFrame(straightFace, 1800, { detectedDevices: [fakePhone] });
    snap = tracker.processFrame(straightFace, 2600, {
      detectedDevices: [fakePhone],
    });
    expect(snap.status).toBe("phone_distracted");
    expect(snap.deviceDistractionCount).toBe(1);
    expect(snap.justTriggeredAlert).toBe("phone_distracted");

    // Chế độ Ghi chép vở: cúi nhẹ viết bài (pitch 18 độ, nhìn xuống 0.75) vẫn giữ trạng thái focused
    const writingFace = {
      hasFace: true,
      eyeClosureScore: 0.15,
      eyeLookDownScore: 0.75,
      yawDeg: 4,
      pitchDeg: 18,
      rollDeg: 0,
    };
    for (let t = 4000; t <= 9000; t += 1000) {
      snap = tracker.processFrame(writingFace, t, {
        detectedDevices: [],
        isHandScrolling: false,
        noteTakingMode: true,
      });
    }
    expect(snap.status).toBe("focused");

    // Kiểm tra 2 nút bật/tắt mới trên giao diện WebcamPlaceholder
    render(<WebcamPlaceholder />);
    const deviceToggle = screen.getByTestId("toggle-device-hand-detection");
    const noteToggle = screen.getByTestId("toggle-note-taking-mode");
    expect(deviceToggle).toHaveAttribute("aria-pressed", "true");
    expect(noteToggle).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(noteToggle);
    expect(noteToggle).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(deviceToggle);
    expect(deviceToggle).toHaveAttribute("aria-pressed", "false");
  });

  it("kích hoạt phạt kết thúc phiên & đặt 0 phút tích lũy khi xao nhãng > 10 HOẶC độ tập trung < 75% (hoặc cả hai)", () => {
    // 1. Đúng ngưỡng an toàn (10 lần, 75%) -> chưa phạt
    const safeEval = evaluateStudyPenalty(10, 75, 20000);
    expect(safeEval.shouldTerminateWithPenalty).toBe(false);

    // 2. Chỉ vi phạm xao nhãng > 10 (11 lần, 88%) -> phạt
    const onlyDistractions = evaluateStudyPenalty(11, 88, 20000);
    expect(onlyDistractions.shouldTerminateWithPenalty).toBe(true);
    expect(onlyDistractions.tooManyDistractions).toBe(true);
    expect(onlyDistractions.lowFocusScore).toBe(false);

    // 3. Chỉ vi phạm tập trung < 75% (3 lần, 74%, đã qua thời gian đệm) -> phạt
    const onlyLowFocus = evaluateStudyPenalty(3, 74, 20000);
    expect(onlyLowFocus.shouldTerminateWithPenalty).toBe(true);
    expect(onlyLowFocus.tooManyDistractions).toBe(false);
    expect(onlyLowFocus.lowFocusScore).toBe(true);

    // 4. Vi phạm cả hai (12 lần, 68%) -> phạt và nêu rõ cả 2 lý do
    const bothTriggered = evaluateStudyPenalty(12, 68, 20000);
    expect(bothTriggered.shouldTerminateWithPenalty).toBe(true);
    expect(bothTriggered.tooManyDistractions).toBe(true);
    expect(bothTriggered.lowFocusScore).toBe(true);
    expect(bothTriggered.penaltyReason).toMatch(/vượt quá 10/i);
    expect(bothTriggered.penaltyReason).toMatch(/dưới 75%/i);

    // 5. Ghi nhận phiên phạt vào local-db: durationMinutes = 0 và KHÔNG cộng phút vào mục tiêu
    const beforeState = createDefaultState();
    const beforeGoalHours = beforeState.goals[0].completedHours;
    const afterPenalty = recordPenalizedStudySessionInState(beforeState, {
      presetId: "25_5",
      focusScorePercent: 68,
      distractionCount: 12,
      drowsinessAlertCount: 1,
      penaltyReason: bothTriggered.penaltyReason!,
    });

    expect(afterPenalty.goals[0].completedHours).toBe(beforeGoalHours);
    const saved =
      afterPenalty.focusSessions[afterPenalty.focusSessions.length - 1];
    expect(saved.durationMinutes).toBe(0);
    expect(saved.penalized).toBe(true);
    expect(saved.distractionCount).toBe(12);
    expect(saved.focusScorePercent).toBe(68);
  });

  it("hiển thị nút nghe thử tiếng típ típ và đường dẫn âm thanh chuẩn", () => {
    expect(STUDY_FOCUS_THRESHOLDS.alertBeepAudioPath).toBe(
      "/sounds/tip-tip-tip.mp3"
    );
    render(<WebcamPlaceholder />);
    const testSoundBtn = screen.getByTestId("test-tip-sound-btn");
    expect(testSoundBtn).toBeInTheDocument();
    fireEvent.click(testSoundBtn);
  });
});
