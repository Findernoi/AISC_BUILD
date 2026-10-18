import React, { useEffect, useRef, useState } from 'react';
import type { RecruitmentApplication, RecruitmentJob, RecruitmentSession, InterviewInvitation } from '../../../shared/recruitment';
import { getSupabaseClient, supabase } from '../lib/supabase';
import { Field, Panel } from './analytics/Shared';
import { ApplicationFiles } from './ApplicationFiles';
import { RoundOnePortal } from './RoundOnePortal';
import { RoundTwoPortal } from './RoundTwoPortal';
import { HiringDecisionPortal } from './HiringDecisionPortal';
import {EvidenceExceptionsPortal} from './EvidenceExceptionsPortal';
import {OfferPortal} from './OfferPortal';
import {RecruitmentAnalyticsPortal} from './RecruitmentAnalyticsPortal';
import { recruitmentFetch } from '../lib/recruitmentApi';

async function api<T>(path:string,body?:unknown,signal?:AbortSignal):Promise<T> {
  const response=await recruitmentFetch(path,{method:body===undefined?'GET':'POST',signal,
    ...(body===undefined?{}:{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})});
  const payload=await response.json();
  return payload;
}
const message=(e:unknown)=>e instanceof Error?e.message:'Không thực hiện được yêu cầu.';
const statusLabel:Record<string,string>={pending:'Chờ xem xét',passed:'Đạt',hold:'Cần xem xét thêm',rejected:'Không đạt'};
const stageLabel:Record<string,string>={applied:'Đã nộp',cv_passed:'Qua vòng hồ sơ',interview:'Phỏng vấn',offer:'Đề nghị tuyển',accepted:'Đã chấp nhận offer',withdrawn:'Đã rút'};

export function RecruitmentPortal() {
  const [session,setSession]=useState<RecruitmentSession|null>(null);
  const [jobs,setJobs]=useState<RecruitmentJob[]>([]);
  const [applications,setApplications]=useState<RecruitmentApplication[]>([]);
  const [invitations,setInvitations]=useState<InterviewInvitation[]>([]);
  const [jobId,setJobId]=useState('');
  const [version,setVersion]=useState(0);
  const [businessVersion,setBusinessVersion]=useState(0);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [signUp,setSignUp]=useState(false);
  const [localIdentity,setLocalIdentity]=useState('candidate_a');
  const [gpaScale,setGpaScale]=useState('4.0');
  const sessionEpoch=useRef(0);
  const businessRequest=useRef<AbortController|null>(null);
  const invalidateRequests=()=>{sessionEpoch.current++;businessRequest.current?.abort();};
  const refresh=()=>{invalidateRequests();setLoading(true);setSession(null);setApplications([]);setInvitations([]);setJobs([]);setVersion(v=>v+1);};
  useEffect(()=>{
    const controller=new AbortController(),epoch=sessionEpoch.current;setLoading(true);setError('');
    void (async()=>{
      const next=await api<RecruitmentSession>('session',undefined,controller.signal);
      const jobData=next.configured?await api<{jobs:RecruitmentJob[]}>('jobs',undefined,controller.signal):{jobs:[]};
      const appData=next.user?await api<{applications:RecruitmentApplication[]}>('applications',undefined,controller.signal):{applications:[]};
      const invitationData=next.user?await api<{invitations:InterviewInvitation[]}>('invitations',undefined,controller.signal):{invitations:[]};
      if(controller.signal.aborted||epoch!==sessionEpoch.current)return;
      setSession(next);setJobs(jobData.jobs);setApplications(appData.applications);setInvitations(invitationData.invitations);
      setJobId(current=>jobData.jobs.some(j=>j.id===current&&j.status==='active')?current:jobData.jobs.find(j=>j.status==='active')?.id??'');
    })().catch(e=>{if(!controller.signal.aborted&&epoch===sessionEpoch.current)setError(message(e));}).finally(()=>{if(!controller.signal.aborted&&epoch===sessionEpoch.current)setLoading(false);});
    return()=>controller.abort();
  },[version]);
  useEffect(()=>{
    // Avoid async Supabase calls inside its auth-state callback.
    const listener=supabase?.auth.onAuthStateChange(()=>{invalidateRequests();setSession(null);setApplications([]);setInvitations([]);setJobs([]);setLoading(true);setVersion(v=>v+1);});
    return()=>{invalidateRequests();listener?.data.subscription.unsubscribe();};
  },[]);
  const perform=async(fn:()=>Promise<void>)=>{setBusy(true);setError('');setNotice('');try{await fn();}catch(e){setError(message(e));}finally{setBusy(false);}};
  const login=(event:React.FormEvent<HTMLFormElement>)=>{
    event.preventDefault();const form=new FormData(event.currentTarget);
    void perform(async()=>{
      if(session?.mode==='local'){await api('local-session',{identity:localIdentity});refresh();return;}
      const credentials={email:String(form.get('email')).trim(),password:String(form.get('password'))};
      const result=signUp?await getSupabaseClient().auth.signUp(credentials):await getSupabaseClient().auth.signInWithPassword(credentials);
      if(result.error)throw result.error;
      if(signUp&&!result.data.session)setNotice('Kiểm tra email để xác nhận tài khoản rồi đăng nhập.');
      refresh();
    });
  };
  const apply=(event:React.FormEvent<HTMLFormElement>)=>{
    event.preventDefault();const form=new FormData(event.currentTarget);
    const optional=(key:string)=>form.get(key)===''?null:Number(form.get(key));
    void perform(async()=>{
      const response=await api<{application:RecruitmentApplication}>('applications',{
        job_id:jobId,full_name:String(form.get('full_name')),phone:String(form.get('phone')),
        major:form.get('major'),gpa:Number(form.get('gpa')),gpa_scale:form.get('gpa_scale'),graduation_year:Number(form.get('graduation_year')),
        project_count:optional('project_count'),experience_months:optional('experience_months'),
        skills:String(form.get('skills')).split(',').map(s=>s.trim()).filter(Boolean),project_description:String(form.get('project_description')),
      });
      setNotice(`Đã lưu hồ sơ vào database. Mã hồ sơ: ${response.application.id}`);refresh();
    });
  };
  const createJob=(event:React.FormEvent<HTMLFormElement>)=>{
    event.preventDefault();const form=new FormData(event.currentTarget);
    void perform(async()=>{await api('jobs',{title:String(form.get('title')),department:String(form.get('department')),description:String(form.get('description')),location:String(form.get('location')),min_gpa:Number(form.get('min_gpa')),requirements:String(form.get('requirements')).split(',').map(s=>s.trim()).filter(Boolean)});setNotice('Đã tạo vị trí tuyển dụng.');refresh();});
  };
  const reloadBusiness=async()=>{
    businessRequest.current?.abort();
    const controller=new AbortController(),epoch=sessionEpoch.current;businessRequest.current=controller;
    try{
      const [jobData,appData,invitationData]=await Promise.all([api<{jobs:RecruitmentJob[]}>('jobs',undefined,controller.signal),api<{applications:RecruitmentApplication[]}>('applications',undefined,controller.signal),api<{invitations:InterviewInvitation[]}>('invitations',undefined,controller.signal)]);
      if(controller.signal.aborted||epoch!==sessionEpoch.current)return;
      setJobs(jobData.jobs);setApplications(appData.applications);setInvitations(invitationData.invitations);
      setBusinessVersion(v=>v+1);
    }catch(e){if(!controller.signal.aborted&&epoch===sessionEpoch.current)throw e;}
    finally{if(businessRequest.current===controller)businessRequest.current=null;}
  };
  const currentJob=jobs.find(j=>j.id===jobId);
  const alreadyApplied=applications.some(a=>a.job_id===jobId);
  return <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 sm:px-8"><div className="mx-auto max-w-5xl space-y-6">
    <header className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs uppercase tracking-widest text-indigo-300">TalentForecast AI</p><h1 className="mt-2 text-3xl font-bold">Cổng ứng tuyển</h1><p className="mt-2 text-sm text-slate-400">Nộp hồ sơ và xem kết quả tiếp nhận từ database.</p></div><a className="btn-secondary" href="/?view=database">Về bản xem database</a></header>
    {session?.mode==='local'&&<Panel><p className="font-semibold text-amber-200">Bản thử trên máy · Tài khoản mẫu</p><p className="mt-2 text-sm text-slate-400">Nộp hồ sơ bằng ứng viên A/B, rồi đăng xuất và chọn HR để kiểm tra. Hồ sơ lưu trên máy qua lần khởi động lại server. Chỉ nhập dữ liệu giả để thử. Đăng nhập Supabase thật sẽ dùng khi triển khai database cloud.</p></Panel>}
    {error&&<div role="alert" className="rounded-xl border border-rose-800 bg-rose-950/40 p-4 text-sm text-rose-200">{error} <button className="ml-3 underline" onClick={refresh}>Tải lại</button><button className="ml-3 underline" disabled={busy} onClick={()=>void perform(async()=>{await api('logout',{});if(supabase){const r=await supabase.auth.signOut({scope:'local'});if(r.error)throw r.error;}refresh();})}>Thoát phiên đăng nhập</button></div>}
    {notice&&<p role="status" className="break-words rounded-xl border border-emerald-800 bg-emerald-950/40 p-4 text-sm text-emerald-200">{notice}</p>}
    {loading?<Panel><p role="status">Đang tải dữ liệu…</p></Panel>:session&&<>
      {session.user?<Panel><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="break-words font-semibold">{session.user.role==='hr'?'HR':'Ứng viên'} · {session.user.email}</p><p className="mt-2 text-xs text-slate-400">{session.user.role==='hr'?'Được xem hồ sơ của các ứng viên.':'Chỉ xem được hồ sơ của tài khoản này.'}</p></div><div className="flex gap-2"><button className="btn-secondary" disabled={busy} onClick={refresh}>Làm mới</button><button className="btn-secondary" disabled={busy} onClick={()=>void perform(async()=>{if(session.mode==='local')await api('logout',{});else{const r=await getSupabaseClient().auth.signOut();if(r.error)throw r.error;}refresh();})}>Đăng xuất</button></div></div></Panel>:<Panel title={signUp&&session.mode!=='local'?'Tạo tài khoản ứng viên':'Đăng nhập'}>
        {!session.configured?<p>Chưa cấu hình Supabase. Chạy npm run dev:recruitment để thử trên máy.</p>:<form onSubmit={login} className="space-y-4">
          {session.mode==='local'?<Field label="Tài khoản mẫu"><select value={localIdentity} onChange={e=>setLocalIdentity(e.target.value)}><option value="candidate_a">Ứng viên mẫu A</option><option value="candidate_b">Ứng viên mẫu B</option><option value="hr">HR mẫu</option></select></Field>:<><Field label="Email"><input name="email" type="email" required autoComplete="email" placeholder="mssv@gm.uit.edu.vn" /></Field><Field label="Mật khẩu"><input name="password" type="password" required minLength={8} autoComplete={signUp?'new-password':'current-password'} /></Field><p className="text-xs text-slate-400">Ứng viên dùng email @gm.uit.edu.vn đã xác nhận. Tài khoản mới có quyền ứng viên; quyền HR do quản trị viên cấp.</p></>}
          <button className="btn-primary" disabled={busy}>{busy?'Đang xử lý…':session.mode==='local'?'Vào tài khoản mẫu':signUp?'Đăng ký':'Đăng nhập'}</button>
          {session.mode!=='local'&&<button type="button" className="btn-secondary ml-3" onClick={()=>setSignUp(!signUp)}>{signUp?'Đã có tài khoản':'Tạo tài khoản'}</button>}
        </form>}
      </Panel>}
      {session.user?.role!=='hr'&&<Panel title="Vị trí đang tuyển"><div className="space-y-4">{jobs.filter(j=>j.status==='active').map(j=><article key={j.id} className={`rounded-xl border p-4 ${jobId===j.id?'border-indigo-500 bg-indigo-500/10':'border-slate-800'}`}><h2 className="font-semibold">{j.title}</h2><p className="mt-1 text-xs text-indigo-200">{j.department} · GPA tối thiểu {j.min_gpa}/4</p><p className="mt-2 whitespace-pre-wrap text-sm text-slate-400">{j.description}</p><p className="mt-2 text-xs text-slate-400">{j.requirements.join(' · ')}</p><button className="btn-secondary mt-3" onClick={()=>setJobId(j.id)}>{jobId===j.id?'Đang chọn':'Chọn vị trí'}</button></article>)}{!jobs.some(j=>j.status==='active')&&<p className="text-sm text-slate-400">Chưa có vị trí đang mở.</p>}</div></Panel>}
      {session.user?.role==='candidate'&&<Panel title="Nộp hồ sơ ứng tuyển"><p className="mb-4 text-sm text-slate-400">Email: {session.user.email}. Mỗi người nộp một lần cho mỗi vị trí. GPA và thông tin học tập do bạn tự khai.</p>
        {!currentJob?<p>Chưa có vị trí để ứng tuyển.</p>:alreadyApplied?<p className="text-emerald-200">Bạn đã nộp hồ sơ cho {currentJob.title}. Xem hồ sơ đã lưu bên dưới hoặc chọn vị trí khác.</p>:<form onSubmit={apply} className="space-y-4" key={`${session.user.id}:${jobId}`}><p className="font-semibold text-indigo-200">Vị trí: {currentJob.title}</p><div className="grid gap-4 sm:grid-cols-2">
          <Field label="Họ và tên"><input name="full_name" required maxLength={160} autoComplete="name" /></Field><Field label="Điện thoại"><input name="phone" maxLength={40} autoComplete="tel" /></Field>
          <Field label="Ngành học"><select name="major" defaultValue="AI"><option value="KHMT">Khoa học máy tính</option><option value="KTPM">Kỹ thuật phần mềm</option><option value="AI">Trí tuệ nhân tạo</option></select></Field>
          <Field label="Năm tốt nghiệp"><input name="graduation_year" type="number" min={2000} max={2100} defaultValue={2027} required /></Field>
          <Field label="GPA"><input name="gpa" type="number" min={0} max={gpaScale==='10'?10:4} step="0.01" required /></Field><Field label="Thang GPA"><select name="gpa_scale" value={gpaScale} onChange={e=>setGpaScale(e.target.value)}><option value="4.0">4.0</option><option value="10">10</option></select></Field>
          <Field label="Số dự án (không bắt buộc)"><input name="project_count" type="number" min={0} max={10000} step={1} /></Field><Field label="Số tháng kinh nghiệm (không bắt buộc)"><input name="experience_months" type="number" min={0} max={1200} step={1} /></Field>
        </div><Field label="Kỹ năng (ngăn cách bằng dấu phẩy)"><input name="skills" maxLength={2400} placeholder="Python, SQL" /></Field><Field label="Mô tả dự án"><textarea name="project_description" rows={3} maxLength={10000} /></Field><p className="text-xs text-slate-400">Nộp thông tin trước, sau đó thêm CV và minh chứng tại hồ sơ đã lưu bên dưới.</p><button className="btn-primary" disabled={busy}>{busy?'Đang lưu…':'Nộp hồ sơ vào database'}</button></form>}
      </Panel>}
      {session.user?.role==='hr'&&<RecruitmentAnalyticsPortal jobs={jobs} refreshKey={businessVersion} />}
      {session.user?.role==='hr'&&<EvidenceExceptionsPortal onChanged={reloadBusiness} refreshKey={applications.map(a=>a.id+':'+a.revision).join(',')} />}
      {session.user?.role==='hr'&&<RoundOnePortal jobs={jobs} local={session.mode==='local'} onChanged={reloadBusiness} refreshKey={applications.map(a=>`${a.id}:${a.revision}`).join(',')} />}
      {session.user&&<RoundTwoPortal applications={applications} invitations={invitations} hr={session.user.role==='hr'} onChanged={reloadBusiness} />}
      {session.user?.role==='hr'&&<HiringDecisionPortal applications={applications} invitations={invitations} jobs={jobs} onChanged={reloadBusiness} />}
      {session.user&&<OfferPortal applications={applications} jobs={jobs} hr={session.user.role==='hr'} onChanged={reloadBusiness} />}
      {session.user?.role==='hr'&&<Panel title="Vị trí tuyển dụng"><div className="space-y-2">{jobs.map(j=><p key={j.id} className="text-sm">{j.title} · {j.department} · {j.status==='active'?'Đang tuyển':'Đã đóng'}</p>)}</div><details className="mt-5"><summary className="cursor-pointer text-sm text-indigo-200">Tạo vị trí tuyển dụng</summary><form onSubmit={createJob} className="mt-4 space-y-4"><Field label="Tên vị trí"><input name="title" required maxLength={200} /></Field><Field label="Bộ phận"><input name="department" required maxLength={160} /></Field><Field label="Địa điểm"><input name="location" maxLength={200} /></Field><Field label="Kỹ năng yêu cầu (ngăn cách bằng dấu phẩy)"><input name="requirements" maxLength={2400} placeholder="Python, SQL" /></Field><Field label="GPA tối thiểu (thang 4)"><input name="min_gpa" type="number" required min={0} max={4} step="0.01" defaultValue={3} /></Field><Field label="Mô tả công việc"><textarea name="description" maxLength={10000} rows={3} /></Field><button className="btn-primary" disabled={busy}>Tạo vị trí</button></form></details></Panel>}
      {session.user&&<Panel title={session.user.role==='hr'?`Hồ sơ ứng viên (${applications.length})`:`Hồ sơ của tôi (${applications.length})`}><p className="mb-4 text-xs text-slate-500">Hiển thị tối đa 200 hồ sơ mới nhất được phép đọc.</p><div className="space-y-4">{applications.map(a=><article key={a.id} className="rounded-xl border border-slate-800 bg-slate-950 p-4"><div className="flex flex-wrap justify-between gap-3"><div><h2 className="font-semibold text-indigo-200">{a.full_name}</h2><p className="mt-1 text-sm">{jobs.find(j=>j.id===a.job_id)?.title ?? 'Vị trí đã đóng'}</p></div><span className="text-xs text-emerald-200">{stageLabel[a.stage]??a.stage} · {a.stage==='withdrawn'?'Đã kết thúc ứng tuyển':statusLabel[a.status]??a.status}</span></div><p className="mt-3 break-words text-xs text-slate-400">{a.contact_email} · {a.major} · GPA {a.gpa}/{a.gpa_scale}</p><details className="mt-3 text-sm"><summary className="cursor-pointer text-indigo-200">Xem chi tiết hồ sơ</summary><div className="mt-3 space-y-2 break-words text-slate-400"><p>Mã hồ sơ: {a.id}</p><p>Nộp lúc: {new Date(a.created_at).toLocaleString('vi-VN')}</p><p>Điện thoại: {a.phone||'Chưa cung cấp'}</p><p>Năm tốt nghiệp: {a.graduation_year}</p><p>Số dự án: {a.project_count??'Chưa cung cấp'} · Kinh nghiệm: {a.experience_months??'Chưa cung cấp'} tháng</p><p>Kỹ năng: {a.skills.join(', ')||'Chưa cung cấp'}</p><p className="whitespace-pre-wrap">Dự án: {a.project_description||'Chưa cung cấp'}</p></div></details>{invitations.some(i=>i.application_id===a.id)&&<p className="mt-4 rounded-lg border border-indigo-900 bg-indigo-950/30 p-3 text-sm text-indigo-200">Đã được HR chọn vào vòng 2 · {new Date(invitations.find(i=>i.application_id===a.id)!.invited_at).toLocaleString('vi-VN')}. Xem lịch và hướng dẫn tại mục Vòng 2 ở trên; chưa có email tự động.</p>}<ApplicationFiles application={a} onChanged={reloadBusiness} canUpload={session.user!.role==='candidate'} /></article>)}{!applications.length&&<p className="py-4 text-sm text-slate-400">Chưa có hồ sơ. {session.user.role==='hr'?'Ứng viên nộp hồ sơ sẽ xuất hiện tại đây.':'Chọn vị trí và nộp hồ sơ ở trên.'}</p>}</div></Panel>}
    </>}
  </div></main>;
}
