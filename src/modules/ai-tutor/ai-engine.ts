import {
  formatHoursAndMinutes,
  getDaysRemainingInfo,
} from "@/lib/storage/local-db";
import {
  AIMessage,
  AppDatabaseState,
  Goal,
  ScheduleEventType,
  SuggestedScheduleAction,
} from "@/types/database";

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

export interface StudentProgressAnalysis {
  diagnostics: GoalDiagnostic[];
  topPriorityGoal: GoalDiagnostic | null;
  totalFocusMinutes: number;
  averageFocusScore: number;
  totalDistractions: number;
  completedEventsCount: number;
  totalEventsCount: number;
}

export function analyzeStudentProgress(
  state: AppDatabaseState,
  referenceDateStr?: string
): StudentProgressAnalysis {
  const todayStr = referenceDateStr ?? new Date().toISOString().slice(0, 10);

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

  return {
    diagnostics,
    topPriorityGoal: activeDiagnostics[0] ?? null,
    totalFocusMinutes,
    averageFocusScore,
    totalDistractions,
    completedEventsCount,
    totalEventsCount: state.scheduleEvents.length,
  };
}

const CANDIDATE_SLOTS = [
  { startTime: "08:00", endTime: "08:50", period: "morning" },
  { startTime: "10:00", endTime: "10:50", period: "morning" },
  { startTime: "15:15", endTime: "16:05", period: "afternoon" },
  { startTime: "16:10", endTime: "16:25", period: "exercise" },
  { startTime: "17:00", endTime: "17:50", period: "afternoon" },
  { startTime: "21:15", endTime: "22:05", period: "evening" },
];

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function isSlotOverlapping(
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
  const dateStr = targetDate ?? new Date().toISOString().slice(0, 10);
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

function findMatchingGoal(state: AppDatabaseState, prompt: string): Goal | undefined {
  const normalized = prompt.toLowerCase();
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
    .replace(
      /^(?:hãy\s+)?(?:tạo|lập|lên|thêm|xếp|đặt)\s+(?:cho\s+(?:tớ|mình|em)\s+)?(?:kế\s+hoạch|lịch\s+trình|lịch|khung\s+giờ)\s*/i,
      ""
    )
    .replace(/\b(?:hôm\s+nay|tối\s+nay|chiều\s+nay|sáng\s+nay|nhé|giúp\s+tớ|giúp\s+mình)\b/gi, "")
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
 * Trích xuất kế hoạch học tập trực tiếp từ yêu cầu trong khung chat của người dùng
 * (hỗ trợ giờ cụ thể như "19:00 - 20:00", "20h - 21h30", "lúc 20h" hoặc yêu cầu tạo kế hoạch theo môn/buổi)
 */
export function parseCustomScheduleFromPrompt(
  state: AppDatabaseState,
  userPrompt: string,
  targetDate?: string
): SuggestedScheduleAction[] {
  const dateStr = targetDate ?? new Date().toISOString().slice(0, 10);
  const normalized = userPrompt.toLowerCase();
  const eventType = inferScheduleTypeFromPrompt(normalized);
  const matchedGoal = findMatchingGoal(state, userPrompt);
  const analysis = analyzeStudentProgress(state, dateStr);
  const fallbackGoal = matchedGoal ?? analysis.topPriorityGoal?.goal;

  const customActions: SuggestedScheduleAction[] = [];

  // 1. Bắt các khoảng giờ cụ thể trong tin nhắn: VD "19:00 - 20:00", "20h - 21h30", "8h30 đến 9h30"
  const rangeRegex =
    /\b(\d{1,2})(?::|h)(\d{2})?\s*(?:-|–|đến|tới|->)\s*(\d{1,2})(?::|h)(\d{2})?\b/gi;
  let match: RegExpExecArray | null;
  while ((match = rangeRegex.exec(userPrompt)) !== null) {
    const sh = Number(match[1]);
    const sm = Number(match[2] ?? "0");
    const eh = Number(match[3]);
    const em = Number(match[4] ?? "0");
    if (sh >= 0 && sh <= 23 && sm >= 0 && sm <= 59 && eh >= 0 && eh <= 23 && em >= 0 && em <= 59) {
      const startMins = sh * 60 + sm;
      const endMins = eh * 60 + em;
      if (endMins > startMins) {
        customActions.push({
          title: extractCustomPlanTitle(userPrompt, fallbackGoal, eventType),
          date: dateStr,
          startTime: formatHHMM(startMins),
          endTime: formatHHMM(endMins),
          type: eventType,
          goalId: fallbackGoal?.id,
        });
      }
    }
  }

  // 2. Nếu người dùng chỉ nói giờ bắt đầu: VD "lúc 20:00", "vào 19h30", "từ 21h"
  if (customActions.length === 0) {
    const singleTimeMatch =
      /(?:lúc|vào|từ)\s+(\d{1,2})(?::|h)(\d{2})?(?!\s*(?:-|–|đến|tới|->|\d))/i.exec(
        userPrompt
      );
    if (singleTimeMatch) {
      const sh = Number(singleTimeMatch[1]);
      const sm = Number(singleTimeMatch[2] ?? "0");
      if (sh >= 0 && sh <= 23 && sm >= 0 && sm <= 59) {
        const startMins = sh * 60 + sm;
        const duration = eventType === "exercise" ? 15 : 50;
        customActions.push({
          title: extractCustomPlanTitle(userPrompt, fallbackGoal, eventType),
          date: dateStr,
          startTime: formatHHMM(startMins),
          endTime: formatHHMM(startMins + duration),
          type: eventType,
          goalId: fallbackGoal?.id,
        });
      }
    }
  }

  return customActions;
}

/**
 * Kết hợp kế hoạch tùy chỉnh do người dùng yêu cầu trong khung chat với gợi ý thông minh không trùng lịch
 */
export function buildContextualScheduleSuggestions(
  state: AppDatabaseState,
  userPrompt: string,
  targetDate?: string
): SuggestedScheduleAction[] {
  const dateStr = targetDate ?? new Date().toISOString().slice(0, 10);
  const customActions = parseCustomScheduleFromPrompt(state, userPrompt, dateStr);
  const smartSuggestions = generateSmartScheduleSuggestions(state, dateStr);

  if (customActions.length > 0) {
    const nonOverlappingSmart = smartSuggestions.filter(
      (smart) =>
        !customActions.some((custom) =>
          isSlotOverlapping(
            custom.startTime,
            custom.endTime,
            smart.startTime,
            smart.endTime
          )
        )
    );
    return [...customActions, ...nonOverlappingSmart].slice(0, 3);
  }

  return smartSuggestions;
}

/**
 * Tạo phản hồi tư vấn của Cố vấn AI Mentor (chạy tức thì, miễn phí 100%, bám sát dữ liệu thực tế)
 */
export function generateMentorResponse(
  state: AppDatabaseState,
  userPrompt: string,
  referenceDateStr?: string
): AIMessage {
  const todayStr = referenceDateStr ?? new Date().toISOString().slice(0, 10);
  const analysis = analyzeStudentProgress(state, todayStr);
  const customActions = parseCustomScheduleFromPrompt(state, userPrompt, todayStr);
  const suggestions = buildContextualScheduleSuggestions(state, userPrompt, todayStr);
  const normalized = userPrompt.toLowerCase();

  const top = analysis.topPriorityGoal;
  let content = "";

  if (customActions.length > 0) {
    const planLines = customActions
      .map(
        (act) =>
          `• **${act.startTime} - ${act.endTime}**: ${act.title} (${
            act.type === "study"
              ? "Học tập"
              : act.type === "exercise"
              ? "Vận động"
              : "Ôn tập"
          })`
      )
      .join("\n");
    content =
      `Thầy/Cô đã tạo kế hoạch học tập trực tiếp theo yêu cầu của cậu trong ngày ${todayStr}:\n${planLines}\n\n` +
      `Cậu có thể bấm nút **"+ Áp dụng vào lịch"** ngay bên dưới tin nhắn này để lưu trực tiếp vào Lịch trình nhé!`;
  } else if (
    normalized.includes("buồn ngủ") ||
    normalized.includes("mất tập trung") ||
    normalized.includes("pomodoro") ||
    normalized.includes("25/5") ||
    normalized.includes("50/15")
  ) {
    content =
      `Thầy/Cô đã xem dữ liệu phiên học của cậu (điểm tập trung trung bình hiện đạt ${analysis.averageFocusScore}%, tổng ${analysis.totalFocusMinutes} phút đã rèn luyện). ` +
      `Để tránh buồn ngủ và giữ kỷ luật tốt nhất:\n` +
      `• Ban ngày (Sáng/Chiều): Nên chọn chu kỳ Deep Work 50/15 cho mục tiêu "${
        top?.goal.title ?? "trọng tâm"
      }" để đào sâu kiến thức, sau đó dành 15 phút nghỉ đứng dậy tập Giơ tay qua đầu trước Webcam.\n` +
      `• Buổi tối (sau 20h00): Nên chuyển sang chu kỳ Pomodoro Chuẩn 25/5 kết hợp bật tab Giám sát Ngồi học & Phát hiện Gục đầu để giữ tỉnh táo, cứ 25 phút lại vươn vai 5 phút.`;
  } else if (
    normalized.includes("lịch") ||
    normalized.includes("khung giờ") ||
    normalized.includes("kế hoạch") ||
    normalized.includes("hôm nay")
  ) {
    content =
      `Dựa trên thời gian biểu ngày ${todayStr} (cậu đã hoàn thành ${analysis.completedEventsCount}/${analysis.totalEventsCount} buổi), ` +
      `mình đã tìm các khung giờ còn trống và thiết kế ${suggestions.length} buổi học & vận động bên dưới để cậu không bị trùng lịch. ` +
      (top
        ? `Ưu tiên số 1 hiện tại là "${top.goal.title}" (${top.daysLabel}, cần trung bình ${top.recommendedMinutesPerDay} phút/ngày ~ ${top.recommendedPomodoro25Count} phiên Pomodoro 25p).`
        : "Cậu có thể bấm nút 'Áp dụng vào lịch' ngay bên dưới để chèn tự động nhé!");
  } else {
    const goalSummaries = analysis.diagnostics
      .map(
        (d) =>
          `• ${d.goal.title}: Đã tích lũy ${formatHoursAndMinutes(
            d.goal.completedHours
          )}/${d.goal.targetHours} giờ (${d.goal.progressPercent}%) — ${
            d.daysLabel
          } → Cần duy trì khoảng ${
            d.recommendedMinutesPerDay
          } phút/ngày (tương đương ${
            d.recommendedPomodoro50Count
          } phiên 50/15 hoặc ${d.recommendedPomodoro25Count} phiên 25/5).`
      )
      .join("\n");

    content =
      `Đánh giá tổng quan lộ trình của cậu hôm nay:\n${goalSummaries}\n\n` +
      (top
        ? `Lời khuyên trọng tâm: Hãy ưu tiên giải quyết "${top.goal.title}" trước vì mục tiêu này cần ${top.recommendedMinutesPerDay} phút học mỗi ngày. Mình đã đề xuất sẵn các khung giờ trống ngay bên dưới để cậu bấm áp dụng vào lịch trình!`
        : `Tất cả mục tiêu của cậu đều đang đi đúng hướng! Hãy duy trì nhịp độ học kết hợp vận động Webcam nhé.`);
  }

  return {
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    role: "assistant",
    content,
    createdAt: new Date().toISOString(),
    suggestedActions: suggestions,
  };
}
