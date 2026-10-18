import React from 'react';
import { useApp } from '../../context/AppContext';
export function useText() { const { lang } = useApp(); return (vi: string, en: string) => lang === 'vi' ? vi : en; }
export const Panel = ({ title, children, className = '' }: { title?: string; children: React.ReactNode; className?: string }) => <section className={`rounded-2xl border border-slate-800 bg-slate-900/70 p-5 sm:p-6 ${className}`}>{title && <h2 className="mb-5 text-base font-bold text-white">{title}</h2>}{children}</section>;
export const Metric = ({ label, value, note }: { label: string; value: React.ReactNode; note?: string }) => <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5"><p className="text-xs text-slate-400">{label}</p><p className="my-3 text-3xl font-bold tracking-tight text-indigo-200">{value}</p>{note && <p className="text-xs text-slate-500">{note}</p>}</div>;
export function Field({label,children}:{label:string;children:React.ReactNode}) {
  const generatedId=React.useId();
  if(React.isValidElement(children) && typeof children.type==='string' && ['input','select','textarea'].includes(children.type)) {
    const child=children as React.ReactElement<{id?:string}>;
    const id=child.props.id || generatedId;
    return <div className="space-y-2 text-xs text-slate-400"><label htmlFor={id} className="block">{label}</label>{React.cloneElement(child,{id})}</div>;
  }
  return <label className="block space-y-2 text-xs text-slate-400"><span>{label}</span>{children}</label>;
}
export const Empty = ({ children }: { children: React.ReactNode }) => <p className="py-10 text-center text-sm text-slate-400">{children}</p>;
export const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

export function Bars({ rows }: { rows: { label: string; value: number; suffix?: string }[] }) {
  const max = Math.max(1, ...rows.map(r => r.value));
  return <div className="space-y-4">{rows.map(r => <div key={r.label}><div className="mb-2 flex justify-between gap-3 text-xs"><span className="text-slate-300">{r.label}</span><span className="font-mono text-indigo-200">{r.value.toFixed(1)}{r.suffix}</span></div><div className="h-2 rounded bg-slate-800"><div className="h-2 rounded bg-indigo-400" style={{ width: `${r.value / max * 100}%` }} /></div></div>)}</div>;
}
