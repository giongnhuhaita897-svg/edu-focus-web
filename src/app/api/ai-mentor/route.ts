import { NextResponse } from "next/server";
import { createDefaultState } from "@/lib/storage/local-db";
import { generateMentorResponse } from "@/modules/ai-tutor/ai-engine";
import { AppDatabaseState } from "@/types/database";

interface AIMentorRequestBody {
  prompt?: string;
  state?: AppDatabaseState;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AIMentorRequestBody;
    const prompt = (body.prompt ?? "").trim();
    if (!prompt) {
      return NextResponse.json(
        { error: "Vui lòng nhập nội dung câu hỏi hoặc yêu cầu tư vấn." },
        { status: 400 }
      );
    }

    const currentState: AppDatabaseState =
      body.state && Array.isArray(body.state.goals)
        ? body.state
        : createDefaultState();

    // Tính toán phản hồi và đề xuất lịch trình thông minh từ dữ liệu thực tế
    const reply = generateMentorResponse(currentState, prompt);

    return NextResponse.json({ message: reply }, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: "Không thể xử lý yêu cầu tư vấn AI." },
      { status: 400 }
    );
  }
}
