export const DATABASE_TABLES = [
  { name: 'profiles', label: 'Hồ sơ tài khoản', purpose: 'Thông tin liên hệ; không chứa cột tự cấp vai trò HR.', group: 'Tài khoản', links: ['auth.users'], candidate: 'Đọc/sửa tên và điện thoại của mình', hr: 'Đọc hồ sơ tài khoản' },
  { name: 'jobs', label: 'Vị trí tuyển dụng', purpose: 'JD, yêu cầu, GPA tối thiểu và trạng thái mở tuyển.', group: 'Ứng tuyển', links: ['auth.users'], candidate: 'Đọc vị trí đang mở', hr: 'Tạo và cập nhật vị trí' },
  { name: 'applications', label: 'Hồ sơ ứng tuyển', purpose: 'Thông tin tự khai tại lúc nộp; một hồ sơ/người/vị trí, có revision.', group: 'Ứng tuyển', links: ['profiles','jobs'], candidate: 'Nộp bằng email UIT đã xác nhận; chỉ đọc hồ sơ của mình', hr: 'Đọc và cập nhật trạng thái/nội dung có lưu lịch sử' },
  { name: 'application_files', label: 'CV và minh chứng', purpose: 'Metadata, SHA-256 và đường dẫn tệp riêng tư; upload qua API tuyển dụng.', group: 'Minh chứng', links: ['applications','auth.users'], candidate: 'Thêm CV/minh chứng qua API cho hồ sơ của mình', hr: 'Đọc metadata và tải tệp qua API có kiểm tra quyền' },
  { name: 'evidence_reviews', label: 'Duyệt minh chứng', purpose: 'Dấu duyệt gắn đúng file và hash; thay tệp cần duyệt lại.', group: 'Minh chứng', links: ['application_files'], candidate: 'Đọc kết quả duyệt hồ sơ của mình', hr: 'Ghi nhận người duyệt và nguồn đối chiếu' },
  { name: 'interview_invitations', label: 'Lời mời vòng 2', purpose: 'Ghi nhận HR lựa chọn và điểm vòng 1 tại lúc mời.', group: 'Đánh giá', links: ['applications'], candidate: 'Đọc lời mời của mình', hr: 'Tạo lời mời' },
  { name: 'coding_evaluations', label: 'Điểm bài code', purpose: 'Điểm 0–100 nhập từ bài làm bên ngoài; 0 hợp lệ.', group: 'Đánh giá', links: ['interview_invitations'], candidate: 'Không đọc/ghi trực tiếp', hr: 'Ghi điểm và người chấm sau lời mời' },
  { name: 'interview_evaluations', label: 'Phiếu phỏng vấn', purpose: 'Đủ 5 tiêu chí 1–10 và bằng chứng; tổng điểm do PostgreSQL tính.', group: 'Đánh giá', links: ['interview_invitations'], candidate: 'Không đọc/ghi ghi chú nội bộ', hr: 'Ghi/cập nhật phiếu phỏng vấn' },
  { name: 'hiring_decisions', label: 'Quyết định HR', purpose: 'Lịch sử chỉ thêm; chụp điểm và revision, tổng tỷ trọng phải bằng 100%.', group: 'Kết quả', links: ['applications','coding_evaluations','interview_evaluations'], candidate: 'Không đọc quyết định nội bộ chưa công bố', hr: 'Ghi quyết định sau khi đủ hai kết quả vòng 2' },
  { name: 'email_outbox', label: 'Thư kết quả', purpose: 'Nháp/hàng đợi gửi; không cho xếp hàng nếu quyết định đã cũ.', group: 'Kết quả', links: ['applications','hiring_decisions'], candidate: 'Chỉ đọc thư đã gửi thuộc hồ sơ của mình', hr: 'Soạn/xếp hàng; chưa có worker gửi thật' },
  { name: 'workforce_snapshots', label: 'Kế hoạch nhân lực', purpose: 'Snapshot tách dữ liệu thật/giả lập, cố định mốc và khoảng một tháng.', group: 'Kế hoạch', links: ['jobs'], candidate: 'Không có quyền', hr: 'Đọc/thêm snapshot kế hoạch' },
  { name: 'audit_events', label: 'Nhật ký thay đổi', purpose: 'Trigger tự ghi người thao tác và tên cột đổi; không nhân bản nội dung CV.', group: 'Nhật ký', links: ['auth.users'], candidate: 'Không có quyền', hr: 'Chỉ đọc; không sửa/xóa log' },
] as const;

export type PreviewIdentity = 'anonymous' | 'candidate_a' | 'candidate_b' | 'hr';
export const PREVIEW_IDENTITIES: Record<PreviewIdentity, { label: string; userId: string | null }> = {
  anonymous: { label: 'Khách chưa đăng nhập', userId: null },
  candidate_a: { label: 'Ứng viên mẫu A', userId: '10000000-0000-4000-8000-000000000001' },
  candidate_b: { label: 'Ứng viên mẫu B', userId: '10000000-0000-4000-8000-000000000002' },
  hr: { label: 'HR mẫu', userId: '10000000-0000-4000-8000-000000000003' },
};

export interface DatabasePreview {
  engine: string;
  migration: string;
  identity: PreviewIdentity;
  persistent: boolean;
  cloudModified: false;
  tables: Array<{
    name: string; label: string; purpose: string; group: string; links: readonly string[];
    candidate: string; hr: string; rls: boolean;
    columns: Array<{ name: string; type: string; nullable: boolean; generated: boolean }>;
    policies: Array<{ name: string; command: string; roles: string[] }>;
    visibleCount: number | null;
    samples: Record<string, unknown>[];
  }>;
}
