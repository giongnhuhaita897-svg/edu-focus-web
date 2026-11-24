"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CalendarCheck2,
  Timer,
  Camera,
  Sparkles,
  Compass,
  GraduationCap,
  ShieldCheck,
  Flame,
} from "lucide-react";
import {
  createDefaultState,
  loadAppState,
  STATE_CHANGE_EVENT,
} from "@/lib/storage/local-db";
import { OrientationProfile } from "@/modules/orientation/orientation-engine";
import {
  getEffectiveDailyTargetMinutes,
  loadOrientationProfile,
  ORIENTATION_CHANGE_EVENT,
} from "@/modules/orientation/orientation-storage";
import { AppDatabaseState } from "@/types/database";

export interface NavItem {
  href: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
}

export const NAV_ITEMS: NavItem[] = [
  {
    href: "/",
    label: "Tổng quan",
    description: "Phân tích & tiến độ ngày",
    icon: LayoutDashboard,
  },
  {
    href: "/calendar",
    label: "Lịch trình & Mục tiêu",
    description: "Lưới lịch tuần & mục tiêu",
    icon: CalendarCheck2,
  },
  {
    href: "/pomodoro",
    label: "Đồng hồ Pomodoro",
    description: "Chu kỳ Học/Làm & Nghỉ 25/5, 50/15",
    icon: Timer,
  },
  {
    href: "/webcam",
    label: "Phòng Kỷ luật",
    description: "Giám sát học & vận động",
    icon: Camera,
  },
  {
    href: "/ai-mentor",
    label: "Cố vấn AI",
    description: "Đánh giá & gợi ý lộ trình",
    icon: Sparkles,
  },
  {
    href: "/orientation",
    label: "Định hướng",
    description: "Xác nhận quỹ thời gian & ưu tiên",
    icon: Compass,
  },
];

export function Sidebar() {
  const pathname = usePathname() || "/";
  const [summary, setSummary] = useState<AppDatabaseState>(() =>
    createDefaultState()
  );
  const [orientation, setOrientation] = useState<OrientationProfile | null>(
    null
  );

  useEffect(() => {
    const refresh = () => {
      setSummary(loadAppState());
      setOrientation(loadOrientationProfile());
    };
    refresh();
    window.addEventListener(STATE_CHANGE_EVENT, refresh);
    window.addEventListener(ORIENTATION_CHANGE_EVENT, refresh);
    return () => {
      window.removeEventListener(STATE_CHANGE_EVENT, refresh);
      window.removeEventListener(ORIENTATION_CHANGE_EVENT, refresh);
    };
  }, []);

  const totalMinutes = summary.focusSessions.reduce(
    (sum, s) => sum + s.durationMinutes,
    0
  );
  const dailyTargetMinutes = getEffectiveDailyTargetMinutes(orientation);
  const dailyPercent = Math.min(
    100,
    Math.round((totalMinutes / dailyTargetMinutes) * 100)
  );

  return (
    <aside className="w-full md:w-72 md:min-h-screen bg-edtech-surface border-b md:border-b-0 md:border-r border-edtech-border flex flex-col justify-between shrink-0">
      <div className="p-5">
        <div className="flex items-center justify-between gap-2 pb-5 border-b border-edtech-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center shadow-sm">
              <GraduationCap className="w-6 h-6" aria-hidden={true} />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <p className="text-base font-bold tracking-tight text-edtech-text">
                  EduFocus AI
                </p>
                <span className="px-1.5 py-0.5 rounded-md text-[10px] font-extrabold uppercase bg-blue-50 text-edtech-primary border border-blue-200">
                  v1.1+
                </span>
              </div>
              <p className="text-xs text-edtech-muted">
                Hệ sinh thái Kỷ luật Tự học
              </p>
            </div>
          </div>
        </div>

        <nav aria-label="Điều hướng chính" className="mt-5">
          <p className="hidden md:block px-3 mb-2 text-[11px] font-bold uppercase tracking-wider text-edtech-muted">
            Không gian học tập
          </p>
          <ul className="flex md:flex-col gap-1.5 overflow-x-auto md:overflow-visible pb-1 md:pb-0">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);

              return (
                <li key={item.href} className="shrink-0 md:shrink">
                  <Link
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    className={`group relative flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-edtech-primary ${
                      isActive
                        ? "bg-blue-50/90 text-edtech-primary font-semibold border border-blue-200 shadow-sm"
                        : "text-edtech-text hover:bg-slate-100/80 font-medium border border-transparent"
                    }`}
                  >
                    {isActive && (
                      <span
                        aria-hidden="true"
                        className="hidden md:block absolute left-0 top-2 bottom-2 w-1 rounded-r bg-edtech-primary"
                      />
                    )}
                    <Icon
                      aria-hidden={true}
                      className={`w-5 h-5 shrink-0 ${
                        isActive
                          ? "text-edtech-primary"
                          : "text-edtech-muted group-hover:text-edtech-text"
                      }`}
                    />
                    <div className="min-w-0">
                      <div className="truncate">{item.label}</div>
                      <div className="hidden md:block text-xs font-normal text-edtech-muted truncate">
                        {item.description}
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>

      <div className="hidden md:block p-4 space-y-3">
        {/* Widget chỉ tiêu học tập ngày */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 text-white space-y-2.5 shadow-sm">
          <div className="flex items-center justify-between text-xs">
            <span className="inline-flex items-center gap-1.5 font-bold text-amber-300">
              <Flame className="w-4 h-4" aria-hidden={true} />
              <span>Chỉ tiêu tập trung ngày</span>
            </span>
            <span className="font-bold text-emerald-400">{dailyPercent}%</span>
          </div>
          <p className="text-xs text-slate-300" data-testid="sidebar-daily-target">
            Đã tích lũy <strong className="text-white">{totalMinutes}</strong> /{" "}
            {dailyTargetMinutes} phút hôm nay
          </p>
          {orientation && orientation.plan.allocations[0] && (
            <p className="text-[11px] text-amber-200/95 truncate">
              Ưu tiên #1: {orientation.plan.allocations[0].shortTitle} (
              {orientation.dailyHours}h/ngày)
            </p>
          )}
          <div className="w-full h-1.5 rounded-full bg-slate-700 overflow-hidden">
            <div
              className="h-full bg-emerald-400 rounded-full transition-all"
              style={{ width: `${dailyPercent}%` }}
            />
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-edtech-bg border border-edtech-border">
          <div className="flex items-center gap-2 text-xs font-semibold text-edtech-success">
            <ShieldCheck className="w-4 h-4" aria-hidden={true} />
            <span>Đồng bộ &amp; Bảo mật v1.1</span>
          </div>
          <p className="mt-1 text-xs text-edtech-muted leading-relaxed">
            Đang lưu {summary.goals.length} mục tiêu &amp;{" "}
            {summary.scheduleEvents.length} lịch trình trên thiết bị.
          </p>
        </div>
      </div>
    </aside>
  );
}
