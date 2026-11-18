"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Target,
  Clock,
  CheckCircle2,
  Camera,
  Sparkles,
  CalendarCheck2,
  Activity,
  Timer,
  TrendingUp,
  Compass,
  Award,
  PlusCircle,
} from "lucide-react";
import {
  createDefaultState,
  formatHoursAndMinutes,
  getDaysRemainingInfo,
  loadAppState,
  STATE_CHANGE_EVENT,
  updateScheduleEventStatusInState,
} from "@/lib/storage/local-db";
import { AppDatabaseState } from "@/types/database";

export default function DashboardPage() {
  const [state, setState] = useState<AppDatabaseState>(() =>
    createDefaultState()
  );

  useEffect(() => {
    const refresh = () => setState(loadAppState());
    refresh();
    window.addEventListener(STATE_CHANGE_EVENT, refresh);
    return () => window.removeEventListener(STATE_CHANGE_EVENT, refresh);
  }, []);

  const totalFocusMinutes = state.focusSessions.reduce(
    (sum, s) => sum + s.durationMinutes,
    0
  );
  const completedEventsCount = state.scheduleEvents.filter(
    (e) => e.status === "completed"
  ).length;
  const totalReps = state.focusSessions.reduce(
    (sum, s) => sum + (s.completedReps ?? 0),
    0
  );
  const averageFocusScore =
    state.focusSessions.length > 0
      ? Math.round(
          state.focusSessions.reduce((sum, s) => sum + s.focusScorePercent, 0) /
            state.focusSessions.length
        )
      : 100;

  const latestAdvice = state.aiMessages[state.aiMessages.length - 1];
  const isFreshUser =
    state.goals.length === 0 && state.scheduleEvents.length === 0;

  const handleQuickToggleEvent = (eventId: string, currentStatus: string) => {
    const nextStatus = currentStatus === "completed" ? "planned" : "completed";
    const next = updateScheduleEventStatusInState(state, eventId, nextStatus);
    setState(next);
  };

  return (
    <div className="space-y-8">
      {/* Hero Banner phiên bản v1.1+ */}
      <header className="p-6 md:p-7 rounded-2xl bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-800 text-white shadow-sm flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
        <div className="space-y-2 max-w-2xl">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-white/15 text-blue-50 border border-white/20">
            Không gian học tập cá nhân • Phiên bản v1.1+
          </span>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
            Tổng quan Kỷ luật &amp; Tiến độ Học tập
          </h1>
          <p className="text-sm text-blue-100 leading-relaxed">
            Hệ sinh thái khép kín giúp bạn thiết lập mục tiêu có hạn chót, học
            tập theo chu kỳ Pomodoro 25/5 &amp; 50/15, giám sát tư thế qua
            Webcam và nhận lộ trình từ Cố vấn AI.
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5 shrink-0">
          <Link
            href="/pomodoro"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-blue-50 text-edtech-primary text-sm font-bold shadow-sm transition-colors"
          >
            <Timer className="w-4 h-4" aria-hidden={true} />
            <span>Bắt đầu Pomodoro</span>
          </Link>
          <Link
            href="/webcam"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-500/30 hover:bg-blue-500/40 text-white text-sm font-semibold border border-white/25 transition-colors"
          >
            <Camera className="w-4 h-4" aria-hidden={true} />
            <span>Vào Phòng Kỷ luật</span>
          </Link>
          <Link
            href="/calendar"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-500/30 hover:bg-blue-500/40 text-white text-sm font-semibold border border-white/25 transition-colors"
          >
            <CalendarCheck2 className="w-4 h-4" aria-hidden={true} />
            <span>Mở Lịch trình</span>
          </Link>
        </div>
      </header>

      {/* Khung Hướng dẫn 3 bước cho Người dùng mới (khi trạng thái trống) */}
      {isFreshUser && (
        <section
          aria-label="Hướng dẫn khởi đầu cho người dùng mới"
          className="p-6 rounded-2xl bg-edtech-surface border-2 border-dashed border-blue-300 shadow-sm space-y-5"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <Compass
                className="w-6 h-6 text-edtech-primary"
                aria-hidden={true}
              />
              <div>
                <h2 className="text-lg font-bold text-edtech-text">
                  Bắt đầu Hành trình Kỷ luật Tự học (3 Bước Khởi tạo)
                </h2>
                <p className="text-xs text-edtech-muted">
                  Tài khoản đang ở trạng thái mới hoàn toàn. Hãy hoàn tất 3
                  bước dưới đây để kích hoạt hệ thống:
                </p>
              </div>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-edtech-primary border border-blue-200 self-start sm:self-auto">
              Trạng thái: Mới khởi tạo
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <article className="p-4 rounded-xl bg-edtech-bg border border-edtech-border space-y-2">
              <span className="inline-block px-2.5 py-0.5 rounded-md text-xs font-extrabold bg-blue-100 text-edtech-primary">
                Bước 1
              </span>
              <h3 className="text-sm font-bold text-edtech-text">
                Tạo Mục tiêu &amp; Lịch học đầu tiên
              </h3>
              <p className="text-xs text-edtech-muted leading-relaxed">
                Đặt mục tiêu môn học hoặc kỹ năng kèm số giờ cần đạt và ngày hạn
                chót.
              </p>
              <Link
                href="/calendar"
                className="inline-flex items-center gap-1 text-xs font-bold text-edtech-primary hover:underline pt-1"
              >
                <PlusCircle className="w-3.5 h-3.5" aria-hidden={true} />
                <span>Tạo mục tiêu ngay →</span>
              </Link>
            </article>

            <article className="p-4 rounded-xl bg-edtech-bg border border-edtech-border space-y-2">
              <span className="inline-block px-2.5 py-0.5 rounded-md text-xs font-extrabold bg-emerald-100 text-edtech-success">
                Bước 2
              </span>
              <h3 className="text-sm font-bold text-edtech-text">
                Học tập với Pomodoro 25/5 hoặc 50/15
              </h3>
              <p className="text-xs text-edtech-muted leading-relaxed">
                Chọn mục tiêu đang làm trong phòng Pomodoro để cộng dồn từng
                phút học chuẩn xác.
              </p>
              <Link
                href="/pomodoro"
                className="inline-flex items-center gap-1 text-xs font-bold text-edtech-success hover:underline pt-1"
              >
                <Timer className="w-3.5 h-3.5" aria-hidden={true} />
                <span>Mở đồng hồ Pomodoro →</span>
              </Link>
            </article>

            <article className="p-4 rounded-xl bg-edtech-bg border border-edtech-border space-y-2">
              <span className="inline-block px-2.5 py-0.5 rounded-md text-xs font-extrabold bg-indigo-100 text-indigo-700">
                Bước 3
              </span>
              <h3 className="text-sm font-bold text-edtech-text">
                Nhận Đánh giá &amp; Gợi ý Lịch từ AI
              </h3>
              <p className="text-xs text-edtech-muted leading-relaxed">
                Để Cố vấn AI tính định mức học mỗi ngày và đề xuất khung giờ
                trống tự động.
              </p>
              <Link
                href="/ai-mentor"
                className="inline-flex items-center gap-1 text-xs font-bold text-indigo-700 hover:underline pt-1"
              >
                <Sparkles className="w-3.5 h-3.5" aria-hidden={true} />
                <span>Hỏi Cố vấn AI →</span>
              </Link>
            </article>
          </div>
        </section>
      )}

      {/* 4 Thẻ Chỉ số Kỷ luật Chuyên sâu */}
      <section
        aria-label="Chỉ số kỷ luật hôm nay"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        <article className="p-5 rounded-2xl bg-edtech-surface border border-edtech-border shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-edtech-muted">
              Thời gian tập trung
            </span>
            <Clock className="w-5 h-5 text-edtech-primary" aria-hidden={true} />
          </div>
          <p className="mt-3 text-2xl font-extrabold text-edtech-text">
            {totalFocusMinutes} phút
          </p>
          <p className="mt-1 text-xs text-edtech-muted">
            {state.focusSessions.length} phiên đã ghi nhận
          </p>
        </article>

        <article className="p-5 rounded-2xl bg-edtech-surface border border-edtech-border shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-edtech-muted">
              Lịch trình hoàn thành
            </span>
            <CheckCircle2
              className="w-5 h-5 text-edtech-success"
              aria-hidden={true}
            />
          </div>
          <p className="mt-3 text-2xl font-extrabold text-edtech-text">
            {completedEventsCount} / {state.scheduleEvents.length} buổi
          </p>
          <p className="mt-1 text-xs text-edtech-success font-medium">
            {state.scheduleEvents.length > 0
              ? `Đạt ${Math.round(
                  (completedEventsCount / state.scheduleEvents.length) * 100
                )}% kế hoạch`
              : "Chưa có lịch trình hôm nay"}
          </p>
        </article>

        <article className="p-5 rounded-2xl bg-edtech-surface border border-edtech-border shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-edtech-muted">
              Vận động giữa giờ
            </span>
            <Activity
              className="w-5 h-5 text-edtech-success"
              aria-hidden={true}
            />
          </div>
          <p className="mt-3 text-2xl font-extrabold text-edtech-text">
            {totalReps} nhịp tập
          </p>
          <p className="mt-1 text-xs text-edtech-muted">
            Giơ tay qua đầu &amp; giãn cơ vai
          </p>
        </article>

        <article className="p-5 rounded-2xl bg-edtech-surface border border-edtech-border shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-edtech-muted">
              Chất lượng tập trung
            </span>
            <Award className="w-5 h-5 text-edtech-primary" aria-hidden={true} />
          </div>
          <p className="mt-3 text-2xl font-extrabold text-edtech-text">
            {averageFocusScore}%
          </p>
          <p className="mt-1 text-xs text-edtech-primary font-medium">
            Điểm kỷ luật trung bình
          </p>
        </article>
      </section>

      {/* Gợi ý từ Cố vấn AI */}
      {latestAdvice && (
        <section
          aria-label="Nhận xét từ Cố vấn AI"
          className="p-5 rounded-2xl bg-blue-50/70 border border-blue-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
        >
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-edtech-primary text-white flex items-center justify-center shrink-0 mt-0.5">
              <Sparkles className="w-5 h-5" aria-hidden={true} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-edtech-text">
                Lời khuyên từ Cố vấn AI Mentor
              </h2>
              <p className="mt-1 text-sm text-edtech-text leading-relaxed">
                {latestAdvice.content}
              </p>
            </div>
          </div>
          <Link
            href="/ai-mentor"
            className="shrink-0 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-edtech-primary text-xs font-semibold border border-blue-200 transition-colors"
          >
            Xem chi tiết lộ trình
          </Link>
        </section>
      )}

      {/* Danh sách Mục tiêu & Lịch hôm nay */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section
          aria-labelledby="goals-heading"
          className="p-6 rounded-2xl bg-edtech-surface border border-edtech-border shadow-sm space-y-4"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target
                className="w-5 h-5 text-edtech-primary"
                aria-hidden={true}
              />
              <h2
                id="goals-heading"
                className="text-lg font-bold text-edtech-text"
              >
                Mục tiêu trọng tâm
              </h2>
            </div>
            <Link
              href="/calendar"
              className="text-xs font-semibold text-edtech-primary hover:underline"
            >
              {state.goals.length} mục tiêu đang chạy →
            </Link>
          </div>

          {state.goals.length === 0 ? (
            <div className="p-6 rounded-xl bg-edtech-bg border border-edtech-border text-center space-y-2">
              <p className="text-sm font-semibold text-edtech-text">
                Chưa có mục tiêu học tập nào
              </p>
              <p className="text-xs text-edtech-muted">
                Hãy thêm mục tiêu đầu tiên để theo dõi số giờ tích lũy và hạn
                hoàn thành.
              </p>
              <Link
                href="/calendar"
                className="inline-block mt-1 px-3.5 py-2 rounded-xl bg-edtech-primary text-white text-xs font-bold"
              >
                + Tạo mục tiêu mới
              </Link>
            </div>
          ) : (
            <ul className="space-y-3.5">
              {state.goals.map((goal) => (
                <li
                  key={goal.id}
                  className="p-4 rounded-xl bg-edtech-bg border border-edtech-border"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-semibold text-edtech-text">
                        {goal.title}
                      </h3>
                      <p className="mt-0.5 text-xs text-edtech-muted">
                        {formatHoursAndMinutes(goal.completedHours)} /{" "}
                        {goal.targetHours} giờ • Hạn: {goal.deadline} (
                        {getDaysRemainingInfo(goal.deadline).label})
                      </p>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-edtech-success border border-emerald-200">
                      {goal.progressPercent}%
                    </span>
                  </div>
                  <div
                    className="mt-3 w-full h-2 rounded-full bg-slate-200 overflow-hidden"
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
                </li>
              ))}
            </ul>
          )}
        </section>

        <section
          aria-labelledby="schedule-heading"
          className="p-6 rounded-2xl bg-edtech-surface border border-edtech-border shadow-sm space-y-4"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarCheck2
                className="w-5 h-5 text-edtech-primary"
                aria-hidden={true}
              />
              <h2
                id="schedule-heading"
                className="text-lg font-bold text-edtech-text"
              >
                Lịch trình trong ngày
              </h2>
            </div>
            <Link
              href="/calendar"
              className="text-xs font-semibold text-edtech-primary hover:underline"
            >
              Quản lý lịch →
            </Link>
          </div>

          {state.scheduleEvents.length === 0 ? (
            <div className="p-6 rounded-xl bg-edtech-bg border border-edtech-border text-center space-y-2">
              <p className="text-sm font-semibold text-edtech-text">
                Thời gian biểu đang trống
              </p>
              <p className="text-xs text-edtech-muted">
                Bạn có thể tự thêm khung giờ học hoặc nhờ Cố vấn AI gợi ý lịch
                tự động.
              </p>
              <div className="flex items-center justify-center gap-2 pt-1">
                <Link
                  href="/calendar"
                  className="px-3.5 py-2 rounded-xl bg-edtech-primary text-white text-xs font-bold"
                >
                  + Lên lịch học
                </Link>
                <Link
                  href="/ai-mentor"
                  className="px-3.5 py-2 rounded-xl bg-white text-edtech-primary text-xs font-bold border border-blue-200"
                >
                  Nhờ AI gợi ý
                </Link>
              </div>
            </div>
          ) : (
            <ul className="space-y-3">
              {state.scheduleEvents.map((evt) => {
                const isDone = evt.status === "completed";
                return (
                  <li
                    key={evt.id}
                    className="p-3.5 rounded-xl bg-edtech-bg border border-edtech-border flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-edtech-primary">
                          {evt.startTime} - {evt.endTime}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-md bg-slate-200/80 text-edtech-text font-medium">
                          {evt.type === "study"
                            ? "Học tập"
                            : evt.type === "exercise"
                            ? "Vận động"
                            : "Ôn tập"}
                        </span>
                      </div>
                      <p
                        className={`mt-1 text-sm font-semibold truncate ${
                          isDone
                            ? "line-through text-edtech-muted"
                            : "text-edtech-text"
                        }`}
                      >
                        {evt.title}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleQuickToggleEvent(evt.id, evt.status)}
                      className={`shrink-0 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                        isDone
                          ? "bg-emerald-50 text-edtech-success border border-emerald-200"
                          : "bg-blue-50 hover:bg-blue-100 text-edtech-primary border border-blue-200"
                      }`}
                    >
                      {isDone ? "Đã xong" : "Sắp tới"}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {/* Nhật ký các phiên tập trung Pomodoro & Vận động gần đây (v1.1+ Analytics) */}
      <section
        aria-labelledby="recent-sessions-heading"
        className="p-6 rounded-2xl bg-edtech-surface border border-edtech-border shadow-sm space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <TrendingUp
              className="w-5 h-5 text-edtech-primary"
              aria-hidden={true}
            />
            <h2
              id="recent-sessions-heading"
              className="text-lg font-bold text-edtech-text"
            >
              Nhật ký Phiên Rèn luyện Kỷ luật Gần đây ({state.focusSessions.length})
            </h2>
          </div>
          <span className="text-xs text-edtech-muted">
            Tự động ghi nhận từ Đồng hồ Pomodoro &amp; Phòng Kỷ luật Webcam
          </span>
        </div>

        {state.focusSessions.length === 0 ? (
          <p className="p-5 rounded-xl bg-edtech-bg border border-edtech-border text-xs text-edtech-muted text-center">
            Chưa có phiên học hoặc vận động nào được ghi nhận. Hãy hoàn thành 1
            phiên Pomodoro 25/5 hoặc 50/15 để xem lịch sử tại đây!
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {state.focusSessions
              .slice()
              .reverse()
              .slice(0, 6)
              .map((session) => {
                const isExercise = session.mode === "exercise_break";
                return (
                  <article
                    key={session.id}
                    className="p-4 rounded-xl bg-edtech-bg border border-edtech-border space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`px-2.5 py-0.5 rounded-md text-xs font-bold ${
                          isExercise
                            ? "bg-emerald-50 text-edtech-success border border-emerald-200"
                            : "bg-blue-50 text-edtech-primary border border-blue-200"
                        }`}
                      >
                        {isExercise
                          ? "Vận động giải lao"
                          : `Phiên tập trung ${
                              session.pomodoroPreset === "50_15"
                                ? "50/15"
                                : "25/5"
                            }`}
                      </span>
                      <span className="text-xs font-bold text-edtech-text">
                        {session.durationMinutes} phút
                      </span>
                    </div>
                    <p className="text-xs text-edtech-muted">
                      {isExercise
                        ? `Hoàn thành ${session.completedReps ?? 0}/${
                            session.targetReps ?? 15
                          } nhịp vận động`
                        : `Độ tập trung: ${session.focusScorePercent}% • Xao nhãng: ${session.distractionCount} lần`}
                    </p>
                  </article>
                );
              })}
          </div>
        )}
      </section>
    </div>
  );
}
