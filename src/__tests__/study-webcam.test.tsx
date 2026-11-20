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

  it("chỉ phạt kết thúc phiên & đặt 0 phút tích lũy khi số đợt xao nhãng > 10 (đã bỏ quy tắc phạt dưới 75%)", () => {
    // 1. Đúng ngưỡng an toàn (10 đợt) -> chưa phạt
    const safeEval = evaluateStudyPenalty(10);
    expect(safeEval.shouldTerminateWithPenalty).toBe(false);
    expect(safeEval.tooManyDistractions).toBe(false);
    expect(safeEval.penaltyReason).toBeNull();

    // 2. Độ tập trung tụt xuống dưới 75% (nhưng số đợt xao nhãng <= 10) -> KHÔNG bị phạt làm lại
    const tracker = new StudyFocusTracker(STUDY_FOCUS_THRESHOLDS);
    const absentMetrics = {
      hasFace: false,
      eyeClosureScore: 0,
      yawDeg: 0,
      pitchDeg: 0,
      rollDeg: 0,
    };
    let snap = tracker.processFrame(absentMetrics, 0);
    for (let t = 1000; t <= 15000; t += 1000) {
      snap = tracker.processFrame(absentMetrics, t);
    }
    expect(snap.focusScorePercent).toBeLessThan(75);
    expect(snap.distractionCount).toBe(1); // 1 đợt vắng mặt liên tục chỉ đếm 1 đợt
    expect(snap.shouldTerminateWithPenalty).toBe(false);

    // 3. Vi phạm xao nhãng > 10 (11 đợt) -> phạt về 0 phút
    const penaltyEval = evaluateStudyPenalty(11);
    expect(penaltyEval.shouldTerminateWithPenalty).toBe(true);
    expect(penaltyEval.tooManyDistractions).toBe(true);
    expect(penaltyEval.penaltyReason).toMatch(/vượt quá 10/i);

    // 4. Ghi nhận phiên phạt vào local-db: durationMinutes = 0 và KHÔNG cộng phút vào mục tiêu
    const beforeState = createDefaultState();
    const beforeGoalHours = beforeState.goals[0].completedHours;
    const afterPenalty = recordPenalizedStudySessionInState(beforeState, {
      presetId: "25_5",
      focusScorePercent: 68,
      distractionCount: 11,
      drowsinessAlertCount: 1,
      penaltyReason: penaltyEval.penaltyReason!,
    });

    expect(afterPenalty.goals[0].completedHours).toBe(beforeGoalHours);
    const saved =
      afterPenalty.focusSessions[afterPenalty.focusSessions.length - 1];
    expect(saved.durationMinutes).toBe(0);
    expect(saved.penalized).toBe(true);
    expect(saved.distractionCount).toBe(11);
    expect(saved.focusScorePercent).toBe(68);
  });

  it("quan sát kiểu 'người quan sát người': nhận diện ngủ gật tinh tế (chớp mắt chậm, gật gù, gục hẳn xuống bàn) và bấm điện thoại dưới bàn", () => {
    const tracker = new StudyFocusTracker(STUDY_FOCUS_THRESHOLDS);
    const calmFace = {
      hasFace: true,
      eyeClosureScore: 0.08,
      eyeLookDownScore: 0.05,
      jawOpenScore: 0.05,
      yawDeg: 0,
      pitchDeg: 0,
      rollDeg: 0,
    };

    // 1. Làm quen tư thế ngồi bình thường trong 2 giây
    for (let t = 0; t <= 2000; t += 500) {
      tracker.processFrame(calmFace, t);
    }
    expect(tracker.getSnapshot().isCalibrated).toBe(true);

    // 2. Ba lần chớp mắt chậm (díp mắt 600ms mỗi lần) -> nhận ra đang buồn ngủ (long_blinks)
    let now = 2500;
    for (let i = 0; i < 3; i++) {
      tracker.processFrame({ ...calmFace, eyeClosureScore: 0.75 }, now);
      now += 650;
      tracker.processFrame(calmFace, now);
      now += 400;
    }
    let snap = tracker.getSnapshot();
    expect(snap.status).toBe("drowsy");
    expect(snap.drowsyReason).toBe("long_blinks");
    expect(snap.drowsinessAlertCount).toBe(1);

    // 3. Đang buồn ngủ rồi gục hẳn đầu xuống bàn (camera mất dấu khuôn mặt) -> vẫn giữ trạng thái buồn ngủ (face_down_desk), không báo nhầm vắng mặt
    for (let dt = 500; dt <= 4000; dt += 500) {
      snap = tracker.processFrame(
        {
          hasFace: false,
          eyeClosureScore: 0,
          yawDeg: 0,
          pitchDeg: 0,
          rollDeg: 0,
        },
        now + dt
      );
    }
    expect(snap.status).toBe("drowsy");
    expect(snap.drowsyReason).toBe("face_down_desk");

    // 4. Ngồi dậy tập trung lại, sau đó cúi nhìn xuống kèm đặt tay thấp dưới bàn (bấm điện thoại dưới gầm bàn dù camera không thấy chiếc ĐT)
    now += 5000;
    for (let dt = 0; dt <= 3000; dt += 500) {
      tracker.processFrame(calmFace, now + dt);
    }
    now += 3500;
    const underDeskPhoneFace = {
      ...calmFace,
      eyeLookDownScore: 0.68,
      pitchDeg: 15,
    };
    for (let dt = 0; dt <= 2400; dt += 400) {
      snap = tracker.processFrame(underDeskPhoneFace, now + dt, {
        handsVisible: true,
        handsInLowerZone: true,
      });
    }
    expect(snap.status).toBe("phone_distracted");
    expect(snap.distractionReason).toBe("phone_posture");
    expect(snap.observerNote).toMatch(/bấm điện thoại/i);
  });

  it("hiển thị nút nghe thử tiếng típ típ, lời nhận xét của Người bạn đồng hành và quy tắc không phạt dưới 75%", () => {
    expect(STUDY_FOCUS_THRESHOLDS.alertBeepAudioPath).toBe(
      "/sounds/tip-tip-tip.mp3"
    );
    render(<WebcamPlaceholder />);
    const testSoundBtn = screen.getByTestId("test-tip-sound-btn");
    expect(testSoundBtn).toBeInTheDocument();
    fireEvent.click(testSoundBtn);

    expect(screen.getByTestId("study-observer-note")).toHaveTextContent(
      /Người bạn đồng hành/i
    );
    expect(
      screen.getByText(/không bị phạt làm lại khi tụt dưới 75%/i)
    ).toBeInTheDocument();
  });
});
