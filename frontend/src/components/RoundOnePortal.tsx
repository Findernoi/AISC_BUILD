import React,{useEffect,useState} from 'react';
import type { RecruitmentJob,RoundOneReport } from '../../../shared/recruitment';
import { recruitmentFetch } from '../lib/recruitmentApi';
import { Field,Panel } from './analytics/Shared';

export function RoundOnePortal({jobs,local,onChanged,refreshKey=''}:{jobs:RecruitmentJob[];local:boolean;onChanged:()=>Promise<void>;refreshKey?:string}) {
  const [jobId,setJobId]=useState('all'),[major,setMajor]=useState('all');
  const [report,setReport]=useState<RoundOneReport|null>(null);
  const [selected,setSelected]=useState<string[]>([]);
  const [version,setVersion]=useState(0),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
  const [error,setError]=useState(''),[notice,setNotice]=useState('');
  useEffect(()=>{
    const controller=new AbortController();setLoading(true);setError('');setSelected([]);setReport(null);
    void recruitmentFetch(`round-one?${new URLSearchParams({jobId,major})}`,{signal:controller.signal}).then(r=>r.json())
      .then(data=>{if(!controller.signal.aborted)setReport(data.report);}).catch(e=>{if(!controller.signal.aborted)setError(e.message);}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return()=>controller.abort();
  },[jobId,major,version,refreshKey]);
  const invite=async()=>{
    setBusy(true);setError('');setNotice('');
    try{
      const response=await recruitmentFetch('round-one/invitations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({applicationIds:selected,jobId,major})});
      const data=await response.json();setNotice(`Đã lưu ${data.invitations.length} lời mời vòng 2. Chưa gửi email hoặc đặt lịch phỏng vấn.`);setVersion(v=>v+1);await onChanged();
    }catch(e){setError(e instanceof Error?e.message:'Không lưu được lời mời.');setSelected([]);}finally{setBusy(false);}
  };
  const seed=async()=>{
    setBusy(true);setError('');setNotice('');
    try{const response=await recruitmentFetch('round-one/local-demo',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});const data=await response.json();await onChanged();setJobId(data.jobId);setMajor('all');setVersion(v=>v+1);setNotice('Đã mở bộ 12 hồ sơ giả lập để kiểm tra giới hạn top 10.');}
    catch(e){setError(e instanceof Error?e.message:'Không tạo được dữ liệu thử.');}finally{setBusy(false);}
  };
  return <Panel title="Vòng 1 và top 10 · Database"><div className="space-y-5">
    <p className="text-sm leading-relaxed text-slate-400">Điểm do backend tính theo công thức hiện có. Top 10 cần từ 75 điểm, GPA đạt mức vị trí và hồ sơ còn trong giai đoạn xét tuyển. HR chọn người mời; hệ thống kiểm tra lại toàn bộ danh sách khi lưu.</p>
    <p className="text-xs text-amber-200">Minh chứng ngoại ngữ/thành tích khớp đầy đủ tự được tính điểm theo khai báo hiện tại; chỉ ngoại lệ cần HR xử lý. Không xác nhận tính thật từ đơn vị cấp. Thiếu số dự án/kinh nghiệm thì phần đó chưa có điểm.</p>
    <div className="grid gap-4 sm:grid-cols-2"><Field label="Lọc vị trí vòng 1"><select value={jobId} disabled={busy} onChange={e=>{setJobId(e.target.value);setNotice('');}}><option value="all">Tất cả vị trí</option>{jobs.map(job=><option key={job.id} value={job.id}>{job.title}{job.status==='closed'?' (đã đóng)':''}</option>)}</select></Field><Field label="Lọc ngành vòng 1"><select value={major} disabled={busy} onChange={e=>{setMajor(e.target.value);setNotice('');}}><option value="all">Tất cả ngành</option><option value="AI">AI</option><option value="KHMT">KHMT</option><option value="KTPM">KTPM</option></select></Field></div>
    <div className="flex flex-wrap gap-3"><button className="btn-secondary" disabled={busy} onClick={()=>setVersion(v=>v+1)}>Tải lại vòng 1</button>{local&&<button className="btn-secondary" disabled={busy} onClick={()=>void seed()}>Thêm bộ hồ sơ thử vòng 1</button>}</div>
    {notice&&<p role="status" className="text-sm text-emerald-200">{notice}</p>}{error&&<p role="alert" className="text-sm text-rose-300">{error}</p>}
    {loading?<p role="status" className="text-sm text-slate-400">Đang tính điểm và xếp hạng trong database…</p>:report&&<>
      <p className="text-sm text-slate-300">{report.total} hồ sơ trong bộ lọc · {report.qualified} đủ điều kiện xếp hạng · {Math.min(10,report.qualified)} trong top 10.</p>
      <div className="flex flex-wrap items-center gap-3"><button className="btn-primary" disabled={busy||!selected.length} onClick={()=>void invite()}>{busy?'Đang lưu…':`Mời ${selected.length} hồ sơ đã chọn vào vòng 2`}</button><span className="text-xs text-slate-500">Tối đa 10 người; không tự chọn hoặc tự gửi thư.</span></div>
      <div className="space-y-3">{report.rows.map(row=>{
        const canInvite=row.inTopTen&&!row.invitation&&['applied','cv_passed'].includes(row.application.stage);
        return <article key={row.application.id} className="rounded-xl border border-slate-800 bg-slate-950 p-4"><div className="flex flex-wrap justify-between gap-4"><div className="min-w-0"><label className="flex items-start gap-3"><input type="checkbox" aria-label={`Chọn ${row.application.full_name} vào vòng 2`} checked={selected.includes(row.application.id)} disabled={busy||!canInvite} onChange={e=>setSelected(ids=>e.target.checked?[...ids,row.application.id]:ids.filter(id=>id!==row.application.id))} /><span><strong className="block text-sm text-indigo-200">{row.application.full_name}</strong><span className="mt-1 block text-xs text-slate-400">{row.jobTitle} · {row.application.major}</span></span></label></div><div className="text-right"><p className="text-xl font-bold text-indigo-200">{Number(row.score.total).toFixed(1)} / 100</p><p className="mt-1 text-xs text-slate-400">{row.invitation?'Đã có lời mời vòng 2':row.inTopTen?`Top ${row.rank}`:row.rank?`Đủ điểm · Hạng ${row.rank}, ngoài top 10`:'Chưa đủ điều kiện'}</p></div></div>
          {!!row.reasons.length&&<ul className="mt-3 space-y-1 text-xs text-amber-200">{row.reasons.map(reason=><li key={reason}>{reason}</li>)}</ul>}
          {row.score.evidenceAlerts>0&&<p className="mt-3 text-xs text-amber-200">Có {row.score.evidenceAlerts} loại tệp chưa có đối chiếu rõ ràng hoặc có sai lệch. HR xem trong CV và minh chứng; không tự loại hồ sơ.</p>}
          <details className="mt-3 text-xs"><summary className="cursor-pointer text-indigo-200">Điểm thành phần và căn cứ</summary><div className="mt-3 space-y-2 text-slate-400">{row.score.contributions.map(part=><p key={part.key}>{part.label}: {Number(part.value).toFixed(2)} / {part.max}</p>)}<p>GPA quy về thang 4: {Number(row.score.gpaNormalized).toFixed(2)}</p><p>Kỹ năng khớp từ khóa JD; dự án và kinh nghiệm là thông tin tự khai.</p>{row.invitation&&<p>Điểm tại lúc mời: {row.invitation.round_one_score} · {new Date(row.invitation.invited_at).toLocaleString('vi-VN')}. Điểm hiện tại có thể đổi nếu thông tin liên quan thay đổi.</p>}</div></details>
        </article>;
      })}{!report.rows.length&&<p className="text-sm text-slate-500">Chưa có hồ sơ trong bộ lọc này.</p>}</div>
      {report.total>200&&<p className="text-xs text-slate-500">Đang hiển thị 200 hồ sơ đầu sau khi tính điểm toàn bộ dữ liệu. Top 10 được xếp trên toàn bộ hồ sơ trong bộ lọc.</p>}
    </>}
  </div></Panel>;
}
