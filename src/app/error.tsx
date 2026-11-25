"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Keep the error available to the hosting platform's reporting pipeline.
    console.error("Application route error:", error);
  }, [error]);

  return (
    <main className="flex min-h-[65vh] items-center justify-center bg-slate-50 px-4 py-12">
      <section role="alert" className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-7 text-center shadow-sm sm:p-10">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600"><AlertTriangle className="h-7 w-7" /></div>
        <p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-blue-600">EduFocus AI · Thông báo hệ thống</p>
        <h1 className="mt-2 text-2xl font-extrabold text-slate-900">Đã có lỗi ngoài dự kiến</h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-600">Trang này tạm thời chưa thể hiển thị. Dữ liệu đã lưu trước đó không nhất thiết bị ảnh hưởng. Bạn có thể thử tải lại khu vực này hoặc quay về trang chủ.</p>
        {error.digest && <p className="mt-3 text-xs text-slate-400">Mã tham chiếu: {error.digest}</p>}
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={() => reset()} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"><RefreshCw className="h-4 w-4" />Thử lại</button>
          <Link href="/" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"><Home className="h-4 w-4" />Về trang chủ</Link>
        </div>
      </section>
    </main>
  );
}
