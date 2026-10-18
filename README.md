# TalentForecast AI cho sinh viên UIT

Demo frontend tuyển thực tập sinh UIT thuộc KHMT, KTPM và AI: kiểm tra định dạng email trường, tính điểm hồ sơ, đề xuất top 10 và hỗ trợ quyết định của HR.

## Cấu trúc dự án

```text
frontend/             React + Vite, giao diện và kiểm thử nghiệp vụ
  src/                components, context, data demo, lib, types
  tests/              Kiểm thử logic frontend
  index.html          Trang đầu vào của Vite
  vite.config.ts      Cấu hình build frontend
backend/
  src/server.ts       Express và các API thử nghiệm hiện có
  README.md           Phạm vi backend và hướng phát triển
scripts/              Tiện ích quản lý dự án
shared/               Hợp đồng API/type dùng chung khi có backend mới
data/                 Dữ liệu nghiên cứu và dữ liệu giả lập
ml/                   Thử nghiệm ML offline
docs/                 Tài liệu nghiệp vụ
package.json          Lệnh chạy và dependencies dùng chung
package-lock.json     Lockfile npm
```

Frontend hiện chủ yếu dùng localStorage/IndexedDB và dữ liệu mẫu. Backend có sẵn health check, kiểm tra Supabase và API sàng lọc thử nghiệm; chưa có backend tuyển dụng hoàn chỉnh. Type giao diện vẫn ở `frontend/src/types/` cho đến khi xác định hợp đồng API.

Cài dependencies và chạy mọi lệnh từ thư mục gốc. `npm run dev` chạy Express tại cổng 3000 và gắn Vite middleware phục vụ `frontend/`. `npm run build` tạo `frontend/dist/`. Sau khi build, chạy production trên PowerShell:

```powershell
$env:NODE_ENV="production"
npm start
```

`npm run preview` chỉ xem bản build frontend. File `.env` vẫn đặt ở gốc; Vite và backend cùng đọc từ vị trí này. Chỉ biến bắt đầu bằng `VITE_` được dùng ở trình duyệt. `tmp/`, `output/`, `.aistudio/`, dependencies và bản build không đưa lên Git.

## Chạy thử

```sh
npm install --legacy-peer-deps
npm run dev
```

Mở `http://localhost:3000`, chọn **Khám phá bản demo frontend** và **Thêm bộ hồ sơ mẫu UIT**. Hồ sơ mẫu được gắn nhãn minh họa; không cần tài khoản hoặc API để thử. Dữ liệu cũ được giữ lại.

## Luồng chính

- **Tổng quan tuyển dụng**: dự báo nhu cầu nhân lực doanh nghiệp, xác suất ứng viên được tuyển, thống kê qua từng vòng, vị trí và giả định nhận offer cố định 75%.
- **Vòng 1 và top 10**: email đúng miền `@gm.uit.edu.vn`, ngành và GPA tự khai; duyệt minh chứng thành tích/ngoại ngữ trước khi cộng điểm. Chọn tối đa 10 hồ sơ đủ chuẩn, HR chọn ai vào vòng 2.
- **Vòng 2 phỏng vấn**: câu hỏi/đáp án mẫu, 5 tiêu chí thang 1–10 và điểm bài test lập trình 0–100 HR ghi nhận từ bài làm bên ngoài app.
- **Quyết định**: tổng hợp 30% vòng 1, 30% bài test lập trình, 40% phỏng vấn theo mặc định; HR chỉnh tỷ trọng tổng 100%, chọn kết quả và mô phỏng email.

Xem [hướng dẫn và các điểm cần làm rõ](docs/frontend-demo.md).

## Dữ liệu và giới hạn

Hồ sơ lưu trong localStorage, CV/minh chứng lưu trong IndexedDB. Kiểm tra email chỉ kiểm tra định dạng miền, chưa xác thực quyền sở hữu hộp thư. Không có bước duyệt ngành/GPA; GPA tự khai vẫn dùng để tính điểm và điểm cộng GPA cao. Minh chứng thành tích/ngoại ngữ mẫu chỉ có giá trị minh họa trong demo.

Đã khôi phục hai màn hình dự báo trong Tổng quan tuyển dụng. Nhu cầu nhân lực ngoại suy tuyến tính từ lịch sử tổng intern cần có theo vị trí; không dùng số tin tuyển dụng thị trường. HR nhập lịch sử 6 tháng, tháng cuối và số intern hiện tại trong Vị trí tuyển dụng. Xác suất tuyển dụng dùng công thức logistic minh họa chỉ với dữ liệu trước vòng 2, không thay điểm vòng 1/top 10 hoặc tự quyết định tuyển. Cả hai đều ghi rõ chưa có mô hình ML được huấn luyện và kiểm định trên dataset thật. Tỷ lệ chuyển đổi là thống kê lịch sử; 75% nhận offer là giả định chung, không phải mô hình ML. Ước tính chỉ gồm offer đang chờ và người đã nhận việc, không áp dụng cho hồ sơ chưa có offer.

Điểm vòng 1 tính theo tiêu chí công khai, khớp kỹ năng theo từ khóa. Chưa có trích xuất CV tự động hoặc đối sánh ngữ nghĩa AI trong luồng mới. Không có màn hình làm bài/chấm code trên app; HR nhập điểm bài test lập trình. Email chỉ mô phỏng, không gửi thư thật. Không dùng chuyên cần hoặc đánh giá đồng nghiệp.

## Kiểm tra

Bộ dữ liệu ML dự báo nhu cầu intern theo tháng/phòng ban nằm trong [data/workforce_synthetic](data/workforce_synthetic/README.md): 2.790 dòng lịch sử giả lập, 2.400 mẫu học, mẫu nhập dữ liệu thật và từ điển cột. Mã mô phỏng, huấn luyện Ridge và báo cáo đánh giá nằm ở `ml/workforce/`. Đây là thử nghiệm offline trên dữ liệu giả lập, chưa nối mô hình mới vào web và chưa kiểm định trên doanh nghiệp thật.

```sh
npm run lint
npm test
npm run build
```

Kiểm thử bao gồm miền email chính xác, GPA tự khai, top 10, minh chứng thành tích, điều kiện đủ điểm vòng 2, tỷ trọng 100%, thống kê lịch sử, giả định offer 75%, mốc dự báo và dữ liệu thiếu, GPA tương đương và chống rò rỉ điểm vòng 2 vào xác suất vòng hồ sơ.

## Optional Supabase integration


This project already includes a Vite + React front-end paired with an Express server. To connect it to Supabase for database and auth, follow the steps below.

## 1) Create a Supabase project

1. Go to https://supabase.com and create a project.
2. Open Project settings > API.
3. Copy:
   - Project URL
   - anon public key
   - service role key

## 2) Configure environment variables

Create a `.env` file in the project root based on `.env.example`:

```env
GEMINI_API_KEY="your-gemini-api-key"
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_ANON_KEY="your-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
VITE_SUPABASE_URL="https://your-project.supabase.co"
VITE_SUPABASE_ANON_KEY="your-anon-key"
```

Do not expose the service role key in the browser. Only the anon key belongs in the client.

## 3) Backend usage

The Express backend now exposes basic Supabase auth checks:

- `GET /api/health` — app health
- `GET /api/auth/config` — checks whether Supabase is configured
- `GET /api/auth/me` — validate a Bearer token and return the authenticated user

Example request:

```bash
curl -H "Authorization: Bearer <supabase-access-token>" http://localhost:3000/api/auth/me
```

## 4) Front-end usage

The app now displays a Supabase email/password sign-in screen, supports account registration, restores the current session on reload, and provides sign out. If email confirmation is enabled in Supabase, users must confirm their address before signing in.

The file `frontend/src/lib/supabase.ts` exports a browser-safe client:

```ts
import { getSupabaseClient } from './lib/supabase';

const supabase = getSupabaseClient();
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'password123',
});
```

## 5) Supabase database setup

Create tables such as `profiles` and `jobs` in Supabase SQL editor, for example:

```sql
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  full_name text,
  avatar_url text,
  created_at timestamptz default now()
);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  department text,
  created_at timestamptz default now()
);
```

Then enable Row Level Security (RLS) and configure policies for your app.

## 6) Run the app

```bash
npm install --legacy-peer-deps
npm run dev
```

Open the local URL shown by Vite and the Express server and test the Supabase connection.
