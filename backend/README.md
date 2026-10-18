# Backend

Mã Express hiện có nằm trong `src/server.ts`. Chạy từ thư mục gốc bằng `npm run dev`; dependencies và cấu hình TypeScript dùng chung ở gốc.

## API hiện có

- `GET /api/health`: trạng thái ứng dụng.
- `GET /api/auth/config`: trạng thái cấu hình Supabase.
- `GET /api/auth/me`: kiểm tra Bearer token qua Supabase.
- `POST /api/ai/screen-resume`: sàng lọc thử nghiệm qua Gemini hoặc công thức fallback.

Đây là server thử nghiệm được giữ lại từ bản frontend. Dữ liệu tuyển dụng của giao diện vẫn nằm trên trình duyệt; các API chưa thay thế luồng tuyển dụng demo.

## Khi phát triển backend

Tách routes, controllers, services và repositories trong `src/` khi triển khai từng chức năng. Định nghĩa request/response dùng chung tại `shared/`, bổ sung database migrations và kiểm tra quyền truy cập cho ứng viên/HR. Giữ API dưới `/api` để frontend có thể gọi cùng origin.

`.env` đặt ở gốc. Gemini API key và Supabase service role key chỉ dùng phía server. Khi production, build frontend trước rồi chạy `npm start` với `NODE_ENV=production`.
