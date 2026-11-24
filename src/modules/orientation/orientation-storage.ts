import { STATE_CHANGE_EVENT } from "@/lib/storage/local-db";
import {
  DEFAULT_DAILY_TARGET_MINUTES,
  formatMinutesFriendly,
  isOrientationGoalId,
  OrientationProfile,
} from "@/modules/orientation/orientation-engine";

export const ORIENTATION_STORAGE_KEY = "edufocus_orientation_v1";
export const ORIENTATION_CHANGE_EVENT = "edufocus-orientation-change";

function notifyOrientationChange() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(ORIENTATION_CHANGE_EVENT));
    window.dispatchEvent(new Event(STATE_CHANGE_EVENT));
  }
}

export function loadOrientationProfile(): OrientationProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(ORIENTATION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OrientationProfile;
    if (
      !parsed ||
      !Array.isArray(parsed.rankedGoalIds) ||
      parsed.rankedGoalIds.length === 0 ||
      !parsed.rankedGoalIds.every(isOrientationGoalId) ||
      typeof parsed.dailyHours !== "number" ||
      !parsed.plan ||
      !Array.isArray(parsed.plan.allocations)
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveOrientationProfile(
  profile: OrientationProfile
): OrientationProfile {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(
        ORIENTATION_STORAGE_KEY,
        JSON.stringify(profile)
      );
      notifyOrientationChange();
    } catch {
      // Bỏ qua lỗi quota lưu trữ trình duyệt
    }
  }
  return profile;
}

export function clearOrientationProfile(): void {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(ORIENTATION_STORAGE_KEY);
      notifyOrientationChange();
    } catch {
      // Bỏ qua lỗi lưu trữ trình duyệt
    }
  }
}

/**
 * Lấy chỉ tiêu phút tập trung mỗi ngày:
 * - Nếu người dùng đã xác nhận Định hướng: lấy đúng tổng quỹ phút/ngày đã xác nhận (120..600 phút).
 * - Nếu chưa xác nhận: trả về mặc định 120 phút (giữ nguyên tương thích với các màn hình & test cũ).
 */
export function getEffectiveDailyTargetMinutes(
  profile?: OrientationProfile | null
): number {
  const active = profile !== undefined ? profile : loadOrientationProfile();
  if (!active || !Number.isFinite(active.dailyHours) || active.dailyHours <= 0) {
    return DEFAULT_DAILY_TARGET_MINUTES;
  }
  return Math.max(
    DEFAULT_DAILY_TARGET_MINUTES,
    Math.min(600, Math.round(active.dailyHours * 60))
  );
}

/**
 * Tạo chuỗi tóm tắt ngắn gọn để gửi kèm sang Cố vấn AI (/ai-mentor)
 * giúp AI tư vấn lịch trình và mục tiêu bám sát định hướng ưu tiên người dùng vừa chốt.
 */
export function formatOrientationContextForMentor(
  profile?: OrientationProfile | null
): string | undefined {
  const active = profile !== undefined ? profile : loadOrientationProfile();
  if (!active || active.plan.allocations.length === 0) return undefined;

  const lines = active.plan.allocations.map(
    (item) =>
      `#${item.rank} ${item.title}: ${formatMinutesFriendly(
        item.minutesPerDay
      )}/ngày (${item.sharePercent}% • ${item.cadenceLabel})`
  );

  return (
    `Quỹ thời gian ngày đã xác nhận: ${active.dailyHours} giờ/ngày (${active.plan.tierLabel}). ` +
    `Thứ tự ưu tiên hiện tại:\n- ${lines.join("\n- ")}`
  );
}
