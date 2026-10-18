# Backend

Mã Express hiện có nằm trong `src/server.ts`. Chạy từ thư mục gốc bằng `npm run dev`; dependencies và cấu hình TypeScript dùng chung ở gốc.

## Database giai đoạn 1

Đã có [schema, migration và hướng dẫn](database/README.md) cho 12 bảng nghiệp vụ, kho vai trò HR riêng và Supabase Auth. Migration đã được chạy/kiểm thử trên PostgreSQL cục bộ qua PGlite, chưa áp dụng cloud. Ứng dụng chính vẫn lưu dữ liệu trên trình duyệt.

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

Đây là server thử nghiệm được giữ lại từ bản frontend. Dữ liệu tuyển dụng của giao diện vẫn nằm trên trình duyệt; các API chưa thay thế luồng tuyển dụng demo.

## Khi phát triển backend

Tách routes, controllers, services và repositories trong `src/` khi triển khai từng chức năng. Định nghĩa request/response dùng chung tại `shared/`, bổ sung database migrations và kiểm tra quyền truy cập cho ứng viên/HR. Giữ API dưới `/api` để frontend có thể gọi cùng origin.

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
