import {
  AIMessage,
  AppDatabaseState,
  FocusSession,
  Goal,
  GoalCategory,
  PomodoroPresetId,
  ScheduleEvent,
  ScheduleEventStatus,
  ScheduleEventType,
  SuggestedScheduleAction,
} from "@/types/database";

export const STORAGE_KEY = "edu_focus_db_v1";

export function calculateGoalProgress(
  completedHours: number,
  targetHours: number
): number {
  if (targetHours <= 0) return 0;
  const raw = Math.round((completedHours / targetHours) * 100);
  return Math.max(0, Math.min(100, raw));
}

/**
 * Hiển thị thời lượng tích lũy chính xác theo giờ và phút (khớp với phiên Pomodoro 25p và 50p)
 * Ví dụ: 18 -> "18 giờ", 18 + 25/60 -> "18 giờ 25 phút", 50/60 -> "50 phút"
 */
export function formatHoursAndMinutes(hours: number): string {
  const totalMinutes = Math.max(0, Math.round(hours * 60));
  if (totalMinutes === 0) return "0 phút";
  const hrs = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (hrs === 0) return `${mins} phút`;
  if (mins === 0) return `${hrs} giờ`;
  return `${hrs} giờ ${mins} phút`;
}

export interface DaysRemainingInfo {
  days: number;
  label: string;
  isOverdue: boolean;
  isUrgent: boolean;
}

/**
 * Tính số ngày còn lại tính từ ngày hiện tại (YYYY-MM-DD) tới hạn hoàn thành (deadline YYYY-MM-DD)
 */
export function getDaysRemainingInfo(
  deadline: string,
  referenceDateStr?: string
): DaysRemainingInfo {
  const todayStr = referenceDateStr ?? new Date().toISOString().slice(0, 10);
  const [y1, m1, d1] = todayStr.split("-").map(Number);
  const [y2, m2, d2] = deadline.split("-").map(Number);

  if (
    Number.isNaN(y1) ||
    Number.isNaN(m1) ||
    Number.isNaN(d1) ||
    Number.isNaN(y2) ||
    Number.isNaN(m2) ||
    Number.isNaN(d2)
  ) {
    return {
      days: 0,
      label: "Chưa rõ hạn",
      isOverdue: false,
      isUrgent: false,
    };
  }

  const utcToday = Date.UTC(y1, m1 - 1, d1);
  const utcDeadline = Date.UTC(y2, m2 - 1, d2);
  const diffDays = Math.round((utcDeadline - utcToday) / (1000 * 60 * 60 * 24));

  if (diffDays > 0) {
    return {
      days: diffDays,
      label: `Còn ${diffDays} ngày`,
      isOverdue: false,
      isUrgent: diffDays <= 7,
    };
  }
  if (diffDays === 0) {
    return {
      days: 0,
      label: "Hết hạn hôm nay",
      isOverdue: false,
      isUrgent: true,
    };
  }
  return {
    days: diffDays,
    label: `Quá hạn ${Math.abs(diffDays)} ngày`,
    isOverdue: true,
    isUrgent: true,
  };
}

export function calculateEventDurationHours(
  startTime: string,
  endTime: string
): number {
  const [startH, startM] = startTime.split(":").map(Number);
  const [endH, endM] = endTime.split(":").map(Number);
  if (
    Number.isNaN(startH) ||
    Number.isNaN(startM) ||
    Number.isNaN(endH) ||
    Number.isNaN(endM)
  ) {
    return 0;
  }
  const diffMinutes = endH * 60 + endM - (startH * 60 + startM);
  if (diffMinutes <= 0) return 0;
  return Math.round((diffMinutes / 60) * 100) / 100;
}

export interface CreateGoalInput {
  title: string;
  description?: string;
  category: GoalCategory;
  targetHours: number;
  completedHours?: number;
  deadline: string;
}

export function addGoalToState(
  state: AppDatabaseState,
  input: CreateGoalInput
): AppDatabaseState {
  const targetHours = Math.max(1, Number(input.targetHours) || 1);
  const completedHours = Math.max(0, Number(input.completedHours) || 0);
  const progressPercent = calculateGoalProgress(completedHours, targetHours);

  const newGoal: Goal = {
    id: `goal-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title: input.title.trim(),
    description: (input.description ?? "").trim(),
    category: input.category,
    targetHours,
    completedHours,
    deadline: input.deadline,
    progressPercent,
    status: progressPercent >= 100 ? "completed" : "active",
  };

  return saveAppState({
    ...state,
    goals: [newGoal, ...state.goals],
  });
}

export function updateGoalInState(
  state: AppDatabaseState,
  goalId: string,
  updates: Partial<
    Pick<
      Goal,
      | "title"
      | "description"
      | "category"
      | "targetHours"
      | "completedHours"
      | "deadline"
      | "status"
    >
  >
): AppDatabaseState {
  const nextGoals = state.goals.map((goal) => {
    if (goal.id !== goalId) return goal;
    const targetHours = Math.max(
      1,
      updates.targetHours !== undefined ? updates.targetHours : goal.targetHours
    );
    const completedHours = Math.max(
      0,
      Math.round(
        (updates.completedHours !== undefined
          ? updates.completedHours
          : goal.completedHours) * 60
      ) / 60
    );
    const progressPercent = calculateGoalProgress(completedHours, targetHours);
    const status =
      updates.status ?? (progressPercent >= 100 ? "completed" : "active");

    return {
      ...goal,
      ...updates,
      targetHours,
      completedHours,
      progressPercent,
      status,
    };
  });

  return saveAppState({
    ...state,
    goals: nextGoals,
  });
}

export function deleteGoalFromState(
  state: AppDatabaseState,
  goalId: string
): AppDatabaseState {
  const nextGoals = state.goals.filter((g) => g.id !== goalId);
  const nextEvents = state.scheduleEvents.map((evt) =>
    evt.goalId === goalId ? { ...evt, goalId: undefined } : evt
  );

  return saveAppState({
    ...state,
    goals: nextGoals,
    scheduleEvents: nextEvents,
  });
}

export interface CreateScheduleEventInput {
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  type: ScheduleEventType;
  goalId?: string;
  notes?: string;
}

export function addScheduleEventToState(
  state: AppDatabaseState,
  input: CreateScheduleEventInput
): AppDatabaseState {
  const newEvent: ScheduleEvent = {
    id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title: input.title.trim(),
    date: input.date,
    startTime: input.startTime,
    endTime: input.endTime,
    type: input.type,
    goalId: input.goalId || undefined,
    status: "planned",
    notes: input.notes?.trim() || undefined,
  };

  const sortedEvents = [...state.scheduleEvents, newEvent].sort((a, b) => {
    const dateCompare = a.date.localeCompare(b.date);
    if (dateCompare !== 0) return dateCompare;
    return a.startTime.localeCompare(b.startTime);
  });

  return saveAppState({
    ...state,
    scheduleEvents: sortedEvents,
  });
}

export function updateScheduleEventStatusInState(
  state: AppDatabaseState,
  eventId: string,
  nextStatus: ScheduleEventStatus
): AppDatabaseState {
  const targetEvent = state.scheduleEvents.find((e) => e.id === eventId);
  if (!targetEvent || targetEvent.status === nextStatus) {
    return state;
  }

  const nextEvents = state.scheduleEvents.map((evt) =>
    evt.id === eventId ? { ...evt, status: nextStatus } : evt
  );

  return saveAppState({
    ...state,
    scheduleEvents: nextEvents,
  });
}

export interface RecordPomodoroWorkInput {
  presetId: PomodoroPresetId;
  workMinutes: number; // 25 hoặc 50 phút
  goalId?: string;
  scheduleEventId?: string;
}

/**
 * Ghi nhận hoàn thành 1 phiên tập trung Pomodoro (25 phút hoặc 50 phút):
 * - Cộng chính xác số phút đã học (workMinutes / 60 giờ) vào Mục tiêu đang chọn
 * - Lưu phiên học vào focusSessions
 * - Nếu gắn với một công việc trong lịch (scheduleEventId), đánh dấu công việc đó là hoàn thành
 */
export function recordPomodoroWorkSessionInState(
  state: AppDatabaseState,
  input: RecordPomodoroWorkInput
): AppDatabaseState {
  const minutes = Math.max(1, Math.round(input.workMinutes));
  const linkedEvent = input.scheduleEventId
    ? state.scheduleEvents.find((e) => e.id === input.scheduleEventId)
    : undefined;
  const effectiveGoalId = input.goalId || linkedEvent?.goalId;

  const nowIso = new Date().toISOString();
  const startedIso = new Date(Date.now() - minutes * 60 * 1000).toISOString();

  const newSession: FocusSession = {
    id: `session-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    scheduleEventId: input.scheduleEventId || undefined,
    mode: "study_focus",
    pomodoroPreset: input.presetId,
    startedAt: startedIso,
    endedAt: nowIso,
    durationMinutes: minutes,
    focusScorePercent: 100,
    distractionCount: 0,
  };

  const nextGoals = effectiveGoalId
    ? state.goals.map((goal) => {
        if (goal.id !== effectiveGoalId) return goal;
        const currentTotalMinutes = Math.round(goal.completedHours * 60);
        const nextTotalMinutes = currentTotalMinutes + minutes;
        const completedHours = nextTotalMinutes / 60;
        const progressPercent = calculateGoalProgress(
          completedHours,
          goal.targetHours
        );
        return {
          ...goal,
          completedHours,
          progressPercent,
          status:
            progressPercent >= 100
              ? ("completed" as const)
              : ("active" as const),
        };
      })
    : state.goals;

  const nextEvents = input.scheduleEventId
    ? state.scheduleEvents.map((evt) =>
        evt.id === input.scheduleEventId
          ? { ...evt, status: "completed" as const }
          : evt
      )
    : state.scheduleEvents;

  return saveAppState({
    ...state,
    goals: nextGoals,
    scheduleEvents: nextEvents,
    focusSessions: [...state.focusSessions, newSession],
  });
}

export function deleteScheduleEventFromState(
  state: AppDatabaseState,
  eventId: string
): AppDatabaseState {
  return saveAppState({
    ...state,
    scheduleEvents: state.scheduleEvents.filter((evt) => evt.id !== eventId),
  });
}

export function appendAIMessageToState(
  state: AppDatabaseState,
  message: AIMessage
): AppDatabaseState {
  return saveAppState({
    ...state,
    aiMessages: [...state.aiMessages, message],
  });
}

export function applySuggestedActionToState(
  state: AppDatabaseState,
  action: SuggestedScheduleAction
): AppDatabaseState {
  return addScheduleEventToState(state, {
    title: action.title,
    date: action.date,
    startTime: action.startTime,
    endTime: action.endTime,
    type: action.type,
    goalId: action.goalId,
    notes: "Được đề xuất bởi Cố vấn AI Mentor",
  });
}

export function createDefaultState(): AppDatabaseState {
  const today = new Date().toISOString().slice(0, 10);

  const goals: Goal[] = [
    {
      id: "goal-dsa",
      title: "Hoàn thành môn Cấu trúc dữ liệu & Giải thuật (Điểm A)",
      description:
        "Ôn chắc Cây nhị phân, Đồ thị và Quy hoạch động kèm giải 40 bài thực hành.",
      category: "academic",
      targetHours: 40,
      completedHours: 18,
      deadline: "2026-12-20",
      progressPercent: calculateGoalProgress(18, 40),
      status: "active",
    },
    {
      id: "goal-ielts",
      title: "Luyện nghe & đọc IELTS đạt band 7.0",
      description:
        "Duy trì 45 phút luyện đề mỗi sáng và ghi chú từ vựng học thuật.",
      category: "skill",
      targetHours: 60,
      completedHours: 36,
      deadline: "2027-01-15",
      progressPercent: calculateGoalProgress(36, 60),
      status: "active",
    },
    {
      id: "goal-posture",
      title: "Vận động giải lao giữa giờ học mỗi ngày",
      description:
        "Thực hiện bài tập Giơ tay qua đầu và Giãn cơ vai với Webcam sau mỗi ca Pomodoro.",
      category: "health",
      targetHours: 15,
      completedHours: 12,
      deadline: "2026-12-05",
      progressPercent: calculateGoalProgress(12, 15),
      status: "active",
    },
  ];

  return {
    goals,
    scheduleEvents: [
      {
        id: "evt-1",
        goalId: "goal-dsa",
        title: "Ôn tập Đồ thị (BFS / DFS) & làm 3 bài tập",
        date: today,
        startTime: "08:00",
        endTime: "09:30",
        type: "study",
        status: "completed",
        notes: "Đã hoàn thành đúng tiến độ, cần xem lại phần đệ quy.",
      },
      {
        id: "evt-2",
        goalId: "goal-posture",
        title: "Giải lao vận động: 15 nhịp Giơ tay qua đầu + Giãn vai",
        date: today,
        startTime: "09:30",
        endTime: "09:45",
        type: "exercise",
        status: "completed",
      },
      {
        id: "evt-3",
        goalId: "goal-ielts",
        title: "Luyện Reading Passage 2 & tổng hợp 15 từ vựng",
        date: today,
        startTime: "14:00",
        endTime: "15:00",
        type: "study",
        status: "planned",
      },
      {
        id: "evt-4",
        goalId: "goal-dsa",
        title: "Tổng kết công thức Quy hoạch động cơ bản",
        date: today,
        startTime: "19:30",
        endTime: "21:00",
        type: "review",
        status: "planned",
      },
    ],
    focusSessions: [
      {
        id: "session-1",
        scheduleEventId: "evt-1",
        mode: "study_focus",
        startedAt: `${today}T08:00:00.000Z`,
        endedAt: `${today}T09:30:00.000Z`,
        durationMinutes: 90,
        focusScorePercent: 92,
        distractionCount: 1,
      },
      {
        id: "session-2",
        scheduleEventId: "evt-2",
        mode: "exercise_break",
        startedAt: `${today}T09:30:00.000Z`,
        endedAt: `${today}T09:40:00.000Z`,
        durationMinutes: 10,
        focusScorePercent: 100,
        distractionCount: 0,
        exerciseType: "overhead_reach",
        completedReps: 15,
        targetReps: 15,
      },
    ],
    aiMessages: [
      {
        id: "msg-welcome",
        role: "assistant",
        content:
          "Chào Mây! Hôm nay cậu đã hoàn thành xuất sắc ca học Cấu trúc dữ liệu buổi sáng với độ tập trung 92% và đủ 15 nhịp vận động giải lao. Chiều nay lúc 14:00 có lịch luyện Reading IELTS, nhớ khởi động Phòng Kỷ luật Webcam để giữ nhịp nhé!",
        createdAt: `${today}T09:45:00.000Z`,
      },
    ],
    updatedAt: new Date().toISOString(),
  };
}

export function loadAppState(): AppDatabaseState {
  if (typeof window === "undefined") {
    return createDefaultState();
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const initial = createDefaultState();
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }
    const parsed = JSON.parse(raw) as AppDatabaseState;
    if (!parsed || !Array.isArray(parsed.goals)) {
      return createDefaultState();
    }
    return parsed;
  } catch {
    return createDefaultState();
  }
}

export function saveAppState(state: AppDatabaseState): AppDatabaseState {
  const updated: AppDatabaseState = {
    ...state,
    updatedAt: new Date().toISOString(),
  };
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // Ignore quota errors in restricted environments
    }
  }
  return updated;
}

export function resetAppState(): AppDatabaseState {
  const initial = createDefaultState();
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
    } catch {
      // Ignore storage errors
    }
  }
  return initial;
}
