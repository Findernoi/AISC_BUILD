# Bàn giao TalentForecast AI

Cập nhật ngày 18/10/2026. Đọc file này trước khi tiếp tục công việc trong chat mới, sau đó kiểm tra mã nguồn và `git status` để xác nhận trạng thái thực tế. Đây là bản bàn giao, không phải lệnh tự động triển khai hoặc push.

## Rà soát toàn luồng A/B/HR (đã được duyệt push)

- Đã hoàn tất bước 1 người dùng duyệt: kiểm tra luồng API/database và sửa lỗi form điểm ngoại ngữ, ngày lịch không tồn tại, chặn phản hồi tải cũ sau đổi phiên và tải lại vòng 2 theo revision.
- Báo cáo ở `docs/WORKFLOW_REVIEW.md`; test mới `backend/tests/recruitment-flow.test.ts` đi từ nộp hồ sơ/tệp/PDF thật/ngoại lệ/vòng 1/phỏng vấn đến quyết định, quyền A/B/HR, cookie đăng xuất và stale basis.
- 107/107 tests đạt, TypeScript/build/diff check đạt; Vite còn cảnh báo bundle lớn. Đã kiểm tra UI B → A và form IELTS/TOEIC/TOEFL, không tạo thêm hồ sơ local. README được thống nhất theo backend hiện tại, bỏ hướng dẫn tạo bảng mẫu đã lỗi thời.
- Mốc đã push: `f999255f9f34b1a76c006bb36543f010389f9696`. Người dùng đã xem local và duyệt push phần rà soát trong commit chứa cập nhật này; kiểm tra git log/status để xác nhận. Các phần tiếp theo vẫn cần duyệt push riêng. Không thay đổi cloud/email/dự báo hoặc thêm luồng phản hồi offer.
- Bước tiếp theo đề xuất: hoàn thiện offer/phản hồi ứng viên, sau khi giải thích phạm vi. Sau đó nối dự báo vào dữ liệu tuyển dụng backend. Giới hạn còn lại và các kiểm tra chưa thực hiện được ghi rõ trong báo cáo rà soát.

## Quy tắc hiện tại: tự đối chiếu, HR chỉ xử lý ngoại lệ (đã push ở f999255)

- Người dùng đã chốt bỏ bước HR xác minh mọi tệp: ngoại ngữ/thành tích khớp đầy đủ theo khai báo hiện tại tự được tính điểm; chỉ lệch/thiếu/không rõ/chưa đọc được mới chuyển HR. Quyết định nghiệp vụ này thay thế quy tắc bắt buộc review ở các mốc lịch sử bên dưới. Không gọi khớp OCR là xác thực tính thật từ đơn vị cấp.
- Migration 8 `202610180008_evidence_exceptions.sql`, engine `local-ocr-rules-v2`. Kết quả cần snapshot tên/khai báo trùng hiện tại, đúng hash, engine mới, không partial và đủ tất cả trường khớp. Thành tích bắt buộc đối chiếu cả cấp (`level`) để tính 4/7/10 điểm. Kết quả v1 cần đọc lại, không tự nâng thành khớp v2.
- UI `EvidenceExceptionsPortal.tsx`: chỉ tệp mới nhất từng loại ngoại ngữ/thành tích; xem tệp riêng tư cạnh khai báo và OCR, chấp nhận/từ chối phần điểm kèm lý do. Kết luận gắn căn cứ hiện tại, stale trả 409; không tự loại ứng viên. Review cũ đúng file/claims được giữ tương thích; `verified` trong bảng cũ hiển thị là HR chấp nhận ngoại lệ, không khẳng định xác thực nguồn cấp.
- Check OCR mới tăng revision hồ sơ; điểm cập nhật, quyết định cũ cần duyệt lại khi căn cứ thay đổi. Thay tệp chỉ xét bản mới nhất; đọc lại tạo check mới làm kết luận ngoại lệ trước đó cần xem lại. CV không có điểm minh chứng và không vào hàng chờ này.
- Mốc trước phần này: `63ad266bdd197afd818aa8a648972a64e70b4078` (tổng hợp/quyết định). Người dùng đã xem local và duyệt push phần tự đối chiếu/xử lý ngoại lệ trong commit chứa cập nhật này; kiểm tra `git log` và `git status` để xác nhận trạng thái thực tế. Không sửa cloud; các phần tiếp theo vẫn cần được duyệt push riêng.
- Kiểm tra phần mới: 105/105 tests đạt, TypeScript/build đạt; cảnh báo bundle lớn vẫn có. Đã đọc hai PDF giả bằng bộ đọc thật trên hồ sơ thử A: IELTS 7.5 tự khớp và cộng 12.5 điểm, cấp thành tích School/national lệch vào HR. Đã thử HR từ chối phần điểm, trạng thái hồ sơ không đổi; sau restart tự khớp và kết luận HR vẫn còn. Đọc lại PDF thành tích để giữ một ngoại lệ mẫu đang mở cho người dùng xem. Ảnh ở `output/previews/evidence-exceptions-backend.png` (Git ignore).

## Mốc tổng hợp và quyết định (đã push ở 63ad266)

- Mốc vòng 2 là `1fe031603ea8e1ea011fe2c8839b05c3eaa3cea8` trên `main`. Người dùng đã xem local và đồng ý push phần tổng hợp/quyết định trong commit chứa cập nhật này; dùng `git log` và `git status` để xác nhận trạng thái thực tế. Quyền push này chỉ áp dụng phần đã duyệt.
- Migration 7 `202610180007_hiring_decisions.sql`: API/RPC tổng hợp và lưu quyết định. HR chọn tỷ trọng số nguyên 0–100 tổng 100, mặc định vòng 1/bài test/phỏng vấn 30/30/40. Database tính đến hai chữ số thập phân (demo cũ làm tròn một chữ số); không dùng xác suất ML.
- Điểm vòng 1 được tính lại từ thông tin/minh chứng hiện tại, không dùng điểm snapshot lời mời để quyết định. Cần đã mời vòng 2, đủ bài test và phiếu 5 tiêu chí, email/ngành/GPA hợp lệ, vị trí đang mở, stage interview/offer. Không có ngưỡng tổng hợp tự động chọn tuyển.
- Hash căn cứ gồm hồ sơ/revision, vị trí, lời mời, điểm và đánh giá hiện tại. Thay đổi căn cứ trả 409 khi ghi; update trạng thái và insert quyết định cùng transaction. Chặn raw insert quyết định qua authenticated. Lịch sử lưu điểm, tỷ trọng, lý do, người duyệt và hash; không sửa bản cũ.
- Chọn tuyển → offer/passed (chưa accepted), dự phòng → interview/hold, không chọn → interview/rejected. Có thể lưu quyết định mới theo dữ liệu hiện tại; không tự gửi email, tạo offer letter hay thay đổi cloud. Điểm/lý do/lịch sử chỉ HR đọc; ứng viên vẫn đọc trạng thái hồ sơ của mình.
- UI `HiringDecisionPortal.tsx`; đổi tỷ trọng cần duyệt quyết định mới. Bảng chỉ tổng hợp các hồ sơ có lời mời trong tập dữ liệu portal đang tải (tối đa 200); không tuyên bố là xếp hạng toàn bộ database. Vòng 1 được tải lại khi revision hồ sơ thay đổi.
- Kiểm thử hiện tại: 98/98 đạt, TypeScript/build đạt; cảnh báo chunk Vite vẫn còn. Đã thử UI trên hồ sơ giả lập 11: vòng 1 78, bài test 82, phỏng vấn 79 → 79,60 với 30/30/40, lưu chọn tuyển/chờ offer thành công.
- Bước tiếp theo đề xuất: hoàn thiện quy trình HR xác minh minh chứng trong portal, rà soát toàn luồng và tài liệu. Nhắc người dùng trước khi bắt đầu phạm vi mới. Chỉ push khi người dùng duyệt.

## Mốc vòng 2 (đã push ở 1fe0316)

- Đã nối lịch, điểm bài test và phiếu phỏng vấn 5 tiêu chí vào portal/API/database, dùng bảng điểm có sẵn. File UI mới `frontend/src/components/RoundTwoPortal.tsx`, validator `backend/src/round-two-validation.ts`.
- Migration 6: `202610180006_round_two.sql`, thêm lịch, read/save RPC, kiểm tra stage/quyền/revision và chặn ghi thẳng bảng điểm qua authenticated. Local tự áp dụng; chưa áp dụng cloud. Điểm do database tính, actor lấy từ phiên HR.
- Ứng viên chỉ xem lịch của mình; điểm/ghi chú/bằng chứng phỏng vấn chỉ HR xem theo quyền đã có. Không gửi email hoặc tạo sự kiện lịch tự động.
- Kiểm thử: 91/91 đạt, TypeScript/build đạt; Vite vẫn cảnh báo bundle lớn. Đã thử UI HR trên hồ sơ giả lập 11: lịch 09:00 ngày 20/10/2026 giờ Việt Nam, bài test 82, phỏng vấn 79/100. Đây là dữ liệu thử local.
- Phần trạng thái Git bên dưới mô tả mốc trước khi làm vòng 2. Vòng 2 đã push; phần tổng hợp/quyết định phía trên đã được người dùng duyệt push. Kiểm tra `git log` và `git status`.
- Bước tiếp theo: nối tổng hợp điểm và quyết định/offer vào backend, sau khi giải thích phạm vi cho người dùng. Hạng mục 1 trong danh sách đề xuất cuối file đã hoàn thành cho phạm vi nêu trên.

## Trạng thái Git

- Workspace: `C:\Users\PC\Documents\AISC_BUILD`.
- Repository: https://github.com/Findernoi/AISC_BUILD
- Nhánh: `main`.
- Commit mới nhất đã push: `301f25e0230d54d40990986b498081a431b2a5d9` — `Add backend round-one scoring and interview invitations`.
- Local và `origin/main` đã đồng bộ sau lần push này. File bàn giao được tạo sau đó, chưa commit/push.
- Không tự push thay đổi mới: làm xong, chạy local cho người dùng xem rồi đợi người dùng đồng ý push. Các lần cho phép push trước chỉ áp dụng phần công việc đã được duyệt.

## Mục tiêu và các quyết định đã chốt

Ứng dụng TalentForecast AI hỗ trợ tuyển thực tập sinh UIT ngành AI, KHMT, KTPM: nộp hồ sơ, minh chứng, vòng 1/top 10, phỏng vấn, quyết định và dự báo nhân lực.

- Chỉ ứng viên cần email đúng miền `@gm.uit.edu.vn`. HR có thể ở doanh nghiệp ngoài trường, không ràng buộc miền email HR.
- Kiểm tra định dạng email chưa chứng minh quyền sở hữu hộp thư hoặc tư cách sinh viên.
- Người dùng muốn cân nhắc OTP sau khi hoàn thiện sản phẩm; chưa yêu cầu triển khai OTP. Đã có nhắc việc trong chat cũ; khi sản phẩm hoàn thiện hãy nhắc người dùng cân nhắc, tránh tạo nhắc trùng.
- Không thêm trường số lần thực tập. Cột `Internships` chỉ giữ trong CSV gốc, không dùng làm đầu vào model/form.
- Dataset đang dùng: Campus Recruitment CSV, giấy phép nguồn công bố CC0. Không tiếp tục kể lại chuyện dataset đã bỏ trong README.
- OCR tự đối chiếu; khớp đầy đủ được tính điểm minh chứng, không đồng nghĩa xác minh tính thật và không tự loại ứng viên. HR chỉ xử lý ngoại lệ.
- Điểm vòng 1 theo công thức công khai; xác suất placement không dùng làm điểm quyết định/top 10.
- Làm việc và giải thích bằng tiếng Việt, rõ chức năng đã chạy thật và phần chỉ là demo.

## Hai luồng giao diện cần phân biệt

1. Demo frontend cũ dùng localStorage/IndexedDB: đã có màn hình vòng 1, phỏng vấn, quyết định và mô phỏng email. Không coi các màn hình này là backend hoàn chỉnh.
2. Cổng `/?view=applications` mới dùng API/database: nộp hồ sơ, quản lý vị trí, tệp riêng tư, OCR, chấm vòng 1/top 10 và lưu lời mời vòng 2.

Chưa tự chuyển dữ liệu trình duyệt cũ sang database. Một số đoạn README ban đầu còn mô tả trạng thái cũ; dùng mã nguồn, các mục bổ sung cuối README và tài liệu backend để xác định chức năng hiện có.

## Cách chạy và kiểm tra local

Chạy từ thư mục gốc trên PowerShell:

```powershell
npm install --legacy-peer-deps
npm run dev:recruitment
```

- Cổng ứng tuyển: http://127.0.0.1:3000/?view=applications
- Trang kiểm tra quyền/dữ liệu: http://127.0.0.1:3000/?view=database
- `dev:recruitment` có tài khoản mẫu A/B/HR, chỉ development/loopback. Đây không phải Supabase Auth thật.
- PostgreSQL local qua PGlite lưu bền ở `.local/recruitment/`; tệp ở `.local/uploads/`. Không xóa/reset để giải quyết lỗi khi chưa xác định nguyên nhân.
- `npm run dev:database` riêng tạo fixture trong bộ nhớ, không thay thế luồng ứng tuyển lưu bền.
- `npm run dev` dùng Supabase Auth/JWT người gọi; không có đăng nhập mẫu như local mode.
- Không chạy thêm server cùng cổng 3000. Xác minh process đang giữ cổng trước khi dừng/khởi động lại.

Lúc bàn giao, server local đang chạy cổng 3000 và trình duyệt đang mở cổng ứng tuyển với HR mẫu. Process/tab có thể không còn khi sang chat mới, cần kiểm tra lại.

## Đã triển khai qua backend

- Schema tuyển dụng, phân quyền RLS, kho vai trò HR riêng; tài khoản HR không được tự nhận vai trò bằng sửa frontend.
- API session, danh sách/tạo vị trí, nộp/đọc hồ sơ theo danh tính được xác thực.
- Upload/xem/tải CV và minh chứng riêng tư. Server kiểm tra quyền, kích thước và SHA-256; không trả URL public.
- Đọc PDF có chữ bằng PDF.js; OCR ảnh/PDF scan bằng Tesseract Anh/Việt trên server, không gửi tài liệu sang dịch vụ OCR/AI bên ngoài.
- Kết quả đối chiếu từng trường có căn cứ, cache và đánh dấu stale khi thông tin liên quan đổi.
- HR xem điểm vòng 1, lọc vị trí/ngành, xem lý do chưa đủ điều kiện và top 10.
- HR chọn 1–10 hồ sơ để lưu lời mời vòng 2. Database tính lại điều kiện tại thời điểm lưu; danh sách lỗi thời trả 409, cả batch rollback nếu không hợp lệ.
- Lời mời lưu điểm và căn cứ tại thời điểm mời, chuyển stage sang interview/status passed; ứng viên chỉ đọc lời mời của mình.
- Chưa gửi email hoặc đặt lịch khi lưu lời mời.

## Quy tắc vòng 1 hiện tại

- GPA tối đa 25; kỹ năng khớp từ khóa yêu cầu vị trí tối đa 30.
- Dự án tối đa 15, kinh nghiệm tối đa 5, cả hai là thông tin tự khai.
- Ngoại ngữ tối đa 15 và thành tích tối đa 10 khi tự đối chiếu khớp đầy đủ hoặc HR chấp nhận ngoại lệ, đúng tệp/hash/thông tin khai báo hiện tại.
- GPA từ 3.6/4 cộng 3; tổng tối đa 100, làm tròn 1 chữ số thập phân.
- GPA thang 10 quy về thang 4. Công thức chi tiết nằm ở migration 5 và hàm frontend cũ dùng để kiểm tra tính tương đương.
- Xếp hạng cần tổng từ 75, GPA đạt mức vị trí, vị trí đang mở, email/ngành hợp lệ và hồ sơ còn ở giai đoạn phù hợp.
- Điểm bằng nhau sắp theo UUID để kết quả ổn định. Top 10 theo bộ lọc đang chọn; không phải hạn mức 10 lời mời lịch sử vĩnh viễn.
- Tệp ngoại ngữ/thành tích mới nhất được xét; không dùng lại điểm tệp cũ nếu tệp mới chưa khớp hoặc chưa được HR chấp nhận ngoại lệ.
- Tự đối chiếu khớp không tạo review thủ công. Review cũ thiếu claims_snapshot không đủ căn cứ cộng điểm; đọc lại hoặc HR xử lý ngoại lệ.
- Báo cáo trả tối đa 200 dòng, nhưng tính/xếp hạng trên toàn bộ hồ sơ thuộc bộ lọc trước khi giới hạn hiển thị.
- Có advisory lock cho các ghi liên quan tới vòng 1; chưa kiểm tra tải đồng thời nhiều kết nối production.

## Dữ liệu giả để xem kết quả

Trong HR local, nút **Thêm bộ hồ sơ thử vòng 1** tạo một lần vị trí **Vị trí thử xếp hạng vòng 1** và 12 hồ sơ giả, mỗi hồ sơ 78 điểm. Bấm lại chỉ mở bộ đã có, không reset hồ sơ.

Đã kiểm tra qua UI: 12 hồ sơ đủ điều kiện, 10 trong top 10, đã lưu 2 lời mời cho hồ sơ giả lập số 11 và 06. Khởi động lại server vẫn còn dữ liệu. Ngoài bộ này local còn một hồ sơ thử trước đó; bộ lọc tất cả có thể hiển thị 13 hồ sơ. Dữ liệu này không nằm trên GitHub; người khác pull về có database local riêng.

Ảnh kết quả trên máy: `output/previews/round-one-backend.png` (Git ignore).

## File chính để tiếp tục

- `frontend/src/components/RecruitmentPortal.tsx`: cổng ứng tuyển mới.
- `frontend/src/components/RoundOnePortal.tsx`: bảng điểm/top 10/lưu lời mời.
- `frontend/src/components/ApplicationFiles.tsx`: tệp, khai báo minh chứng, hiển thị OCR.
- `frontend/src/lib/recruitment.ts`: nghiệp vụ demo cũ; vòng 1 có kiểm thử so với SQL.
- `backend/src/recruitment-api.ts`: routes, xác thực, kiểm tra input và mã lỗi.
- `backend/src/recruitment-store.ts`: Supabase store dùng JWT người gọi.
- `backend/src/recruitment-local.ts`: PGlite local, khởi tạo/migration.
- `backend/src/round-one-demo.ts`: bộ hồ sơ giả chỉ local.
- `backend/src/evidence-analysis.ts`: phân tích/đối chiếu minh chứng.
- `shared/recruitment.ts`: hợp đồng type/API.
- `backend/database/README.md`: hướng dẫn schema, RLS, API, triển khai và giới hạn.
- `backend/tests/round-one.test.ts`: kiểm thử vòng 1, quyền và tính nguyên tử khi mời.

Migration theo thứ tự:

1. `202610180001_recruitment.sql`
2. `202610180002_recruitment_role.sql`
3. `202610180003_private_documents.sql`
4. `202610180004_evidence_checks.sql`
5. `202610180005_round_one.sql`

Chưa áp dụng các migration tuyển dụng này lên Supabase cloud. Local hiện đã có migration 5 đầy đủ. Không suy diễn rằng đã có trên cloud chỉ vì mã đã push.

## ML và data trên GitHub

- `data/campus_recruitment/`: ba CSV gốc tổng 10.000 dòng, README nguồn/giấy phép/checksum; đã commit để người khác pull về có thể tái lập.
- `ml/placement/`: Logistic Regression dùng GPA và số dự án; lọc giao nhau giữa các tập, so sánh baseline, export model/preprocessing JSON. Chưa kiểm định tại UIT.
- `data/workforce_synthetic/` và `ml/workforce/`: dữ liệu giả lập và Ridge dự báo nhu cầu nhân lực; chưa kiểm định ở doanh nghiệp thật.
- `ml/export_frontend.py`: đồng bộ JSON/mẫu đối chiếu sang `frontend/src/data/models/`.
- Npm tests có so sánh suy luận Python/TypeScript. Không đưa CV, dữ liệu ứng viên thật hoặc database local vào Git.

## Kiểm tra đã hoàn tất ở commit 301f25e

```powershell
npm run lint
npm test
npm run build
git diff --check
```

Kết quả: TypeScript đạt, 86 kiểm thử đạt, build thành công. Có cảnh báo kích thước chunk Vite, không làm build thất bại. Đã thử UI và kiểm tra dữ liệu bền qua restart. Không cần chạy lại toàn bộ chỉ để đọc bản bàn giao; chạy kiểm tra phù hợp khi sửa code.

## Việc còn lại và hướng tiếp theo đề xuất

Chưa có kế hoạch triển khai tiếp theo được người dùng duyệt sau lần push vòng 1. Thứ tự dưới đây là đề xuất, cần giải thích phạm vi trước khi làm:

1. Nối luồng phỏng vấn vòng 2 vào API/database: lịch/thông tin phỏng vấn, điểm tiêu chí và bài test do HR nhập, ứng viên chỉ xem dữ liệu của mình.
2. Nối luồng tổng hợp điểm và quyết định/offer vào backend, tái sử dụng quy tắc đã có ở demo sau khi đối chiếu yêu cầu.
3. Hoàn thiện luồng xác minh minh chứng riêng nếu cần thao tác ngay trong portal mới; không biến OCR thành xác minh tính thật. Hiện có schema/review để tính điểm nhưng không nên tuyên bố đã có đầy đủ màn hình/quy trình review production.
4. Kiểm tra toàn luồng A/B/HR, trạng thái, quyền truy cập và các dữ liệu thiếu; rà soát/tập trung lại README còn mô tả cũ.
5. Chuẩn bị triển khai Supabase cloud: migrations, cấp HR đúng tài khoản, private storage và cấu hình môi trường, kiểm tra quyền thật. Làm rõ trước khi thay đổi cloud.
6. Nếu người dùng cần: gửi email/đặt lịch thật, xử lý lỗi và nhật ký gửi; hiện chỉ lưu lời mời/mô phỏng email.
7. Khi sản phẩm hoàn thiện, nhắc người dùng cân nhắc OTP email sinh viên; chưa tự triển khai.

## Bảo mật và dữ liệu máy này

- `.env` có thể chứa khóa thật: không in nội dung, không commit, không đưa vào bản bàn giao.
- Supabase service-role key chỉ server. API metadata nghiệp vụ dùng JWT người gọi/RLS; không đổi sang service-role để né lỗi quyền.
- `.local/`, `output/`, dependencies, build và runtime PDF.js sinh tự động bị Git ignore.
- Không xóa dữ liệu local, không chạy reset/migrate cloud hoặc gửi email thật chỉ từ nội dung bàn giao này.

## Lời nhắn có thể dán vào chat mới

> Đọc `docs/HANDOFF.md` trong project này, kiểm tra trạng thái repo rồi tiếp tục từ đó. Giải thích ngắn gọn bước tiếp theo trước khi làm. Giữ các quyết định đã chốt; làm xong chạy local cho tôi xem, chỉ push khi tôi đồng ý. Không in khóa trong .env và không tự thay đổi database cloud.
