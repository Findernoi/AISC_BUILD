# Database tuyển dụng giai đoạn 1

## Offer trong ứng dụng (migration 9)

`202610180009_offers.sql` bổ sung `recruitment_offers`, RLS đọc theo chủ hồ sơ/HR và các RPC `read_offers`, `issue_offer`, `respond_offer`. Chạy sau migration 1–8; local tự áp dụng, chưa áp dụng cloud. Thông báo trong ứng dụng, không gửi email thật. Xem [kịch bản demo, hợp đồng API, trạng thái và giới hạn](../../docs/OFFERS_DEMO.md).

HR chỉ phát hành từ quyết định hire mới nhất còn khớp căn cứ hiện tại; expectedDecisionId/expectedBasis/expectedOfferId chặn dữ liệu cũ và ghi đè offer pending ngoài ý muốn. Phát hành lại giữ bản cũ superseded; decision mới cũng supersede pending. Ứng viên chỉ phản hồi offer của mình một lần với revision hiện tại, pending còn hiệu lực, app offer/passed và vị trí đang mở. accepted chuyển app accepted/passed; declined chuyển withdrawn/rejected nhưng vẫn lưu riêng ở offer. Đây là đồng ý nhận đề nghị, chưa xác nhận đã bắt đầu làm việc. Lưu phản hồi/trạng thái cùng transaction và dùng advisory lock; raw authenticated writes bị chặn, audit ghi actor/thời điểm.

## Quy tắc minh chứng hiện tại: HR chỉ xử lý ngoại lệ (migration 8)

Quy tắc này thay thế yêu cầu review thủ công bắt buộc được mô tả ở các mốc cũ bên dưới. Áp dụng `202610180008_evidence_exceptions.sql` sau migration 7; local tự áp dụng, chưa thay đổi cloud. Engine `local-ocr-rules-v2`: đủ trường khớp, đúng snapshot tên/khai báo và hash hiện tại, không đọc thiếu trang → tự tính điểm ngoại ngữ/thành tích, không cần HR duyệt. Thành tích cần cả tên, đơn vị cấp và cấp (`school|national|international`); hỗ trợ nhãn `Level`/`Cấp` rõ ràng. Điểm tối đa và công thức giữ nguyên. Nhãn “Khớp thông tin tự động” không xác nhận tính thật từ đơn vị cấp.

- `GET /api/recruitment/evidence-exceptions`: HR-only, trả `{report:{total,rows}}` các tệp mới nhất từng loại ngoại ngữ/thành tích còn ngoại lệ. Đếm toàn bộ, hiển thị 200 tệp cũ nhất. Tệp khớp/đã xử lý/tệp cũ/CV không vào hàng chờ.
- `GET/POST /api/recruitment/files/:id/check` trả thêm `assessment` bên cạnh `check`; chủ hồ sơ và HR được đọc, B không đọc tệp A. Trạng thái `automatic|exception|accepted|rejected|obsolete|not_scored` là trạng thái tính điểm riêng với status OCR. Kết quả v1 thiếu snapshot không tự được nâng lên v2, cần đọc lại; hết thời gian OCR/thiếu kết quả vẫn ở hàng chờ và HR có thể đọc lại hoặc xử lý bản gốc.
- `POST /api/recruitment/files/:id/resolve-exception`: HR gửi `{expectedBasis,outcome:'accept'|'reject',reason}`. Kết luận gắn đúng tệp/hash/khai báo/check hiện tại; thiếu lý do, forged actor/score bị từ chối; stale/tệp cũ/không còn ngoại lệ trả 409. Không chấp nhận tác động phần điểm minh chứng, không tự rejected hồ sơ. Raw insert/update `evidence_reviews` qua authenticated bị thu hồi; actor lấy từ phiên HR.
- Review lịch sử còn đúng file/claims giữ tương thích. Cột trạng thái cũ `verified` được dùng nội bộ cho kết luận chấp nhận; UI không mô tả là xác thực nguồn cấp. Check mới làm kết luận ngoại lệ cũ cần xem lại; không ghi đè hay reset dữ liệu ứng viên. Bảng review lưu kết luận hiện tại, audit lưu người/thời điểm/trường thay đổi.
- Điểm dùng tệp mới nhất, check được ghi từ server; claims_snapshot được chụp trước khi OCR để không gắn kết quả cũ vào tên mới khi xử lý đang chạy. Ghi check dùng advisory lock và tăng revision; thay đổi điểm/căn cứ làm quyết định cũ cần duyệt lại. Công thức vòng 1 mang version `round-one-v2-evidence-exceptions`; không sửa điểm snapshot/lịch sử cũ.


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

<a id="doc-va-doi-chieu-tu-dong"></a>
## Đọc và đối chiếu tự động

Migration `202610180004_evidence_checks.sql` thêm `application_files.declared_fields` và bảng `evidence_checks` có RLS. Local tự nâng schema khi mở database; cloud cần quản trị viên áp dụng migration sau ba migration trước. Schema preview local cũng có bảng kết quả này. Không nhập tệp/hồ sơ cũ sang dịch vụ ngoài.

Luồng cổng ứng tuyển: ứng viên khai thông tin → lưu tệp/hash → tự gửi yêu cầu đọc/đối chiếu → hiển thị kết quả. Tệp vẫn lưu thành công khi OCR lỗi/bận; có thể bấm đọc lại sau. Tệp cũ có nút khởi chạy kiểm tra. Kết quả được lưu theo file ID, SHA-256, hash thông tin khai báo/họ tên và phiên bản engine. Sửa tên hồ sơ làm kết quả cũ có cờ `stale`; thêm tệp tạo ID mới và không kế thừa kết quả của tệp cũ. Kiểm tra không thay đổi trạng thái ứng tuyển hoặc điểm tuyển dụng.

PDF.js đọc lớp chữ; trang không có đủ chữ được render rồi OCR bằng Tesseract Anh/Việt. Chỉ xử lý tối đa 5 trang, đánh dấu chưa đầy đủ nếu còn trang. Worker có thời hạn 60 giây và giới hạn heap JS; ảnh tối đa 12 megapixel, trang PDF được thu nhỏ trước OCR. Lớp chữ PDF có thể khác phần nhìn thấy nên kết quả khớp không chứng minh tài liệu thật. OCR/parser có thể sai; lỗi đọc chuyển về không đọc được/cần HR xem, không tự từ chối ứng viên.

Bộ quy tắc v1 nhận các nhãn rõ ràng: Name/Full name/Candidate name/Họ và tên; IELTS/TOEIC/TOEFL; Overall Band Score/Total Score/Điểm; Date of issue/Ngày cấp; TRF Number/Certificate Number/Mã chứng chỉ; Achievement/Award/Thành tích và Issuer/Đơn vị cấp. Dạng ngày ISO hoặc ngày/tháng/năm. Bố cục/nhãn khác, nhiều giá trị mâu thuẫn hoặc thiếu khai báo dẫn tới cần HR xem. Chuẩn hóa dấu và chữ hoa/thường khi so tên, không đoán tên gần giống. Chỉ kết luận các trường đã khai và đọc được; không suy ra kinh nghiệm, ngành, tính thật hoặc tình trạng sinh viên.

Độ rõ OCR dưới 85 hoặc nhiều giá trị cho cùng trường được gắn chưa rõ. Đây là ngưỡng kỹ thuật ban đầu, không phải xác suất tài liệu thật và chưa hiệu chỉnh trên tập chứng chỉ UIT. Không tự áp dụng thời hạn chứng chỉ vì chưa có chính sách tuyển dụng cụ thể. Chưa nối IELTS/ETS hay nguồn cấp nào; `issuer_verified` luôn false. Chưa tích hợp OCR với điểm vòng 1, kết quả duyệt HR hoặc quyết định tuyển dụng.

Ứng viên chỉ xem kết quả của tệp mình; HR xem hồ sơ được phép. Không cấp insert/update/delete `evidence_checks` cho client kể cả HR. Chỉ API server ghi kết quả đã tính sau khi xác thực và đọc tệp bằng RLS; Supabase dùng service-role cho insert có giới hạn vào bảng kết quả này, còn CRUD hồ sơ và metadata tệp tiếp tục dùng JWT người gọi. Đây là ngoại lệ server ghi kết quả máy tính, không cấp quyền ghi tuỳ ý từ request. Lưu lịch sử các lần đọc, người khởi chạy/thời gian và căn cứ theo trang trong bảng riêng; không tự tạo dấu duyệt `evidence_reviews`.

Kiểm thử bao gồm OCR thật trên ảnh tổng hợp, đọc PDF thật, tên có dấu, điểm 0, sai lệch điểm/tên, thiếu trường, nhiều giá trị, điểm OCR thấp, trang giới hạn, nội dung giả lệnh trong tài liệu, cache/stale, RLS và API không nhận kết quả giả. Các fixture là dữ liệu kiểm thử, chưa phải đánh giá độ chính xác trên minh chứng thực tế. Chưa chạy migration hoặc kiểm thử OCR/Supabase cloud thật.

## Vòng 1 và top 10

Migration `202610180005_round_one.sql` thêm hàm tính điểm, RPC báo cáo và RPC mời vòng 2. Local tự áp dụng sau migration 4; cloud cần chạy sau các migration trước. Giao diện demo cũ vẫn giữ logic TypeScript để minh họa; cổng ứng tuyển dùng PostgreSQL làm nguồn điểm chính, có kiểm thử so sánh công thức giữa hai luồng.

Công thức: GPA quy về thang 4 tối đa 25; kỹ năng khớp từ khóa yêu cầu vị trí tối đa 30; số dự án x5 tối đa 15 và số tháng kinh nghiệm/6 x5 tối đa 5; ngoại ngữ đã xác minh tối đa 15 theo điểm/thang chứng chỉ; thành tích đã xác minh 4/7/10 theo cấp trường/quốc gia/quốc tế; GPA từ 3.6 cộng 3. Tổng chặn ở 100 và làm tròn một chữ số. Giá trị thiếu không biến thành dữ liệu 0 trong hồ sơ, nhưng không nhận điểm ở phần chưa khai.

Top 10 cần >=75 điểm, GPA >= yêu cầu vị trí, email ứng viên đúng miền UIT, vị trí đang mở, không rejected và giai đoạn applied/cv_passed/interview. Hồ sơ đã offer/accepted/withdrawn không xếp. Bằng điểm xếp theo UUID tăng dần. Đã mời vẫn nằm trong top 10 nếu còn đủ điều kiện; không tự đôn hạng 11 sau khi đã mời hạng 1. Chỉ applied/cv_passed chưa có lời mời mới có thể được chọn mời.

OCR matched không phải bằng chứng xác minh và không tự cộng điểm. Điểm ngoại ngữ/thành tích chỉ dùng tệp mới nhất của loại đó có `evidence_reviews.status=verified`, nguồn đối chiếu, đúng hash và snapshot tên/khai báo hiện tại. Migration thêm snapshot bằng trigger vào review mới/cập nhật; review cũ chưa có snapshot không được tính điểm cho đến khi được xác minh lại. Sửa tên, thay tệp hoặc thay thông tin liên quan làm điểm minh chứng cần xác minh lại. Cấp thành tích là khai báo, OCR không tự xác nhận cấp giải thưởng. Chưa thêm vòng HR duyệt bắt buộc cho tất cả hồ sơ hoặc màn hình duyệt riêng trong thay đổi này.

RPC báo cáo chỉ cho HR, tính trên toàn bộ pool trước khi chọn 200 dòng để hiển thị. Mỗi dòng có điểm thành phần, GPA chuẩn hóa, lý do không đủ điều kiện, hạng, cờ top 10, lời mời đã lưu và cảnh báo OCR cần xem thêm. Cảnh báo OCR không tự loại hồ sơ.

RPC mời kiểm tra lại quyền HR, bộ lọc, điều kiện và top 10 trong cùng transaction. ID không hợp lệ hoặc thay đổi thứ hạng làm rollback cả batch. Chọn lại lời mời đã có trong cùng phạm vi giữ nguyên ngày/người mời và điểm snapshot cũ. Lời mời lưu version công thức, bộ lọc, revision lúc chọn và điểm thành phần; ứng dụng chuyển sang interview/passed. Không gửi email hoặc quyết định tuyển tự động.

Advisory lock theo transaction và trigger trước statement đồng bộ hóa thay đổi vị trí, hồ sơ, tệp, review và lời mời với lúc chọn top 10. Đây là khóa toàn tổ chức trong phạm vi schema một tổ chức hiện tại; phù hợp bản đầu, sẽ cần đo tải và thu hẹp khóa nếu quy mô tăng. Không chạy OCR hay gọi mạng trong transaction mời. Raw insert vào invitations bị thu hồi khỏi authenticated; HR dùng RPC để không tự ghi điểm hoặc bỏ qua top 10. Quyền cập nhật các nghiệp vụ khác vẫn giữ RLS như trước.

Kiểm thử PostgreSQL/PGlite gồm công thức tương đương frontend, hai thang GPA, thiếu/0, giới hạn số nguyên, top 10 khi có hơn 200 hồ sơ, bộ lọc, GPA thấp/vị trí đóng/rút đơn, chặn candidate/raw insert, rollback toàn batch, lời mời idempotent, OCR không cộng điểm, snapshot review và API JWT/RLS. Chưa chạy kiểm thử đồng thời nhiều kết nối PostgreSQL/Supabase cloud; PGlite dùng một kết nối. Chưa áp dụng migration cloud trong bước này.

## Vòng 2 qua API/database (18/10/2026)

Áp dụng thêm `202610180006_round_two.sql` sau migration 5 khi triển khai cloud. Chế độ `npm run dev:recruitment` tự áp dụng migration vào database local hiện có; không reset dữ liệu. Chưa áp dụng migration này lên cloud.

Cổng `/?view=applications` có mục **Vòng 2 · Lịch và đánh giá phỏng vấn**. Chọn hồ sơ đã có lời mời: HR lưu lịch (ngày giờ, thời lượng, địa điểm/đường dẫn, người phỏng vấn, hướng dẫn), điểm bài test 0–100 và phiếu 5 tiêu chí 1–10 kèm bằng chứng. Database tính điểm phỏng vấn với trọng số 30/25/15/15/15; người ghi nhận lấy từ JWT/phiên HR. Ứng viên chỉ đọc lịch của mình; điểm, bằng chứng và ghi chú đánh giá vẫn chỉ dành cho HR. Chưa gửi email, tạo sự kiện lịch, tổng hợp quyết định/offer hoặc công bố điểm cho ứng viên.

- `GET /api/recruitment/applications/:id/round-two`: `{report:{revision,schedule,coding,interview}}`; RLS che dữ liệu đánh giá khỏi ứng viên, hồ sơ người khác trả 404.
- `POST /api/recruitment/applications/:id/round-two`: `{expectedRevision,kind,data}`, với `kind` là `schedule`, `coding`, `interview`; hợp đồng chi tiết ở `shared/recruitment.ts`.
- Chỉ HR được ghi vào hồ sơ đã mời, stage `interview`, status `passed`. RPC `save_round_two` kiểm tra quyền, phiên bản và dữ liệu trong cùng transaction; phiên bản cũ trả 409. Khi gặp 409, bấm **Tải lại vòng 2**, kiểm tra dữ liệu mới và nhập lại thay đổi. Mỗi lần lưu tăng revision hồ sơ; chặn ghi trực tiếp bảng điểm qua authenticated để không bỏ qua kiểm tra này.
- Giờ lưu dạng timestamptz; ô nhập dùng múi giờ trình duyệt, lịch đã lưu hiển thị giờ Việt Nam. Chỉ lưu thông tin lịch, không kiểm tra trùng lịch của người phỏng vấn.

## Tổng hợp và quyết định qua API/database (18/10/2026)

Migration 7 `202610180007_hiring_decisions.sql` chạy sau migration 6; local tự áp dụng khi khởi động, chưa áp dụng cloud. Portal HR có bảng tổng hợp các hồ sơ đã mời trong tập dữ liệu đang tải (tối đa 200), sắp điểm giảm dần, UUID để ổn định khi bằng điểm; đây không phải báo cáo xếp hạng toàn bộ database.

- `GET /api/recruitment/applications/:id/hiring?roundOne=30&coding=30&interview=40` trả `{report}`: căn cứ hiện tại (`basis`), điểm thành phần, điểm tổng hoặc lý do chưa đủ, tỷ trọng và lịch sử quyết định.
- `POST /api/recruitment/applications/:id/hiring` nhận `{expectedBasis,weights:{roundOne,coding,interview},result,reason}`; `result` là `hire|reserve|reject`. Server không nhận điểm/người duyệt do trình duyệt tự gửi. Trả 201 với quyết định mới; 409 nếu căn cứ đã đổi. GET/POST và các RPC chỉ cho HR.
- Tỷ trọng là số nguyên 0–100, tổng 100. Mặc định 30/30/40, khớp demo; tổng database làm tròn hai chữ số, demo cũ một chữ số. Điểm vòng 1 tính lại từ dữ liệu hiện tại; không dùng snapshot lời mời hoặc xác suất placement. Cần đầy đủ cả hai đánh giá dù tỷ trọng của một phần bằng 0; bài test 0 là điểm hợp lệ.
- Cần lời mời, stage interview/offer, email/ngành/GPA hợp lệ, vị trí đang mở. Không có điểm tổng tự động chọn tuyển. Chọn tuyển → offer/passed, dự phòng → interview/hold, không chọn → interview/rejected. Offer là chờ đề nghị tuyển, chưa accepted. Có thể ghi quyết định mới từ dữ liệu hiện tại, giữ toàn bộ lịch sử cũ.
- Lưu điểm thành phần, điểm tổng generated, tỷ trọng, lý do, JWT actor, thời điểm, revision và `source_basis`. Hash gồm hồ sơ/vị trí/lời mời/đánh giá/điểm vòng 1; thay đổi dữ liệu kể cả yêu cầu vị trí làm căn cứ cũ không còn hợp lệ. Status và snapshot cùng transaction; raw insert vào quyết định bị thu hồi khỏi authenticated. Các ghi điểm dùng cùng advisory lock với quyết định trước khi khóa hàng. Chưa kiểm tra đồng thời nhiều kết nối PostgreSQL production.
- UI báo cần duyệt lại khi dữ liệu hoặc tỷ trọng khác lịch sử gần nhất. Tải lại tổng hợp trước khi duyệt nếu 409. Thay tỷ trọng không sửa các quyết định đã lưu. Điểm/ghi chú/lý do/lịch sử vẫn chỉ HR xem; ứng viên thấy trạng thái hồ sơ của mình. Chưa có công bố kết quả có kiểm soát, offer letter, email thật hoặc ghi nhận ứng viên chấp nhận/từ chối offer trong thay đổi này.
