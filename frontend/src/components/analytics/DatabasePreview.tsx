import React, { useEffect, useState } from 'react';
import { PREVIEW_IDENTITIES, type DatabasePreview as Preview, type PreviewIdentity } from '../../../../shared/database';
import { Empty, Field, Metric, Panel } from './Shared';

export function DatabasePreview() {
  const [identity, setIdentity] = useState<PreviewIdentity>('hr');
  const [selected, setSelected] = useState('applications');
  const [data, setData] = useState<Preview | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    setData(null); setError('');
    void fetch(`/api/database/preview?identity=${identity}`, { signal: controller.signal, cache: 'no-store' })
      .then(async response => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || 'Không đọc được database kiểm thử.');
        setData(payload);
      })
      .catch((e: Error) => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, [identity]);
  const table = data?.tables.find(t => t.name === selected);
  return <div className="space-y-6">
    <a className="btn-primary inline-block" href="/?view=applications">Thử nộp hồ sơ và xem bằng HR</a>
    <div><p className="mb-2 text-xs uppercase tracking-widest text-indigo-300">Backend · Thiết kế và kiểm thử database</p><h1 className="text-3xl font-bold">Cơ sở dữ liệu tuyển dụng</h1><p className="mt-2 text-sm text-slate-400">Xem schema thật sau migration và thử quyền đọc bằng dữ liệu mẫu trên máy.</p></div>
    <Panel>
      <p className="text-sm font-semibold text-amber-300">Bản xem trước cục bộ · Chưa áp dụng lên Supabase thật</p>
      <p className="mt-2 text-sm leading-relaxed text-slate-400">{data?.persistent ? 'Đang xem database của cổng ứng tuyển local. Hồ sơ nộp qua cổng được lưu trên máy và xuất hiện tại đây. Dữ liệu giữ lại khi khởi động server.' : 'Database kiểm thử trong bộ nhớ với 3 tài khoản và 2 hồ sơ mẫu; tạo lại khi khởi động server.'} Chọn tài khoản để kiểm tra quyền đọc, chưa phải đăng nhập Supabase thật.</p>
      <p className="mt-3 text-xs text-slate-500">Cổng ứng tuyển mới dùng API và database. Giao diện demo chấm điểm cũ vẫn lưu trên trình duyệt; chưa chuyển dữ liệu cũ, nối upload CV hoặc gửi thư thật.</p>
    </Panel>
    {error ? <Panel><p role="alert" className="text-sm text-rose-300">{error}</p><p className="mt-3 text-sm text-slate-400">Mở terminal tại thư mục dự án và chạy <code className="text-indigo-200">npm run dev:database</code>, sau đó mở lại trang này. Preview chỉ bật ở development và kết nối localhost.</p></Panel> : <>
      <Panel><Field label="Tài khoản kiểm tra cục bộ"><select value={identity} onChange={e => setIdentity(e.target.value as PreviewIdentity)}>{Object.entries(PREVIEW_IDENTITIES).map(([id, info]) => <option key={id} value={id}>{info.label}</option>)}</select></Field><p className="mt-3 text-xs text-slate-500">Thử HR → Ứng viên A → Ứng viên B → Khách. HR đọc được các hồ sơ đã nộp; mỗi ứng viên chỉ đọc được hồ sơ của mình; khách chỉ thấy vị trí đang mở.</p></Panel>
      {!data ? <Panel><p role="status" className="text-sm text-slate-400">Đang khởi tạo và đọc PostgreSQL cục bộ…</p></Panel> : <>
        <div className="grid gap-4 sm:grid-cols-3"><Metric label="Bảng nghiệp vụ" value={data.tables.length} note="Cộng Supabase Auth và kho vai trò HR riêng tư" /><Metric label="Bảng bật Row Level Security" value={data.tables.filter(t => t.rls).length} note="Quyền được PostgreSQL kiểm tra theo từng dòng" /><Metric label="Hồ sơ tài khoản này được đọc" value={data.tables.find(t => t.name === 'applications')?.visibleCount ?? 'Không có quyền'} note={PREVIEW_IDENTITIES[identity].label} /></div>

        <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
          <Panel title="Chọn bảng dữ liệu"><Field label="Bảng muốn xem"><select value={selected} onChange={e => setSelected(e.target.value)}>{data.tables.map(t => <option key={t.name} value={t.name}>{t.label} · {t.visibleCount === null ? 'Không có quyền đọc' : `${t.visibleCount} dòng`}</option>)}</select></Field></Panel>
          {table && <div className="space-y-6">
            <Panel title={`Dữ liệu mẫu nhìn thấy · ${PREVIEW_IDENTITIES[identity].label}`}>
              {table.visibleCount === null ? <Empty>Tài khoản này không được phép SELECT bảng này.</Empty> : !table.samples.length ? <Empty>Không có dòng nào được phép đọc trong bảng này.</Empty> : <>
                <div className="space-y-3">{table.samples.map((row,i)=><div key={i} className="rounded-xl bg-slate-950 p-4"><p className="text-sm font-semibold text-indigo-200">{String(row.full_name ?? row.display_name ?? row.title ?? row.subject ?? `Bản ghi mẫu ${i+1}`)}</p><div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-400">{['contact_email','major','gpa','gpa_scale','stage','status','score','overall_score','result','final_score','action','entity'].filter(key=>row[key]!==undefined).map(key=><span key={key}>{key}: <span className="text-slate-200">{String(row[key])}</span></span>)}</div></div>)}</div>
                <details className="mt-4"><summary className="cursor-pointer text-xs text-slate-400">Xem JSON đầy đủ</summary><pre className="mt-3 max-h-96 overflow-auto rounded-xl bg-slate-950 p-4 text-xs leading-6 text-slate-300" aria-label="Bản ghi mẫu được phép đọc">{JSON.stringify(table.samples,null,2)}</pre></details>
              </>}
              <p className="mt-3 text-xs text-slate-500">Tối đa 3 bản ghi minh họa, được SELECT bằng vai trò đang chọn qua PostgreSQL RLS; không lọc giả bằng JavaScript trên giao diện.</p>
            </Panel>
            <Panel title={`${table.label} · ${table.name}`}>
              <p className="text-sm leading-relaxed text-slate-400">{table.purpose}</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2"><div className="rounded-xl bg-slate-950 p-4"><p className="text-xs text-indigo-300">Ứng viên</p><p className="mt-2 text-sm text-slate-300">{table.candidate}</p></div><div className="rounded-xl bg-slate-950 p-4"><p className="text-xs text-indigo-300">HR</p><p className="mt-2 text-sm text-slate-300">{table.hr}</p></div></div>
              <p className="mt-4 text-xs text-slate-500">Liên kết: {table.links.join(', ')} · RLS {table.rls ? 'đang bật' : 'chưa bật'}</p>
              <details className="mt-5 rounded-xl border border-slate-800 p-4"><summary className="cursor-pointer text-sm text-slate-300">Cấu trúc cột ({table.columns.length})</summary><div className="mt-3 overflow-x-auto"><table className="data-table"><thead><tr><th>Cột</th><th>Kiểu dữ liệu</th><th>Bắt buộc</th><th>Tự tính</th></tr></thead><tbody>{table.columns.map(c => <tr key={c.name}><td className="font-mono text-xs text-indigo-200">{c.name}</td><td>{c.type}</td><td>{c.nullable ? 'Không' : 'Có'}</td><td>{c.generated ? 'Database tính' : '—'}</td></tr>)}</tbody></table></div></details>
              <details className="mt-5 rounded-xl border border-slate-800 p-4"><summary className="cursor-pointer text-sm text-slate-300">Chính sách RLS ({table.policies.length})</summary><ul className="mt-3 space-y-2 text-xs text-slate-400">{table.policies.map(p => <li key={p.name}>{p.name} · {p.command} · {p.roles.join(', ')}</li>)}</ul></details>
            </Panel>

          </div>}
        </div>
        <Panel title="Các mối liên hệ chính"><div className="flex flex-wrap items-center gap-3 text-sm"><span className="rounded-lg bg-slate-950 p-3">Tài khoản</span><span className="text-slate-500">→</span><span className="rounded-lg bg-indigo-500/15 p-3 text-indigo-200">Hồ sơ ứng tuyển</span><span className="text-slate-500">←</span><span className="rounded-lg bg-slate-950 p-3">Vị trí</span><span className="text-slate-500">→</span><span className="rounded-lg bg-slate-950 p-3">Minh chứng · Đánh giá · Quyết định · Email</span></div><p className="mt-4 text-xs text-slate-500">Vai trò HR nằm trong private.staff_memberships và chỉ được cấp bởi quản trị viên. Metadata đăng ký hoặc nút chuyển HR trên giao diện không cấp quyền database.</p></Panel>
        <p className="text-xs text-slate-500">Engine: {data.engine} · Migration: {data.migration} · Không ghi dữ liệu cloud, không gửi email.</p>
      </>}
    </>}
  </div>;
}
