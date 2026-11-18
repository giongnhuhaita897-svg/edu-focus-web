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
  loadAppState,
  saveAppState,
  resetAppState,
  STORAGE_KEY,
  updateScheduleEventStatusInState,
} from "@/lib/storage/local-db";
import { Sidebar } from "@/components/layout/Sidebar";
import DashboardPage from "@/app/page";
import { WebcamPlaceholder } from "@/modules/webcam/WebcamPlaceholder";
import { PomodoroHub } from "@/modules/pomodoro/PomodoroHub";
import { CalendarPlaceholder } from "@/modules/calendar/CalendarPlaceholder";
import { GET, PUT } from "@/app/api/state/route";

let currentPathname = "/";

vi.mock("next/navigation", () => ({
  usePathname: () => currentPathname,
}));

describe("Giai đoạn 1 & 2 — Khung dự án, Pomodoro, Webcam & Hệ thống Lịch trình - Mục tiêu", () => {
  beforeEach(() => {
    window.localStorage.clear();
    currentPathname = "/";
  });

  it("tính toán phần trăm tiến độ mục tiêu và thời lượng sự kiện chính xác", () => {
    expect(calculateGoalProgress(18, 40)).toBe(45);
    expect(calculateGoalProgress(50, 40)).toBe(100);
    expect(calculateGoalProgress(10, 0)).toBe(0);
    expect(calculateEventDurationHours("08:00", "09:30")).toBe(1.5);
    expect(calculateEventDurationHours("15:00", "14:00")).toBe(0);
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

  it("Mục riêng Đồng hồ Pomodoro hỗ trợ chu kỳ 25/5 và 50/15 theo cấu trúc Học/Làm và Nghỉ", () => {
    render(<PomodoroHub />);

    expect(screen.getByTestId("pomodoro-timer-display")).toHaveTextContent(
      "25:00"
    );

    const breakBtn = screen.getByRole("button", {
      name: /Pha Nghỉ giải lao \(5 phút\)/i,
    });
    fireEvent.click(breakBtn);
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

  it("Giai đoạn 2: cho phép thêm/xóa mục tiêu, thêm sự kiện lịch và tự động cộng giờ khi hoàn thành buổi lịch", () => {
    let state = createDefaultState();

    // 1. Thêm mục tiêu mới
    state = addGoalToState(state, {
      title: "Hoàn thành Đồ án Web Giáo dục",
      category: "academic",
      targetHours: 20,
      completedHours: 2,
      deadline: "2026-12-25",
    });
    const addedGoal = state.goals[0];
    expect(addedGoal.title).toBe("Hoàn thành Đồ án Web Giáo dục");
    expect(addedGoal.progressPercent).toBe(10);

    // 2. Thêm buổi lịch 2 giờ gắn với mục tiêu mới
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
    );
    expect(addedEvt).toBeDefined();

    // 3. Đánh dấu hoàn thành buổi lịch -> tự động cộng 2 giờ vào mục tiêu (2 + 2 = 4h -> 20%)
    state = updateScheduleEventStatusInState(
      state,
      addedEvt!.id,
      "completed"
    );
    const updatedGoal = state.goals.find((g) => g.id === addedGoal.id)!;
    expect(updatedGoal.completedHours).toBe(4);
    expect(updatedGoal.progressPercent).toBe(20);

    // 4. Xóa mục tiêu -> gỡ liên kết goalId trên sự kiện mà không làm mất sự kiện
    state = deleteGoalFromState(state, addedGoal.id);
    expect(state.goals.find((g) => g.id === addedGoal.id)).toBeUndefined();
    const unlinkedEvt = state.scheduleEvents.find(
      (e) => e.id === addedEvt!.id
    );
    expect(unlinkedEvt?.goalId).toBeUndefined();
  });

  it("Giai đoạn 2 UI: tạo mục tiêu mới và tạo buổi lịch mới ngay trên giao diện CalendarPlaceholder", () => {
    render(<CalendarPlaceholder />);

    // Tạo mục tiêu mới trên form
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

    // Tạo sự kiện lịch mới trên form
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

  it("API nội bộ /api/state hỗ trợ GET và PUT dữ liệu trạng thái", async () => {
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
    const updated = await putRes.json();
    expect(updated.goals[0].completedHours).toBe(20);
  });
});
