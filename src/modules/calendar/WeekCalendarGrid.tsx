"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import type { ScheduleEvent } from "@/types/database";
import { addDaysToISO, getWeekDates } from "./calendar-utils";

interface WeekCalendarGridProps {
  events: ScheduleEvent[];
  onEditEvent?: (event: ScheduleEvent) => void;
  initialDate?: string;
}

const DAY_NAMES = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ nhật"];
const EVENT_TYPE_LABELS = {
  study: "Học tập",
  exercise: "Vận động",
  review: "Ôn tập",
} as const;

function localTodayISO() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function formatRange(first: string, last: string) {
  const firstDate = new Date(`${first}T12:00:00`);
  const lastDate = new Date(`${last}T12:00:00`);
  const formatter = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit" });
  return `${formatter.format(firstDate)} – ${formatter.format(lastDate)}`;
}

export function WeekCalendarGrid({ events, onEditEvent, initialDate }: WeekCalendarGridProps) {
  const [anchorDate, setAnchorDate] = useState(initialDate ?? localTodayISO());
  const weekDates = useMemo(() => getWeekDates(anchorDate), [anchorDate]);
  const today = localTodayISO();

  return (
    <section aria-label="Lịch tuần" data-testid="week-calendar-grid" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-edtech-text">Lịch tuần</p>
          <p className="text-xs text-edtech-muted">Thứ 2 – Chủ nhật · {formatRange(weekDates[0], weekDates[6])}</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setAnchorDate(addDaysToISO(anchorDate, -7))} aria-label="Tuần trước" className="rounded-lg border border-edtech-border p-2 text-edtech-text hover:bg-slate-100">
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          <button type="button" onClick={() => setAnchorDate(today)} className="rounded-lg border border-edtech-border px-3 py-2 text-xs font-semibold text-edtech-primary hover:bg-blue-50">Hôm nay</button>
          <button type="button" onClick={() => setAnchorDate(addDaysToISO(anchorDate, 7))} aria-label="Tuần sau" className="rounded-lg border border-edtech-border p-2 text-edtech-text hover:bg-slate-100">
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-7" role="list" aria-label="Bảy ngày trong tuần">
        {weekDates.map((date, index) => {
          const dayEvents = events.filter((event) => event.date === date).sort((a, b) => a.startTime.localeCompare(b.startTime));
          const dateNumber = date.slice(-2);
          const isToday = date === today;
          return (
            <div key={date} role="listitem" data-testid={`week-day-${date}`} className={`min-h-36 rounded-xl border p-2.5 ${isToday ? "border-blue-400 bg-blue-50/70" : "border-edtech-border bg-edtech-bg"}`}>
              <div className="mb-2 flex items-center justify-between gap-1 border-b border-edtech-border/70 pb-2">
                <span className="text-xs font-bold text-edtech-text">{DAY_NAMES[index]}</span>
                <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${isToday ? "bg-edtech-primary text-white" : "bg-white text-edtech-muted"}`}>{dateNumber}</span>
              </div>
              {dayEvents.length === 0 ? (
                <p className="py-3 text-center text-[11px] text-edtech-muted">Trống lịch</p>
              ) : (
                <ul className="space-y-1.5">
                  {dayEvents.map((event) => (
                    <li key={event.id}>
                      <button type="button" onClick={() => onEditEvent?.(event)} disabled={!onEditEvent} title={`${event.title} (${event.startTime}–${event.endTime})`} className={`w-full rounded-lg border px-2 py-1.5 text-left disabled:cursor-default ${event.type === "exercise" ? "border-emerald-200 bg-emerald-50" : event.type === "review" ? "border-amber-200 bg-amber-50" : "border-blue-200 bg-white"}`}>
                        <span className="block text-[10px] font-bold text-edtech-primary">{event.startTime}–{event.endTime}</span>
                        <span className="mt-0.5 block break-words text-[11px] font-semibold text-edtech-text">{event.title}</span>
                        <span className="block text-[10px] text-edtech-muted">{EVENT_TYPE_LABELS[event.type]}{event.status === "completed" ? " · Đã xong" : ""}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
      {events.length === 0 && <div className="flex items-center justify-center gap-2 text-xs text-edtech-muted"><CalendarDays className="h-4 w-4" />Chưa có buổi lịch trong hệ thống.</div>}
    </section>
  );
}

export default WeekCalendarGrid;
