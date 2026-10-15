import React from 'react';
import { useApp } from '../context/AppContext';
import { Sparkles, Briefcase, User, RotateCcw, Globe, LogOut } from 'lucide-react';

interface NavbarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentTab, setCurrentTab }) => {
  const { authUser, lang, setLang, role, setRole, t, resetData, signOut } = useApp();

  return (
    <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-md border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Brand Wordmark */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-violet-600 to-indigo-400 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <span className="text-lg font-bold tracking-tight text-white whitespace-nowrap block">
              TalentMatch <span className="text-indigo-400">AI</span>
            </span>
            <span className="text-[11px] text-slate-400 hidden sm:block whitespace-nowrap -mt-0.5">
              {lang === 'vi' ? 'Nền Tảng Tuyển Dụng & Sàng Lọc' : 'Intelligent Recruitment Engine'}
            </span>
          </div>
        </div>

        {/* Zone 2: Navigation Links based on Active Role */}
        <nav className="hidden md:flex items-center gap-1 overflow-x-auto py-1">
          {role === 'candidate' ? (
            <>
              <button
                onClick={() => setCurrentTab('jobs')}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                  currentTab === 'jobs'
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                }`}
              >
                {t.navJobs}
              </button>
              <button
                onClick={() => setCurrentTab('dashboard')}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                  currentTab === 'dashboard'
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                }`}
              >
                {t.navDashboard}
              </button>
              <button
                onClick={() => setCurrentTab('coding')}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                  currentTab === 'coding'
                    ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                }`}
              >
                {t.navCodingCenter}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setCurrentTab('pipeline')}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                  currentTab === 'pipeline'
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                }`}
              >
                {t.navHrPipeline}
              </button>
              <button
                onClick={() => setCurrentTab('screening')}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                  currentTab === 'screening'
                    ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                }`}
              >
                {t.navHrAiScreening}
              </button>
              <button
                onClick={() => setCurrentTab('assessment')}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                  currentTab === 'assessment'
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                }`}
              >
                {t.navHrAssessment}
              </button>
              <button
                onClick={() => setCurrentTab('decision')}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                  currentTab === 'decision'
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                }`}
              >
                {t.navHrDecision}
              </button>
              <button
                onClick={() => setCurrentTab('jobs-manage')}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                  currentTab === 'jobs-manage'
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                }`}
              >
                {t.navHrJobs}
              </button>
            </>
          )}
        </nav>

        {/* Zone 3: Interactive Role Switcher & Controls */}
        <div className="flex items-center gap-2.5 shrink-0">
          {/* Dual-role toggle */}
          <div className="flex items-center p-1 bg-slate-900 border border-slate-800 rounded-xl">
            <button
              onClick={() => {
                setRole('candidate');
                setCurrentTab('jobs');
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg transition-all whitespace-nowrap shrink-0 ${
                role === 'candidate'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Xem giao diện cổng thông tin ứng viên"
            >
              <User className="w-3.5 h-3.5" />
              <span>{lang === 'vi' ? 'Ứng Viên' : 'Candidate'}</span>
            </button>
            <button
              onClick={() => {
                setRole('hr');
                setCurrentTab('pipeline');
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg transition-all whitespace-nowrap shrink-0 ${
                role === 'hr'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Xem giao diện cổng quản trị tuyển dụng HR"
            >
              <Briefcase className="w-3.5 h-3.5" />
              <span>{lang === 'vi' ? 'Nhà Tuyển Dụng' : 'Recruiter / HR'}</span>
            </button>
          </div>

          {/* Language Switcher */}
          <button
            onClick={() => setLang(lang === 'vi' ? 'en' : 'vi')}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 transition-colors whitespace-nowrap shrink-0"
            title="Đổi ngôn ngữ / Change language"
          >
            <Globe className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-semibold uppercase">{lang}</span>
          </button>

          <button
            onClick={() => {
              void signOut().catch((error: unknown) => {
                console.error('Supabase sign out failed:', error);
                window.alert(
                  error instanceof Error
                    ? error.message
                    : lang === 'vi' ? 'Không thể đăng xuất. Vui lòng thử lại.' : 'Unable to sign out. Please try again.'
                );
              });
            }}
            className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-300 transition-colors hover:border-slate-700 hover:text-white"
            title={authUser?.email || (lang === 'vi' ? 'Đăng xuất' : 'Sign out')}
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{lang === 'vi' ? 'Đăng xuất' : 'Sign out'}</span>
          </button>

          {/* Reset Demo Data Button */}
          <button
            onClick={() => {
              if (window.confirm(lang === 'vi' ? 'Đặt lại toàn bộ dữ liệu mẫu ban đầu?' : 'Reset all mock candidates and jobs?')) {
                resetData();
              }
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent hover:border-slate-800 transition-colors"
            title={lang === 'vi' ? 'Đặt lại dữ liệu mẫu' : 'Reset mock data'}
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
