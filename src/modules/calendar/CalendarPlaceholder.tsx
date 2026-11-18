"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  CalendarCheck2,
  Target,
  Plus,
  Trash2,
  Edit3,
  CheckCircle2,
  Clock,
  Camera,
  AlertCircle,
  RotateCcw,
  Filter,
  Timer,
} from "lucide-react";
import {
  addGoalToState,
  addScheduleEventToState,
  calculateEventDurationHours,
  createDefaultState,
  deleteGoalFromState,
  deleteScheduleEventFromState,
  formatHoursAndMinutes,
  getDaysRemainingInfo,
  loadAppState,
  resetAppState,
  updateGoalInState,
  updateScheduleEventStatusInState,
} from "@/lib/storage/local-db";
import {
  AppDatabaseState,
  Goal,
  GoalCategory,
  ScheduleEventStatus,
  ScheduleEventType,
} from "@/types/database";

const CATEGORY_LABELS: Record<GoalCategory, string> = {
  academic: "Học thuật",
  skill: "Kỹ năng",
  health: "Sức khỏe",
};

const EVENT_TYPE_LABELS: Record<ScheduleEventType, string> = {
  study: "Học tập",
  exercise: "Vận động",
  review: "Ôn tập",
};

export function CalendarPlaceholder() {
  const today = new Date().toISOString().slice(0, 10);

  const [state, setState] = useState<AppDatabaseState>(() =>
    createDefaultState()
  );
  const [statusBanner, setStatusBanner] = useState<string>("");

  // State cho Form Mục tiêu
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [goalTitle, setGoalTitle] = useState<string>("");
  const [goalCategory, setGoalCategory] = useState<GoalCategory>("academic");
  const [goalTargetHours, setGoalTargetHours] = useState<string>("30");
  const [goalDeadline, setGoalDeadline] = useState<string>("2026-12-31");
  const [goalDescription, setGoalDescription] = useState<string>("");
  const [goalError, setGoalError] = useState<string>("");

  // State cho Form Sự kiện Lịch trình
  const [eventTitle, setEventTitle] = useState<string>("");
  const [eventDate, setEventDate] = useState<string>(today);
  const [eventStartTime, setEventStartTime] = useState<string>("15:30");
  const [eventEndTime, setEventEndTime] = useState<string>("17:00");
  const [eventType, setEventType] = useState<ScheduleEventType>("study");
  const [eventGoalId, setEventGoalId] = useState<string>("");
  const [eventNotes, setEventNotes] = useState<string>("");
  const [eventError, setEventError] = useState<string>("");

  // State bộ lọc lịch trình
  const [filterDateMode, setFilterDateMode] = useState<"all" | "date">("all");
  const [selectedFilterDate, setSelectedFilterDate] = useState<string>(today);
  const [filterEventType, setFilterEventType] = useState<
    "all" | ScheduleEventType
  >("all");

  useEffect(() => {
    setState(loadAppState());
  }, []);

  const syncWithServer = (nextState: AppDatabaseState) => {
    setState(nextState);
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

  const resetGoalForm = () => {
    setEditingGoalId(null);
    setGoalTitle("");
    setGoalCategory("academic");
    setGoalTargetHours("30");
    setGoalDeadline("2026-12-31");
    setGoalDescription("");
    setGoalError("");
  };

  const handleGoalSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmedTitle = goalTitle.trim();
    const parsedTarget = Number(goalTargetHours);

    if (!trimmedTitle) {
      setGoalError("Vui lòng nhập tên mục tiêu cụ thể.");
      return;
    }
    if (!Number.isFinite(parsedTarget) || parsedTarget <= 0) {
      setGoalError("Số giờ mục tiêu phải lớn hơn 0.");
      return;
    }

    if (editingGoalId) {
      const next = updateGoalInState(state, editingGoalId, {
        title: trimmedTitle,
        category: goalCategory,
        targetHours: parsedTarget,
        deadline: goalDeadline,
        description: goalDescription.trim(),
      });
      syncWithServer(next);
      setStatusBanner(`Đã cập nhật mục tiêu "${trimmedTitle}".`);
    } else {
      const next = addGoalToState(state, {
        title: trimmedTitle,
        category: goalCategory,
        targetHours: parsedTarget,
        deadline: goalDeadline,
        description: goalDescription.trim(),
      });
      syncWithServer(next);
      setStatusBanner(`Đã thêm mục tiêu mới "${trimmedTitle}".`);
    }

    resetGoalForm();
  };

  const handleStartEditGoal = (goal: Goal) => {
    setEditingGoalId(goal.id);
    setGoalTitle(goal.title);
    setGoalCategory(goal.category);
    setGoalTargetHours(String(goal.targetHours));
    setGoalDeadline(goal.deadline);
    setGoalDescription(goal.description);
    setGoalError("");
  };

  const handleDeleteGoal = (goal: Goal) => {
    const next = deleteGoalFromState(state, goal.id);
    syncWithServer(next);
    if (editingGoalId === goal.id) {
      resetGoalForm();
    }
    setStatusBanner(`Đã xóa mục tiêu "${goal.title}".`);
  };

  const handleEventSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmedTitle = eventTitle.trim();
    if (!trimmedTitle) {
      setEventError("Vui lòng nhập nội dung buổi học hoặc vận động.");
      return;
    }

    const duration = calculateEventDurationHours(eventStartTime, eventEndTime);
    if (duration <= 0) {
      setEventError("Giờ kết thúc phải muộn hơn giờ bắt đầu.");
      return;
    }

    const next = addScheduleEventToState(state, {
      title: trimmedTitle,
      date: eventDate,
      startTime: eventStartTime,
      endTime: eventEndTime,
      type: eventType,
      goalId: eventGoalId || undefined,
      notes: eventNotes,
    });
    syncWithServer(next);
    setEventTitle("");
    setEventNotes("");
    setEventError("");
    setStatusBanner(`Đã thêm buổi lịch "${trimmedTitle}" vào ngày ${eventDate}.`);
  };

  const handleChangeEventStatus = (
    eventId: string,
    nextStatus: ScheduleEventStatus
  ) => {
    const next = updateScheduleEventStatusInState(state, eventId, nextStatus);
    syncWithServer(next);
    setStatusBanner(
      nextStatus === "completed"
        ? "Đã đánh dấu hoàn thành buổi lịch!"
        : nextStatus === "missed"
        ? "Đã đánh dấu buổi lịch là bỏ lỡ."
        : "Đã chuyển buổi lịch về trạng thái dự kiến."
    );
  };

  const handleDeleteEvent = (eventId: string, title: string) => {
    const next = deleteScheduleEventFromState(state, eventId);
    syncWithServer(next);
    setStatusBanner(`Đã xóa buổi lịch "${title}".`);
  };

  const handleResetDemo = () => {
    const initial = resetAppState();
    syncWithServer(initial);
    resetGoalForm();
    setStatusBanner("Đã khôi phục dữ liệu mẫu ban đầu.");
  };

  const filteredEvents = state.scheduleEvents.filter((evt) => {
    if (filterDateMode === "date" && evt.date !== selectedFilterDate) {
      return false;
    }
    if (filterEventType !== "all" && evt.type !== filterEventType) {
      return false;
    }
    return true;
  });

  const totalTargetHours = state.goals.reduce(
    (sum, g) => sum + g.targetHours,
    0
  );
  const totalCompletedHours = state.goals.reduce(
    (sum, g) => sum + g.completedHours,
    0
  );
  const completedEventsCount = state.scheduleEvents.filter(
    (e) => e.status === "completed"
  ).length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-edtech-primary border border-blue-200">
            Giai đoạn 2 • Quản lý Mục tiêu &amp; Thời gian biểu
          </span>
          <h1 className="mt-2 text-2xl md:text-3xl font-bold text-edtech-text">
            Hệ thống Lịch trình &amp; Mục tiêu Cá nhân
          </h1>
          <p className="mt-1 text-sm text-edtech-muted">
            Thiết lập mục tiêu kèm đếm ngược số ngày còn lại. Thời gian học
            được cộng dồn chuẩn xác (25 phút / 50 phút) khi hoàn thành phiên
            tập trung Pomodoro.
          </p>
        </div>

        <button
          type="button"
          onClick={handleResetDemo}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-edtech-surface hover:bg-slate-100 text-edtech-muted hover:text-edtech-text text-xs font-semibold border border-edtech-border transition-colors shrink-0 self-start sm:self-auto"
        >
          <RotateCcw className="w-4 h-4" aria-hidden={true} />
          <span>Khôi phục dữ liệu mẫu</span>
        </button>
      </header>

      {/* Thông báo trạng thái ARIA live */}
      {statusBanner && (
        <div
          role="status"
          aria-live="polite"
          className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-edtech-success flex items-center justify-between gap-2"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden={true} />
            <span>{statusBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusBanner("")}
            className="text-xs underline text-edtech-muted hover:text-edtech-text"
          >
            Đóng
          </button>
        </div>
      )}

      {/* Chỉ số tổng hợp Lịch & Mục tiêu */}
      <section
        aria-label="Thống kê mục tiêu và lịch trình"
        className="grid grid-cols-1 sm:grid-cols-3 gap-4"
      >
        <div className="p-5 rounded-2xl bg-edtech-surface border border-edtech-border shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-edtech-muted">
              Tổng số mục tiêu
            </span>
            <Target className="w-5 h-5 text-edtech-primary" aria-hidden={true} />
          </div>
          <p className="mt-2 text-2xl font-bold text-edtech-text">
            {state.goals.length} mục tiêu
          </p>
          <p className="mt-1 text-xs text-edtech-muted">
            Tích lũy {formatHoursAndMinutes(totalCompletedHours)} /{" "}
            {totalTargetHours} giờ mục tiêu
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-edtech-surface border border-edtech-border shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-edtech-muted">
              Buổi lịch hoàn thành
            </span>
            <CheckCircle2
              className="w-5 h-5 text-edtech-success"
              aria-hidden={true}
            />
          </div>
          <p className="mt-2 text-2xl font-bold text-edtech-text">
            {completedEventsCount} / {state.scheduleEvents.length} buổi
          </p>
          <p className="mt-1 text-xs text-edtech-success font-medium">
            Kết nối trực tiếp với phiên tập trung Pomodoro
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-edtech-surface border border-edtech-border shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-edtech-muted">
              Tích lũy giờ học chuẩn
            </span>
            <Camera
              className="w-5 h-5 text-edtech-primary"
              aria-hidden={true}
            />
          </div>
          <p className="mt-2 text-base font-bold text-edtech-text">
            Cộng phút qua phiên 25/5 &amp; 50/15
          </p>
          <Link
            href="/pomodoro"
            className="mt-1 inline-block text-xs font-semibold text-edtech-primary hover:underline"
          >
            Mở Đồng hồ Pomodoro để học →
          </Link>
        </div>
      </section>

      {/* PHẦN 1: QUẢN LÝ MỤC TIÊU CÁ NHÂN */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Form Tạo / Sửa Mục tiêu */}
        <section
          aria-labelledby="goal-form-heading"
          className="lg:col-span-5 p-6 rounded-2xl bg-edtech-surface border border-edtech-border shadow-sm space-y-4"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target
                className="w-5 h-5 text-edtech-primary"
                aria-hidden={true}
              />
              <h2
                id="goal-form-heading"
                className="text-lg font-bold text-edtech-text"
              >
                {editingGoalId ? "Chỉnh sửa Mục tiêu" : "Thêm Mục tiêu Mới"}
              </h2>
            </div>
            {editingGoalId && (
              <button
                type="button"
                onClick={resetGoalForm}
                className="text-xs font-semibold text-edtech-muted hover:text-edtech-text underline"
              >
                Hủy sửa
              </button>
            )}
          </div>

          <form
            aria-labelledby="goal-form-heading"
            onSubmit={handleGoalSubmit}
            className="space-y-4"
            noValidate
          >
            <div>
              <label
                htmlFor="goal-title"
                className="block text-xs font-bold text-edtech-text mb-1"
              >
                Tên mục tiêu <span aria-hidden="true">*</span>
              </label>
              <input
                id="goal-title"
                name="title"
                type="text"
                required
                value={goalTitle}
                onChange={(e) => {
                  setGoalTitle(e.target.value);
                  if (goalError) setGoalError("");
                }}
                aria-invalid={goalError ? "true" : undefined}
                placeholder="VD: Đạt 8.5 môn Giải tích / Luyện IELTS 7.0"
                className="w-full px-3.5 py-2.5 rounded-xl bg-edtech-bg border border-slate-300 text-sm text-edtech-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-edtech-primary"
              />
            </div>

            <fieldset className="space-y-1.5">
              <legend className="text-xs font-bold text-edtech-text">
                Phân loại mục tiêu
              </legend>
              <div className="grid grid-cols-3 gap-2 pt-1">
                {(["academic", "skill", "health"] as GoalCategory[]).map(
                  (cat) => (
                    <label
                      key={cat}
                      htmlFor={`goal-cat-${cat}`}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold cursor-pointer transition-colors ${
                        goalCategory === cat
                          ? "bg-blue-50 border-edtech-primary text-edtech-primary"
                          : "bg-edtech-bg border-edtech-border text-edtech-text"
                      }`}
                    >
                      <input
                        id={`goal-cat-${cat}`}
                        type="radio"
                        name="category"
                        value={cat}
                        checked={goalCategory === cat}
                        onChange={() => setGoalCategory(cat)}
                        className="accent-edtech-primary"
                      />
                      <span>{CATEGORY_LABELS[cat]}</span>
                    </label>
                  )
                )}
              </div>
            </fieldset>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="goal-target-hours"
                  className="block text-xs font-bold text-edtech-text mb-1"
                >
                  Tổng số giờ cần đạt <span aria-hidden="true">*</span>
                </label>
                <input
                  id="goal-target-hours"
                  name="targetHours"
                  type="number"
                  min={1}
                  max={1000}
                  required
                  value={goalTargetHours}
                  onChange={(e) => {
                    setGoalTargetHours(e.target.value);
                    if (goalError) setGoalError("");
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-edtech-bg border border-slate-300 text-sm text-edtech-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-edtech-primary"
                />
              </div>

              <div>
                <label
                  htmlFor="goal-deadline"
                  className="block text-xs font-bold text-edtech-text mb-1"
                >
                  Hạn hoàn thành <span aria-hidden="true">*</span>
                </label>
                <input
                  id="goal-deadline"
                  name="deadline"
                  type="date"
                  required
                  value={goalDeadline}
                  onChange={(e) => setGoalDeadline(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-edtech-bg border border-slate-300 text-sm text-edtech-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-edtech-primary"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="goal-description"
                className="block text-xs font-bold text-edtech-text mb-1"
              >
                Mô tả chi tiết / tiêu chí đánh giá
              </label>
              <textarea
                id="goal-description"
                name="description"
                rows={2}
                value={goalDescription}
                onChange={(e) => setGoalDescription(e.target.value)}
                placeholder="Ghi chú các chương cần ôn hoặc thói quen cần giữ..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-edtech-bg border border-slate-300 text-sm text-edtech-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-edtech-primary"
              />
            </div>

            {goalError && (
              <p
                role="alert"
                className="text-xs font-semibold text-edtech-danger flex items-center gap-1.5"
              >
                <AlertCircle className="w-4 h-4 shrink-0" aria-hidden={true} />
                <span>{goalError}</span>
              </p>
            )}

            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-edtech-primary hover:bg-edtech-primaryHover text-white text-sm font-bold shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4" aria-hidden={true} />
              <span>
                {editingGoalId ? "Cập nhật mục tiêu" : "Lưu mục tiêu mới"}
              </span>
            </button>
          </form>
        </section>

        {/* Danh sách Mục tiêu */}
        <section
          aria-labelledby="goal-list-heading"
          className="lg:col-span-7 p-6 rounded-2xl bg-edtech-surface border border-edtech-border shadow-sm space-y-4"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h2
              id="goal-list-heading"
              className="text-lg font-bold text-edtech-text"
            >
              Danh sách Mục tiêu Cá nhân ({state.goals.length})
            </h2>
            <span className="text-xs text-edtech-muted">
              Số phút được cộng tự động khi học xong 25p/50p tại Pomodoro
            </span>
          </div>

          {state.goals.length === 0 ? (
            <p className="p-6 text-center text-sm text-edtech-muted bg-edtech-bg rounded-xl border border-edtech-border">
              Chưa có mục tiêu nào. Hãy tạo mục tiêu đầu tiên ở khung bên trái!
            </p>
          ) : (
            <ul className="space-y-3.5">
              {state.goals.map((goal) => {
                const remaining = getDaysRemainingInfo(goal.deadline, today);

                return (
                  <li
                    key={goal.id}
                    data-testid={`goal-card-${goal.id}`}
                    className="p-4 rounded-xl bg-edtech-bg border border-edtech-border space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded-md text-xs font-semibold bg-blue-50 text-edtech-primary border border-blue-200">
                            {CATEGORY_LABELS[goal.category]}
                          </span>
                          <span className="text-xs text-edtech-muted font-medium">
                            Hạn: {goal.deadline}
                          </span>
                          <span
                            data-testid={`goal-days-left-${goal.id}`}
                            className={`px-2 py-0.5 rounded-md text-xs font-bold border ${
                              remaining.isOverdue
                                ? "bg-red-50 text-edtech-danger border-red-200"
                                : remaining.isUrgent
                                ? "bg-amber-50 text-amber-700 border-amber-200"
                                : "bg-slate-200/70 text-edtech-text border-slate-300"
                            }`}
                          >
                            {remaining.label}
                          </span>
                        </div>
                        <h3 className="text-sm font-bold text-edtech-text">
                          {goal.title}
                        </h3>
                        {goal.description && (
                          <p className="text-xs text-edtech-muted leading-relaxed">
                            {goal.description}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <Link
                          href="/pomodoro"
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-edtech-primary text-xs font-bold border border-blue-200 transition-colors"
                        >
                          <Timer className="w-3.5 h-3.5" aria-hidden={true} />
                          <span>Học Pomodoro</span>
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleStartEditGoal(goal)}
                          aria-label={`Sửa mục tiêu ${goal.title}`}
                          className="p-1.5 rounded-lg bg-white hover:bg-slate-100 text-edtech-text border border-edtech-border transition-colors"
                        >
                          <Edit3 className="w-4 h-4" aria-hidden={true} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteGoal(goal)}
                          aria-label={`Xóa mục tiêu ${goal.title}`}
                          className="p-1.5 rounded-lg bg-white hover:bg-red-50 text-edtech-danger border border-edtech-border transition-colors"
                        >
                          <Trash2 className="w-4 h-4" aria-hidden={true} />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-edtech-muted">
                          Đã tích lũy:{" "}
                          <strong className="text-edtech-text">
                            {formatHoursAndMinutes(goal.completedHours)}
                          </strong>{" "}
                          / {goal.targetHours} giờ
                        </span>
                        <span className="font-bold text-edtech-success">
                          {goal.progressPercent}%
                        </span>
                      </div>
                      <div
                        className="w-full h-2 rounded-full bg-slate-200 overflow-hidden"
                        role="progressbar"
                        aria-valuenow={goal.progressPercent}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`Tiến độ ${goal.title}`}
                      >
                        <div
                          className="h-full bg-edtech-success rounded-full transition-all"
                          style={{ width: `${goal.progressPercent}%` }}
                        />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {/* PHẦN 2: THỜI GIAN BIỂU & SỰ KIỆN LỊCH TRÌNH */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Form Thêm Sự kiện Lịch trình */}
        <section
          aria-labelledby="event-form-heading"
          className="lg:col-span-5 p-6 rounded-2xl bg-edtech-surface border border-edtech-border shadow-sm space-y-4"
        >
          <div className="flex items-center gap-2">
            <CalendarCheck2
              className="w-5 h-5 text-edtech-primary"
              aria-hidden={true}
            />
            <h2
              id="event-form-heading"
              className="text-lg font-bold text-edtech-text"
            >
              Lên Lịch Học tập &amp; Vận động
            </h2>
          </div>

          <form
            aria-labelledby="event-form-heading"
            onSubmit={handleEventSubmit}
            className="space-y-4"
            noValidate
          >
            <div>
              <label
                htmlFor="event-title"
                className="block text-xs font-bold text-edtech-text mb-1"
              >
                Nội dung buổi lịch <span aria-hidden="true">*</span>
              </label>
              <input
                id="event-title"
                name="title"
                type="text"
                required
                value={eventTitle}
                onChange={(e) => {
                  setEventTitle(e.target.value);
                  if (eventError) setEventError("");
                }}
                aria-invalid={eventError ? "true" : undefined}
                placeholder="VD: Giải đề Reading Cam 18 / Tập 15 nhịp Squat"
                className="w-full px-3.5 py-2.5 rounded-xl bg-edtech-bg border border-slate-300 text-sm text-edtech-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-edtech-primary"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label
                  htmlFor="event-date"
                  className="block text-xs font-bold text-edtech-text mb-1"
                >
                  Ngày học <span aria-hidden="true">*</span>
                </label>
                <input
                  id="event-date"
                  name="date"
                  type="date"
                  required
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-edtech-bg border border-slate-300 text-sm text-edtech-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-edtech-primary"
                />
              </div>

              <div>
                <label
                  htmlFor="event-start"
                  className="block text-xs font-bold text-edtech-text mb-1"
                >
                  Giờ bắt đầu <span aria-hidden="true">*</span>
                </label>
                <input
                  id="event-start"
                  name="startTime"
                  type="time"
                  required
                  value={eventStartTime}
                  onChange={(e) => {
                    setEventStartTime(e.target.value);
                    if (eventError) setEventError("");
                  }}
                  className="w-full px-3 py-2.5 rounded-xl bg-edtech-bg border border-slate-300 text-sm text-edtech-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-edtech-primary"
                />
              </div>

              <div>
                <label
                  htmlFor="event-end"
                  className="block text-xs font-bold text-edtech-text mb-1"
                >
                  Giờ kết thúc <span aria-hidden="true">*</span>
                </label>
                <input
                  id="event-end"
                  name="endTime"
                  type="time"
                  required
                  value={eventEndTime}
                  onChange={(e) => {
                    setEventEndTime(e.target.value);
                    if (eventError) setEventError("");
                  }}
                  className="w-full px-3 py-2.5 rounded-xl bg-edtech-bg border border-slate-300 text-sm text-edtech-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-edtech-primary"
                />
              </div>
            </div>

            <fieldset className="space-y-1.5">
              <legend className="text-xs font-bold text-edtech-text">
                Loại hoạt động
              </legend>
              <div className="grid grid-cols-3 gap-2 pt-1">
                {(["study", "exercise", "review"] as ScheduleEventType[]).map(
                  (t) => (
                    <label
                      key={t}
                      htmlFor={`event-type-${t}`}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold cursor-pointer transition-colors ${
                        eventType === t
                          ? "bg-blue-50 border-edtech-primary text-edtech-primary"
                          : "bg-edtech-bg border-edtech-border text-edtech-text"
                      }`}
                    >
                      <input
                        id={`event-type-${t}`}
                        type="radio"
                        name="type"
                        value={t}
                        checked={eventType === t}
                        onChange={() => setEventType(t)}
                        className="accent-edtech-primary"
                      />
                      <span>{EVENT_TYPE_LABELS[t]}</span>
                    </label>
                  )
                )}
              </div>
            </fieldset>

            <div>
              <label
                htmlFor="event-goal"
                className="block text-xs font-bold text-edtech-text mb-1"
              >
                Liên kết với Mục tiêu (để chọn nhanh trong phòng Pomodoro)
              </label>
              <select
                id="event-goal"
                name="goalId"
                value={eventGoalId}
                onChange={(e) => setEventGoalId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-edtech-bg border border-slate-300 text-sm text-edtech-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-edtech-primary"
              >
                <option value="">-- Không gắn mục tiêu cụ thể --</option>
                {state.goals.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="event-notes"
                className="block text-xs font-bold text-edtech-text mb-1"
              >
                Ghi chú chuẩn bị
              </label>
              <input
                id="event-notes"
                name="notes"
                type="text"
                value={eventNotes}
                onChange={(e) => setEventNotes(e.target.value)}
                placeholder="VD: Chuẩn bị vở nháp, bật Pomodoro 50/15..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-edtech-bg border border-slate-300 text-sm text-edtech-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-edtech-primary"
              />
            </div>

            {eventError && (
              <p
                role="alert"
                className="text-xs font-semibold text-edtech-danger flex items-center gap-1.5"
              >
                <AlertCircle className="w-4 h-4 shrink-0" aria-hidden={true} />
                <span>{eventError}</span>
              </p>
            )}

            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-edtech-primary hover:bg-edtech-primaryHover text-white text-sm font-bold shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4" aria-hidden={true} />
              <span>Thêm vào lịch trình</span>
            </button>
          </form>
        </section>

        {/* Danh sách Lịch trình Tương tác */}
        <section
          aria-labelledby="schedule-list-heading"
          className="lg:col-span-7 p-6 rounded-2xl bg-edtech-surface border border-edtech-border shadow-sm space-y-4"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-edtech-border">
            <div className="flex items-center gap-2">
              <Clock
                className="w-5 h-5 text-edtech-primary"
                aria-hidden={true}
              />
              <h2
                id="schedule-list-heading"
                className="text-lg font-bold text-edtech-text"
              >
                Thời gian biểu ({filteredEvents.length} buổi)
              </h2>
            </div>

            {/* Bộ lọc ngày & loại hoạt động */}
            <div
              role="search"
              aria-label="Bộ lọc lịch trình"
              className="flex flex-wrap items-center gap-2"
            >
              <div className="inline-flex rounded-xl bg-edtech-bg p-1 border border-edtech-border">
                <button
                  type="button"
                  onClick={() => setFilterDateMode("all")}
                  aria-pressed={filterDateMode === "all"}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                    filterDateMode === "all"
                      ? "bg-edtech-primary text-white"
                      : "text-edtech-muted hover:text-edtech-text"
                  }`}
                >
                  Tất cả ngày
                </button>
                <button
                  type="button"
                  onClick={() => setFilterDateMode("date")}
                  aria-pressed={filterDateMode === "date"}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                    filterDateMode === "date"
                      ? "bg-edtech-primary text-white"
                      : "text-edtech-muted hover:text-edtech-text"
                  }`}
                >
                  Theo ngày
                </button>
              </div>

              {filterDateMode === "date" && (
                <input
                  type="date"
                  aria-label="Chọn ngày xem lịch"
                  value={selectedFilterDate}
                  onChange={(e) => setSelectedFilterDate(e.target.value)}
                  className="px-2.5 py-1 rounded-xl bg-edtech-bg border border-slate-300 text-xs text-edtech-text"
                />
              )}

              <div className="flex items-center gap-1">
                <Filter
                  className="w-3.5 h-3.5 text-edtech-muted"
                  aria-hidden={true}
                />
                <select
                  aria-label="Lọc theo loại hoạt động"
                  value={filterEventType}
                  onChange={(e) =>
                    setFilterEventType(
                      e.target.value as "all" | ScheduleEventType
                    )
                  }
                  className="px-2.5 py-1.5 rounded-xl bg-edtech-bg border border-slate-300 text-xs font-semibold text-edtech-text"
                >
                  <option value="all">Tất cả loại</option>
                  <option value="study">Học tập</option>
                  <option value="exercise">Vận động</option>
                  <option value="review">Ôn tập</option>
                </select>
              </div>
            </div>
          </div>

          {filteredEvents.length === 0 ? (
            <p className="p-6 text-center text-sm text-edtech-muted bg-edtech-bg rounded-xl border border-edtech-border">
              Không có buổi lịch nào khớp với bộ lọc hiện tại.
            </p>
          ) : (
            <ul className="space-y-3">
              {filteredEvents.map((evt) => {
                const linkedGoal = state.goals.find((g) => g.id === evt.goalId);
                const durationHours = calculateEventDurationHours(
                  evt.startTime,
                  evt.endTime
                );
                const isDone = evt.status === "completed";
                const isMissed = evt.status === "missed";

                return (
                  <li
                    key={evt.id}
                    data-testid={`event-card-${evt.id}`}
                    className="p-4 rounded-xl bg-edtech-bg border border-edtech-border space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-bold text-edtech-primary">
                            {evt.date} • {evt.startTime} - {evt.endTime}
                          </span>
                          <span className="px-2 py-0.5 rounded-md text-xs font-semibold bg-slate-200/80 text-edtech-text">
                            {EVENT_TYPE_LABELS[evt.type]} (
                            {formatHoursAndMinutes(durationHours)})
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-md text-xs font-bold ${
                              isDone
                                ? "bg-emerald-50 text-edtech-success border border-emerald-200"
                                : isMissed
                                ? "bg-red-50 text-edtech-danger border border-red-200"
                                : "bg-blue-50 text-edtech-primary border border-blue-200"
                            }`}
                          >
                            {isDone
                              ? "Đã hoàn thành"
                              : isMissed
                              ? "Bỏ lỡ"
                              : "Dự kiến"}
                          </span>
                        </div>

                        <h3
                          className={`text-sm font-bold ${
                            isDone
                              ? "line-through text-edtech-muted"
                              : "text-edtech-text"
                          }`}
                        >
                          {evt.title}
                        </h3>

                        {linkedGoal && (
                          <p className="text-xs text-edtech-primary font-medium">
                            Mục tiêu: {linkedGoal.title}
                          </p>
                        )}
                        {evt.notes && (
                          <p className="text-xs text-edtech-muted">
                            Ghi chú: {evt.notes}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                        {!isDone && (
                          <Link
                            href="/pomodoro"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-edtech-primary text-xs font-bold border border-blue-200 transition-colors"
                          >
                            <Timer className="w-3.5 h-3.5" aria-hidden={true} />
                            <span>Bắt đầu học</span>
                          </Link>
                        )}

                        {isDone ? (
                          <button
                            type="button"
                            onClick={() =>
                              handleChangeEventStatus(evt.id, "planned")
                            }
                            className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-edtech-text text-xs font-semibold border border-edtech-border transition-colors"
                          >
                            Đặt lại Dự kiến
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              handleChangeEventStatus(evt.id, "completed")
                            }
                            aria-label={`Hoàn thành ${evt.title}`}
                            className="px-3 py-1.5 rounded-lg bg-edtech-success hover:bg-emerald-600 text-white text-xs font-bold shadow-sm transition-colors"
                          >
                            Hoàn thành
                          </button>
                        )}

                        {!isMissed && !isDone && (
                          <button
                            type="button"
                            onClick={() =>
                              handleChangeEventStatus(evt.id, "missed")
                            }
                            className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-amber-50 text-amber-700 text-xs font-semibold border border-edtech-border transition-colors"
                          >
                            Bỏ lỡ
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleDeleteEvent(evt.id, evt.title)}
                          aria-label={`Xóa buổi lịch ${evt.title}`}
                          className="p-1.5 rounded-lg bg-white hover:bg-red-50 text-edtech-danger border border-edtech-border transition-colors"
                        >
                          <Trash2 className="w-4 h-4" aria-hidden={true} />
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
