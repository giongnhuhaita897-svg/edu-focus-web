import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  FACE_LANDMARKER_ASSETS,
  STUDY_FOCUS_THRESHOLDS,
} from "@/modules/webcam/thresholds";
import {
  extractFaceFrameMetrics,
  NormalizedLandmarkPoint,
  StudyFocusTracker,
} from "@/modules/webcam/study-tracker";
import { WebcamPlaceholder } from "@/modules/webcam/WebcamPlaceholder";
import { loadAppState } from "@/lib/storage/local-db";

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
});
