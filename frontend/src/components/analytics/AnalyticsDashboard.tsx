import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { hasUITEmail, majorCode } from '../../lib/recruitment';
import { funnelCounts, offerMetrics, OFFER_ACCEPTANCE_RATE, STAGE_LABELS } from '../../lib/recruitmentStats';
import { Panel, Metric, Field, Empty, pct } from './Shared';

export function AnalyticsDashboard() {
  const { jobs, candidates } = useApp();
  const [jobId,setJobId] = useState('all');
  const [source,setSource] = useState('all');
  const inScope = candidates.filter(c=>hasUITEmail(c.email) && !!majorCode(c.major));
  const sources = [...new Set(inScope.map(c=>c.source || 'Chưa xác định'))];
  const pool = inScope.filter(c=>(jobId==='all'||c.jobId===jobId) && (source==='all'||(c.source||'Chưa xác định')===source));
  const counts = funnelCounts(pool);
  const offers = offerMetrics(pool);
  return <div className="space-y-6">
    <Panel><p className="text-sm text-amber-200">Màn hình này dùng dữ liệu trình duyệt của demo cũ.</p><a className="mt-2 inline-block text-sm text-indigo-300 underline" href="/?view=applications#recruitment-analytics">Mở thống kê database và kế hoạch từ offer thực tế trong demo (HR)</a></Panel>
    <div><p className="mb-2 text-xs uppercase tracking-widest text-indigo-300">UIT · Thống kê tuyển dụng</p><h1 className="text-3xl font-bold">Tổng quan tuyển dụng</h1><p className="mt-2 text-sm text-slate-400">Theo dõi hồ sơ qua từng vòng và ước tính nhận offer với giả định cố định 75%.</p></div>
    <Panel><div className="grid gap-4 sm:grid-cols-2"><Field label="Vị trí tuyển dụng"><select value={jobId} onChange={e=>setJobId(e.target.value)}><option value="all">Tất cả vị trí</option>{jobs.map(j=><option key={j.id} value={j.id}>{j.title}</option>)}</select></Field><Field label="Nguồn ứng viên"><select value={source} onChange={e=>setSource(e.target.value)}><option value="all">Tất cả nguồn</option>{sources.map(s=><option key={s}>{s}</option>)}</select></Field></div><p className="mt-4 text-xs text-slate-500">Phạm vi thống kê: email @gm.uit.edu.vn và ngành tự khai KHMT, KTPM hoặc AI. Đây là kiểm tra định dạng email, chưa xác thực quyền sở hữu hộp thư.</p></Panel>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Metric label="Hồ sơ trong phạm vi lọc" value={pool.length} /><Metric label="HR đã chọn phỏng vấn" value={pool.filter(c=>c.invitation).length} /><Metric label="Offer chờ phản hồi" value={offers.pending} /><Metric label="Đã nhận việc" value={offers.accepted} /></div>
    <Panel title="Chuyển đổi qua các vòng"><div className="space-y-4">{counts.map((n,i)=><div key={i} className="grid items-center gap-3 sm:grid-cols-[180px_1fr_180px]"><span className="text-sm text-slate-300">{i+1}. {STAGE_LABELS.vi[i]}</span><div className="h-10 rounded-lg bg-slate-800"><div className="flex h-full min-w-10 items-center justify-end rounded-lg bg-indigo-500/70 px-3 text-sm font-bold" style={{width:`${counts[0]?n/counts[0]*100:0}%`}}>{n}</div></div><span className="text-xs text-slate-400">{i===0?'Đầu vào':counts[i-1]?`${pct(n/counts[i-1])} qua bước trước`:'Chưa có dữ liệu'}</span></div>)}</div><p className="mt-5 text-xs leading-relaxed text-slate-500">Tỷ lệ quan sát từ lịch sử hồ sơ, gồm cả hồ sơ đã bị loại; các đợt đang tuyển có thể chưa hoàn tất. HR chọn vòng 2 không có nghĩa đã hoàn tất phỏng vấn hoặc bài test. Dữ liệu cũ được chuyển đổi theo trạng thái đã lưu.</p></Panel>
    <Panel title="Ước tính nhận offer · Giả định cố định 75%"><div className="grid gap-4 sm:grid-cols-3"><Metric label="Tỷ lệ giả định" value={`${OFFER_ACCEPTANCE_RATE*100}%`} /><Metric label="Dự kiến từ offer đang chờ" value={offers.expectedPending.toFixed(2)} /><Metric label="Tổng nhận việc kỳ vọng" value={offers.expectedTotal.toFixed(2)} /></div><p className="mt-4 text-sm leading-relaxed text-slate-400">Dự kiến từ offer đang chờ = số offer chờ phản hồi × 75%. Tổng kỳ vọng = số đã nhận việc + dự kiến từ offer đang chờ.</p><p className="mt-3 text-xs text-slate-500">75% là giả định chung đã chốt, không phải xác suất được học từ dữ liệu hoặc dự đoán riêng cho từng ứng viên. Hồ sơ chưa có offer và hồ sơ bị loại không đóng góp vào ước tính này. Số thập phân là giá trị kỳ vọng, không phải số người đã xác nhận.</p></Panel>
    <Panel title="Thống kê theo nguồn"><div className="overflow-x-auto"><table className="data-table"><thead><tr><th>Nguồn</th><th>Hồ sơ</th><th>HR chọn vòng 2</th><th>Offer chờ</th><th>Đã nhận việc</th><th>Tổng kỳ vọng (75%)</th></tr></thead><tbody>{[...new Set(pool.map(c=>c.source||'Chưa xác định'))].map(s=>{const people=pool.filter(c=>(c.source||'Chưa xác định')===s);const metrics=offerMetrics(people);return <tr key={s}><td>{s}</td><td>{people.length}</td><td>{people.filter(c=>c.invitation).length}</td><td>{metrics.pending}</td><td>{metrics.accepted}</td><td>{metrics.expectedTotal.toFixed(2)}</td></tr>;})}</tbody></table>{!pool.length&&<Empty>Chưa có hồ sơ trong phạm vi này.</Empty>}</div></Panel>
  </div>;
}
