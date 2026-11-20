import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const SYSTEM =
  "Bạn là trợ lý của EduFocus AI, nền tảng giáo dục giúp sinh viên lên lịch trình, rèn luyện kỷ luật qua webcam và nhận tư vấn lộ trình học tập. Trả lời bằng tiếng Việt, ngắn gọn, thân thiện và khích lệ. Giữ câu trả lời dưới khoảng 200 từ; nếu chủ đề rộng, đưa ra các ý chính và hỏi người dùng muốn đi sâu phần nào.";

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();
    const contents = (messages as { role: string; content: string }[])
      .slice(-20)
      .map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: String(m.content).slice(0, 2000) }],
      }));

    const res = await ai.models.generateContent({
      model: "gemini-3.5-flash-lite",
      contents,
      config: { systemInstruction: SYSTEM, maxOutputTokens: 4096 },
    });

    return Response.json({ reply: res.text ?? "" });
  } catch (e) {
    console.error("CHAT ERROR:", e);
    return Response.json(
      { reply: "Xin lỗi, có lỗi xảy ra.Xin vui lòng thử lại sau." },
      { status: 500 }
    );
  }
}