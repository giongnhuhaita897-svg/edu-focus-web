/**
 * Cấu hình "Người quan sát" cho Tab 1: Giám sát Ngồi học & Tập trung.
 *
 * Thay vì so từng khung hình với 1 ngưỡng cứng (kiểu máy móc), bộ quan sát mô phỏng cách
 * một người thật dõi theo bạn học:
 * - Làm quen với tư thế ngồi bình thường của riêng bạn (hiệu chỉnh tư thế gốc).
 * - Tích lũy bằng chứng theo thời gian, không "quên sạch" chỉ vì 1 khung hình nhiễu.
 * - Nhận ra các dấu hiệu buồn ngủ tinh tế: mắt lim dim, chớp mắt chậm, gật gù, ngáp, gục xuống bàn.
 * - Nhận ra tư thế dùng điện thoại dưới bàn dù camera không nhìn thấy rõ chiếc điện thoại.
 * - Nghi ngờ hơn sau khi vừa bắt gặp bạn xao nhãng (giống người giám sát để ý kỹ hơn).
 *
 * File tách riêng khỏi `thresholds.ts` để tránh xung đột code với các nhánh khác.
 */

export interface HumanObserverThresholds {
  // --- Làm quen tư thế ngồi gốc (Baseline Calibration) ---
  /** Thời gian ngồi tư thế bình thường (ms) cần có trước khi coi là đã "làm quen" xong */
  calibrationWarmupMs: number;
  /** Hằng số thời gian thích nghi nhanh (ms) trong giai đoạn đầu phiên */
  calibrationFastTauMs: number;
  /** Hằng số thời gian thích nghi chậm (ms) sau giai đoạn đầu (tránh trôi theo tư thế gục dần) */
  calibrationSlowTauMs: number;
  /** Độ dài giai đoạn thích nghi nhanh (ms tính theo thời gian ngồi bình thường) */
  calibrationFastPhaseMs: number;
  /** Giới hạn tuyệt đối để 1 khung hình được dùng làm mẫu tư thế bình thường */
  neutralMaxAbsYawDeg: number;
  neutralMinPitchDeg: number;
  neutralMaxPitchDeg: number;
  neutralMaxEyeClosure: number;
  neutralMaxLookDown: number;
  /** Giới hạn tối đa của tư thế gốc (không cho tư thế gốc trôi quá xa) */
  baselineMaxAbsYawDeg: number;
  baselineMaxAbsPitchDeg: number;
  baselineMaxAbsRollDeg: number;
  baselineMaxEyeClosure: number;
  baselineMaxLookDown: number;

  // --- Tích lũy bằng chứng (Leaky Evidence) ---
  /** Tốc độ "quên" bằng chứng khi tín hiệu biến mất (1.5 = giảm nhanh gấp 1.5 lần tốc độ tăng) */
  evidenceDecayRate: number;
  /** Mức trần bằng chứng so với ngưỡng (tạo độ trễ trạng thái, tránh nhấp nháy) */
  evidenceCapRatio: number;
  /** Tỷ lệ bằng chứng (so với ngưỡng) để người quan sát bắt đầu "để ý" và nhắc khẽ */
  watchingRatio: number;
  /** Sau khi bắt gặp xao nhãng, người quan sát nghi ngờ hơn trong khoảng thời gian này (ms) */
  suspicionWindowMs: number;
  /** Hệ số tăng tốc tích lũy bằng chứng khi đang nghi ngờ */
  suspicionRiseMultiplier: number;
  /** Phải tập trung liên tục bao lâu (ms) thì 1 đợt xao nhãng mới được coi là đã kết thúc */
  episodeGapMs: number;

  // --- Buồn ngủ tinh tế ---
  /** Khi ánh mắt nhìn xuống ≥ ngưỡng này, mí mắt trông như khép lại (hiện tượng camera) */
  eyeLookDownMaskThreshold: number;
  /** Lúc đang nhìn xuống, chỉ coi là nhắm mắt khi điểm nhắm mắt ≥ ngưỡng này */
  eyeClosedWhileLookingDownThreshold: number;
  /** Mắt lim dim (khép hờ) — điểm nhắm mắt tương đối */
  halfClosedEyeThreshold: number;
  /** Thời gian mắt lim dim tích lũy (ms) trước khi báo buồn ngủ */
  halfClosedDurationMs: number;
  /** Cúi gục đầu sâu (độ, so với tư thế gốc) */
  deepHeadDropDeg: number;
  /** Cúi đầu vừa phải + mắt nặng trĩu (điểm nhắm ≥ ngưỡng này) cũng là gục ngủ */
  headDropWithHeavyEyesClosure: number;
  /** Nghiêng đầu sang 1 bên (chống tay / tựa đầu) kèm mắt khép hờ */
  headRestRollDeg: number;
  /** PERCLOS: cửa sổ đo tỷ lệ thời gian nhắm mắt (ms) */
  perclosWindowMs: number;
  /** PERCLOS: cần quan sát đủ bao lâu (ms) trước khi đánh giá */
  perclosMinCoverageMs: number;
  /** PERCLOS: điểm nhắm mắt tương đối để coi là "đang khép mắt" */
  perclosClosedThreshold: number;
  /** PERCLOS: tỷ lệ thời gian khép mắt để báo buồn ngủ */
  perclosAlertRatio: number;
  /** PERCLOS: giãn cách giữa 2 lần nhắc (ms) */
  perclosCooldownMs: number;
  /** Chớp mắt chậm (ms) — dấu hiệu "díp mắt" */
  longBlinkMinMs: number;
  longBlinkWindowMs: number;
  longBlinkCountForAlert: number;
  /** Gật gù: đầu rơi xuống (độ) rồi giật lên lại nhanh */
  nodMinDropDeg: number;
  nodRecoverDeg: number;
  nodMaxRecoverMs: number;
  nodHeavyEyeClosure: number;
  nodWindowMs: number;
  nodCountForAlert: number;
  /** Ngáp: độ mở miệng (blendshape jawOpen) & thời gian giữ */
  yawnJawOpenThreshold: number;
  yawnMinDurationMs: number;
  yawnWindowMs: number;
  yawnCountForAlert: number;
  /** Mất mặt khỏi khung hình ngay sau dấu hiệu buồn ngủ (ms) => gục xuống bàn ngủ */
  faceLostAfterDrowsyCueMs: number;
  /** Tỷ lệ bằng chứng buồn ngủ (so với ngưỡng) được coi là "đang có dấu hiệu buồn ngủ" */
  drowsyCueRatio: number;

  // --- Điện thoại / Nhìn xuống dưới bàn ---
  /** Giữ "trí nhớ" đã thấy điện thoại thêm bao lâu (ms) khi mô hình bỏ sót 1 vài lần quét */
  deviceSightingHoldMs: number;
  /** Độ tin cậy được coi là chắc chắn thấy điện thoại */
  deviceStrongConfidence: number;
  /** Tốc độ tích lũy khi chỉ thấy điện thoại mờ (độ tin cậy thấp) */
  deviceWeakRise: number;
  /** Hệ số tăng tốc khi thấy điện thoại kèm tư thế dùng (nhìn xuống, lướt tay, tay đặt thấp) */
  deviceContextBoost: number;
  /** Chỉ cần ánh mắt nhìn xuống rõ (tương đối) cũng tính là nhìn xuống dưới bàn */
  lookDownEyesOnlyThreshold: number;
  /** Chỉ cần cúi đầu (độ, tương đối) cũng tính là nhìn xuống dưới bàn */
  lookDownHeadOnlyDeg: number;
  /** Hệ số tăng tốc khi nhìn xuống kèm tay đặt thấp trong khung hình (tư thế cầm điện thoại) */
  lowerZoneHandBoost: number;
  /** Cổ tay nằm thấp hơn mức này (tọa độ Y chuẩn hóa 0..1) được coi là tay đặt dưới thấp */
  lowerZoneMinWristY: number;
  /** Liếc xuống: thời gian tối thiểu (ms) của 1 lần liếc */
  glanceMinMs: number;
  /** Liếc xuống nhiều lần trong cửa sổ này (ms) => thói quen kiểm tra điện thoại */
  glanceWindowMs: number;
  glanceCountForAlert: number;
}

export const HUMAN_OBSERVER_THRESHOLDS: HumanObserverThresholds = {
  calibrationWarmupMs: 1500,
  calibrationFastTauMs: 1500,
  calibrationSlowTauMs: 20000,
  calibrationFastPhaseMs: 5000,
  neutralMaxAbsYawDeg: 18,
  neutralMinPitchDeg: -16,
  neutralMaxPitchDeg: 18,
  neutralMaxEyeClosure: 0.4,
  neutralMaxLookDown: 0.5,
  baselineMaxAbsYawDeg: 12,
  baselineMaxAbsPitchDeg: 12,
  baselineMaxAbsRollDeg: 12,
  baselineMaxEyeClosure: 0.35,
  baselineMaxLookDown: 0.4,

  evidenceDecayRate: 1.5,
  evidenceCapRatio: 1.4,
  watchingRatio: 0.45,
  suspicionWindowMs: 60000,
  suspicionRiseMultiplier: 1.35,
  episodeGapMs: 2500,

  eyeLookDownMaskThreshold: 0.45,
  eyeClosedWhileLookingDownThreshold: 0.82,
  halfClosedEyeThreshold: 0.32,
  halfClosedDurationMs: 6000,
  deepHeadDropDeg: 30,
  headDropWithHeavyEyesClosure: 0.4,
  headRestRollDeg: 22,
  perclosWindowMs: 30000,
  perclosMinCoverageMs: 12000,
  perclosClosedThreshold: 0.45,
  perclosAlertRatio: 0.28,
  perclosCooldownMs: 20000,
  longBlinkMinMs: 400,
  longBlinkWindowMs: 60000,
  longBlinkCountForAlert: 3,
  nodMinDropDeg: 15,
  nodRecoverDeg: 6,
  nodMaxRecoverMs: 800,
  nodHeavyEyeClosure: 0.3,
  nodWindowMs: 90000,
  nodCountForAlert: 2,
  yawnJawOpenThreshold: 0.5,
  yawnMinDurationMs: 1200,
  yawnWindowMs: 180000,
  yawnCountForAlert: 2,
  faceLostAfterDrowsyCueMs: 2500,
  drowsyCueRatio: 0.35,

  deviceSightingHoldMs: 900,
  deviceStrongConfidence: 0.45,
  deviceWeakRise: 0.65,
  deviceContextBoost: 1.5,
  lookDownEyesOnlyThreshold: 0.6,
  lookDownHeadOnlyDeg: 16,
  lowerZoneHandBoost: 1.6,
  lowerZoneMinWristY: 0.6,
  glanceMinMs: 500,
  glanceWindowMs: 45000,
  glanceCountForAlert: 4,
};
