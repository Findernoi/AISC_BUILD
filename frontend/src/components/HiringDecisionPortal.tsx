import React,{useEffect,useState} from 'react';
import type {HiringReport,HiringWeights,HiringDecisionInput,RecruitmentApplication,RecruitmentJob,InterviewInvitation} from '../../../shared/recruitment';
import {recruitmentFetch} from '../lib/recruitmentApi';
import {Panel,Field} from './analytics/Shared';
const labels={hire:'Chọn tuyển / chờ offer',reserve:'Dự phòng',reject:'Không chọn'};
const weightLabels={roundOne:'Vòng 1',coding:'Bài test',interview:'Phỏng vấn'};
const defaultWeights:HiringWeights={roundOne:30,coding:30,interview:40};
export function HiringDecisionPortal({applications,jobs,invitations,onChanged}:{applications:RecruitmentApplication[];jobs:RecruitmentJob[];invitations:InterviewInvitation[];onChanged:()=>Promise<void>}) {
  const [weights,setWeights]=useState(defaultWeights),[reports,setReports]=useState<Record<string,HiringReport>>({}),[selected,setSelected]=useState(''),[version,setVersion]=useState(0),[loading,setLoading]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const invited=applications.filter(a=>invitations.some(i=>i.application_id===a.id));
  const applicationVersions=invited.map(a=>`${a.id}:${a.revision}`).sort().join(',');
  const valid=Object.values(weights).every(v=>Number.isInteger(v)&&v>=0&&v<=100)&&weights.roundOne+weights.coding+weights.interview===100;
  useEffect(()=>{
    const controller=new AbortController();setReports({});setError('');
    if(!valid){setLoading(false);return;}
    setLoading(true);
    const ids=applicationVersions?applicationVersions.split(',').map(s=>s.split(':')[0]):[];
    const query=new URLSearchParams(Object.fromEntries(Object.entries(weights).map(([k,v])=>[k,String(v)])));
    void Promise.all(ids.map(async id=>{const response=await recruitmentFetch(`applications/${id}/hiring?${query}`,{signal:controller.signal});return [id,(await response.json()).report] as const;})).then(rows=>{if(!controller.signal.aborted)setReports(Object.fromEntries(rows));}).catch(e=>{if(!controller.signal.aborted)setError(e.message);}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return()=>controller.abort();
  },[applicationVersions,weights,version,valid]);
  const ranking=[...invited].sort((a,b)=>(reports[b.id]?.finalScore??-1)-(reports[a.id]?.finalScore??-1)||a.id.localeCompare(b.id));
  const current=ranking.find(a=>a.id===selected)??ranking[0],report=current?reports[current.id]:null;
  const save=async(event:React.FormEvent<HTMLFormElement>)=>{
    event.preventDefault();if(!current||!report||report.finalScore===null)return;
    const data=new FormData(event.currentTarget),input:HiringDecisionInput={expectedBasis:report.basis,weights:report.weights,result:String(data.get('result')) as HiringDecisionInput['result'],reason:String(data.get('reason'))};
    setBusy(true);setError('');setNotice('');
    try{await recruitmentFetch(`applications/${current.id}/hiring`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});setNotice('Đã lưu quyết định và trạng thái hồ sơ vào database. Chưa gửi email.');setVersion(v=>v+1);await onChanged();}
    catch(e){setError(e instanceof Error?e.message:'Không lưu được quyết định.');}finally{setBusy(false);}
  };
  return <Panel title="Tổng hợp điểm và quyết định · Database"><div className="space-y-5">
    <p className="text-sm text-slate-400">HR quyết định dựa trên đánh giá. Điểm tổng = vòng 1 × tỷ trọng + bài test × tỷ trọng + phỏng vấn × tỷ trọng, chia 100. Database tính và lưu hai chữ số thập phân. Không dùng xác suất placement, không tự quyết định theo ngưỡng điểm.</p>
    <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-3">{(Object.keys(weightLabels) as Array<keyof HiringWeights>).map(k=><Field key={k} label={`${weightLabels[k]} (%)`}><input type="number" min={0} max={100} step={1} required value={Number.isFinite(weights[k])?weights[k]:''} onChange={e=>{setNotice('');setWeights(w=>({...w,[k]:e.target.value===''?NaN:Number(e.target.value)}));}}/></Field>)}</fieldset>
    <p className={`text-sm ${valid?'text-indigo-200':'text-rose-300'}`}>Tổng tỷ trọng: {Object.values(weights).every(Number.isFinite)?weights.roundOne+weights.coding+weights.interview:'—'}% · Phải bằng 100%. Thay tỷ trọng cần HR duyệt quyết định mới; lịch sử giữ nguyên.</p>
    <button className="btn-secondary" disabled={busy||loading} onClick={()=>{setNotice('');setVersion(v=>v+1);}}>Tải lại tổng hợp</button>
    {error&&<p role="alert" className="text-sm text-rose-300">{error} Hãy tải lại tổng hợp trước khi duyệt lại.</p>}{notice&&<p role="status" className="text-sm text-emerald-300">{notice}</p>}
    {loading?<p role="status">Đang tổng hợp điểm…</p>:!valid?<p>Nhập tỷ trọng hợp lệ để xem kết quả.</p>:<>
      <div className="overflow-x-auto"><table className="data-table"><thead><tr><th>Hồ sơ / vị trí</th><th>Vòng 1</th><th>Bài test</th><th>Phỏng vấn</th><th>Tổng</th><th>Quyết định gần nhất</th></tr></thead><tbody>{ranking.map(a=>{
        const r=reports[a.id],last=r?.history[0],currentDecision=last?.source_basis===r?.basis&&Number(last?.round_one_weight)===weights.roundOne&&Number(last?.coding_weight)===weights.coding&&Number(last?.interview_weight)===weights.interview;
        return <tr key={a.id}><td><button className="text-left font-semibold text-indigo-200" onClick={()=>{setSelected(a.id);setNotice('');}}>{a.full_name}</button><p className="text-xs text-slate-400">{jobs.find(j=>j.id===a.job_id)?.title}</p></td><td>{r?.roundOne??'—'}</td><td>{r?.coding??'Chưa nhập'}</td><td>{r?.interview??'Chưa nhập'}</td><td>{r?.finalScore===null||!r?'Chưa đủ':r.finalScore.toFixed(2)}</td><td>{last?<>{labels[last.result]}<p className="text-xs text-amber-200">{currentDecision?'Khớp dữ liệu và tỷ trọng hiện tại':['accepted','withdrawn'].includes(a.stage)?'Hồ sơ đã kết thúc xử lý · xem lịch sử':'Cần duyệt lại theo dữ liệu / tỷ trọng hiện tại'}</p></>:'Chưa quyết định'}</td></tr>;
      })}</tbody></table>{!ranking.length&&<p className="mt-3 text-sm text-slate-400">Chưa có hồ sơ được mời vòng 2.</p>}</div>
      {current&&report&&<div key={`${current.id}:${report.basis}:${JSON.stringify(weights)}`} className="space-y-4 rounded-xl border border-slate-800 p-4"><h3 className="font-semibold">Quyết định cho {current.full_name}</h3>
        {report.reasons.length>0&&<ul className="list-inside list-disc text-sm text-amber-200">{report.reasons.map(r=><li key={r}>{r}</li>)}</ul>}
        <p className="text-sm text-slate-400">“Chọn tuyển” chuyển sang chờ offer, chưa xác nhận nhận việc. Dự phòng hoặc không chọn giữ hồ sơ ở giai đoạn phỏng vấn với trạng thái tương ứng. Điểm và lý do nội bộ chỉ HR được xem.</p>
        <form onSubmit={save} className="space-y-4"><fieldset disabled={busy||report.finalScore===null} className="space-y-4"><Field label="Quyết định của HR"><select name="result" required defaultValue=""><option value="" disabled>Chọn quyết định</option><option value="hire">Chọn tuyển / chờ offer</option><option value="reserve">Dự phòng</option><option value="reject">Không chọn</option></select></Field><Field label="Lý do dựa trên kết quả đánh giá"><textarea name="reason" required rows={3} maxLength={5000}/></Field><button className="btn-primary">Lưu quyết định của HR</button></fieldset></form>
        <details><summary className="cursor-pointer text-sm text-indigo-200">Lịch sử quyết định ({report.history.length})</summary><div className="mt-3 space-y-3">{report.history.map(d=><article key={d.id} className="rounded-lg border border-slate-800 p-3 text-sm"><p className="font-semibold">{labels[d.result]} · {Number(d.final_score).toFixed(2)}/100</p><p className="mt-1 text-xs text-slate-400">{new Date(d.decided_at).toLocaleString('vi-VN')} · HR: {d.decided_by}</p><p className="mt-2">Vòng 1 {d.round_one_score} × {d.round_one_weight}% + bài test {d.coding_score} × {d.coding_weight}% + phỏng vấn {d.interview_score} × {d.interview_weight}%</p><p className="mt-2 whitespace-pre-wrap">{d.reason}</p></article>)}{!report.history.length&&<p className="text-sm text-slate-400">Chưa có quyết định được lưu.</p>}</div></details>
      </div>}
    </>}
  </div></Panel>;
}
