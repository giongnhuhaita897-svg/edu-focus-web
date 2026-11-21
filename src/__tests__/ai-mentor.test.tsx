import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import {
  createDefaultState,
  loadAppState,
  recordPenalizedStudySessionInState,
  saveAppState,
} from "@/lib/storage/local-db";
import {
  analyzeStudentProgress,
  generateMentorResponse,
  parseCustomGoalFromPrompt,
  parseCustomScheduleFromPrompt,
} from "@/modules/ai-tutor/ai-engine";
import { AIMentorPlaceholder } from "@/modules/ai-tutor/AIMentorPlaceholder";

describe("Cố vấn Học tập AI Mentor v2 — Chẩn đoán Kỷ luật Đa chiều, Nhớ ngữ cảnh & Lập Kế hoạch Thực chất", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("1. Chẩn đoán chính xác dữ liệu kỷ luật Webcam (phiên bị phạt 0 phút, cảnh báo gục đầu buồn ngủ)", () => {
    let state = createDefaultState();
    state = recordPenalizedStudySessionInState(state, {
      presetId: "50_15",
      focusScorePercent: 68,
      distractionCount: 11,
      drowsinessAlertCount: 3,
      penaltyReason: "Gục đầu buồn ngủ và xao nhãng quá 10 lần",
    });

    const analysis = analyzeStudentProgress(state, "2026-11-21");
    expect(analysis.habits.penalizedSessionsCount).toBe(1);
    expect(analysis.habits.totalDrowsinessAlerts).toBe(3);
    expect(analysis.habits.hasDrowsinessRisk).toBe(true);

    const reply = generateMentorResponse(
      state,
      "Tối nay tớ hay buồn ngủ và vừa bị phạt thì chọn Pomodoro nào?",
      "2026-11-21"
    );
    expect(reply.content).toMatch(/1 phiên bị phạt 0 phút/i);
    expect(reply.content).toMatch(/3 lần cảnh báo gục đầu\/buồn ngủ/i);
  });

  it("2. Hiểu ngôn ngữ tự nhiên: lập lịch theo buổi (tối mai), lộ trình nhiều ngày (3 ngày tới) và nhớ môn học từ câu chat trước (history)", () => {
    const state = createDefaultState();

    // Lập lịch theo buổi tự nhiên + ngày mai mà không cần gõ số giờ HH:mm
    const tomorrowEveningPlan = parseCustomScheduleFromPrompt(
      state,
      "Xếp lịch học Cấu trúc dữ liệu tối mai giúp tớ",
      "2026-11-21"
    );
    expect(tomorrowEveningPlan).toHaveLength(1);
    expect(tomorrowEveningPlan[0].date).toBe("2026-11-22");
    expect(tomorrowEveningPlan[0].goalId).toBe("goal-dsa");
    expect(tomorrowEveningPlan[0].startTime).toBe("19:30");

    // Lập lộ trình 3 ngày liên tiếp
    const multiDayPlan = parseCustomScheduleFromPrompt(
      state,
      "Lập kế hoạch ôn IELTS trong 3 ngày tới",
      "2026-11-21"
    );
    expect(multiDayPlan).toHaveLength(3);
    expect(multiDayPlan.map((p) => p.date)).toEqual([
      "2026-11-21",
      "2026-11-22",
      "2026-11-23",
    ]);
    expect(multiDayPlan.every((p) => p.goalId === "goal-ielts")).toBe(true);

    // Thảo luận nhiều lượt: câu 1 nói về IELTS, câu 2 chỉ nói "Đổi sang sáng mai lúc 08:30"
    const history = [
      { role: "user" as const, content: "Tớ đang cần đẩy nhanh môn IELTS" },
      {
        role: "assistant" as const,
        content: "Cậu muốn xếp lịch ôn IELTS vào khung giờ nào?",
      },
    ];
    const followUpPlan = parseCustomScheduleFromPrompt(
      state,
      "Đổi sang sáng mai lúc 08:30 giúp tớ nhé",
      "2026-11-21",
      history
    );
    expect(followUpPlan).toHaveLength(1);
    expect(followUpPlan[0].date).toBe("2026-11-22");
    expect(followUpPlan[0].startTime).toBe("08:30");
    expect(followUpPlan[0].endTime).toBe("09:20");
    expect(followUpPlan[0].goalId).toBe("goal-ielts");
  });

  it("3. Không chèn thẻ lịch mặc định gây rối mắt khi người dùng chỉ hỏi lý thuyết / phương pháp học", () => {
    const state = createDefaultState();
    const reply = generateMentorResponse(
      state,
      "Phương pháp Active Recall và Feynman là gì?",
      "2026-11-21"
    );
    expect(reply.content).toMatch(/Feynman/i);
    expect(reply.content).toMatch(/Active Recall/i);
    expect(reply.suggestedActions).toHaveLength(0);
  });

  it("4. Hỗ trợ nút 'Áp dụng tất cả (N buổi)' và khởi tạo Mục tiêu mới (Goal) 1-Click ngay trong khung chat", async () => {
    const initialState = createDefaultState();
    saveAppState(initialState);

    const parsedGoals = parseCustomGoalFromPrompt(
      "Tạo mục tiêu ôn Giải tích nâng cao 25 giờ hạn 2026-12-25",
      "2026-11-21"
    );
    expect(parsedGoals).toHaveLength(1);
    expect(parsedGoals[0].targetHours).toBe(25);
    expect(parsedGoals[0].deadline).toBe("2026-12-25");

    render(<AIMentorPlaceholder />);

    expect(screen.getByTestId("ai-discipline-habit-bar")).toBeInTheDocument();

    const chatInput = screen.getByLabelText(
      /Đặt câu hỏi hoặc yêu cầu Cố vấn AI/i
    );
    const sendBtn = screen.getByRole("button", { name: /Gửi tới Cố vấn AI/i });

    // A. Yêu cầu tạo lộ trình 3 ngày tới và bấm "Áp dụng tất cả (3 buổi)"
    fireEvent.change(chatInput, {
      target: { value: "Lập kế hoạch ôn IELTS trong 3 ngày tới" },
    });
    fireEvent.click(sendBtn);

    const applyAllBtn = await screen.findByRole("button", {
      name: /\+ Áp dụng tất cả \(3 buổi\)/i,
    });
    fireEvent.click(applyAllBtn);

    const stateAfterBatch = loadAppState();
    expect(stateAfterBatch.scheduleEvents.length).toBe(
      initialState.scheduleEvents.length + 3
    );

    // B. Yêu cầu tạo Mục tiêu mới trực tiếp từ khung chat và bấm "+ Tạo mục tiêu này"
    fireEvent.change(chatInput, {
      target: {
        value: "Tạo mục tiêu ôn Giải tích nâng cao 25 giờ hạn 2026-12-25",
      },
    });
    fireEvent.click(sendBtn);

    const createGoalBtn = await screen.findByRole("button", {
      name: /\+ Tạo mục tiêu này/i,
    });
    fireEvent.click(createGoalBtn);

    await waitFor(() => {
      const stateAfterGoal = loadAppState();
      expect(stateAfterGoal.goals.length).toBe(initialState.goals.length + 1);
      expect(
        stateAfterGoal.goals.some((g) =>
          g.title.toLowerCase().includes("giải tích nâng cao")
        )
      ).toBe(true);
    });
  });
});
