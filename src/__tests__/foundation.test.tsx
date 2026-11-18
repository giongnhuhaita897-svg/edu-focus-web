import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  calculateGoalProgress,
  createDefaultState,
  loadAppState,
  saveAppState,
  resetAppState,
  STORAGE_KEY,
} from "@/lib/storage/local-db";
import { Sidebar } from "@/components/layout/Sidebar";
import DashboardPage from "@/app/page";
import { GET, PUT } from "@/app/api/state/route";

let currentPathname = "/";

vi.mock("next/navigation", () => ({
  usePathname: () => currentPathname,
}));

describe("Giai đoạn 1 — Khung dự án, Giao diện Clean EdTech & Lưu trữ cục bộ", () => {
  beforeEach(() => {
    window.localStorage.clear();
    currentPathname = "/";
  });

  it("tính toán phần trăm tiến độ mục tiêu chính xác và giới hạn trong [0, 100]", () => {
    expect(calculateGoalProgress(18, 40)).toBe(45);
    expect(calculateGoalProgress(50, 40)).toBe(100);
    expect(calculateGoalProgress(10, 0)).toBe(0);
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

  it("hiển thị thanh điều hướng Sidebar với đủ 4 phân hệ và đánh dấu aria-current='page'", () => {
    currentPathname = "/webcam";
    render(<Sidebar />);

    const nav = screen.getByRole("navigation", { name: "Điều hướng chính" });
    expect(nav).toBeInTheDocument();

    const overviewLink = screen.getByRole("link", { name: /Tổng quan/i });
    const calendarLink = screen.getByRole("link", {
      name: /Lịch trình & Mục tiêu/i,
    });
    const webcamLink = screen.getByRole("link", { name: /Phòng Kỷ luật/i });
    const aiLink = screen.getByRole("link", { name: /Cố vấn AI/i });

    expect(overviewLink).not.toHaveAttribute("aria-current");
    expect(calendarLink).not.toHaveAttribute("aria-current");
    expect(webcamLink).toHaveAttribute("aria-current", "page");
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
