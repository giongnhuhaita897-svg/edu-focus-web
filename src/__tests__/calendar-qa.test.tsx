import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { CalendarPlaceholder } from "@/modules/calendar/CalendarPlaceholder";
import { WebcamPlaceholder } from "@/modules/webcam/WebcamPlaceholder";
import { WeekCalendarGrid } from "@/modules/calendar/WeekCalendarGrid";
import { findOverlappingEvent, getWeekDates } from "@/modules/calendar/calendar-utils";
import { CameraPrivacyGuide } from "@/components/onboarding/CameraPrivacyGuide";
import GlobalError from "@/app/error";
import {
  addScheduleEventToState,
  clearToEmptyState,
  createDefaultState,
  loadAppState,
  saveAppState,
} from "@/lib/storage/local-db";
import { analyzeStudentProgress, generateMentorResponse } from "@/modules/ai-tutor/ai-engine";
import type { ScheduleEvent } from "@/types/database";
import { POST as postAIMentor } from "@/app/api/ai-mentor/route";

vi.mock("next/navigation", () => ({ usePathname: () => "/calendar" }));

const event = (overrides: Partial<ScheduleEvent> = {}): ScheduleEvent => ({
  id: "evt-a",
  title: "Toán học",
  date: "2026-11-23",
  startTime: "09:00",
  endTime: "10:00",
  type: "study",
  status: "planned",
  ...overrides,
});

describe("Dũng — Calendar, Onboarding và QA", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("tạo đúng 7 ngày từ Thứ 2 đến Chủ nhật, kể cả khi ngày neo nằm giữa tuần", () => {
    expect(getWeekDates("2026-11-25")).toEqual([
      "2026-11-23", "2026-11-24", "2026-11-25", "2026-11-26",
      "2026-11-27", "2026-11-28", "2026-11-29",
    ]);
    render(<WeekCalendarGrid events={[]} initialDate="2026-11-25" />);
    expect(screen.getByText("Thứ 2")).toBeInTheDocument();
    expect(screen.getByText("Thứ 7")).toBeInTheDocument();
    expect(screen.getByText("Chủ nhật")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(7);
  });

  it("phát hiện trùng giờ cùng ngày, cho phép giờ nối tiếp và bỏ qua ID đang sửa", () => {
    const events = [event()];
    expect(findOverlappingEvent(events, {
      date: "2026-11-23", startTime: "09:30", endTime: "10:30",
    })?.id).toBe("evt-a");
    expect(findOverlappingEvent(events, {
      date: "2026-11-23", startTime: "10:00", endTime: "11:00",
    })).toBeNull();
    expect(findOverlappingEvent(events, {
      date: "2026-11-23", startTime: "09:00", endTime: "10:00",
    }, "evt-a")).toBeNull();
    expect(findOverlappingEvent(events, {
      date: "2026-11-24", startTime: "09:15", endTime: "09:45",
    })).toBeNull();
  });

  it("chặn tạo buổi lịch mới khi trùng giờ với lịch đã có", () => {
    let state = clearToEmptyState();
    state = addScheduleEventToState(state, {
      title: "Buổi Toán hiện có", date: "2026-11-23", startTime: "09:00",
      endTime: "10:00", type: "study",
    });
    saveAppState(state);
    render(<CalendarPlaceholder />);

    fireEvent.change(screen.getByLabelText(/Nội dung buổi lịch/i), { target: { value: "Buổi Văn mới" } });
    fireEvent.change(screen.getByLabelText(/Ngày học/i), { target: { value: "2026-11-23" } });
    fireEvent.change(screen.getByLabelText(/Giờ bắt đầu/i), { target: { value: "09:30" } });
    fireEvent.change(screen.getByLabelText(/Giờ kết thúc/i), { target: { value: "10:30" } });
    fireEvent.click(screen.getByRole("button", { name: /Thêm vào lịch trình/i }));

    expect(screen.getByRole("alert")).toHaveTextContent(/bị trùng với “Buổi Toán hiện có”/);
    expect(loadAppState().scheduleEvents).toHaveLength(1);
  });

  it("nút Bắt đầu học truyền eventId và goalId sang Pomodoro", () => {
    let state = clearToEmptyState();
    state = addScheduleEventToState(state, {
      title: "Ôn tập Đại số", date: "2026-11-23", startTime: "09:00",
      endTime: "10:00", type: "study", goalId: "goal-math",
    });
    saveAppState(state);
    render(<CalendarPlaceholder />);
    const startLink = screen.getByRole("link", { name: /Bắt đầu học/i });
    const created = loadAppState().scheduleEvents[0];
    expect(startLink).toHaveAttribute(
      "href",
      `/pomodoro?eventId=${created.id}&goalId=goal-math`
    );
  });

  it("mở chế độ xem thứ ba — Lịch tuần — từ CalendarPlaceholder", () => {
    clearToEmptyState();
    render(<CalendarPlaceholder />);
    fireEvent.click(screen.getByRole("button", { name: /Lịch tuần/i }));
    expect(screen.getByTestId("week-calendar-grid")).toBeInTheDocument();
  });

  it("hiển thị hướng dẫn cấp quyền Camera và quyền riêng tư", () => {
    render(<CameraPrivacyGuide />);
    fireEvent.click(screen.getByRole("button", { name: /Hướng dẫn Camera & quyền riêng tư/i }));
    expect(screen.getByRole("dialog", { name: /Cấp quyền Camera & Quyền riêng tư/i })).toBeInTheDocument();
    expect(screen.getByText(/Allow \/ Cho phép/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Đã hiểu" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("Error Boundary cung cấp nút thử lại và đường về trang chủ", () => {
    const reset = vi.fn();
    render(<GlobalError error={new Error("test") } reset={reset} />);
    fireEvent.click(screen.getByRole("button", { name: /Thử lại/i }));
    expect(reset).toHaveBeenCalledOnce();
    expect(screen.getByRole("link", { name: /Về trang chủ/i })).toHaveAttribute("href", "/");
  });

  it("kiểm tra các chỉ số Analytics hiện có từ dữ liệu phiên học", () => {
    const state = createDefaultState();
    const analysis = analyzeStudentProgress(state, "2026-11-23");
    expect(analysis.totalFocusMinutes).toBe(state.focusSessions.reduce((sum, session) => sum + session.durationMinutes, 0));
    expect(analysis.averageFocusScore).toBeGreaterThanOrEqual(0);
    expect(analysis.averageFocusScore).toBeLessThanOrEqual(100);
    expect(analysis.completedEventsCount).toBe(state.scheduleEvents.filter((item) => item.status === "completed").length);
  });

  it("API AI Mentor trả fallback nội bộ hợp lệ khi không cấu hình dịch vụ AI bên ngoài", async () => {
    const request = new Request("http://localhost/api/ai-mentor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "Đánh giá tiến độ", state: createDefaultState() }),
    });
    const response = await postAIMentor(request);
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.message.role).toBe("assistant");
    expect(payload.message.content).toBeTruthy();
  });

  it("AI Mentor fallback cục bộ tạo phản hồi hợp lệ khi không phụ thuộc dịch vụ ngoài", () => {
    const state = createDefaultState();
    const response = generateMentorResponse(state, "Hãy đánh giá tiến độ học tập", "2026-11-23");
    expect(response.role).toBe("assistant");
    expect(response.content.length).toBeGreaterThan(0);
    expect(Array.isArray(response.suggestedActions)).toBe(true);
  });

  it("bộ đếm nhịp thể dục hiện có tăng đúng một nhịp khi người dùng xác nhận", () => {
    clearToEmptyState();
    render(<WebcamPlaceholder />);
    fireEvent.click(screen.getByRole("tab", { name: /2\. Giám sát Tập thể dục/i }));
    fireEvent.click(screen.getByRole("button", { name: /Đếm \+1 nhịp chuẩn/i }));
    expect(screen.getByText(/1 \/ 15 nhịp/i)).toBeInTheDocument();
  });

  it.todo("Daily Streak: kiểm thử chuỗi ngày liên tiếp sau khi Huy tích hợp analytics-engine.ts");
  it.todo("AI Hysteresis rep counter: kiểm thử chu kỳ lên-ngưỡng/hạ-ngưỡng sau khi Hải Anh tích hợp exercise-tracker.ts");
});
