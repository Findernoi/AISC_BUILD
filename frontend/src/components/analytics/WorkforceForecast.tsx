import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { addMonths, workforceDemo, workforceForecast } from '../../lib/forecast';
import { predictWorkforce, type WorkforceSnapshot } from '../../lib/mlInference';
import { Empty, Field, Metric, Panel } from './Shared';

const PLAN_FIELDS = [
  ['interns_current', 'Intern hiện tại'],
  ['permanent_staff_current', 'Nhân viên chính thức hiện tại'],
  ['active_projects_current', 'Dự án hiện tại'],
  ['overtime_hours_current', 'Giờ làm thêm tháng hiện tại'],
  ['planned_projects_next_month', 'Dự án dự kiến tháng tới'],
  ['planned_workload_hours_next_month', 'Giờ công dự kiến tháng tới'],
  ['planned_mentor_capacity_next_month', 'Sức hướng dẫn (số intern)'],
  ['planned_stipend_budget_vnd_next_month', 'Ngân sách thực tập tháng tới (VND)'],
  ['planned_intern_exits_next_month', 'Intern dự kiến kết thúc'],
  ['confirmed_intern_starts_next_month', 'Intern đã xác nhận bắt đầu'],
  ['working_days_next_month', 'Ngày làm việc tháng tới'],
] as const;

export function WorkforceForecast({ onManageJobs }: { onManageJobs: () => void }) {
  const { jobs, updateJob } = useApp();
  const [department, setDepartment] = useState('all');
  const [jobId, setJobId] = useState('all');
  const [editingId, setEditingId] = useState('');
  const [draft, setDraft] = useState<WorkforceSnapshot>({});
  const [error, setError] = useState('');
  const scope = jobs.filter(j => (department === 'all' || j.department === department) && (jobId === 'all' || j.id === jobId));
  const rows = scope.map(j => workforceForecast(j));
  const ready = rows.filter(r => r.demand !== null);
  const loadScenario = () => {
    for (const example of workforceDemo) {
      const job = jobs.find(j => j.id === example.jobId);
      if (job && !job.workforceSnapshot) updateJob({ ...job, workforceSnapshot: { ...example.snapshot } });
    }
  };
  return <div className="space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="mb-2 text-xs uppercase tracking-widest text-indigo-300">Kịch bản doanh nghiệp giả lập · SYNTH_CO_01</p><h1 className="text-3xl font-bold">Dự báo nhu cầu nhân lực</h1><p className="mt-2 text-sm text-slate-400">Ridge Regression dự báo tổng intern tháng 10/2026 từ snapshot chốt 30/09/2026.</p></div>
      <button className="btn-secondary" onClick={onManageJobs}>Quản lý vị trí</button>
    </div>
    <Panel>
      <p className="text-sm font-semibold text-amber-300">ML đã huấn luyện trên dữ liệu giả lập · Chưa kiểm định doanh nghiệp thật</p>
      <p className="mt-2 text-sm leading-relaxed text-slate-400">Model học từ 2.400 mẫu; MAE trên test giả lập khoảng 1,053 intern/phòng ban/tháng. Ba vị trí mẫu ánh xạ đến phòng ban AI, Frontend, Backend của SYNTH_CO_01. Chỉ hỗ trợ tháng kế tiếp; chưa có cơ sở dự báo 2–3 tháng hoặc doanh nghiệp mới. HR xem xét trước khi chốt chỉ tiêu.</p>
      <button className="btn-primary mt-4" onClick={loadScenario} disabled={!jobs.some(j => workforceDemo.some(d => d.jobId === j.id) && !j.workforceSnapshot)}>Nạp kịch bản SYNTH_CO_01</button>
      <p className="mt-3 text-xs text-slate-500">Nạp snapshot riêng cho vị trí mẫu chưa có kịch bản; giữ nguyên lịch sử và số intern HR đã nhập trong Quản lý vị trí. Không dùng giả định nhận offer 75% để dự báo nhu cầu.</p>
    </Panel>
    <Panel><div className="grid gap-4 sm:grid-cols-3">
      <Field label="Phòng ban vị trí"><select value={department} onChange={e => { setDepartment(e.target.value); setJobId('all'); }}><option value="all">Tất cả phòng ban</option>{[...new Set(jobs.map(j => j.department))].map(d => <option key={d}>{d}</option>)}</select></Field>
      <Field label="Vị trí"><select value={jobId} onChange={e => setJobId(e.target.value)}><option value="all">Tất cả vị trí</option>{jobs.filter(j => department === 'all' || j.department === department).map(j => <option key={j.id} value={j.id}>{j.title}</option>)}</select></Field>
      <Field label="Khoảng dự báo"><select value="1" disabled><option value="1">1 tháng · 09/2026 → 10/2026</option></select></Field>
    </div></Panel>
    <div className="grid gap-4 sm:grid-cols-3">
      <Metric label="Tổng nhu cầu dự báo" value={ready.length ? ready.reduce((s, r) => s + r.demand!, 0) : '—'} note={`${ready.length}/${rows.length} vị trí có snapshot hợp lệ`} />
      <Metric label="Intern sẵn có tháng tới" value={ready.length ? ready.reduce((s, r) => s + r.available!, 0) : '—'} note="Hiện tại − dự kiến kết thúc + đã xác nhận bắt đầu" />
      <Metric label="Cần tuyển bổ sung" value={ready.length ? ready.reduce((s, r) => s + r.additional!, 0) : '—'} note="Tính riêng từng phòng ban, sau khi làm tròn nhu cầu" />
    </div>
    <Panel title="Lịch sử và dự báo theo vị trí"><div className="grid gap-8 lg:grid-cols-3">{rows.map(r => {
      const series = [...r.history, ...r.projected];
      const max = Math.max(1, ...series);
      return <div key={r.job.id}><h3 className="text-sm font-semibold">{r.job.title}</h3><p className="mt-1 text-xs text-slate-500">{r.job.workforceSnapshot ? `SYNTH_CO_01 · ${r.job.workforceSnapshot.department}` : r.job.department}</p>
        {r.demand !== null ? <><div className="mt-5 flex h-44 items-end gap-1" role="img" aria-label={`Lịch sử ${r.history.join(', ')}, dự báo Ridge ${r.demand}`}>{series.map((value, i) => <div key={i} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end"><span className="mb-1 text-[10px]">{value}</span><div className={`w-full min-h-1 rounded-t ${i < r.history.length ? 'bg-slate-600' : 'bg-indigo-400'}`} style={{ height: `${value / max * 110}px` }} /><span className="mt-2 text-[9px] text-slate-500">{addMonths(r.endMonth, i - r.history.length + 1)?.slice(5)}</span></div>)}</div><p className="mt-3 text-xs text-slate-500">13 tháng lịch sử đến {r.endMonth}; cột tím là dự báo ML tháng {r.month}. Dữ liệu hoàn toàn giả lập.</p></> : <Empty>{r.reason}</Empty>}
        {r.job.workforceSnapshot && <button className="btn-secondary mt-4" onClick={() => { setEditingId(r.job.id); setDraft({ ...r.job.workforceSnapshot! }); setError(''); }}>Chỉnh kế hoạch giả lập</button>}
      </div>;
    })}</div>{!rows.length && <Empty>Chưa có vị trí trong phạm vi này.</Empty>}</Panel>
    {editingId && <Panel title={`Kế hoạch giả lập · ${jobs.find(j => j.id === editingId)?.title}`}>
      <p className="mb-4 text-sm text-slate-400">SYNTH_CO_01 · Chốt 30/09/2026 để dự báo 10/2026. Các đặc trưng lịch sử được giữ đồng bộ với nguồn; chỉ sửa số liệu hiện tại và kế hoạch để thử kịch bản.</p>
      <form onSubmit={e => { e.preventDefault(); const result = predictWorkforce(draft); if (!result.ok) { setError(result.error); return; } const job = jobs.find(j => j.id === editingId); if (job) updateJob({ ...job, workforceSnapshot: { ...draft } }); setEditingId(''); }}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{PLAN_FIELDS.map(([name, label]) => <Field key={name} label={label}><input required type="number" min={name === 'working_days_next_month' ? '1' : '0'} max={name === 'working_days_next_month' ? 31 : undefined} step={name.includes('hours') ? '0.1' : '1'} value={draft[name] ?? ''} onChange={e => setDraft(prev => ({ ...prev, [name]: e.target.value }))} /></Field>)}</div>
        <p role="alert" className="mt-4 text-sm text-rose-300">{error}</p><div className="mt-4 flex gap-3"><button type="submit" className="btn-primary">Lưu kế hoạch giả lập</button><button type="button" className="btn-secondary" onClick={() => setEditingId('')}>Hủy</button></div>
      </form>
    </Panel>}
    <Panel title="Kế hoạch bổ sung nhân lực"><div className="overflow-x-auto"><table className="data-table"><thead><tr><th>Vị trí</th><th>Tháng</th><th>Tổng nhu cầu</th><th>Hiện tại</th><th>Sẵn có tháng tới</th><th>Cần bổ sung</th></tr></thead><tbody>{rows.map(r => <tr key={r.job.id}><td>{r.job.title}</td><td>{r.month ?? '—'}</td><td>{r.demand ?? 'Chưa đủ dữ liệu'}</td><td>{r.current ?? '—'}</td><td>{r.available ?? '—'}</td><td className="font-semibold text-indigo-200">{r.additional ?? '—'}</td></tr>)}</tbody></table></div><p className="mt-4 text-xs text-slate-500">Cần bổ sung = max(0, tổng nhu cầu dự báo làm tròn − intern sẵn có tháng tới). Đầu ra model âm được chặn tại 0; chưa có đầu vào thì không tính thay bằng 0.</p></Panel>
  </div>;
}
