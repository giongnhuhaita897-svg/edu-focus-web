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
} from "lucide-react";
import {
  PomodoroPhase,
  PomodoroPreset,
  PomodoroPresetId,
} from "@/types/database";

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
  const [presetId, setPresetId] = useState<PomodoroPresetId>("25_5");
  const [phase, setPhase] = useState<PomodoroPhase>("work");
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [completedCycles, setCompletedCycles] = useState<number>(2);

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

  useEffect(() => {
    if (!isRunning) return;
    const interval = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          setIsRunning(false);
          if (phase === "work") {
            setCompletedCycles((c) => c + 1);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [isRunning, phase]);

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
            Phân chia rõ cấu trúc Học hoặc Làm việc đan xen Nghỉ giải lao khoa
            học, đồng bộ trực tiếp với Phòng Kỷ luật Webcam.
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
                ? "Đang trong pha Học / Làm việc tập trung"
                : "Đang trong pha Nghỉ ngơi & Vận động giãn cơ"}
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
              Liên kết Phòng Kỷ luật Webcam
            </h2>
            <p className="mt-1 text-xs text-edtech-muted leading-relaxed">
              Mỗi chu kỳ Pomodoro 25/5 hoặc 50/15 được thiết kế để tự động phối
              hợp với 2 mục giám sát trong Phòng Kỷ luật Webcam:
            </p>
          </div>

          <div className="space-y-3">
            <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200">
              <p className="text-xs font-bold text-edtech-primary">
                1. Khi ở Pha Học / Làm ({currentPreset.workMinutes} phút)
              </p>
              <p className="mt-1 text-xs text-edtech-text leading-relaxed">
                Kích hoạt mục <strong>Giám sát Ngồi học &amp; Tập trung</strong>{" "}
                để theo dõi tư thế ngồi, cảnh báo khi mất tập trung hoặc có dấu
                hiệu buồn ngủ / gục đầu.
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
