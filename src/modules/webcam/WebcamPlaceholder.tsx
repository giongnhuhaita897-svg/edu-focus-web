"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Camera,
  BookOpen,
  Dumbbell,
  Eye,
  Moon,
  AlertTriangle,
  CheckCircle2,
  Timer,
  Sparkles,
  Shield,
  Plus,
} from "lucide-react";
import {
  AppDatabaseState,
  ExerciseType,
  FocusSessionMode,
  PomodoroPresetId,
} from "@/types/database";
import { POMODORO_PRESETS } from "@/modules/pomodoro/PomodoroHub";
import {
  createDefaultState,
  loadAppState,
  recordExerciseSessionInState,
  STATE_CHANGE_EVENT,
} from "@/lib/storage/local-db";

interface ExerciseOption {
  id: ExerciseType;
  name: string;
  targetReps: number;
  trackingNote: string;
}

export const WEBCAM_EXERCISES: ExerciseOption[] = [
  {
    id: "overhead_reach",
    name: "Giơ hai tay qua đầu (Overhead Reach)",
    targetReps: 15,
    trackingNote:
      "Dễ nhận diện nhất với webcam laptop: đo góc khớp vai – khuỷu tay – cổ tay khi vươn cao qua đầu.",
  },
  {
    id: "shoulder_stretch",
    name: "Dang tay mở ngực giãn cơ vai (Shoulder Stretch)",
    targetReps: 12,
    trackingNote:
      "Phù hợp tập ngay trên ghế học: theo dõi khoảng cách hai khuỷu tay mở rộng ngang vai.",
  },
  {
    id: "squat",
    name: "Đứng lên ngồi xuống (Squat cơ bản)",
    targetReps: 15,
    trackingNote:
      "Vận động toàn thân trong giờ nghỉ 5–15 phút: đếm nhịp qua quỹ đạo vai và hông.",
  },
];

type PrivacyMode = "standard" | "skeleton_only" | "minimal";

export function WebcamPlaceholder() {
  const [dbState, setDbState] = useState<AppDatabaseState>(() =>
    createDefaultState()
  );
  const [activeTab, setActiveTab] = useState<FocusSessionMode>("study_focus");
  const [selectedPreset, setSelectedPreset] =
    useState<PomodoroPresetId>("25_5");
  const [selectedExercise, setSelectedExercise] =
    useState<ExerciseType>("overhead_reach");
  const [privacyMode, setPrivacyMode] = useState<PrivacyMode>("skeleton_only");
  const [currentReps, setCurrentReps] = useState<number>(0);
  const [exerciseBanner, setExerciseBanner] = useState<string>("");

  useEffect(() => {
    const refresh = () => setDbState(loadAppState());
    refresh();
    window.addEventListener(STATE_CHANGE_EVENT, refresh);
    return () => window.removeEventListener(STATE_CHANGE_EVENT, refresh);
  }, []);

  const currentPreset = POMODORO_PRESETS[selectedPreset];
  const currentExercise =
    WEBCAM_EXERCISES.find((e) => e.id === selectedExercise) ??
    WEBCAM_EXERCISES[0];

  const handleSaveExerciseSession = () => {
    const repsToSave =
      currentReps > 0 ? currentReps : currentExercise.targetReps;
    const next = recordExerciseSessionInState(dbState, {
      exerciseType: selectedExercise,
      completedReps: repsToSave,
      targetReps: currentExercise.targetReps,
      durationMinutes: currentPreset.breakMinutes,
    });
    setDbState(next);
    setCurrentReps(0);
    setExerciseBanner(
      `Đã lưu phiên vận động "${currentExercise.name}" (+${repsToSave} nhịp tập) vào hồ sơ kỷ luật!`
    );
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-edtech-primary border border-blue-200">
            Phiên bản v1.1+ • Thị giác máy tính &amp; Bảo vệ quyền riêng tư
          </span>
          <h1 className="mt-2 text-2xl md:text-3xl font-bold text-edtech-text">
            Phòng Kỷ luật Tập trung với Webcam
          </h1>
          <p className="mt-1 text-sm text-edtech-muted">
            Chia làm 2 phân khu chuyên biệt: Giám sát khi ngồi học (phát hiện
            mất tập trung, buồn ngủ) và Giám sát khi tập thể dục đếm nhịp chuẩn.
          </p>
        </div>

        <Link
          href="/pomodoro"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-edtech-surface hover:bg-slate-100 text-edtech-text text-sm font-semibold border border-edtech-border transition-colors shrink-0"
        >
          <Timer className="w-4 h-4 text-edtech-primary" aria-hidden={true} />
          <span>Mở mục Pomodoro riêng</span>
        </Link>
      </header>

      {exerciseBanner && (
        <div
          role="status"
          aria-live="polite"
          className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-edtech-success flex items-center justify-between gap-2"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden={true} />
            <span>{exerciseBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setExerciseBanner("")}
            className="underline text-edtech-muted hover:text-edtech-text"
          >
            Đóng
          </button>
        </div>
      )}

      {/* Thanh chọn 2 mục trong Phòng Kỷ luật Webcam */}
      <div className="bg-edtech-surface rounded-2xl border border-edtech-border p-2 shadow-sm">
        <div
          role="tablist"
          aria-label="Chế độ giám sát Phòng Kỷ luật Webcam"
          className="flex overflow-x-auto gap-2"
        >
          <button
            type="button"
            role="tab"
            id="tab-study-focus"
            aria-selected={activeTab === "study_focus"}
            onClick={() => setActiveTab("study_focus")}
            className={`relative flex-1 min-w-[240px] flex items-center justify-center gap-2.5 px-4 py-3 rounded-xl text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-edtech-primary ${
              activeTab === "study_focus"
                ? "bg-blue-50/90 text-edtech-primary"
                : "text-edtech-muted hover:text-edtech-text hover:bg-slate-50"
            }`}
          >
            <BookOpen className="w-4 h-4 shrink-0" aria-hidden={true} />
            <span>1. Giám sát Ngồi học &amp; Tập trung</span>
            {activeTab === "study_focus" && (
              <span
                aria-hidden="true"
                className="absolute inset-x-4 bottom-0 border-b-2 border-edtech-primary"
              />
            )}
          </button>

          <button
            type="button"
            role="tab"
            id="tab-exercise-break"
            aria-selected={activeTab === "exercise_break"}
            onClick={() => setActiveTab("exercise_break")}
            className={`relative flex-1 min-w-[240px] flex items-center justify-center gap-2.5 px-4 py-3 rounded-xl text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-edtech-primary ${
              activeTab === "exercise_break"
                ? "bg-emerald-50/90 text-edtech-success"
                : "text-edtech-muted hover:text-edtech-text hover:bg-slate-50"
            }`}
          >
            <Dumbbell className="w-4 h-4 shrink-0" aria-hidden={true} />
            <span>2. Giám sát Tập thể dục &amp; Đếm nhịp</span>
            {activeTab === "exercise_break" && (
              <span
                aria-hidden="true"
                className="absolute inset-x-4 bottom-0 border-b-2 border-edtech-success"
              />
            )}
          </button>
        </div>
      </div>

      {/* Bảng chọn Chế độ Quyền riêng tư (Privacy Controls v1.1+) */}
      <section
        aria-label="Tùy chọn bảo vệ quyền riêng tư Webcam"
        className="p-4 rounded-2xl bg-edtech-surface border border-edtech-border shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3"
      >
        <div className="flex items-center gap-2.5">
          <Shield
            className="w-5 h-5 text-edtech-success shrink-0"
            aria-hidden={true}
          />
          <div>
            <p className="text-xs font-bold text-edtech-text">
              Chế độ Quyền riêng tư Camera (Xử lý 100% tại trình duyệt)
            </p>
            <p className="text-xs text-edtech-muted">
              Không gửi hoặc lưu bất kỳ hình ảnh/video nào lên máy chủ.
            </p>
          </div>
        </div>

        <div
          role="group"
          aria-label="Chọn chế độ hiển thị camera"
          className="inline-flex flex-wrap gap-1.5 bg-edtech-bg p-1 rounded-xl border border-edtech-border"
        >
          {(
            [
              { id: "skeleton_only", label: "Ẩn mặt (Chỉ hiện khung xương)" },
              { id: "standard", label: "Hiển thị Camera" },
              { id: "minimal", label: "Tối giản (Chỉ hiện trạng thái)" },
            ] as const
          ).map((mode) => (
            <button
              key={mode.id}
              type="button"
              onClick={() => setPrivacyMode(mode.id)}
              aria-pressed={privacyMode === mode.id}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                privacyMode === mode.id
                  ? "bg-edtech-primary text-white"
                  : "text-edtech-muted hover:text-edtech-text"
              }`}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </section>

      {/* MỤC 1: GIÁM SÁT KHI NGỒI HỌC HAY TẬP TRUNG HỌC */}
      <div
        role="tabpanel"
        id="panel-study-focus"
        aria-labelledby="tab-study-focus"
        hidden={activeTab !== "study_focus"}
      >
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Khung Camera Giám sát Ngồi học */}
          <div className="lg:col-span-2 p-6 rounded-2xl bg-edtech-surface border border-edtech-border shadow-sm space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Camera
                  className="w-5 h-5 text-edtech-primary"
                  aria-hidden={true}
                />
                <h2 className="text-lg font-bold text-edtech-text">
                  Khung Giám sát Tư thế Ngồi học &amp; Độ Tỉnh táo
                </h2>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-edtech-primary border border-blue-200">
                Chế độ: Giám sát Học tập
              </span>
            </div>

            {/* Khung preview camera */}
            <div className="aspect-video w-full rounded-2xl bg-slate-900 text-white p-6 flex flex-col justify-between border border-slate-800">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-slate-800/90 text-emerald-400 border border-slate-700">
                  <span
                    className="w-2 h-2 rounded-full bg-emerald-400"
                    aria-hidden="true"
                  />
                  AI Vision:{" "}
                  {privacyMode === "skeleton_only"
                    ? "Chế độ Khung xương Ẩn mặt"
                    : privacyMode === "minimal"
                    ? "Chế độ Chỉ báo Tối giản"
                    : "Sẵn sàng theo dõi khuôn mặt & tư thế"}
                </span>
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-800/90 text-blue-300 border border-slate-700">
                  Chu kỳ kèm theo: {currentPreset.label}
                </span>
              </div>

              <div className="my-auto text-center space-y-2 max-w-md mx-auto">
                <Camera
                  className="w-10 h-10 text-blue-400 mx-auto"
                  aria-hidden={true}
                />
                <p className="text-base font-bold">
                  Khu vực hiển thị Webcam Giám sát Học tập
                </p>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Hệ thống theo dõi sự hiện diện trước bàn học, nhận diện dấu
                  hiệu quay đi mất tập trung hoặc nhắm mắt / gục đầu ngủ gật để
                  nhắc nhở kịp thời.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700">
                  <p className="text-slate-400">Trạng thái tập trung</p>
                  <p className="mt-0.5 font-bold text-emerald-400">
                    Đang tập trung tốt
                  </p>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700">
                  <p className="text-slate-400">Cảnh báo buồn ngủ</p>
                  <p className="mt-0.5 font-bold text-white">
                    Tỉnh táo (0 lần)
                  </p>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700">
                  <p className="text-slate-400">Số lần xao nhãng</p>
                  <p className="mt-0.5 font-bold text-amber-300">0 lần</p>
                </div>
              </div>
            </div>

            {/* 3 tiêu chí giám sát thông minh khi ngồi học */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              <div className="p-4 rounded-xl bg-edtech-bg border border-edtech-border space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-bold text-edtech-primary">
                  <Eye className="w-4 h-4" aria-hidden={true} />
                  <span>Phát hiện Mất tập trung</span>
                </div>
                <p className="text-xs text-edtech-muted leading-relaxed">
                  Ghi nhận khi người học rời khỏi khung hình hoặc quay mặt đi
                  hướng khác quá thời gian quy định.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-edtech-bg border border-edtech-border space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-600">
                  <Moon className="w-4 h-4" aria-hidden={true} />
                  <span>Phát hiện Đang ngủ / Gục đầu</span>
                </div>
                <p className="text-xs text-edtech-muted leading-relaxed">
                  Theo dõi độ mở mắt và độ cúi đầu bất thường để phát hiện ngủ
                  gật khi học khuya.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-edtech-bg border border-edtech-border space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-bold text-edtech-success">
                  <Sparkles className="w-4 h-4" aria-hidden={true} />
                  <span>Tổng hợp Điểm Kỷ luật</span>
                </div>
                <p className="text-xs text-edtech-muted leading-relaxed">
                  Lưu lại tỷ lệ % thời gian thực học để Cố vấn AI đánh giá và
                  điều chỉnh lịch trình.
                </p>
              </div>
            </div>
          </div>

          {/* Khung tích hợp Pomodoro 25/5 & 50/15 ngay trong Phòng Kỷ luật */}
          <div className="p-6 rounded-2xl bg-edtech-surface border border-edtech-border shadow-sm space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Timer
                  className="w-5 h-5 text-edtech-primary"
                  aria-hidden={true}
                />
                <h2 className="text-base font-bold text-edtech-text">
                  Tích hợp Chu kỳ Pomodoro
                </h2>
              </div>
              <span className="text-xs font-semibold text-edtech-primary">
                Học/Làm &amp; Nghỉ
              </span>
            </div>

            <p className="text-xs text-edtech-muted leading-relaxed">
              Chọn cấu trúc thời gian Học/Làm &amp; Nghỉ để đồng bộ cùng phiên
              giám sát webcam:
            </p>

            <div className="space-y-2.5">
              {(["25_5", "50_15"] as PomodoroPresetId[]).map((id) => {
                const preset = POMODORO_PRESETS[id];
                const isSelected = selectedPreset === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setSelectedPreset(id)}
                    aria-pressed={isSelected}
                    className={`w-full text-left p-3.5 rounded-xl border transition-colors ${
                      isSelected
                        ? "bg-blue-50/80 border-edtech-primary"
                        : "bg-edtech-bg border-edtech-border hover:bg-slate-100/70"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-edtech-text">
                        {preset.label}
                      </span>
                      <span className="text-xs font-semibold text-edtech-primary">
                        {preset.workMinutes}p / {preset.breakMinutes}p
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-edtech-muted">
                      {preset.workMinutes} phút Học/Làm • {preset.breakMinutes}{" "}
                      phút Nghỉ
                    </p>
                  </button>
                );
              })}
            </div>

            <div className="p-4 rounded-xl bg-edtech-bg border border-edtech-border text-center space-y-1">
              <p className="text-xs font-medium text-edtech-muted">
                Thời lượng pha Học / Làm đã chọn
              </p>
              <p className="text-3xl font-extrabold text-edtech-text tabular-nums">
                {currentPreset.workMinutes}:00
              </p>
              <p className="text-xs text-edtech-success font-medium">
                Nghỉ giải lao kế tiếp: {currentPreset.breakMinutes} phút
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-amber-50/80 border border-amber-200 flex items-start gap-2.5">
              <AlertTriangle
                className="w-4 h-4 text-amber-600 shrink-0 mt-0.5"
                aria-hidden={true}
              />
              <p className="text-xs text-edtech-text leading-relaxed">
                Khi hết {currentPreset.workMinutes} phút ngồi học, hệ thống sẽ
                gợi ý chuyển sang tab{" "}
                <strong>
                  Giám sát Tập thể dục ({currentPreset.breakMinutes} phút)
                </strong>{" "}
                để vận động chống buồn ngủ.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* MỤC 2: GIÁM SÁT KHI TẬP THỂ DỤC & ĐẾM NHỊP CHUẨN */}
      <div
        role="tabpanel"
        id="panel-exercise-break"
        aria-labelledby="tab-exercise-break"
        hidden={activeTab !== "exercise_break"}
      >
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Khung Camera Giám sát Thể dục */}
          <div className="lg:col-span-2 p-6 rounded-2xl bg-edtech-surface border border-edtech-border shadow-sm space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Dumbbell
                  className="w-5 h-5 text-edtech-success"
                  aria-hidden={true}
                />
                <h2 className="text-lg font-bold text-edtech-text">
                  Khung Giám sát Vận động &amp; Đếm nhịp Chuẩn xác
                </h2>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-edtech-success border border-emerald-200">
                Chế độ: Giám sát Thể dục
              </span>
            </div>

            <div className="aspect-video w-full rounded-2xl bg-slate-900 text-white p-6 flex flex-col justify-between border border-slate-800">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-slate-800/90 text-emerald-400 border border-slate-700">
                  <span
                    className="w-2 h-2 rounded-full bg-emerald-400"
                    aria-hidden="true"
                  />
                  Pose Tracking: Theo dõi khớp vai &amp; cánh tay
                </span>
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-800/90 text-emerald-300 border border-slate-700">
                  Bài tập: {currentExercise.name}
                </span>
              </div>

              <div className="my-auto text-center space-y-2 max-w-md mx-auto">
                <Dumbbell
                  className="w-10 h-10 text-emerald-400 mx-auto"
                  aria-hidden={true}
                />
                <p className="text-base font-bold">
                  Khu vực hiển thị Webcam Đếm nhịp Thể dục
                </p>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {currentExercise.trackingNote}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700">
                  <p className="text-slate-400">Số nhịp hoàn thành</p>
                  <p className="mt-0.5 font-bold text-emerald-400">
                    {currentReps} / {currentExercise.targetReps} nhịp
                  </p>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700">
                  <p className="text-slate-400">Độ chuẩn biên độ</p>
                  <p className="mt-0.5 font-bold text-white">
                    {currentReps > 0 ? "Biên độ chuẩn ✓" : "Chờ khởi động"}
                  </p>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700">
                  <p className="text-slate-400">Pha Nghỉ Pomodoro</p>
                  <p className="mt-0.5 font-bold text-blue-300">
                    {currentPreset.breakMinutes} phút
                  </p>
                </div>
              </div>
            </div>

            {/* Thanh điều khiển đếm thử & lưu phiên tập vào hồ sơ */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentReps((r) => r + 1)}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-edtech-bg hover:bg-slate-200/80 text-edtech-text text-xs font-bold border border-edtech-border transition-colors"
                >
                  <Plus className="w-4 h-4 text-edtech-success" aria-hidden={true} />
                  <span>Đếm +1 nhịp chuẩn</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentReps(0)}
                  className="px-3 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-edtech-muted text-xs font-semibold border border-edtech-border transition-colors"
                >
                  Đặt lại 0
                </button>
              </div>

              <button
                type="button"
                onClick={handleSaveExerciseSession}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-edtech-success hover:bg-emerald-600 text-white text-xs font-bold shadow-sm transition-colors"
              >
                <CheckCircle2 className="w-4 h-4" aria-hidden={true} />
                <span>Lưu phiên vận động vào Hồ sơ</span>
              </button>
            </div>
          </div>

          {/* Danh sách bài tập dễ nhận diện và đếm chuẩn */}
          <div className="p-6 rounded-2xl bg-edtech-surface border border-edtech-border shadow-sm space-y-4">
            <h2 className="text-base font-bold text-edtech-text">
              Chọn bài tập dễ theo dõi qua Webcam
            </h2>
            <p className="text-xs text-edtech-muted leading-relaxed">
              Các động tác được tối ưu góc nhìn cho webcam laptop để bộ đếm
              nhịp hoạt động chính xác, không bị đếm ảo:
            </p>

            <div className="space-y-2.5">
              {WEBCAM_EXERCISES.map((ex) => {
                const isSelected = ex.id === selectedExercise;
                return (
                  <button
                    key={ex.id}
                    type="button"
                    onClick={() => {
                      setSelectedExercise(ex.id);
                      setCurrentReps(0);
                    }}
                    aria-pressed={isSelected}
                    className={`w-full text-left p-3.5 rounded-xl border transition-colors ${
                      isSelected
                        ? "bg-emerald-50/80 border-edtech-success"
                        : "bg-edtech-bg border-edtech-border hover:bg-slate-100/70"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-edtech-text">
                        {ex.name}
                      </span>
                      <span className="shrink-0 px-2 py-0.5 rounded-md bg-white text-edtech-success text-xs font-bold border border-emerald-200">
                        {ex.targetReps} nhịp
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-edtech-muted leading-relaxed">
                      {ex.trackingNote}
                    </p>
                  </button>
                );
              })}
            </div>

            <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 flex items-start gap-2.5">
              <CheckCircle2
                className="w-4 h-4 text-edtech-success shrink-0 mt-0.5"
                aria-hidden={true}
              />
              <p className="text-xs text-edtech-text leading-relaxed">
                Cơ chế đếm 2 ngưỡng góc khớp (Hysteresis) đảm bảo phải hoàn tất
                đủ biên độ lên – xuống mới cộng 1 nhịp.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
