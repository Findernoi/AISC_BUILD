# Phạm vi demo UIT và dự báo nhân lực doanh nghiệp

## Phạm vi và điều kiện

- Email ứng tuyển đúng miền `@gm.uit.edu.vn`; không chấp nhận miền giả nối thêm. Đây chỉ là kiểm tra định dạng, chưa xác thực hộp thư hay tình trạng còn là sinh viên. Backend có thể bổ sung OTP hoặc liên kết đăng nhập trường sau.
- Ngành KHMT, KTPM hoặc AI do ứng viên tự khai. GPA hợp lệ thang 4/10 cũng tự khai; bỏ tải minh chứng sinh viên/ngành và bảng điểm, bỏ bước HR duyệt ngành/GPA.
- MSSV là thông tin bổ sung, không thay thế email. CV PDF vẫn bắt buộc khi nộp đơn.
- Không thu thập điểm chuyên cần và đánh giá đồng nghiệp.

## Vòng 1 và top 10

Điểm mẫu: GPA tự khai 25, kỹ năng khớp từ khóa vị trí 30, dự án/kinh nghiệm tự khai 20, ngoại ngữ có minh chứng 15, thành tích đã duyệt 10. Cộng 3 điểm khi GPA từ 3.6/4; tổng chặn ở 100. Chỉ dùng dữ liệu có trước vòng 2, không gọi điểm này là xác suất tuyển dụng.

Top 10 xét trong phạm vi vị trí/ngành đang lọc, GPA đạt tối thiểu của vị trí và điểm vòng 1 từ 75/100. Không đủ 10 người đạt thì không lấy thêm người dưới chuẩn. HR chọn số người vào vòng 2; không tự gửi lời mời hoặc loại hồ sơ còn lại.

## Minh chứng thành tích và ngoại ngữ

Giữ quy trình tải PDF/ảnh, HR xem tệp, ghi người kiểm tra và nguồn đối chiếu rồi duyệt hoặc yêu cầu bổ sung. Chỉ sau khi duyệt mới cộng điểm. Thay tệp, nội dung hoặc cấp thành tích làm dấu duyệt không khớp.

Với thành tích, cần đối chiếu họ tên, tên giải, thời gian, đơn vị tổ chức và nguồn công bố/mã chứng nhận. Rubric đang dùng cấp trường 4, quốc gia 7, quốc tế 10; chỉ ghi nhận một cấp cao nhất đã được kiểm tra, không cộng dồn nhiều giải. Đây là quy tắc demo, cần thống nhất tiêu chí giải phù hợp chuyên ngành trước khi dùng thật. Không tự công nhận giấy chứng nhận tham gia là giải thưởng.

Tệp lưu trên trình duyệt, không có nguồn xác minh thành tích tập trung. HR phê duyệt minh chứng không cần dataset Kaggle. Hồ sơ mẫu có dấu duyệt minh họa, không phải xác minh thật.

## Vòng 2 và quyết định

HR dùng câu hỏi/đáp án mẫu và chấm năm tiêu chí 1–10: chuyên môn 30%, giải quyết vấn đề 25%, học tập 15%, dự án 15%, giao tiếp/ngoại ngữ/tác phong 15%. Ghi người chấm và bằng chứng quan sát.

Bài test lập trình tổ chức bên ngoài app. HR nhập điểm 0–100, người ghi nhận và ghi chú tùy chọn. Không có editor, chạy test hoặc chấm code trên app. Điểm 0 hợp lệ; bỏ trống không tự tính thành 0.

Mặc định điểm tổng: vòng 1 30%, bài test lập trình 30%, phỏng vấn 40%. HR chỉnh tổng 100%; thiếu kết quả vòng 2 thì chưa ra điểm tổng. Quyết định và email cuối cùng thuộc HR. Email hiện là mô phỏng; thay dữ liệu hoặc trọng số yêu cầu ghi nhận lại quyết định.

## Tổng quan và offer

Hai chức năng trong **Tổng quan tuyển dụng** đã nạp model JSON và suy luận trên TypeScript:

- **Dự báo nhu cầu nhân lực**: bấm **Nạp kịch bản SYNTH_CO_01** để dùng snapshot giả lập chốt 30/09/2026, 13 tháng lịch sử và kế hoạch cho tháng 10/2026. Ridge học trên 2.400 mẫu, đã đánh giá theo thời gian trên dữ liệu giả lập; chỉ hỗ trợ một tháng. Chỉnh kế hoạch giả lập để thử số nhân lực sẵn có, người dự kiến kết thúc/bắt đầu, giờ công, mentor và ngân sách. Không tự lấy lịch sử 6 tháng trong Quản lý vị trí làm đủ đầu vào ML; không áp dụng mô hình vào doanh nghiệp mới. Vị trí thiếu snapshot hợp lệ hiển thị lý do.
- **Ước tính placement tham khảo**: Logistic Regression học trên Campus Recruitment ngoài UIT, chỉ dùng GPA và số dự án, không thêm trường thực tập. ROC AUC test 0,807; Brier 0,173. GPA thang 4 nhân 2,5 là giả định demo; thiếu số dự án điền median train kèm cảnh báo, 0 vẫn là 0. Ngoài phạm vi học thì cảnh báo và không ép về biên. Không dùng kỹ năng JD, ngoại ngữ, kinh nghiệm, điểm vòng 2 hoặc kết quả HR để thay đổi xác suất. Đây là ước tính placement của nguồn dữ liệu, chưa phải xác suất vào công ty/vị trí hiện tại.

Hai model được đối chiếu Python/TypeScript trên 15 mẫu placement và 30 mẫu workforce, sai số dưới 0,000001. Không thay rubric vòng 1, top 10, lời mời hoặc quyết định HR. Nguồn Campus Recruitment mô tả thu thập còn sơ sài, chưa xác nhận thật/giả lập; workforce hoàn toàn giả lập. Chưa kiểm định tại UIT hoặc doanh nghiệp Việt Nam.

Giữ lịch sử chuyển qua năm trạng thái, lọc vị trí/nguồn và thống kê nguồn. Đây là tỷ lệ quan sát ở tập đang xem; đợt tuyển chưa kết thúc chưa phải tỷ lệ cuối cùng.

Tỷ lệ nhận offer cố định 75%, không có thanh điều chỉnh. Dự kiến từ offer đang chờ = số hồ sơ ở trạng thái offer chưa bị loại × 0.75. Tổng kỳ vọng = số đã nhận việc + dự kiến từ offer đang chờ. Không tính hồ sơ chưa có offer; không đếm người đã nhận việc hai lần. Nhãn 75% luôn ghi là giả định, không phải ML.

## Các điểm còn cần làm rõ

- Thuyết minh cần phân biệt giao diện mô phỏng và mô hình ML thực tế. Hai màn hình đã nối model và có chỉ số trên tập test nguồn, nhưng chưa có chỉ số kiểm chứng tại UIT/doanh nghiệp Việt Nam.
- Nếu vẫn cần AI trích xuất CV/đối sánh ngữ nghĩa, có thể tích hợp mô hình đã huấn luyện sẵn nhưng phải chuẩn bị CV/JD mẫu đã được phép sử dụng và nhãn HR để kiểm tra chất lượng. Luồng demo hiện chưa thực hiện chức năng này.
- Chốt loại thành tích được tính và rubric cộng điểm; thống nhất quy đổi GPA/ngoại ngữ, trọng số, ngưỡng 75 và cách dùng top 10 toàn đợt hay từng vị trí.
- Backend sau: xác thực email và phân quyền, lưu hồ sơ/tệp, gửi email thật, lịch phỏng vấn, trạng thái offer đồng ý/từ chối/hết hạn/chờ và lịch sử thay đổi. Demo hiện mới có xác nhận nhận việc.

Các phần tính điểm, top 10, phễu, nhập điểm, quyết định và giả định 75% không đòi hỏi dataset huấn luyện ML; cần dữ liệu hoạt động do ứng viên và HR nhập. Để thay mô phỏng bằng AI/ML thực tế, cần dataset và đánh giá phù hợp; dữ liệu huấn luyện không bắt buộc thuộc UIT, nhưng phải đúng bài toán và được kiểm tra khả năng áp dụng.
