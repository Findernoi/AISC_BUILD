# Offer trong bản demo

Chạy `npm run dev:recruitment`, mở `http://127.0.0.1:3000/?view=applications`. Đây là thông báo trong ứng dụng, không gửi email, không phát hành hợp đồng/offer letter PDF và không sửa Supabase cloud.

## Trình diễn

1. HR chọn hồ sơ đã có quyết định chọn tuyển. Nếu báo căn cứ đã đổi, tải lại mục tổng hợp và lưu quyết định hire mới trước. Chỉ hồ sơ offer/passed với vị trí đang mở được phát hành.
2. Trong **Offer và phản hồi ứng viên**, chọn hồ sơ, nhập tên vị trí trong đề nghị, ngày bắt đầu dự kiến và nội dung cho ứng viên; bấm **Phát hành offer**.
3. Đăng xuất HR, vào đúng tài khoản ứng viên. Trong **Thông báo offer của tôi**, xem nội dung, chọn chấp nhận/từ chối, thêm lời nhắn nếu muốn và lưu phản hồi.
4. Trở về HR hoặc bấm tải lại: thấy kết quả cùng thời điểm/lời nhắn. Ứng viên khác không thấy nội dung này. Hồ sơ chấp nhận hiển thị “Đã chấp nhận offer”; từ chối chuyển “Đã rút · Đã kết thúc ứng tuyển”.

Máy này có vị trí giả **Vị trí thử offer · Demo** với hồ sơ **Ứng viên A · Thử offer** đã chấp nhận và **Ứng viên B · Thử offer** đã từ chối. Dữ liệu chỉ ở local, không nằm trên Git. Hai phản hồi đã chốt, không có nút reset; để trình diễn lại từ đầu, tạo vị trí mẫu mới rồi nộp/chấm/mời/quyết định trên vị trí mới. Không xóa database.

## Quy tắc

- Offer gắn với decision_id mới nhất và căn cứ quyết định hiện tại. Nội dung riêng, không đưa điểm/lý do nội bộ của HR vào offer API.
- HR có thể phát hành bản thay thế khi offer còn pending: bản cũ thành superseded và không phản hồi được. Lịch sử giữ nguyên. expectedOfferId bảo vệ khỏi ghi đè bằng danh sách cũ.
- Chỉ chủ hồ sơ là ứng viên được phản hồi. expectedRevision, trạng thái pending, giai đoạn hồ sơ, vị trí đang mở và căn cứ decision được kiểm tra trong cùng transaction. Phản hồi lặp/offer lỗi thời trả 409; không tự nhận kết quả mới nhất thay người dùng.
- accepted → stage accepted, status passed. declined → stage withdrawn, status rejected theo schema hiện tại; bảng offer vẫn ghi declined để phân biệt với HR không chọn. Trạng thái và phản hồi lưu cùng transaction, chỉ một kết quả được ghi.
- Chấp nhận offer là đồng ý nhận đề nghị, chưa phải đã bắt đầu thực tập. Ngày bắt đầu là dự kiến. Chưa có đổi phản hồi, hủy offer riêng, hạn phản hồi, nhắc việc, ký điện tử hoặc xác nhận đi làm.
- Quyết định HR mới tự thay thế offer pending cũ. Chỉ thay đổi hồ sơ/điểm/yêu cầu vị trí thì offer vẫn hiện lịch sử nhưng bị khóa phản hồi cho tới khi HR duyệt và phát hành lại.
- Xem tối đa 200 offer mới nhất được phép đọc. Tests dùng database riêng; PGlite kiểm tra hai yêu cầu phản hồi gần nhau nhưng chưa đo đồng thời nhiều kết nối PostgreSQL production.

## API và kiểm tra

- `GET /api/recruitment/offers`: offer được phép đọc, thêm candidate_name và actionable. Không trả căn cứ/điểm nội bộ.
- `POST /api/recruitment/applications/:id/offers`: HR gửi `{expectedOfferId:null|UUID, expectedDecisionId, expectedBasis, positionTitle, startDate, content}`; trả 201 với id. Ngày phải YYYY-MM-DD có thật; nội dung 1–10.000, vị trí 1–200 ký tự.
- `POST /api/recruitment/offers/:id/respond`: chủ hồ sơ gửi `{expectedRevision, outcome:'accepted'|'declined', note}`; lời nhắn tối đa 2.000 ký tự. B không thấy offer A (404), HR không được phản hồi (403).
- Migration 9 chạy sau 1–8; local tự áp dụng. Không cho authenticated ghi trực tiếp bảng offer. JWT actor, thời điểm và audit do server/database tạo.
- `backend/tests/offers.test.ts`: 8 tests về quyền, accept/decline, thay thế, stale, phản hồi gần nhau, đầu vào và API. `backend/tests/recruitment-flow.test.ts` nối tiếp từ hồ sơ/PDF thật tới offer/accepted. Chạy `npm run lint`, `npm test`, `npm run build`.
