import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  addGoalToState,
  addScheduleEventToState,
  calculateEventDurationHours,
  calculateGoalProgress,
  createDefaultState,
  deleteGoalFromState,
  formatHoursAndMinutes,
  getDaysRemainingInfo,
  loadAppState,
  recordPomodoroWorkSessionInState,
  saveAppState,
  resetAppState,
  STORAGE_KEY,
} from "@/lib/storage/local-db";
import {
  analyzeStudentProgress,
  generateSmartScheduleSuggestions,
} from "@/modules/ai-tutor/ai-engine";
import { Sidebar } from "@/components/layout/Sidebar";
import DashboardPage from "@/app/page";
import { WebcamPlaceholder } from "@/modules/webcam/WebcamPlaceholder";
import { PomodoroHub } from "@/modules/pomodoro/PomodoroHub";
import { CalendarPlaceholder } from "@/modules/calendar/CalendarPlaceholder";
import { AIMentorPlaceholder } from "@/modules/ai-tutor/AIMentorPlaceholder";
import { GET, PUT } from "@/app/api/state/route";
import { POST as postAIMentor } from "@/app/api/ai-mentor/route";

let currentPathname = "/";

vi.mock("next/navigation", () => ({
  usePathname: () => currentPathname,
}));

describe("Giai đoạn 1, 2 & 3 — Khung dự án, Pomodoro, Webcam, Lịch trình & Cố vấn AI Mentor", () => {
  beforeEach(() => {
    window.localStorage.clear();
    currentPathname = "/";
  });

  it("tính toán phần trăm tiến độ, định dạng giờ/phút lẻ (25p, 50p) và đếm số ngày còn lại chính xác", () => {
    expect(calculateGoalProgress(18, 40)).toBe(45);
    expect(calculateGoalProgress(50, 40)).toBe(100);
    expect(calculateGoalProgress(10, 0)).toBe(0);
    expect(calculateEventDurationHours("08:00", "09:30")).toBe(1.5);
    expect(calculateEventDurationHours("15:00", "14:00")).toBe(0);

    expect(formatHoursAndMinutes(18)).toBe("18 giờ");
    expect(formatHoursAndMinutes(18 + 25 / 60)).toBe("18 giờ 25 phút");
    expect(formatHoursAndMinutes(18 + 50 / 60)).toBe("18 giờ 50 phút");
    expect(formatHoursAndMinutes(18 + 75 / 60)).toBe("19 giờ 15 phút");

    expect(getDaysRemainingInfo("2026-12-20", "2026-11-18")).toEqual({
      days: 32,
      label: "Còn 32 ngày",
      isOverdue: false,
      isUrgent: false,
    });
    expect(getDaysRemainingInfo("2026-11-18", "2026-11-18")).toEqual({
      days: 0,
      label: "Hết hạn hôm nay",
      isOverdue: false,
      isUrgent: true,
    });
    expect(getDaysRemainingInfo("2026-11-15", "2026-11-18")).toEqual({
      days: -3,
      label: "Quá hạn 3 ngày",
      isOverdue: true,
      isUrgent: true,
    });
  });

  it("khởi tạo, lưu và đọc dữ liệu từ localStorage chuẩn xác", () => {
    const initial = loadAppState();
    expect(initial.goals.length).toBeGreaterThanOrEqual(3);
    expect(window.localStorage.getItem(STORAGE_KEY)).not.toBeNull();

    const modified = {
      ...initial,
      goals: [
        ...initial.goals,
        {
          id: "goal-new",
          title: "Đọc sách chuyên ngành 30 phút mỗi tối",
          description: "Rèn thói quen đọc sâu",
          category: "skill" as const,
          targetHours: 20,
          completedHours: 5,
          deadline: "2026-12-30",
          progressPercent: 25,
          status: "active" as const,
        },
      ],
    };

    saveAppState(modified);
    const reloaded = loadAppState();
    expect(reloaded.goals).toHaveLength(initial.goals.length + 1);
    expect(reloaded.goals.at(-1)?.title).toBe(
      "Đọc sách chuyên ngành 30 phút mỗi tối"
    );

    const reset = resetAppState();
    expect(reset.goals).toHaveLength(initial.goals.length);
  });

  it("hiển thị thanh điều hướng Sidebar gồm cả mục Đồng hồ Pomodoro và Phòng Kỷ luật", () => {
    currentPathname = "/pomodoro";
    render(<Sidebar />);

    const nav = screen.getByRole("navigation", { name: "Điều hướng chính" });
    expect(nav).toBeInTheDocument();

    const overviewLink = screen.getByRole("link", { name: /Tổng quan/i });
    const calendarLink = screen.getByRole("link", {
      name: /Lịch trình & Mục tiêu/i,
    });
    const pomodoroLink = screen.getByRole("link", {
      name: /Đồng hồ Pomodoro/i,
    });
    const webcamLink = screen.getByRole("link", { name: /Phòng Kỷ luật/i });
    const aiLink = screen.getByRole("link", { name: /Cố vấn AI/i });

    expect(overviewLink).not.toHaveAttribute("aria-current");
    expect(calendarLink).not.toHaveAttribute("aria-current");
    expect(pomodoroLink).toHaveAttribute("aria-current", "page");
    expect(webcamLink).not.toHaveAttribute("aria-current");
    expect(aiLink).not.toHaveAttribute("aria-current");
  });

  it("hiển thị trang Tổng quan (Dashboard) với chỉ số kỷ luật, mục tiêu, lịch hôm nay và lời khuyên AI", () => {
    render(<DashboardPage />);

    expect(
      screen.getByRole("heading", {
        name: /Tổng quan Kỷ luật & Tiến độ Học tập/i,
      })
    ).toBeInTheDocument();

    expect(screen.getByText("100 phút")).toBeInTheDocument();
    expect(screen.getByText("2 / 4 buổi")).toBeInTheDocument();
    expect(screen.getByText("15 nhịp tập")).toBeInTheDocument();
    expect(
      screen.getByText(/Hoàn thành môn Cấu trúc dữ liệu & Giải thuật/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Lời khuyên từ Cố vấn AI Mentor/i)
    ).toBeInTheDocument();
  });

  it("Phòng Kỷ luật Webcam chia rõ 2 mục: Giám sát Ngồi học (mất tập trung/ngủ) & Giám sát Tập thể dục kèm tích hợp Pomodoro", () => {
    render(<WebcamPlaceholder />);

    const studyTab = screen.getByRole("tab", {
      name: /1\. Giám sát Ngồi học & Tập trung/i,
    });
    const exerciseTab = screen.getByRole("tab", {
      name: /2\. Giám sát Tập thể dục & Đếm nhịp/i,
    });

    expect(studyTab).toHaveAttribute("aria-selected", "true");
    expect(exerciseTab).toHaveAttribute("aria-selected", "false");

    expect(
      screen.getByText(/Phát hiện Đang ngủ \/ Gục đầu/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/Tích hợp Chu kỳ Pomodoro/i)).toBeInTheDocument();

    fireEvent.click(exerciseTab);
    expect(exerciseTab).toHaveAttribute("aria-selected", "true");
    expect(studyTab).toHaveAttribute("aria-selected", "false");
    expect(
      screen.getByText(/Khung Giám sát Vận động & Đếm nhịp Chuẩn xác/i)
    ).toBeInTheDocument();
  });

  it("Mục Đồng hồ Pomodoro cho phép chọn công việc/mục tiêu và cộng dồn chính xác 25 phút hoặc 50 phút sau khi hoàn tất phiên", () => {
    render(<PomodoroHub />);

    expect(screen.getByTestId("pomodoro-timer-display")).toHaveTextContent(
      "25:00"
    );
    expect(
      screen.getByTestId("pomodoro-selected-goal-progress")
    ).toHaveTextContent("Đã tích lũy: 18 giờ / 40 giờ (45%)");

    const completeWorkBtn = screen.getByRole("button", {
      name: /Hoàn tất phiên & Cộng \+25 phút/i,
    });
    fireEvent.click(completeWorkBtn);

    expect(
      screen.getByTestId("pomodoro-selected-goal-progress")
    ).toHaveTextContent("Đã tích lũy: 18 giờ 25 phút / 40 giờ (46%)");

    expect(screen.getByTestId("pomodoro-timer-display")).toHaveTextContent(
      "05:00"
    );

    const preset5015 = screen.getByRole("button", {
      name: /Deep Work 50\/15/i,
    });
    fireEvent.click(preset5015);
    expect(screen.getByTestId("pomodoro-timer-display")).toHaveTextContent(
      "15:00"
    );

    const workBtn = screen.getByRole("button", {
      name: /Pha Học \/ Làm việc \(50 phút\)/i,
    });
    fireEvent.click(workBtn);
    expect(screen.getByTestId("pomodoro-timer-display")).toHaveTextContent(
      "50:00"
    );
  });

  it("Giai đoạn 2: tích lũy phút chuẩn xác qua recordPomodoroWorkSessionInState (25p + 25p = 50p, + 50p = 1h40p)", () => {
    let state = createDefaultState();

    state = addGoalToState(state, {
      title: "Hoàn thành Đồ án Web Giáo dục",
      category: "academic",
      targetHours: 10,
      completedHours: 0,
      deadline: "2026-12-25",
    });
    const addedGoal = state.goals[0];

    state = addScheduleEventToState(state, {
      title: "Code phân hệ Lịch trình Giai đoạn 2",
      date: "2026-11-18",
      startTime: "14:00",
      endTime: "16:00",
      type: "study",
      goalId: addedGoal.id,
    });
    const addedEvt = state.scheduleEvents.find(
      (e) => e.title === "Code phân hệ Lịch trình Giai đoạn 2"
    )!;

    state = recordPomodoroWorkSessionInState(state, {
      presetId: "25_5",
      workMinutes: 25,
      goalId: addedGoal.id,
      scheduleEventId: addedEvt.id,
    });
    let updatedGoal = state.goals.find((g) => g.id === addedGoal.id)!;
    expect(formatHoursAndMinutes(updatedGoal.completedHours)).toBe("25 phút");

    state = recordPomodoroWorkSessionInState(state, {
      presetId: "25_5",
      workMinutes: 25,
      goalId: addedGoal.id,
    });
    updatedGoal = state.goals.find((g) => g.id === addedGoal.id)!;
    expect(formatHoursAndMinutes(updatedGoal.completedHours)).toBe("50 phút");

    state = recordPomodoroWorkSessionInState(state, {
      presetId: "50_15",
      workMinutes: 50,
      goalId: addedGoal.id,
    });
    updatedGoal = state.goals.find((g) => g.id === addedGoal.id)!;
    expect(formatHoursAndMinutes(updatedGoal.completedHours)).toBe(
      "1 giờ 40 phút"
    );

    state = deleteGoalFromState(state, addedGoal.id);
    expect(state.goals.find((g) => g.id === addedGoal.id)).toBeUndefined();
  });

  it("Giai đoạn 2 UI: hiển thị số ngày còn lại kế bên hạn hoàn thành và không có nút tự cộng +1h thủ công", () => {
    render(<CalendarPlaceholder />);

    expect(
      screen.getByTestId("goal-days-left-goal-dsa").textContent
    ).toMatch(/Còn \d+ ngày|Hết hạn hôm nay|Quá hạn/i);

    expect(screen.queryByRole("button", { name: /\+1h học/i })).toBeNull();

    const goalTitleInput = screen.getByLabelText(/Tên mục tiêu/i);
    const goalTargetInput = screen.getByLabelText(/Tổng số giờ cần đạt/i);
    fireEvent.change(goalTitleInput, {
      target: { value: "Ôn thi Giải tích 1 đạt điểm A" },
    });
    fireEvent.change(goalTargetInput, { target: { value: "25" } });

    const saveGoalBtn = screen.getByRole("button", {
      name: /Lưu mục tiêu mới/i,
    });
    fireEvent.click(saveGoalBtn);

    expect(
      screen.getAllByText(/Ôn thi Giải tích 1 đạt điểm A/i).length
    ).toBeGreaterThanOrEqual(1);

    const eventTitleInput = screen.getByLabelText(/Nội dung buổi lịch/i);
    fireEvent.change(eventTitleInput, {
      target: { value: "Giải 10 bài tích phân suy rộng" },
    });

    const addEventBtn = screen.getByRole("button", {
      name: /Thêm vào lịch trình/i,
    });
    fireEvent.click(addEventBtn);

    expect(
      screen.getByRole("heading", { name: /Giải 10 bài tích phân suy rộng/i })
    ).toBeInTheDocument();
  });

  it("Giai đoạn 3: phân tích định mức Pomodoro mỗi ngày, đề xuất khung giờ trống và áp dụng 1-click vào lịch trình", () => {
    const state = createDefaultState();
    const analysis = analyzeStudentProgress(state, "2026-11-18");

    expect(analysis.diagnostics).toHaveLength(3);
    expect(analysis.topPriorityGoal).not.toBeNull();

    const suggestions = generateSmartScheduleSuggestions(
      state,
      state.scheduleEvents[0].date
    );
    expect(suggestions.length).toBeGreaterThanOrEqual(2);

    render(<AIMentorPlaceholder />);

    expect(
      screen.getByRole("heading", {
        name: /Cố vấn Học tập AI Mentor/i,
      })
    ).toBeInTheDocument();

    // Bấm nút "Áp dụng vào lịch trình" đầu tiên -> tăng số sự kiện trong lịch
    const applyButtons = screen.getAllByRole("button", {
      name: /Áp dụng vào lịch trình/i,
    });
    expect(applyButtons.length).toBeGreaterThan(0);
    fireEvent.click(applyButtons[0]);

    const updatedState = loadAppState();
    expect(updatedState.scheduleEvents.length).toBe(
      state.scheduleEvents.length + 1
    );

    // Gửi câu hỏi tư vấn cho AI Mentor
    const chatInput = screen.getByLabelText(
      /Đặt câu hỏi hoặc yêu cầu Cố vấn AI/i
    );
    fireEvent.change(chatInput, {
      target: { value: "Tối nay tớ hay buồn ngủ thì chọn Pomodoro nào?" },
    });
    const sendBtn = screen.getByRole("button", { name: /Gửi tới Cố vấn AI/i });
    fireEvent.click(sendBtn);

    const afterChatState = loadAppState();
    expect(afterChatState.aiMessages.length).toBeGreaterThan(
      state.aiMessages.length
    );
  });

  it("API nội bộ /api/state và /api/ai-mentor hoạt động ổn định", async () => {
    const getRes = await GET();
    expect(getRes.status).toBe(200);
    const data = await getRes.json();
    expect(Array.isArray(data.goals)).toBe(true);

    const nextState = createDefaultState();
    nextState.goals[0].completedHours = 20;

    const putReq = new Request("http://localhost:3000/api/state", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(nextState),
    });
    const putRes = await PUT(putReq);
    expect(putRes.status).toBe(200);

    const aiReq = new Request("http://localhost:3000/api/ai-mentor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: "Đánh giá tiến độ mục tiêu của tớ",
        state: nextState,
      }),
    });
    const aiRes = await postAIMentor(aiReq);
    expect(aiRes.status).toBe(200);
    const aiData = await aiRes.json();
    expect(aiData.message.role).toBe("assistant");
    expect(Array.isArray(aiData.message.suggestedActions)).toBe(true);
  });
});
