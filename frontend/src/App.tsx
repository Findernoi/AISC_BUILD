import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { AuthScreen } from './components/AuthScreen';
import { Navbar } from './components/Navbar';
import { JobCatalog } from './components/candidate/JobCatalog';
import { CandidateTracker } from './components/candidate/CandidateTracker';
import { JobManager } from './components/hr/JobManager';
import { ShortlistCenter } from './components/hr/ShortlistCenter';
import { RoundTwoCenter } from './components/hr/RoundTwoCenter';
import { HiringDecisionCenter } from './components/hr/HiringDecisionCenter';
import { AnalyticsDashboard } from './components/analytics/AnalyticsDashboard';
import { WorkforceForecast } from './components/analytics/WorkforceForecast';
import { CandidatePredictions } from './components/analytics/CandidatePredictions';

function AppContent() {
  const { authUser,authReady,demoMode,enterDemo,role,activeCandidateId,setActiveCandidateId } = useApp();
  const [tab,setTab] = useState('shortlist');
  const [planningView,setPlanningView] = useState<'overview'|'forecast'|'probability'|'jobs'>('forecast');
  if (!demoMode&&!authReady) return <main className="min-h-screen bg-slate-950 grid place-items-center text-slate-400"><div className="space-y-5 text-center"><p>Đang kiểm tra phiên đăng nhập…</p><button className="btn-secondary" onClick={enterDemo}>Khám phá bản demo frontend</button></div></main>;
  if (!authUser&&!demoMode) return <AuthScreen />;
  const review = (id:string) => { setActiveCandidateId(id);setTab('round-two'); };
  return <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100"><Navbar currentTab={tab} setCurrentTab={setTab} /><main className="mx-auto w-full max-w-7xl flex-1 px-4 py-7 sm:px-8 sm:py-9">
    <p className="mb-6 rounded-xl border border-amber-900/60 bg-amber-950/20 px-4 py-3 text-xs leading-relaxed text-amber-200">Demo frontend · Phạm vi UIT và KHMT, KTPM, AI. Điều kiện UIT dùng định dạng email @gm.uit.edu.vn; ngành và GPA tự khai. Dự báo, xác suất tuyển dụng, minh chứng mẫu và email đang mô phỏng. Quyết định tuyển thuộc HR.</p>
    {role==='hr'?<>
      {tab==='planning'&&<div className="space-y-6"><div className="flex flex-wrap gap-2">{([['forecast','Dự báo nhu cầu nhân lực'],['probability','Xác suất được tuyển'],['overview','Thống kê và offer'],['jobs','Vị trí tuyển dụng']] as const).map(([id,label])=><button key={id} className={`btn-secondary ${planningView===id?'border-indigo-400 text-indigo-200':''}`} onClick={()=>setPlanningView(id)}>{label}</button>)}</div>{planningView==='jobs'?<JobManager />:planningView==='forecast'?<WorkforceForecast onManageJobs={()=>setPlanningView('jobs')} />:planningView==='probability'?<CandidatePredictions />:<AnalyticsDashboard />}</div>}
      {tab==='shortlist'&&<ShortlistCenter onInterview={review} />}
      {tab==='round-two'&&<RoundTwoCenter key={activeCandidateId} onDecision={()=>setTab('hiring')} />}
      {tab==='hiring'&&<HiringDecisionCenter />}
    </>:<>
      {tab==='dashboard'?<CandidateTracker />:<JobCatalog onAppliedSuccess={id=>{setActiveCandidateId(id);setTab('dashboard');}} />}
    </>}
  </main><footer className="border-t border-slate-800 px-5 py-5 text-center text-xs text-slate-500">TalentForecast AI · Dự báo nhu cầu nhân lực doanh nghiệp, sàng lọc UIT và hỗ trợ quyết định của HR.</footer></div>;
}
export default function App() {return <AppProvider><AppContent /></AppProvider>;}
