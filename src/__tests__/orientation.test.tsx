import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createDefaultState,
  loadAppState,
  saveAppState,
} from "@/lib/storage/local-db";
import {
  calculateOrientationPlan,
  clampDailyHours,
  ORIENTATION_GOAL_PRESETS,
  OrientationGoalId,
  recommendDailyHours,
} from "@/modules/orientation/orientation-engine";
import {
  formatOrientationContextForMentor,
  getEffectiveDailyTargetMinutes,
  loadOrientationProfile,
} from "@/modules/orientation/orientation-storage";
import { OrientationHub } from "@/modules/orientation/OrientationHub";
import { Sidebar } from "@/components/layout/Sidebar";
import { POST as postOrientation } from "@/app/api/orientation/route";

let currentPathname = "/orientation";

vi.mock("next/navigation", () => ({
  usePathname: () => currentPathname,
}));

describe("Tính năng Định hướng — Xác nhận Quỹ Thời Gian (2–10 giờ/ngày)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    currentPathname = "/orientation";
  });

  it("1. Có đủ 6 mục tiêu định hướng có sẵn và giới hạn quỹ thời gian chuẩn 2–10 giờ", () => {
    expect(ORIENTATION_GOAL_PRESETS).toHaveLength(6);
    const titles = ORIENTATION_GOAL_PRESETS.map((p) => p.title);
    expect(titles).toEqual([
      "Thành tích học tập",
      "Kiếm tiền",
      "Mối quan hệ xã hội",
      "Xây dựng thương hiệu cá nhân",
      "Sức khỏe",
      "Tâm trí bình yên thanh thản",
    ]);

    expect(clampDailyHours(0.5)).toBe(2);
    expect(clampDailyHours(14)).toBe(10);
    expect(clampDailyHours(5.2)).toBe(5);
    expect(recommendDailyHours(["academic_achievement"], "light")).toBe(2);
    expect(
      recommendDailyHours(
        [
          "academic_achievement",
          "make_money",
          "health",
          "personal_branding",
          "peace_of_mind",
        ],
        "intensive"
      )
    ).toBe(10);
  });

  it("2. Phân bổ chính xác tỷ lệ Top 1–2 so với #3+ theo 3 phân khúc: 2–3h (~1.5x), 4–8h (gấp đôi 2x), 8–10h (gấp 3 3x)", () => {
    const fourGoals: OrientationGoalId[] = [
      "academic_achievement",
      "make_money",
      "health",
      "peace_of_mind",
    ];

    // Mức 2–3 giờ: tổng 180 phút, Top 1–2 nhiều hơn #3–#4
    const lightPlan = calculateOrientationPlan(fourGoals, 3);
    expect(lightPlan.tier).toBe("light");
    expect(lightPlan.ratioMultiplier).toBe(1.5);
    expect(
      lightPlan.allocations.reduce((s, a) => s + a.minutesPerDay, 0)
    ).toBe(180);
    const lightTopAvg =
      (lightPlan.allocations[0].minutesPerDay +
        lightPlan.allocations[1].minutesPerDay) /
      2;
    const lightLowerAvg =
      (lightPlan.allocations[2].minutesPerDay +
        lightPlan.allocations[3].minutesPerDay) /
      2;
    expect(lightTopAvg).toBeGreaterThan(lightLowerAvg * 1.3);

    // Mức 4–8 giờ (6h = 360 phút): Top 1–2 gấp đôi (2x) #3–#4
    const balancedPlan = calculateOrientationPlan(fourGoals, 6);
    expect(balancedPlan.tier).toBe("balanced");
    expect(balancedPlan.ratioMultiplier).toBe(2);
    expect(
      balancedPlan.allocations.reduce((s, a) => s + a.minutesPerDay, 0)
    ).toBe(360);
    const balTopAvg =
      (balancedPlan.allocations[0].minutesPerDay +
        balancedPlan.allocations[1].minutesPerDay) /
      2;
    const balLowerAvg =
      (balancedPlan.allocations[2].minutesPerDay +
        balancedPlan.allocations[3].minutesPerDay) /
      2;
    expect(balTopAvg / balLowerAvg).toBeCloseTo(2, 1);

    // Mức 8–10 giờ (8h = 480 phút): Top 1–2 gấp 3 (3x) #3–#4
    const intensivePlan = calculateOrientationPlan(fourGoals, 8);
    expect(intensivePlan.tier).toBe("intensive");
    expect(intensivePlan.ratioMultiplier).toBe(3);
    expect(
      intensivePlan.allocations.reduce((s, a) => s + a.minutesPerDay, 0)
    ).toBe(480);
    const intTopAvg =
      (intensivePlan.allocations[0].minutesPerDay +
        intensivePlan.allocations[1].minutesPerDay) /
      2;
    const intLowerAvg =
      (intensivePlan.allocations[2].minutesPerDay +
        intensivePlan.allocations[3].minutesPerDay) /
      2;
    expect(intTopAvg / intLowerAvg).toBeCloseTo(3, 1);
  });

  it("3. Xử lý an toàn ca biên: chỉ chọn 2 mục tiêu và chọn 6 mục tiêu trên quỹ nhỏ 2 giờ (cảnh báo luân phiên)", () => {
    const twoGoalsPlan = calculateOrientationPlan(
      ["academic_achievement", "make_money"],
      4
    );
    expect(twoGoalsPlan.allocations).toHaveLength(2);
    expect(
      twoGoalsPlan.allocations[0].minutesPerDay +
        twoGoalsPlan.allocations[1].minutesPerDay
    ).toBe(240);
    expect(twoGoalsPlan.allocations[0].minutesPerDay).toBeGreaterThan(
      twoGoalsPlan.allocations[1].minutesPerDay
    );

    const allSixGoals = ORIENTATION_GOAL_PRESETS.map((p) => p.id);
    const crowdedPlan = calculateOrientationPlan(allSixGoals, 2);
    expect(
      crowdedPlan.allocations.reduce((s, a) => s + a.minutesPerDay, 0)
    ).toBe(120);
    expect(crowdedPlan.hasOverloadWarning).toBe(true);
    expect(
      crowdedPlan.allocations.some((a) => a.cadence === "alternate_days")
    ).toBe(true);
  });

  it("4. API /api/orientation kiểm tra đầu vào hợp lệ và trả về kế hoạch + lời khuyên chuẩn", async () => {
    const emptyReq = new Request("http://localhost:3000/api/orientation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rankedGoalIds: [] }),
    });
    const emptyRes = await postOrientation(emptyReq);
    expect(emptyRes.status).toBe(400);

    const validReq = new Request("http://localhost:3000/api/orientation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rankedGoalIds: ["academic_achievement", "make_money", "health"],
        pace: "balanced",
        state: createDefaultState(),
      }),
    });
    const validRes = await postOrientation(validReq);
    expect(validRes.status).toBe(200);
    const data = await validRes.json();
    expect(data.dailyHours).toBeGreaterThanOrEqual(2);
    expect(data.dailyHours).toBeLessThanOrEqual(10);
    expect(data.plan.allocations).toHaveLength(3);
    expect(data.advice.pillarTips).toHaveLength(3);
  });

  it("5. Luồng UI đầy đủ: click xếp hạng → nhận tư vấn → xác nhận quỹ → đồng bộ Sidebar & tạo mục tiêu sang Lịch trình", async () => {
    const initialState = createDefaultState();
    saveAppState(initialState);

    // Chưa xác nhận Định hướng -> chỉ tiêu mặc định vẫn là 120 phút
    expect(getEffectiveDailyTargetMinutes()).toBe(120);

    const { unmount: unmountSidebarBefore } = render(<Sidebar />);
    const orientationLink = screen.getByRole("link", { name: /Định hướng/i });
    expect(orientationLink).toHaveAttribute("aria-current", "page");
    expect(screen.getByTestId("sidebar-daily-target")).toHaveTextContent(
      /120 phút hôm nay/i
    );
    unmountSidebarBefore();

    render(<OrientationHub />);

    // Click chọn lần lượt #1 Thành tích học tập, #2 Kiếm tiền, #3 Sức khỏe
    fireEvent.click(
      screen.getByRole("button", { name: /Thành tích học tập/i })
    );
    fireEvent.click(screen.getByRole("button", { name: /Kiếm tiền/i }));
    fireEvent.click(screen.getByRole("button", { name: /Sức khỏe/i }));

    expect(
      screen.getByTestId("orientation-rank-academic_achievement")
    ).toHaveTextContent("Ưu tiên #1");
    expect(screen.getByTestId("orientation-rank-make_money")).toHaveTextContent(
      "Ưu tiên #2"
    );
    expect(screen.getByTestId("orientation-rank-health")).toHaveTextContent(
      "Ưu tiên #3"
    );

    // Bấm nhận tư vấn quỹ thời gian
    fireEvent.click(
      screen.getByRole("button", {
        name: /Nhận tư vấn quỹ thời gian từ AI Mentor/i,
      })
    );

    await waitFor(() => {
      expect(
        screen.getByTestId("orientation-plan-section")
      ).toBeInTheDocument();
    });

    // Chọn nhanh mức 6h và bấm Xác nhận quỹ thời gian
    fireEvent.click(screen.getByRole("button", { name: "6h" }));
    expect(screen.getByTestId("selected-daily-hours")).toHaveTextContent(
      /6 giờ\/ngày \(360 phút\)/i
    );

    fireEvent.click(screen.getByTestId("confirm-orientation-btn"));

    const saved = loadOrientationProfile();
    expect(saved).not.toBeNull();
    expect(saved?.dailyHours).toBe(6);
    expect(getEffectiveDailyTargetMinutes()).toBe(360);
    expect(formatOrientationContextForMentor()).toMatch(/6 giờ\/ngày/i);

    // Chuyển hóa mục tiêu định hướng sang Lịch trình & Mục tiêu
    fireEvent.click(
      screen.getByRole("button", {
        name: /\+ Tạo mục tiêu đã chọn sang Lịch trình/i,
      })
    );

    const afterCreate = loadAppState();
    expect(afterCreate.goals.length).toBe(initialState.goals.length + 2);

    // Kiểm tra Sidebar tự động hiển thị chỉ tiêu mới 360 phút & Ưu tiên #1
    render(<Sidebar />);
    expect(screen.getByTestId("sidebar-daily-target")).toHaveTextContent(
      /360 phút hôm nay/i
    );
    expect(screen.getByText(/Ưu tiên #1: Học tập/i)).toBeInTheDocument();
  });
});
