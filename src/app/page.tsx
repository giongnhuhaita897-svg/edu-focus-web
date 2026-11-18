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
} from "lucide-react";
import { createDefaultState, loadAppState } from "@/lib/storage/local-db";
import { AppDatabaseState } from "@/types/database";

export default function DashboardPage() {
  const [state, setState] = useState<AppDatabaseState>(() =>
    createDefaultState()
  );

  useEffect(() => {
    setState(loadAppState());
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
  const latestAdvice = state.aiMessages[state.aiMessages.length - 1];

  return (
    <div className="space-y-8">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-edtech-primary border border-blue-200">
            Không gian học tập cá nhân
          </span>
          <h1 className="mt-2 text-2xl md:text-3xl font-bold text-edtech-text">
            Tổng quan Kỷ luật &amp; Tiến độ Học tập
          </h1>
          <p className="mt-1 text-sm text-edtech-muted">
            Theo dõi mục tiêu, lịch trình trong ngày và kết quả rèn luyện từ
            Phòng Kỷ luật Webcam.
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5">
          <Link
            href="/webcam"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-edtech-primary hover:bg-edtech-primaryHover text-white text-sm font-semibold shadow-sm transition-colors"
          >
            <Camera className="w-4 h-4" aria-hidden={true} />
            <span>Vào Phòng Kỷ luật</span>
          </Link>
          <Link
            href="/calendar"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-edtech-surface hover:bg-slate-100 text-edtech-text text-sm font-semibold border border-edtech-border transition-colors"
          >
            <CalendarCheck2 className="w-4 h-4" aria-hidden={true} />
            <span>Mở Lịch trình</span>
          </Link>
        </div>
      </header>

      {/* Khối chỉ số nhanh */}
      <section
        aria-label="Chỉ số kỷ luật hôm nay"
        className="grid grid-cols-1 sm:grid-cols-3 gap-4"
      >
        <div className="p-5 rounded-2xl bg-edtech-surface border border-edtech-border shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-edtech-muted">
              Thời gian tập trung
            </span>
            <Clock className="w-5 h-5 text-edtech-primary" aria-hidden={true} />
          </div>
          <p className="mt-3 text-2xl font-bold text-edtech-text">
            {totalFocusMinutes} phút
          </p>
          <p className="mt-1 text-xs text-edtech-muted">
            Ghi nhận qua phiên học Webcam
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-edtech-surface border border-edtech-border shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-edtech-muted">
              Lịch trình hoàn thành
            </span>
            <CheckCircle2
              className="w-5 h-5 text-edtech-success"
              aria-hidden={true}
            />
          </div>
          <p className="mt-3 text-2xl font-bold text-edtech-text">
            {completedEventsCount} / {state.scheduleEvents.length} buổi
          </p>
          <p className="mt-1 text-xs text-edtech-success font-medium">
            Đang bám sát kế hoạch ngày
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-edtech-surface border border-edtech-border shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-edtech-muted">
              Vận động giữa giờ
            </span>
            <Activity
              className="w-5 h-5 text-edtech-success"
              aria-hidden={true}
            />
          </div>
          <p className="mt-3 text-2xl font-bold text-edtech-text">
            {totalReps} nhịp tập
          </p>
          <p className="mt-1 text-xs text-edtech-muted">
            Giơ tay qua đầu &amp; giãn cơ vai
          </p>
        </div>
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
              <h2 id="goals-heading" className="text-lg font-bold text-edtech-text">
                Mục tiêu trọng tâm
              </h2>
            </div>
            <span className="text-xs font-medium text-edtech-muted">
              {state.goals.length} mục tiêu đang chạy
            </span>
          </div>

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
                      {goal.completedHours}/{goal.targetHours} giờ • Hạn:{" "}
                      {goal.deadline}
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

                  <span
                    className={`shrink-0 px-2.5 py-1 rounded-lg text-xs font-semibold ${
                      isDone
                        ? "bg-emerald-50 text-edtech-success border border-emerald-200"
                        : "bg-blue-50 text-edtech-primary border border-blue-200"
                    }`}
                  >
                    {isDone ? "Đã xong" : "Sắp tới"}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </div>
  );
}
