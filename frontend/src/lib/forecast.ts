import type { Candidate, JobPosting } from '../types';
import { eligibility } from './recruitment';

import demo from '../data/models/workforce_demo.json' with { type: 'json' };
import { predictPlacement, predictWorkforce } from './mlInference';

export const workforceDemo = demo;
export function demandHistoryFor(job: JobPosting) { return job.demandHistory ?? []; }
export function addMonths(month: string, offset: number): string | null {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || !Number.isInteger(offset)) return null;
  const [year, m] = month.split('-').map(Number);
  const index = year * 12 + m - 1 + offset;
  if (index < 0 || index >= 10000 * 12) return null;
  return `${Math.floor(index / 12)}-${String(index % 12 + 1).padStart(2, '0')}`;
}
export function workforceForecast(job: JobPosting, horizon = 1) {
  const example = demo.find(row => row.jobId === job.id);
  const input = job.workforceSnapshot;
  let reason = '';
  if (horizon !== 1) reason = 'Mô hình chỉ được đánh giá cho tháng kế tiếp.';
  else if (!input) reason = 'Chưa có snapshot đầy đủ. Nạp kịch bản giả lập để thử model.';
  else if (!example || input.company_id !== example.snapshot.company_id || input.department !== example.snapshot.department || input.origin_month !== example.snapshot.origin_month) reason = 'Chưa có lịch sử đồng bộ cho doanh nghiệp, phòng ban hoặc tháng này.';
  else {
    const historical = ['month_index', 'target_month_sin', 'target_month_cos', 'required_interns_current', 'required_interns_lag_1m', 'required_interns_lag_2m', 'required_interns_same_month_last_year', 'required_interns_mean_3m', 'required_interns_mean_6m'];
    if (historical.some(key => String(input[key]) !== String(example.snapshot[key as keyof typeof example.snapshot]))) reason = 'Đặc trưng lịch sử không khớp kịch bản nguồn.';
  }
  const result = !reason && input ? predictWorkforce(input) : null;
  if (result && !result.ok) reason = result.error;
  const ready = result?.ok ? result : null;
  return { job, reason, history: example && input ? example.history.map(r => r.required_interns) : [],
    endMonth: input ? String(input.origin_month) : '', month: input ? String(input.target_month) : null,
    demand: ready?.rounded ?? null, rawDemand: ready?.total ?? null,
    current: ready?.current ?? null, available: ready?.available ?? null, additional: ready?.additional ?? null,
    projected: ready ? [ready.rounded] : [], sample: !!input };
}

// The external placement model uses only GPA and projects; JD/rubric and HR outcomes are separate.
export function candidatePrediction(c: Candidate, job?: JobPosting) {
  if (!job || !eligibility(c).eligible || !['4.0', '10'].includes(c.gpaScale)) return null;
  const prediction = predictPlacement(c.gpaScale === '10' ? c.gpa : c.gpa * 2.5, c.projectCount);
  if (prediction && c.gpaScale === '4.0') prediction.warnings.push('GPA thang 4 nhân 2,5 là giả định demo, không phải quy đổi chính thức của UIT.');
  return prediction;
}
