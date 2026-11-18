import { NextResponse } from "next/server";
import { createDefaultState } from "@/lib/storage/local-db";
import { AppDatabaseState } from "@/types/database";

let memoryStore: AppDatabaseState = createDefaultState();

export async function GET() {
  return NextResponse.json(memoryStore, { status: 200 });
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as Partial<AppDatabaseState>;
    if (!body || !Array.isArray(body.goals)) {
      return NextResponse.json(
        { error: "Dữ liệu trạng thái không hợp lệ" },
        { status: 400 }
      );
    }
    memoryStore = {
      goals: body.goals,
      scheduleEvents: Array.isArray(body.scheduleEvents) ? body.scheduleEvents : memoryStore.scheduleEvents,
      focusSessions: Array.isArray(body.focusSessions) ? body.focusSessions : memoryStore.focusSessions,
      aiMessages: Array.isArray(body.aiMessages) ? body.aiMessages : memoryStore.aiMessages,
      updatedAt: new Date().toISOString(),
    };
    return NextResponse.json(memoryStore, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: "Không thể đọc dữ liệu JSON" },
      { status: 400 }
    );
  }
}
