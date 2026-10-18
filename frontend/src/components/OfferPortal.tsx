import React,{useEffect,useState} from 'react';
import type {RecruitmentApplication,RecruitmentJob,RecruitmentOffer,HiringReport} from '../../../shared/recruitment';
import {recruitmentFetch} from '../lib/recruitmentApi';
import {Panel,Field} from './analytics/Shared';
const labels={pending:'Chờ ứng viên phản hồi',accepted:'Ứng viên đã chấp nhận',declined:'Ứng viên đã từ chối',superseded:'Đã được thay thế'};
export function OfferPortal({applications,jobs,hr,onChanged}:{applications:RecruitmentApplication[];jobs:RecruitmentJob[];hr:boolean;onChanged:()=>Promise<void>}) {
  const [offers,setOffers]=useState<RecruitmentOffer[]>([]),[selected,setSelected]=useState(''),[report,setReport]=useState<HiringReport|null>(null),[version,setVersion]=useState(0),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const eligible=applications.filter(a=>a.stage==='offer'&&a.status==='passed'),current=eligible.find(a=>a.id===selected)??eligible[0];
  const refreshKey=applications.map(a=>`${a.id}:${a.revision}`).join(',');
  useEffect(()=>{const controller=new AbortController();setLoading(true);setError('');setOffers([]);
    void recruitmentFetch('offers',{signal:controller.signal}).then(r=>r.json()).then(d=>{if(!controller.signal.aborted)setOffers(d.offers);}).catch(e=>{if(!controller.signal.aborted)setError(e.message);}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});return()=>controller.abort();
  },[version,refreshKey]);
  const id=current?.id;
  useEffect(()=>{setReport(null);if(!hr||!id)return;const controller=new AbortController();
    void recruitmentFetch(`applications/${id}/hiring`,{signal:controller.signal}).then(r=>r.json()).then(d=>{if(!controller.signal.aborted)setReport(d.report);}).catch(e=>{if(!controller.signal.aborted)setError(e.message);});return()=>controller.abort();
  },[hr,id,version,refreshKey]);
  const last=report?.history[0],canIssue=!loading&&last?.result==='hire'&&last.source_basis===report?.basis&&report.finalScore!==null;
  const pending=current?offers.find(o=>o.application_id===current.id&&o.status==='pending'):undefined;
  const perform=async(action:()=>Promise<void>,success:string)=>{setBusy(true);setError('');setNotice('');try{await action();setNotice(success);setVersion(v=>v+1);await onChanged();}catch(e){setError(e instanceof Error?e.message:'Không lưu được dữ liệu.');}finally{setBusy(false);}};
  const issue=(e:React.FormEvent<HTMLFormElement>)=>{e.preventDefault();if(!current||!report||!last||!canIssue)return;const f=new FormData(e.currentTarget);
    void perform(async()=>{await recruitmentFetch(`applications/${current.id}/offers`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({expectedOfferId:pending?.id??null,expectedDecisionId:last.id,expectedBasis:report.basis,positionTitle:f.get('positionTitle'),startDate:f.get('startDate'),content:f.get('content')})});},'Đã phát hành offer trong ứng dụng. Ứng viên có thể đăng nhập để phản hồi; chưa gửi email.');
  };
  const respond=(e:React.FormEvent<HTMLFormElement>,offer:RecruitmentOffer)=>{e.preventDefault();const f=new FormData(e.currentTarget);
    void perform(async()=>{await recruitmentFetch(`offers/${offer.id}/respond`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({expectedRevision:offer.revision,outcome:f.get('outcome'),note:f.get('note')})});},'Đã lưu phản hồi offer và cập nhật trạng thái hồ sơ.');
  };
  return <Panel title={hr?'Offer và phản hồi ứng viên':'Thông báo offer của tôi'}><div className="space-y-5">
    <p className="text-sm text-slate-400">Thông báo trong ứng dụng · Bản demo, không gửi email thật. Chấp nhận offer ghi nhận đồng ý nhận đề nghị, chưa phải xác nhận đã bắt đầu làm việc.</p>
    <button className="btn-secondary" disabled={busy||loading} onClick={()=>{setNotice('');setVersion(v=>v+1);}}>Tải lại offer</button>
    {error&&<p role="alert" className="text-sm text-rose-300">{error} Hãy tải lại trước khi thử lại.</p>}{notice&&<p role="status" className="text-sm text-emerald-300">{notice}</p>}
    {hr&&<>{current?<><Field label="Hồ sơ đã được chọn tuyển"><select disabled={busy} value={current.id} onChange={e=>setSelected(e.target.value)}>{eligible.map(a=><option key={a.id} value={a.id}>{a.full_name} · {jobs.find(j=>j.id===a.job_id)?.title}</option>)}</select></Field>
      {!report?<p>Đang tải căn cứ quyết định…</p>:!canIssue?<p className="text-sm text-amber-200">Cần quyết định chọn tuyển còn khớp dữ liệu hiện tại. HR tải lại tổng hợp và duyệt lại trước khi phát hành offer.</p>:<form key={`${current.id}:${last?.id}:${pending?.id??'new'}`} onSubmit={issue} className="space-y-4 rounded-xl border border-slate-800 p-4"><h3 className="font-semibold">{pending?'Phát hành bản mới thay thế offer đang chờ':'Tạo offer trong ứng dụng'}</h3>
        {pending&&<p className="text-sm text-amber-200">Bản đang chờ sẽ ngừng hiệu lực khi phát hành bản mới; lịch sử vẫn được giữ.</p>}
        <fieldset disabled={busy} className="space-y-4"><Field label="Vị trí trong đề nghị tuyển"><input name="positionTitle" required maxLength={200} defaultValue={pending?.position_title??jobs.find(j=>j.id===current.job_id)?.title??''}/></Field><Field label="Ngày bắt đầu dự kiến"><input name="startDate" type="date" required defaultValue={pending?.start_date??''}/></Field><Field label="Nội dung đề nghị dành cho ứng viên"><textarea name="content" required rows={5} maxLength={10000} defaultValue={pending?.content??''}/></Field><button className="btn-primary">{pending?'Phát hành offer thay thế':'Phát hành offer'}</button></fieldset>
      </form>}</>:<p className="text-sm text-slate-400">Chưa có hồ sơ chờ offer. HR cần lưu quyết định chọn tuyển trước.</p>}</>}
    {loading?<p role="status">Đang tải offer…</p>:<><p className="text-xs text-slate-400">Hiển thị tối đa 200 offer mới nhất được phép đọc, gồm lịch sử thay thế và phản hồi.</p>{offers.map(o=><article key={`${o.id}:${o.revision}`} className="space-y-3 rounded-xl border border-indigo-900 bg-indigo-950/20 p-4"><h3 className="font-semibold text-indigo-200">{o.position_title}{hr?` · ${o.candidate_name}`:''}</h3><p className="text-sm font-semibold">{labels[o.status]}</p><p className="text-sm">Ngày bắt đầu dự kiến: {o.start_date.split('-').reverse().join('/')}</p><p className="whitespace-pre-wrap break-words text-sm">{o.content}</p><p className="text-xs text-slate-400">Phát hành: {new Date(o.issued_at).toLocaleString('vi-VN')}</p>
      {o.status==='pending'&&!o.actionable&&<p className="text-sm text-amber-200">Offer chưa thể phản hồi vì hồ sơ hoặc căn cứ tuyển dụng đã đổi. HR cần kiểm tra và phát hành lại.</p>}
      {o.responded_at&&<div className="text-sm"><p>Phản hồi: {new Date(o.responded_at).toLocaleString('vi-VN')}</p>{o.response_note&&<p className="mt-2 whitespace-pre-wrap break-words">Lời nhắn ứng viên: {o.response_note}</p>}</div>}
      {!hr&&o.actionable&&<form onSubmit={e=>respond(e,o)} className="space-y-3 border-t border-slate-800 pt-4"><fieldset disabled={busy} className="space-y-3"><Field label="Phản hồi offer"><select name="outcome" required defaultValue=""><option value="" disabled>Chọn phản hồi</option><option value="accepted">Chấp nhận offer</option><option value="declined">Từ chối offer</option></select></Field><Field label="Lời nhắn cho HR (không bắt buộc)"><textarea name="note" rows={2} maxLength={2000}/></Field><button className="btn-primary">Lưu phản hồi offer</button></fieldset></form>}
    </article>)}{!offers.length&&<p className="text-sm text-slate-400">Chưa có offer được phát hành.</p>}</>}
  </div></Panel>;
}
