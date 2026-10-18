import React, { useState } from 'react';
import type { Candidate, EvidenceKind } from '../../types';
import { useApp } from '../../context/AppContext';
import { evidenceFingerprint, eligibility, roundOneScore, verified } from '../../lib/recruitment';
import { getEvidence, previewEvidence, saveEvidence } from '../../lib/evidence';
import { Field, Panel } from '../analytics/Shared';

const LABELS = {english:'Chứng chỉ ngoại ngữ',achievement:'Thành tích và giải thưởng'};
export function VerificationPanel({ candidate:c }: { candidate: Candidate }) {
  const { updateCandidate, demoMode, jobs } = useApp();
  const [reviewer,setReviewer] = useState(''); const [reference,setReference] = useState(''); const [error,setError] = useState(''); const [busy,setBusy] = useState(false);
  const gate = eligibility(c,demoMode);
  const approve = async (kind: EvidenceKind, status:'verified'|'rejected') => {
    setError('');
    if (!reviewer.trim() || !reference.trim()) { setError('Nhập người kiểm tra và nguồn đối chiếu cụ thể trước khi ghi nhận.'); return; }
    const sample = !!c.sampleRecord && demoMode;
    if (!sample && (!c.evidenceFiles?.[kind] || !await getEvidence(c.evidenceFiles[kind]!.id))) { setError('Cần có tệp minh chứng đọc được trong trình duyệt trước khi duyệt.'); return; }
    const verification={...c.verification,[kind]:{status,reviewer:reviewer.trim(),reference:reference.trim(),reviewedAt:new Date().toISOString(),fingerprint:evidenceFingerprint(c,kind),demoOnly:sample}};
    const next={...c,verification};const job=jobs.find(j=>j.id===c.jobId);
    const passed=job&&eligibility(next,demoMode).eligible&&roundOneScore(next,job,demoMode).total>=75&&roundOneScore(next,job,demoMode).gpaNormalized>=job.minGpa;
    updateCandidate(c.id, { verification,...(passed&&c.stage==='applied'?{stage:'cv_passed' as const,stageHistory:[...new Set([...(c.stageHistory||['applied' as const]),'cv_passed' as const])]}:{}) });
  };
  const upload = async (kind: EvidenceKind, file?: File) => {
    if (!file) return; setBusy(true);setError('');
    try { const stored = await saveEvidence(file); updateCandidate(c.id,{evidenceFiles:{...c.evidenceFiles,[kind]:stored}}); }
    catch(e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  return <div className="space-y-5">
    <Panel title={`Hồ sơ và minh chứng · ${c.fullName}`}>
      <p className="mb-4 text-sm text-slate-400">{c.university} · {c.major} · {c.email}</p>
      {c.sampleRecord && <p className="mb-4 text-xs text-amber-300">HỒ SƠ MẪU · Mọi dấu duyệt của hồ sơ này chỉ minh họa, không phải xác minh sinh viên thật.</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Email sinh viên UIT"><input type="email" value={c.email} onChange={e=>updateCandidate(c.id,{email:e.target.value})} /></Field>
        <Field label="MSSV khai báo"><input value={c.studentId || ''} onChange={e => updateCandidate(c.id,{studentId:e.target.value})} maxLength={8} inputMode="numeric" /></Field>
        <Field label="GPA khai báo"><input type="number" step="0.01" min="0" max={c.gpaScale === '10' ? 10 : 4} value={c.gpa} onChange={e => updateCandidate(c.id,{gpa:Number(e.target.value)})} /></Field>
        <Field label="Thang điểm"><select value={c.gpaScale} onChange={e => updateCandidate(c.id,{gpaScale:e.target.value as Candidate['gpaScale']})}><option value="4.0">4.0</option><option value="10">10</option></select></Field>
      </div>
      <p className="mt-4 text-xs text-slate-500">Email phải đúng miền @gm.uit.edu.vn. Bản demo chỉ kiểm tra định dạng, chưa xác thực hộp thư. Ngành và GPA là thông tin tự khai, không có bước duyệt minh chứng.</p>
      <div className={`mt-4 rounded-xl border p-4 text-sm ${gate.eligible ? 'border-emerald-800 text-emerald-300' : 'border-amber-900 text-amber-200'}`}>{gate.eligible ? 'Đạt điều kiện email và thông tin tự khai để xét top 10.' : <ul className="list-disc space-y-1 pl-4">{gate.reasons.map(s => <li key={s}>{s}</li>)}</ul>}</div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2"><Field label="Người kiểm tra minh chứng"><input value={reviewer} onChange={e=>setReviewer(e.target.value)} placeholder="Họ tên HR" /></Field><Field label="Nguồn đối chiếu và kết quả kiểm tra"><input value={reference} onChange={e=>setReference(e.target.value)} placeholder="Ví dụ: trang công bố giải, mã chứng nhận, đơn vị tổ chức và ngày đối chiếu" /></Field></div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">{(Object.keys(LABELS) as (keyof typeof LABELS)[]).map(kind => {
        const isVerified = verified(c,kind,demoMode); const record = c.verification?.[kind]; const file = c.evidenceFiles?.[kind];
        return <div key={kind} className="rounded-xl border border-slate-800 bg-slate-950 p-4"><h3 className="text-sm font-semibold">{LABELS[kind]}</h3><p className={`my-2 text-xs ${isVerified ? 'text-emerald-300' : 'text-amber-300'}`}>{isVerified ? (record?.demoOnly ? 'Đã duyệt mẫu' : 'HR đã đối chiếu minh chứng') : record?.status === 'rejected' && record.fingerprint === evidenceFingerprint(c,kind) ? 'Minh chứng chưa đạt' : 'Chưa xác minh hoặc dữ liệu đã thay đổi'}</p><p className="mb-3 text-xs text-slate-500">{kind === 'english' ? `${c.englishCert.type} ${c.englishCert.score}` : `${c.achievements || 'Chưa khai thành tích'} · ${c.achievementLevel || 'none'}`}</p>
          <input aria-label={`Tải minh chứng ${LABELS[kind]}`} type="file" accept=".pdf,.png,.jpg,.jpeg" disabled={busy} onChange={e => void upload(kind,e.target.files?.[0])} className="w-full text-xs text-slate-400" />
          {file && <button className="mt-3 text-left text-xs text-indigo-300 underline" onClick={() => { void previewEvidence(file).catch(e=>setError(e.message)); }}>{file.name} · Xem tệp</button>}
          <div className="mt-3 flex flex-wrap gap-2"><button className="btn-secondary" disabled={busy} onClick={() => { void approve(kind,'verified').catch(e=>setError(e.message)); }}>Duyệt {c.sampleRecord && demoMode ? 'mẫu' : 'minh chứng'}</button><button className="btn-secondary" disabled={busy} onClick={() => { void approve(kind,'rejected').catch(e=>setError(e.message)); }}>Yêu cầu bổ sung</button></div>
          {record && <p className="mt-3 break-words text-[11px] text-slate-500">{record.reviewer} · {record.reference}</p>}
        </div>;
      })}</div>
      {error && <p role="alert" className="mt-4 text-sm text-rose-300">{error}</p>}
      <p className="mt-4 text-xs leading-relaxed text-slate-500">Thành tích: HR đối chiếu họ tên, tên giải, thời gian, đơn vị tổ chức và nguồn công bố. Chỉ cộng điểm sau khi duyệt: cấp trường 4, quốc gia 7, quốc tế 10; dùng cấp cao nhất đã xác nhận, không cộng dồn nhiều giải. Ngoại ngữ vẫn cần minh chứng để tính điểm. Thay tệp hoặc nội dung khai báo sẽ yêu cầu duyệt lại. Tệp hiện lưu trên trình duyệt, chưa kết nối nguồn xác nhận chính thức.</p>
    </Panel>
    <Panel title="Portfolio tự khai"><p className="text-sm leading-relaxed text-slate-400">{c.projects || 'Chưa mô tả dự án.'}</p><p className="mt-3 text-xs text-slate-500">{c.projectCount ?? '—'} dự án · {c.experienceMonths ?? '—'} tháng kinh nghiệm · {c.techBadges.join(' · ')}</p><p className="mt-3 text-xs text-slate-500">Thông tin dự án và kỹ năng cần được đối chiếu bằng câu hỏi phỏng vấn và minh chứng dự án ở vòng 2.</p></Panel>
  </div>;
}
