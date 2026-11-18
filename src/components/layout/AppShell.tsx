"use client";

import React, { useEffect, useState } from "react";
import { Sidebar } from "./Sidebar";
import {
  Sparkles,
  RotateCcw,
  Eraser,
  CheckCircle2,
  Calendar,
} from "lucide-react";
import {
  clearToEmptyState,
  createDefaultState,
  loadAppState,
  resetAppState,
  STATE_CHANGE_EVENT,
} from "@/lib/storage/local-db";
import { AppDatabaseState } from "@/types/database";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [dbState, setDbState] = useState<AppDatabaseState>(() =>
    createDefaultState()
  );
  const [modeToast, setModeToast] = useState<string>("");

  useEffect(() => {
    const refresh = () => setDbState(loadAppState());
    refresh();
    window.addEventListener(STATE_CHANGE_EVENT, refresh);
    return () => window.removeEventListener(STATE_CHANGE_EVENT, refresh);
  }, []);

  const syncWithApi = (next: AppDatabaseState) => {
    if (typeof window !== "undefined" && typeof window.fetch === "function") {
      window
        .fetch("/api/state", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(next),
        })
        .catch(() => {});
    }
  };

  const handleSwitchToFreshUser = () => {
    const empty = clearToEmptyState();
    setDbState(empty);
    syncWithApi(empty);
    setModeToast(
      "Đã đưa toàn bộ trang web về trạng thái mới hoàn toàn (0 mục tiêu, 0 lịch trình)."
    );
  };

  const handleLoadDemoData = () => {
    const demo = resetAppState();
    setDbState(demo);
    syncWithApi(demo);
    setModeToast("Đã nạp bộ dữ liệu mẫu để trải nghiệm đầy đủ tính năng.");
  };

  const isFreshEmpty =
    dbState.goals.length === 0 && dbState.scheduleEvents.length === 0;

  return (
    <div className="min-h-screen bg-edtech-bg text-edtech-text flex flex-col md:flex-row">
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Topbar chuyên nghiệp phiên bản v1.1+ */}
        <header className="bg-edtech-surface/95 backdrop-blur border-b border-edtech-border px-6 py-3.5 sticky top-0 z-20">
          <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-edtech-text text-xs font-semibold border border-edtech-border">
                <Calendar
                  className="w-3.5 h-3.5 text-edtech-primary"
                  aria-hidden={true}
                />
                <span>Hôm nay • Không gian Học tập Cá nhân</span>
              </span>
              <span
                className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${
                  isFreshEmpty
                    ? "bg-amber-50 text-amber-800 border-amber-200"
                    : "bg-emerald-50 text-edtech-success border-emerald-200"
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" aria-hidden={true} />
                <span>
                  {isFreshEmpty
                    ? "Chế độ: Người dùng mới (Trống)"
                    : `Đang có ${dbState.goals.length} mục tiêu & ${dbState.scheduleEvents.length} buổi lịch`}
                </span>
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSwitchToFreshUser}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-edtech-text text-xs font-semibold border border-edtech-border transition-colors"
                title="Xóa dữ liệu mẫu để dùng trang web trắng như khi mới đăng ký"
              >
                <Eraser
                  className="w-3.5 h-3.5 text-edtech-muted"
                  aria-hidden={true}
                />
                <span>Làm mới (Như mới dùng)</span>
              </button>

              <button
                type="button"
                onClick={handleLoadDemoData}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-edtech-primary text-xs font-bold border border-blue-200 transition-colors"
                title="Nạp lại dữ liệu mẫu để xem thử hoặc thuyết trình"
              >
                <RotateCcw className="w-3.5 h-3.5" aria-hidden={true} />
                <span>Nạp dữ liệu mẫu</span>
              </button>
            </div>
          </div>

          {modeToast && (
            <div
              role="status"
              aria-live="polite"
              className="max-w-6xl mx-auto mt-2.5 px-3.5 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-edtech-success flex items-center justify-between gap-2"
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden={true} />
                <span>{modeToast}</span>
              </div>
              <button
                type="button"
                onClick={() => setModeToast("")}
                className="underline text-edtech-muted hover:text-edtech-text"
              >
                Đóng
              </button>
            </div>
          )}
        </header>

        <main className="flex-1 min-w-0 p-6 md:p-8 max-w-6xl mx-auto w-full">
          {children}
        </main>
      </div>
    </div>
  );
}
