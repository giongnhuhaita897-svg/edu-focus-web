"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Timer,
  Play,
  Pause,
  RotateCcw,
  Coffee,
  BookOpen,
  Camera,
  CheckCircle2,
  ArrowRightLeft,
  Target,
  Briefcase,
} from "lucide-react";
import {
  AppDatabaseState,
  PomodoroPhase,
  PomodoroPreset,
  PomodoroPresetId,
} from "@/types/database";
import {
  createDefaultState,
  formatHoursAndMinutes,
  loadAppState,
  recordPomodoroWorkSessionInState,
} from "@/lib/storage/local-db";

export const POMODORO_PRESETS: Record<PomodoroPresetId, PomodoroPreset> = {
  "25_5": {
    id: "25_5",
    label: "Pomodoro Chuẩn 25/5",
    workMinutes: 25,
    breakMinutes: 5,
    description:
      "25 phút Học/Làm tập trung + 5 phút Nghỉ ngắn. Phù hợp ôn từ vựng, đọc tài liệu, giải bài tập ngắn.",
  },
  "50_15": {
    id: "50_15",
    label: "Deep Work 50/15",
    workMinutes: 50,
    breakMinutes: 15,
    description:
      "50 phút Học/Làm chuyên sâu + 15 phút Nghỉ & Vận động giãn cơ. Phù hợp lập trình, giải đề thi, nghiên cứu sâu.",
  },
};

export function formatSecondsToMMSS(totalSeconds: number): string {
  const safe = Math.max(0, totalSeconds);
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export function PomodoroHub() {
  const [dbState, setDbState] = useState<AppDatabaseState>(() =>
    createDefaultState()
  );
  const [presetId, setPresetId] = useState<PomodoroPresetId>("25_5");
  const [phase, setPhase] = useState<PomodoroPhase>("work");
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [completedCycles, setCompletedCycles] = useState<number>(2);
  const [selectedGoalId, setSelectedGoalId] = useState<string>("goal-dsa");
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [sessionBanner, setSessionBanner] = useState<string>("");

  useEffect(() => {
    const loaded = loadAppState();
    setDbState(loaded);
    if (loaded.goals.length > 0) {
      setSelectedGoalId(loaded.goals[0].id);
    }
  }, []);

  const currentPreset = POMODORO_PRESETS[presetId];
  const initialSeconds =
    (phase === "work"
      ? currentPreset.workMinutes
      : currentPreset.breakMinutes) * 60;

  const [secondsLeft, setSecondsLeft] = useState<number>(initialSeconds);

  useEffect(() => {
    setIsRunning(false);
    setSecondsLeft(
      (phase === "work"
        ? POMODORO_PRESETS[presetId].workMinutes
        : POMODORO_PRESETS[presetId].breakMinutes) * 60
    );
  }, [presetId, phase]);

  const syncWithServer = (nextState: AppDatabaseState) => {
    setDbState(nextState);
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

  const handleCompleteWorkSession = () => {
    const workMins = currentPreset.workMinutes;
    const next = recordPomodoroWorkSessionInState(dbState, {
      presetId,
      workMinutes: workMins,
      goalId: selectedGoalId || undefined,
      scheduleEventId: selectedEventId || undefined,
    });
    syncWithServer(next);
    setCompletedCycles((c) => c + 1);
    setIsRunning(false);

    const targetGoal = next.goals.find((g) => g.id === selectedGoalId);
    setSessionBanner(
      targetGoal
        ? `Hoàn thành phiên tập trung ${workMins} phút! Đã cộng chính xác +${workMins} phút vào mục tiêu "${targetGoal.title}" (Tổng: ${formatHoursAndMinutes(
            targetGoal.completedHours
          )} / ${targetGoal.targetHours} giờ).`
        : `Hoàn thành phiên tập trung ${workMins} phút! Hãy nghỉ giải lao ${currentPreset.breakMinutes} phút nhé.`
    );
    setPhase("break");
  };

  useEffect(() => {
    if (!isRunning) return;
    const interval = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          setIsRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [isRunning]);

  // Khi đồng hồ đếm ngược pha Học/Làm chạm mốc 0, tự động ghi nhận phiên học
  useEffect(() => {
    if (secondsLeft === 0 && phase === "work") {
      handleCompleteWorkSession();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft]);

  const progressPercent =
    initialSeconds > 0
      ? Math.round(((initialSeconds - secondsLeft) / initialSeconds) * 100)
      : 0;

  const handleReset = () => {
    setIsRunning(false);
    setSecondsLeft(initialSeconds);
  };

  const handleTogglePhase = () => {
    setPhase((prev) => (prev === "work" ? "break" : "work"));
  };

  const handleSelectEvent = (eventId: string) => {
    setSelectedEventId(eventId);
    const foundEvt = dbState.scheduleEvents.find((e) => e.id === eventId);
    if (foundEvt?.goalId) {
      setSelectedGoalId(foundEvt.goalId);
    }
  };

  const selectedGoal = dbState.goals.find((g) => g.id === selectedGoalId);
  const selectedEvent = dbState.scheduleEvents.find(
    (e) => e.id === selectedEventId
  );

  return (
    <div className="space-y-8">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-edtech-primary border border-blue-200">
            Quản lý nhịp độ Học / Làm &amp; Nghỉ
          </span>
          <h1 className="mt-2 text-2xl md:text-3xl font-bold text-edtech-text">
            Đồng hồ Kỷ luật Pomodoro (25/5 &amp; 50/15)
          </h1>
          <p className="mt-1 text-sm text-edtech-muted">
            Chọn công việc và mục tiêu đang làm trước khi bắt đầu. Số phút học
            thực tế (25 phút hoặc 50 phút) sẽ được cộng dồn chính xác vào mục
            tiêu sau khi hoàn tất phiên tập trung.
          </p>
        </div>

        <Link
          href="/webcam"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-edtech-primary hover:bg-edtech-primaryHover text-white text-sm font-semibold shadow-sm transition-colors shrink-0"
        >
          <Camera className="w-4 h-4" aria-hidden={true} />
          <span>Mở kèm Giám sát Webcam</span>
        </Link>
      </header>

      {sessionBanner && (
        <div
          role="status"
          aria-live="polite"
          className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-edtech-success flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden={true} />
            <span>{sessionBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setSessionBanner("")}
            className="text-xs underline text-edtech-muted hover:text-edtech-text shrink-0"
          >
            Đóng
          </button>
        </div>
      )}

      {/* Chọn cấu trúc 25/5 hoặc 50/15 */}
      <section aria-label="Chọn chế độ chu kỳ Pomodoro">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(Object.values(POMODORO_PRESETS) as PomodoroPreset[]).map(
            (preset) => {
              const isSelected = preset.id === presetId;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setPresetId(preset.id)}
                  aria-pressed={isSelected}
                  className={`text-left p-5 rounded-2xl border transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-edtech-primary ${
                    isSelected
                      ? "bg-blue-50/80 border-edtech-primary shadow-sm"
                      : "bg-edtech-surface border-edtech-border hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <Timer
                        aria-hidden={true}
                        className={`w-5 h-5 ${
                          isSelected
                            ? "text-edtech-primary"
                            : "text-edtech-muted"
                        }`}
                      />
                      <span className="text-base font-bold text-edtech-text">
                        {preset.label}
                      </span>
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                        isSelected
                          ? "bg-edtech-primary text-white"
                          : "bg-slate-100 text-edtech-muted"
                      }`}
                    >
                      {preset.workMinutes}p Học/Làm • {preset.breakMinutes}p
                      Nghỉ
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-edtech-muted leading-relaxed">
                    {preset.description}
                  </p>
                </button>
              );
            }
          )}
        </div>
      </section>

      {/* Khu vực Chọn Công việc & Mục tiêu đang làm để tích hợp cộng dồn số phút chuẩn xác */}
      <section
        aria-label="Chọn công việc và mục tiêu đang thực hiện"
        className="p-6 rounded-2xl bg-edtech-surface border border-edtech-border shadow-sm space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Briefcase
              className="w-5 h-5 text-edtech-primary"
              aria-hidden={true}
            />
            <h2 className="text-base font-bold text-edtech-text">
              Công việc &amp; Mục tiêu Đang Thực hiện trong Phiên Tập trung
            </h2>
          </div>
          <span className="text-xs font-semibold text-edtech-success">
            +{currentPreset.workMinutes} phút sẽ được cộng khi hoàn tất phiên
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="pomodoro-task-select"
              className="block text-xs font-bold text-edtech-text mb-1.5"
            >
              1. Chọn công việc trong Lịch trình (tùy chọn)
            </label>
            <select
              id="pomodoro-task-select"
              name="scheduleEventId"
              value={selectedEventId}
              onChange={(e) => handleSelectEvent(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-edtech-bg border border-slate-300 text-sm text-edtech-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-edtech-primary"
            >
              <option value="">
                -- Tự học ngoài lịch (Chỉ cộng giờ vào Mục tiêu) --
              </option>
              {dbState.scheduleEvents.map((evt) => (
                <option key={evt.id} value={evt.id}>
                  [{evt.startTime}-{evt.endTime}] {evt.title}{" "}
                  {evt.status === "completed" ? "(Đã xong)" : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="pomodoro-goal-select"
              className="block text-xs font-bold text-edtech-text mb-1.5"
            >
              2. Mục tiêu nhận tích lũy thời gian học (+
              {currentPreset.workMinutes} phút)
            </label>
            <select
              id="pomodoro-goal-select"
              name="goalId"
              value={selectedGoalId}
              onChange={(e) => setSelectedGoalId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-edtech-bg border border-slate-300 text-sm text-edtech-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-edtech-primary"
            >
              {dbState.goals.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.title} ({formatHoursAndMinutes(g.completedHours)} /{" "}
                  {g.targetHours} giờ)
                </option>
              ))}
            </select>
          </div>
        </div>

        {selectedGoal && (
          <div className="p-4 rounded-xl bg-edtech-bg border border-edtech-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2 text-xs font-bold text-edtech-primary">
                <Target className="w-4 h-4" aria-hidden={true} />
                <span>Đang tích lũy cho: {selectedGoal.title}</span>
              </div>
              <p className="text-xs text-edtech-muted">
                {selectedEvent
                  ? `Công việc hiện tại: ${selectedEvent.title}`
                  : "Đang tập trung làm việc trực tiếp cho mục tiêu này."}
              </p>
            </div>
            <div className="text-left sm:text-right shrink-0">
              <p
                data-testid="pomodoro-selected-goal-progress"
                className="text-xs font-bold text-edtech-text"
              >
                Đã tích lũy: {formatHoursAndMinutes(selectedGoal.completedHours)}{" "}
                / {selectedGoal.targetHours} giờ ({selectedGoal.progressPercent}
                %)
              </p>
              <p className="text-xs text-edtech-success font-medium">
                Hoàn thành phiên này sẽ cộng thêm +{currentPreset.workMinutes}{" "}
                phút
              </p>
            </div>
          </div>
        )}
      </section>

      {/* Khung đồng hồ chính & Cấu trúc Học/Làm - Nghỉ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section
          aria-label="Đồng hồ đếm ngược Pomodoro"
          className="lg:col-span-2 p-6 md:p-8 rounded-2xl bg-edtech-surface border border-edtech-border shadow-sm flex flex-col items-center text-center space-y-6"
        >
          {/* Bộ chuyển pha Học/Làm vs Nghỉ */}
          <div
            role="group"
            aria-label="Pha hoạt động hiện tại"
            className="inline-flex p-1.5 rounded-xl bg-edtech-bg border border-edtech-border"
          >
            <button
              type="button"
              onClick={() => setPhase("work")}
              aria-pressed={phase === "work"}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-colors ${
                phase === "work"
                  ? "bg-edtech-primary text-white shadow-sm"
                  : "text-edtech-muted hover:text-edtech-text"
              }`}
            >
              <BookOpen className="w-4 h-4" aria-hidden={true} />
              <span>
                Pha Học / Làm việc ({currentPreset.workMinutes} phút)
              </span>
            </button>
            <button
              type="button"
              onClick={() => setPhase("break")}
              aria-pressed={phase === "break"}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-colors ${
                phase === "break"
                  ? "bg-edtech-success text-white shadow-sm"
                  : "text-edtech-muted hover:text-edtech-text"
              }`}
            >
              <Coffee className="w-4 h-4" aria-hidden={true} />
              <span>
                Pha Nghỉ giải lao ({currentPreset.breakMinutes} phút)
              </span>
            </button>
          </div>

          {/* Hiển thị thời gian lớn */}
          <div className="space-y-2">
            <span
              className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${
                phase === "work"
                  ? "bg-blue-50 text-edtech-primary border border-blue-200"
                  : "bg-emerald-50 text-edtech-success border border-emerald-200"
              }`}
            >
              {phase === "work"
                ? `Đang tập trung Học / Làm (${currentPreset.workMinutes} phút)`
                : `Đang trong pha Nghỉ ngơi & Vận động (${currentPreset.breakMinutes} phút)`}
            </span>
            <div
              data-testid="pomodoro-timer-display"
              className="text-6xl md:text-7xl font-extrabold tracking-tight text-edtech-text tabular-nums"
            >
              {formatSecondsToMMSS(secondsLeft)}
            </div>
          </div>

          {/* Thanh tiến độ chu kỳ */}
          <div className="w-full max-w-md space-y-1.5">
            <div
              className="w-full h-2.5 rounded-full bg-slate-200 overflow-hidden"
              role="progressbar"
              aria-valuenow={progressPercent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Tiến độ pha Pomodoro hiện tại"
            >
              <div
                className={`h-full rounded-full transition-all ${
                  phase === "work" ? "bg-edtech-primary" : "bg-edtech-success"
                }`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-edtech-muted">
              <span>Đã hoàn thành {progressPercent}% pha này</span>
              <span>Chế độ: {currentPreset.label}</span>
            </div>
          </div>

          {/* Các nút điều khiển */}
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => setIsRunning((prev) => !prev)}
              className={`inline-flex items-center gap-2 px-6 py-3 rounded-xl text-white text-sm font-bold shadow-sm transition-colors ${
                phase === "work"
                  ? "bg-edtech-primary hover:bg-edtech-primaryHover"
                  : "bg-edtech-success hover:bg-emerald-600"
              }`}
            >
              {isRunning ? (
                <>
                  <Pause className="w-4 h-4" aria-hidden={true} />
                  <span>Tạm dừng</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" aria-hidden={true} />
                  <span>Bắt đầu phiên</span>
                </>
              )}
            </button>

            {phase === "work" && (
              <button
                type="button"
                onClick={handleCompleteWorkSession}
                className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-edtech-success text-sm font-bold border border-emerald-200 transition-colors"
              >
                <CheckCircle2 className="w-4 h-4" aria-hidden={true} />
                <span>
                  Hoàn tất phiên &amp; Cộng +{currentPreset.workMinutes} phút
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-edtech-bg hover:bg-slate-200/70 text-edtech-text text-sm font-semibold border border-edtech-border transition-colors"
            >
              <RotateCcw className="w-4 h-4" aria-hidden={true} />
              <span>Đặt lại</span>
            </button>

            <button
              type="button"
              onClick={handleTogglePhase}
              className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-edtech-surface hover:bg-slate-100 text-edtech-text text-sm font-semibold border border-edtech-border transition-colors"
            >
              <ArrowRightLeft className="w-4 h-4" aria-hidden={true} />
              <span>
                Chuyển sang {phase === "work" ? "Pha Nghỉ" : "Pha Học/Làm"}
              </span>
            </button>
          </div>
        </section>

        {/* Cột thông tin tích hợp với Phòng Kỷ luật Webcam */}
        <section
          aria-label="Cấu trúc tích hợp với Phòng Kỷ luật Webcam"
          className="p-6 rounded-2xl bg-edtech-surface border border-edtech-border shadow-sm space-y-5"
        >
          <div>
            <h2 className="text-base font-bold text-edtech-text">
              Cơ chế Tích lũy Phút Học Chuẩn xác
            </h2>
            <p className="mt-1 text-xs text-edtech-muted leading-relaxed">
              Thay vì tự cộng giờ thủ công dễ sai lệch, hệ thống chỉ cộng đúng{" "}
              <strong>25 phút</strong> hoặc <strong>50 phút</strong> thực tế sau
              mỗi phiên tập trung hoàn thành:
            </p>
          </div>

          <div className="space-y-3">
            <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200">
              <p className="text-xs font-bold text-edtech-primary">
                1. Khi ở Pha Học / Làm ({currentPreset.workMinutes} phút)
              </p>
              <p className="mt-1 text-xs text-edtech-text leading-relaxed">
                Gắn với công việc &amp; mục tiêu đã chọn. Kết hợp mục{" "}
                <strong>Giám sát Ngồi học &amp; Tập trung</strong> trong Phòng
                Kỷ luật để đảm bảo học thật trước khi cộng phút.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200">
              <p className="text-xs font-bold text-edtech-success">
                2. Khi sang Pha Nghỉ ({currentPreset.breakMinutes} phút)
              </p>
              <p className="mt-1 text-xs text-edtech-text leading-relaxed">
                Chuyển sang mục <strong>Giám sát Tập thể dục</strong> để đếm
                chuẩn số nhịp Giơ tay qua đầu, Squat hoặc Giãn cơ vai giúp tỉnh
                táo trở lại.
              </p>
            </div>
          </div>

          <div className="pt-3 border-t border-edtech-border flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-edtech-text">
              <CheckCircle2
                className="w-4 h-4 text-edtech-success"
                aria-hidden={true}
              />
              <span>Chu kỳ hoàn thành hôm nay:</span>
            </div>
            <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-edtech-success text-xs font-bold border border-emerald-200">
              {completedCycles} chu kỳ
            </span>
          </div>
        </section>
      </div>
    </div>
  );
}
