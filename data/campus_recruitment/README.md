# Campus Recruitment

Bộ dữ liệu dùng cho thử nghiệm placement của TalentForecast AI. Đã có pipeline train offline tại [ml/placement](../../ml/placement/README.md); model hai đầu vào đã tích hợp vào giao diện.

## Nguồn và giấy phép

- Nguồn: https://huggingface.co/datasets/Krooz/Campus_Recruitment_CSV
- Người đăng: Krooz.
- Revision cố định: `21406aa2f2326cfdff1a90babffc6d141753706d`.
- Ngày tải: 18/10/2026.
- Giấy phép người đăng công bố: **CC0 1.0** — https://creativecommons.org/publicdomain/zero/1.0/
- `SOURCE_README.md` giữ nội dung dataset card từ nguồn và khai báo giấy phép; chỉ chuẩn hóa khoảng trắng cuối dòng.
- `manifest.json` lưu số dòng, cột, nhãn, dung lượng và SHA-256 của từng CSV.

Mô tả nguồn chỉ nêu một campus XYZ; chưa có thông tin đủ để xác nhận phương pháp thu thập, tính đại diện hoặc dữ liệu thật/giả lập. Không giới thiệu đây là dữ liệu UIT hoặc kết quả tuyển dụng của doanh nghiệp Việt Nam.

## Các file nguyên bản

| File | Số dòng |
|---|---:|
| train.csv | 7.225 |
| validation.csv | 1.275 |
| test.csv | 1.500 |
| Tổng | 10.000 |

Cả ba file đều có nhãn `PlacementStatus`: `Placed` và `NotPlaced`. Không có ô trống trong các CSV tải về. Có 72 dòng dư trùng toàn bộ thuộc tính và nhãn trên tổng 10.000 dòng; chưa xóa hoặc thay đổi các file gốc. Các dòng giống nhau không chứng minh cùng một người vì không có ID. Pipeline đã kiểm tra giao nhau và ghi chi tiết cách lọc trong báo cáo đánh giá.

## Ánh xạ ban đầu vào ứng dụng

| Dataset | Ý nghĩa | Trường dự kiến |
|---|---|---|
| CGPA | GPA theo dữ liệu nguồn | GPA với quy tắc thang điểm rõ ràng |
| Projects | Số dự án | projectCount |
| Internships | Giữ nguyên trong nguồn, không dùng cho model hiện tại | Không thêm vào form |
| PlacementStatus | Nhãn có việc làm | Placed = 1, NotPlaced = 0 |

Không suy ra số lần thực tập từ `experienceMonths` hoặc `internshipMonths`. Không dùng điểm vòng 2 hay quyết định HR làm đầu vào dự đoán vòng 1. Không có cơ sở coi ước tính từ dataset này là xác suất được một doanh nghiệp cụ thể tuyển sinh viên UIT.

Giữ nguyên CSV nguồn. Pipeline `ml/placement/train.py` đã kiểm tra giao nhau theo toàn bộ predictor, lọc trùng vào bộ nhớ và lưu số dòng được giữ trong `ml/placement/artifacts/split_rows.json`. Xem số liệu và chỉ số trong [báo cáo đánh giá](../../ml/placement/artifacts/EVALUATION.md). Người khác clone/pull sẽ nhận được dữ liệu ở đường dẫn này khi đã commit/push; không cần Git LFS ở dung lượng hiện tại.

`.gitattributes` tắt chuyển đổi newline cho ba CSV để giữ nguyên checksum khi clone trên Windows/Linux. Không lưu lại CSV bằng Excel hoặc công cụ tự đổi định dạng trước khi chạy kiểm tra checksum.
