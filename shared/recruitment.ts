export interface RecruitmentUser { id: string; email: string; role: 'candidate' | 'hr'; }
export interface RecruitmentJob {
  id: string; title: string; department: string; description: string; location: string;
  requirements: string[]; min_gpa: number | string; status: 'active' | 'closed';
}
export interface ApplicationInput {
  job_id: string; full_name: string; phone: string; major: 'KHMT' | 'KTPM' | 'AI';
  gpa: number; gpa_scale: '4.0' | '10'; graduation_year: number;
  project_count: number | null; experience_months: number | null;
  skills: string[]; project_description: string;
}
export interface RecruitmentApplication extends ApplicationInput {
  id: string; applicant_id: string; contact_email: string; stage: string; status: string;
  created_at: string; revision: number;
}
export interface RecruitmentSession { user: RecruitmentUser | null; mode: 'local' | 'supabase'; configured: boolean; }
