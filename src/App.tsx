import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { AuthScreen } from './components/AuthScreen';
import { Navbar } from './components/Navbar';
import { JobCatalog } from './components/candidate/JobCatalog';
import { CandidateTracker } from './components/candidate/CandidateTracker';
import { CodingCenter } from './components/candidate/CodingCenter';
import { CandidatePipeline } from './components/hr/CandidatePipeline';
import { AIScreeningStudio } from './components/hr/AIScreeningStudio';
import { AssessmentReview } from './components/hr/AssessmentReview';
import { DecisionCenter } from './components/hr/DecisionCenter';
import { JobManager } from './components/hr/JobManager';

const AppContent: React.FC = () => {
  const { authUser, authReady, role, lang, setActiveCandidateId } = useApp();
  const [currentTab, setCurrentTab] = useState<string>(role === 'candidate' ? 'jobs' : 'pipeline');

  // Keep currentTab synchronized if role changes
  React.useEffect(() => {
    if (role === 'candidate') {
      if (['pipeline', 'screening', 'assessment', 'decision', 'jobs-manage'].includes(currentTab)) {
        setCurrentTab('jobs');
      }
    } else {
      if (['jobs', 'dashboard', 'coding'].includes(currentTab)) {
        setCurrentTab('pipeline');
      }
    }
  }, [role, currentTab]);

  if (!authReady) {
    return (
      <main className="min-h-screen bg-slate-950 flex items-center justify-center text-sm text-slate-400">
        {lang === 'vi' ? 'Đang kiểm tra phiên đăng nhập...' : 'Checking your session...'}
      </main>
    );
  }

  if (!authUser) {
    return <AuthScreen />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Bar Navigation */}
      <Navbar currentTab={currentTab} setCurrentTab={setCurrentTab} />

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {role === 'candidate' ? (
          <>
            {currentTab === 'jobs' && (
              <JobCatalog
                onAppliedSuccess={(candidateId) => {
                  setActiveCandidateId(candidateId);
                  setCurrentTab('dashboard');
                }}
              />
            )}
            {currentTab === 'dashboard' && (
              <CandidateTracker
                onGoToCodingCenter={() => setCurrentTab('coding')}
                onViewOfferLetter={() => {
                  // If applicant has offer, can view details
                  alert(
                    lang === 'vi'
                      ? 'Thư mời nhận việc chính thức đã được gửi tới email của bạn. Xin chúc mừng!'
                      : 'Official job offer has been sent to your email. Congratulations!'
                  );
                }}
              />
            )}
            {currentTab === 'coding' && (
              <CodingCenter
                onSubmittedSuccess={() => {
                  setCurrentTab('dashboard');
                }}
              />
            )}
          </>
        ) : (
          <>
            {currentTab === 'pipeline' && (
              <CandidatePipeline
                onSelectCandidateForAi={(candidateId) => {
                  setActiveCandidateId(candidateId);
                  setCurrentTab('screening');
                }}
                onSelectCandidateForAssessment={(candidateId) => {
                  setActiveCandidateId(candidateId);
                  setCurrentTab('assessment');
                }}
                onSelectCandidateForDecision={(candidateId) => {
                  setActiveCandidateId(candidateId);
                  setCurrentTab('decision');
                }}
              />
            )}
            {currentTab === 'screening' && (
              <AIScreeningStudio
                onAdvanceToAssessment={(candidateId) => {
                  setActiveCandidateId(candidateId);
                  setCurrentTab('assessment');
                }}
              />
            )}
            {currentTab === 'assessment' && (
              <AssessmentReview
                onAdvanceToDecision={(candidateId) => {
                  setActiveCandidateId(candidateId);
                  setCurrentTab('decision');
                }}
              />
            )}
            {currentTab === 'decision' && <DecisionCenter />}
            {currentTab === 'jobs-manage' && <JobManager />}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-6 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div>
            <span className="font-semibold text-slate-400">TalentMatch AI</span> —{' '}
            {lang === 'vi'
              ? 'Nền tảng tuyển dụng và sàng lọc ứng viên công nghệ bằng Trí tuệ Nhân tạo'
              : 'AI-Powered Recruitment & Candidate Screening Platform'}
          </div>
          <div className="flex items-center gap-4">
            <span>Powered by Gemini 3.8 Flash</span>
            <span aria-hidden="true">·</span>
            <span>TypeScript & React 19</span>
            <span aria-hidden="true">·</span>
            <span>UIT & Vietnamese University Standards</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
