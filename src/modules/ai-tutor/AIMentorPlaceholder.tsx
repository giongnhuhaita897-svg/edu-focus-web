"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import {
  Sparkles,
  Target,
  CalendarPlus,
  CheckCircle2,
  Send,
  Clock,
  BookOpen,
  Timer,
  CalendarCheck2,
  AlertTriangle,
  Activity,
  PlusCircle,
} from "lucide-react";
import {
  addGoalToState,
  appendAIMessageToState,
  applySuggestedActionToState,
  createDefaultState,
  formatHoursAndMinutes,
  loadAppState,
  saveAppState,
  STATE_CHANGE_EVENT,
} from "@/lib/storage/local-db";
import {
  analyzeStudentProgress,
  formatFriendlyDateLabel,
  generateMentorResponse,
  generateSmartScheduleSuggestions,
} from "@/modules/ai-tutor/ai-engine";
import {
  AIMessage,
  AppDatabaseState,
  SuggestedGoalAction,
  SuggestedScheduleAction,
} from "@/types/database";

const SAVED_CHATS_KEY = "edufocus-saved-mentor-chats";
const MAX_SAVED_CHATS = 20;

type SavedChat = {
  id: string;
  title: string;
  savedAt: string;
  messages: AIMessage[];
};

const QUICK_PROMPTS = [
  "Đánh giá tiến độ & định mức học mỗi ngày của tớ",
  "Đề xuất khung giờ học & vận động còn trống hôm nay",
  "Lập kế hoạch học 3 ngày tới cho mục tiêu gấp nhất",
  "Tư vấn chọn Pomodoro 25/5 hay 50/15 để không bị buồn ngủ",
];

export function AIMentorPlaceholder() {
  const [state, setState] = useState<AppDatabaseState>(() =>
    createDefaultState()
  );
  const [promptInput, setPromptInput] = useState<string>("");
  const [appliedKeys, setAppliedKeys] = useState<Record<string, boolean>>({});
  const [appliedGoalKeys, setAppliedGoalKeys] = useState<
    Record<string, boolean>
  >({});
  const [statusNotice, setStatusNotice] = useState<string>("");
  const [isSending, setIsSending] = useState<boolean>(false);
  const formRef = useRef<HTMLFormElement | null>(null);
  const chatListRef = useRef<HTMLDivElement | null>(null);
  const [savedChats, setSavedChats] = useState<SavedChat[]>([]);
  const [showHistory, setShowHistory] = useState<boolean>(false);
  const chatMessages: AIMessage[] = state.aiMessages;

  useEffect(() => {
    const refresh = () => setState(loadAppState());
    refresh();
    window.addEventListener(STATE_CHANGE_EVENT, refresh);
    return () => window.removeEventListener(STATE_CHANGE_EVENT, refresh);
  }, []);

  useEffect(() => {
    const el = chatListRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chatMessages.length, isSending]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(SAVED_CHATS_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) setSavedChats(parsed as SavedChat[]);
    } catch {
      // Không đọc được lịch sử thì bỏ qua, web vẫn chạy bình thường
    }
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

  const analysis = analyzeStudentProgress(state);
  const smartSuggestions = generateSmartScheduleSuggestions(state);
  const { habits } = analysis;

  const getActionKey = (action: SuggestedScheduleAction) =>
    `${action.date}-${action.startTime}-${action.title}`;

  const getGoalKey = (goal: SuggestedGoalAction) =>
    `${goal.title.toLowerCase()}-${goal.deadline}`;

  const isActionAlreadyInSchedule = (
    action: SuggestedScheduleAction,
    targetState: AppDatabaseState = state
  ) => {
    const key = getActionKey(action);
    if (appliedKeys[key]) return true;
    return targetState.scheduleEvents.some(
      (evt) =>
        evt.date === action.date &&
        evt.startTime === action.startTime &&
        evt.title === action.title
    );
  };

  const isGoalAlreadyInState = (
    goalAction: SuggestedGoalAction,
    targetState: AppDatabaseState = state
  ) => {
    const key = getGoalKey(goalAction);
    if (appliedGoalKeys[key]) return true;
    return targetState.goals.some(
      (g) =>
        g.title.toLowerCase() === goalAction.title.toLowerCase() &&
        g.deadline === goalAction.deadline
    );
  };

  const handleApplySuggestion = (action: SuggestedScheduleAction) => {
    const latestState = loadAppState();
    if (isActionAlreadyInSchedule(action, latestState)) return;
    const next = applySuggestedActionToState(latestState, action);
    syncWithServer(next);
    const key = getActionKey(action);
    setAppliedKeys((prev) => ({ ...prev, [key]: true }));
    setStatusNotice(
      `Đã thêm "${action.title}" (${action.date} • ${action.startTime} - ${action.endTime}) vào Lịch trình!`
    );
  };

  const handleApplyAllSuggestions = (actions: SuggestedScheduleAction[]) => {
    let current = loadAppState();
    const newlyAppliedKeys: Record<string, boolean> = {};
    let addedCount = 0;

    for (const act of actions) {
      if (!isActionAlreadyInSchedule(act, current)) {
        current = applySuggestedActionToState(current, act);
        newlyAppliedKeys[getActionKey(act)] = true;
        addedCount++;
      }
    }

    if (addedCount > 0) {
      syncWithServer(current);
      setAppliedKeys((prev) => ({ ...prev, ...newlyAppliedKeys }));
      setStatusNotice(
        `Đã thêm toàn bộ ${addedCount} buổi học vào Lịch trình thành công!`
      );
    }
  };

  const handleApplySuggestedGoal = (goalAction: SuggestedGoalAction) => {
    const latestState = loadAppState();
    if (isGoalAlreadyInState(goalAction, latestState)) return;
    const next = addGoalToState(latestState, {
      title: goalAction.title,
      description: goalAction.description,
      category: goalAction.category,
      targetHours: goalAction.targetHours,
      completedHours: 0,
      deadline: goalAction.deadline,
    });
    syncWithServer(next);
    const key = getGoalKey(goalAction);
    setAppliedGoalKeys((prev) => ({ ...prev, [key]: true }));
    setStatusNotice(
      `Đã tạo mục tiêu mới "${goalAction.title}" (${goalAction.targetHours} giờ • Hạn ${goalAction.deadline})!`
    );
  };

  const persistSavedChats = (next: SavedChat[]) => {
    setSavedChats(next);
    try {
      window.localStorage.setItem(SAVED_CHATS_KEY, JSON.stringify(next));
    } catch {
      setStatusNotice("Không lưu được vào trình duyệt. Hãy thử lại.");
    }
  };

  const handleSaveChat = () => {
    if (chatMessages.length === 0) return;
    const firstUser = chatMessages.find((m) => m.role === "user");
    const rawTitle = (firstUser?.content ?? "Cuộc trò chuyện").trim();
    const defaultTitle =
      rawTitle.length > 50 ? `${rawTitle.slice(0, 50)}…` : rawTitle;
    const input =
      typeof window !== "undefined" && typeof window.prompt === "function"
        ? window.prompt("Đặt tên cho cuộc trò chuyện:", defaultTitle)
        : defaultTitle;
    if (input === null) return;
    const title = input.trim().slice(0, 60) || defaultTitle;
    const entry: SavedChat = {
      id: `chat-${Date.now()}`,
      title,
      savedAt: new Date().toISOString(),
      messages: [...chatMessages],
    };
    persistSavedChats([entry, ...savedChats].slice(0, MAX_SAVED_CHATS));
    setStatusNotice("Đã lưu cuộc trò chuyện vào lịch sử.");
  };

  const handleOpenSavedChat = (chat: SavedChat) => {
    const latestState = loadAppState();
    const nextState = saveAppState({
      ...latestState,
      aiMessages: [...chat.messages],
    });
    syncWithServer(nextState);
    setShowHistory(false);
    setStatusNotice(`Đã mở lại: "${chat.title}"`);
  };

  const handleStartNewChat = () => {
    const latestState = loadAppState();
    const welcomeMsg: AIMessage = {
      id: `msg-welcome-${Date.now()}`,
      role: "assistant",
      content:
        "Thầy/Cô đã mở phiên trò chuyện mới! Cậu có thể nhờ mình **lập kế hoạch theo giờ/buổi** (VD: *tối nay*, *sáng mai*, *3 ngày tới*), **tạo mục tiêu mới**, hoặc **tư vấn phương pháp học & chống buồn ngủ** nhé.",
      createdAt: new Date().toISOString(),
    };
    const nextState = saveAppState({
      ...latestState,
      aiMessages: [welcomeMsg],
    });
    syncWithServer(nextState);
    setShowHistory(false);
    setStatusNotice("Đã bắt đầu cuộc trò chuyện mới.");
  };

  const handleDeleteSavedChat = (id: string) => {
    persistSavedChats(savedChats.filter((c) => c.id !== id));
  };

  const handleSendPrompt = async (rawText: string) => {
    const trimmed = rawText.trim();
    if (!trimmed || isSending) return;

    const latestBeforeSend = loadAppState();
    const historyTurns = latestBeforeSend.aiMessages.slice(-10).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const userMsg: AIMessage = {
      id: `msg-user-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      role: "user",
      content: trimmed,
      createdAt: new Date().toISOString(),
    };

    const withUser = appendAIMessageToState(latestBeforeSend, userMsg);
    syncWithServer(withUser);
    setPromptInput("");
    setIsSending(true);

    let aiReply: AIMessage;
    try {
      const res = await fetch("/api/ai-mentor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: trimmed,
          state: withUser,
          history: historyTurns,
        }),
      });
      if (!res.ok) throw new Error("AI mentor request failed");
      const data = (await res.json()) as {
        message?: AIMessage;
        source?: "gemini" | "fallback";
      };
      if (!data.message) throw new Error("Empty AI mentor response");
      aiReply = {
        ...data.message,
        source: data.message.source ?? data.source ?? "gemini",
      };
    } catch {
      // Mất mạng hoặc lỗi server: đọc state mới nhất và truyền kèm history để nhớ ngữ cảnh câu trước
      const latestForFallback = loadAppState();
      aiReply = generateMentorResponse(
        latestForFallback,
        trimmed,
        undefined,
        historyTurns
      );
    }

    // Luôn lấy state mới nhất từ localStorage trước khi nối câu trả lời của AI (tránh Race Condition)
    const latestAfterReply = loadAppState();
    const withReply = appendAIMessageToState(latestAfterReply, aiReply);
    syncWithServer(withReply);
    setIsSending(false);
  };

  const handleSubmitForm = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    handleSendPrompt(promptInput);
  };

  const handleTextareaKeyDown = (
    e: React.KeyboardEvent<HTMLTextAreaElement>
  ) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      // Đảm bảo an toàn với bộ gõ tiếng Việt (IME composition)
      if (e.nativeEvent.isComposing || e.keyCode === 229) {
        return;
      }
      if (formRef.current) {
        formRef.current.requestSubmit();
      } else {
        handleSendPrompt(promptInput);
      }
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-edtech-primary border border-blue-200">
            Giai đoạn 3 • Cố vấn Học tập, Chẩn đoán Kỷ luật &amp; Lập Kế hoạch
          </span>
          <h1 className="mt-2 text-2xl md:text-3xl font-bold text-edtech-text">
            Cố vấn Học tập AI Mentor
          </h1>
          <p className="mt-1 text-sm text-edtech-muted">
            Chẩn đoán dữ liệu tập trung từ Webcam &amp; Pomodoro, nhớ ngữ cảnh
            thảo luận nhiều lượt và khởi tạo mục tiêu / lịch trình nhiều ngày
            ngay trong khung chat.
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5 shrink-0">
          <Link
            href="/calendar"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-edtech-surface hover:bg-slate-100 text-edtech-text text-sm font-semibold border border-edtech-border transition-colors"
          >
            <CalendarCheck2
              className="w-4 h-4 text-edtech-primary"
              aria-hidden={true}
            />
            <span>Xem Lịch trình ({state.scheduleEvents.length})</span>
          </Link>
          <Link
            href="/pomodoro"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-edtech-primary hover:bg-edtech-primaryHover text-white text-sm font-semibold shadow-sm transition-colors"
          >
            <Timer className="w-4 h-4" aria-hidden={true} />
            <span>Bắt đầu Pomodoro</span>
          </Link>
        </div>
      </header>

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
            className="text-xs underline text-edtech-muted hover:text-edtech-text"
          >
            Đóng
          </button>
        </div>
      )}

      {/* PHẦN 1: BẢNG ĐÁNH GIÁ TIẾN ĐỘ, CHẨN ĐOÁN KỶ LUẬT & ĐỊNH MỨC HỌC MỖI NGÀY */}
      <section
        aria-labelledby="ai-diagnostic-heading"
        className="p-6 rounded-2xl bg-edtech-surface border border-edtech-border shadow-sm space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Target
              className="w-5 h-5 text-edtech-primary"
              aria-hidden={true}
            />
            <h2
              id="ai-diagnostic-heading"
              className="text-lg font-bold text-edtech-text"
            >
              Phân tích Mục tiêu &amp; Định mức Pomodoro Mỗi Ngày
            </h2>
          </div>
          <span className="text-xs font-semibold text-edtech-muted">
            Điểm tập trung trung bình: {analysis.averageFocusScore}% • Đã học{" "}
            {analysis.totalFocusMinutes} phút hôm nay
          </span>
        </div>

        {/* Thanh Chẩn đoán Hành vi & Kỷ luật Thực tế từ Webcam & Pomodoro */}
        <div
          data-testid="ai-discipline-habit-bar"
          className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-slate-50 border border-edtech-border text-xs"
        >
          <div className="flex items-start gap-2.5">
            <AlertTriangle
              className={`w-4 h-4 shrink-0 mt-0.5 ${
                habits.overdueGoalsCount > 0 || habits.urgentGoalsCount > 0
                  ? "text-amber-600"
                  : "text-edtech-primary"
              }`}
              aria-hidden={true}
            />
            <div>
              <p className="font-bold text-edtech-text">Cảnh báo Hạn chót</p>
              <p className="text-edtech-muted">
                {habits.overdueGoalsCount > 0
                  ? `${habits.overdueGoalsCount} mục tiêu quá hạn cần giải cứu`
                  : habits.urgentGoalsCount > 0
                  ? `${habits.urgentGoalsCount} mục tiêu gấp (≤ 7 ngày)`
                  : "Tất cả mục tiêu trong ngưỡng an toàn"}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <Sparkles
              className={`w-4 h-4 shrink-0 mt-0.5 ${
                habits.hasDrowsinessRisk
                  ? "text-edtech-danger"
                  : "text-edtech-success"
              }`}
              aria-hidden={true}
            />
            <div>
              <p className="font-bold text-edtech-text">
                Kỷ luật Webcam &amp; Tỉnh táo
              </p>
              <p className="text-edtech-muted">
                {habits.penalizedSessionsCount > 0 ||
                habits.totalDrowsinessAlerts > 0
                  ? `${habits.penalizedSessionsCount} phiên bị phạt • ${habits.totalDrowsinessAlerts} cảnh báo buồn ngủ`
                  : `${analysis.totalDistractions} lần xao nhãng • Chưa có phiên bị phạt`}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <Activity
              className="w-4 h-4 shrink-0 mt-0.5 text-edtech-success"
              aria-hidden={true}
            />
            <div>
              <p className="font-bold text-edtech-text">
                Cân bằng Học &amp; Vận động
              </p>
              <p className="text-edtech-muted">
                {habits.studySessionsCount} ca học •{" "}
                {habits.exerciseSessionsCount} ca vận động (
                {habits.totalExerciseReps} nhịp)
              </p>
            </div>
          </div>
        </div>

        {analysis.diagnostics.length === 0 ? (
          <div className="p-6 rounded-xl bg-edtech-bg border border-dashed border-slate-300 text-center space-y-2">
            <p className="text-sm font-bold text-edtech-text">
              Chưa có mục tiêu nào để AI phân tích định mức
            </p>
            <p className="text-xs text-edtech-muted">
              Hãy tạo ít nhất 1 mục tiêu tại mục Lịch trình &amp; Mục tiêu (hoặc
              nhắn trực tiếp vào khung chat bên dưới: &quot;Tạo mục tiêu ôn Giải
              tích 20 giờ&quot;) để AI tính số phiên Pomodoro mỗi ngày.
            </p>
            <Link
              href="/calendar"
              className="inline-block px-3.5 py-2 rounded-xl bg-edtech-primary text-white text-xs font-bold"
            >
              + Thiết lập mục tiêu đầu tiên
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {analysis.diagnostics.map((diag) => (
              <div
                key={diag.goal.id}
                data-testid={`ai-goal-diag-${diag.goal.id}`}
                className="p-4 rounded-xl bg-edtech-bg border border-edtech-border flex flex-col justify-between space-y-3"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`px-2 py-0.5 rounded-md text-xs font-bold border ${
                        diag.isOverdue
                          ? "bg-red-50 text-edtech-danger border-red-200"
                          : diag.isUrgent
                          ? "bg-amber-50 text-amber-700 border-amber-200"
                          : "bg-blue-50 text-edtech-primary border-blue-200"
                      }`}
                    >
                      {diag.daysLabel}
                    </span>
                    <span className="text-xs font-bold text-edtech-success">
                      {diag.goal.progressPercent}%
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-edtech-text">
                    {diag.goal.title}
                  </h3>
                  <p className="text-xs text-edtech-muted">
                    Đã tích lũy: {formatHoursAndMinutes(diag.goal.completedHours)}{" "}
                    / {diag.goal.targetHours} giờ (Còn thiếu{" "}
                    {formatHoursAndMinutes(diag.remainingHours)})
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-white border border-edtech-border space-y-1">
                  <p className="text-xs font-bold text-edtech-primary">
                    Đề xuất định mức mỗi ngày:
                  </p>
                  {diag.remainingMinutes > 0 ? (
                    <p className="text-xs text-edtech-text leading-relaxed">
                      Cần học{" "}
                      <strong>{diag.recommendedMinutesPerDay} phút/ngày</strong>{" "}
                      (tương đương{" "}
                      <strong>{diag.recommendedPomodoro25Count} phiên 25/5</strong>{" "}
                      hoặc{" "}
                      <strong>{diag.recommendedPomodoro50Count} phiên 50/15</strong>
                      ).
                    </p>
                  ) : (
                    <p className="text-xs text-edtech-success font-semibold">
                      Đã hoàn thành 100% mục tiêu!
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* PHẦN 2: ĐỀ XUẤT KHUNG GIỜ TRỐNG TỰ ĐỘNG & TRÒ CHUYỆN CỐ VẤN AI */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Cột Đề xuất Khung giờ Học & Vận động 1-Click */}
        <section
          aria-labelledby="smart-suggestions-heading"
          className="lg:col-span-5 p-6 rounded-2xl bg-edtech-surface border border-edtech-border shadow-sm space-y-4"
        >
          <div className="flex items-center gap-2">
            <CalendarPlus
              className="w-5 h-5 text-edtech-primary"
              aria-hidden={true}
            />
            <h2
              id="smart-suggestions-heading"
              className="text-lg font-bold text-edtech-text"
            >
              Đề xuất Khung giờ Trống Hôm nay
            </h2>
          </div>
          <p className="text-xs text-edtech-muted leading-relaxed">
            AI Mentor tự động quét lịch trình hiện tại của cậu để chọn các khung
            giờ còn trống và ghép với mục tiêu cần ưu tiên nhất:
          </p>

          {smartSuggestions.length === 0 ? (
            <p className="p-4 rounded-xl bg-edtech-bg border border-edtech-border text-xs text-edtech-muted">
              Lịch hôm nay của cậu đã kín các khung giờ chuẩn. Hãy hoàn thành
              các buổi hiện có nhé!
            </p>
          ) : (
            <ul className="space-y-3">
              {smartSuggestions.map((action) => {
                const key = getActionKey(action);
                const alreadyAdded = isActionAlreadyInSchedule(action);

                return (
                  <li
                    key={key}
                    className="p-4 rounded-xl bg-edtech-bg border border-edtech-border space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-edtech-primary">
                        <Clock className="w-3.5 h-3.5" aria-hidden={true} />
                        <span>
                          {action.startTime} - {action.endTime}
                        </span>
                      </span>
                      <span className="px-2 py-0.5 rounded-md text-xs font-semibold bg-slate-200/80 text-edtech-text">
                        {action.type === "study"
                          ? "Học tập"
                          : action.type === "exercise"
                          ? "Vận động"
                          : "Ôn tập"}
                      </span>
                    </div>

                    <p className="text-sm font-bold text-edtech-text">
                      {action.title}
                    </p>

                    <button
                      type="button"
                      disabled={alreadyAdded}
                      onClick={() => handleApplySuggestion(action)}
                      className={`w-full inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-colors ${
                        alreadyAdded
                          ? "bg-emerald-50 text-edtech-success border border-emerald-200 cursor-default"
                          : "bg-edtech-primary hover:bg-edtech-primaryHover text-white shadow-sm"
                      }`}
                    >
                      {alreadyAdded ? (
                        <>
                          <CheckCircle2
                            className="w-4 h-4"
                            aria-hidden={true}
                          />
                          <span>Đã thêm vào lịch ✓</span>
                        </>
                      ) : (
                        <>
                          <CalendarPlus
                            className="w-4 h-4"
                            aria-hidden={true}
                          />
                          <span>Áp dụng vào lịch trình</span>
                        </>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Cột Trò chuyện với Cố vấn Học tập AI Mentor */}
        <section
          aria-labelledby="ai-chat-heading"
          className="lg:col-span-7 p-6 rounded-2xl bg-edtech-surface border border-edtech-border shadow-sm flex flex-col justify-between space-y-4"
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles
                  className="w-5 h-5 text-edtech-primary"
                  aria-hidden={true}
                />
                <h2
                  id="ai-chat-heading"
                  className="text-lg font-bold text-edtech-text"
                >
                  Trò chuyện &amp; Lập Kế hoạch với Cố vấn AI
                </h2>
              </div>
              <span className="text-xs text-edtech-muted">
                Nhớ ngữ cảnh • Hỗ trợ tạo lịch &amp; mục tiêu
              </span>
            </div>

            {/* Các nút câu hỏi nhanh */}
            <div className="flex flex-wrap gap-2">
              {QUICK_PROMPTS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => handleSendPrompt(q)}
                  disabled={isSending}
                  className="px-3 py-1.5 rounded-xl bg-blue-50/80 hover:bg-blue-100 text-edtech-primary text-xs font-semibold border border-blue-200 transition-colors text-left"
                >
                  {q}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleStartNewChat}
                disabled={isSending}
                className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-edtech-primary text-xs font-semibold border border-blue-200 transition-colors disabled:opacity-50"
              >
                Cuộc trò chuyện mới
              </button>
              <button
                type="button"
                onClick={handleSaveChat}
                disabled={chatMessages.length === 0}
                className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-edtech-text text-xs font-semibold border border-edtech-border transition-colors disabled:opacity-50"
              >
                Lưu cuộc trò chuyện
              </button>
              <button
                type="button"
                onClick={() => setShowHistory((v) => !v)}
                className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-edtech-text text-xs font-semibold border border-edtech-border transition-colors"
              >
                Lịch sử đã lưu ({savedChats.length})
              </button>
            </div>

            {showHistory && (
              <div className="p-3 rounded-xl bg-edtech-bg border border-edtech-border space-y-2">
                {savedChats.length === 0 ? (
                  <p className="text-xs text-edtech-muted">
                    Chưa có cuộc trò chuyện nào được lưu.
                  </p>
                ) : (
                  <ul className="space-y-2 max-h-48 overflow-y-auto">
                    {savedChats.map((chat) => (
                      <li
                        key={chat.id}
                        className="flex items-center justify-between gap-2 p-2 rounded-lg bg-white border border-edtech-border"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-edtech-text truncate">
                            {chat.title}
                          </p>
                          <p className="text-xs text-edtech-muted">
                            {new Date(chat.savedAt).toLocaleString("vi-VN")}
                          </p>
                        </div>
                        <div className="flex gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleOpenSavedChat(chat)}
                            className="px-2.5 py-1 rounded-lg bg-edtech-primary text-white text-xs font-bold"
                          >
                            Mở
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteSavedChat(chat.id)}
                            className="px-2.5 py-1 rounded-lg bg-white border border-edtech-border text-edtech-danger text-xs font-bold"
                          >
                            Xóa
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Lịch sử tin nhắn */}
            <div
              ref={chatListRef}
              data-testid="ai-mentor-chat-list"
              className="space-y-3 max-h-[420px] overflow-y-auto pr-1"
            >
              {chatMessages.map((msg) => {
                const isAssistant = msg.role === "assistant";
                const unaddedActionsCount =
                  isAssistant && msg.suggestedActions
                    ? msg.suggestedActions.filter(
                        (act) => !isActionAlreadyInSchedule(act)
                      ).length
                    : 0;

                return (
                  <div
                    key={msg.id}
                    className={`p-4 rounded-2xl border space-y-3 ${
                      isAssistant
                        ? "bg-edtech-bg border-edtech-border text-edtech-text"
                        : "bg-blue-50/90 border-blue-200 text-edtech-text ml-6"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {isAssistant ? (
                          <Sparkles
                            className="w-4 h-4 text-edtech-primary"
                            aria-hidden={true}
                          />
                        ) : (
                          <BookOpen
                            className="w-4 h-4 text-edtech-primary"
                            aria-hidden={true}
                          />
                        )}
                        <span className="text-xs font-bold text-edtech-primary">
                          {isAssistant ? "Cố vấn AI Mentor" : "Bạn"}
                        </span>
                      </div>
                      {isAssistant && msg.source && (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-white border border-edtech-border text-edtech-muted">
                          {msg.source === "gemini"
                            ? "Gemini AI"
                            : "Cố vấn Nội bộ"}
                        </span>
                      )}
                    </div>

                    <div className="text-sm leading-relaxed [&_p]:mb-2 [&_p:last-child]:mb-0 [&_strong]:font-bold [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-1">
                      <ReactMarkdown>
                        {msg.content.replace(/\n/g, "  \n")}
                      </ReactMarkdown>
                    </div>

                    {/* Thẻ khởi tạo Mục tiêu mới (SuggestedGoalAction) trực tiếp trong khung chat */}
                    {isAssistant &&
                      msg.suggestedGoals &&
                      msg.suggestedGoals.length > 0 && (
                        <div className="pt-2 border-t border-edtech-border space-y-2">
                          <p className="text-xs font-bold text-edtech-muted">
                            Mục tiêu học tập đề xuất (bấm để khởi tạo):
                          </p>
                          <div className="space-y-2">
                            {msg.suggestedGoals.map((goalAct) => {
                              const gKey = getGoalKey(goalAct);
                              const goalAdded = isGoalAlreadyInState(goalAct);
                              return (
                                <div
                                  key={gKey}
                                  className="p-3 rounded-xl bg-white border border-blue-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                                >
                                  <div className="text-xs space-y-0.5">
                                    <div className="font-bold text-edtech-text">
                                      {goalAct.title}
                                    </div>
                                    <div className="text-edtech-muted">
                                      Chỉ tiêu: {goalAct.targetHours} giờ • Hạn:{" "}
                                      {goalAct.deadline}
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    disabled={goalAdded}
                                    onClick={() =>
                                      handleApplySuggestedGoal(goalAct)
                                    }
                                    className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                                      goalAdded
                                        ? "bg-emerald-50 text-edtech-success border border-emerald-200"
                                        : "bg-edtech-primary hover:bg-edtech-primaryHover text-white"
                                    }`}
                                  >
                                    <PlusCircle
                                      className="w-3.5 h-3.5"
                                      aria-hidden={true}
                                    />
                                    <span>
                                      {goalAdded
                                        ? "Đã tạo mục tiêu ✓"
                                        : "+ Tạo mục tiêu này"}
                                    </span>
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                    {/* Thẻ Kế hoạch Lịch trình (SuggestedScheduleAction) kèm nút Áp dụng tất cả */}
                    {isAssistant &&
                      msg.suggestedActions &&
                      msg.suggestedActions.length > 0 && (
                        <div className="pt-2 border-t border-edtech-border space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-xs font-bold text-edtech-muted">
                              Lịch trình gợi ý đi kèm (bấm để thêm):
                            </p>
                            {msg.suggestedActions.length >= 2 &&
                              unaddedActionsCount >= 2 && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleApplyAllSuggestions(
                                      msg.suggestedActions!
                                    )
                                  }
                                  className="px-2.5 py-1 rounded-lg bg-edtech-primary hover:bg-edtech-primaryHover text-white text-xs font-bold transition-colors"
                                >
                                  + Áp dụng tất cả ({unaddedActionsCount} buổi)
                                </button>
                              )}
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {msg.suggestedActions.map((act) => {
                              const actKey = getActionKey(act);
                              const added = isActionAlreadyInSchedule(act);
                              return (
                                <button
                                  key={actKey}
                                  type="button"
                                  disabled={added}
                                  onClick={() => handleApplySuggestion(act)}
                                  className={`p-2.5 rounded-xl border text-left text-xs transition-colors ${
                                    added
                                      ? "bg-emerald-50 border-emerald-200 text-edtech-success"
                                      : "bg-white hover:bg-blue-50 border-edtech-border text-edtech-text"
                                  }`}
                                >
                                  <div className="flex items-center justify-between gap-1">
                                    <span className="font-bold text-edtech-primary">
                                      {act.startTime} - {act.endTime}
                                    </span>
                                    <span className="text-[11px] font-medium text-edtech-muted">
                                      {formatFriendlyDateLabel(act.date)}
                                    </span>
                                  </div>
                                  <div className="font-semibold truncate mt-0.5">
                                    {act.title}
                                  </div>
                                  <div className="mt-1 font-bold underline">
                                    {added
                                      ? "Đã thêm vào lịch ✓"
                                      : "+ Áp dụng vào lịch"}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                  </div>
                );
              })}
              {isSending && (
                <p
                  role="status"
                  className="p-3 rounded-2xl bg-edtech-bg border border-edtech-border text-xs font-semibold text-edtech-muted animate-pulse"
                >
                  Cố vấn AI đang phân tích...
                </p>
              )}
            </div>
          </div>

          {/* Form nhập câu hỏi (IME-safe Enter submit) */}
          <form
            ref={formRef}
            aria-labelledby="ai-chat-heading"
            onSubmit={handleSubmitForm}
            className="pt-3 border-t border-edtech-border space-y-2.5"
          >
            <div>
              <label
                htmlFor="ai-mentor-input"
                className="block text-xs font-bold text-edtech-text mb-1"
              >
                Đặt câu hỏi hoặc yêu cầu Cố vấn AI lập kế hoạch &amp; mục tiêu
              </label>
              <textarea
                id="ai-mentor-input"
                name="prompt"
                rows={2}
                value={promptInput}
                onChange={(e) => setPromptInput(e.target.value)}
                onKeyDown={handleTextareaKeyDown}
                placeholder="VD: Lập kế hoạch ôn IELTS 3 ngày tới; Xếp lịch học Cấu trúc dữ liệu tối mai; hoặc Tạo mục tiêu ôn Giải tích 25 giờ hạn 2026-12-25"
                className="w-full px-3.5 py-2.5 rounded-xl bg-edtech-bg border border-slate-300 text-sm text-edtech-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-edtech-primary"
              />
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-edtech-muted">
                Mẹo: Nhấn{" "}
                <kbd className="px-1.5 py-0.5 rounded bg-slate-100 border">
                  Enter
                </kbd>{" "}
                để gửi,{" "}
                <kbd className="px-1.5 py-0.5 rounded bg-slate-100 border">
                  Shift + Enter
                </kbd>{" "}
                để xuống dòng
              </span>
              <button
                type="submit"
                disabled={isSending}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-edtech-primary hover:bg-edtech-primaryHover text-white text-sm font-bold shadow-sm transition-colors"
              >
                <Send className="w-4 h-4" aria-hidden={true} />
                <span>Gửi tới Cố vấn AI</span>
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
