# Quy tắc vận hành bắt buộc cho AI Agent (AGENTS.md)

## 1. Quy trình Tự Kiểm Thử (Self-Testing Rules)

- **TUYỆT ĐỐI KHÔNG** chạy lệnh `npm run dev` hoặc `pnpm dev` trong quá trình tự kiểm tra vì sẽ làm treo tiến trình (blocking process) và chiếm dụng cổng 3000.
- Để kiểm tra code có chạy đúng không trước khi bàn giao, bắt buộc sử dụng:
  1. `npx tsc --noEmit` (Kiểm tra lỗi kiểu dữ liệu TypeScript).
  2. `npm run lint` (Kiểm tra lỗi cú pháp và quy chuẩn code).
- **Giới hạn sửa lỗi:** Nếu kiểm thử thất bại quá 2 lần liên tiếp cho cùng một vấn đề, hãy DỪNG LẠI và báo cáo nguyên nhân cho người dùng, không tự ý cài thêm thư viện lạ để vá lỗi.

## 2. Quy trình Tự Lưu Code (Safe Git Commit Rules)

- Chỉ thực hiện `git commit` KHI VÀ CHỈ KHI bước kiểm thử (`tsc --noEmit`) không có bất kỳ lỗi đỏ nào.
- Trước khi commit, luôn chạy `git status` để kiểm tra.
- **TUYỆT ĐỐI KHÔNG** commit các file chứa khóa bảo mật (`.env`, `.env.local`), thư mục `node_modules/`, `.next/` hoặc các file cấu hình tạm.
- Nội dung commit (Commit message) phải viết rõ ràng theo chuẩn: `feat: [tên tính năng]` hoặc `fix: [lỗi đã sửa]` để cả nhóm dễ theo dõi.

## 3. Quy chuẩn Thiết kế & Cấu trúc (EdTech Standards)

- Giao diện giữ phong cách Giáo dục Phổ thông chuyên nghiệp: nền sáng dịu (`#F8FAFC`), chữ tương phản cao dễ đọc (`#1E293B`), điểm nhấn màu xanh học thuật (`#2563EB`) và xanh lá kỷ luật (`#10B981`).
- Phân tách rõ ràng từng khu vực tính năng trong thư mục riêng biệt để tránh xung đột code (Merge Conflict) khi làm việc nhóm.

## Quy tắc an toàn khi bật chế độ Turbo (Command Policy)
- **ĐƯỢC PHÉP tự chạy:** `npm install <tên-gói>`, `npm test`, `npm run build`, `npm run lint`, `npx tsc --noEmit`, `git status`, `git add`, `git commit`.
- **CẤM TUYỆT ĐỐI tự chạy:**
  - Các lệnh treo tiến trình: `npm run dev`, `npm start`, `pnpm dev`.
  - Các lệnh phá hủy dữ liệu hoặc lịch sử Git: `rm -rf`, `git push --force`, `git reset --hard`.
