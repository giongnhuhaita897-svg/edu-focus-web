import { NextResponse } from "next/server";
import { GoogleGenAI, Type, type Schema } from "@google/genai";
import { analyzeStudentProgress } from "@/modules/ai-tutor/ai-engine";
import {
  calculateOrientationPlan,
  clampDailyHours,
  formatMinutesFriendly,
  generateOrientationFallbackAdvice,
  isOrientationGoalId,
  OrientationAIAdvice,
  OrientationBudgetPlan,
  OrientationGoalId,
  OrientationPace,
  OrientationPillarTip,
  recommendDailyHours,
} from "@/modules/orientation/orientation-engine";
import { AppDatabaseState } from "@/types/database";

const MODEL = "gemini-3.5-flash-lite";
const TIMEOUT_MS = 9000;
const MAX_OUTPUT_TOKENS = 1536;

const ORIENTATION_SYSTEM_INSTRUCTION =
  "Bạn là Cố vấn Định hướng & Quản trị Quỹ thời gian của EduFocus AI. " +
  "Nhiệm vụ của bạn là giúp sinh viên/người tự học hiểu rõ nên dồn năng lượng vào mục tiêu nào trước và tiêu thời gian hiệu quả theo bảng phân bổ đã được tính toán sẵn (từ 2 đến 10 giờ/ngày). " +
  "Trả lời bằng tiếng Việt, thực tế, sâu sắc, ngắn gọn, khích lệ nhưng thẳng thắn khi người dùng ôm đồm quá nhiều mục tiêu. " +
  "TUYỆT ĐỐI giữ nguyên các con số giờ/phút trong BẢNG PHÂN BỔ QUỸ THỜI GIAN được cung cấp, không tự bịa số liệu trái ngược. " +
  "Mỗi mục tiêu đã chọn phải có 1 gợi ý hành động cụ thể, dễ áp dụng ngay trong ngày.";

const ORIENTATION_RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    summary: {
      type: Type.STRING,
      description:
        "Nhận xét tổng quan 2–3 câu về lựa chọn ưu tiên và quỹ thời gian mỗi ngày của người dùng (Markdown gọn gàng).",
    },
    ratioExplanation: {
      type: Type.STRING,
      description:
        "Giải thích ngắn gọn 1–2 câu vì sao nhóm ưu tiên #1–#2 được dồn thời lượng vượt trội so với #3 trở xuống.",
    },
    warnings: {
      type: Type.ARRAY,
      description:
        "Danh sách 0–3 cảnh báo thực tế (ví dụ: chọn quá nhiều mục tiêu trên quỹ nhỏ, nguy cơ kiệt sức khi thiếu Sức khỏe/Tâm trí bình yên, hoặc xung đột với mục tiêu sắp hết hạn).",
      items: { type: Type.STRING },
    },
    pillarTips: {
      type: Type.ARRAY,
      description:
        "Gợi ý hành động cụ thể cho từng mục tiêu đã chọn (đúng theo goalId được cung cấp).",
      items: {
        type: Type.OBJECT,
        properties: {
          goalId: { type: Type.STRING },
          suggestedSlot: {
            type: Type.STRING,
            description: "Khung buổi gợi ý (VD: Sáng 08:00–10:30, Chiều, Tối).",
          },
          tip: {
            type: Type.STRING,
            description: "1–2 câu hành động thực tế có thể làm ngay.",
          },
        },
        required: ["goalId", "suggestedSlot", "tip"],
      },
    },
    nextStepHint: {
      type: Type.STRING,
      description:
        "Lời khuyên chốt hạ 1 câu khuyến khích người dùng xác nhận quỹ thời gian và bắt đầu phiên Pomodoro đầu tiên.",
    },
  },
  required: [
    "summary",
    "ratioExplanation",
    "warnings",
    "pillarTips",
    "nextStepHint",
  ],
};

interface OrientationRequestBody {
  rankedGoalIds?: unknown;
  pace?: unknown;
  dailyHours?: unknown;
  state?: unknown;
}

function isValidPace(val: unknown): val is OrientationPace {
  return (
    val === "auto" ||
    val === "light" ||
    val === "balanced" ||
    val === "intensive"
  );
}

function isValidAppState(val: unknown): val is AppDatabaseState {
  const s = val as AppDatabaseState | undefined;
  return (
    !!s &&
    Array.isArray(s.goals) &&
    Array.isArray(s.scheduleEvents) &&
    Array.isArray(s.focusSessions)
  );
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Gemini timeout")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

function buildOrientationPrompt(
  plan: OrientationBudgetPlan,
  state?: AppDatabaseState
): string {
  const allocationLines = plan.allocations
    .map(
      (a) =>
        `- [goalId=${a.goalId}] Hạng #${a.rank}: ${a.title} — ${formatMinutesFriendly(
          a.minutesPerDay
        )}/ngày (${a.sharePercent}% quỹ, ${a.cadenceLabel}, gợi ý ${a.recommendedPomodoroLabel})`
    )
    .join("\n");

  let existingContext = "Người dùng chưa có mục tiêu/lịch trình sẵn trên hệ thống.";
  if (state && (state.goals.length > 0 || state.scheduleEvents.length > 0)) {
    const analysis = analyzeStudentProgress(state);
    existingContext =
      `Hiện có ${state.goals.length} mục tiêu trên Lịch trình (${analysis.habits.urgentGoalsCount} mục tiêu gấp, ${analysis.habits.overdueGoalsCount} quá hạn), ` +
      `tổng ${analysis.totalFocusMinutes} phút tập trung đã ghi nhận (điểm tập trung TB ${analysis.averageFocusScore}%).`;
  }

  const systemFlags: string[] = [];
  if (plan.overloadWarningText) systemFlags.push(plan.overloadWarningText);
  if (plan.burnoutWarningText) systemFlags.push(plan.burnoutWarningText);

  return [
    `BẢNG PHÂN BỔ QUỸ THỜI GIAN ĐÃ TÍNH SẴN:`,
    `Tổng quỹ mỗi ngày: ${plan.totalHours} giờ (${plan.totalMinutes} phút) — ${plan.tierLabel}`,
    `Quy tắc ưu tiên: ${plan.ratioLabel}`,
    `Chi tiết từng mục tiêu:\n${allocationLines}`,
    `Bối cảnh hiện tại của người dùng: ${existingContext}`,
    systemFlags.length > 0
      ? `Cảnh báo hệ thống cần lưu ý:\n- ${systemFlags.join("\n- ")}`
      : "Cảnh báo hệ thống: Không có cảnh báo nghiêm trọng.",
    `Hãy tư vấn định hướng chiến lược, giải thích ngắn gọn lý do phân bổ và đưa gợi ý hành động cụ thể cho từng goalId ở trên.`,
  ].join("\n\n");
}

function sanitizeGeminiOrientationAdvice(
  rawText: string,
  plan: OrientationBudgetPlan,
  fallback: OrientationAIAdvice
): OrientationAIAdvice | null {
  try {
    const parsed: unknown = JSON.parse(rawText);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    const obj = parsed as Record<string, unknown>;
    const summary =
      typeof obj.summary === "string" && obj.summary.trim().length > 0
        ? obj.summary.trim()
        : fallback.summary;
    const ratioExplanation =
      typeof obj.ratioExplanation === "string" &&
      obj.ratioExplanation.trim().length > 0
        ? obj.ratioExplanation.trim()
        : fallback.ratioExplanation;
    const nextStepHint =
      typeof obj.nextStepHint === "string" && obj.nextStepHint.trim().length > 0
        ? obj.nextStepHint.trim()
        : fallback.nextStepHint;

    const rawWarnings = Array.isArray(obj.warnings)
      ? obj.warnings
          .filter((w): w is string => typeof w === "string" && w.trim().length > 0)
          .map((w) => w.trim())
      : [];

    // Đảm bảo không bỏ sót cảnh báo dàn trải hoặc kiệt sức đã tính từ engine
    const warnings = [...rawWarnings];
    if (plan.overloadWarningText && warnings.length === 0) {
      warnings.push(plan.overloadWarningText);
    }
    if (plan.burnoutWarningText && !warnings.some((w) => /kiệt sức|sức khỏe|nghỉ/i.test(w))) {
      warnings.push(plan.burnoutWarningText);
    }

    const tipMap = new Map<OrientationGoalId, OrientationPillarTip>();
    if (Array.isArray(obj.pillarTips)) {
      for (const item of obj.pillarTips) {
        if (!item || typeof item !== "object") continue;
        const rec = item as Record<string, unknown>;
        if (!isOrientationGoalId(rec.goalId)) continue;
        const tip = typeof rec.tip === "string" ? rec.tip.trim() : "";
        const suggestedSlot =
          typeof rec.suggestedSlot === "string" && rec.suggestedSlot.trim()
            ? rec.suggestedSlot.trim()
            : "";
        if (tip) {
          tipMap.set(rec.goalId, {
            goalId: rec.goalId,
            suggestedSlot,
            tip,
          });
        }
      }
    }

    const pillarTips: OrientationPillarTip[] = plan.allocations.map((alloc) => {
      const fromAI = tipMap.get(alloc.goalId);
      const fromFallback = fallback.pillarTips.find(
        (t) => t.goalId === alloc.goalId
      );
      return {
        goalId: alloc.goalId,
        suggestedSlot:
          fromAI?.suggestedSlot || fromFallback?.suggestedSlot || alloc.defaultSlot,
        tip: fromAI?.tip || fromFallback?.tip || alloc.defaultActionTip,
      };
    });

    return {
      summary,
      ratioExplanation,
      warnings: warnings.slice(0, 4),
      pillarTips,
      nextStepHint,
      source: "gemini",
    };
  } catch {
    return null;
  }
}

async function askGeminiOrientation(
  plan: OrientationBudgetPlan,
  fallback: OrientationAIAdvice,
  state?: AppDatabaseState
): Promise<OrientationAIAdvice | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const ai = new GoogleGenAI({ apiKey });
  const res = await withTimeout(
    ai.models.generateContent({
      model: MODEL,
      contents: buildOrientationPrompt(plan, state),
      config: {
        systemInstruction: ORIENTATION_SYSTEM_INSTRUCTION,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        responseMimeType: "application/json",
        responseSchema: ORIENTATION_RESPONSE_SCHEMA,
      },
    }),
    TIMEOUT_MS
  );

  const rawText = (res.text ?? "").trim();
  if (!rawText) return null;
  return sanitizeGeminiOrientationAdvice(rawText, plan, fallback);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as OrientationRequestBody;
    const rawGoals = Array.isArray(body.rankedGoalIds)
      ? body.rankedGoalIds
      : [];
    const validGoalIds: OrientationGoalId[] = Array.from(
      new Set(rawGoals.filter(isOrientationGoalId))
    );

    if (validGoalIds.length === 0) {
      return NextResponse.json(
        { error: "Vui lòng chọn ít nhất 1 mục tiêu ưu tiên để AI tư vấn quỹ thời gian." },
        { status: 400 }
      );
    }

    const pace: OrientationPace = isValidPace(body.pace) ? body.pace : "auto";
    const appState = isValidAppState(body.state) ? body.state : undefined;

    const effectiveHours =
      typeof body.dailyHours === "number" && Number.isFinite(body.dailyHours)
        ? clampDailyHours(body.dailyHours)
        : recommendDailyHours(validGoalIds, pace, appState);

    const plan = calculateOrientationPlan(validGoalIds, effectiveHours);
    const fallbackAdvice = generateOrientationFallbackAdvice(plan, appState);

    let advice: OrientationAIAdvice = fallbackAdvice;
    if (process.env.GEMINI_API_KEY) {
      try {
        const geminiAdvice = await askGeminiOrientation(
          plan,
          fallbackAdvice,
          appState
        );
        if (geminiAdvice) {
          advice = geminiAdvice;
        }
      } catch (error) {
        console.error("GEMINI ORIENTATION ERROR:", error);
        advice = fallbackAdvice;
      }
    }

    return NextResponse.json(
      {
        dailyHours: effectiveHours,
        plan,
        advice,
        source: advice.source,
      },
      { status: 200 }
    );
  } catch {
    return NextResponse.json(
      { error: "Không thể xử lý yêu cầu tư vấn Định hướng quỹ thời gian." },
      { status: 400 }
    );
  }
}
