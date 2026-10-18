# Database tuyển dụng giai đoạn 1

Migration: `migrations/202610180001_recruitment.sql`. Thiết kế cho **một tổ chức tuyển dụng**, PostgreSQL 15+ và Supabase Auth. Chưa hỗ trợ nhiều doanh nghiệp/tenant; không dùng chung schema này cho nhiều tổ chức nếu chưa bổ sung tenant isolation.

## Xem và kiểm tra local

```powershell
npm ci --legacy-peer-deps
npm run test:database
npm run dev:database
```

Mở `http://127.0.0.1:3000/?view=database`, chọn **Khám phá bản demo frontend**. Trong **Tổng quan tuyển dụng → Database (local)**, đổi HR, ứng viên A/B hoặc khách để xem số dòng được PostgreSQL cho phép đọc. Màn hình cũng lấy cột và policies từ catalog database sau khi chạy migration.

Preview dùng PGlite trong bộ nhớ, seed 3 tài khoản và 2 hồ sơ giả lập. `auth.users`, `auth.uid()` và hai vai trò PostgreSQL trong harness chỉ để kiểm thử tương thích RLS, không thay Supabase Auth thật hoặc xác thực JWT. Mỗi request chạy `SET LOCAL ROLE` và claim theo transaction, không dùng bộ lọc JavaScript để giả lập RLS. Không ghi Supabase thật, không dùng hồ sơ localStorage hoặc gọi dịch vụ email. Khởi động lại server sẽ tạo lại dữ liệu mẫu.

`GET /api/database/preview?identity=hr|candidate_a|candidate_b|anonymous` chỉ bật với `DATABASE_PREVIEW=true`, development và kết nối loopback. `dev:database` tự bật cờ đó, tắt HMR và bind 127.0.0.1. Production trả 404. Không dùng endpoint này làm API tuyển dụng.

## Các bảng và quan hệ

- `profiles` tham chiếu `auth.users`: tên/điện thoại. Không có cột role để người dùng tự sửa.
- `private.staff_memberships`: kho HR/admin, chỉ quản trị viên có quyền SQL quản lý; metadata đăng ký không được cấp quyền.
- `jobs`: JD, điều kiện và trạng thái mở tuyển.
- `applications`: snapshot thông tin tự khai; một người/vị trí chỉ một hồ sơ. Giữ `legacy_id` để chuẩn bị import có kiểm soát, chưa tự import dữ liệu cũ. Không có trường số lần thực tập.
- `application_files`: metadata, hash và đường dẫn tệp. API upload/tải tệp đã có; bytes local ở thư mục riêng, cloud dùng bucket riêng tư sau migration thứ ba.
- `evidence_reviews`: dấu duyệt gắn composite FK tới đúng file/application/SHA-256.
- `interview_invitations`: HR chọn vòng 2, điểm vòng 1 từ 75, GPA đạt vị trí đang mở. Rubric và việc lựa chọn top 10 phải được tính/kiểm tra bởi API ở giai đoạn tiếp theo.
- `coding_evaluations`, `interview_evaluations`: chỉ có sau lời mời; điểm code 0 hợp lệ, phỏng vấn bắt buộc 5 tiêu chí/bằng chứng và có tổng điểm generated.
- `hiring_decisions`: chỉ thêm, giữ lịch sử. Trigger chụp điểm code/phỏng vấn hiện tại và revision của hồ sơ; trọng số tổng 100%, tổng điểm do DB tính. Điểm vòng 1 do HR/API cung cấp trong giai đoạn này, chưa có bộ tính rubric phía server.
- `email_outbox`: thư nháp, hàng đợi, sent/failed. HR không tự đặt trạng thái sent. Quyết định sai hồ sơ, sai địa chỉ người nhận hoặc đã cũ không được xếp hàng. Chưa có worker gửi thư.
- `workforce_snapshots`: lưu đầu vào có nguồn, cờ giả lập và mốc một tháng. Database không tự gọi hoặc quyết định model áp dụng cho dữ liệu thật; API suy luận phải giữ kiểm tra phạm vi của model.
- `audit_events`: trigger ghi người thao tác, bảng, ID và tên cột thay đổi; không sao chép CV hoặc toàn bộ nội dung cũ. Client kể cả HR không được sửa/xóa log.

## Ràng buộc và quyền

Ứng viên nộp bằng email UIT đã xác nhận trên Supabase, phải khớp email của chính tài khoản. Hồ sơ đã nộp không được client ứng viên tự sửa trực tiếp; luồng yêu cầu bổ sung/rút đơn sẽ dùng API chuyên biệt sau. Applicant/job/contact email của hồ sơ là snapshot bất biến. GPA kiểm tra đúng thang 4 hoặc 10, ngành chỉ KHMT/KTPM/AI, dữ liệu thiếu khác 0.

Ứng viên đọc hồ sơ/minh chứng/lời mời của mình và thư đã gửi; không đọc điểm, ghi chú phỏng vấn hoặc quyết định nội bộ. HR quản lý dữ liệu nghiệp vụ, nhưng không sửa lịch sử quyết định/audit. RLS kiểm tra vai trò từ bảng riêng và yêu cầu tài khoản HR đã xác nhận email. Không gắn quyền HR với nút chuyển giao diện.

Thay đổi nội dung hồ sơ, metadata tệp, đánh giá minh chứng, lời mời hoặc điểm sẽ tăng `applications.revision`. Thư dùng quyết định cũ bị chặn khi xếp hàng. API/worker sau này phải kiểm tra lại quyết định mới nhất và revision trước khi gửi; schema này chưa tự gửi hoặc hủy thư đang xử lý. Thay tên/thông tin chứng chỉ/thành tích cũng phải khiến API yêu cầu xét lại minh chứng; FK file/hash hiện chỉ bảo đảm không áp dấu duyệt sang file khác.

## Áp dụng lên Supabase sau khi duyệt

Chưa chạy migration lên cloud trong thay đổi này. Dùng project mới hoặc kiểm tra xung đột bảng `profiles`, `jobs` trước; migration không xóa/thay bảng cũ và không dùng `IF NOT EXISTS` để che giấu schema không tương thích. Migration nằm trong transaction: lỗi thì rollback.

Sau khi schema được duyệt, quản trị viên có thể chạy nội dung migration bằng Supabase SQL Editor hoặc đưa file vào `supabase/migrations/` của dự án CLI rồi chạy quy trình migration của nhóm. Harness/seed trong `database-preview.ts` **không** được chạy trên Supabase thật.

Supabase Auth cung cấp `auth.users`, `auth.uid()` và roles `anon`/`authenticated`; migration tự tạo hồ sơ khi signup, backfill hồ sơ cho tài khoản đã tồn tại nhưng không gán ai thành HR. Sau khi xác định đúng UUID của một tài khoản đã xác nhận email, quản trị viên SQL cấp quyền:

```sql
-- Thay UUID bằng người được phê duyệt; không mở thao tác này cho client.
insert into private.staff_memberships(user_id, role)
values ('UUID_TAI_KHOAN_HR_DA_XAC_NHAN', 'hr');
```

API CRUD sau này nên dùng JWT của người gọi để RLS áp dụng; service-role key chỉ ở server và chỉ dùng cho tác vụ đặc quyền được kiểm soát. Không dùng service-role để bỏ qua RLS cho mọi thao tác ứng viên.

## Những việc chưa triển khai ở giai đoạn này

Nối các màn hình chấm điểm/phỏng vấn/quyết định cũ vào API; quy trình đổi email/rút hồ sơ; xét lại minh chứng sau thay thông tin; worker email và cơ chế claim chống gửi trùng; kiểm thử JWT/Supabase Storage trên project thật; backup/retention; RLS multi-tenant.

API tiếp nhận hồ sơ mới không thay điểm rubric, top 10, model ML hoặc dữ liệu trình duyệt cũ; chưa gửi email thật.

<a id="luong-nop-ho-so-qua-api"></a>
## Luồng nộp hồ sơ qua API

Đã bổ sung cổng `/?view=applications`: xem vị trí, đăng nhập/đăng ký, nộp hồ sơ, xem hồ sơ của mình; HR xem hồ sơ đã nộp và tạo vị trí. Đã nối upload CV/minh chứng; chưa nối chấm điểm, lời mời, quyết định hoặc email vào API này. Form nhận thông tin học tập, kỹ năng và dự án; sau khi nộp có thể thêm tệp tại hồ sơ đã lưu; không yêu cầu số lần thực tập. Hồ sơ cũ trong localStorage không tự nhập sang database.

### Thử trên máy

Chạy `npm run dev:recruitment`. Ba tài khoản giả A/B/HR chỉ được chọn khi bật cờ `RECRUITMENT_LOCAL=true`, không phải production và request tới localhost. Phiên dùng cookie HttpOnly/SameSite Strict, có thời hạn và bị thu hồi khi đăng xuất; các request ghi yêu cầu Origin trùng server. Không đưa endpoint tài khoản mẫu lên môi trường dùng dữ liệu thật.

Database PGlite lưu trong `.local/recruitment/` ở gốc (đã ignore Git). Lần đầu tự tạo schema và hai vị trí, các lần sau giữ hồ sơ. Không chạy đồng thời hai server dùng cùng thư mục database. Phiên mẫu mất khi server khởi động lại nhưng hồ sơ vẫn còn; đăng nhập mẫu lại để xem. Chỉ dùng dữ liệu giả. Trang `/?view=database` đọc cùng database này khi chạy `dev:recruitment`; `dev:database` riêng vẫn dùng fixture trong bộ nhớ.

### Dùng Supabase thật

1. Rà soát project/bảng hiện có rồi áp dụng `202610180001_recruitment.sql`, sau đó `202610180002_recruitment_role.sql`. Nếu đã áp dụng migration đầu thì chỉ chạy migration thứ hai. Không chạy harness/seed local trên cloud.
2. Cấu hình `SUPABASE_URL`, `SUPABASE_ANON_KEY` ở server; `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` cùng project ở frontend. Không đưa service-role key vào biến VITE. API mới không cần service-role key.
3. Cấu hình URL xác nhận email/redirect trong Supabase Auth phù hợp với địa chỉ chạy app. Ứng viên đăng ký và xác nhận email UIT. Không có cơ chế tự nâng tài khoản thành HR.
4. Xác định đúng UUID tài khoản HR đã xác nhận email rồi quản trị viên cấp membership theo SQL ở trên. Hàm `public.recruitment_role()` chỉ trả vai trò của chính người gọi, không lộ danh sách nhân sự.
5. Chạy `npm run dev` hoặc build/chạy production. API xác minh Bearer token bằng Supabase Auth `getUser(token)`, lấy vai trò từ RPC và tạo client riêng cho từng request với access token người gọi/anon key. RLS tiếp tục lọc dữ liệu ở database; không dùng service-role để đọc/ghi thay ứng viên.
6. Kiểm tra hai tài khoản ứng viên và một HR trên project thật trước khi sử dụng chính thức. Trong lần thay đổi này chỉ kiểm thử PostgreSQL local, HTTP API và mô phỏng phản hồi Auth/PostgREST; chưa áp dụng hay kiểm thử cloud thật.

Backend chỉ nhận các trường được cho phép, tự gán applicant/email, không nhận điểm, trạng thái hay revision từ form. Database chặn nộp trùng và vị trí đóng. Thông tin chưa khai khác giá trị 0. Thao tác ghi phát sinh audit bằng trigger. Giới hạn hiện tại là 200 bản ghi mỗi danh sách, chưa phân trang/tìm kiếm phía server.

## Kho CV/minh chứng riêng tư

Chạy `npm run dev:recruitment`, đăng nhập ứng viên A/B, nộp thông tin hồ sơ rồi dùng mục **CV và minh chứng → Thêm CV hoặc minh chứng**. CV nhận PDF; chứng chỉ ngoại ngữ/thành tích nhận PDF, PNG, JPEG, tối đa 10 MiB mỗi tệp. HR đăng nhập, mở cùng mục trong hồ sơ để xem hoặc tải bản gốc. PDF render bằng PDF.js trên canvas, có chuyển trang, không thực thi JavaScript/XFA của tài liệu; ảnh hiển thị trực tiếp. Không tự xác minh tính thật của chứng chỉ qua thao tác tải lên.

Server kiểm tra signature, đuôi tên tệp, byte size và loại minh chứng; không tin MIME do trình duyệt khai. Kiểm tra signature không thay cho phân tích toàn bộ định dạng hoặc quét mã độc. Parser PDF phía giao diện báo lỗi nếu nội dung không đọc được. Chưa có antivirus, tổng quota theo tài khoản, OCR hoặc luồng xóa/thu hồi tệp. Mỗi lần thêm tạo đường dẫn UUID mới, không ghi đè bản cũ hoặc chuyển dấu duyệt file/hash sang bản khác. Upload tăng revision hồ sơ qua trigger hiện có.

Bytes trên máy ở `.local/uploads/<user UUID>/<application UUID>/<file UUID>.<ext>`, nằm ngoài public web root. Metadata/bytes giữ qua lần khởi động server; cả hai thư mục `.local/uploads/` và `.local/recruitment/` cần đi cùng nhau khi backup. Không đưa bytes người dùng lên GitHub. Người pull repo tự tạo dữ liệu local riêng.

Cloud cần áp dụng migration thứ ba `202610180003_private_documents.sql` sau hai migration tuyển dụng. Migration tạo bucket `application-documents` riêng tư; nếu bucket cũ đang public thì dừng để quản trị viên rà soát. Policy restrictive chặn anon/authenticated truy cập trực tiếp bytes kể cả khi có policy permissive từ trước. Không tự áp dụng migration lên cloud trong thay đổi này.

API xác minh JWT và dùng RLS của `applications`/`application_files` để xác định đúng chủ hồ sơ hoặc HR trước khi sử dụng service-role key cho các thao tác storage bị giới hạn trong bucket này. Tên bucket và đường dẫn không nhận từ client; server sinh UUID. Metadata tiếp tục ghi bằng JWT ứng viên nên trạng thái hồ sơ được RLS kiểm tra lại. Cần `SUPABASE_SERVICE_ROLE_KEY` chỉ trên server khi dùng storage cloud; không đặt vào biến `VITE_`.

Khi metadata insert thất bại, API cố xóa bytes chưa đăng ký; trường hợp cleanup thất bại được ghi log bằng object path để quản trị viên dọn orphan sau. Storage và database không phải cùng transaction nên mất điện/lỗi giữa hai bước vẫn có thể tạo orphan; chưa có worker tự đối soát. Khi tải tệp, API xác minh owner/path, kích thước, SHA-256 và định dạng trước khi trả nội dung có `Cache-Control: no-store`, `nosniff` và attachment. Không tạo URL public hoặc signed URL. Sau khi người có quyền đã tải tệp, ứng dụng không thể thu hồi bản sao họ lưu trên máy.

Các kiểm thử local kiểm tra HTTP upload/download, RLS giữa hai ứng viên và HR, tệp sai định dạng/quá lớn, hash bị thay, rollback metadata, lưu ổ đĩa và policy Storage qua catalog harness. Chưa kiểm thử dịch vụ Supabase Storage cloud thật.
