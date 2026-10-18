# TalentForecast AI cho sinh viên UIT

Ứng dụng hỗ trợ tuyển thực tập sinh UIT thuộc KHMT, KTPM và AI. Cổng `/?view=applications` đã dùng API/database từ nộp hồ sơ đến quyết định HR. Luồng demo cũ và hai màn hình dự báo vẫn dùng dữ liệu trình duyệt; chưa nối dự báo vào dữ liệu tuyển dụng backend.

## Chạy bản local hiện tại

Chạy từ thư mục gốc trên PowerShell:

```powershell
npm install --legacy-peer-deps
npm run dev:recruitment
```

Mở [cổng ứng tuyển](http://127.0.0.1:3000/?view=applications), chọn tài khoản mẫu A/B/HR. Chỉ dùng dữ liệu giả. Tài khoản mẫu chỉ hoạt động trên development/loopback, không phải Supabase Auth thật.

- A/B chỉ thấy hồ sơ, tệp, lời mời và lịch của chính mình.
- HR tạo vị trí, xem hồ sơ, xử lý ngoại lệ minh chứng, chọn vòng 1, lưu lịch/đánh giá và quyết định.
- Database PGlite lưu tại `.local/recruitment/`; tệp riêng tư tại `.local/uploads/`. Dữ liệu được giữ sau restart, mỗi máy có database riêng. Không xóa/reset dữ liệu để giải quyết lỗi chưa rõ nguyên nhân.
- Máy mới có hai vị trí mẫu, chưa có hồ sơ. HR có thể bấm **Thêm bộ hồ sơ thử vòng 1** để tạo một lần 12 hồ sơ giả; bấm lại không reset.
- Không chạy thêm server trên cổng 3000 khi đã có server đang dùng. Trang [xem database](http://127.0.0.1:3000/?view=database) dùng cùng database khi chạy `dev:recruitment`.

## Luồng đã chạy qua backend

1. Ứng viên nộp hồ sơ theo vị trí; email đúng miền `@gm.uit.edu.vn`, ngành/GPA tự khai, mỗi người một hồ sơ cho mỗi vị trí. HR không bị giới hạn miền email trường.
2. Upload CV (PDF), minh chứng ngoại ngữ/thành tích (PDF/PNG/JPEG), tối đa 10 MiB/tệp. Server kiểm tra quyền, định dạng, kích thước và SHA-256; không trả URL public. Giữ các bản cũ, chỉ tệp mới nhất từng loại được xét điểm.
3. PDF có lớp chữ được đọc bằng PDF.js; ảnh/PDF scan dùng Tesseract Anh/Việt trên server, không gửi ra dịch vụ OCR/AI ngoài. Tệp mới được frontend yêu cầu đối chiếu ngay sau upload. Nếu lỗi đọc, tệp vẫn được lưu để thử lại.
4. Minh chứng khớp đầy đủ với tên/khai báo hiện tại tự được tính điểm. Thành tích cần đối chiếu cả cấp giải thưởng. Chỉ lệch/thiếu/không rõ/chưa đọc được vào **Ngoại lệ minh chứng · HR**. HR xem tệp gốc và OCR, ghi lý do chấp nhận/từ chối phần điểm; không tự loại ứng viên. “Khớp thông tin tự động” không xác nhận tính thật từ đơn vị cấp. Kết quả v1 cần đọc lại theo engine v2.
5. Vòng 1 do database tính: GPA tối đa 25, kỹ năng khớp từ khóa tối đa 30, dự án/kinh nghiệm tự khai tối đa 20, ngoại ngữ tối đa 15, thành tích tối đa 10; GPA từ 3.6/4 cộng 3, tổng tối đa 100. GPA thang 10 quy về thang 4. Điểm từ 75 và đủ điều kiện mới được xếp top 10 theo bộ lọc. HR chọn 1–10 hồ sơ; database kiểm tra lại cả danh sách khi lưu lời mời.
6. Vòng 2 lưu lịch, hướng dẫn, điểm bài test bên ngoài app (0–100) và phiếu 5 tiêu chí phỏng vấn (1–10 kèm bằng chứng). Ứng viên chỉ xem lịch/hướng dẫn của mình; đánh giá nội bộ chỉ HR xem. Lưu dữ liệu cũ trả 409 thay vì ghi đè.
7. Tổng hợp mặc định 30% vòng 1 + 30% bài test + 40% phỏng vấn. HR có thể đổi tỷ trọng số nguyên tổng 100. Database tính điểm đến hai chữ số thập phân, chỉ khi đủ các đánh giá; điểm bài test 0 là hợp lệ. Không tự quyết định theo ngưỡng hoặc xác suất placement.
8. HR lưu chọn tuyển/dự phòng/không chọn kèm lý do, điểm và tỷ trọng tại thời điểm quyết định. Chọn tuyển chuyển `offer/passed`, chưa phải `accepted`; kết quả khác là `interview/hold` hoặc `interview/rejected`. Lịch sử giữ nguyên; thay đổi căn cứ cần duyệt lại. Chưa gửi email, tạo offer letter hoặc nhận phản hồi chấp nhận/từ chối offer.

Vòng 1 xếp trên toàn bộ hồ sơ trong bộ lọc rồi giới hạn 200 dòng hiển thị. Danh sách hồ sơ/vị trí/lời mời của portal giới hạn 200; bảng vòng 2/tổng hợp dựa trên tập đang tải, không phải báo cáo toàn bộ database. Hàng chờ ngoại lệ đếm toàn bộ và hiển thị 200 tệp cũ nhất. Xem [schema, công thức, API và giới hạn](backend/database/README.md).

## Kiểm tra toàn luồng

```powershell
npm run lint
npm test
npm run build
```

`backend/tests/recruitment-flow.test.ts` chạy xuyên suốt API với database riêng và PDF thử: quyền A/B/HR, file riêng tư, bộ đọc PDF thật, tự khớp, ngoại lệ, lời mời, lịch, điểm bài test 0, quyết định và dữ liệu lỗi thời. Các test riêng kiểm tra RLS, OCR ảnh/PDF scan, công thức và lịch sử. Tests không cần sửa database local của người dùng hay kết nối cloud. Chưa kiểm tra tải nhiều kết nối PostgreSQL production.

`npm run build` xuất `frontend/dist/`. Cảnh báo chunk Vite lớn hiện chưa làm build thất bại. `npm run preview` chỉ phục vụ bản frontend, không thay thế server API để thử toàn luồng.

## Supabase cloud và production

`npm run dev` dùng Supabase Auth/JWT người gọi, không có đăng nhập mẫu. Chưa áp dụng migrations tuyển dụng lên cloud. Dùng các migration `202610180001` đến `202610180008` theo thứ tự, cấp HR qua kho vai trò riêng, cấu hình private storage và kiểm tra quyền thật trước khi vận hành. Không tạo bảng `profiles/jobs` từ ví dụ rời; dùng [hướng dẫn database](backend/database/README.md) và `.env.example`.

`.env` đặt ở gốc, không in nội dung hoặc commit. Chỉ biến `VITE_` được đưa vào trình duyệt; service-role/Gemini key chỉ phía server. Metadata nghiệp vụ dùng JWT/RLS người gọi; service-role chỉ phục vụ các tác vụ server đã tách riêng như ghi kết quả OCR và lưu byte tệp, không dùng để né quyền HR.

Sau khi chuẩn bị cloud đúng cách, build frontend và chạy:

```powershell
$env:NODE_ENV="production"
npm start
```

Đăng nhập cloud cần email đã xác nhận. Kiểm tra định dạng email ở local không chứng minh quyền sở hữu hộp thư/tư cách sinh viên. Chưa triển khai OTP riêng, email thật, phản hồi offer hoặc đồng bộ dữ liệu trình duyệt cũ.

## Demo frontend cũ và dự báo

`npm run dev:recruitment` vẫn cho mở trang gốc và chọn **Khám phá bản demo frontend**. Demo lưu hồ sơ trong localStorage, tệp trong IndexedDB; không tự chuyển sang database. Luồng duyệt minh chứng/mô phỏng email cũ chỉ thuộc demo, không thay thế cổng ứng tuyển mới. Xem [hướng dẫn demo](docs/frontend-demo.md).

Placement dùng Logistic Regression từ Campus Recruitment, chỉ GPA và số dự án; không hỏi số lần thực tập. GPA thang 4 nhân 2.5 là giả định, thiếu số dự án dùng median train và cảnh báo. Dataset ngoài UIT, chưa kiểm định tại UIT. Xác suất placement không tham gia điểm vòng 1/top 10/quyết định.

Workforce dùng Ridge trên dữ liệu giả lập. Trong demo có kịch bản SYNTH_CO_01 với 13 tháng lịch sử đến 09/2026, kế hoạch chốt 30/09 để dự báo 10/2026. Chỉ dự báo một tháng, không tự điền dữ liệu thiếu thành 0; chưa kiểm định doanh nghiệp thật. Giả định nhận offer 75% chỉ thuộc mô phỏng, chưa nối trạng thái tuyển dụng backend.

## Dữ liệu và tái lập ML

- [Campus Recruitment](data/campus_recruitment/README.md): ba CSV gốc tổng 10.000 dòng, nguồn công bố CC0, có checksum. Cột `Internships` giữ trong dữ liệu gốc, không đưa vào model/form.
- [Placement](ml/placement/README.md): lọc giao nhau giữa tập, baseline, Logistic Regression và [báo cáo đánh giá](ml/placement/artifacts/EVALUATION.md).
- [Workforce giả lập](data/workforce_synthetic/README.md): 2.790 dòng lịch sử, 2.400 mẫu học và từ điển cột; mã huấn luyện ở `ml/workforce/`.

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r ml/placement/requirements.txt
.\.venv\Scripts\python.exe -m unittest discover -s ml/placement -p "test_*.py" -v
.\.venv\Scripts\python.exe ml/placement/train.py
.\.venv\Scripts\python.exe ml/export_frontend.py
npm test
```

Export đồng bộ JSON và mẫu đối chiếu sang `frontend/src/data/models/`. Npm tests so sánh 15 mẫu placement và 30 mẫu workforce Python/TypeScript với sai số dưới 0.000001. CSV được commit để tái lập; CV, dữ liệu ứng viên thật, `.local/`, `output/`, dependencies và bản build không đưa lên Git.

## Cấu trúc

```text
frontend/   React/Vite, portal API và demo trình duyệt
backend/    Express, OCR, store Supabase/PGlite, migrations và tests
shared/     Hợp đồng API/type tuyển dụng
scripts/    Tiện ích build và runtime
ml/         Huấn luyện/export model offline
data/       CSV nguồn và dữ liệu giả lập
docs/       Bàn giao, hướng dẫn và rà soát toàn luồng
```

`npm run dev:database` riêng là fixture trong bộ nhớ cho bản xem schema/RLS, tạo lại khi restart; không thay thế database bền của `dev:recruitment`. Xem [bàn giao](docs/HANDOFF.md) để tiếp tục công việc và xác nhận lại `git status` trước khi sửa. Chỉ push sau khi người dùng duyệt phần thay đổi cụ thể.
