import React, { useEffect, useState } from 'react';
import type { EvidenceCheck, RecruitmentFile,EvidenceAssessment } from '../../../shared/recruitment';
import { recruitmentFetch } from '../lib/recruitmentApi';

const statusLabels={matched:'Thông tin đã đối chiếu khớp',mismatch:'Có sai lệch cần HR đối chiếu',unclear:'Cần HR xem thêm',unreadable:'Không đọc được minh chứng'};
const outcomes={match:'Khớp',mismatch:'Sai lệch',unclear:'Chưa rõ'};
export function EvidenceCheckPanel({file,initial,onChanged,expanded=false,refreshKey=0}:{file:RecruitmentFile;initial?:EvidenceCheck;onChanged?:()=>Promise<void>;expanded?:boolean;refreshKey?:number}) {
  const [open,setOpen]=useState(expanded);
  const [assessment,setAssessment]=useState<EvidenceAssessment|null>(null);
  const [check,setCheck]=useState<EvidenceCheck|null>(null);
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  useEffect(()=>{if(initial){setCheck(initial);setOpen(true);}},[initial]);
  useEffect(()=>{
    if(!open)return;
    const controller=new AbortController();setBusy(true);setError('');
    void recruitmentFetch(`files/${file.id}/check`,{signal:controller.signal}).then(r=>r.json()).then(r=>{if(!controller.signal.aborted){setCheck(r.check);setAssessment(r.assessment);}}).catch(e=>{if(!controller.signal.aborted)setError(e.message);}).finally(()=>{if(!controller.signal.aborted)setBusy(false);});
    return()=>controller.abort();
  },[open,file.id,initial,refreshKey]);
  const run=async()=>{
    setBusy(true);setError('');
    try{const response=await recruitmentFetch(`files/${file.id}/check`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({force:true})});const data=await response.json();setCheck(data.check);setAssessment(data.assessment);await onChanged?.();}catch(e){setError(e instanceof Error?e.message:'Không đọc được tệp.');}finally{setBusy(false);}
  };
  return <div className="mt-3 space-y-3"><button className="text-xs text-indigo-200 underline" aria-expanded={open} onClick={()=>setOpen(!open)}>Kết quả đọc và đối chiếu tự động</button>{open&&<div className="space-y-3 rounded-lg border border-slate-700 p-3">
    <p className="text-xs text-slate-400">Khớp đầy đủ theo khai báo hiện tại sẽ được tính điểm ngoại ngữ/thành tích. Chỉ ngoại lệ cần HR xử lý; không xác nhận tính thật từ đơn vị cấp và không tự loại ứng viên.</p>
    {assessment&&<p className="text-xs text-indigo-200">{({automatic:'Khớp thông tin tự động · được tính điểm theo công thức',exception:'Ngoại lệ · tạm chưa cộng điểm',accepted:'HR đã chấp nhận ngoại lệ · được tính điểm theo công thức',rejected:'HR không chấp nhận minh chứng · không cộng phần điểm này',obsolete:'Tệp cũ · không dùng tính điểm',not_scored:'CV · không có điểm minh chứng'})[assessment.status]}</p>}
    {error&&<p role="alert" className="text-xs text-rose-300">{error}</p>}
    {busy&&<p role="status" className="text-xs text-slate-400">Đang đọc PDF/OCR trên server…</p>}
    {check?<><p className={`text-sm font-semibold ${check.stale?'text-amber-200':check.result.status==='matched'?'text-indigo-200':'text-amber-200'}`}>{check.stale?'Kết quả cũ — thông tin liên quan đã thay đổi':statusLabels[check.result.status]}</p><p className="text-xs text-slate-500">{new Date(check.created_at).toLocaleString('vi-VN')} · {check.result.engine}</p><div className="overflow-x-auto"><table className="data-table"><thead><tr><th>Trường</th><th>Khai báo</th><th>Đọc được</th><th>Đối chiếu</th></tr></thead><tbody>{check.result.fields.map(field=><tr key={field.key}><td>{field.label}</td><td>{field.declared||'Chưa khai'}</td><td>{field.extracted??'Không đọc rõ'}{field.page?` (trang ${field.page})`:''}</td><td>{outcomes[field.outcome]}</td></tr>)}</tbody></table></div><ul className="space-y-1 text-xs text-slate-400">{check.result.notes.map(note=><li key={note}>{note}</li>)}</ul><details className="text-xs"><summary className="cursor-pointer text-indigo-200">Thông tin trích xuất làm căn cứ</summary><div className="mt-3 space-y-3">{check.result.pages.map(page=><div key={page.page}><p className="text-slate-400">Trang {page.page} · {page.method==='ocr'?`OCR (${page.confidence?.toFixed(0)??'?'} điểm độ rõ do engine ước tính)`:'Lớp chữ PDF'}</p><pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words text-slate-300">{page.text}</pre></div>)}</div></details></>:!busy&&<p className="text-xs text-slate-400">Tệp này chưa được đối chiếu tự động.</p>}
    <button className="btn-secondary" disabled={busy} onClick={()=>void run()}>{check?'Đọc và đối chiếu lại':'Đọc và đối chiếu tệp'}</button>
  </div>}</div>;
}
