# Từ điển dữ liệu dự báo nhu cầu intern

Bộ đi kèm là 100% giả lập. `t` là tháng vừa kết thúc; dự báo cho `t+1`. Đơn vị một dòng lịch sử: một doanh nghiệp, một phòng ban, một tháng.

## Các cột trong lịch sử và mẫu nhập dữ liệu thật

| Cột | Ý nghĩa | Đơn vị | Nguồn/thời điểm biết |
|---|---|---|---|
| `company_id` | Mã doanh nghiệp ẩn danh, ổn định qua các tháng | mã | Danh mục doanh nghiệp |
| `department` | Phòng/nhóm chuyên môn AI, Frontend hoặc Backend | nhóm | Danh mục phòng ban |
| `month` | Tháng vừa kết thúc, ký hiệu t | YYYY-MM | Lịch |
| `snapshot_date` | Ngày chốt số liệu và lưu kế hoạch cho t+1 | YYYY-MM-DD | Cuối tháng t |
| `required_interns` | TỔNG số intern cần có trong tháng t, đã được HR xác nhận độc lập với số tuyển được | người | Kế hoạch nhân lực được duyệt của tháng t |
| `interns_start` | Intern đang làm tại đầu tháng t | người | HRIS đầu tháng t |
| `intern_starts` | Intern thực tế bắt đầu trong tháng t | người | HRIS đến cuối tháng t |
| `intern_exits` | Intern thực tế kết thúc/nghỉ trong tháng t | người | HRIS đến cuối tháng t |
| `interns_end` | Intern đang làm cuối tháng t = đầu kỳ + vào - ra | người | HRIS cuối tháng t |
| `permanent_staff` | Nhân viên chính thức cuối tháng t | người | HRIS cuối tháng t |
| `active_projects` | Dự án đang triển khai trong tháng t | dự án | Hệ thống quản lý dự án đến cuối t |
| `overtime_hours` | Tổng giờ làm thêm của nhân viên chính thức tháng t | giờ | Bảng công cuối t; không phải điểm chuyên cần ứng viên |
| `actual_intern_workload_hours` | Khối lượng công việc phù hợp cho intern thực tế tháng t | giờ | Báo cáo công việc cuối t; chỉ dùng lịch sử/audit |
| `planned_projects_next_month` | Dự án dự kiến hoạt động trong t+1, phiên bản kế hoạch đã biết tại cuối t | dự án | PM lưu snapshot tại cuối t |
| `planned_workload_hours_next_month` | Giờ công dự kiến giao cho intern trong t+1, đã biết tại cuối t | giờ | Kế hoạch dự án lưu tại cuối t |
| `planned_mentor_capacity_next_month` | Số intern tối đa mentor dự kiến hướng dẫn được trong t+1 | người | Quản lý phòng ban tại cuối t |
| `planned_stipend_budget_vnd_next_month` | Ngân sách trợ cấp intern cho t+1 đã được phê duyệt tại cuối t | VND | Tài chính tại cuối t |
| `planned_intern_exits_next_month` | Intern dự kiến kết thúc trong t+1, đã biết cuối t | người | Lịch hợp đồng tại cuối t |
| `confirmed_intern_starts_next_month` | Intern đã xác nhận sẽ bắt đầu trong t+1, đã biết cuối t | người | Lịch nhận việc đã xác nhận tại cuối t |
| `working_days_next_month` | Số ngày làm việc dự kiến trong t+1 | ngày | Lịch doanh nghiệp đã biết tại cuối t; lịch mẫu không phải lịch nghỉ lễ chính thức |
| `data_source` | Nguồn bản ghi; bản tạo sẵn luôn là synthetic | nhãn | Metadata |
| `is_synthetic` | 1 = giả lập; dữ liệu thật phải ghi 0 và nguồn thật | 0/1 | Metadata |

## Cột được tạo cho machine learning

| Cột | Cách tạo/ý nghĩa |
|---|---|
| `origin_month` | Tháng t, thời điểm chốt đầu vào. |
| `target_month` | Tháng t+1 cần dự báo. |
| `horizon_months` | Luôn bằng 1 trong phiên bản này. |
| `month_index` | Số tháng kể từ 01/2019 đến t, bắt đầu từ 0. |
| `target_month_sin, target_month_cos` | sin/cos(2π × số thứ tự tháng t+1 / 12), biểu diễn mùa vụ. |
| `required_interns_current` | Lấy required_interns ở t. |
| `required_interns_lag_1m, required_interns_lag_2m` | Nhu cầu t−1 và t−2. |
| `required_interns_same_month_last_year` | Nhu cầu cùng tháng năm trước của THÁNG ĐÍCH, tức t−11. Ví dụ dự báo 02/2026 dùng 02/2025. |
| `required_interns_mean_3m` | Trung bình nhu cầu từ t−2 đến t, gồm tháng t. |
| `required_interns_mean_6m` | Trung bình nhu cầu từ t−5 đến t, gồm tháng t. |
| `interns_current` | Lấy interns_end ở t. |
| `permanent_staff_current, active_projects_current, overtime_hours_current` | Lấy số nhân viên chính thức, dự án và giờ làm thêm ở t. |
| `planned_*_next_month, confirmed_intern_starts_next_month, working_days_next_month` | Sao chép đúng snapshot kế hoạch lưu tại cuối t. Không lấy phiên bản sửa sau đó. |
| `required_interns_next_month` | NHÃN y: required_interns thực tế đã ghi nhận ở t+1. Để trống/không có cột này khi dự báo tháng chưa xảy ra. |
| `split` | train đến nhãn 12/2024; validation trong 2025; test từ 01 đến 09/2026. Chỉ dùng chia tập, không đưa vào X. |

## Danh sách chính xác đầu vào X

Các cột phân loại: `company_id`, `department`.

Các cột số:

- `month_index`
- `target_month_sin`
- `target_month_cos`
- `required_interns_current`
- `required_interns_lag_1m`
- `required_interns_lag_2m`
- `required_interns_same_month_last_year`
- `required_interns_mean_3m`
- `required_interns_mean_6m`
- `interns_current`
- `permanent_staff_current`
- `active_projects_current`
- `overtime_hours_current`
- `planned_projects_next_month`
- `planned_workload_hours_next_month`
- `planned_mentor_capacity_next_month`
- `planned_stipend_budget_vnd_next_month`
- `planned_intern_exits_next_month`
- `confirmed_intern_starts_next_month`
- `working_days_next_month`

Không đưa nhãn y, split, nguồn dữ liệu hoặc kết quả tương lai vào X. `snapshot_date`, `origin_month`, `target_month`, `horizon_months` dùng để kiểm soát thời gian; mùa vụ/thứ tự tháng đã được tạo thành cột số riêng.

## Quy tắc chất lượng

- Một khóa company_id + department + month chỉ có một dòng; tháng liên tục trong từng nhóm.
- Đầu kỳ + bắt đầu − kết thúc = cuối kỳ. Cuối kỳ trước bằng đầu kỳ sau.
- Các số đếm là số nguyên không âm; giờ công/ngân sách không âm; không dùng 0 thay dữ liệu thiếu.
- Hồ sơ thật cần nguồn truy vết, thời điểm chốt, is_synthetic=0; không đổi cờ dữ liệu giả lập thành dữ liệu thật.
- Kế hoạch t+1 phải được lưu tại cuối t. Khi tháng t+1 kết thúc mới bổ sung nhãn bằng một bản ghi lịch sử mới.
- Không dùng số hồ sơ, số người nhận offer hay số thực tuyển thay cho tổng nhu cầu nhân lực.
