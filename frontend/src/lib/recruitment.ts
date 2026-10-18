import type { Candidate, DecisionWeights, EvidenceKind, InterviewEvaluation, InterviewKey, JobPosting, UITMajor } from '../types';
const clamp = (value:number,min=0,max=100) => Math.min(max,Math.max(min,value));

export const UIT_NAME = 'Trường ĐH Công nghệ Thông tin - ĐHQG-HCM (UIT)';
export const MAJORS: Record<UITMajor, string> = { KHMT: 'Khoa học Máy tính', KTPM: 'Kỹ thuật Phần mềm', AI: 'Trí tuệ Nhân tạo' };
const normalized = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').toLowerCase().trim();
export function majorCode(major: string): UITMajor | undefined {
  const value = normalized(major);
  return (Object.keys(MAJORS) as UITMajor[]).find(code => value === code.toLowerCase() || value === normalized(MAJORS[code]));
}
export function hasUITEmail(email: string) {
  return /^[a-z0-9.!#$%&'*+\/=?^_`{|}~-]+@gm\.uit\.edu\.vn$/i.test(email.trim());
}
export function declaredUIT(c: Candidate) {
  return [UIT_NAME, 'UIT', 'Đại học Công nghệ Thông tin - ĐHQG-HCM', 'Trường Đại học Công nghệ Thông tin - ĐHQG TPHCM'].some(s => normalized(s) === normalized(c.university));
}
export function evidenceFingerprint(c: Candidate, kind: EvidenceKind) {
  const values = kind === 'student' ? [c.fullName.trim(), c.studentId?.trim(), c.university, majorCode(c.major)] : kind === 'gpa' ? [c.studentId?.trim(), c.gpa, c.gpaScale] : kind === 'english' ? [c.englishCert.type, c.englishCert.score.trim()] : [c.achievements.trim(), c.achievementLevel || 'none'];
  return JSON.stringify([...values, c.evidenceFiles?.[kind]?.id || null]);
}
export function verified(c: Candidate, kind: EvidenceKind, allowDemo = false) {
  const proof = c.verification?.[kind];
  return !!proof && proof.status === 'verified' && !!proof.reviewer.trim() && !!proof.reference.trim() && (!proof.demoOnly || allowDemo) && proof.fingerprint === evidenceFingerprint(c, kind) && (proof.demoOnly || !!c.evidenceFiles?.[kind]);
}
export function eligibility(c: Candidate, _allowDemo = false) {
  const reasons: string[] = [];
  if (!hasUITEmail(c.email)) reasons.push('Cần email đúng định dạng @gm.uit.edu.vn.');
  if (!majorCode(c.major)) reasons.push('Ngành tự khai chưa thuộc KHMT, KTPM hoặc AI.');
  if (!['4.0','10'].includes(c.gpaScale) || !Number.isFinite(c.gpa) || c.gpa < 0 || c.gpa > (c.gpaScale === '10' ? 10 : 4)) reasons.push('GPA tự khai không hợp lệ theo thang điểm.');
  return { eligible: reasons.length === 0, reasons };
}

export function roundOneScore(c: Candidate, job: JobPosting, allowDemo = false) {
  const gpa = c.gpaScale === '10' ? c.gpa * .4 : c.gpa;
  const match = job.requirements.filter(r => c.techBadges.some(s => r.toLowerCase().split(/\s*\/\s*/).some(part => part.includes(s.toLowerCase()) || s.toLowerCase().includes(part)))).length;
  const cert = Number(c.englishCert.score);
  const englishMax: Record<string, number> = { IELTS: 9, TOEIC: 990, TOEFL: 120, VSTEP: 6 };
  const english = verified(c, 'english', allowDemo) && Number.isFinite(cert) && c.englishCert.type !== 'None' ? clamp(cert / (englishMax[c.englishCert.type] || Infinity), 0, 1) * 15 : 0;
  const achievementPoints = { none: 0, school: 4, national: 7, international: 10 };
  const contributions = [
    { key: 'gpa', label: 'GPA tự khai', value: clamp(gpa, 0, 4) / 4 * 25, max: 25 },
    { key: 'skills', label: 'Kỹ năng khớp vị trí', value: job.requirements.length ? match / job.requirements.length * 30 : 0, max: 30 },
    { key: 'projects', label: 'Dự án và kinh nghiệm tự khai', value: Math.min(15, Math.max(0, c.projectCount || 0) * 5) + Math.min(5, Math.max(0, c.experienceMonths || 0) / 6 * 5), max: 20 },
    { key: 'english', label: 'Ngoại ngữ có minh chứng', value: english, max: 15 },
    { key: 'achievement', label: 'Thành tích đã duyệt', value: verified(c, 'achievement', allowDemo) ? achievementPoints[c.achievementLevel || 'none'] : 0, max: 10 },
    { key: 'gpaBonus', label: 'Điểm cộng GPA từ 3.6 trở lên', value: gpa >= 3.6 ? 3 : 0, max: 3 },
  ];
  return { total: Math.round(clamp(contributions.reduce((s, f) => s + f.value, 0)) * 10) / 10, contributions, gpaNormalized: gpa };
}
export interface ShortlistScope { jobId?: string; major?: string; allowDemo?: boolean }
export function topTen(candidates: Candidate[], jobs: JobPosting[], scope: ShortlistScope = {}) {
  return candidates.filter(c => c.status !== 'rejected' && !['offer', 'accepted'].includes(c.stage) && (!scope.jobId || scope.jobId === 'all' || c.jobId === scope.jobId) && (!scope.major || scope.major === 'all' || majorCode(c.major) === scope.major) && eligibility(c, scope.allowDemo).eligible).map(c => ({ candidate: c, job: jobs.find(j => j.id === c.jobId) })).filter((r): r is { candidate: Candidate; job: JobPosting } => !!r.job && r.job.status === 'active').map(r => ({ ...r, score: roundOneScore(r.candidate, r.job, scope.allowDemo) })).filter(r => r.score.gpaNormalized >= r.job.minGpa && r.score.total >= 75).sort((a,b) => b.score.total - a.score.total || a.candidate.id.localeCompare(b.candidate.id)).slice(0,10);
}
export function inviteShortlisted(candidates:Candidate[],jobs:JobPosting[],ids:string[],reviewer:string,scope:ShortlistScope={}) {
  if(!reviewer.trim()) return candidates;
  const allowed=topTen(candidates,jobs,scope);
  return candidates.map(c=>{
    const ranked=allowed.find(r=>r.candidate.id===c.id);
    if(!ids.includes(c.id)||!ranked||c.invitation||!['applied','cv_passed'].includes(c.stage))return c;
    return {...c,stage:'interview' as const,status:'passed' as const,stageHistory:[...new Set([...(c.stageHistory||['applied' as const]),'cv_passed' as const,'interview' as const])],invitation:{invitedAt:new Date().toISOString(),invitedBy:reviewer.trim(),roundOneScore:ranked.score.total,scopeJobId:scope.jobId||'all',majorFilter:scope.major||'all'}};
  });
}

export const INTERVIEW_CRITERIA: { key: InterviewKey; label: string; weight: number; anchor: string }[] = [
  { key: 'technical', label: 'Kiến thức chuyên môn', weight: 30, anchor: 'Hiểu đúng kiến thức nền, giải thích được lựa chọn kỹ thuật và giới hạn.' },
  { key: 'reasoning', label: 'Tư duy giải quyết vấn đề', weight: 25, anchor: 'Phân tích yêu cầu, xét trường hợp biên, giải thích và cải tiến cách làm.' },
  { key: 'learning', label: 'Nền tảng và khả năng học tập', weight: 15, anchor: 'Vận dụng kiến thức đã học, tiếp thu gợi ý và tự sửa sai có lập luận.' },
  { key: 'projects', label: 'Kinh nghiệm và dự án', weight: 15, anchor: 'Mô tả rõ vai trò cá nhân, kết quả, khó khăn và bằng chứng của dự án.' },
  { key: 'communication', label: 'Giao tiếp ngoại ngữ và tác phong', weight: 15, anchor: 'Khai báo nhất quán, trình bày rõ, trả lời trung thực và trao đổi chuyên nghiệp; kiểm tra ngoại ngữ bằng câu hỏi phù hợp.' },
];
export function interviewScore(scores: Partial<Record<InterviewKey, number>>) {
  if (INTERVIEW_CRITERIA.some(f => !Number.isFinite(scores[f.key]) || scores[f.key]! < 1 || scores[f.key]! > 10)) return null;
  return Math.round(INTERVIEW_CRITERIA.reduce((s,f) => s + scores[f.key]! * f.weight / 10, 0) * 10) / 10;
}
export function manualCodingScore(c: Candidate): number | null {
  const evaluation = c.manualCodingEvaluation;
  return evaluation && Number.isFinite(evaluation.score) && evaluation.score >= 0 && evaluation.score <= 100 && evaluation.reviewedBy.trim() ? evaluation.score : null;
}
export function roundTwoComplete(c: Candidate) {
  return manualCodingScore(c) !== null && !!c.invitation?.invitedBy.trim() && !!c.interviewEvaluation?.reviewer.trim() && interviewScore(c.interviewEvaluation.scores) !== null && INTERVIEW_CRITERIA.every(f => !!c.interviewEvaluation!.evidence[f.key]?.trim());
}
export function finalScore(c: Candidate, job: JobPosting, weights: DecisionWeights, allowDemo = false) {
  if (!eligibility(c, allowDemo).eligible || !roundTwoComplete(c) || roundOneScore(c,job,allowDemo).gpaNormalized < job.minGpa) return null;
  const sum = weights.aiWeight + weights.assessmentWeight + weights.hrWeight;
  if (sum !== 100 || Object.keys(weights).some(key => key !== 'aiWeight' && key !== 'assessmentWeight' && key !== 'hrWeight') || Object.values(weights).some(w => !Number.isFinite(w) || w < 0 || w > 100)) return null;
  return Math.round((roundOneScore(c,job,allowDemo).total * weights.aiWeight + manualCodingScore(c)! * weights.assessmentWeight + interviewScore(c.interviewEvaluation!.scores)! * weights.hrWeight) / 100 * 10) / 10;
}
