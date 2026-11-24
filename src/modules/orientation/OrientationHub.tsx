"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import {
  Compass,
  GraduationCap,
  Wallet,
  Users,
  Award,
  HeartPulse,
  Sun,
  ArrowUp,
  ArrowDown,
  X,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Clock,
  SlidersHorizontal,
  CalendarPlus,
  CalendarCheck2,
  Timer,
  RotateCcw,
  Target,
} from "lucide-react";
import {
  addDaysToDateString,
  addGoalToState,
  createDefaultState,
  loadAppState,
  STATE_CHANGE_EVENT,
} from "@/lib/storage/local-db";
import { getLocalTodayDateString } from "@/modules/ai-tutor/ai-engine";
import {
  calculateOrientationPlan,
  clampDailyHours,
  formatMinutesFriendly,
  generateOrientationFallbackAdvice,
  getOrientationPreset,
  MAX_DAILY_HOURS,
  MIN_DAILY_HOURS,
  ORIENTATION_GOAL_PRESETS,
  OrientationAIAdvice,
  OrientationGoalId,
  OrientationPace,
  OrientationProfile,
  recommendDailyHours,
} from "@/modules/orientation/orientation-engine";
import {
  clearOrientationProfile,
  loadOrientationProfile,
  ORIENTATION_CHANGE_EVENT,
  saveOrientationProfile,
} from "@/modules/orientation/orientation-storage";
import { AppDatabaseState, GoalCategory } from "@/types/database";

const GOAL_ICONS: Record<
  OrientationGoalId,
  React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>
> = {
  academic_achievement: GraduationCap,
  make_money: Wallet,
  social_relationships: Users,
  personal_branding: Award,
  health: HeartPulse,
  peace_of_mind: Sun,
};

const CATEGORY_LABELS: Record<GoalCategory, string> = {
  academic: "Học thuật",
  skill: "Kỹ năng",
  health: "Sức khỏe",
};

const PACE_OPTIONS: Array<{
  id: OrientationPace;
  label: string;
  sublabel: string;
}> = [
  {
    id: "auto",
    label: "Để AI tự đề xuất",
    sublabel: "Cân đối theo số mục tiêu bạn chọn",
  },
  {
    id: "light",
    label: "Cơ bản (2–3 giờ)",
    sublabel: "Lịch học/làm bận rộn, ưu tiên nhẹ nhàng",
  },
  {
    id: "balanced",
    label: "Tăng tốc (4–8 giờ)",
    sublabel: "Top 1–2 gấp đôi (2x) nhóm sau",
  },
  {
    id: "intensive",
    label: "Toàn lực (8–10 giờ)",
    sublabel: "Top 1–2 gấp 3 (3x) nhóm sau",
  },
];

const QUICK_HOURS = [2, 3, 4, 6, 8, 10];

export function OrientationHub() {
  const [appState, setAppState] = useState<AppDatabaseState>(() =>
    createDefaultState()
  );
  const [savedProfile, setSavedProfile] = useState<OrientationProfile | null>(
    null
  );

  // Bước 1: Danh sách mục tiêu theo thứ tự ưu tiên (#1 -> #N) & nhịp độ rảnh
  const [rankedGoalIds, setRankedGoalIds] = useState<OrientationGoalId[]>([]);
  const [pace, setPace] = useState<OrientationPace>("auto");

  // Bước 2: Kết quả tư vấn & thanh chỉnh quỹ giờ 2-10h
  const [hasConsulted, setHasConsulted] = useState<boolean>(false);
  const [dailyHours, setDailyHours] = useState<number>(4);
  const [aiAdvice, setAiAdvice] = useState<OrientationAIAdvice | null>(null);
  const [isConsulting, setIsConsulting] = useState<boolean>(false);
  const [needsAdviceRefresh, setNeedsAdviceRefresh] = useState<boolean>(false);

  // Bước 3: Chuyển đổi sang Mục tiêu trên /calendar & thông báo
  const [selectedConvertIds, setSelectedConvertIds] = useState<
    OrientationGoalId[]
  >([]);
  const [statusNotice, setStatusNotice] = useState<string>("");
  const [errorNotice, setErrorNotice] = useState<string>("");

  useEffect(() => {
    const syncAll = () => {
      setAppState(loadAppState());
      const existing = loadOrientationProfile();
      setSavedProfile(existing);
    };

    syncAll();

    // Khôi phục lựa chọn gần nhất nếu người dùng đã từng xác nhận định hướng
    const existing = loadOrientationProfile();
    if (existing) {
      setRankedGoalIds(existing.rankedGoalIds);
      setPace(existing.pace);
      setDailyHours(existing.dailyHours);
      setAiAdvice(existing.advice);
      setHasConsulted(true);
      setSelectedConvertIds(existing.rankedGoalIds.slice(0, 2));
    }

    window.addEventListener(STATE_CHANGE_EVENT, syncAll);
    window.addEventListener(ORIENTATION_CHANGE_EVENT, syncAll);
    return () => {
      window.removeEventListener(STATE_CHANGE_EVENT, syncAll);
      window.removeEventListener(ORIENTATION_CHANGE_EVENT, syncAll);
    };
  }, []);

  const livePlan = useMemo(
    () => calculateOrientationPlan(rankedGoalIds, dailyHours),
    [rankedGoalIds, dailyHours]
  );

  const effectiveAdvice = useMemo(() => {
    if (!hasConsulted || rankedGoalIds.length === 0) return null;
    if (aiAdvice && !needsAdviceRefresh) return aiAdvice;
    return generateOrientationFallbackAdvice(livePlan, appState);
  }, [hasConsulted, rankedGoalIds.length, aiAdvice, needsAdviceRefresh, livePlan, appState]);

  const syncAppStateWithServer = (nextState: AppDatabaseState) => {
    setAppState(nextState);
    if (typeof window !== "undefined" && typeof window.fetch === "function") {
      window
        .fetch("/api/state", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(nextState),
        })
        .catch(() => {});
    }
  };

  const handleToggleGoal = (goalId: OrientationGoalId) => {
    setErrorNotice("");
    setRankedGoalIds((prev) => {
      const exists = prev.includes(goalId);
      const next = exists
        ? prev.filter((id) => id !== goalId)
        : [...prev, goalId];
      if (hasConsulted) {
        setNeedsAdviceRefresh(true);
      }
      if (next.length === 0) {
        setHasConsulted(false);
        setAiAdvice(null);
      }
      return next;
    });
  };

  const handleMoveGoal = (
    goalId: OrientationGoalId,
    direction: "up" | "down"
  ) => {
    setRankedGoalIds((prev) => {
      const idx = prev.indexOf(goalId);
      if (idx === -1) return prev;
      const targetIdx = direction === "up" ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= prev.length) return prev;
      const next = [...prev];
      const temp = next[idx];
      next[idx] = next[targetIdx];
      next[targetIdx] = temp;
      if (hasConsulted) {
        setNeedsAdviceRefresh(true);
      }
      return next;
    });
  };

  const handleClearSelection = () => {
    setRankedGoalIds([]);
    setHasConsulted(false);
    setAiAdvice(null);
    setSelectedConvertIds([]);
    setErrorNotice("");
    setStatusNotice("");
  };

  const requestOrientationConsultation = async (overrideHours?: number) => {
    if (rankedGoalIds.length === 0) {
      setErrorNotice(
        "Vui lòng click chọn ít nhất 1 mục tiêu ưu tiên trước khi nhận tư vấn."
      );
      return;
    }

    setErrorNotice("");
    setIsConsulting(true);

    const latestAppState = loadAppState();
    const targetHours =
      overrideHours !== undefined
        ? clampDailyHours(overrideHours)
        : recommendDailyHours(rankedGoalIds, pace, latestAppState);

    setDailyHours(targetHours);
    setSelectedConvertIds(rankedGoalIds.slice(0, 2));

    const fallbackPlan = calculateOrientationPlan(rankedGoalIds, targetHours);
    const localFallback = generateOrientationFallbackAdvice(
      fallbackPlan,
      latestAppState
    );

    try {
      const res = await fetch("/api/orientation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rankedGoalIds,
          pace,
          dailyHours: overrideHours !== undefined ? targetHours : undefined,
          state: latestAppState,
        }),
      });
      if (!res.ok) throw new Error("Orientation request failed");
      const data = (await res.json()) as {
        dailyHours?: number;
        advice?: OrientationAIAdvice;
      };
      if (typeof data.dailyHours === "number") {
        setDailyHours(clampDailyHours(data.dailyHours));
      }
      setAiAdvice(data.advice ?? localFallback);
    } catch {
      setAiAdvice(localFallback);
    } finally {
      setHasConsulted(true);
      setNeedsAdviceRefresh(false);
      setIsConsulting(false);
    }
  };

  const handleChangeHours = (nextHours: number) => {
    const clamped = clampDailyHours(nextHours);
    setDailyHours(clamped);
    if (hasConsulted) {
      setNeedsAdviceRefresh(true);
    }
  };

  const handleConfirmBudget = () => {
    if (rankedGoalIds.length === 0) {
      setErrorNotice("Hãy chọn ít nhất 1 mục tiêu ưu tiên để xác nhận.");
      return;
    }

    const plan = calculateOrientationPlan(rankedGoalIds, dailyHours);
    const adviceToSave =
      effectiveAdvice ?? generateOrientationFallbackAdvice(plan, appState);

    const profile: OrientationProfile = {
      rankedGoalIds: [...rankedGoalIds],
      pace,
      dailyHours: plan.totalHours,
      plan,
      advice: adviceToSave,
      confirmedAt: new Date().toISOString(),
    };

    const saved = saveOrientationProfile(profile);
    setSavedProfile(saved);
    setAiAdvice(adviceToSave);
    setNeedsAdviceRefresh(false);
    setStatusNotice(
      `Đã xác nhận quỹ thời gian ${plan.totalHours} giờ/ngày (${plan.totalMinutes} phút)! Thanh chỉ tiêu ở Sidebar và ngữ cảnh Cố vấn AI đã được đồng bộ.`
    );
  };

  const handleResetConfirmedProfile = () => {
    clearOrientationProfile();
    setSavedProfile(null);
    setStatusNotice(
      "Đã đặt lại hồ sơ Định hướng. Chỉ tiêu tập trung ngày trở về mặc định 120 phút."
    );
  };

  const isPresetAlreadyInCalendar = (goalId: OrientationGoalId): boolean => {
    const preset = getOrientationPreset(goalId);
    const targetTitle = preset.defaultCalendarGoalTitle.toLowerCase();
    return appState.goals.some(
      (g) => g.title.trim().toLowerCase() === targetTitle
    );
  };

  const handleToggleConvertId = (goalId: OrientationGoalId) => {
    setSelectedConvertIds((prev) =>
      prev.includes(goalId)
        ? prev.filter((id) => id !== goalId)
        : [...prev, goalId]
    );
  };

  const handleCreateCalendarGoals = () => {
    const todayStr = getLocalTodayDateString();
    const deadline14Days = addDaysToDateString(todayStr, 14);
    let current = loadAppState();
    let createdCount = 0;

    for (const alloc of livePlan.allocations) {
      if (!selectedConvertIds.includes(alloc.goalId)) continue;
      const alreadyExists = current.goals.some(
        (g) =>
          g.title.trim().toLowerCase() ===
          alloc.defaultCalendarGoalTitle.toLowerCase()
      );
      if (alreadyExists) continue;

      const targetHours14Days = Math.max(
        2,
        Math.round(alloc.hoursPerDay * 14)
      );

      current = addGoalToState(current, {
        title: alloc.defaultCalendarGoalTitle,
        description: `Khởi tạo từ Định hướng (#${alloc.rank} ${alloc.title} • ${formatMinutesFriendly(
          alloc.minutesPerDay
        )}/ngày • ${alloc.recommendedPomodoroLabel}).`,
        category: alloc.mappedCategory,
        targetHours: targetHours14Days,
        completedHours: 0,
        deadline: deadline14Days,
      });
      createdCount++;
    }

    if (createdCount > 0) {
      syncAppStateWithServer(current);
      setStatusNotice(
        `Đã chuyển hóa ${createdCount} mục tiêu định hướng sang Lịch trình & Mục tiêu (chu kỳ 14 ngày)!`
      );
    } else {
      setStatusNotice(
        "Các mục tiêu bạn chọn đã có sẵn trong Lịch trình & Mục tiêu."
      );
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-edtech-primary border border-blue-200">
            <Compass className="w-3.5 h-3.5" aria-hidden={true} />
            <span>Định hướng • Xác nhận Quỹ thời gian Ngày (2–10 giờ)</span>
          </span>
          <h1 className="mt-2 text-2xl md:text-3xl font-bold text-edtech-text">
            Định hướng Ưu tiên &amp; Xác nhận Quỹ Thời Gian
          </h1>
          <p className="mt-1 text-sm text-edtech-muted max-w-2xl">
            Chọn các mục tiêu bạn thực sự muốn chú trọng lúc này theo thứ tự ưu
            tiên. AI Mentor sẽ phân bổ quỹ 2–10 tiếng/ngày hợp lý, dồn thời
            lượng vượt trội cho ưu tiên #1–#2 và đồng bộ trực tiếp sang toàn hệ
            thống.
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5 shrink-0">
          {savedProfile && (
            <button
              type="button"
              onClick={handleResetConfirmedProfile}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-edtech-muted text-xs font-semibold border border-edtech-border transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden={true} />
              <span>Đặt lại định hướng</span>
            </button>
          )}
          <Link
            href="/ai-mentor"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-edtech-surface hover:bg-slate-100 text-edtech-text text-sm font-semibold border border-edtech-border transition-colors"
          >
            <Sparkles
              className="w-4 h-4 text-edtech-primary"
              aria-hidden={true}
            />
            <span>Sang Cố vấn AI</span>
          </Link>
        </div>
      </header>

      {/* Banner hồ sơ Định hướng đang kích hoạt */}
      {savedProfile && (
        <section
          data-testid="confirmed-orientation-banner"
          aria-label="Hồ sơ định hướng đang áp dụng"
          className="p-4 rounded-2xl bg-emerald-50/80 border border-emerald-200 flex flex-col md:flex-row md:items-center justify-between gap-3"
        >
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-edtech-success text-white flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" aria-hidden={true} />
            </div>
            <div className="text-xs space-y-0.5">
              <p className="font-bold text-edtech-text text-sm">
                Đang áp dụng quỹ thời gian: {savedProfile.dailyHours} giờ/ngày (
                {savedProfile.plan.totalMinutes} phút)
              </p>
              <p className="text-edtech-muted">
                Ưu tiên số 1:{" "}
                <strong className="text-edtech-text">
                  {savedProfile.plan.allocations[0]?.title}
                </strong>
                {savedProfile.plan.allocations[1] ? (
                  <>
                    {" "}
                    • Số 2:{" "}
                    <strong className="text-edtech-text">
                      {savedProfile.plan.allocations[1].title}
                    </strong>
                  </>
                ) : null}{" "}
                • Đã đồng bộ chỉ tiêu Sidebar &amp; ngữ cảnh Cố vấn AI.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 shrink-0">
            <Link
              href="/pomodoro"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-edtech-success hover:bg-emerald-600 text-white text-xs font-bold transition-colors"
            >
              <Timer className="w-3.5 h-3.5" aria-hidden={true} />
              <span>Bắt đầu Pomodoro</span>
            </Link>
            <Link
              href="/calendar"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-edtech-text text-xs font-semibold border border-emerald-200 transition-colors"
            >
              <CalendarCheck2 className="w-3.5 h-3.5" aria-hidden={true} />
              <span>Mở Lịch trình</span>
            </Link>
          </div>
        </section>
      )}

      {/* Thông báo trạng thái / lỗi */}
      {statusNotice && (
        <div
          role="status"
          aria-live="polite"
          className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-edtech-success flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden={true} />
            <span>{statusNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusNotice("")}
            className="underline text-edtech-muted hover:text-edtech-text"
          >
            Đóng
          </button>
        </div>
      )}

      {errorNotice && (
        <div
          role="alert"
          className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-edtech-danger flex items-center gap-2"
        >
          <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden={true} />
          <span>{errorNotice}</span>
        </div>
      )}

      {/* BƯỚC 1: CHỌN & XẾP THỨ TỰ ƯU TIÊN 6 MỤC TIÊU CÓ SẴN */}
      <section
        aria-labelledby="step-1-heading"
        className="p-6 rounded-2xl bg-edtech-surface border border-edtech-border shadow-sm space-y-5"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <span className="inline-block px-2.5 py-0.5 rounded-md text-xs font-extrabold bg-blue-100 text-edtech-primary">
              Bước 1
            </span>
            <h2
              id="step-1-heading"
              className="mt-1 text-lg font-bold text-edtech-text"
            >
              Chọn mức độ ưu tiên các mục tiêu quan trọng nhất lúc này
            </h2>
            <p className="text-xs text-edtech-muted mt-0.5">
              Bấm lần lượt vào thẻ bạn muốn chú trọng nhất (bấm trước = hạng #1,
              kế tiếp = #2...). Các thẻ không bấm mặc định là không ưu tiên giai
              đoạn này.
            </p>
          </div>

          {rankedGoalIds.length > 0 && (
            <button
              type="button"
              onClick={handleClearSelection}
              className="text-xs font-semibold text-edtech-muted hover:text-edtech-danger underline self-start sm:self-auto"
            >
              Bỏ chọn tất cả ({rankedGoalIds.length})
            </button>
          )}
        </div>

        {/* Lưới 6 mục tiêu có sẵn */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {ORIENTATION_GOAL_PRESETS.map((preset) => {
            const Icon = GOAL_ICONS[preset.id];
            const rankIndex = rankedGoalIds.indexOf(preset.id);
            const isSelected = rankIndex !== -1;
            const rank = rankIndex + 1;
            const isTopTwo = isSelected && rank <= 2;

            return (
              <div
                key={preset.id}
                data-testid={`orientation-card-${preset.id}`}
                className={`relative rounded-2xl border p-4 transition-all flex flex-col justify-between gap-3 ${
                  isSelected
                    ? isTopTwo
                      ? "bg-blue-50/70 border-edtech-primary shadow-sm ring-1 ring-blue-200"
                      : "bg-slate-50 border-slate-400 shadow-sm"
                    : "bg-edtech-bg border-edtech-border hover:border-blue-300 hover:bg-white"
                }`}
              >
                <button
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => handleToggleGoal(preset.id)}
                  className="text-left space-y-2.5 w-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-edtech-primary rounded-xl"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                        isSelected
                          ? "bg-edtech-primary text-white border-edtech-primary"
                          : `${preset.accentBg} ${preset.accentText} ${preset.accentBorder}`
                      }`}
                    >
                      <Icon className="w-5 h-5" aria-hidden={true} />
                    </div>

                    {isSelected ? (
                      <span
                        data-testid={`orientation-rank-${preset.id}`}
                        className={`px-2.5 py-1 rounded-full text-xs font-extrabold ${
                          isTopTwo
                            ? "bg-edtech-primary text-white"
                            : "bg-slate-700 text-white"
                        }`}
                      >
                        Ưu tiên #{rank}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-white text-edtech-muted border border-edtech-border">
                        Chưa chọn
                      </span>
                    )}
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-edtech-text">
                      {preset.title}
                    </h3>
                    <p className="mt-1 text-xs text-edtech-muted leading-relaxed">
                      {preset.description}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {preset.examples.map((ex) => (
                      <span
                        key={ex}
                        className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-white/90 text-edtech-muted border border-edtech-border"
                      >
                        {ex}
                      </span>
                    ))}
                  </div>
                </button>

                {/* Thanh điều khiển thứ tự nhanh cho thẻ đã chọn */}
                <div className="pt-2 border-t border-edtech-border/80 flex items-center justify-between gap-2 text-xs">
                  {isSelected ? (
                    <>
                      <span
                        className={`font-semibold ${
                          isTopTwo ? "text-edtech-primary" : "text-edtech-muted"
                        }`}
                      >
                        {rank === 1
                          ? "Trọng tâm số 1"
                          : rank === 2
                          ? "Trọng tâm số 2"
                          : "Nhóm duy trì"}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={rankIndex === 0}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMoveGoal(preset.id, "up");
                          }}
                          aria-label={`Tăng thứ tự ưu tiên ${preset.title}`}
                          className="p-1.5 rounded-lg bg-white border border-edtech-border text-edtech-text hover:bg-slate-100 disabled:opacity-40"
                        >
                          <ArrowUp className="w-3.5 h-3.5" aria-hidden={true} />
                        </button>
                        <button
                          type="button"
                          disabled={rankIndex === rankedGoalIds.length - 1}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMoveGoal(preset.id, "down");
                          }}
                          aria-label={`Giảm thứ tự ưu tiên ${preset.title}`}
                          className="p-1.5 rounded-lg bg-white border border-edtech-border text-edtech-text hover:bg-slate-100 disabled:opacity-40"
                        >
                          <ArrowDown
                            className="w-3.5 h-3.5"
                            aria-hidden={true}
                          />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleGoal(preset.id);
                          }}
                          aria-label={`Bỏ chọn ${preset.title}`}
                          className="p-1.5 rounded-lg bg-white border border-edtech-border text-edtech-danger hover:bg-red-50"
                        >
                          <X className="w-3.5 h-3.5" aria-hidden={true} />
                        </button>
                      </div>
                    </>
                  ) : (
                    <span className="text-edtech-muted">
                      Bỏ qua = không đưa vào quỹ hiện tại
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Tóm tắt thứ tự đã chọn */}
        {rankedGoalIds.length > 0 && (
          <div className="p-3.5 rounded-xl bg-slate-50 border border-edtech-border flex flex-wrap items-center gap-2 text-xs">
            <span className="font-bold text-edtech-text">
              Thứ tự ưu tiên của bạn:
            </span>
            {rankedGoalIds.map((id, idx) => {
              const p = getOrientationPreset(id);
              return (
                <span
                  key={id}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold border ${
                    idx < 2
                      ? "bg-blue-50 text-edtech-primary border-blue-200"
                      : "bg-white text-edtech-text border-edtech-border"
                  }`}
                >
                  <span>#{idx + 1}</span>
                  <span>{p.shortTitle}</span>
                </span>
              );
            })}
          </div>
        )}

        {/* Chọn nhanh nhịp độ quỹ thời gian khả dụng */}
        <fieldset className="space-y-2.5 pt-2 border-t border-edtech-border">
          <legend className="text-xs font-bold text-edtech-text">
            Nhịp độ quỹ thời gian dự kiến trong 1 ngày (2 – 10 tiếng)
          </legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {PACE_OPTIONS.map((opt) => {
              const active = pace === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    setPace(opt.id);
                    if (hasConsulted && rankedGoalIds.length > 0) {
                      const nextHours = recommendDailyHours(
                        rankedGoalIds,
                        opt.id,
                        appState
                      );
                      setDailyHours(nextHours);
                      setNeedsAdviceRefresh(true);
                    }
                  }}
                  className={`p-3 rounded-xl border text-left transition-colors ${
                    active
                      ? "bg-blue-50 border-edtech-primary text-edtech-primary"
                      : "bg-edtech-bg border-edtech-border text-edtech-text hover:bg-white"
                  }`}
                >
                  <div className="text-xs font-bold">{opt.label}</div>
                  <div className="text-[11px] text-edtech-muted mt-0.5">
                    {opt.sublabel}
                  </div>
                </button>
              );
            })}
          </div>
        </fieldset>

        {/* Nút nhận tư vấn */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <p className="text-xs text-edtech-muted">
            Quy tắc phân bổ: <strong>2–3h</strong> (Top 1–2 nhiều hơn ~1.5x) •{" "}
            <strong>4–8h</strong> (Top 1–2 gấp đôi 2x) •{" "}
            <strong>8–10h</strong> (Top 1–2 gấp 3 lần 3x).
          </p>
          <button
            type="button"
            disabled={rankedGoalIds.length === 0 || isConsulting}
            onClick={() => requestOrientationConsultation()}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-edtech-primary hover:bg-edtech-primaryHover disabled:opacity-50 text-white text-sm font-bold shadow-sm transition-colors"
          >
            <Sparkles className="w-4 h-4" aria-hidden={true} />
            <span>
              {isConsulting
                ? "AI Mentor đang tính quỹ thời gian..."
                : hasConsulted
                ? "Tư vấn lại với AI Mentor"
                : "Nhận tư vấn quỹ thời gian từ AI Mentor"}
            </span>
          </button>
        </div>
      </section>

      {/* BƯỚC 2: BẢNG PHÂN BỔ QUỸ THỜI GIAN & TƯ VẤN AI MENTOR */}
      {hasConsulted && livePlan.allocations.length > 0 && effectiveAdvice && (
        <section
          aria-labelledby="step-2-heading"
          data-testid="orientation-plan-section"
          className="p-6 rounded-2xl bg-edtech-surface border border-edtech-border shadow-sm space-y-6"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <span className="inline-block px-2.5 py-0.5 rounded-md text-xs font-extrabold bg-emerald-100 text-edtech-success">
                Bước 2
              </span>
              <h2
                id="step-2-heading"
                className="mt-1 text-lg font-bold text-edtech-text"
              >
                Phân bổ Quỹ Thời Gian &amp; Tư vấn Chiến lược từ AI Mentor
              </h2>
              <p className="text-xs text-edtech-muted mt-0.5">
                {livePlan.tierLabel} • {livePlan.ratioLabel}
              </p>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-edtech-primary border border-blue-200 self-start md:self-auto">
              {effectiveAdvice.source === "gemini"
                ? "Gemini AI Mentor"
                : "Cố vấn Định hướng Nội bộ"}
            </span>
          </div>

          {/* Thanh tinh chỉnh tổng quỹ thời gian (2 - 10 giờ) theo thời gian thực */}
          <div className="p-4 rounded-2xl bg-edtech-bg border border-edtech-border space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label
                htmlFor="daily-hours-slider"
                className="inline-flex items-center gap-2 text-sm font-bold text-edtech-text"
              >
                <SlidersHorizontal
                  className="w-4 h-4 text-edtech-primary"
                  aria-hidden={true}
                />
                <span>Tổng quỹ thời gian mỗi ngày:</span>
                <span
                  data-testid="selected-daily-hours"
                  className="px-2.5 py-0.5 rounded-lg bg-edtech-primary text-white text-sm font-extrabold"
                >
                  {livePlan.totalHours} giờ/ngày ({livePlan.totalMinutes} phút)
                </span>
              </label>

              <div className="flex flex-wrap gap-1.5">
                {QUICK_HOURS.map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => handleChangeHours(h)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors ${
                      livePlan.totalHours === h
                        ? "bg-edtech-primary text-white border-edtech-primary"
                        : "bg-white text-edtech-text border-edtech-border hover:bg-blue-50"
                    }`}
                  >
                    {h}h
                  </button>
                ))}
              </div>
            </div>

            <input
              id="daily-hours-slider"
              type="range"
              min={MIN_DAILY_HOURS}
              max={MAX_DAILY_HOURS}
              step={0.5}
              value={livePlan.totalHours}
              onChange={(e) => handleChangeHours(Number(e.target.value))}
              aria-label="Điều chỉnh tổng quỹ thời gian học và phát triển mỗi ngày từ 2 đến 10 giờ"
              className="w-full accent-edtech-primary cursor-pointer"
            />
            <div className="flex justify-between text-[11px] font-semibold text-edtech-muted">
              <span>2 giờ (Tối thiểu)</span>
              <span>4 giờ (2x)</span>
              <span>6 giờ (2x)</span>
              <span>8 giờ (3x)</span>
              <span>10 giờ (Tối đa)</span>
            </div>

            {needsAdviceRefresh && (
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-edtech-border text-xs">
                <span className="text-edtech-muted">
                  Bảng giờ đã tự cập nhật theo mức{" "}
                  <strong>{livePlan.totalHours} giờ/ngày</strong>. Bạn có thể
                  nhờ AI phân tích sâu lại theo mức mới:
                </span>
                <button
                  type="button"
                  disabled={isConsulting}
                  onClick={() =>
                    requestOrientationConsultation(livePlan.totalHours)
                  }
                  className="px-3 py-1.5 rounded-lg bg-white hover:bg-blue-50 text-edtech-primary font-bold border border-blue-200 transition-colors"
                >
                  Cập nhật lời khuyên AI
                </button>
              </div>
            )}
          </div>

          {/* Biểu đồ thanh tỷ lệ quỹ thời gian */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-edtech-text">
                Tỷ trọng phân bổ trong ngày
              </span>
              <span className="text-edtech-muted">
                Tổng 100% = {formatMinutesFriendly(livePlan.totalMinutes)}
              </span>
            </div>
            <div
              role="img"
              aria-label="Biểu đồ thanh tỷ trọng phân bổ thời gian giữa các mục tiêu ưu tiên"
              className="w-full h-4 rounded-full bg-slate-200 overflow-hidden flex"
            >
              {livePlan.allocations.map((alloc) => {
                const preset = getOrientationPreset(alloc.goalId);
                return (
                  <div
                    key={alloc.goalId}
                    title={`#${alloc.rank} ${alloc.title}: ${formatMinutesFriendly(
                      alloc.minutesPerDay
                    )} (${alloc.sharePercent}%)`}
                    className={`h-full ${preset.accentBar} transition-all border-r border-white/40 last:border-r-0`}
                    style={{ width: `${alloc.sharePercent}%` }}
                  />
                );
              })}
            </div>
            <div className="flex flex-wrap gap-3 text-xs text-edtech-muted pt-1">
              {livePlan.allocations.map((alloc) => {
                const preset = getOrientationPreset(alloc.goalId);
                return (
                  <span
                    key={alloc.goalId}
                    className="inline-flex items-center gap-1.5"
                  >
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${preset.accentBar}`}
                      aria-hidden={true}
                    />
                    <span className="font-semibold text-edtech-text">
                      #{alloc.rank} {alloc.shortTitle}
                    </span>
                    <span>({alloc.sharePercent}%)</span>
                  </span>
                );
              })}
            </div>
          </div>

          {/* Nhận xét & Cảnh báo từ AI Mentor */}
          <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-edtech-primary">
              <Sparkles className="w-4 h-4" aria-hidden={true} />
              <span>Lời khuyên Định hướng từ AI Mentor</span>
            </div>
            <div className="text-sm text-edtech-text leading-relaxed [&_strong]:font-bold">
              <ReactMarkdown>{effectiveAdvice.summary}</ReactMarkdown>
            </div>
            <p className="text-xs text-edtech-text bg-white/80 p-3 rounded-xl border border-blue-100">
              <strong className="text-edtech-primary">Nguyên tắc phân bổ:</strong>{" "}
              {effectiveAdvice.ratioExplanation}
            </p>

            {effectiveAdvice.warnings.length > 0 && (
              <div
                data-testid="orientation-warnings"
                className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 space-y-1.5"
              >
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800">
                  <AlertTriangle className="w-4 h-4" aria-hidden={true} />
                  <span>Lưu ý quan trọng để giữ hiệu quả thực tế</span>
                </div>
                <ul className="list-disc pl-5 space-y-1 text-xs text-amber-900">
                  {effectiveAdvice.warnings.map((w, idx) => (
                    <li key={idx}>{w}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Chi tiết phân bổ từng mục tiêu */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {livePlan.allocations.map((alloc) => {
              const preset = getOrientationPreset(alloc.goalId);
              const tipObj = effectiveAdvice.pillarTips.find(
                (t) => t.goalId === alloc.goalId
              );

              return (
                <article
                  key={alloc.goalId}
                  data-testid={`allocation-card-${alloc.goalId}`}
                  className={`p-4 rounded-2xl border space-y-3 ${
                    alloc.isTopPriority
                      ? "bg-white border-blue-200 shadow-sm"
                      : "bg-edtech-bg border-edtech-border"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={`px-2 py-0.5 rounded-md text-xs font-extrabold ${
                            alloc.isTopPriority
                              ? "bg-edtech-primary text-white"
                              : "bg-slate-200 text-edtech-text"
                          }`}
                        >
                          #{alloc.rank}
                        </span>
                        <span className="text-sm font-bold text-edtech-text">
                          {alloc.title}
                        </span>
                      </div>
                      <span
                        className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-semibold border ${
                          alloc.cadence === "alternate_days"
                            ? "bg-amber-50 text-amber-800 border-amber-200"
                            : "bg-emerald-50 text-edtech-success border-emerald-200"
                        }`}
                      >
                        {alloc.cadenceLabel}
                      </span>
                    </div>

                    <div className="text-right shrink-0">
                      <div
                        data-testid={`allocation-minutes-${alloc.goalId}`}
                        className="text-base font-extrabold text-edtech-primary"
                      >
                        {formatMinutesFriendly(alloc.minutesPerDay)}
                      </div>
                      <div className="text-[11px] font-semibold text-edtech-muted">
                        {alloc.sharePercent}% quỹ/ngày
                      </div>
                    </div>
                  </div>

                  <div className="w-full h-1.5 rounded-full bg-slate-200 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${preset.accentBar}`}
                      style={{ width: `${alloc.sharePercent}%` }}
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs text-edtech-muted">
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 text-edtech-text font-semibold">
                      <Clock className="w-3.5 h-3.5 text-edtech-primary" aria-hidden={true} />
                      <span>{alloc.recommendedPomodoroLabel}</span>
                    </span>
                    <span className="px-2 py-1 rounded-lg bg-white border border-edtech-border font-medium">
                      Khung gợi ý: {tipObj?.suggestedSlot ?? alloc.defaultSlot}
                    </span>
                  </div>

                  <p className="text-xs text-edtech-text leading-relaxed">
                    {tipObj?.tip ?? alloc.defaultActionTip}
                  </p>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {/* BƯỚC 3: XÁC NHẬN QUỸ THỜI GIAN & CHUYỂN HÓA SANG LỊCH TRÌNH */}
      {hasConsulted && livePlan.allocations.length > 0 && (
        <section
          aria-labelledby="step-3-heading"
          className="p-6 rounded-2xl bg-edtech-surface border border-edtech-border shadow-sm space-y-5"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="inline-block px-2.5 py-0.5 rounded-md text-xs font-extrabold bg-indigo-100 text-indigo-700">
                Bước 3
              </span>
              <h2
                id="step-3-heading"
                className="mt-1 text-lg font-bold text-edtech-text"
              >
                Xác nhận Quỹ Thời Gian &amp; Đồng bộ Hệ thống
              </h2>
              <p className="text-xs text-edtech-muted mt-0.5">
                Bấm xác nhận để cập nhật chỉ tiêu tập trung ngày trên Sidebar (
                {livePlan.totalMinutes} phút/ngày) và giúp Cố vấn AI luôn nhớ
                thứ tự ưu tiên này.
              </p>
            </div>

            <button
              type="button"
              data-testid="confirm-orientation-btn"
              onClick={handleConfirmBudget}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-edtech-success hover:bg-emerald-600 text-white text-sm font-bold shadow-sm transition-colors shrink-0"
            >
              <CheckCircle2 className="w-4 h-4" aria-hidden={true} />
              <span>Xác nhận quỹ thời gian ({livePlan.totalHours} giờ/ngày)</span>
            </button>
          </div>

          {/* Tùy chọn chuyển hóa thành mục tiêu trên Lịch trình & Mục tiêu */}
          <div className="p-4 rounded-2xl bg-edtech-bg border border-edtech-border space-y-3">
            <div className="flex items-center gap-2">
              <Target
                className="w-4 h-4 text-edtech-primary"
                aria-hidden={true}
              />
              <h3 className="text-sm font-bold text-edtech-text">
                Tùy chọn: Tạo nhanh thành Mục tiêu trên Lịch trình &amp; Pomodoro
              </h3>
            </div>
            <p className="text-xs text-edtech-muted">
              Nếu những mục tiêu định hướng này chưa xuất hiện trong mục{" "}
              <strong>Lịch trình &amp; Mục tiêu</strong>, hãy tích chọn để tạo
              sẵn mục tiêu chu kỳ 14 ngày theo đúng định mức giờ bạn vừa chia:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {livePlan.allocations.map((alloc) => {
                const alreadyInCal = isPresetAlreadyInCalendar(alloc.goalId);
                const checked =
                  alreadyInCal || selectedConvertIds.includes(alloc.goalId);
                const target14Days = Math.max(
                  2,
                  Math.round(alloc.hoursPerDay * 14)
                );

                return (
                  <label
                    key={alloc.goalId}
                    className={`flex items-start gap-2.5 p-3 rounded-xl border text-xs cursor-pointer transition-colors ${
                      alreadyInCal
                        ? "bg-emerald-50/70 border-emerald-200 cursor-default"
                        : checked
                        ? "bg-white border-edtech-primary"
                        : "bg-white/60 border-edtech-border"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={alreadyInCal}
                      onChange={() => handleToggleConvertId(alloc.goalId)}
                      className="mt-0.5 accent-edtech-primary"
                    />
                    <div className="min-w-0 space-y-0.5">
                      <div className="font-bold text-edtech-text">
                        #{alloc.rank} {alloc.defaultCalendarGoalTitle}
                      </div>
                      <div className="text-edtech-muted">
                        Nhóm: {CATEGORY_LABELS[alloc.mappedCategory]} • Chỉ tiêu
                        14 ngày: <strong>{target14Days} giờ</strong>
                        {alreadyInCal ? " • Đã có trong Lịch trình ✓" : ""}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <span className="text-xs text-edtech-muted">
                Không bắt buộc — bạn có thể chỉ xác nhận quỹ thời gian để làm
                kim chỉ nam hằng ngày.
              </span>
              <button
                type="button"
                disabled={selectedConvertIds.length === 0}
                onClick={handleCreateCalendarGoals}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-edtech-primary hover:bg-edtech-primaryHover disabled:opacity-50 text-white text-xs font-bold shadow-sm transition-colors"
              >
                <CalendarPlus className="w-4 h-4" aria-hidden={true} />
                <span>+ Tạo mục tiêu đã chọn sang Lịch trình</span>
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
