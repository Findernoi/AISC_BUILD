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

## Thử luồng nộp hồ sơ qua backend

```powershell
npm run dev:recruitment
```

Mở `http://127.0.0.1:3000/?view=applications`. Chọn ứng viên mẫu A/B, nộp hồ sơ, đăng xuất rồi chọn HR để xem hồ sơ. HR cũng có thể tạo vị trí mới. Đây là tài khoản giả lập chỉ có ở development/localhost, không phải đăng nhập Supabase. Dữ liệu PostgreSQL lưu tại `.local/recruitment/`, được giữ qua lần khởi động server và không đưa lên Git. Người khác pull repo rồi chạy lệnh này sẽ có database local riêng với hai vị trí mẫu, chưa có hồ sơ.

Cổng mới dùng API/database; giao diện demo chấm điểm cũ vẫn dùng localStorage/IndexedDB. Đã có upload CV/minh chứng riêng tư và bản xem PDF/ảnh cho HR. Chưa nối vòng phỏng vấn, quyết định hoặc gửi thư thật. Không tự nhập dữ liệu cũ. Khi chạy chế độ này, trang xem database cũng đọc cùng database với cổng ứng tuyển.

`npm run dev` hoặc production dùng Supabase Auth và JWT của người gọi để áp dụng RLS. Trước khi dùng cloud cần áp dụng các migration tuyển dụng và kho tệp theo thứ tự và cấp HR cho đúng tài khoản đã xác nhận; chưa tự chạy migration lên cloud. Xem [API, cách triển khai và giới hạn](backend/database/README.md#luong-nop-ho-so-qua-api).

## Xem thiết kế database local

Đã có schema/migration cho Supabase Auth và 12 bảng nghiệp vụ, kiểm tra RLS bằng PostgreSQL cục bộ. Chưa áp dụng lên Supabase thật hoặc chuyển hồ sơ trình duyệt sang database.

```powershell
npm run test:database
npm run dev:database
```

Mở `http://127.0.0.1:3000/?view=database`, chọn **Khám phá bản demo frontend**, xem **Tổng quan tuyển dụng → Database (local)**. Thử HR mẫu, ứng viên mẫu A/B và khách để kiểm tra dữ liệu mỗi tài khoản được đọc. Preview dùng dữ liệu giả lập trong bộ nhớ, tạo lại khi khởi động server, chỉ bật trên localhost/development. Xem [schema và giới hạn giai đoạn 1](backend/database/README.md).

## Luồng chính

- **Tổng quan tuyển dụng**: dự báo nhu cầu nhân lực doanh nghiệp, xác suất ứng viên được tuyển, thống kê qua từng vòng, vị trí và giả định nhận offer cố định 75%.
- **Vòng 1 và top 10**: email đúng miền `@gm.uit.edu.vn`, ngành và GPA tự khai; duyệt minh chứng thành tích/ngoại ngữ trước khi cộng điểm. Chọn tối đa 10 hồ sơ đủ chuẩn, HR chọn ai vào vòng 2.
- **Vòng 2 phỏng vấn**: câu hỏi/đáp án mẫu, 5 tiêu chí thang 1–10 và điểm bài test lập trình 0–100 HR ghi nhận từ bài làm bên ngoài app.
- **Quyết định**: tổng hợp 30% vòng 1, 30% bài test lập trình, 40% phỏng vấn theo mặc định; HR chỉnh tỷ trọng tổng 100%, chọn kết quả và mô phỏng email.

Xem [hướng dẫn và các điểm cần làm rõ](docs/frontend-demo.md).

## Dữ liệu và giới hạn

Hồ sơ lưu trong localStorage, CV/minh chứng lưu trong IndexedDB. Kiểm tra email chỉ kiểm tra định dạng miền, chưa xác thực quyền sở hữu hộp thư. Không có bước duyệt ngành/GPA; GPA tự khai vẫn dùng để tính điểm và điểm cộng GPA cao. Minh chứng thành tích/ngoại ngữ mẫu chỉ có giá trị minh họa trong demo.

Hai màn hình dự báo đã dùng suy luận TypeScript từ model JSON đã học. Placement chỉ dùng GPA và số dự án, không hỏi số lần thực tập; GPA thang 4 nhân 2,5 là giả định demo. Thiếu số dự án dùng median train và có cảnh báo; giá trị ngoài phạm vi học không bị ép biên. Dataset Campus Recruitment ngoài UIT chưa có đủ thông tin nguồn thu thập và chưa kiểm định khả năng áp dụng tại UIT.

Workforce dùng Ridge trên dữ liệu giả lập. Trong Tổng quan tuyển dụng → Dự báo nhu cầu nhân lực, bấm **Nạp kịch bản SYNTH_CO_01** để gắn snapshot riêng vào ba vị trí mẫu. Dùng 13 tháng lịch sử đến 09/2026 cùng kế hoạch chốt 30/09 để dự báo 10/2026. Có thể chỉnh kế hoạch giả lập và lưu lại trên trình duyệt. Sẵn có tháng tới = max(0, hiện tại − dự kiến kết thúc + đã xác nhận bắt đầu); cần bổ sung = max(0, nhu cầu làm tròn − sẵn có). Chỉ dự báo một tháng, không áp dụng doanh nghiệp mới; vị trí thiếu dữ liệu không tự điền 0. Lịch sử 6 tháng nhập trong Quản lý vị trí vẫn chỉ là thông tin tham chiếu.

Điểm vòng 1/top 10 và quyết định HR không dùng xác suất placement. Tỷ lệ chuyển đổi là thống kê lịch sử; 75% nhận offer là giả định riêng, chỉ áp dụng offer đang chờ và không đếm trùng người đã nhận việc.

Điểm vòng 1 tính theo tiêu chí công khai, khớp kỹ năng theo từ khóa. Chưa có trích xuất CV tự động hoặc đối sánh ngữ nghĩa AI trong luồng mới. Không có màn hình làm bài/chấm code trên app; HR nhập điểm bài test lập trình. Email chỉ mô phỏng, không gửi thư thật. Không dùng chuyên cần hoặc đánh giá đồng nghiệp.

## Kiểm tra

Bộ dữ liệu ML dự báo nhu cầu intern theo tháng/phòng ban nằm trong [data/workforce_synthetic](data/workforce_synthetic/README.md): 2.790 dòng lịch sử giả lập, 2.400 mẫu học, mẫu nhập dữ liệu thật và từ điển cột. Mã mô phỏng, huấn luyện Ridge và báo cáo đánh giá nằm ở `ml/workforce/`. Model đã được export sang frontend cho kịch bản giả lập; chưa kiểm định trên doanh nghiệp thật.

Mô hình placement dùng [Campus Recruitment CSV](data/campus_recruitment/README.md), thay bộ Student Placement Outcomes của cuộc thi Kaggle. Nguồn công bố CC0; ba CSV gốc có tổng 10.000 dòng. Pipeline [ml/placement](ml/placement/README.md) kiểm tra checksum, lọc giao nhau giữa các tập, train Logistic Regression với GPA và số dự án, so sánh baseline và bản ba đầu vào trước đây. [Báo cáo đánh giá](ml/placement/artifacts/EVALUATION.md) lưu kết quả của lần chạy; model và preprocessing được xuất JSON. Model hai đầu vào đã nối frontend, chưa kiểm định tại UIT; cột `Internships` vẫn giữ trong CSV gốc nhưng không đưa vào X hoặc form.

```sh
npm run lint
npm test
npm run build
```

Kiểm thử bao gồm miền email chính xác, GPA tự khai, top 10, minh chứng thành tích, điều kiện đủ điểm vòng 2, tỷ trọng 100%, thống kê lịch sử, giả định offer 75%, mốc dự báo và dữ liệu thiếu, GPA tương đương và chống rò rỉ điểm vòng 2 vào xác suất vòng hồ sơ.

## Tái lập ML và export frontend

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r ml/placement/requirements.txt
.\.venv\Scripts\python.exe -m unittest discover -s ml/placement -p "test_*.py" -v
.\.venv\Scripts\python.exe ml/placement/train.py
.\.venv\Scripts\python.exe ml/export_frontend.py
npm test
```

`ml/export_frontend.py` đồng bộ model và các mẫu đối chiếu với `frontend/src/data/models/`. `npm test` kiểm tra 15 mẫu placement và 30 mẫu workforce giữa Python/TypeScript, sai số dưới 0,000001. Bộ CSV mới được commit cùng nguồn/giấy phép CC0 và checksum; `.gitattributes` giữ nguyên byte CSV khi clone Windows/Linux.

Backend nghiệp vụ đầy đủ (database tuyển dụng, phân quyền HR/ứng viên, CV trên server và email thật) là giai đoạn kế tiếp; bản hiện tại vẫn lưu hồ sơ trong trình duyệt. Không cần cấu hình Supabase để chạy demo hoặc hai model.

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
