import type { ScheduleEvent } from "@/types/database";

export type ScheduleEventDraft = Pick<
  ScheduleEvent,
  "date" | "startTime" | "endTime"
>;

function toMinutes(value: string): number {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return Number.NaN;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return Number.NaN;
  return hours * 60 + minutes;
}

/** Returns the first event on the same date whose time range intersects the draft. */
export function findOverlappingEvent(
  events: ScheduleEvent[],
  draft: ScheduleEventDraft,
  excludeEventId?: string
): ScheduleEvent | null {
  const start = toMinutes(draft.startTime);
  const end = toMinutes(draft.endTime);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return null;
  }

  return (
    events.find((event) => {
      if (event.id === excludeEventId || event.date !== draft.date) return false;
      const existingStart = toMinutes(event.startTime);
      const existingEnd = toMinutes(event.endTime);
      if (!Number.isFinite(existingStart) || !Number.isFinite(existingEnd)) {
        return false;
      }
      // Adjacent sessions (09:00–10:00 and 10:00–11:00) are allowed.
      return start < existingEnd && existingStart < end;
    }) ?? null
  );
}

function dateFromLocalISO(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function toLocalISO(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Returns the seven dates for the Monday–Sunday week containing dateISO. */
export function getWeekDates(dateISO: string): string[] {
  const date = dateFromLocalISO(dateISO);
  const mondayOffset = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - mondayOffset);
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(date);
    day.setDate(date.getDate() + index);
    return toLocalISO(day);
  });
}

export function addDaysToISO(dateISO: string, amount: number): string {
  const date = dateFromLocalISO(dateISO);
  date.setDate(date.getDate() + amount);
  return toLocalISO(date);
}
