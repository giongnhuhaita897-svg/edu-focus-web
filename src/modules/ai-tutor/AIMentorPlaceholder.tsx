import React from "react";
import { Sparkles } from "lucide-react";

export function AIMentorPlaceholder() {
  return (
    <div className="p-6 rounded-2xl bg-edtech-surface border border-edtech-border shadow-sm space-y-3">
      <div className="flex items-center gap-2.5 text-edtech-primary">
        <Sparkles className="w-6 h-6" aria-hidden={true} />
        <h1 className="text-xl font-bold text-edtech-text">
          Cố vấn Học tập AI Mentor
        </h1>
      </div>
      <p className="text-sm text-edtech-muted leading-relaxed">
        Phân hệ phân tích mục tiêu, đánh giá mức độ kỷ luật thực tế và gợi ý
        khung giờ học phù hợp như thầy cô giáo đồng hành.
      </p>
    </div>
  );
}
