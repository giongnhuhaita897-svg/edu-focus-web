export type GoalCategory = "academic" | "skill" | "health";
export type GoalStatus = "active" | "completed" | "paused";

export interface Goal {
  id: string;
  title: string;
  description: string;
  category: GoalCategory;
  targetHours: number;
  completedHours: number;
  deadline: string; // YYYY-MM-DD
  progressPercent: number; // 0 - 100
  status: GoalStatus;
}

export type ScheduleEventType = "study" | "exercise" | "review";
export type ScheduleEventStatus = "planned" | "completed" | "missed";

export interface ScheduleEvent {
  id: string;
  goalId?: string;
  title: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  type: ScheduleEventType;
  status: ScheduleEventStatus;
  notes?: string;
}

/**
 * Easy-to-track webcam exercises with clear landmark movement and reliable angle hysteresis:
 * - overhead_reach: Giơ hai tay qua đầu (ngồi hoặc đứng trước webcam đều nhận diện rất rõ)
 * - squat: Đứng lên ngồi xuống (toàn thân / nửa thân trên rõ ràng)
 * - shoulder_stretch: Dang rộng hai tay ngang vai mở ngực (giãn cơ vai cổ khi ngồi học lâu)
 */
export type ExerciseType = "overhead_reach" | "squat" | "shoulder_stretch";

export type FocusSessionMode = "study_focus" | "exercise_break";

export type PomodoroPresetId = "25_5" | "50_15";
export type PomodoroPhase = "work" | "break";

export interface PomodoroPreset {
  id: PomodoroPresetId;
  label: string;
  workMinutes: number;
  breakMinutes: number;
  description: string;
}

export interface FocusSession {
  id: string;
  scheduleEventId?: string;
  mode: FocusSessionMode;
  pomodoroPreset?: PomodoroPresetId;
  startedAt: string; // ISO string
  endedAt: string; // ISO string
  durationMinutes: number;
  focusScorePercent: number; // 0 - 100
  distractionCount: number;
  drowsinessAlertCount?: number;
  exerciseType?: ExerciseType;
  completedReps?: number;
  targetReps?: number;
}

export interface SuggestedScheduleAction {
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  type: ScheduleEventType;
  goalId?: string;
}

export interface AIMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string; // ISO string
  suggestedActions?: SuggestedScheduleAction[];
}

export interface AppDatabaseState {
  goals: Goal[];
  scheduleEvents: ScheduleEvent[];
  focusSessions: FocusSession[];
  aiMessages: AIMessage[];
  updatedAt: string;
}
