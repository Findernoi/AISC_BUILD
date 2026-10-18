# Rà soát toàn luồng A/B/HR — 18/10/2026

Phạm vi: cổng API/database `/?view=applications`, từ nộp hồ sơ đến quyết định HR. Không triển khai cloud, gửi email, nhận phản hồi offer hoặc nối dự báo vào backend. Mốc trước rà soát là `f999255`; người dùng đã xem local và duyệt push thay đổi rà soát trong commit chứa cập nhật này.

## Kết quả

`npm run lint`, `npm test`, `npm run build` và `git diff --check` đều đạt. Có 107 tests, không có test thất bại. Vite còn cảnh báo chunk lớn. Kiểm thử xuyên suốt mới ở `backend/tests/recruitment-flow.test.ts` dùng Express + PostgreSQL/PGlite riêng, kho tệp trong bộ nhớ và bộ đọc PDF thật; không chỉnh database local của người dùng.

| Chặng | Kiểm tra | Kết quả |
|---|---|---|
| Phiên và hồ sơ | A/B nộp cùng vị trí; mỗi người chỉ đọc hồ sơ mình, HR đọc cả hai; nộp trùng trả 409, khách bị chặn | Đạt |
| Tệp riêng tư | A và HR đọc đúng byte CV; B/khách không đọc danh sách/tệp/kết quả A | Đạt |
| Đối chiếu | PDF ngoại ngữ khớp tự tính điểm; cấp thành tích sai vào hàng chờ, không cộng phần điểm đó | Đạt |
| Ngoại lệ | HR từ chối phần điểm, tệp rời hàng chờ; trạng thái ứng viên vẫn pending; candidate không xử lý được | Đạt |
| Vòng 1 | Điểm 90.5 đúng công thức với IELTS 7.5; A đủ top 10, B thiếu điểm không đủ; chỉ HR được mời | Đạt |
| Lời mời | A chỉ đọc lời mời của mình, B không thấy lời mời A | Đạt |
| Phỏng vấn | Lưu lịch, bài test 0 và phiếu đủ 5 tiêu chí; lịch cũ trả 409, ngày không tồn tại trả 400 | Đạt |
| Quyền vòng 2 | A đọc lịch nhưng không đọc điểm/ghi chú; B không đọc được hồ sơ A bằng ID | Đạt |
| Quyết định | HR lưu điểm tổng 59.15 với 30/30/40 và bài test 0; không áp đặt ngưỡng tự chọn; chuyển offer/passed, chưa accepted | Đạt |
| Dữ liệu cũ | Đọc lại OCR làm căn cứ thay đổi; quyết định với basis cũ trả 409, lịch sử giữ nguyên | Đạt |
| Đăng xuất | Cookie cũ A bị thu hồi; B vẫn chỉ đọc hồ sơ B | Đạt |

Các tests riêng tiếp tục kiểm tra OCR ảnh/PDF scan, độ rõ/đọc thiếu/thiếu trường, hash/claims/tệp mới, RLS, score parity, scope và rollback cả batch mời. Kiểm thử dữ liệu bền và các lần thử UI trước đã xác nhận lưu qua restart; rà soát này giữ nguyên database/tệp hiện có.

## Đã sửa

- Form ngoại ngữ dùng giới hạn theo loại: IELTS 0–9 bước 0.5; TOEIC 0–990 và TOEFL 0–120 bước 1. Đổi loại xóa điểm nhập trước để tránh giữ điểm của loại khác. Server vẫn kiểm tra độc lập.
- API lịch từ chối ngày không tồn tại như 31/02, 31/04 và giờ 24:00 thay vì để JavaScript tự đổi ngày. Test giữ nguyên thời điểm khi đổi múi giờ và chấp nhận 29/02 năm nhuận.
- Tải lại dữ liệu dùng AbortController và phiên bản phiên đăng nhập: yêu cầu cũ bị hủy/không được cập nhật state sau khi đổi tài khoản; yêu cầu tải lại mới thay thế yêu cầu cũ. Đã kiểm tra chuyển tài khoản trên UI, chưa mô phỏng browser mạng chậm có kiểm soát để stress race này.
- Mục vòng 2 tải lại theo revision hồ sơ, tránh giữ revision cũ sau thao tác minh chứng; làm rõ thông báo chỉ sửa đánh giá ở interview/passed.
- README chính được thống nhất theo API hiện tại; bỏ ví dụ tạo bảng profiles/jobs không còn khớp schema và các mô tả “chưa có backend phỏng vấn/quyết định”. Demo cũ được ghi rõ là dữ liệu trình duyệt.

## Kiểm tra giao diện local

- B đăng nhập thấy 0 hồ sơ, không có mục HR; A đăng nhập thấy đúng 1 hồ sơ thử và các tệp của mình, không có mục HR.
- Form A hiển thị đúng ba giới hạn điểm khi đổi loại chứng chỉ; tệp thử khớp được ghi “Khớp thông tin tự động · được tính điểm theo công thức”. Không upload hoặc tạo thêm hồ sơ để thử form này.
- HR vẫn có hàng chờ ngoại lệ mẫu, bảng vòng 1, vòng 2 và tổng hợp. Chỉ dùng hồ sơ/tệp giả đã có trên máy.

## Giới hạn và việc kế tiếp

- Chưa kiểm tra trên Supabase thật hoặc tải đồng thời nhiều kết nối PostgreSQL; PGlite dùng một kết nối. Không gọi tác vụ cloud hoặc email thật.
- Danh sách portal giới hạn 200 hồ sơ/vị trí/lời mời. Vòng 1 xếp trên toàn bộ bộ lọc trước khi giới hạn hiển thị; vòng 2/tổng hợp dựa trên tập portal đang tải.
- Sau quyết định, sửa đánh giá chỉ khi interview/passed; chưa có thao tác mở lại đánh giá riêng cho hold/rejected/offer. Có thể lưu quyết định mới theo dữ liệu hiện tại và giữ lịch sử; không tự coi offer là nhận việc.
- Còn hai bước trong phạm vi hoàn thiện bản dùng thử đã bàn: offer/phản hồi ứng viên và nối dự báo với dữ liệu tuyển dụng backend. Sau đó mới chuẩn bị cloud và gửi email thật nếu người dùng yêu cầu. OTP riêng vẫn chưa được yêu cầu triển khai.
