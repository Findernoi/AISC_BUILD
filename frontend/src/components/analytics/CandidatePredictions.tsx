import React, { useState, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { candidatePrediction } from '../../lib/forecast';
import { roundOneScore } from '../../lib/recruitment';
import { Empty, Field, Panel, pct } from './Shared';

export function CandidatePredictions() {
  const { jobs,candidates,demoMode } = useApp();
  const detailRef=useRef<HTMLDivElement>(null);
  const [jobId,setJobId] = useState('all');
  const [selectedId,setSelectedId] = useState('');
  const rows=candidates.filter(c=>(jobId==='all'||c.jobId===jobId)&&c.status!=='rejected'&&!['offer','accepted'].includes(c.stage)).map(c=>{const job=jobs.find(j=>j.id===c.jobId);return {c,job,prediction:candidatePrediction(c,job)};}).filter(r=>r.prediction!==null).sort((a,b)=>b.prediction!.probability-a.prediction!.probability||a.c.id.localeCompare(b.c.id));
  const selected=rows.find(r=>r.c.id===selectedId)||rows[0];
  return <div className="space-y-6">
    <div><p className="mb-2 text-xs uppercase tracking-widest text-indigo-300">Ước tính tại vòng hồ sơ</p><h1 className="text-3xl font-bold">Xác suất ứng viên được tuyển</h1><p className="mt-2 text-sm text-slate-400">Màn hình dự đoán tham khảo; quyết định tuyển dụng cuối cùng thuộc HR.</p></div>
    <Panel><p className="text-sm font-semibold text-amber-300">Mô phỏng · Chưa huấn luyện hoặc hiệu chỉnh xác suất bằng dataset</p><p className="mt-2 text-sm leading-relaxed text-slate-400">Các tỷ lệ hiện tính bằng công thức minh họa với hệ số cố định từ GPA, kỹ năng, ngoại ngữ, dự án và kinh nghiệm tự khai. Chưa phải xác suất trúng tuyển đã được kiểm chứng. Khi tích hợp ML sẽ thay công thức này bằng mô hình đã huấn luyện và đánh giá.</p><p className="mt-3 text-xs text-slate-500">Chỉ dùng thông tin có trước vòng 2. Không dùng điểm phỏng vấn hoặc bài test lập trình để dự đoán ngược vòng hồ sơ. Ước tính này không thay điểm vòng 1, không đổi top 10 và không tự mời hay loại ứng viên. Tỷ lệ đồng ý offer 75% là giả định riêng.</p></Panel>
    <Panel><Field label="Lọc vị trí để xem xác suất"><select value={jobId} onChange={e=>{setJobId(e.target.value);setSelectedId('');}}><option value="all">Tất cả vị trí</option>{jobs.map(j=><option key={j.id} value={j.id}>{j.title}</option>)}</select></Field><p className="mt-3 text-xs text-slate-500">{rows.length} hồ sơ hợp lệ thuộc phạm vi UIT / KHMT, KTPM, AI đang trước quyết định tuyển. Hồ sơ đã có kết quả không được đưa vào bảng ước tính này.</p></Panel>
    <Panel title="Ước tính theo hồ sơ · Mô phỏng"><div className="overflow-x-auto"><table className="data-table"><thead><tr><th>Ứng viên</th><th>Vị trí</th><th>Điểm vòng 1</th><th>Xác suất mô phỏng</th><th>Chi tiết</th></tr></thead><tbody>{rows.map(r=><tr key={r.c.id}><td><p className="font-semibold">{r.c.fullName}</p><p className="mt-1 text-xs text-slate-500">{r.c.major}</p></td><td>{r.job!.title}</td><td>{roundOneScore(r.c,r.job!,demoMode).total}/100</td><td className="font-semibold text-indigo-200">{pct(r.prediction!.probability)}</td><td><button className="btn-secondary" onClick={()=>{setSelectedId(r.c.id);detailRef.current?.scrollIntoView({behavior:"smooth",block:"start"});}}>Xem yếu tố</button></td></tr>)}</tbody></table>{!rows.length&&<Empty>Chưa có hồ sơ hợp lệ trong phạm vi này.</Empty>}</div></Panel>
    {selected&&<div ref={detailRef} className="scroll-mt-40"><Panel title={`Yếu tố trong công thức mô phỏng · ${selected.c.fullName}`}><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{selected.prediction!.factors.map(f=><div key={f.key} className="rounded-xl bg-slate-950 p-4"><p className="text-xs text-slate-400">{f.label}</p><p className="mt-2 text-sm text-slate-200">{f.observed}</p><p className={`mt-2 text-xs ${f.value>0?'text-indigo-300':'text-slate-500'}`}>{f.value>0?'Làm tăng ước tính minh họa':f.value<0?'Làm giảm ước tính minh họa':'Trung tính trong công thức'}</p></div>)}</div><p className="mt-4 text-xs text-slate-500">Đây là diễn giải công thức demo, chưa phải kết quả giải thích của một mô hình ML đã huấn luyện. Điểm phù hợp /100 và xác suất mô phỏng là hai đại lượng khác nhau.</p></Panel></div>}
  </div>;
}
