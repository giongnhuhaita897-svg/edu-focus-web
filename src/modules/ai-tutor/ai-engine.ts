import {
  formatHoursAndMinutes,
  getDaysRemainingInfo,
} from "@/lib/storage/local-db";
import {
  AIMessage,
  AppDatabaseState,
  Goal,
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
  const suggestions = generateSmartScheduleSuggestions(state, todayStr);
  const normalized = userPrompt.toLowerCase();

  const top = analysis.topPriorityGoal;
  let content = "";

  if (
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
