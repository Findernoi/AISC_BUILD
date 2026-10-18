import React,{useEffect,useState} from 'react';
import type { RecruitmentApplication,InterviewInvitation,RoundTwoReport,RoundTwoMutation } from '../../../shared/recruitment';
import { recruitmentFetch } from '../lib/recruitmentApi';
import { INTERVIEW_CRITERIA } from '../lib/recruitment';
import { Panel,Field } from './analytics/Shared';

export function RoundTwoPortal({applications,invitations,hr,onChanged}:{applications:RecruitmentApplication[];invitations:InterviewInvitation[];hr:boolean;onChanged:()=>Promise<void>}) {
  const [selected,setSelected]=useState('');
  const invited=applications.filter(a=>invitations.some(i=>i.application_id===a.id));
  const current=invited.find(a=>a.id===selected)??invited[0];
  return <Panel title="Vòng 2 · Lịch và đánh giá phỏng vấn">
    <p className="mb-4 text-sm text-slate-400">{hr?'Lưu lịch, điểm bài test và phiếu phỏng vấn vào database. Điểm và ghi chú đánh giá chỉ HR được xem.':'Xem lịch và hướng dẫn phỏng vấn dành cho hồ sơ của bạn.'} Chưa gửi email hoặc tạo sự kiện lịch tự động.</p>
    {!current?<p className="text-sm text-slate-400">Chưa có hồ sơ được mời vào vòng 2.</p>:<>
      <Field label="Hồ sơ đã được mời"><select value={current.id} onChange={e=>setSelected(e.target.value)}>{invited.map(a=><option key={a.id} value={a.id}>{a.full_name} · {a.major} · {a.id.slice(0,8)}</option>)}</select></Field>
      <RoundTwoDetail key={current.id} application={current} hr={hr} onChanged={onChanged} />
    </>}
  </Panel>;
}
function localTime(value:string) {
  const d=new Date(value);return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);
}
function RoundTwoDetail({application,hr,onChanged}:{application:RecruitmentApplication;hr:boolean;onChanged:()=>Promise<void>}) {
  const [report,setReport]=useState<RoundTwoReport|null>(null),[version,setVersion]=useState(0),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const path=`applications/${application.id}/round-two`;
  useEffect(()=>{
    const controller=new AbortController();setReport(null);setError('');
    void recruitmentFetch(path,{signal:controller.signal}).then(r=>r.json()).then(data=>{if(!controller.signal.aborted)setReport(data.report);}).catch(e=>{if(!controller.signal.aborted)setError(e.message);});
    return()=>controller.abort();
  },[path,version]);
  const save=async(input:RoundTwoMutation)=>{
    setBusy(true);setError('');setNotice('');
    try{await recruitmentFetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});setNotice('Đã lưu vào database.');setVersion(v=>v+1);await onChanged();}
    catch(e){setError(e instanceof Error?e.message:'Không lưu được dữ liệu.');}finally{setBusy(false);}
  };
  const editable=hr&&application.stage==='interview'&&application.status==='passed';
  return <div className="mt-5 space-y-5">
    {error&&<p role="alert" className="text-sm text-rose-300">{error}</p>}
    {notice&&<p role="status" className="text-sm text-emerald-300">{notice}</p>}
    <button type="button" disabled={busy} className="btn-secondary" onClick={()=>{setNotice('');setVersion(v=>v+1);}}>Tải lại vòng 2</button>
    {!report?(!error&&<p role="status">Đang tải vòng 2…</p>):<div key={report.revision} className="space-y-6">
      {report.schedule?<div className="rounded-xl border border-indigo-800 bg-indigo-950/30 p-4 text-sm"><h3 className="font-semibold text-indigo-200">Lịch phỏng vấn đã lưu</h3><p className="mt-2">{new Date(report.schedule.starts_at).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'})} (giờ Việt Nam) · {report.schedule.duration_minutes} phút</p><p className="mt-2 whitespace-pre-wrap">Địa điểm / đường dẫn: {report.schedule.location}</p><p className="mt-2">Người phỏng vấn: {report.schedule.interviewer}</p><p className="mt-2 whitespace-pre-wrap">{report.schedule.instructions}</p></div>:<p className="text-sm text-amber-200">Đã có lời mời vòng 2; HR chưa lưu lịch cụ thể.</p>}
      {editable&&<form className="space-y-4" onSubmit={e=>{
        e.preventDefault();const f=new FormData(e.currentTarget);const date=new Date(String(f.get('starts_at')));if(!Number.isFinite(date.getTime()))return;
        void save({kind:'schedule',expectedRevision:report.revision,data:{starts_at:date.toISOString(),duration_minutes:Number(f.get('duration_minutes')),location:String(f.get('location')),interviewer:String(f.get('interviewer')),instructions:String(f.get('instructions'))}});
      }}><h3 className="font-semibold">Lịch phỏng vấn</h3><fieldset disabled={busy} className="space-y-4"><div className="grid gap-4 sm:grid-cols-2">
        <Field label={`Ngày giờ (${Intl.DateTimeFormat().resolvedOptions().timeZone})`}><input type="datetime-local" name="starts_at" required defaultValue={report.schedule?localTime(report.schedule.starts_at):''}/></Field>
        <Field label="Thời lượng (phút)"><input type="number" name="duration_minutes" min={5} max={480} required defaultValue={report.schedule?.duration_minutes??60}/></Field>
        <Field label="Địa điểm / đường dẫn họp"><input name="location" maxLength={1000} required defaultValue={report.schedule?.location??''}/></Field>
        <Field label="Người phỏng vấn"><input name="interviewer" maxLength={160} required defaultValue={report.schedule?.interviewer??''}/></Field>
      </div><Field label="Hướng dẫn cho ứng viên"><textarea name="instructions" maxLength={5000} rows={3} defaultValue={report.schedule?.instructions??''}/></Field><button className="btn-primary">Lưu lịch phỏng vấn</button></fieldset></form>}
      {hr&&<><form className="space-y-4 border-t border-slate-800 pt-5" onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);void save({kind:'coding',expectedRevision:report.revision,data:{score:Number(f.get('score')),notes:String(f.get('notes'))}});}}>
        <h3 className="font-semibold">Điểm bài test lập trình</h3>{report.coding&&<p className="text-sm text-indigo-200">Đã lưu: {report.coding.score}/100 · {new Date(report.coding.reviewed_at).toLocaleString('vi-VN')}</p>}
        <fieldset disabled={busy||!editable} className="space-y-4"><Field label="Điểm bài test (0–100)"><input name="score" type="number" min={0} max={100} step="0.1" required defaultValue={report.coding?.score??''}/></Field><Field label="Ghi chú / nguồn kết quả (nội bộ)"><textarea name="notes" maxLength={5000} rows={2} defaultValue={report.coding?.notes??''}/></Field><button className="btn-primary">Lưu điểm bài test</button></fieldset>
      </form>
      <form className="space-y-4 border-t border-slate-800 pt-5" onSubmit={e=>{
        e.preventDefault();const f=new FormData(e.currentTarget);
        const scores=Object.fromEntries(INTERVIEW_CRITERIA.map(c=>[c.key,Number(f.get(c.key))])) as Extract<RoundTwoMutation,{kind:'interview'}>['data']['scores'];
        const evidence=Object.fromEntries(INTERVIEW_CRITERIA.map(c=>[c.key,String(f.get(`${c.key}_evidence`))])) as Extract<RoundTwoMutation,{kind:'interview'}>['data']['evidence'];
        void save({kind:'interview',expectedRevision:report.revision,data:{scores,evidence}});
      }}><h3 className="font-semibold">Phiếu phỏng vấn · 5 tiêu chí</h3><p className="text-xs text-slate-400">Thang 1–10: 1–3 chưa đáp ứng; 4–6 cơ bản; 7–8 đáp ứng rõ; 9–10 vận dụng tốt, có bằng chứng. Người ghi nhận lấy từ tài khoản HR đăng nhập.</p>
        {report.interview&&<p className="text-sm text-indigo-200">Điểm phỏng vấn do database tính: {Number(report.interview.overall_score).toFixed(2)}/100 · {new Date(report.interview.reviewed_at).toLocaleString('vi-VN')}</p>}
        <fieldset disabled={busy||!editable} className="space-y-5">{INTERVIEW_CRITERIA.map(c=><div key={c.key} className="grid gap-3 sm:grid-cols-[1fr_100px_1.3fr]"><div><p className="text-sm font-semibold">{c.label} · {c.weight}%</p><p className="mt-1 text-xs text-slate-400">{c.anchor}</p></div><Field label="Điểm 1–10"><input aria-label={`Điểm ${c.label}`} name={c.key} type="number" min={1} max={10} step="0.1" required defaultValue={report.interview?.[c.key]??''}/></Field><Field label="Bằng chứng quan sát (nội bộ)"><textarea aria-label={`Bằng chứng ${c.label}`} name={`${c.key}_evidence`} maxLength={3000} required rows={3} defaultValue={report.interview?.evidence[c.key]??''}/></Field></div>)}<button className="btn-primary">Lưu phiếu phỏng vấn</button></fieldset>
      </form>{!editable&&<p className="text-sm text-amber-200">Hồ sơ không còn ở trạng thái phỏng vấn; chỉ được xem dữ liệu đã lưu.</p>}</>}
    </div>}
  </div>;
}
