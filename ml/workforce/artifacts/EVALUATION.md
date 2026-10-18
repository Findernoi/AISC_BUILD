# Kiểm tra mô hình dự báo intern trên dữ liệu giả lập

**Toàn bộ dữ liệu là giả lập. Các chỉ số dưới đây không chứng minh độ chính xác trên doanh nghiệp thật.**

Ridge Regression học hệ số từ dữ liệu bằng NumPy. Chọn alpha trên validation năm 2025, sau đó học lại train + validation và kiểm tra một lần trên 01–09/2026.

Đây là dự báo từng tháng kế tiếp: khi dự báo tháng 6, đã biết số liệu cuối tháng 5. Không phải dự báo cả 9 tháng ngay từ đầu năm. Không xáo trộn ngẫu nhiên các dòng.

| Mô hình | MAE (người) | RMSE (người) |
|---|---:|---:|
| Dùng nhu cầu tháng vừa qua | 1.500 | 2.107 |
| Dùng cùng tháng năm trước | 1.670 | 2.220 |
| Ridge Regression | 1.053 | 1.349 |

Tập kiểm tra: 270 dòng; alpha được chọn: 0.1. MAE 1 nghĩa là lệch trung bình 1 intern cho một phòng ban của một doanh nghiệp trong một tháng.

`evaluation_model.json` chỉ học đến nhãn tháng 12/2025, dùng để tái lập đánh giá. `demo_model.json` học lại toàn bộ 2.400 dòng sau đánh giá, dùng tạo dự báo mẫu tháng 10/2026. Không dùng mô hình học toàn bộ dữ liệu để báo cáo lại điểm test.

Các hệ số chỉ học lại quy luật của bộ mô phỏng. Chưa kiểm tra doanh nghiệp mới, thay đổi chính sách hay dữ liệu thật. Chưa tích hợp mô hình này vào web.

Số cần tuyển bổ sung = max(0, tổng nhu cầu dự báo đã làm tròn − số intern dự kiến sẵn có). Sẵn có = hiện tại − dự kiến nghỉ + đã xác nhận bắt đầu. Tỷ lệ nhận offer 75% là một giả định riêng của ứng dụng, không phải nhãn hoặc đầu vào để mô hình học.
