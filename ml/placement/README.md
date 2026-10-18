# Placement với GPA và số dự án

Pipeline offline dùng Campus Recruitment CSV. Model hai đầu vào đã thay công thức trên frontend qua `ml/export_frontend.py`. Không thêm trường số lần thực tập vào form; chưa tạo backend nghiệp vụ/ML.

## Chạy từ thư mục gốc

Môi trường đã kiểm tra: Python 3.14. Dùng môi trường riêng để không thay dependencies của workforce.

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r ml/placement/requirements.txt
.\.venv\Scripts\python.exe -m unittest discover -s ml/placement -p "test_*.py" -v
.\.venv\Scripts\python.exe ml/placement/train.py
```

Không cần kích hoạt venv hoặc thay execution policy. Có thể chạy `train.py --output-dir tmp/placement-reproduction` để đối chiếu kết quả mà không ghi đè artifacts đã có.

## Đầu vào

`data/campus_recruitment/` chứa ba CSV nguyên bản, dataset card CC0 và manifest SHA-256. Script từ chối chạy nếu checksum không khớp. X theo thứ tự cố định:

| Dataset | Ý nghĩa | Trường ứng dụng dự kiến |
|---|---|---|
| CGPA | GPA trên thang 10 của nguồn | gpaOn10Scale |
| Projects | Số dự án | projectCount |

Nhãn: `PlacementStatus`, `Placed = 1`, `NotPlaced = 0`. Không dùng các điểm kỹ năng/thi tuyển, lương, điểm vòng 2 hoặc quyết định HR làm đầu vào.

`Internships` vẫn giữ trong CSV gốc nhưng không nằm trong X hoặc form. Bản ba đầu vào cũ chỉ còn metrics tham chiếu trong `three_feature_reference.json`; không chọn model bằng điểm test. GPA quy đổi từ thang 4 cần công bố giả định demo, không gọi là quy đổi chính thức của UIT.

## Chống trùng và đánh giá

Giữ nguyên CSV và các tập nguồn; không chia ngẫu nhiên lại. So toàn bộ các cột predictor gốc (không có nhãn): nếu một profile xuất hiện ở nhiều tập, chỉ giữ bản thuộc tập ưu tiên test > validation > train. Trong tập được giữ, loại bản dư trùng cả profile lẫn nhãn; giữ các nhãn khác nhau nếu chúng cùng nằm trong tập đó. Nhãn khác nhau có thể là nhiễu hoặc các cá nhân khác nhau; không tự coi là dữ liệu lỗi.

Không lọc theo riêng hai đầu vào model: nhiều người có thể cùng GPA và số dự án. Thiếu ID nên quy tắc chống trùng là biện pháp thận trọng, không chứng minh tính độc lập theo người. Các chỉ số áp dụng cho quần thể đã lọc.

Median imputer, StandardScaler và Logistic Regression chỉ fit trên train. Chọn C trong `[0.01, 0.1, 1, 10, 100]` bằng Brier score validation; tie-break log loss rồi C nhỏ hơn. So với DummyClassifier theo tỷ lệ lớp train. Không fit lại trên train + validation, không hiệu chỉnh xác suất sau train. Test chỉ báo cáo sau khi đã chọn model.

## Artifacts

- `model.json`: median, mean, scale, hệ số, intercept, thứ tự cột, phạm vi học và metadata nguồn/runtime.
- `metrics.json`: chỉ số validation và test, các cấu hình đã thử và calibration bins.
- `data_audit.json`: số dòng gốc/giữ/lọc, nhãn và giao nhau.
- `split_rows.json`: số dòng CSV được giữ để tái lập chính xác; header là dòng 1.
- `inference_cases.json`: 15 mẫu từ train hoặc mẫu thiếu đầu vào, dùng đối chiếu khi viết TypeScript.
- `EVALUATION.md`, `calibration.png`: báo cáo và đồ thị calibration trên test.

JSON export được đối chiếu với sklearn. Suy luận TypeScript đã đối chiếu 15 mẫu bằng `npm test`; chạy `python ml/export_frontend.py` sau mỗi lần train để đồng bộ model. Giao diện cảnh báo giá trị ngoài phạm vi học, không ép biên; giá trị thiếu dùng median train, giá trị 0 phải được giữ.

## Giới hạn

Dataset card ghi CC0 nhưng mô tả nguồn thu thập còn sơ sài, chưa xác nhận dữ liệu thật/giả lập. Chưa kiểm định trên UIT hoặc doanh nghiệp Việt Nam. Xác suất placement của nguồn ngoài chỉ là tham khảo, không thay điểm vòng 1, top 10 hoặc quyết định HR. Giả định nhận offer 75% là phần riêng.

## Kết quả hai đầu vào

ROC AUC test 0,807033; Average Precision 0,726796; Brier 0,173342. Bản ba đầu vào trước đây có ROC AUC 0,807996, Brier 0,173321 trên cùng test. Giảm đầu vào theo yêu cầu sản phẩm; so sánh này mang tính mô tả vì test đã được xem ở thí nghiệm trước.
