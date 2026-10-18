import React, { Suspense, lazy, useEffect, useState } from 'react';
import type { RecruitmentApplication, RecruitmentFile, EvidenceKind, EvidenceCheck } from '../../../shared/recruitment';
import { recruitmentFetch } from '../lib/recruitmentApi';
import { Field } from './analytics/Shared';
import { EvidenceCheckPanel } from './EvidenceCheckPanel';

const labels:Record<EvidenceKind,string>={cv:'CV',english:'Chứng chỉ ngoại ngữ',achievement:'Minh chứng thành tích'};
const PdfPreview=lazy(()=>import('./PdfPreview'));
export function ApplicationFiles({application,canUpload,onChanged}:{application:RecruitmentApplication;canUpload:boolean;onChanged?:()=>Promise<void>}) {
  const [open,setOpen]=useState(canUpload);
  const [files,setFiles]=useState<RecruitmentFile[]>([]);
  const [kind,setKind]=useState<EvidenceKind>('cv');
  const [automatic,setAutomatic]=useState<EvidenceCheck|null>(null);
  const [reload,setReload]=useState(0);
  const [loading,setLoading]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [viewer,setViewer]=useState<{url:string;file:RecruitmentFile;bytes:Uint8Array}|null>(null);
  useEffect(()=>{
    if(!open)return;
    const controller=new AbortController();setLoading(true);setError('');
    void recruitmentFetch(`applications/${application.id}/files`,{signal:controller.signal})
      .then(r=>r.json()).then(data=>{if(!controller.signal.aborted)setFiles(data.files);})
      .catch(e=>{if(!controller.signal.aborted)setError(e.message);})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return()=>controller.abort();
  },[application.id,open,reload]);
  useEffect(()=>()=>{if(viewer)URL.revokeObjectURL(viewer.url);},[viewer]);
  const upload=(event:React.FormEvent<HTMLFormElement>)=>{
    event.preventDefault();const form=event.currentTarget;const file=new FormData(form).get('file');
    if(!(file instanceof File)||!file.size){setError('Hãy chọn một tệp.');return;}
    if(file.size>10*1024*1024){setError('Mỗi tệp tối đa 10 MiB.');return;}
    const fields=new FormData(form);
    const declaration=Object.fromEntries(['credential','score','issued_on','reference','title','issuer','level'].map(key=>[key,String(fields.get(key)??'')]).filter(([,value])=>value));
    setBusy(true);setError('');setNotice('');
    void recruitmentFetch(`applications/${application.id}/files?kind=${kind}`,{method:'POST',headers:{'Content-Type':'application/octet-stream','X-File-Name':encodeURIComponent(file.name),'X-Evidence-Declaration':encodeURIComponent(JSON.stringify(declaration))},body:file})
      .then(async response=>{
        const uploaded=(await response.json()).file as RecruitmentFile;
        setNotice(`Đã lưu ${file.name}. Đang đọc và đối chiếu trên server…`);form.reset();setReload(n=>n+1);
        try {const checked=await recruitmentFetch(`files/${uploaded.id}/check`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});setAutomatic((await checked.json()).check);setNotice('Đã lưu tệp và hoàn tất đối chiếu nội dung. Xem kết quả bên dưới tệp.');}
        catch(e){setNotice(`Đã lưu tệp thành công. Chưa đối chiếu được: ${e instanceof Error?e.message:'Thử lại trong mục kết quả.'}`);}
        await onChanged?.();
      })
      .catch(e=>setError(e.message)).finally(()=>setBusy(false));
  };
  const view=async(file:RecruitmentFile)=>{
    setBusy(true);setError('');
    try{
      const response=await recruitmentFetch(`files/${file.id}/content`);
      const blob=await response.blob();
      setViewer({url:URL.createObjectURL(blob),file,bytes:new Uint8Array(await blob.arrayBuffer())});
    }catch(e){setError(e instanceof Error?e.message:'Không tải được tệp.');}finally{setBusy(false);}
  };
  return <div className="mt-4 border-t border-slate-800 pt-4">
    <button className="text-sm font-semibold text-indigo-200" aria-expanded={open} onClick={()=>setOpen(!open)}>{open?'▾':'▸'} CV và minh chứng</button>
    {open&&<div className="mt-4 space-y-4">
      {error&&<p role="alert" className="text-sm text-rose-300">{error} <button className="underline" onClick={()=>setReload(n=>n+1)}>Tải lại danh sách</button></p>}
      {notice&&<p role="status" className="break-words text-sm text-emerald-200">{notice}</p>}
      {loading?<p role="status" className="text-xs text-slate-400">Đang tải danh sách tệp…</p>:<><p className="text-xs text-slate-400">{files.length} tệp · Hiển thị tối đa 200 tệp mới nhất. Mỗi lần thêm giữ nguyên các bản đã nộp.</p><ul className="space-y-3">{files.map(file=><li key={file.id} className="rounded-lg border border-slate-800 p-3"><p className="break-words text-sm text-slate-200">{labels[file.kind]} · {file.original_name}</p><p className="mt-1 text-xs text-slate-500">{(Number(file.byte_size)/1024).toFixed(1)} KiB · {new Date(file.created_at).toLocaleString('vi-VN')}</p><button className="btn-secondary mt-3" disabled={busy} onClick={()=>void view(file)}>Mở xem / tải xuống</button><EvidenceCheckPanel file={file} refreshKey={application.revision} onChanged={onChanged} initial={automatic?.file_id===file.id?automatic:undefined} /></li>)}</ul>{!files.length&&<p className="text-sm text-slate-500">Chưa có CV hoặc minh chứng.</p>}</>}
      {canUpload&&!['accepted','withdrawn'].includes(application.stage)&&<form onSubmit={upload} className="space-y-4 rounded-xl border border-slate-800 p-4"><h3 className="text-sm font-semibold">Thêm CV hoặc minh chứng</h3><Field label="Loại tệp"><select value={kind} onChange={e=>setKind(e.target.value as EvidenceKind)}>{Object.entries(labels).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></Field>{kind==='english'&&<><Field label="Loại chứng chỉ khai báo"><select name="credential" defaultValue="IELTS"><option>IELTS</option><option>TOEIC</option><option>TOEFL</option></select></Field><Field label="Điểm khai báo"><input name="score" type="number" min={0} max={990} step="0.5" required /></Field></>}{kind==='achievement'&&<><Field label="Tên thành tích khai báo"><input name="title" required maxLength={240} /></Field><Field label="Cấp thành tích khai báo (được đối chiếu để tính điểm)"><select name="level" defaultValue="school"><option value="school">Cấp trường</option><option value="national">Cấp quốc gia</option><option value="international">Cấp quốc tế</option></select></Field><Field label="Đơn vị cấp khai báo"><input name="issuer" required maxLength={240} /></Field></>}{kind!=='cv'&&<><Field label="Ngày cấp (nếu có)"><input name="issued_on" type="date" /></Field><Field label="Mã chứng chỉ/minh chứng (nếu có)"><input name="reference" maxLength={240} /></Field></>}<Field label="Chọn tệp"><input name="file" type="file" required accept={kind==='cv'?'.pdf':'.pdf,.png,.jpg,.jpeg'} /></Field><p className="text-xs text-slate-400">CV: PDF. Minh chứng: PDF, PNG hoặc JPEG. Tối đa 10 MiB/tệp. Tệp riêng tư, chỉ bạn và HR được đọc; tải lên chưa đồng nghĩa đã được xác minh.</p><button className="btn-primary" disabled={busy}>{busy?'Đang xử lý…':'Tải tệp lên'}</button></form>}
      {viewer&&<section className="space-y-3 rounded-xl border border-indigo-900 p-4" aria-label="Xem tệp đã nộp"><div className="flex flex-wrap items-center justify-between gap-3"><p className="break-words text-sm">{viewer.file.original_name}</p><button className="text-xs text-slate-400 underline" onClick={()=>setViewer(null)}>Đóng bản xem</button></div><div className="flex flex-wrap gap-3"><a className="btn-secondary" href={viewer.url} target="_blank" rel="noopener noreferrer">Mở trong tab mới</a><a className="btn-secondary" href={viewer.url} download={viewer.file.original_name}>Tải xuống</a></div>{viewer.file.mime_type==='application/pdf'?<Suspense fallback={<p className="text-xs text-slate-400">Đang tải trình đọc PDF…</p>}><PdfPreview data={viewer.bytes} /></Suspense>:<img alt={`Minh chứng: ${viewer.file.original_name}`} src={viewer.url} className="max-h-[600px] max-w-full rounded-lg object-contain" />}</section>}
    </div>}
  </div>;
}
