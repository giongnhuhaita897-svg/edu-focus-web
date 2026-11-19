# Kế hoạch Triển khai Nhóm — EduFocus AI (Sprint 2 Tuần)

> Tài liệu thống nhất phân công, lộ trình 14 ngày, quy tắc Git, SQL Supabase cho Quân, checklist kỹ thuật từng thành viên và giải thích khái niệm cơ bản cho cả nhóm.

---

## 1. Bảng Phân công 6 Thành viên & Phân vùng Thư mục (Chống Merge Conflict)

| Thành viên | Thiết bị | Vai trò & Nhiệm vụ chính | Thư mục / File sở hữu | Nhánh Git |
| :--- | :--- | :--- | :--- | :--- |
| **Trưởng nhóm** | Windows | **Tech Lead & Người ghép mạch:** Duyệt PR, giữ ổn định Webcam Học tập, chốt kiểu dữ liệu và hỗ trợ gỡ lỗi chung. | `src/modules/webcam/StudyFocusCameraPanel.tsx`, `src/types/database.ts` | `main` |
| **1. Huy** | **MacBook** | **Co-Lead Kỹ thuật + Analytics + Pomodoro Sync + Mac/Safari QA:** Làm thống kê/biểu đồ tuần, chuỗi kỷ luật (Streak), nối mạch Pomodoro ↔ Webcam và test tương thích macOS/Safari. | `src/modules/analytics/*` *(mới)*, `src/modules/pomodoro/PomodoroHub.tsx`, `src/app/page.tsx` | `feat/analytics-pomodoro` |
| **2. Hải Anh** | Windows | **Webcam Thể dục & Đếm nhịp AI:** Gắn MediaPipe `PoseLandmarker` vào Tab 2, viết bộ đếm nhịp 2 ngưỡng (Hysteresis) cho 3 bài tập và hỗ trợ Privacy Mode. | `src/modules/webcam/ExerciseCameraPanel.tsx` *(mới)*, `src/modules/webcam/exercise-tracker.ts` *(mới)*, nhúng vào `WebcamPlaceholder.tsx` | `feat/webcam-exercise` |
| **3. Cường** | Windows | **Cố vấn AI (Google Gemini API) + Vercel + Domain (GitHub Pro):** Nối AI Mentor thật với Gemini API (JSON có cấu trúc), dựng link HTTPS Vercel sớm & gắn tên miền riêng. | `src/app/api/ai-mentor/route.ts`, `src/modules/ai-tutor/*`, Cấu hình Vercel & DNS | `feat/gemini-mentor-deploy` |
| **4. Quân** | Windows | **Supabase Auth & Lưu trữ Bền vững:** Tạo CSDL Supabase, Đăng nhập/Đăng ký và đồng bộ mục tiêu, lịch trình, lịch sử phiên học khi thoát ra vào lại. | `src/lib/supabase/*` *(mới)*, `src/app/login/*` *(mới)*, cầu nối đồng bộ `src/lib/storage/local-db.ts` | `feat/supabase-auth-db` |
| **5. Dũng** | Windows | **Lưới Lịch Tuần + UX Hướng dẫn + QA Gatekeeper:** Làm lưới lịch tuần 7 ngày, cảnh báo trùng giờ, màn hình hướng dẫn/xử lý lỗi & giữ bộ test Vitest luôn xanh. | `src/modules/calendar/*`, `src/components/onboarding/*` *(mới)*, `src/__tests__/*` | `feat/calendar-week-qa` |

---

## 2. Lộ trình Thực hiện 14 Ngày

```text
NGÀY 1–2: KHÓA NỀN TẢNG & DỰNG LINK CHUNG
  • Trưởng nhóm: Xóa nhánh webcam-the-duc cũ; phổ biến quy tắc Git & AGENTS.md.
  • Quân: Tạo project Supabase Free, chạy SQL tạo 5 bảng + RLS + tắt Confirm Email.
  • Cường: Nối GitHub -> Vercel lấy link Preview HTTPS ngay (để Hải Anh & Huy có HTTPS test Camera).
           Đồng thời kích hoạt GitHub Student Pack để lấy tên miền miễn phí.

NGÀY 3–7: CÀY SONG SONG TRÊN 5 NHÁNH ĐỘC LẬP
  • Ngày 4: Quân mở PR đầu tiên (Auth + Storage Sync chạy song song localStorage) -> Merge sớm.
  • Ngày 5–7: Hải Anh xong PoseLandmarker đếm 3 bài tập; Cường xong /api/ai-mentor gọi Gemini + fallback;
              Dũng xong Lưới Lịch Tuần + Cảnh báo trùng giờ; Huy xong Biểu đồ 7 ngày + Streak.

NGÀY 8–10: GHÉP NỐI & NỐI MẠCH TOÀN HỆ THỐNG
  • Thứ tự merge vào main: (1) Quân -> (2) Hải Anh -> (3) Dũng -> (4) Cường -> (5) Huy.
  • Huy nối mạch Calendar -> Pomodoro -> Webcam Học -> Webcam Thể dục & test hết trên MacBook Safari.
  • Dũng viết test Vitest phủ các tính năng mới & tạo bộ UX hướng dẫn / xử lý lỗi.

NGÀY 11–12: GẮN TÊN MIỀN THẬT & STRESS TEST CHÉO
  • Cường trỏ tên miền miễn phí về Vercel, nạp GEMINI_API_KEY & SUPABASE_* lên Vercel Env Vars, kiểm SSL.
  • Cả nhóm mở link tên miền thật test cùng lúc: tạo tài khoản mới -> đặt mục tiêu -> hỏi AI -> học Webcam ->
    tập Thể dục -> tắt trình duyệt mở máy khác đăng nhập lại kiểm tra dữ liệu.

NGÀY 13–14: ĐÓNG BĂNG CODE & CHUẨN BỊ BẢO VỆ ĐỒ ÁN
  • Không thêm tính năng mới sau Ngày 12 (Code Freeze), chỉ sửa bug nhỏ.
  • Dũng + Huy chạy lại: npx tsc --noEmit, npm test, npm run build xanh 100%.
  • Chốt kịch bản demo 5 phút (tạo sẵn 1 tài khoản demo chuẩn + giữ luồng Khách phòng mất mạng).
```

---

## 3. Quy tắc Git & Phối hợp Bắt buộc (Đọc kỹ trước khi code)

### Khởi động ngày đầu trên máy mỗi bạn
```bash
git pull origin main
npm install
npm test
```
Chỉ khi `npm test` báo xanh hết mới bắt đầu tạo nhánh riêng:
```bash
git checkout -b feat/ten-nhanh-cua-ban
```

### 5 Nguyên tắc chống mất code & xung đột
1. **Cấm push thẳng lên `main`:** Luôn code trên nhánh `feat/...`, xong thì `git push -u origin feat/...` rồi tạo Pull Request để Trưởng nhóm hoặc Huy duyệt.
2. **Sáng nào cũng kéo `main` mới nhất:** `git pull origin main` trước khi làm việc để tránh lệch code.
3. **Không tự ý sửa 4 file dùng chung:** `package.json`, `src/types/database.ts`, `src/lib/storage/local-db.ts`, `src/components/layout/Sidebar.tsx`. Ai cần sửa phải nhắn lên nhóm trước.
4. **Cấm commit file bí mật:** Tuyệt đối không đưa `.env` hay `.env.local` lên GitHub.
5. **Kiểm tra 3 lệnh trước khi mở Pull Request:**
   - `npx tsc --noEmit` (kiểm tra lỗi kiểu TypeScript)
   - `npm test` (chạy kiểm thử tự động Vitest)
   - `npm run build` (bắt lỗi đóng gói & lỗi viết hoa/thường tên file giữa Windows và Mac/Vercel)

---

## 4. Gói Hướng dẫn & SQL cho Quân (Supabase Auth + Lưu trữ)

### Bước 1: Thiết lập Supabase Dashboard
1. Tạo Project mới trên [supabase.com](https://supabase.com) (chọn Region `Singapore`).
2. Vào **Authentication → Providers → Email** → **TẮT** mục **Confirm email** (để đăng ký xong vào lưu mục tiêu được ngay khi test/demo).
3. Vào **Project Settings → API** lấy `Project URL` và `anon public key`, bỏ vào `.env.local`:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
   ```

### Bước 2: Chạy SQL tạo 5 bảng + Trigger + Bảo mật RLS
Vào **SQL Editor → New Query**, dán toàn bộ đoạn SQL sau và bấm **Run**:

```sql
-- 1. Bảng hồ sơ người dùng (tự động tạo khi user đăng ký)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default 'Học viên EduFocus',
  daily_target_minutes integer not null default 120 check (daily_target_minutes > 0),
  updated_at timestamptz not null default now()
);

-- 2. Bảng Mục tiêu (khớp interface Goal)
create table if not exists public.goals (
  user_id uuid not null references public.profiles(id) on delete cascade,
  id text not null,
  title text not null,
  description text not null default '',
  category text not null check (category in ('academic', 'skill', 'health')),
  target_hours double precision not null check (target_hours > 0),
  completed_hours double precision not null default 0 check (completed_hours >= 0),
  deadline text not null,
  progress_percent integer not null default 0 check (progress_percent between 0 and 100),
  status text not null default 'active' check (status in ('active', 'completed', 'paused')),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

-- 3. Bảng Lịch trình (khớp interface ScheduleEvent)
create table if not exists public.schedule_events (
  user_id uuid not null references public.profiles(id) on delete cascade,
  id text not null,
  goal_id text,
  title text not null,
  date text not null,
  start_time text not null,
  end_time text not null,
  type text not null check (type in ('study', 'exercise', 'review')),
  status text not null default 'planned' check (status in ('planned', 'completed', 'missed')),
  notes text,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

-- 4. Bảng Nhật ký Phiên tập trung & Vận động (khớp interface FocusSession)
create table if not exists public.focus_sessions (
  user_id uuid not null references public.profiles(id) on delete cascade,
  id text not null,
  schedule_event_id text,
  mode text not null check (mode in ('study_focus', 'exercise_break')),
  pomodoro_preset text check (pomodoro_preset is null or pomodoro_preset in ('25_5', '50_15')),
  started_at timestamptz not null,
  ended_at timestamptz not null,
  duration_minutes integer not null default 0 check (duration_minutes >= 0),
  focus_score_percent integer not null default 100 check (focus_score_percent between 0 and 100),
  distraction_count integer not null default 0 check (distraction_count >= 0),
  drowsiness_alert_count integer,
  penalized boolean not null default false,
  penalty_reason text,
  exercise_type text check (exercise_type is null or exercise_type in ('overhead_reach', 'squat', 'shoulder_stretch')),
  completed_reps integer,
  target_reps integer,
  primary key (user_id, id)
);

-- 5. Bảng Lịch sử Chat AI Mentor (khớp interface AIMessage)
create table if not exists public.ai_messages (
  user_id uuid not null references public.profiles(id) on delete cascade,
  id text not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now(),
  suggested_actions jsonb,
  primary key (user_id, id)
);

-- Index hỗ trợ truy vấn nhanh theo user và ngày
create index if not exists idx_schedule_events_user_date on public.schedule_events(user_id, date);
create index if not exists idx_focus_sessions_user_started on public.focus_sessions(user_id, started_at desc);
create index if not exists idx_ai_messages_user_created on public.ai_messages(user_id, created_at asc);

-- Trigger tự động tạo profile ngay khi user đăng ký tài khoản mới
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Bật Row Level Security (RLS) cho tất cả bảng
alter table public.profiles enable row level security;
alter table public.goals enable row level security;
alter table public.schedule_events enable row level security;
alter table public.focus_sessions enable row level security;
alter table public.ai_messages enable row level security;

create policy "Users manage own profile"
  on public.profiles for all
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Users manage own goals"
  on public.goals for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage own schedule events"
  on public.schedule_events for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage own focus sessions"
  on public.focus_sessions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage own ai messages"
  on public.ai_messages for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

### Bước 3: Checklist code của Quân (`feat/supabase-auth-db`)
- [ ] Cài `@supabase/supabase-js` (`npm install @supabase/supabase-js`).
- [ ] Tạo `src/lib/supabase/client.ts` (trả về `null` an toàn nếu thiếu env khi chạy test local).
- [ ] Tạo `src/lib/supabase/mapper.ts` (chuyển đổi `camelCase` ↔ `snake_case`).
- [ ] Tạo `src/lib/supabase/sync.ts`:
  - `pullStateFromSupabase(userId)` tải 4 bảng về gộp thành `AppDatabaseState` và ghi vào `localStorage`.
  - `pushStateToSupabase(userId, state)` xử lý cả **Thêm/Sửa (`upsert`)** và **Xóa (`delete`)** những `id` không còn trong `state` (có debounce ~400ms).
- [ ] Tạo trang `src/app/login/page.tsx` (Đăng nhập / Đăng ký theo bảng màu `#F8FAFC`, `#2563EB`).
- [ ] Gắn nút **"Đăng nhập / Đồng bộ Cloud"** trên `AppShell.tsx` hoặc `Sidebar.tsx` (không chặn chế độ Khách dùng thử, không sửa tham số các hàm cũ trong `local-db.ts`).
- [ ] Nghiệm thu: Tạo mục tiêu khi đăng nhập → mở Tab Ẩn danh đăng nhập lại → dữ liệu vẫn còn nguyên.

---

## 5. Checklist Kỹ thuật cho 4 Bạn Còn Lại

### Hải Anh (Windows) — Webcam Thể dục & Đếm nhịp AI (`feat/webcam-exercise`)
- [ ] Tách nhánh mới từ `main`: `git checkout main && git pull && git checkout -b feat/webcam-exercise`.
- [ ] Tải `pose_landmarker_lite.task` vào `public/models/` và thêm `POSE_LANDMARKER_ASSETS` + `EXERCISE_THRESHOLDS` vào `src/modules/webcam/thresholds.ts` (có link CDN dự phòng).
- [ ] Tạo `src/modules/webcam/exercise-tracker.ts`:
  - Tính góc khớp 2D `calculateAngleDeg(a, b, c)` và cơ chế **2 ngưỡng Hysteresis** (lên đỉnh → hạ về chuẩn bị mới cộng `+1 nhịp`).
  - Hỗ trợ đủ 3 bài: `overhead_reach`, `shoulder_stretch`, và `squat` (lưu ý webcam laptop thường không thấy chân nên cần hỗ trợ thêm độ tụt tọa độ Y của 2 vai khi hiệu chỉnh).
- [ ] Tạo `src/modules/webcam/ExerciseCameraPanel.tsx`:
  - Tái sử dụng `pickPreferredCameraDeviceId`, `runWithFilteredMediaPipeLogs`, `resolveWasmRoot` từ `face-landmarker-loader.ts`.
  - Vẽ khung xương lên `<canvas>` theo đủ 3 chế độ `CameraPrivacyMode` (`skeleton_only`, `standard`, `minimal`).
  - Lưu phiên tập qua `recordExerciseSessionInState(...)`.
- [ ] Nhúng `<ExerciseCameraPanel />` vào Tab 2 của `src/modules/webcam/WebcamPlaceholder.tsx`.

### Cường (Windows) — Google Gemini AI Mentor + Vercel + Domain (`feat/gemini-mentor-deploy`)
- [ ] **Ngày 1–2:** Kích hoạt **GitHub Student Developer Pack** để lấy tên miền miễn phí (`.me` / `.tech`...).
- [ ] **Ngày 1–2:** Nối repo lên **Vercel** lấy link `.vercel.app` HTTPS cho nhóm test Webcam (nếu vướng quyền Vercel Hobby với repo chủ nhóm, dùng GitHub Actions + `VERCEL_TOKEN`).
- [ ] Lấy `GEMINI_API_KEY` tại Google AI Studio, lưu vào `.env.local` và **Vercel Environment Variables** (tuyệt đối không đặt `NEXT_PUBLIC_`).
- [ ] Nâng cấp `src/app/api/ai-mentor/route.ts` gọi Gemini (`gemini-2.5-flash` hoặc `gemini-2.0-flash`) với `responseMimeType: "application/json"` trả về `{ content, suggestedActions }`.
- [ ] Bọc `try/catch` + timeout ~10s: tự động **fallback về `generateMentorResponse` trong `src/modules/ai-tutor/ai-engine.ts`** nếu lỗi mạng/hết quota.
- [ ] Sửa `src/modules/ai-tutor/AIMentorPlaceholder.tsx` gọi `fetch("/api/ai-mentor", { method: "POST", ... })` kèm trạng thái loading và khóa nút gửi khi đang chờ.
- [ ] Trỏ DNS tên miền miễn phí về Vercel và kiểm tra SSL HTTPS.

### Huy (MacBook) — Co-Lead, Analytics, Pomodoro Sync & Safari QA (`feat/analytics-pomodoro`)
- [ ] Tạo `src/modules/analytics/analytics-engine.ts`: tính phút Học vs Vận động **7 ngày gần nhất**, **Daily Streak** (chuỗi ngày kỷ luật), và danh sách **Huy hiệu**.
- [ ] Tạo `src/modules/analytics/WeeklyFocusChart.tsx` bằng **SVG/Tailwind thuần** (tránh xung đột React 19) và gắn lên `src/app/page.tsx`.
- [ ] Nối mạch `Calendar` ↔ `Pomodoro` (`PomodoroHub.tsx`) ↔ `Webcam` (`WebcamPlaceholder.tsx`) qua query param `?goalId=...&eventId=...&preset=...&tab=...`.
  - *Lưu ý Next.js 15:* Bọc component dùng `useSearchParams()` trong `<Suspense>` để `npm run build` không lỗi, và nhớ cập nhật mock `next/navigation` trong `src/__tests__/foundation.test.tsx` nếu cần.
- [ ] Khi hết pha Học ở Pomodoro: phát âm báo + hiện nút chuyển 1 chạm sang Tab 2 Tập thể dục giải lao.
- [ ] **Test đặc thù MacBook/Safari:** kiểm tra mở khóa `AudioContext` / `tip-tip-tip.mp3` trên Safari, kiểm tra iPhone Continuity Camera trong `pickPreferredCameraDeviceId`, và review PR kiểm tra lỗi viết hoa/thường tên file.

### Dũng (Windows) — Lưới Lịch Tuần, UX Hướng dẫn & QA Gatekeeper (`feat/calendar-week-qa`)
- [ ] Tạo `src/modules/calendar/WeekCalendarGrid.tsx` hiển thị lịch **7 ngày (Thứ 2 → Chủ nhật)** làm chế độ xem thứ 3 trong `CalendarPlaceholder.tsx`.
- [ ] Viết kiểm tra trùng giờ `findOverlappingEvent(...)` để cảnh báo khi tạo/sửa buổi lịch đè giờ nhau.
- [ ] Sửa nút `"Bắt đầu học"` trong `CalendarPlaceholder.tsx` truyền kèm `?eventId=...&goalId=...` sang `/pomodoro`.
- [ ] Tạo `src/app/error.tsx` (Error Boundary giao diện thân thiện) và modal/hướng dẫn **Cấp quyền Camera & Quyền riêng tư** trong `src/components/onboarding/`.
- [ ] Viết thêm unit test Vitest trong `src/__tests__/` cho: đếm nhịp thể dục, trùng lịch, Streak/Analytics, fallback AI Mentor.
- [ ] Chạy đủ `npx tsc --noEmit`, `npm test`, `npm run build` trước mọi lần merge vào `main` và soạn kịch bản demo 5 phút.

---

## 6. Giải thích nhanh các khái niệm khó (Dành cho người mới)

- **Branch (Nhánh) & Pull Request:** `main` là "cuốn sổ gốc", còn mỗi nhánh `feat/...` là "tờ giấy nháp" riêng của từng bạn. Code xong thì tạo Pull Request để trưởng nhóm duyệt rồi mới dán vào `main`.
- **Merge Conflict:** Xảy ra khi 2 bạn cùng sửa đúng 1 dòng trong 1 file. Chia mỗi người một thư mục riêng như bảng trên sẽ tránh được tới 90% lỗi này.
- **`localStorage` vs Supabase:** `localStorage` lưu tạm trên trình duyệt của 1 máy (xóa cache hoặc đổi máy là mất); Supabase lưu trên mây nên đăng nhập ở đâu cũng còn.
- **RLS (Row Level Security):** "Ổ khóa riêng" của từng tài khoản trên Supabase — ai đăng nhập nick nào chỉ đọc/sửa được mục tiêu của nick đó.
- **Trigger:** Cơ chế tự động trong database — hễ có người vừa đăng ký tài khoản mới, database tự tạo sẵn cho họ 1 dòng hồ sơ `profiles`.
- **API Route (`/api/...`) & `.env.local`:** Giao diện trình duyệt là "mặt tiền quán" ai bấm `F12` cũng xem được; còn `/api/...` là "phòng bếp" cất `GEMINI_API_KEY` trong két sắt `.env.local` để người lạ không lấy trộm key được.
- **Fallback:** "Máy phát điện dự phòng" — nếu Gemini API hết lượt miễn phí hoặc mất mạng lúc chấm bài, web tự chuyển về bộ trả lời sẵn cục bộ để không bị sập.
- **Hysteresis (2 ngưỡng):** Cơ chế chống đếm nhầm khi tập thể dục — bắt buộc phải đi hết biên độ lên (vượt ngưỡng trên) rồi hạ xuống hẳn (dưới ngưỡng dưới) mới tính `+1 nhịp`.
- **HTTPS trên Vercel:** Trình duyệt chặn bật Webcam nếu link web không có ổ khóa `https://` (trừ `localhost`). Đưa lên Vercel sớm giúp cả nhóm test Webcam thật trên mọi máy.
- **Lỗi Hoa/Thường tên file:** Windows không phân biệt `Sidebar.tsx` và `sidebar.tsx`, nhưng MacBook và máy chủ Vercel (Linux) có phân biệt — sai 1 chữ hoa là build thất bại.
