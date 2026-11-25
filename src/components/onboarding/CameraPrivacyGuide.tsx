"use client";

import { useState } from "react";
import { Camera, LockKeyhole, X } from "lucide-react";

interface CameraPrivacyGuideProps {
  triggerLabel?: string;
  open?: boolean;
  onClose?: () => void;
}

export function CameraPrivacyGuide({ triggerLabel = "Hướng dẫn Camera & quyền riêng tư", open: controlledOpen, onClose }: CameraPrivacyGuideProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = controlledOpen ?? internalOpen;
  const close = () => {
    setInternalOpen(false);
    onClose?.();
  };

  return (
    <>
      {controlledOpen === undefined && (
        <button type="button" onClick={() => setInternalOpen(true)} className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100">
          <Camera className="h-4 w-4" aria-hidden="true" />{triggerLabel}
        </button>
      )}
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="camera-guide-title" className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="rounded-xl bg-blue-50 p-2.5 text-blue-700"><Camera className="h-5 w-5" /></span>
                <div><h2 id="camera-guide-title" className="text-lg font-bold text-slate-900">Cấp quyền Camera & Quyền riêng tư</h2><p className="text-xs text-slate-500">Bạn luôn có thể tắt camera khi không sử dụng.</p></div>
              </div>
              <button type="button" onClick={close} aria-label="Đóng hướng dẫn" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X className="h-4 w-4" /></button>
            </div>
            <ol className="mt-5 space-y-3 text-sm text-slate-700">
              <li><strong>1. Mở trang Webcam:</strong> Chỉ cấp quyền khi bạn chủ động sử dụng tính năng cần camera.</li>
              <li><strong>2. Cho phép truy cập:</strong> Khi trình duyệt hỏi, chọn <em>Allow / Cho phép</em>. Nếu đã chặn, mở biểu tượng ổ khóa cạnh thanh địa chỉ, tìm Camera và đổi sang Cho phép, sau đó tải lại trang.</li>
              <li><strong>3. Kiểm tra thiết bị:</strong> Đóng ứng dụng khác đang sử dụng camera và chọn đúng webcam trong trình duyệt nếu có nhiều thiết bị.</li>
            </ol>
            <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5">
              <div className="flex items-center gap-2 text-sm font-bold text-emerald-800"><LockKeyhole className="h-4 w-4" />Lưu ý quyền riêng tư</div>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-relaxed text-emerald-900">
                <li>Quyền camera do trình duyệt và hệ điều hành quản lý; bạn có thể thu hồi bất cứ lúc nào.</li>
                <li>Không bật camera ở nơi công cộng hoặc khi người xung quanh chưa đồng ý.</li>
                <li>Chọn chế độ quyền riêng tư phù hợp trong ứng dụng và tắt camera sau khi hoàn tất.</li>
                <li>Camera thường chỉ hoạt động trên HTTPS hoặc địa chỉ localhost.</li>
              </ul>
            </div>
            <div className="mt-5 flex justify-end"><button type="button" onClick={close} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">Đã hiểu</button></div>
          </section>
        </div>
      )}
    </>
  );
}

export default CameraPrivacyGuide;
