import { AppDatabaseState, Goal } from "@/types/database";

export const STORAGE_KEY = "edu_focus_db_v1";

export function calculateGoalProgress(completedHours: number, targetHours: number): number {
  if (targetHours <= 0) return 0;
  const raw = Math.round((completedHours / targetHours) * 100);
  return Math.max(0, Math.min(100, raw));
}

export function createDefaultState(): AppDatabaseState {
  const today = new Date().toISOString().slice(0, 10);

  const goals: Goal[] = [
    {
      id: "goal-dsa",
      title: "Hoàn thành môn Cấu trúc dữ liệu & Giải thuật (Điểm A)",
      description: "Ôn chắc Cây nhị phân, Đồ thị và Quy hoạch động kèm giải 40 bài thực hành.",
      category: "academic",
      targetHours: 40,
      completedHours: 18,
      deadline: "2026-12-20",
      progressPercent: calculateGoalProgress(18, 40),
      status: "active",
    },
    {
      id: "goal-ielts",
      title: "Luyện nghe & đọc IELTS đạt band 7.0",
      description: "Duy trì 45 phút luyện đề mỗi sáng và ghi chú từ vựng học thuật.",
      category: "skill",
      targetHours: 60,
      completedHours: 36,
      deadline: "2027-01-15",
      progressPercent: calculateGoalProgress(36, 60),
      status: "active",
    },
    {
      id: "goal-posture",
      title: "Vận động giải lao giữa giờ học mỗi ngày",
      description: "Thực hiện bài tập Giơ tay qua đầu và Giãn cơ vai với Webcam sau mỗi ca Pomodoro.",
      category: "health",
      targetHours: 15,
      completedHours: 12,
      deadline: "2026-12-05",
      progressPercent: calculateGoalProgress(12, 15),
      status: "active",
    },
  ];

  return {
    goals,
    scheduleEvents: [
      {
        id: "evt-1",
        goalId: "goal-dsa",
        title: "Ôn tập Đồ thị (BFS / DFS) & làm 3 bài tập",
        date: today,
        startTime: "08:00",
        endTime: "09:30",
        type: "study",
        status: "completed",
        notes: "Đã hoàn thành đúng tiến độ, cần xem lại phần đệ quy.",
      },
      {
        id: "evt-2",
        goalId: "goal-posture",
        title: "Giải lao vận động: 15 nhịp Giơ tay qua đầu + Giãn vai",
        date: today,
        startTime: "09:30",
        endTime: "09:45",
        type: "exercise",
        status: "completed",
      },
      {
        id: "evt-3",
        goalId: "goal-ielts",
        title: "Luyện Reading Passage 2 & tổng hợp 15 từ vựng",
        date: today,
        startTime: "14:00",
        endTime: "15:00",
        type: "study",
        status: "planned",
      },
      {
        id: "evt-4",
        goalId: "goal-dsa",
        title: "Tổng kết công thức Quy hoạch động cơ bản",
        date: today,
        startTime: "19:30",
        endTime: "21:00",
        type: "review",
        status: "planned",
      },
    ],
    focusSessions: [
      {
        id: "session-1",
        scheduleEventId: "evt-1",
        mode: "study_focus",
        startedAt: `${today}T08:00:00.000Z`,
        endedAt: `${today}T09:30:00.000Z`,
        durationMinutes: 90,
        focusScorePercent: 92,
        distractionCount: 1,
      },
      {
        id: "session-2",
        scheduleEventId: "evt-2",
        mode: "exercise_break",
        startedAt: `${today}T09:30:00.000Z`,
        endedAt: `${today}T09:40:00.000Z`,
        durationMinutes: 10,
        focusScorePercent: 100,
        distractionCount: 0,
        exerciseType: "overhead_reach",
        completedReps: 15,
        targetReps: 15,
      },
    ],
    aiMessages: [
      {
        id: "msg-welcome",
        role: "assistant",
        content:
          "Chào Mây! Hôm nay cậu đã hoàn thành xuất sắc ca học Cấu trúc dữ liệu buổi sáng với độ tập trung 92% và đủ 15 nhịp vận động giải lao. Chiều nay lúc 14:00 có lịch luyện Reading IELTS, nhớ khởi động Phòng Kỷ luật Webcam để giữ nhịp nhé!",
        createdAt: `${today}T09:45:00.000Z`,
      },
    ],
    updatedAt: new Date().toISOString(),
  };
}

export function loadAppState(): AppDatabaseState {
  if (typeof window === "undefined") {
    return createDefaultState();
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const initial = createDefaultState();
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }
    const parsed = JSON.parse(raw) as AppDatabaseState;
    if (!parsed || !Array.isArray(parsed.goals)) {
      return createDefaultState();
    }
    return parsed;
  } catch {
    return createDefaultState();
  }
}

export function saveAppState(state: AppDatabaseState): AppDatabaseState {
  const updated: AppDatabaseState = {
    ...state,
    updatedAt: new Date().toISOString(),
  };
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // Ignore quota errors in restricted environments
    }
  }
  return updated;
}

export function resetAppState(): AppDatabaseState {
  const initial = createDefaultState();
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
    } catch {
      // Ignore storage errors
    }
  }
  return initial;
}
