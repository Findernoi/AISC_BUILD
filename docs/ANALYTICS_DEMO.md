# Thống kê và kế hoạch nhân sự trong demo

Trong cổng `/?view=applications`, đăng nhập HR mẫu và mở **Thống kê tuyển dụng · Database**. Dữ liệu lấy từ API/database tuyển dụng, không đọc hồ sơ localStorage của demo cũ. Chỉ dùng dữ liệu giả; chưa triển khai cloud, email thật hay OTP.

## Phạm vi và quyền

Migration 10 `202610180010_recruitment_analytics.sql` chạy sau 1–9, local tự áp dụng mà không reset dữ liệu. RPC `public.recruitment_analytics(job_filter uuid, target_month date, as_of date)` chỉ đọc, security definer với search_path rỗng và kiểm tra `private.is_hr()` trong database. Thu hồi quyền PUBLIC/anon; candidate gọi trực tiếp vẫn bị từ chối. Metadata cloud vẫn gọi bằng JWT người dùng, không dùng service-role để vượt quyền HR.

`GET /api/recruitment/analytics?jobId=all&month=2026-11&asOf=2026-10-18` trả `{report}`. `jobId` có thể là UUID; month/asOf bắt buộc, ngày hợp lệ trong 2000–2100. Trường lạ, query lặp/array và ngày không tồn tại trả 400. Chưa đăng nhập trả 401, candidate trả 403. RPC yêu cầu target_month là ngày đầu tháng. Không trả tên, email, điểm hoặc nội dung offer của ứng viên.

Tổng được tính trên toàn bộ hồ sơ/vị trí phù hợp, không dựa vào danh sách portal chỉ tải 200 dòng. Chi tiết theo vị trí giới hạn 200, tổng không giới hạn đó. Dropdown vị trí vẫn theo danh sách portal đang tải; phạm vi “Tất cả” luôn tổng hợp toàn bộ. Tháng kế hoạch mặc định tháng sau, ngày tính mặc định hôm nay tại Việt Nam.

## Cách đếm

- Các mốc nộp hồ sơ, lời mời, đủ hai đánh giá vòng 2, từng có quyết định hire, từng phát hành offer lấy từ bản ghi thực tế. Điểm test 0 vẫn là có đánh giá. Không suy ngược lịch sử từ stage, không tuyên bố tỷ lệ chuyển đổi của cùng một cohort.
- Mỗi hồ sơ lấy offer mới nhất theo issued_at/id. Offer cũ superseded đếm riêng, không cộng thêm vào số người. Quyết định hire chưa phát hành offer không phải offer pending.
- Pending chỉ hợp lệ khi `private.offer_actionable` trả true: trạng thái, quyết định/căn cứ và vị trí còn cho phép phản hồi. Pending lỗi thời không vào nguồn cung dự kiến.
- Đếm accepted/declined riêng theo phản hồi trên offer mới nhất. Accepted dùng làm nguồn vào cần app accepted/passed và quyết định hire mới nhất đúng decision_id. Đóng vị trí sau khi ứng viên nhận offer không xóa nguồn vào đó.
- Nguồn vào của tháng chỉ lấy start_date trong tháng và từ ngày tính nguồn vào trở đi (gồm đúng ngày). Accepted/pending đã quá ngày bắt đầu được báo riêng và loại khỏi nguồn vào tương lai. Không tự coi họ đã làm việc.
- Lịch 6 tháng chỉ phân bổ offer hiện có theo ngày bắt đầu dự kiến; các tháng trống là chưa có offer tương ứng, không khẳng định nhu cầu bằng 0.
- Ngày tính nguồn vào là giả định lọc ngày bắt đầu trên dữ liệu mới nhất, không phải truy vấn snapshot lịch sử. Phản hồi vừa ghi vẫn xuất hiện dù chọn ngày tính trong quá khứ.

## Công thức kế hoạch

Chỉ lập cho một vị trí. HR nhập nhu cầu, số đang thực sự làm, số dự kiến kết thúc bằng số nguyên không âm; số kết thúc không vượt số đang làm. Thiếu dữ liệu không tự biến thành 0. Không đưa người chưa bắt đầu vào số đang làm, tránh cộng trùng offer đã nhận. Các giả định giữ trong component khi xem, không lưu database và reset khi đổi phạm vi/tháng/ngày.

```
giữ lại = đang thực sự làm − dự kiến kết thúc
sẵn có theo offer đã nhận = giữ lại + accepted chưa qua ngày bắt đầu trong tháng
cần bổ sung = max(0, nhu cầu − sẵn có theo offer đã nhận)
kỳ vọng từ pending = pending hợp lệ chưa qua ngày bắt đầu trong tháng × 0,75
sẵn có theo kịch bản = sẵn có theo offer đã nhận + kỳ vọng từ pending
thiếu theo kịch bản = max(0, nhu cầu − sẵn có theo kịch bản)
```

Accepted vẫn là dự kiến bắt đầu đúng hẹn, chưa có chấm công/xác nhận đi làm. 75% là giả định demo cố định, không phải xác suất ML riêng từng ứng viên. Kết quả lẻ là kỳ vọng, không làm tròn thành số người chắc chắn.

Nhu cầu mặc định do HR nhập. Tùy chọn Ridge yêu cầu chọn rõ kịch bản SYNTH_CO_01 và đúng target_month của nó (10/2026 từ lịch sử đến 09/2026); tháng khác bị chặn. Không ánh xạ vị trí thật bằng tên/phòng ban. Chỉ dùng đầu ra nhu cầu của mô hình, không lấy current/exits/confirmed starts của dữ liệu giả lập. Mô hình chưa huấn luyện hoặc kiểm định bằng dữ liệu tuyển dụng backend; chưa dự báo nhu cầu 6 tháng hay doanh nghiệp mới.

## Xem local

1. Chạy `npm run dev:recruitment`, đăng nhập HR mẫu. Với dữ liệu thử offer hiện có, tháng 11/2026 và ngày tính 18/10/2026: tất cả có 15 hồ sơ, 1 accepted, 1 declined, 0 pending hợp lệ.
2. Chọn “Vị trí thử offer · Demo”: 2 hồ sơ, nguồn vào accepted là 1 với start_date 02/11/2026; declined không được cộng.
3. Nhập nhu cầu 5, đang làm 0, kết thúc 0: sẵn có 1, cần thêm 4. Xóa một ô: kết quả ngừng tính và yêu cầu nhập đủ.
4. Chọn nguồn Ridge và một kịch bản: tháng 11/2026 bị từ chối do khác tháng huấn luyện. Đổi tháng 10/2026 để so sánh kịch bản độc lập, không coi đó là nhu cầu đã học của vị trí đang chọn.
5. Kiểm thử tự động dùng database riêng: quyền A/B/HR, stale/replaced/accepted/declined/past offers, bộ lọc, calendar, hơn 200 hồ sơ/vị trí, thiếu giả định và công thức 75%. Không reset database trên máy người dùng.

Giới hạn: chưa quản lý đi làm thực tế, lưu phiên bản kế hoạch HR hoặc các lần forecast; chưa backtest trên doanh nghiệp thật; chưa kiểm tra tải nhiều kết nối PostgreSQL production. Đây là phạm vi demo, không phải sổ nhân sự vận hành.
