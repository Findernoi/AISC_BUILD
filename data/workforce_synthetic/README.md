# Dataset dự báo nhu cầu intern của doanh nghiệp

**Đây là dữ liệu tổng hợp giả lập 100%, được tạo cho demo đồ án. Không phải dữ liệu thu thập từ doanh nghiệp, UIT hoặc Kaggle.** Không có thông tin cá nhân của ứng viên. Mô hình học trên bộ này chỉ chứng minh luồng chuẩn bị dữ liệu, huấn luyện và dự báo chạy được. Phải kiểm tra lại trên dữ liệu thật trước khi báo cáo hiệu quả thực tế.

## Bài toán được chọn

- Đầu vào: số liệu cuối tháng t và kế hoạch t+1 đã biết tại thời điểm đó.
- Đầu ra: **tổng số intern cần có của một doanh nghiệp trong một phòng ban vào tháng t+1**, đơn vị người.
- Phạm vi: nhóm AI, Frontend và Backend trong doanh nghiệp phần mềm. Đây là nhóm tuyển dụng của doanh nghiệp, không phải tên ngành đào tạo. Điều kiện ứng viên UIT, KHMT/KTPM/AI vẫn thuộc quy trình tuyển chọn riêng.
- Nhãn học là `required_interns_next_month`. Đây là tổng nhu cầu đã được HR xác nhận, xét khả năng bố trí mentor và ngân sách theo định nghĩa thống nhất. Không dùng số đã tuyển được làm nhãn thay thế.
- Bộ hiện tại chỉ hỗ trợ **dự báo trước 1 tháng**. Muốn dự báo trực tiếp 2–3 tháng cần thêm snapshot kế hoạch tương ứng và nhãn theo từng khoảng dự báo; không coi một lần kiểm tra dự báo 1 tháng là bằng chứng cho 3 tháng.

Ví dụ minh họa cách đọc đầu ra: tháng sau cần tổng cộng 12 intern, hiện có 8, dự kiến kết thúc 2, đã xác nhận bắt đầu 1. Nguồn sẵn có dự kiến = 8 − 2 + 1 = 7. Số cần tuyển thêm = max(0, 12 − 7) = **5 người**. Đây là ví dụ giải thích, không phải dự báo thật.

Tỷ lệ nhận offer 75% là giả định riêng của app. Nó không được học bằng dataset này. Xác suất một ứng viên được tuyển cũng là một bài toán khác và cần dữ liệu ứng viên có nhãn kết quả tuyển dụng.

## Các tệp dữ liệu

| Tệp | Nội dung |
|---|---|
| `monthly_history.csv` | 2.790 dòng = 10 doanh nghiệp hư cấu × 3 phòng ban × 93 tháng, từ 01/2019 đến 09/2026. Có số liệu tháng vừa qua và kế hoạch cho tháng tiếp theo. |
| `training_next_month.csv` | 2.400 mẫu có 22 đầu vào X (2 phân loại, 20 cột số), nhãn y và cột chia tập. Đã bỏ giai đoạn đầu chưa đủ lịch sử. |
| `forecast_inputs_2026_10.csv` | 30 dòng đầu vào mẫu cho dự báo 10/2026, chốt ở cuối 09/2026. Không có nhãn tương lai. |
| `real_data_template.csv` | Chỉ có dòng tiêu đề để điền số liệu doanh nghiệp thật, không có bản ghi minh họa giả làm dữ liệu thật. |
| `manifest.json` | Phiên bản, seed, số dòng, khoảng thời gian, danh sách X và các giả định tạo dữ liệu. |
| `DATA_DICTIONARY.md` | Giải thích đầy đủ từng cột, đơn vị, thời điểm biết và quy tắc kiểm tra. |

CSV dùng UTF-8 BOM, dấu phẩy phân cột, dấu chấm cho số thập phân. Mã doanh nghiệp bắt đầu bằng `SYNTH_CO_`; mọi bản ghi tạo sẵn đều có `is_synthetic=1`, `data_source=synthetic`.

## Những dữ liệu cần xin từ doanh nghiệp

| Nhóm dữ liệu | Cần lấy cụ thể | Nguồn phù hợp |
|---|---|---|
| Doanh nghiệp, phòng ban, thời gian | Mã ẩn danh, nhóm chuyên môn, tháng, ngày chốt | Danh mục tổ chức và lịch báo cáo |
| **Lịch sử nhu cầu nhân lực** | Tổng số intern thực sự cần trong từng tháng, kể cả tháng tuyển chưa đủ; xác nhận định nghĩa và người duyệt | Kế hoạch nhân lực/báo cáo nhu cầu được HR và quản lý xác nhận |
| Nguồn nhân lực hiện có | Intern đầu/cuối tháng, số bắt đầu, số kết thúc; số nhân viên chính thức | HRIS, lịch hợp đồng, lịch nhận việc |
| Khối lượng công việc | Dự án đang làm, giờ công phù hợp cho intern, giờ làm thêm trong tháng | Quản lý dự án, timesheet tổng hợp phòng ban |
| Kế hoạch tháng tới | Dự án và giờ công dự kiến dành cho intern, bản kế hoạch đã tồn tại ở ngày chốt | PM/quản lý phòng ban, lưu phiên bản theo thời gian |
| Khả năng tiếp nhận | Số intern mentor có thể hướng dẫn; ngân sách trợ cấp dự kiến đã duyệt | Trưởng nhóm và tài chính |
| Biến động nhân sự đã biết | Số intern dự kiến kết thúc, số đã xác nhận bắt đầu tháng tới | Hợp đồng và lịch nhận việc |
| Lịch làm việc và nguồn | Số ngày làm việc tháng tới, ngày chốt, nguồn bản ghi, cờ thật/giả lập | Lịch doanh nghiệp và hồ sơ nguồn |

**Quan trọng nhất là lịch sử nhu cầu làm nhãn.** Nếu chỉ có số intern đang làm hoặc số người đã tuyển, chưa đủ để khẳng định mô hình học được nhu cầu: doanh nghiệp có thể đang thiếu người. Nếu không có nhãn nhu cầu, cần HR rà soát lại hồ sơ kế hoạch hoặc đổi tên/định nghĩa bài toán trước khi huấn luyện.

Với bản thử nghiệm ít cột hơn, có thể bắt đầu bằng mã doanh nghiệp, phòng ban, tháng và lịch sử nhu cầu để so với dự báo giữ nguyên tháng trước. Bản Ridge đã tạo ở đây dùng đủ các cột theo template; bỏ cột phải sửa danh sách đặc trưng rồi huấn luyện, đánh giá lại. Không điền 0 cho các cột chưa có.

Một doanh nghiệp có thể dùng dữ liệu của chính mình; không bắt buộc phải có 10 doanh nghiệp thật. Bộ mẫu chọn 10 doanh nghiệp để thử luồng học chung. Kế hoạch thu thập ban đầu nên hướng tới lịch sử nhiều năm theo tháng để quan sát mùa vụ; lượng dữ liệu đủ hay chưa phải xác định bằng kiểm tra theo thời gian và so với baseline. Nhân bản hoặc sinh thêm dòng giả lập không thay thế lịch sử thật.

Không cần CV, GPA, email sinh viên, điểm chuyên cần hay đánh giá đồng nghiệp cho mô hình nhu cầu nhân lực này.

## Cách chia tập và đánh giá

| Tập | Tháng của nhãn cần dự báo | Số mẫu |
|---|---|---:|
| Train | 02/2020–12/2024 | 1.770 |
| Validation | 01/2025–12/2025 | 360 |
| Test | 01/2026–09/2026 | 270 |

Không chia ngẫu nhiên. Các doanh nghiệp/phòng ban dùng cùng mốc chia theo tháng. Chuẩn hóa số và danh mục phân loại chỉ học từ tập được phép dùng để fit. Chọn alpha bằng validation, học lại train + validation, sau đó kiểm tra test một lần. Sau đánh giá mới học lại toàn bộ lịch sử để xuất dự báo mẫu.

Đánh giá theo từng tháng: khi dự báo tháng kế tiếp có thể dùng kết quả tháng vừa kết thúc. Không dùng số liệu thực tế của tháng đang dự báo, kế hoạch đã sửa sau ngày chốt hoặc toàn bộ tương lai để tính trung bình. Chưa đánh giá khả năng áp dụng cho doanh nghiệp mới.

Báo cáo kết quả nằm ở `ml/workforce/artifacts/EVALUATION.md`. Đây là MAE/RMSE trên dữ liệu giả lập, không phải “độ chính xác của hệ thống” trên doanh nghiệp thật.

## Quy luật tạo dữ liệu và giới hạn

Seed cố định `20261018`. Các doanh nghiệp có quy mô, xu hướng, năng suất giả định khác nhau. Giờ công dự kiến thay đổi theo tháng và có sai số; nhu cầu tháng sau chịu thêm biến động chưa biết lúc lập kế hoạch. Nhu cầu được giới hạn bởi mentor và ngân sách. Số bắt đầu/nghỉ làm tạo thành chuỗi headcount cân đối.

Giả định trợ cấp 4.000.000 VND/intern/tháng và năng suất hiệu dụng 90–115 giờ/intern/tháng chỉ phục vụ bộ mô phỏng. Lịch nghỉ mẫu không phải lịch nghỉ lễ chính thức. Không hiệu chỉnh các giả định này bằng dữ liệu thực tế, không tuyên bố chúng đại diện doanh nghiệp Việt Nam. Các quy luật tổng hợp sẽ làm mô hình học dễ hơn hoặc khác thực tế.

## Mã tái lập

Mã nằm ở `ml/workforce/`. Python 3.12 và NumPy là đủ cho mô phỏng, huấn luyện, kiểm tra; bước xuất CSV dùng Node và thư viện artifact-tool có sẵn trong runtime Codex.

```powershell
python -m pip install -r ml/workforce/requirements.txt
python ml/workforce/generate.py
node ml/workforce/export_dataset.mjs
python -m unittest discover -s ml/workforce -p "test_*.py" -v
python ml/workforce/train_baseline.py
```

Bước Node cần `@oai/artifact-tool` được resolve từ `ml/workforce/node_modules`. Trong workspace hiện tại thư mục này là liên kết tới bộ thư viện đi kèm Codex, không phải dependency của app. Nếu mang sang máy không có thư viện đó, có thể giữ CSV đã xuất; phần huấn luyện chỉ cần Python + NumPy. `generate.py` luôn lưu dữ liệu có kiểu vào `tmp/workforce_dataset/tables.json` để tái sử dụng với công cụ xuất dữ liệu khác.

`demo_model.json` và `demo_forecast_2026_10.json` là mô hình/kết quả offline. **Chưa nối mô hình mới này vào web và chưa thêm backend.**
