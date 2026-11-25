# Kịch bản demo 5 phút — Dũng (Calendar, Onboarding & QA)

## Chuẩn bị trước khi trình bày
- Mở website tại `/calendar`, dùng dữ liệu demo có sẵn hoặc tạo sẵn một mục tiêu và hai buổi lịch.
- Chuẩn bị một buổi học có liên kết mục tiêu để trình diễn query `eventId` và `goalId`.
- Mở sẵn terminal ở thư mục dự án để trình bày kết quả QA đã chạy thực tế.
- Không bật webcam nếu không cần thiết; chỉ mở modal hướng dẫn quyền Camera.

## 0:00–0:40 — Giới thiệu
“Phần em phụ trách là Lưới Lịch Tuần, trải nghiệm hướng dẫn người dùng và kiểm thử chất lượng. Mục tiêu là giúp người dùng nhìn được lịch cả tuần, tránh đặt hai hoạt động chồng giờ và chuyển nhanh từ lịch sang phiên Pomodoro.”

## 0:40–1:50 — Lưới lịch tuần
1. Mở Calendar và chuyển sang chế độ **Lịch tuần**.
2. Chỉ rõ thứ tự Thứ 2 đến Chủ nhật, các buổi được sắp xếp theo giờ.
3. Bấm **Tuần trước / Tuần sau / Hôm nay** để đổi tuần.
4. Bấm vào một buổi để quay lại form chỉnh sửa.

Lời dẫn: “Mỗi cột là một ngày. Màu sắc phân biệt học tập, vận động và ôn tập; buổi đã hoàn thành có trạng thái riêng.”

## 1:50–2:50 — Cảnh báo trùng giờ và Pomodoro
1. Tạo một buổi mới cùng ngày và giờ giao nhau với buổi đã có.
2. Chỉ ra cảnh báo tên buổi đang bị trùng; dữ liệu không được lưu.
3. Đổi sang giờ liền kề (ví dụ buổi trước kết thúc 10:00, buổi sau bắt đầu 10:00) để cho thấy không bị báo nhầm.
4. Bấm **Bắt đầu học**, chỉ ra URL có `eventId` và `goalId`.

Lời dẫn: “Hai khoảng thời gian giao nhau mới bị chặn; các buổi nối tiếp nhau vẫn hợp lệ. Khi sang Pomodoro, ngữ cảnh của lịch và mục tiêu được truyền theo URL.”

## 2:50–3:40 — Hướng dẫn Camera & quyền riêng tư
1. Bấm **Hướng dẫn Camera & quyền riêng tư**.
2. Chỉ các bước cho phép camera trong trình duyệt, xử lý khi đã chặn quyền và lưu ý HTTPS/localhost.
3. Nhấn **Đã hiểu** để đóng modal.

## 3:40–4:30 — Xử lý lỗi thân thiện
1. Trình bày trang `src/app/error.tsx` trong code hoặc dùng kịch bản lỗi đã chuẩn bị trên môi trường demo.
2. Chỉ nút **Thử lại**, đường dẫn **Về trang chủ** và mã tham chiếu lỗi (nếu có).

## 4:30–5:00 — QA và kết luận
Trình bày kết quả thực tế của ba lệnh sau (chỉ đánh dấu đạt khi đã chạy thành công trên đúng branch):

```bash
npx tsc --noEmit
npm test
npm run build
```

Kết luận: “Phần Calendar có lịch tuần, kiểm tra xung đột giờ và nối ngữ cảnh sang Pomodoro; người dùng có hướng dẫn camera và trang phục hồi khi gặp lỗi. Các test tích hợp Exercise Hysteresis và Daily Streak cần được chạy lại sau khi nhận module mới nhất từ Hải Anh và Huy.”
