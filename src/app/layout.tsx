import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/layout/AppShell";
import ChatBox from "@/components/chat-box";

export const metadata: Metadata = {
  title: "EduFocus AI — Lịch trình, Kỷ luật Webcam & Cố vấn Học tập",
  description:
    "Nền tảng giáo dục hỗ trợ sinh viên lên lịch trình, rèn luyện kỷ luật qua webcam và nhận tư vấn lộ trình từ AI Mentor.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body className="antialiased">
        <AppShell>{children}</AppShell>
        <ChatBox />
      </body>
    </html>
  );
}
