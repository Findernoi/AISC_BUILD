import type { Candidate, EvidenceKind } from '../types';
import { INITIAL_JOBS } from './mockData';
import { evidenceFingerprint, MAJORS, UIT_NAME } from '../lib/recruitment';
export function makeUITDemoCandidates(): Candidate[] {
  return Array.from({length:18},(_,i) => {
    const job = INITIAL_JOBS[i % INITIAL_JOBS.length];
    const major = (['AI','KTPM','KHMT'] as const)[i % 3];
    const c: Candidate = {
      id:`demo-uit-${String(i+1).padStart(2,'0')}`, jobId:job.id,
      fullName:`Ứng viên UIT mẫu ${String(i+1).padStart(2,'0')}`, email:`uit-demo-${i+1}@${i === 16 ? 'example.com' : 'gm.uit.edu.vn'}`, phone:'0900000000', university:UIT_NAME,
      studentId:`2452${String(i+1).padStart(4,'0')}`, major:i === 17 ? 'Hệ thống Thông tin' : MAJORS[major], graduationYear:2027,
      gpa:Math.round((3.2 + (i%9)*.1)*100)/100, gpaScale:'4.0', linkedinUrl:'', githubUrl:'', achievements:i%3 ? 'Giải thưởng dự án sinh viên mẫu' : 'Giải cuộc thi thuật toán mẫu',
      achievementLevel:i%3 ? 'school' : 'national', englishCert:{type:'IELTS',score:'7.0'},techBadges:[...job.requirements],
      cvFileName:`CV_mau_UIT_${i+1}.pdf`,cvSummary:'Hồ sơ tổng hợp giả lập dùng để thử luồng tuyển dụng. Không đại diện cho sinh viên thật.',
      stage:'applied',stageHistory:['applied'],status:'pending',appliedDate:'2026-10-17',source:['Trường đại học','Giới thiệu nội bộ','Website doanh nghiệp'][i%3],
      projects:'Dự án môn học mẫu có README và mô tả đóng góp cá nhân.',projectCount:3,experienceMonths:i%4*2,sampleRecord:true,
    };
    if (i < 15) {
      c.stage='cv_passed';c.stageHistory=['applied','cv_passed'];
      c.verification = {};
      for(const kind of ['english','achievement'] as EvidenceKind[]) c.verification[kind] = {status:'verified',reviewer:'HR minh họa',reference:'MINH CHỨNG GIẢ LẬP — KHÔNG PHẢI XÁC MINH THẬT',reviewedAt:'2026-10-17T00:00:00Z',fingerprint:evidenceFingerprint(c,kind),demoOnly:true};
    }
    return c;
  });
}
