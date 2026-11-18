import React from "react";
import { CalendarCheck2 } from "lucide-react";

export function CalendarPlaceholder() {
  return (
    <div className="p-6 rounded-2xl bg-edtech-surface border border-edtech-border shadow-sm space-y-3">
      <div className="flex items-center gap-2.5 text-edtech-primary">
        <CalendarCheck2 className="w-6 h-6" aria-hidden={true} />
        <h1 className="text-xl font-bold text-edtech-text">
          Lịch trình &amp; Mục tiêu
        </h1>
      </div>
      <p className="text-sm text-edtech-muted leading-relaxed">
        Phân hệ quản lý Mục tiêu cá nhân và Thời gian biểu theo ngày/tuần. Sẵn
        sàng tích hợp tạo, chỉnh sửa và đánh dấu hoàn thành lịch học ở Giai đoạn
        2.
      </p>
    </div>
  );
}
