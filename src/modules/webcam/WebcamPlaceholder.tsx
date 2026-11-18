import React from "react";
import { Camera } from "lucide-react";

export function WebcamPlaceholder() {
  return (
    <div className="p-6 rounded-2xl bg-edtech-surface border border-edtech-border shadow-sm space-y-3">
      <div className="flex items-center gap-2.5 text-edtech-primary">
        <Camera className="w-6 h-6" aria-hidden={true} />
        <h1 className="text-xl font-bold text-edtech-text">
          Phòng Kỷ luật Webcam
        </h1>
      </div>
      <p className="text-sm text-edtech-muted leading-relaxed">
        Phân hệ giám sát tập trung khi ngồi học và đếm nhịp vận động chuẩn xác
        (Giơ tay qua đầu, Squat, Giãn cơ vai) ngay trên trình duyệt.
      </p>
    </div>
  );
}
