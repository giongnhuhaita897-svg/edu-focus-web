import { AppDatabaseState, GoalCategory } from "@/types/database";
import { analyzeStudentProgress } from "@/modules/ai-tutor/ai-engine";

export type OrientationGoalId =
  | "academic_achievement"
  | "make_money"
  | "social_relationships"
  | "personal_branding"
  | "health"
  | "peace_of_mind";

export type OrientationPace = "auto" | "light" | "balanced" | "intensive";

export type BudgetTierId = "light" | "balanced" | "intensive";

export type AllocationCadence = "daily" | "alternate_days";

export interface OrientationGoalPreset {
  id: OrientationGoalId;
  title: string;
  shortTitle: string;
  description: string;
  examples: string[];
  mappedCategory: GoalCategory;
  defaultCalendarGoalTitle: string;
  defaultSlot: "Sáng (07:30–11:30)" | "Chiều (14:00–17:30)" | "Tối (19:30–22:00)" | "Linh hoạt giữa các ca";
  defaultActionTip: string;
  accentBg: string;
  accentBar: string;
  accentText: string;
  accentBorder: string;
}

export interface OrientationAllocationItem {
  goalId: OrientationGoalId;
  title: string;
  shortTitle: string;
  rank: number; // 1-based
  isTopPriority: boolean; // rank 1 or 2
  minutesPerDay: number;
  hoursPerDay: number;
  sharePercent: number;
  cadence: AllocationCadence;
  cadenceLabel: string;
  recommendedPomodoroLabel: string;
  pomodoro25Count: number;
  pomodoro50Count: number;
  mappedCategory: GoalCategory;
  defaultCalendarGoalTitle: string;
  defaultSlot: OrientationGoalPreset["defaultSlot"];
  defaultActionTip: string;
}

export interface OrientationBudgetPlan {
  totalHours: number;
  totalMinutes: number;
  tier: BudgetTierId;
  tierLabel: string;
  ratioMultiplier: number; // 1.5 | 2 | 3
  ratioLabel: string;
  allocations: OrientationAllocationItem[];
  hasOverloadWarning: boolean;
  overloadWarningText: string | null;
  hasBurnoutWarning: boolean;
  burnoutWarningText: string | null;
}

export interface OrientationPillarTip {
  goalId: OrientationGoalId;
  suggestedSlot: string;
  tip: string;
}

export interface OrientationAIAdvice {
  summary: string;
  ratioExplanation: string;
  warnings: string[];
  pillarTips: OrientationPillarTip[];
  nextStepHint: string;
  source: "gemini" | "fallback";
}

export interface OrientationProfile {
  rankedGoalIds: OrientationGoalId[];
  pace: OrientationPace;
  dailyHours: number;
  plan: OrientationBudgetPlan;
  advice: OrientationAIAdvice;
  confirmedAt: string;
}

export const MIN_DAILY_HOURS = 2;
export const MAX_DAILY_HOURS = 10;
export const DEFAULT_DAILY_TARGET_MINUTES = 120;

export const ORIENTATION_GOAL_PRESETS: OrientationGoalPreset[] = [
  {
    id: "academic_achievement",
    title: "Thành tích học tập",
    shortTitle: "Học tập",
    description:
      "Nâng GPA, nắm chắc môn chuyên ngành, ôn thi cuối kỳ và đạt các chứng chỉ học thuật.",
    examples: ["Ôn thi đại học / cuối kỳ", "IELTS / Ngoại ngữ", "Đồ án chuyên ngành"],
    mappedCategory: "academic",
    defaultCalendarGoalTitle: "Đột phá thành tích học tập & điểm số",
    defaultSlot: "Sáng (07:30–11:30)",
    defaultActionTip:
      "Khóa khung giờ tỉnh táo nhất trong ngày để chạy Deep Work 50/15 giải bài tập và tự kiểm tra Active Recall.",
    accentBg: "bg-blue-50",
    accentBar: "bg-blue-600",
    accentText: "text-blue-700",
    accentBorder: "border-blue-200",
  },
  {
    id: "make_money",
    title: "Kiếm tiền",
    shortTitle: "Kiếm tiền",
    description:
      "Tạo nguồn thu nhập từ freelance, thực tập, dự án thực chiến và rèn kỹ năng nghề giá trị cao.",
    examples: ["Nhận job freelance", "Thực tập / việc làm thêm", "Rèn kỹ năng sinh lời"],
    mappedCategory: "skill",
    defaultCalendarGoalTitle: "Phát triển kỹ năng nghề & tạo nguồn thu nhập",
    defaultSlot: "Chiều (14:00–17:30)",
    defaultActionTip:
      "Tập trung làm sản phẩm thật, rèn kỹ năng có nhu cầu thị trường và chốt mục tiêu đầu ra rõ ràng mỗi tuần.",
    accentBg: "bg-emerald-50",
    accentBar: "bg-emerald-600",
    accentText: "text-emerald-700",
    accentBorder: "border-emerald-200",
  },
  {
    id: "social_relationships",
    title: "Mối quan hệ xã hội",
    shortTitle: "Quan hệ xã hội",
    description:
      "Chủ động nuôi dưỡng kết nối với gia đình, bạn bè, mentor, CLB và nâng kỹ năng giao tiếp.",
    examples: ["Kết nối mentor / anh chị", "Sinh hoạt CLB / nhóm", "Thời gian chất lượng cùng người thân"],
    mappedCategory: "skill",
    defaultCalendarGoalTitle: "Nuôi dưỡng mối quan hệ & kỹ năng giao tiếp",
    defaultSlot: "Tối (19:30–22:00)",
    defaultActionTip:
      "Ưu tiên tương tác trực tiếp chất lượng (gọi điện, gặp mặt, thảo luận nhóm) thay vì lướt mạng xã hội thụ động.",
    accentBg: "bg-amber-50",
    accentBar: "bg-amber-500",
    accentText: "text-amber-700",
    accentBorder: "border-amber-200",
  },
  {
    id: "personal_branding",
    title: "Xây dựng thương hiệu cá nhân",
    shortTitle: "Thương hiệu cá nhân",
    description:
      "Xây dựng Portfolio, GitHub, LinkedIn và chia sẻ kiến thức để tạo uy tín năng lực riêng.",
    examples: ["Hoàn thiện Portfolio / CV", "Viết bài chia sẻ kiến thức", "Đóng góp dự án công khai"],
    mappedCategory: "skill",
    defaultCalendarGoalTitle: "Xây dựng thương hiệu cá nhân & Portfolio",
    defaultSlot: "Chiều (14:00–17:30)",
    defaultActionTip:
      "Biến chính quá trình học và làm dự án thành bài viết chia sẻ, case study hoặc sản phẩm công khai mỗi tuần.",
    accentBg: "bg-indigo-50",
    accentBar: "bg-indigo-600",
    accentText: "text-indigo-700",
    accentBorder: "border-indigo-200",
  },
  {
    id: "health",
    title: "Sức khỏe",
    shortTitle: "Sức khỏe",
    description:
      "Duy trì thể lực, vận động giãn cơ với Webcam giữa giờ học, ngủ đủ giấc và ăn uống khoa học.",
    examples: ["Tập thể dục / chạy bộ", "Giãn cơ với Phòng Kỷ luật", "Ngủ đúng giờ"],
    mappedCategory: "health",
    defaultCalendarGoalTitle: "Rèn luyện thể lực & sức khỏe bền bỉ",
    defaultSlot: "Linh hoạt giữa các ca",
    defaultActionTip:
      "Chèn bài tập giãn cơ Webcam sau mỗi ca 50/15 và giữ ít nhất 1 khung vận động thể chất cố định trong ngày.",
    accentBg: "bg-teal-50",
    accentBar: "bg-teal-600",
    accentText: "text-teal-700",
    accentBorder: "border-teal-200",
  },
  {
    id: "peace_of_mind",
    title: "Tâm trí bình yên thanh thản",
    shortTitle: "Tâm trí bình yên",
    description:
      "Giữ tâm trí sáng suốt, giảm lo âu bằng thiền thở, đọc sách nhẹ nhàng và ngắt thiết bị số.",
    examples: ["Thiền / hít thở sâu", "Viết nhật ký cuối ngày", "Đọc sách không điện thoại"],
    mappedCategory: "health",
    defaultCalendarGoalTitle: "Nuôi dưỡng tâm trí bình yên & cân bằng",
    defaultSlot: "Tối (19:30–22:00)",
    defaultActionTip:
      "Dành khoảng lặng không thông báo vào đầu sáng hoặc trước khi ngủ 30 phút để tái tạo năng lượng tinh thần.",
    accentBg: "bg-sky-50",
    accentBar: "bg-sky-500",
    accentText: "text-sky-700",
    accentBorder: "border-sky-200",
  },
];

const PRESET_MAP: Record<OrientationGoalId, OrientationGoalPreset> =
  ORIENTATION_GOAL_PRESETS.reduce((acc, item) => {
    acc[item.id] = item;
    return acc;
  }, {} as Record<OrientationGoalId, OrientationGoalPreset>);

export function isOrientationGoalId(val: unknown): val is OrientationGoalId {
  return typeof val === "string" && val in PRESET_MAP;
}

export function getOrientationPreset(
  id: OrientationGoalId
): OrientationGoalPreset {
  return PRESET_MAP[id];
}

export function clampDailyHours(hours: number): number {
  if (!Number.isFinite(hours)) return MIN_DAILY_HOURS;
  const roundedHalf = Math.round(hours * 2) / 2;
  return Math.max(MIN_DAILY_HOURS, Math.min(MAX_DAILY_HOURS, roundedHalf));
}

export function formatMinutesFriendly(totalMinutes: number): string {
  const safe = Math.max(0, Math.round(totalMinutes));
  const hrs = Math.floor(safe / 60);
  const mins = safe % 60;
  if (hrs === 0) return `${mins} phút`;
  if (mins === 0) return `${hrs} giờ`;
  return `${hrs} giờ ${mins} phút`;
}

/**
 * Xác định phân khúc quỹ thời gian và hệ số nhân giữa nhóm ưu tiên #1–#2 so với #3 trở xuống:
 * - 2–3 giờ/ngày (<= 3.5h): Top #1–#2 nhiều hơn (~1.5x) so với #3+
 * - 4–8 giờ/ngày (4h..7.5h): Top #1–#2 gấp đôi (2x) so với #3+
 * - 8–10 giờ/ngày (>= 8h): Top #1–#2 gấp 3 (3x) so với #3+
 */
export function getBudgetTierInfo(totalHours: number): {
  tier: BudgetTierId;
  tierLabel: string;
  ratioMultiplier: number;
  ratioLabel: string;
} {
  const clamped = clampDailyHours(totalHours);
  if (clamped <= 3.5) {
    return {
      tier: "light",
      tierLabel: "Mức cơ bản (2–3 tiếng/ngày)",
      ratioMultiplier: 1.5,
      ratioLabel:
        "Ưu tiên #1 & #2 nhận thời lượng nhiều hơn (~1.5x) so với mục tiêu từ #3 trở xuống",
    };
  }
  if (clamped < 8) {
    return {
      tier: "balanced",
      tierLabel: "Mức tăng tốc (4–8 tiếng/ngày)",
      ratioMultiplier: 2,
      ratioLabel:
        "Ưu tiên #1 & #2 nhận thời lượng gấp đôi (2x) so với mục tiêu từ #3 trở xuống",
    };
  }
  return {
    tier: "intensive",
    tierLabel: "Mức toàn lực (8–10 tiếng/ngày)",
    ratioMultiplier: 3,
    ratioLabel:
      "Ưu tiên #1 & #2 nhận thời lượng gấp 3 (3x) so với mục tiêu từ #3 trở xuống",
  };
}

/**
 * Đề xuất tổng quỹ thời gian ngày (2–10 tiếng) dựa trên số mục tiêu chọn,
 * nhịp độ rảnh của người dùng và dữ liệu mục tiêu thực tế hiện có.
 */
export function recommendDailyHours(
  rankedGoalIds: OrientationGoalId[],
  pace: OrientationPace = "auto",
  state?: AppDatabaseState
): number {
  const count = Math.max(1, Math.min(6, rankedGoalIds.length));

  if (pace === "light") {
    if (count === 1) return 2;
    if (count === 2) return 2.5;
    return 3;
  }

  if (pace === "balanced") {
    if (count <= 2) return 4;
    if (count === 3) return 5;
    if (count === 4) return 6;
    if (count === 5) return 7;
    return 7.5;
  }

  if (pace === "intensive") {
    if (count <= 2) return 8;
    if (count <= 4) return 9;
    return 10;
  }

  // pace === "auto": tự cân đối theo số lượng mục tiêu đã chọn
  let suggested: number;
  if (count === 1) suggested = 2.5;
  else if (count === 2) suggested = 3;
  else if (count === 3) suggested = 5;
  else if (count === 4) suggested = 6;
  else if (count === 5) suggested = 8;
  else suggested = 9;

  // Tham chiếu nhẹ khối lượng mục tiêu đang chạy ở /calendar nếu có
  if (state && state.goals.length > 0) {
    const analysis = analyzeStudentProgress(state);
    const activeDailyNeedHours =
      analysis.diagnostics.reduce(
        (sum, d) => sum + d.recommendedMinutesPerDay,
        0
      ) / 60;
    if (activeDailyNeedHours > suggested && activeDailyNeedHours <= 10) {
      suggested = clampDailyHours(
        Math.min(MAX_DAILY_HOURS, Math.max(suggested, Math.ceil(activeDailyNeedHours * 2) / 2))
      );
    }
  }

  return clampDailyHours(suggested);
}

function distributeMinutesMonotonically(
  rawWeights: number[],
  totalMinutes: number
): number[] {
  const sumWeights = rawWeights.reduce((s, w) => s + w, 0);
  if (rawWeights.length === 0 || sumWeights <= 0) return [];

  const step = 5;
  const rounded = rawWeights.map((w) =>
    Math.max(step, Math.round(((w / sumWeights) * totalMinutes) / step) * step)
  );

  let diff = totalMinutes - rounded.reduce((s, m) => s + m, 0);

  // Điều chỉnh phần dư theo từng bước 5 phút để tổng khớp tuyệt đối với totalMinutes
  let guard = 0;
  while (diff !== 0 && guard < 200) {
    guard++;
    if (diff > 0) {
      // Ưu tiên cộng vào hạng cao nhất (#1, #2...) mà vẫn giữ thứ tự không tăng
      rounded[0] += step;
      diff -= step;
    } else {
      // Trừ từ hạng thấp nhất có thể trừ (> step) mà vẫn giữ thứ tự giảm dần (rank i >= rank i+1)
      let reduced = false;
      for (let i = rounded.length - 1; i >= 0; i--) {
        const nextVal = i < rounded.length - 1 ? rounded[i + 1] : step;
        if (rounded[i] - step >= Math.max(step, nextVal)) {
          rounded[i] -= step;
          diff += step;
          reduced = true;
          break;
        }
      }
      if (!reduced) {
        rounded[0] = Math.max(step, rounded[0] - step);
        diff += step;
      }
    }
  }

  // Đảm bảo thứ tự giảm dần (rank 1 >= rank 2 >= ...)
  for (let i = 1; i < rounded.length; i++) {
    if (rounded[i] > rounded[i - 1]) {
      const swap = rounded[i - 1];
      rounded[i - 1] = rounded[i];
      rounded[i] = swap;
    }
  }

  return rounded;
}

/**
 * Tính toán bảng phân bổ quỹ thời gian deterministic, chính xác từng phút & quy đổi Pomodoro.
 */
export function calculateOrientationPlan(
  rankedGoalIds: OrientationGoalId[],
  dailyHoursInput: number
): OrientationBudgetPlan {
  const uniqueGoals = Array.from(new Set(rankedGoalIds)).filter(
    isOrientationGoalId
  );
  const totalHours = clampDailyHours(dailyHoursInput);
  const totalMinutes = Math.round(totalHours * 60);
  const tierInfo = getBudgetTierInfo(totalHours);

  if (uniqueGoals.length === 0) {
    return {
      totalHours,
      totalMinutes,
      ...tierInfo,
      allocations: [],
      hasOverloadWarning: false,
      overloadWarningText: null,
      hasBurnoutWarning: false,
      burnoutWarningText: null,
    };
  }

  // Tính trọng số ưu tiên:
  // - Nếu chỉ có 1 mục tiêu: 100%
  // - Nếu có 2 mục tiêu: #1 = 60%, #2 = 40%
  // - Nếu >= 3 mục tiêu: trung bình (#1, #2) = ratioMultiplier * mỗi mục tiêu (#3+),
  //   trong đó #1 nhỉnh hơn #2 một chút (1.08x và 0.92x của ratioMultiplier)
  let weights: number[];
  if (uniqueGoals.length === 1) {
    weights = [1];
  } else if (uniqueGoals.length === 2) {
    weights = [1.2, 0.8];
  } else {
    weights = uniqueGoals.map((_, index) => {
      if (index === 0) return tierInfo.ratioMultiplier * 1.08;
      if (index === 1) return tierInfo.ratioMultiplier * 0.92;
      return 1;
    });
  }

  const allocatedMinutes = distributeMinutesMonotonically(weights, totalMinutes);

  const allocations: OrientationAllocationItem[] = uniqueGoals.map(
    (goalId, idx) => {
      const preset = getOrientationPreset(goalId);
      const rank = idx + 1;
      const minutesPerDay = allocatedMinutes[idx] ?? 0;
      const hoursPerDay = Math.round((minutesPerDay / 60) * 100) / 100;
      const sharePercent = Math.round((minutesPerDay / totalMinutes) * 100);

      // Nếu mục tiêu từ #3 trở xuống bị chia nhỏ hơn 25 phút (< 1 Pomodoro),
      // đề xuất gộp thành phiên cách ngày (3 buổi/tuần) để tránh vụn thời gian
      const cadence: AllocationCadence =
        rank >= 3 && minutesPerDay < 25 ? "alternate_days" : "daily";
      const effectiveSessionMinutes =
        cadence === "alternate_days"
          ? Math.max(25, Math.round((minutesPerDay * 2) / 5) * 5)
          : minutesPerDay;

      const pomodoro25Count = Math.max(
        1,
        Math.round(effectiveSessionMinutes / 25)
      );
      const pomodoro50Count = Math.floor(effectiveSessionMinutes / 50);

      const useDeepWork =
        effectiveSessionMinutes >= 50 &&
        (goalId === "academic_achievement" ||
          goalId === "make_money" ||
          goalId === "personal_branding");

      const recommendedPomodoroLabel =
        cadence === "alternate_days"
          ? `~${effectiveSessionMinutes} phút/buổi (${pomodoro25Count} phiên 25/5 • cách ngày)`
          : useDeepWork
          ? `${pomodoro50Count} phiên Deep Work 50/15` +
            (effectiveSessionMinutes % 50 >= 20 ? " + 1 phiên 25/5" : "")
          : `${pomodoro25Count} phiên Pomodoro 25/5`;

      const cadenceLabel =
        cadence === "alternate_days"
          ? "Luân phiên 3–4 buổi/tuần"
          : "Duy trì mỗi ngày";

      return {
        goalId,
        title: preset.title,
        shortTitle: preset.shortTitle,
        rank,
        isTopPriority: rank <= 2,
        minutesPerDay,
        hoursPerDay,
        sharePercent,
        cadence,
        cadenceLabel,
        recommendedPomodoroLabel,
        pomodoro25Count,
        pomodoro50Count,
        mappedCategory: preset.mappedCategory,
        defaultCalendarGoalTitle: preset.defaultCalendarGoalTitle,
        defaultSlot: preset.defaultSlot,
        defaultActionTip: preset.defaultActionTip,
      };
    }
  );

  const alternateGoals = allocations.filter(
    (a) => a.cadence === "alternate_days"
  );
  const hasOverloadWarning = alternateGoals.length > 0;
  const overloadWarningText = hasOverloadWarning
    ? `Bạn đang chọn ${uniqueGoals.length} mục tiêu trên quỹ ${totalHours} giờ/ngày nên ${alternateGoals.length} mục tiêu từ hạng #3 trở xuống chỉ còn dưới 25 phút/ngày. Hệ thống tự chuyển nhóm này sang chế độ luân phiên cách ngày (~30–40 phút/buổi) để tránh chia vụn, hoặc bạn có thể tăng quỹ giờ / rút gọn xuống 2–3 mục tiêu cốt lõi.`
    : null;

  const hasHealthOrPeace =
    uniqueGoals.includes("health") || uniqueGoals.includes("peace_of_mind");
  const hasBurnoutWarning =
    (totalHours >= 8.5 && !hasHealthOrPeace) ||
    (totalHours >= 8 && uniqueGoals.length === 1);
  const burnoutWarningText = hasBurnoutWarning
    ? uniqueGoals.length === 1
      ? `Dành trọn ${totalHours} giờ/ngày cho duy nhất 1 mục tiêu dễ gây mệt mỏi nhận thức. Hãy xen kẽ nghỉ 15 phút và vận động giãn cơ tại Phòng Kỷ luật Webcam sau mỗi ca 50 phút.`
      : `Quỹ ${totalHours} giờ/ngày ở mức toàn lực nhưng chưa có Sức khỏe hoặc Tâm trí bình yên. Bạn nên giữ ít nhất 20–30 phút vận động giãn cơ và nghỉ ngơi để duy trì bền bỉ.`
    : null;

  return {
    totalHours,
    totalMinutes,
    ...tierInfo,
    allocations,
    hasOverloadWarning,
    overloadWarningText,
    hasBurnoutWarning,
    burnoutWarningText,
  };
}

/**
 * Bộ tư vấn Định hướng nội bộ (chạy tức thì, miễn phí 100%, dùng làm fallback khi mất mạng/hết quota Gemini).
 */
export function generateOrientationFallbackAdvice(
  plan: OrientationBudgetPlan,
  state?: AppDatabaseState
): OrientationAIAdvice {
  if (plan.allocations.length === 0) {
    return {
      summary:
        "Hãy chọn ít nhất 1 mục tiêu quan trọng nhất với bạn ở giai đoạn hiện tại để AI Mentor tính toán quỹ thời gian phù hợp.",
      ratioExplanation:
        "Hệ thống sẽ phân bổ từ 2 đến 10 giờ/ngày và tập trung thời lượng lớn hơn cho mục tiêu ưu tiên #1 và #2.",
      warnings: [],
      pillarTips: [],
      nextStepHint: "Bấm vào các thẻ mục tiêu bên trên theo thứ tự bạn ưu tiên nhất.",
      source: "fallback",
    };
  }

  const first = plan.allocations[0];
  const second = plan.allocations[1];
  const lower = plan.allocations.slice(2);

  const summaryParts: string[] = [];
  if (second) {
    summaryParts.push(
      `Với quỹ **${plan.totalHours} giờ/ngày** (${plan.tierLabel}), trọng tâm chiến lược của cậu nên dồn vào **#1 ${first.title}** (${formatMinutesFriendly(
        first.minutesPerDay
      )}/ngày) và **#2 ${second.title}** (${formatMinutesFriendly(
        second.minutesPerDay
      )}/ngày).`
    );
  } else {
    summaryParts.push(
      `Với quỹ **${plan.totalHours} giờ/ngày**, cậu đang chọn chiến lược tập trung tuyệt đối 100% vào **#1 ${first.title}** — rất phù hợp để tạo đột phá nhanh trong ngắn hạn.`
    );
  }

  if (lower.length > 0) {
    summaryParts.push(
      `${lower.length} mục tiêu còn lại (${lower
        .map((l) => l.shortTitle)
        .join(", ")}) đóng vai trò duy trì nhịp nền để không bị mất cân bằng.`
    );
  }

  const ratioExplanation =
    plan.allocations.length <= 2
      ? second
        ? `Vì cậu chỉ chọn 2 mục tiêu trọng tâm, toàn bộ ${plan.totalHours} giờ được dồn cho #1 (${first.sharePercent}%) và #2 (${second.sharePercent}%) để đạt độ sâu cao nhất.`
        : `Toàn bộ ${plan.totalHours} giờ được dành trọn cho #1 ${first.title}, chia thành các khối Pomodoro đều đặn.`
      : `${plan.ratioLabel}. Trung bình mỗi mục tiêu trong Top 1–2 nhận khoảng ${formatMinutesFriendly(
          Math.round((first.minutesPerDay + (second?.minutesPerDay ?? 0)) / 2)
        )}/ngày, nổi trội rõ rệt so với nhóm duy trì phía sau.`;

  const warnings: string[] = [];
  if (plan.overloadWarningText) warnings.push(plan.overloadWarningText);
  if (plan.burnoutWarningText) warnings.push(plan.burnoutWarningText);

  if (state && state.goals.length > 0) {
    const analysis = analyzeStudentProgress(state);
    if (analysis.habits.overdueGoalsCount > 0 || analysis.habits.urgentGoalsCount > 0) {
      warnings.push(
        `Lưu ý từ Lịch trình hiện có: cậu đang có ${
          analysis.habits.overdueGoalsCount > 0
            ? `${analysis.habits.overdueGoalsCount} mục tiêu quá hạn`
            : `${analysis.habits.urgentGoalsCount} mục tiêu sắp đến hạn (≤ 7 ngày)`
        } — hãy ưu tiên ghép mục tiêu gấp đó vào khung giờ của #1.`
      );
    }
  }

  const pillarTips: OrientationPillarTip[] = plan.allocations.map((alloc) => ({
    goalId: alloc.goalId,
    suggestedSlot: alloc.defaultSlot,
    tip:
      alloc.cadence === "alternate_days"
        ? `${alloc.defaultActionTip} (Nên gom thành buổi ~${Math.max(
            25,
            alloc.minutesPerDay * 2
          )} phút vào các ngày chẵn/lẻ thay vì chia quá nhỏ mỗi ngày.)`
        : alloc.defaultActionTip,
  }));

  return {
    summary: summaryParts.join(" "),
    ratioExplanation,
    warnings,
    pillarTips,
    nextStepHint:
      "Nếu thấy phân bổ này hợp lý, hãy bấm 'Xác nhận quỹ thời gian' để đồng bộ chỉ tiêu ngày lên thanh Sidebar và chia sẻ ngữ cảnh cho Cố vấn AI.",
    source: "fallback",
  };
}
