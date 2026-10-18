# Backend

Mã Express hiện có nằm trong `src/server.ts`. Chạy từ thư mục gốc bằng `npm run dev`; dependencies và cấu hình TypeScript dùng chung ở gốc.

## Database giai đoạn 1

Đã có [schema, migration và hướng dẫn](database/README.md), kho vai trò HR riêng và Supabase Auth. Tám migration đã được kiểm thử qua PostgreSQL/PGlite, chưa áp dụng cloud. Cổng `/?view=applications` đã dùng database từ nộp hồ sơ đến quyết định; demo ở trang gốc và dự báo vẫn dùng dữ liệu trình duyệt.

```powershell
npm run test:database
npm run dev:database
```

Mở `http://127.0.0.1:3000/?view=database` rồi vào demo để xem bảng, cột và quyền đọc thật qua RLS với tài khoản mẫu. Endpoint preview chỉ bật local development, không phải API production hoặc đăng nhập Supabase thật.

## API hiện có

- `GET /api/health`: trạng thái ứng dụng.
- `GET /api/auth/config`: trạng thái cấu hình Supabase.
- `GET /api/auth/me`: kiểm tra Bearer token qua Supabase.
- `POST /api/ai/screen-resume`: sàng lọc thử nghiệm qua Gemini hoặc công thức fallback.

Các endpoint trên được giữ từ bản demo. Luồng tuyển dụng mới dùng `/api/recruitment` bên dưới, không gọi API sàng lọc Gemini để tính điểm vòng 1 hay quyết định.

## Khi phát triển backend

Routes ở `recruitment-api.ts`, hợp đồng ở `shared/recruitment.ts`, stores ở `recruitment-store.ts`/`recruitment-local.ts`. Giữ API cùng origin, kiểm tra đầu vào ở server và quyền tại RLS/RPC. Không thay JWT người gọi bằng service-role để né quyền.

`.env` đặt ở gốc. Gemini API key và Supabase service role key chỉ dùng phía server. Khi production, build frontend trước rồi chạy `npm start` với `NODE_ENV=production`.

## Luồng nộp hồ sơ qua backend

`npm run dev:recruitment` mở cổng `/?view=applications` với tài khoản local, database lưu trên ổ đĩa và RLS thật. `npm run dev` dùng Supabase và không có đường đăng nhập mẫu. Các API mới nằm dưới `/api/recruitment`, tách khỏi API sàng lọc thử nghiệm cũ.

- `GET /session`: chế độ chạy và danh tính/vai trò đã xác thực.
- `GET /jobs`: tối đa 200 vị trí được phép đọc, vị trí đang mở cho ứng viên/khách.
- `POST /jobs`: HR tạo vị trí.
- `GET /applications`: tối đa 200 hồ sơ mới nhất trong phạm vi RLS.
- `POST /applications`: ứng viên nộp hồ sơ, backend lấy email/owner từ phiên đã xác thực.
- `POST /local-session`, `POST /logout`: phiên mẫu chỉ có trong local mode. Cloud đăng nhập/đăng xuất qua Supabase SDK.

Chi tiết tại [database/README.md](database/README.md#luong-nop-ho-so-qua-api). Chưa chuyển các màn hình chấm điểm cũ sang API.

## CV và minh chứng

- `GET /api/recruitment/applications/:id/files`: danh sách tệp qua RLS.
- `POST /api/recruitment/applications/:id/files?kind=cv|english|achievement`: body nhị phân `application/octet-stream`, tên UTF-8 mã hóa URL trong header `X-File-Name`. Chỉ ứng viên sở hữu hồ sơ được thêm tệp.
- `GET /api/recruitment/files/:id/content`: chủ hồ sơ/HR tải bản gốc sau kiểm tra quyền, size và SHA-256. Không trả URL public.

Local lưu bytes tại `.local/uploads/` và metadata tại `.local/recruitment/`; cả hai đều bị Git ignore. Cloud cần migration `202610180003_private_documents.sql` và service-role key chỉ trên server cho các thao tác storage đã được API kiểm tra quyền. Metadata vẫn đọc/ghi bằng JWT người gọi, không dùng service-role CRUD database.

Frontend dùng PDF.js tải khi mở PDF; fonts/codecs được chuẩn bị tự động trước `npm run dev`, `dev:database`, `dev:recruitment` và `build`. Tệp runtime PDF.js trong `frontend/public/pdfjs/` là tài nguyên sinh từ npm, không commit.

## Đọc/đối chiếu tự động

`POST /api/recruitment/files/:id/check` đọc tệp đã lưu sau xác thực/RLS và kiểm tra hash; body `{}` dùng cache còn hợp lệ, `{ "force": true }` đọc lại. `GET /api/recruitment/files/:id/check` lấy kết quả mới nhất và cờ `stale`. Client không được gửi kết quả/điểm hoặc cờ xác minh. Cùng quyền chủ hồ sơ/HR như tải tệp.

Upload có thể gửi khai báo JSON mã hóa URL trong header `X-Evidence-Declaration`: credential, score, issued_on, reference cho chứng chỉ; title/issuer cho thành tích. Tên lấy từ hồ sơ phía server. Khai báo gắn bất biến với phiên bản tệp; thêm bản mới nếu cần sửa thông tin liên quan tới tệp.

OCR chạy trong worker Node tách biệt, giới hạn 5 trang, 12 megapixel cho ảnh đầu vào và 60 giây/tệp. Mỗi process xử lý một tệp tại một thời điểm, báo bận thay vì xếp hàng vô hạn. Model Anh/Việt đi kèm npm, được chép vào `.local/ocr-traineddata/` khi cần; không tải từ CDN hoặc gọi API AI lúc đọc hồ sơ. Production cần môi trường Node hỗ trợ `@napi-rs/canvas`, đủ CPU/RAM và quyền ghi thư mục model local.

## Vòng 1 và lời mời vòng 2

- `GET /api/recruitment/round-one?jobId=all|UUID&major=all|AI|KHMT|KTPM`: HR xem điểm và xếp hạng. Trả tối đa 200 dòng sau khi tính trên toàn bộ dữ liệu.
- `POST /api/recruitment/round-one/invitations`: body `{applicationIds: [UUID], jobId: "all"|UUID, major: "all"|"AI"|"KHMT"|"KTPM"}`. Chỉ HR, 1–10 ID khác nhau. Không nhận điểm hoặc người mời từ client.
- `GET /api/recruitment/invitations`: HR đọc lời mời, ứng viên chỉ đọc lời mời thuộc hồ sơ của mình qua RLS.
- `POST /api/recruitment/round-one/local-demo`: HR local thêm một lần bộ 12 hồ sơ giả để thử top 10. Production không có đường này.

Tính điểm và lựa chọn nằm trong RPC PostgreSQL dưới JWT người gọi; không dùng service-role để bỏ qua quyền HR. Chi tiết công thức, đồng thời và giới hạn ở database/README.md.
