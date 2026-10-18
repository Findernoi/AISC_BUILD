import React,{lazy,Suspense,useEffect,useState} from 'react';
import type {EvidenceExceptionReport,RecruitmentFile} from '../../../shared/recruitment';
import {recruitmentFetch} from '../lib/recruitmentApi';
import {Panel,Field} from './analytics/Shared';
import {EvidenceCheckPanel} from './EvidenceCheckPanel';
const PdfPreview=lazy(()=>import('./PdfPreview'));
export function EvidenceExceptionsPortal({onChanged,refreshKey}:{onChanged:()=>Promise<void>;refreshKey:string}) {
  const [report,setReport]=useState<EvidenceExceptionReport|null>(null),[selected,setSelected]=useState(''),[version,setVersion]=useState(0),[loading,setLoading]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  useEffect(()=>{const controller=new AbortController();setLoading(true);setError('');setReport(null);
    void recruitmentFetch('evidence-exceptions',{signal:controller.signal}).then(r=>r.json()).then(d=>{if(!controller.signal.aborted)setReport(d.report);}).catch(e=>{if(!controller.signal.aborted)setError(e.message);}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});return()=>controller.abort();
  },[version,refreshKey]);
  const current=report?.rows.find(r=>r.file.id===selected)??report?.rows[0];
  const changed=async()=>{setVersion(v=>v+1);await onChanged();};
  const resolve=async(e:React.FormEvent<HTMLFormElement>)=>{
    e.preventDefault();if(!current)return;const f=new FormData(e.currentTarget);setBusy(true);setError('');setNotice('');
    try{await recruitmentFetch(`files/${current.file.id}/resolve-exception`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({expectedBasis:current.assessment.basis,outcome:f.get('outcome'),reason:f.get('reason')})});setNotice('Đã lưu kết luận xử lý ngoại lệ. Điểm cập nhật theo công thức; không tự loại ứng viên.');await changed();}catch(e){setError(e instanceof Error?e.message:'Không lưu được kết luận.');}finally{setBusy(false);}
  };
  return <Panel title="Ngoại lệ minh chứng · HR"><div className="space-y-4"><p className="text-sm text-slate-400">Tệp khớp đầy đủ tự được tính điểm và không xuất hiện ở đây. HR chỉ xử lý minh chứng lệch, thiếu, không rõ, chưa đọc được hoặc cần đọc lại. Kết luận chấp nhận nội dung để tính điểm không phải xác thực chứng chỉ từ đơn vị cấp.</p>
    <button className="btn-secondary" disabled={busy||loading} onClick={()=>setVersion(v=>v+1)}>Tải lại ngoại lệ</button>
    {error&&<p role="alert" className="text-sm text-rose-300">{error} Tải lại hàng chờ nếu dữ liệu đã đổi.</p>}{notice&&<p role="status" className="text-sm text-emerald-300">{notice}</p>}
    {loading?<p role="status">Đang tải ngoại lệ…</p>:report&&<><p className="text-sm text-indigo-200">{report.total} minh chứng cần xử lý{report.total>200?' · Hiển thị 200 tệp cũ nhất':''}.</p>
      {current&&<><Field label="Chọn ngoại lệ"><select disabled={busy} value={current.file.id} onChange={e=>{setSelected(e.target.value);setNotice('');}}>{report.rows.map(r=><option key={r.file.id} value={r.file.id}>{r.application.full_name} · {r.file.kind==='english'?'Ngoại ngữ':'Thành tích'} · {r.file.original_name}</option>)}</select></Field>
        <div key={`${current.file.id}:${current.assessment.basis}`} className="space-y-4"><p className="text-sm text-amber-200">{current.assessment.reason}</p><div className="rounded-lg border border-slate-800 p-3 text-sm"><p className="font-semibold">Khai báo: {current.application.full_name} · {current.application.major}</p><dl className="mt-2 space-y-1">{Object.entries(current.file.declared_fields??{}).map(([k,v])=><div key={k}><dt className="inline text-slate-400">{({credential:'Chứng chỉ',score:'Điểm',title:'Thành tích',issuer:'Đơn vị cấp',level:'Cấp',issued_on:'Ngày cấp',reference:'Mã'} as Record<string,string>)[k]??k}: </dt><dd className="inline">{v}</dd></div>)}</dl></div>
          <div className="grid gap-4 sm:grid-cols-2"><PrivateEvidencePreview file={current.file}/><EvidenceCheckPanel file={current.file} expanded onChanged={changed}/></div>
          <form onSubmit={resolve} className="space-y-4"><fieldset disabled={busy} className="space-y-4"><Field label="Kết luận xử lý ngoại lệ"><select name="outcome" required defaultValue=""><option value="" disabled>Chọn kết luận</option><option value="accept">Chấp nhận nội dung minh chứng để tính điểm</option><option value="reject">Không chấp nhận phần điểm minh chứng này</option></select></Field><Field label="Lý do và căn cứ đã xem"><textarea name="reason" required rows={3} maxLength={5000}/></Field><button className="btn-primary">Lưu xử lý ngoại lệ</button></fieldset></form>
        </div></>}
      {!report.total&&<p className="text-sm text-slate-400">Không có ngoại lệ đang chờ HR.</p>}
    </>}
  </div></Panel>;
}
function PrivateEvidencePreview({file}:{file:RecruitmentFile}) {
  const [content,setContent]=useState<{url:string;bytes:Uint8Array}|null>(null),[error,setError]=useState('');
  useEffect(()=>{const controller=new AbortController();let url:string|undefined;setContent(null);setError('');
    void recruitmentFetch(`files/${file.id}/content`,{signal:controller.signal}).then(r=>r.blob()).then(async b=>{const bytes=new Uint8Array(await b.arrayBuffer());if(controller.signal.aborted)return;url=URL.createObjectURL(b);setContent({url,bytes});}).catch(e=>{if(!controller.signal.aborted)setError(e.message);});
    return()=>{controller.abort();if(url)URL.revokeObjectURL(url);};
  },[file.id]);
  return <section className="space-y-3 rounded-lg border border-slate-800 p-3" aria-label="Tệp gốc cần đối chiếu"><p className="break-words text-sm font-semibold">Tệp gốc · {file.original_name}</p>{error&&<p role="alert" className="text-sm text-rose-300">{error}</p>}{content?<><a className="btn-secondary" href={content.url} download={file.original_name}>Tải tệp gốc</a>{file.mime_type==='application/pdf'?<Suspense fallback={<p>Đang mở PDF…</p>}><PdfPreview data={content.bytes}/></Suspense>:<img alt={`Minh chứng ${file.original_name}`} src={content.url} className="max-h-[600px] max-w-full object-contain"/>}</>:!error&&<p>Đang tải tệp riêng tư…</p>}</section>;
}
