import {
  addDaysToDateString,
  formatHoursAndMinutes,
  getDaysRemainingInfo,
} from "@/lib/storage/local-db";
import {
  AIMessage,
  AppDatabaseState,
  Goal,
  GoalCategory,
  ScheduleEventType,
  SuggestedGoalAction,
  SuggestedScheduleAction,
} from "@/types/database";

export interface ChatHistoryTurn {
  role: "user" | "assistant";
  content: string;
}

/**
 * Lấy ngày hiện tại theo múi giờ Việt Nam (Asia/Ho_Chi_Minh) hoặc giờ địa phương dạng YYYY-MM-DD
 * Tránh lỗi lệch lùi 1 ngày khi dùng new Date().toISOString() trong khung 00:00 - 06:59 sáng.
 */
export function getLocalTodayDateString(now: Date = new Date()): string {
  try {
    const formatted = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Ho_Chi_Minh",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);
    if (/^\d{4}-\d{2}-\d{2}$/.test(formatted)) {
      return formatted;
    }
  } catch {
    // Fallback về giờ local của máy
  }
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export interface GoalDiagnostic {
  goal: Goal;
  remainingHours: number;
  remainingMinutes: number;
  daysLeft: number;
  daysLabel: string;
  isUrgent: boolean;
  isOverdue: boolean;
  recommendedMinutesPerDay: number;
  recommendedPomodoro25Count: number;
  recommendedPomodoro50Count: number;
}

export interface DisciplineHabitDiagnosis {
  penalizedSessionsCount: number;
  latestPenaltyReason: string | null;
  totalDrowsinessAlerts: number;
  studySessionsCount: number;
  exerciseSessionsCount: number;
  totalExerciseReps: number;
  missedEventsCount: number;
  urgentGoalsCount: number;
  overdueGoalsCount: number;
  needsMoreExerciseBreak: boolean;
  hasDrowsinessRisk: boolean;
}

export interface StudentProgressAnalysis {
  diagnostics: GoalDiagnostic[];
  topPriorityGoal: GoalDiagnostic | null;
  totalFocusMinutes: number;
  averageFocusScore: number;
  totalDistractions: number;
  completedEventsCount: number;
  totalEventsCount: number;
  habits: DisciplineHabitDiagnosis;
}

export function analyzeDisciplineHabits(
  state: AppDatabaseState,
  diagnostics: GoalDiagnostic[]
): DisciplineHabitDiagnosis {
  const penalizedSessions = state.focusSessions.filter((s) => s.penalized);
  const latestPenalized =
    penalizedSessions.length > 0
      ? penalizedSessions[penalizedSessions.length - 1]
      : null;

  const totalDrowsinessAlerts = state.focusSessions.reduce(
    (sum, s) => sum + (s.drowsinessAlertCount ?? 0),
    0
  );
  const studySessionsCount = state.focusSessions.filter(
    (s) => s.mode === "study_focus"
  ).length;
  const exerciseSessionsCount = state.focusSessions.filter(
    (s) => s.mode === "exercise_break"
  ).length;
  const totalExerciseReps = state.focusSessions.reduce(
    (sum, s) => sum + (s.completedReps ?? 0),
    0
  );
  const missedEventsCount = state.scheduleEvents.filter(
    (e) => e.status === "missed"
  ).length;

  const overdueGoalsCount = diagnostics.filter(
    (d) => d.isOverdue && d.remainingMinutes > 0
  ).length;
  const urgentGoalsCount = diagnostics.filter(
    (d) => d.isUrgent && !d.isOverdue && d.remainingMinutes > 0
  ).length;

  return {
    penalizedSessionsCount: penalizedSessions.length,
    latestPenaltyReason: latestPenalized?.penaltyReason ?? null,
    totalDrowsinessAlerts,
    studySessionsCount,
    exerciseSessionsCount,
    totalExerciseReps,
    missedEventsCount,
    urgentGoalsCount,
    overdueGoalsCount,
    needsMoreExerciseBreak:
      studySessionsCount >= 2 && exerciseSessionsCount === 0,
    hasDrowsinessRisk:
      totalDrowsinessAlerts > 0 || penalizedSessions.length > 0,
  };
}

export function analyzeStudentProgress(
  state: AppDatabaseState,
  referenceDateStr?: string
): StudentProgressAnalysis {
  const todayStr = referenceDateStr ?? getLocalTodayDateString();

  const diagnostics: GoalDiagnostic[] = state.goals.map((goal) => {
    const remainingHours = Math.max(0, goal.targetHours - goal.completedHours);
    const remainingMinutes = Math.round(remainingHours * 60);
    const dayInfo = getDaysRemainingInfo(goal.deadline, todayStr);
    const effectiveDays = Math.max(1, dayInfo.days > 0 ? dayInfo.days : 1);
    const recommendedMinutesPerDay =
      remainingMinutes > 0 ? Math.ceil(remainingMinutes / effectiveDays) : 0;

    return {
      goal,
      remainingHours,
      remainingMinutes,
      daysLeft: dayInfo.days,
      daysLabel: dayInfo.label,
      isUrgent: dayInfo.isUrgent,
      isOverdue: dayInfo.isOverdue,
      recommendedMinutesPerDay,
      recommendedPomodoro25Count:
        recommendedMinutesPerDay > 0
          ? Math.max(1, Math.ceil(recommendedMinutesPerDay / 25))
          : 0,
      recommendedPomodoro50Count:
        recommendedMinutesPerDay > 0
          ? Math.max(1, Math.ceil(recommendedMinutesPerDay / 50))
          : 0,
    };
  });

  // Ưu tiên mục tiêu chưa hoàn thành cần số phút mỗi ngày cao nhất hoặc sắp hết hạn nhất
  const activeDiagnostics = diagnostics.filter((d) => d.remainingMinutes > 0);
  activeDiagnostics.sort((a, b) => {
    if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
    if (a.isUrgent !== b.isUrgent) return a.isUrgent ? -1 : 1;
    return b.recommendedMinutesPerDay - a.recommendedMinutesPerDay;
  });

  const totalFocusMinutes = state.focusSessions.reduce(
    (sum, s) => sum + s.durationMinutes,
    0
  );
  const averageFocusScore =
    state.focusSessions.length > 0
      ? Math.round(
          state.focusSessions.reduce((sum, s) => sum + s.focusScorePercent, 0) /
            state.focusSessions.length
        )
      : 100;
  const totalDistractions = state.focusSessions.reduce(
    (sum, s) => sum + s.distractionCount,
    0
  );
  const completedEventsCount = state.scheduleEvents.filter(
    (e) => e.status === "completed"
  ).length;

  const habits = analyzeDisciplineHabits(state, diagnostics);

  return {
    diagnostics,
    topPriorityGoal: activeDiagnostics[0] ?? null,
    totalFocusMinutes,
    averageFocusScore,
    totalDistractions,
    completedEventsCount,
    totalEventsCount: state.scheduleEvents.length,
    habits,
  };
}

const CANDIDATE_SLOTS = [
  { startTime: "08:00", endTime: "08:50", period: "morning" as const },
  { startTime: "10:00", endTime: "10:50", period: "morning" as const },
  { startTime: "14:00", endTime: "14:50", period: "afternoon" as const },
  { startTime: "15:15", endTime: "16:05", period: "afternoon" as const },
  { startTime: "16:10", endTime: "16:25", period: "exercise" as const },
  { startTime: "17:00", endTime: "17:50", period: "afternoon" as const },
  { startTime: "19:30", endTime: "20:20", period: "evening" as const },
  { startTime: "20:30", endTime: "21:20", period: "evening" as const },
  { startTime: "21:15", endTime: "22:05", period: "evening" as const },
];

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function isSlotOverlapping(
  startA: string,
  endA: string,
  startB: string,
  endB: string
): boolean {
  const a0 = toMinutes(startA);
  const a1 = toMinutes(endA);
  const b0 = toMinutes(startB);
  const b1 = toMinutes(endB);
  return a0 < b1 && b0 < a1;
}

/**
 * Đề xuất các khung giờ học & vận động thông minh dựa trên mục tiêu thực tế và né các giờ đã bận
 */
export function generateSmartScheduleSuggestions(
  state: AppDatabaseState,
  targetDate?: string
): SuggestedScheduleAction[] {
  const dateStr = targetDate ?? getLocalTodayDateString();
  const analysis = analyzeStudentProgress(state, dateStr);
  const eventsOnDate = state.scheduleEvents.filter((e) => e.date === dateStr);

  const freeSlots = CANDIDATE_SLOTS.filter(
    (slot) =>
      !eventsOnDate.some((evt) =>
        isSlotOverlapping(slot.startTime, slot.endTime, evt.startTime, evt.endTime)
      )
  );

  const suggestions: SuggestedScheduleAction[] = [];
  const academicOrSkillGoals = analysis.diagnostics.filter(
    (d) => d.goal.category !== "health" && d.remainingMinutes > 0
  );
  const healthGoal = analysis.diagnostics.find(
    (d) => d.goal.category === "health"
  );

  const studySlots = freeSlots.filter((s) => s.period !== "exercise");
  const exerciseSlot = freeSlots.find((s) => s.period === "exercise");

  if (academicOrSkillGoals[0] && studySlots[0]) {
    const g = academicOrSkillGoals[0];
    suggestions.push({
      title: `Phiên Pomodoro 50/15: ${g.goal.title}`,
      date: dateStr,
      startTime: studySlots[0].startTime,
      endTime: studySlots[0].endTime,
      type: "study",
      goalId: g.goal.id,
    });
  }

  if (exerciseSlot) {
    suggestions.push({
      title: "Vận động giải lao Webcam: 15 nhịp Giơ tay qua đầu & Giãn vai",
      date: dateStr,
      startTime: exerciseSlot.startTime,
      endTime: exerciseSlot.endTime,
      type: "exercise",
      goalId: healthGoal?.goal.id,
    });
  }

  const secondGoal = academicOrSkillGoals[1] ?? academicOrSkillGoals[0];
  if (secondGoal && studySlots[1]) {
    suggestions.push({
      title: `Ôn tập củng cố (25/5): ${secondGoal.goal.title}`,
      date: dateStr,
      startTime: studySlots[1].startTime,
      endTime: studySlots[1].endTime,
      type: "review",
      goalId: secondGoal.goal.id,
    });
  }

  return suggestions;
}

function formatHHMM(totalMinutes: number): string {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, totalMinutes));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function inferScheduleTypeFromPrompt(normalizedPrompt: string): ScheduleEventType {
  if (
    normalizedPrompt.includes("vận động") ||
    normalizedPrompt.includes("thể dục") ||
    normalizedPrompt.includes("giãn cơ") ||
    normalizedPrompt.includes("giơ tay") ||
    normalizedPrompt.includes("squat")
  ) {
    return "exercise";
  }
  if (
    normalizedPrompt.includes("ôn tập") ||
    normalizedPrompt.includes("ôn thi") ||
    normalizedPrompt.includes("tổng kết") ||
    normalizedPrompt.includes("củng cố")
  ) {
    return "review";
  }
  return "study";
}

function findMatchingGoal(state: AppDatabaseState, text: string): Goal | undefined {
  const normalized = text.toLowerCase();
  for (const goal of state.goals) {
    const titleLower = goal.title.toLowerCase();
    if (normalized.includes(titleLower)) return goal;
    const words = titleLower
      .split(/[\s,()&/-]+/)
      .filter((w) => w.length >= 4);
    if (words.some((w) => normalized.includes(w))) {
      return goal;
    }
  }
  if (normalized.includes("ielts") || normalized.includes("tiếng anh")) {
    return state.goals.find((g) => g.title.toLowerCase().includes("ielts"));
  }
  if (
    normalized.includes("cấu trúc dữ liệu") ||
    normalized.includes("giải thuật") ||
    normalized.includes("dsa") ||
    normalized.includes("đồ thị")
  ) {
    return state.goals.find(
      (g) =>
        g.title.toLowerCase().includes("cấu trúc dữ liệu") ||
        g.title.toLowerCase().includes("giải thuật")
    );
  }
  return undefined;
}

/**
 * Tìm mục tiêu từ câu hỏi hiện tại hoặc kế thừa từ các lượt thảo luận gần nhất trong lịch sử chat
 */
export function resolveGoalFromPromptOrHistory(
  state: AppDatabaseState,
  userPrompt: string,
  history?: ChatHistoryTurn[]
): Goal | undefined {
  const direct = findMatchingGoal(state, userPrompt);
  if (direct) return direct;

  if (Array.isArray(history) && history.length > 0) {
    for (let i = history.length - 1; i >= 0; i--) {
      const turn = history[i];
      if (!turn || typeof turn.content !== "string") continue;
      // Ưu tiên tìm trong các câu người dùng vừa nhắn trước đó
      if (turn.role === "user") {
        const fromHistory = findMatchingGoal(state, turn.content);
        if (fromHistory) return fromHistory;
      }
    }
  }
  return undefined;
}

function resolveTargetDatesFromPrompt(
  userPrompt: string,
  todayStr: string
): { dates: string[]; isMultiDay: boolean; isExplicitDateOrOffset: boolean } {
  const normalized = userPrompt.toLowerCase();

  // Kiểm tra yêu cầu lập lộ trình N ngày (VD: "3 ngày tới", "lộ trình 5 ngày", "kế hoạch 4 ngày")
  const multiDayMatch =
    /(?:trong|lộ\s+trình|kế\s+hoạch|xếp\s+lịch|lịch)\s+(\d)\s*ngày/i.exec(
      userPrompt
    ) ?? /(\d)\s*ngày\s*(?:tới|tiếp\s+theo|liên\s+tiếp)/i.exec(userPrompt);
  if (multiDayMatch) {
    const count = Math.max(2, Math.min(7, Number(multiDayMatch[1]) || 3));
    const dates: string[] = [];
    for (let i = 0; i < count; i++) {
      dates.push(addDaysToDateString(todayStr, i));
    }
    return { dates, isMultiDay: true, isExplicitDateOrOffset: true };
  }

  // Kiểm tra ngày cụ thể YYYY-MM-DD trong tin nhắn
  const isoDateMatch = /\b(20\d{2}-\d{2}-\d{2})\b/.exec(userPrompt);
  if (isoDateMatch) {
    return {
      dates: [isoDateMatch[1]],
      isMultiDay: false,
      isExplicitDateOrOffset: true,
    };
  }

  // Kiểm tra "ngày kia" / "ngày mốt" (+2 ngày)
  if (normalized.includes("ngày kia") || normalized.includes("ngày mốt")) {
    return {
      dates: [addDaysToDateString(todayStr, 2)],
      isMultiDay: false,
      isExplicitDateOrOffset: true,
    };
  }

  // Kiểm tra "ngày mai" / "sáng mai" / "chiều mai" / "tối mai" (+1 ngày)
  if (
    normalized.includes("ngày mai") ||
    normalized.includes("sáng mai") ||
    normalized.includes("chiều mai") ||
    normalized.includes("tối mai")
  ) {
    return {
      dates: [addDaysToDateString(todayStr, 1)],
      isMultiDay: false,
      isExplicitDateOrOffset: true,
    };
  }

  return {
    dates: [todayStr],
    isMultiDay: false,
    isExplicitDateOrOffset: false,
  };
}

function detectRequestedPeriod(
  normalizedPrompt: string
): "morning" | "afternoon" | "evening" | null {
  if (
    normalizedPrompt.includes("buổi tối") ||
    normalizedPrompt.includes("tối nay") ||
    normalizedPrompt.includes("tối mai") ||
    normalizedPrompt.includes("ca tối")
  ) {
    return "evening";
  }
  if (
    normalizedPrompt.includes("buổi chiều") ||
    normalizedPrompt.includes("chiều nay") ||
    normalizedPrompt.includes("chiều mai") ||
    normalizedPrompt.includes("ca chiều")
  ) {
    return "afternoon";
  }
  if (
    normalizedPrompt.includes("buổi sáng") ||
    normalizedPrompt.includes("sáng nay") ||
    normalizedPrompt.includes("sáng mai") ||
    normalizedPrompt.includes("ca sáng")
  ) {
    return "morning";
  }
  return null;
}

function extractCustomPlanTitle(
  prompt: string,
  matchedGoal: Goal | undefined,
  eventType: ScheduleEventType
): string {
  const cleaned = prompt
    .replace(
      /\b(\d{1,2})(?::|h)(\d{2})?\s*(?:-|–|đến|tới|->)\s*(\d{1,2})(?::|h)(\d{2})?\b/gi,
      ""
    )
    .replace(/\b(?:lúc|vào|từ)\s+(\d{1,2})(?::|h)(\d{2})?\b/gi, "")
    .replace(/\b20\d{2}-\d{2}-\d{2}\b/g, "")
    .replace(
      /^(?:hãy\s+)?(?:tạo|lập|lên|thêm|xếp|đặt|đổi|chuyển|dời)\s+(?:cho\s+(?:tớ|mình|em)\s+|giúp\s+(?:tớ|mình|em)\s+)?(?:kế\s+hoạch|lộ\s+trình|lịch\s+trình|lịch|khung\s+giờ|sang)?\s*/i,
      ""
    )
    .replace(
      /\b(?:trong\s+\d+\s+ngày\s+tới|\d+\s+ngày\s+tới|\d+\s+ngày\s+liên\s+tiếp|hôm\s+nay|ngày\s+mai|ngày\s+kia|tối\s+nay|tối\s+mai|chiều\s+nay|chiều\s+mai|sáng\s+nay|sáng\s+mai|buổi\s+tối|buổi\s+chiều|buổi\s+sáng|nhé|giúp\s+tớ|giúp\s+mình|cho\s+tớ)\b/gi,
      ""
    )
    .replace(/\s+/g, " ")
    .trim();

  if (cleaned.length >= 4 && cleaned.length <= 90) {
    const capitalized = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    return capitalized;
  }

  if (matchedGoal) {
    if (eventType === "exercise") {
      return `Vận động giải lao: ${matchedGoal.title}`;
    }
    if (eventType === "review") {
      return `Ôn tập củng cố: ${matchedGoal.title}`;
    }
    return `Phiên học tập trung: ${matchedGoal.title}`;
  }

  if (eventType === "exercise") {
    return "Vận động giải lao Webcam: 15 nhịp Giơ tay qua đầu & Giãn vai";
  }
  if (eventType === "review") {
    return "Ôn tập & Tổng kết kiến thức trọng tâm";
  }
  return "Phiên học tập trung theo kế hoạch AI Mentor";
}

/**
 * Trích xuất yêu cầu Tạo Mục tiêu mới (Goal) trực tiếp từ khung chat
 * VD: "Tạo mục tiêu ôn Giải tích 25 giờ hạn 2026-12-25" hoặc "Thêm mục tiêu học React 20 tiếng trong 14 ngày"
 */
export function parseCustomGoalFromPrompt(
  userPrompt: string,
  referenceDateStr?: string
): SuggestedGoalAction[] {
  const todayStr = referenceDateStr ?? getLocalTodayDateString();
  const normalized = userPrompt.toLowerCase();

  const isGoalCreationRequest =
    /(?:tạo|thêm|đặt|lập|khởi\s+tạo)\s+(?:cho\s+(?:tớ|mình)\s+)?mục\s+tiêu/i.test(
      userPrompt
    );
  if (!isGoalCreationRequest) return [];

  // Trích xuất số giờ cần đạt (VD: "25 giờ", "20 tiếng", "15h")
  const hoursMatch = /(\d{1,3})\s*(?:giờ|tiếng|h\b)/i.exec(userPrompt);
  const targetHours = hoursMatch
    ? Math.max(1, Math.min(500, Number(hoursMatch[1]) || 20))
    : 20;

  // Trích xuất hạn chót (YYYY-MM-DD hoặc "trong N ngày/tuần")
  let deadline = addDaysToDateString(todayStr, 14);
  const isoMatch = /\b(20\d{2}-\d{2}-\d{2})\b/.exec(userPrompt);
  const dmyMatch = /\b(\d{1,2})\/(\d{1,2})(?:\/(20\d{2}))?\b/.exec(userPrompt);
  const inDaysMatch = /(?:trong|hạn)\s+(\d{1,3})\s*ngày/i.exec(userPrompt);
  const inWeeksMatch = /(?:trong|hạn)\s+(\d{1,2})\s*tuần/i.exec(userPrompt);

  if (isoMatch) {
    deadline = isoMatch[1];
  } else if (dmyMatch) {
    const d = String(Number(dmyMatch[1])).padStart(2, "0");
    const m = String(Number(dmyMatch[2])).padStart(2, "0");
    const y = dmyMatch[3] ?? todayStr.slice(0, 4);
    deadline = `${y}-${m}-${d}`;
  } else if (inDaysMatch) {
    deadline = addDaysToDateString(
      todayStr,
      Math.max(1, Number(inDaysMatch[1]) || 14)
    );
  } else if (inWeeksMatch) {
    deadline = addDaysToDateString(
      todayStr,
      Math.max(1, (Number(inWeeksMatch[1]) || 2) * 7)
    );
  }

  let category: GoalCategory = "academic";
  if (
    normalized.includes("vận động") ||
    normalized.includes("thể dục") ||
    normalized.includes("sức khỏe") ||
    normalized.includes("giãn cơ")
  ) {
    category = "health";
  } else if (
    normalized.includes("ielts") ||
    normalized.includes("tiếng anh") ||
    normalized.includes("ngoại ngữ") ||
    normalized.includes("kỹ năng") ||
    normalized.includes("lập trình")
  ) {
    category = "skill";
  }

  const rawTitle = userPrompt
    .replace(
      /^(?:hãy\s+)?(?:tạo|thêm|đặt|lập|khởi\s+tạo)\s+(?:cho\s+(?:tớ|mình)\s+)?mục\s+tiêu(?:\s+mới)?\s*/i,
      ""
    )
    .replace(/\b(?:với|cần|tổng)?\s*\d{1,3}\s*(?:giờ|tiếng|h\b)/gi, "")
    .replace(/\b(?:hạn(?:\s+chót)?|deadline| đến)\s*(?:ngày)?\s*20\d{2}-\d{2}-\d{2}/gi, "")
    .replace(/\b(?:hạn(?:\s+chót)?|deadline|đến)\s*(?:ngày)?\s*\d{1,2}\/\d{1,2}(?:\/20\d{2})?/gi, "")
    .replace(/\b(?:trong|hạn)\s+\d{1,3}\s*(?:ngày|tuần)(?:\s+tới)?/gi, "")
    .replace(/\b(?:giúp\s+tớ|giúp\s+mình|nhé)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  const title =
    rawTitle.length >= 3
      ? rawTitle.charAt(0).toUpperCase() + rawTitle.slice(1)
      : "Mục tiêu học tập mới từ Cố vấn AI";

  return [
    {
      title,
      description: `Được thiết lập qua Cố vấn AI Mentor (${targetHours} giờ • Hạn ${deadline}).`,
      category,
      targetHours,
      deadline,
    },
  ];
}

/**
 * Trích xuất kế hoạch học tập trực tiếp từ yêu cầu trong khung chat của người dùng
 * Hỗ trợ:
 * - Giờ cụ thể ("19:00 - 20:00", "20h - 21h30", "lúc 20h")
 * - Buổi tự nhiên ("tối nay", "sáng mai", "chiều nay")
 * - Lộ trình nhiều ngày ("lập kế hoạch 3 ngày tới")
 * - Kế thừa môn học từ các câu thảo luận trước đó (history)
 */
export function parseCustomScheduleFromPrompt(
  state: AppDatabaseState,
  userPrompt: string,
  targetDate?: string,
  history?: ChatHistoryTurn[]
): SuggestedScheduleAction[] {
  const todayStr = targetDate ?? getLocalTodayDateString();
  const normalized = userPrompt.toLowerCase();

  // Nếu là câu yêu cầu tạo mục tiêu thuần túy (không yêu cầu xếp giờ học), không ép sinh lịch lẻ
  if (
    parseCustomGoalFromPrompt(userPrompt, todayStr).length > 0 &&
    !/(?:lúc|khung\s+giờ|\d{1,2}(?::|h)\d{0,2}|tối\s+nay|sáng\s+mai|chiều\s+nay)/i.test(
      userPrompt
    )
  ) {
    return [];
  }

  const eventType = inferScheduleTypeFromPrompt(normalized);
  const matchedGoal = resolveGoalFromPromptOrHistory(state, userPrompt, history);
  const analysis = analyzeStudentProgress(state, todayStr);
  const fallbackGoal = matchedGoal ?? analysis.topPriorityGoal?.goal;

  const { dates, isMultiDay, isExplicitDateOrOffset } =
    resolveTargetDatesFromPrompt(userPrompt, todayStr);

  const customActions: SuggestedScheduleAction[] = [];

  // 1. Bắt các khoảng giờ cụ thể trong tin nhắn: VD "19:00 - 20:00", "20h - 21h30", "8h30 đến 9h30"
  const rangeRegex =
    /\b(\d{1,2})(?::|h)(\d{2})?\s*(?:-|–|đến|tới|->)\s*(\d{1,2})(?::|h)(\d{2})?\b/gi;
  const parsedRanges: Array<{ startTime: string; endTime: string }> = [];
  let match: RegExpExecArray | null;
  while ((match = rangeRegex.exec(userPrompt)) !== null) {
    const sh = Number(match[1]);
    const sm = Number(match[2] ?? "0");
    const eh = Number(match[3]);
    const em = Number(match[4] ?? "0");
    if (
      sh >= 0 &&
      sh <= 23 &&
      sm >= 0 &&
      sm <= 59 &&
      eh >= 0 &&
      eh <= 23 &&
      em >= 0 &&
      em <= 59
    ) {
      const startMins = sh * 60 + sm;
      const endMins = eh * 60 + em;
      if (endMins > startMins) {
        parsedRanges.push({
          startTime: formatHHMM(startMins),
          endTime: formatHHMM(endMins),
        });
      }
    }
  }

  // 2. Nếu người dùng chỉ nói giờ bắt đầu: VD "lúc 20:00", "vào 19h30", "từ 21h"
  if (parsedRanges.length === 0) {
    const singleTimeMatch =
      /(?:lúc|vào|từ|sang)\s+(\d{1,2})(?::|h)(\d{2})?(?!\s*(?:-|–|đến|tới|->|\d|\s*ngày|\s*giờ|\s*tiếng))/i.exec(
        userPrompt
      );
    if (singleTimeMatch) {
      const sh = Number(singleTimeMatch[1]);
      const sm = Number(singleTimeMatch[2] ?? "0");
      if (sh >= 0 && sh <= 23 && sm >= 0 && sm <= 59) {
        const startMins = sh * 60 + sm;
        const duration = eventType === "exercise" ? 15 : 50;
        parsedRanges.push({
          startTime: formatHHMM(startMins),
          endTime: formatHHMM(startMins + duration),
        });
      }
    }
  }

  const planTitle = extractCustomPlanTitle(userPrompt, fallbackGoal, eventType);

  if (parsedRanges.length > 0) {
    for (const dStr of dates) {
      for (const r of parsedRanges) {
        customActions.push({
          title: planTitle,
          date: dStr,
          startTime: r.startTime,
          endTime: r.endTime,
          type: eventType,
          goalId: fallbackGoal?.id,
        });
      }
    }
    return customActions.slice(0, 7);
  }

  // 3. Nếu người dùng yêu cầu lập kế hoạch theo buổi ("tối nay", "sáng mai", "chiều nay") hoặc "lộ trình N ngày tới" mà không gõ số giờ cụ thể
  const requestedPeriod = detectRequestedPeriod(normalized);
  const hasPlanningIntent =
    /(?:kế\s+hoạch|lộ\s+trình|xếp\s+lịch|lên\s+lịch|tạo\s+lịch|thêm\s+lịch|đổi\s+lịch|đổi\s+sang|chuyển\s+sang)/i.test(
      userPrompt
    );

  if (
    isMultiDay ||
    (requestedPeriod && (hasPlanningIntent || matchedGoal !== undefined)) ||
    (isExplicitDateOrOffset && hasPlanningIntent)
  ) {
    for (const dStr of dates) {
      const eventsOnDate = state.scheduleEvents.filter((e) => e.date === dStr);
      const periodCandidates = CANDIDATE_SLOTS.filter((slot) => {
        if (eventType === "exercise") return slot.period === "exercise";
        if (requestedPeriod) return slot.period === requestedPeriod;
        return slot.period !== "exercise";
      });

      const freeSlot =
        periodCandidates.find(
          (slot) =>
            !eventsOnDate.some((evt) =>
              isSlotOverlapping(
                slot.startTime,
                slot.endTime,
                evt.startTime,
                evt.endTime
              )
            )
        ) ?? periodCandidates[0];

      if (freeSlot) {
        customActions.push({
          title: planTitle,
          date: dStr,
          startTime: freeSlot.startTime,
          endTime: freeSlot.endTime,
          type: eventType,
          goalId: fallbackGoal?.id,
        });
      }
    }
  }

  return customActions.slice(0, 7);
}

/**
 * Kiểm tra xem câu hỏi có cần đính kèm thẻ gợi ý lịch trình hay không
 * Chỉ đính kèm khi câu hỏi thực sự có ý định về lịch trình, kế hoạch, mục tiêu, tiến độ hoặc kỷ luật Pomodoro.
 */
export function shouldAttachScheduleSuggestions(
  userPrompt: string,
  customActions: SuggestedScheduleAction[]
): boolean {
  if (customActions.length > 0) return true;
  const normalized = userPrompt.toLowerCase();

  // Không đính kèm lịch khi người dùng chỉ hỏi phương pháp học / lý thuyết
  const isPureMethodologyQuestion =
    (normalized.includes("phương pháp") ||
      normalized.includes("cách học") ||
      normalized.includes("active recall") ||
      normalized.includes("feynman") ||
      normalized.includes("spaced repetition") ||
      normalized.includes("là gì")) &&
    !normalized.includes("lịch") &&
    !normalized.includes("khung giờ") &&
    !normalized.includes("kế hoạch") &&
    !normalized.includes("định mức");

  if (isPureMethodologyQuestion) return false;

  // Chỉ đính kèm thẻ lịch khi có từ khóa liên quan tới lịch trình, mục tiêu, tiến độ, Pomodoro hoặc giải cứu deadline
  const scheduleOrProgressKeywords = [
    "lịch",
    "khung giờ",
    "kế hoạch",
    "lộ trình",
    "mục tiêu",
    "tiến độ",
    "định mức",
    "đánh giá",
    "đề xuất",
    "gợi ý",
    "hôm nay",
    "ngày mai",
    "buổi tối",
    "buổi sáng",
    "buổi chiều",
    "tối nay",
    "sáng mai",
    "chiều nay",
    "pomodoro",
    "25/5",
    "50/15",
    "buồn ngủ",
    "mất tập trung",
    "xao nhãng",
    "bị phạt",
    "gấp",
    "trễ",
    "quá hạn",
    "nguy hiểm",
    "cứu",
    "ưu tiên",
  ];

  return scheduleOrProgressKeywords.some((kw) => normalized.includes(kw));
}

/**
 * Kết hợp kế hoạch tùy chỉnh do người dùng yêu cầu trong khung chat với gợi ý thông minh không trùng lịch
 */
export function buildContextualScheduleSuggestions(
  state: AppDatabaseState,
  userPrompt: string,
  targetDate?: string,
  history?: ChatHistoryTurn[]
): SuggestedScheduleAction[] {
  const dateStr = targetDate ?? getLocalTodayDateString();
  const customActions = parseCustomScheduleFromPrompt(
    state,
    userPrompt,
    dateStr,
    history
  );

  if (!shouldAttachScheduleSuggestions(userPrompt, customActions)) {
    return [];
  }

  // Nếu người dùng đã yêu cầu lộ trình nhiều ngày (>= 2 buổi) hoặc yêu cầu đúng khung giờ cụ thể, ưu tiên hiển thị chính xác kế hoạch đó
  if (customActions.length >= 2) {
    return customActions;
  }

  const smartSuggestions = generateSmartScheduleSuggestions(state, dateStr);

  if (customActions.length === 1) {
    const onlyCustom = customActions[0];
    // Nếu kế hoạch người dùng yêu cầu là cho ngày khác (VD: ngày mai), trả về đúng kế hoạch đó
    if (onlyCustom.date !== dateStr) {
      return customActions;
    }
    const nonOverlappingSmart = smartSuggestions.filter(
      (smart) =>
        !isSlotOverlapping(
          onlyCustom.startTime,
          onlyCustom.endTime,
          smart.startTime,
          smart.endTime
        )
    );
    return [onlyCustom, ...nonOverlappingSmart].slice(0, 3);
  }

  return smartSuggestions;
}

export function formatFriendlyDateLabel(
  dateStr: string,
  todayStr?: string
): string {
  const baseToday = todayStr ?? getLocalTodayDateString();
  if (dateStr === baseToday) return `Hôm nay (${dateStr})`;
  if (dateStr === addDaysToDateString(baseToday, 1)) {
    return `Ngày mai (${dateStr})`;
  }
  if (dateStr === addDaysToDateString(baseToday, 2)) {
    return `Ngày kia (${dateStr})`;
  }
  return `Ngày ${dateStr}`;
}

/**
 * Tạo phản hồi tư vấn của Cố vấn AI Mentor (chạy tức thì, miễn phí 100%, bám sát dữ liệu thực tế & nhớ ngữ cảnh)
 */
export function generateMentorResponse(
  state: AppDatabaseState,
  userPrompt: string,
  referenceDateStr?: string,
  history?: ChatHistoryTurn[]
): AIMessage {
  const todayStr = referenceDateStr ?? getLocalTodayDateString();
  const analysis = analyzeStudentProgress(state, todayStr);
  const customGoals = parseCustomGoalFromPrompt(userPrompt, todayStr);
  const customActions = parseCustomScheduleFromPrompt(
    state,
    userPrompt,
    todayStr,
    history
  );
  const suggestions = buildContextualScheduleSuggestions(
    state,
    userPrompt,
    todayStr,
    history
  );
  const normalized = userPrompt.toLowerCase();

  const top = analysis.topPriorityGoal;
  const { habits } = analysis;
  let content = "";

  // KỊCH BẢN 1: Người dùng yêu cầu khởi tạo Mục tiêu mới ngay trong khung chat
  if (customGoals.length > 0) {
    const g = customGoals[0];
    const dayInfo = getDaysRemainingInfo(g.deadline, todayStr);
    const effectiveDays = Math.max(1, dayInfo.days > 0 ? dayInfo.days : 1);
    const minsPerDay = Math.ceil((g.targetHours * 60) / effectiveDays);
    const pomo50 = Math.max(1, Math.ceil(minsPerDay / 50));
    const pomo25 = Math.max(1, Math.ceil(minsPerDay / 25));

    content =
      `Thầy/Cô đã thiết lập sẵn thẻ mục tiêu mới theo yêu cầu của cậu:\n` +
      `• **Tên mục tiêu:** ${g.title}\n` +
      `• **Quỹ thời gian cần đạt:** ${g.targetHours} giờ • **Hạn hoàn thành:** ${g.deadline} (${dayInfo.label})\n` +
      `• **Định mức đề xuất:** Khoảng **${minsPerDay} phút/ngày** (tương đương **${pomo50} phiên 50/15** hoặc **${pomo25} phiên 25/5** mỗi ngày).\n\n` +
      `Cậu hãy bấm nút **"+ Tạo mục tiêu này"** ngay bên dưới tin nhắn để lưu vào hệ thống nhé!`;
  }
  // KỊCH BẢN 2: Người dùng yêu cầu tạo/điều chỉnh kế hoạch học tập theo giờ, theo buổi hoặc lộ trình nhiều ngày
  else if (customActions.length > 0) {
    const planLines = customActions
      .map(
        (act) =>
          `• **${formatFriendlyDateLabel(act.date, todayStr)} | ${
            act.startTime
          } - ${act.endTime}**: ${act.title} (${
            act.type === "study"
              ? "Học tập"
              : act.type === "exercise"
              ? "Vận động"
              : "Ôn tập"
          })`
      )
      .join("\n");

    content =
      `Thầy/Cô đã tạo kế hoạch học tập trực tiếp theo yêu cầu của cậu:\n${planLines}\n\n` +
      (customActions.length > 1
        ? `Cậu có thể bấm **"Áp dụng tất cả (${customActions.length} buổi)"** hoặc chọn từng khung giờ ngay bên dưới tin nhắn này để thêm vào Lịch trình nhé!`
        : `Cậu có thể bấm nút **"+ Áp dụng vào lịch"** ngay bên dưới tin nhắn này để lưu trực tiếp vào Lịch trình nhé!`);
  }
  // KỊCH BẢN 3: Tư vấn phương pháp học tập chuyên sâu (Active Recall, Feynman, Spaced Repetition)
  else if (
    normalized.includes("phương pháp") ||
    normalized.includes("cách học") ||
    normalized.includes("active recall") ||
    normalized.includes("feynman") ||
    normalized.includes("spaced repetition") ||
    normalized.includes("nhớ lâu")
  ) {
    const focusGoal =
      resolveGoalFromPromptOrHistory(state, userPrompt, history) ??
      top?.goal;
    content =
      `Để học sâu và nhớ lâu cho mục tiêu **${
        focusGoal?.title ?? "trọng tâm của cậu"
      }**, Thầy/Cô gợi ý phác đồ 3 bước kết hợp Pomodoro:\n` +
      `• **Bước 1 — Deep Work 50/15 & Kỹ thuật Feynman:** Trong 40 phút đầu, hãy học lý thuyết/giải bài rồi tự giảng lại khái niệm bằng ngôn ngữ của chính cậu ra giấy nháp.\n` +
      `• **Bước 2 — Active Recall (Chủ động truy xuất):** 10 phút cuối ca Pomodoro, gấp tài liệu lại và tự viết ra 3 ý cốt lõi hoặc tự giải lại 1 bài tập không nhìn đáp án.\n` +
      `• **Bước 3 — Spaced Repetition (Lặp lại ngắt quãng):** Đặt thêm 1 phiên Ôn tập ngắn 25/5 vào tối hôm sau để củng cố trí nhớ dài hạn.`;
  }
  // KỊCH BẢN 4: Chẩn đoán lỗi mất tập trung, buồn ngủ, bị phạt kỷ luật Webcam & chọn Pomodoro
  else if (
    normalized.includes("buồn ngủ") ||
    normalized.includes("mất tập trung") ||
    normalized.includes("xao nhãng") ||
    normalized.includes("bị phạt") ||
    normalized.includes("pomodoro") ||
    normalized.includes("25/5") ||
    normalized.includes("50/15")
  ) {
    const habitNotes: string[] = [];
    if (habits.penalizedSessionsCount > 0) {
      habitNotes.push(
        `cậu từng có **${habits.penalizedSessionsCount} phiên bị phạt 0 phút** (${
          habits.latestPenaltyReason ?? "do vi phạm ngưỡng tập trung"
        })`
      );
    }
    if (habits.totalDrowsinessAlerts > 0) {
      habitNotes.push(
        `Webcam đã phát hiện **${habits.totalDrowsinessAlerts} lần cảnh báo gục đầu/buồn ngủ**`
      );
    }
    const habitSummary =
      habitNotes.length > 0
        ? `Qua nhật ký Phòng Kỷ luật, Thầy/Cô nhận thấy ${habitNotes.join(" và ")}. `
        : "";

    content =
      `Thầy/Cô đã phân tích dữ liệu phiên học của cậu (điểm tập trung trung bình đạt **${analysis.averageFocusScore}%**, tổng **${analysis.totalFocusMinutes} phút** đã rèn luyện, **${analysis.totalDistractions} lần** xao nhãng). ${habitSummary}\n` +
      `Phác đồ khắc phục để giữ kỷ luật tốt nhất:\n` +
      `• **Ban ngày (Sáng/Chiều):** Chọn chu kỳ **Deep Work 50/15** cho mục tiêu "${
        top?.goal.title ?? "trọng tâm"
      }" khi não bộ tỉnh táo nhất, sau đó dành 15 phút đứng dậy tập **Giơ tay qua đầu** trước Webcam.\n` +
      `• **Buổi tối (sau 20h00) hoặc khi mệt:** Chuyển ngay sang chu kỳ **Pomodoro Chuẩn 25/5** kết hợp bật Giám sát Ngồi học để tránh gục đầu quá ngưỡng bị phạt 0 phút.`;
  }
  // KỊCH BẢN 5: Giải cứu mục tiêu gấp / sắp trễ hạn (Deadline Rescue)
  else if (
    normalized.includes("gấp") ||
    normalized.includes("trễ") ||
    normalized.includes("quá hạn") ||
    normalized.includes("nguy hiểm") ||
    normalized.includes("cứu") ||
    normalized.includes("ưu tiên")
  ) {
    if (top) {
      content =
        `Mục tiêu cần ưu tiên giải cứu số 1 của cậu hiện tại là **"${top.goal.title}"** (${top.daysLabel}, còn thiếu **${formatHoursAndMinutes(
          top.remainingHours
        )}**):\n` +
        `• **Định mức bắt buộc:** Cần hoàn thành tối thiểu **${top.recommendedMinutesPerDay} phút/ngày** (tương đương **${top.recommendedPomodoro50Count} phiên 50/15** hoặc **${top.recommendedPomodoro25Count} phiên 25/5**).\n` +
        `• **Chiến thuật:** Hãy khóa ngay khung giờ sáng hoặc đầu giờ chiều cho mục tiêu này trước khi làm việc khác. Thầy/Cô đã lọc sẵn các khung giờ trống không trùng lịch ngay bên dưới để cậu áp dụng ngay!`;
    } else {
      content =
        "Hiện tại cậu chưa có mục tiêu nào bị quá hạn hoặc báo động đỏ. Hãy tiếp tục duy trì nhịp độ học tập đều đặn nhé!";
    }
  }
  // KỊCH BẢN 6: Đề xuất lịch trình & khung giờ trống hôm nay
  else if (
    normalized.includes("lịch") ||
    normalized.includes("khung giờ") ||
    normalized.includes("kế hoạch") ||
    normalized.includes("hôm nay")
  ) {
    content =
      `Dựa trên thời gian biểu ngày ${todayStr} (cậu đã hoàn thành **${analysis.completedEventsCount}/${analysis.totalEventsCount} buổi**), ` +
      `mình đã quét các khoảng thời gian rảnh và thiết kế **${suggestions.length} buổi học & vận động** bên dưới để cậu không bị trùng lịch. ` +
      (top
        ? `Ưu tiên số 1 hiện tại là **"${top.goal.title}"** (${top.daysLabel}, cần trung bình **${top.recommendedMinutesPerDay} phút/ngày** ~ ${top.recommendedPomodoro25Count} phiên Pomodoro 25p).`
        : "Cậu có thể bấm nút 'Áp dụng vào lịch' ngay bên dưới để chèn tự động nhé!");
  }
  // KỊCH BẢN 7: Đánh giá tổng quan tiến độ + chẩn đoán kỷ luật toàn diện
  else {
    const goalSummaries = analysis.diagnostics
      .map(
        (d) =>
          `• **${d.goal.title}**: Đã tích lũy ${formatHoursAndMinutes(
            d.goal.completedHours
          )}/${d.goal.targetHours} giờ (${d.goal.progressPercent}%) — ${
            d.daysLabel
          } → Cần duy trì **${
            d.recommendedMinutesPerDay
          } phút/ngày** (${
            d.recommendedPomodoro50Count
          } phiên 50/15 hoặc ${d.recommendedPomodoro25Count} phiên 25/5).`
      )
      .join("\n");

    const disciplineBullet =
      habits.penalizedSessionsCount > 0 || habits.totalDrowsinessAlerts > 0
        ? `\n• **Lưu ý Kỷ luật Webcam:** Ghi nhận ${habits.penalizedSessionsCount} phiên bị phạt và ${habits.totalDrowsinessAlerts} cảnh báo buồn ngủ — cậu nên chia nhỏ ca tối thành Pomodoro 25/5.`
        : habits.needsMoreExerciseBreak
        ? `\n• **Lưu ý Sức khỏe:** Cậu đã học ${habits.studySessionsCount} phiên nhưng chưa có phiên vận động giải lao — hãy xen kẽ bài tập Giơ tay qua đầu nhé!`
        : "";

    content =
      `Đánh giá tổng quan lộ trình & kỷ luật của cậu hôm nay:\n${goalSummaries}${disciplineBullet}\n\n` +
      (top
        ? `**Lời khuyên trọng tâm:** Hãy ưu tiên giải quyết **"${top.goal.title}"** trước vì mục tiêu này cần **${top.recommendedMinutesPerDay} phút học mỗi ngày**. Mình đã đề xuất sẵn các khung giờ trống ngay bên dưới để cậu bấm áp dụng vào lịch trình!`
        : `Tất cả mục tiêu của cậu đều đang đi đúng hướng! Hãy duy trì nhịp độ học kết hợp vận động Webcam nhé.`);
  }

  return {
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    role: "assistant",
    content,
    createdAt: new Date().toISOString(),
    suggestedActions: suggestions,
    ...(customGoals.length > 0 ? { suggestedGoals: customGoals } : {}),
    source: "fallback",
  };
}
