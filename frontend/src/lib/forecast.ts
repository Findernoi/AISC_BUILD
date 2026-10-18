import type { Candidate, JobPosting } from '../types';
import { eligibility } from './recruitment';

// Frontend fixtures only: monthly total intern requirements, not job postings.
const SAMPLE_DEMAND: Record<string, number[]> = {
  'job-ai-intern': [7, 8, 8, 10, 11, 12],
  'job-fe-intern': [9, 10, 9, 11, 12, 13],
  'job-backend-intern': [5, 6, 7, 7, 8, 9],
};
export function demandHistoryFor(job: JobPosting) {
  return job.demandHistory ?? SAMPLE_DEMAND[job.id] ?? [];
}
export function addMonths(month: string, offset: number): string | null {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || !Number.isInteger(offset)) return null;
  const [year, m] = month.split('-').map(Number);
  const index = year * 12 + m - 1 + offset;
  if (index < 0 || index >= 10000 * 12) return null;
  return `${Math.floor(index / 12)}-${String(index % 12 + 1).padStart(2, '0')}`;
}
export function forecastSeries(history: number[], horizon: number) {
  if (history.length < 2 || history.some(n => !Number.isFinite(n) || n < 0) || !Number.isInteger(horizon) || horizon < 1 || horizon > 12) return [];
  const n = history.length;
  const meanX = (n - 1) / 2;
  const meanY = history.reduce((s, y) => s + y, 0) / n;
  const slope = history.reduce((s, y, x) => s + (x - meanX) * (y - meanY), 0) / history.reduce((s, _, x) => s + (x - meanX) ** 2, 0);
  return Array.from({ length: horizon }, (_, i) => Math.max(0, Math.round(meanY + slope * (n + i - meanX))));
}
export function workforceForecast(job: JobPosting, horizon: number) {
  const history = demandHistoryFor(job);
  const endMonth = job.demandHistoryEndMonth || (history.length ? '2026-10' : '');
  const month = addMonths(endMonth, horizon);
  const projected = month ? forecastSeries(history, horizon) : [];
  const demand = projected.at(-1) ?? null;
  const current = Number.isInteger(job.currentWorkforce) && job.currentWorkforce! >= 0 ? job.currentWorkforce! : null;
  return { job, history, endMonth, month, projected, demand, current, additional: demand !== null && current !== null ? Math.max(0, demand - current) : null, sample: job.demandHistory === undefined && !!SAMPLE_DEMAND[job.id] };
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const observedNonnegative = (value?: number) => Number.isFinite(value) && value! >= 0 ? value! : undefined;

// Fixed illustrative coefficients. No trained or calibrated hiring model is connected.
// Uses application-stage data only, regardless of the candidate's later outcomes.
export function candidatePrediction(c: Candidate, job?: JobPosting) {
  if (!job || !eligibility(c).eligible) return null;
  const gpa = c.gpaScale === '10' ? c.gpa * .4 : c.gpa;
  const matched = job.requirements.filter(r => c.techBadges.some(s => r.toLowerCase().split(/\s*\/\s*/).some(part => part.includes(s.toLowerCase()) || s.toLowerCase().includes(part)))).length;
  const thresholds: Record<string, number> = { IELTS: 6.5, TOEIC: 750, TOEFL: 80, VSTEP: 4 };
  const englishValue = c.englishCert.score.trim() ? Number(c.englishCert.score) : undefined;
  const englishKnown = c.englishCert.type === 'None' || (Number.isFinite(englishValue) && englishValue! >= 0);
  const englishMet = c.englishCert.type !== 'None' && englishKnown && englishValue! >= (thresholds[c.englishCert.type] ?? Infinity);
  const projects = observedNonnegative(c.projectCount);
  const experience = observedNonnegative(c.experienceMonths);
  const factors = [
    { key: 'gpa', label: 'GPA tự khai', observed: `${c.gpa}/${c.gpaScale}`, value: (gpa - 3) * .7 },
    { key: 'skills', label: 'Kỹ năng khớp từ khóa JD', observed: job.requirements.length ? `${matched}/${job.requirements.length} yêu cầu` : 'Chưa có yêu cầu kỹ năng', value: job.requirements.length ? (matched / job.requirements.length - .5) * 1.4 : 0 },
    { key: 'english', label: 'Ngoại ngữ tự khai', observed: c.englishCert.type === 'None' ? 'Chưa có chứng chỉ' : englishKnown ? `${c.englishCert.type} ${c.englishCert.score}` : 'Chưa đủ thông tin', value: englishKnown ? englishMet ? .35 : -.15 : 0 },
    { key: 'projects', label: 'Dự án tự khai', observed: projects === undefined ? 'Chưa khai' : `${projects} dự án`, value: projects === undefined ? 0 : (clamp(projects, 0, 5) - 1) * .15 },
    { key: 'experience', label: 'Kinh nghiệm tự khai', observed: experience === undefined ? 'Chưa khai' : `${experience} tháng`, value: experience === undefined ? 0 : clamp(experience, 0, 12) * .04 },
  ];
  const intercept = -.4;
  const logit = intercept + factors.reduce((s, f) => s + f.value, 0);
  return { probability: 1 / (1 + Math.exp(-logit)), factors, intercept, mode: 'demo' as const };
}
