"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CalendarCheck2,
  Camera,
  Sparkles,
  GraduationCap,
  ShieldCheck,
} from "lucide-react";

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
    description: "Tiến độ & lịch hôm nay",
    icon: LayoutDashboard,
  },
  {
    href: "/calendar",
    label: "Lịch trình & Mục tiêu",
    description: "Quản lý thời gian biểu",
    icon: CalendarCheck2,
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
];

export function Sidebar() {
  const pathname = usePathname() || "/";

  return (
    <aside className="w-full md:w-72 md:min-h-screen bg-edtech-surface border-b md:border-b-0 md:border-r border-edtech-border flex flex-col justify-between shrink-0">
      <div className="p-5">
        <div className="flex items-center gap-3 pb-5 border-b border-edtech-border">
          <div className="w-10 h-10 rounded-xl bg-edtech-primary text-white flex items-center justify-center shadow-sm">
            <GraduationCap className="w-6 h-6" aria-hidden={true} />
          </div>
          <div>
            <p className="text-base font-bold tracking-tight text-edtech-text">
              EduFocus AI
            </p>
            <p className="text-xs text-edtech-muted">
              Kỷ luật tự học &amp; Phát triển
            </p>
          </div>
        </div>

        <nav aria-label="Điều hướng chính" className="mt-5">
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
                    className={`group relative flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-edtech-primary ${
                      isActive
                        ? "bg-blue-50/90 text-edtech-primary font-semibold border border-blue-200"
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

      <div className="hidden md:block p-4 m-4 rounded-xl bg-edtech-bg border border-edtech-border">
        <div className="flex items-center gap-2 text-xs font-semibold text-edtech-success">
          <ShieldCheck className="w-4 h-4" aria-hidden={true} />
          <span>Lưu trữ cục bộ an toàn</span>
        </div>
        <p className="mt-1 text-xs text-edtech-muted leading-relaxed">
          Dữ liệu lịch học, mục tiêu và phiên kỷ luật được đồng bộ trực tiếp trên
          trình duyệt của bạn.
        </p>
      </div>
    </aside>
  );
}
