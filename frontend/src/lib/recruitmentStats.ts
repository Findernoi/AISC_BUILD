import type { Candidate, CandidateStage } from '../types';

export const STAGES: CandidateStage[] = ['applied', 'cv_passed', 'interview', 'offer', 'accepted'];
export const STAGE_LABELS = {
  vi: ['Ứng tuyển', 'Qua sàng lọc', 'HR chọn phỏng vấn', 'HR chọn tuyển / Offer', 'Đã nhận việc'],
  en: ['Applications', 'Screened', 'Interview invitations', 'Selected / Offers', 'Accepted'],
};
export const OFFER_ACCEPTANCE_RATE = 0.75;

export function normalizeCandidate(c: Candidate & { codingSubmission?: { aiCodeScore?: number } }): Candidate {
  const { codingSubmission, ...profile } = c;
  const legacy = c.stage as string;
  const stage = legacy === 'assessment' ? (c.invitation ? 'interview' : 'cv_passed') : legacy === 'ai_screening' ? 'cv_passed' : legacy === 'final_decision' ? (c.finalDecision === 'hire' ? 'offer' : 'interview') : STAGES.includes(c.stage) ? c.stage : 'applied';
  // Upgrade only explicitly synthetic fixtures; never alter a real applicant's email.
  const email = c.sampleRecord && /^uit-demo-\d+@example\.com$/.test(c.email) ? c.email.replace('@example.com','@gm.uit.edu.vn') : c.email;
  return { ...profile, email, stage, stageHistory: c.stageHistory?.length ? [...new Set(['applied' as CandidateStage, ...c.stageHistory.filter(s => STAGES.includes(s)), stage])] : STAGES.slice(0, STAGES.indexOf(stage) + 1),
    assessmentScore: c.assessmentScore ?? codingSubmission?.aiCodeScore,
    source: c.source || 'Chưa xác định' };
}
export function funnelCounts(candidates: Candidate[]) {
  return STAGES.map(stage => candidates.filter(c => c.stageHistory?.includes(stage) || c.stage === stage).length);
}
export function offerMetrics(candidates: Candidate[]) {
  const active = candidates.filter(c => c.status !== 'rejected');
  const accepted = active.filter(c => c.stage === 'accepted').length;
  const pending = active.filter(c => c.stage === 'offer').length;
  const expectedPending = pending * OFFER_ACCEPTANCE_RATE;
  return { accepted, pending, expectedPending, expectedTotal: accepted + expectedPending };
}
