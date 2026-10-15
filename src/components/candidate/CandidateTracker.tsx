import React from 'react';
import { useApp } from '../../context/AppContext';
import {
  CheckCircle2,
  Clock,
  Code2,
  Award,
  AlertCircle,
  FileText,
  User,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

interface CandidateTrackerProps {
  onGoToCodingCenter: () => void;
  onViewOfferLetter: () => void;
}

export const CandidateTracker: React.FC<CandidateTrackerProps> = ({
  onGoToCodingCenter,
  onViewOfferLetter,
}) => {
  const {
    lang,
    t,
    candidates,
    activeCandidateId,
    setActiveCandidateId,
    jobs,
    runAiScreening,
    isAiScreeningLoading,
  } = useApp();

  const candidate = candidates.find((c) => c.id === activeCandidateId) || candidates[0];
  const targetJob = jobs.find((j) => j.id === candidate?.jobId);

  if (!candidate) {
    return (
      <div className="p-8 text-center text-slate-400 bg-slate-900 border border-slate-800 rounded-2xl">
        Chưa có dữ liệu ứng viên. Vui lòng nộp hồ sơ trước.
      </div>
    );
  }

  // Stages configuration
  const STAGES = [
    {
      id: 'applied',
      label: t.stageApplied,
      desc: lang === 'vi' ? 'Hồ sơ đã được lưu trữ vào hệ thống' : 'Profile recorded in talent base',
      stepNum: 1,
    },
    {
      id: 'ai_screening',
      label: t.stageScreening,
      desc: lang === 'vi' ? 'Mô hình AI phân tích CV so với mô tả công việc' : 'AI parses resume against job specs',
      stepNum: 2,
    },
    {
      id: 'assessment',
      label: t.stageAssessment,
      desc: lang === 'vi' ? 'Kiểm thử thuật toán trực tiếp và phỏng vấn kỹ thuật' : 'Live coding challenge and technical interview',
      stepNum: 3,
    },
    {
      id: 'final_decision',
      label: t.stageDecision,
      desc: lang === 'vi' ? 'Tổng hợp điểm số và đưa ra thư mời nhận việc' : 'Weighted composite decision and official offer',
      stepNum: 4,
    },
  ];

  const getStageIndex = (stage: string) => {
    switch (stage) {
      case 'applied':
        return 0;
      case 'ai_screening':
        return 1;
      case 'assessment':
        return 2;
      case 'final_decision':
        return 3;
      default:
        return 0;
    }
  };

  const currentStageIndex = getStageIndex(candidate.stage);

  return (
    <div className="space-y-6">
      {/* Top Header & Candidate Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-slate-900 border border-slate-800 rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center font-bold text-lg border border-indigo-500/20">
            {candidate.fullName.charAt(0)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white">{candidate.fullName}</h2>
              <span className="font-mono text-xs text-indigo-400 bg-indigo-950/60 border border-indigo-800/40 px-2 py-0.5 rounded-md">
                {candidate.id}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {targetJob?.title || 'Vị trí công nghệ'} · {candidate.university}
            </p>
          </div>
        </div>

        {/* Switcher for testing/demo */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 whitespace-nowrap">
            {lang === 'vi' ? 'Mô phỏng ứng viên khác:' : 'Demo as candidate:'}
          </span>
          <select
            value={candidate.id}
            onChange={(e) => setActiveCandidateId(e.target.value)}
            className="px-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-indigo-500 font-medium"
          >
            {candidates.map((c) => (
              <option key={c.id} value={c.id}>
                {c.fullName} ({c.id} - {c.stage})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Real-time Status Tracker Timeline */}
      <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-sm">
        <h3 className="text-sm font-bold text-white mb-6 flex items-center gap-2">
          <Clock className="w-4 h-4 text-indigo-400" />
          <span>{t.trackingTitle}</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 relative">
          {STAGES.map((st, idx) => {
            const isCompleted = idx < currentStageIndex || (idx === currentStageIndex && candidate.status === 'passed');
            const isCurrent = idx === currentStageIndex;
            const isPending = idx > currentStageIndex;

            return (
              <div
                key={st.id}
                className={`relative p-4 rounded-xl border transition-all ${
                  isCurrent
                    ? 'bg-indigo-950/40 border-indigo-500/50 ring-1 ring-indigo-500/30'
                    : isCompleted
                    ? 'bg-slate-950/60 border-emerald-500/30'
                    : 'bg-slate-950/30 border-slate-800/60 opacity-60'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-mono font-bold text-slate-400">
                    GIAI ĐOẠN 0{st.stepNum}
                  </span>
                  {isCompleted ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : isCurrent ? (
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-400 animate-pulse" />
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-slate-700" />
                  )}
                </div>
                <h4 className="text-sm font-semibold text-white mb-1">{st.label}</h4>
                <p className="text-xs text-slate-400 leading-relaxed">{st.desc}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Interactive Stage Focus Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Academic & Skill Snapshot */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
            {lang === 'vi' ? 'Hồ Sơ Đã Nộp' : 'Candidate Profile Snapshot'}
          </h4>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between py-1.5 border-b border-slate-800/80">
              <span className="text-slate-400">{t.university}:</span>
              <span className="font-medium text-white text-right max-w-[180px] truncate">
                {candidate.university}
              </span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-800/80">
              <span className="text-slate-400">{t.major}:</span>
              <span className="text-white text-right max-w-[180px] truncate">{candidate.major}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-800/80">
              <span className="text-slate-400">GPA:</span>
              <span className="font-mono font-bold text-indigo-300">
                {candidate.gpa} / {candidate.gpaScale || '4.0'}
              </span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-800/80">
              <span className="text-slate-400">{t.englishCertType}:</span>
              <span className="font-mono text-emerald-400 font-semibold">
                {candidate.englishCert?.type} {candidate.englishCert?.score}
              </span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-800/80">
              <span className="text-slate-400">File CV:</span>
              <span className="flex items-center gap-1 text-slate-300 font-mono truncate max-w-[170px]">
                <FileText className="w-3.5 h-3.5 text-indigo-400" />
                {candidate.cvFileName}
              </span>
            </div>
          </div>

          <div>
            <span className="text-[11px] font-semibold text-slate-400 block mb-1.5">
              {t.skillsBadgesLabel}:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {candidate.techBadges.map((badge) => (
                <span
                  key={badge}
                  className="px-2 py-0.5 text-[11px] font-medium bg-slate-950 border border-slate-800 text-slate-300 rounded-md"
                >
                  {badge}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Right 2 Columns: Detailed Status for Current Stage */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">
                  {lang === 'vi' ? 'Chi Tiết Giai Đoạn Hiện Tại' : 'Current Stage Progress'}
                </span>
                <h3 className="text-base font-bold text-white mt-0.5">
                  {STAGES[currentStageIndex]?.label}
                </h3>
              </div>
              <span
                className={`px-3 py-1 text-xs font-semibold rounded-lg ${
                  candidate.status === 'passed'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : candidate.status === 'hold'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : candidate.status === 'rejected'
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                }`}
              >
                {candidate.status === 'passed'
                  ? 'Đạt Yêu Cầu / Qualified'
                  : candidate.status === 'hold'
                  ? 'Đang Xem Xét / In Review'
                  : candidate.status === 'rejected'
                  ? 'Không Phù Hợp / Rejected'
                  : 'Đang Xử Lý / Processing'}
              </span>
            </div>

            {/* Stage 1: Applied Details */}
            {candidate.stage === 'applied' && (
              <div className="space-y-3 text-xs text-slate-300">
                <p>
                  Hồ sơ của bạn đã được tiếp nhận thành công vào ngày{' '}
                  <span className="font-mono text-white">{candidate.appliedDate}</span>.
                </p>
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 text-indigo-400 font-semibold">
                    <Sparkles className="w-4 h-4" />
                    <span>Hệ thống AI tự động phân tích:</span>
                  </div>
                  <p className="text-slate-400">
                    Mô hình Gemini 3.8 Flash sẽ so sánh các tiêu chí kỹ thuật, GPA và chứng chỉ ngoại ngữ của bạn với yêu cầu công việc.
                  </p>
                </div>
                <div className="pt-2">
                  <button
                    onClick={() => runAiScreening(candidate.id)}
                    disabled={isAiScreeningLoading}
                    className="flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-colors shadow-md shadow-indigo-600/20 disabled:opacity-50"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>
                      {isAiScreeningLoading
                        ? 'Đang sàng lọc bằng AI...'
                        : 'Mô phỏng chạy Sàng lọc AI ngay'}
                    </span>
                  </button>
                </div>
              </div>
            )}

            {/* Stage 2: AI Screening Details */}
            {candidate.stage === 'ai_screening' && candidate.aiScreeningReport && (
              <div className="space-y-4">
                <div className="flex items-center gap-4 p-4 bg-slate-950 border border-slate-800 rounded-xl">
                  <div className="w-16 h-16 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex flex-col items-center justify-center shrink-0">
                    <span className="text-xl font-bold font-mono text-indigo-300">
                      {candidate.aiScreeningReport.fitScore}%
                    </span>
                    <span className="text-[10px] text-slate-400 uppercase">Fit Score</span>
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-white mb-1">
                      {lang === 'vi' ? 'Đánh giá sơ bộ của AI:' : 'AI Screening Summary:'}
                    </h5>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      {candidate.aiScreeningReport.summaryAnalysis}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-xs font-semibold text-emerald-400 block">
                    {lang === 'vi' ? 'Điểm mạnh nổi bật:' : 'Top Strengths:'}
                  </span>
                  <ul className="space-y-1 text-xs text-slate-300">
                    {candidate.aiScreeningReport.strengths.map((str, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                        <span>{str}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* Stage 3: Assessment Details (Coding & HR Interview) */}
            {candidate.stage === 'assessment' && (
              <div className="space-y-4">
                <div className="p-4 bg-indigo-950/30 border border-indigo-800/40 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 text-indigo-300 font-semibold text-sm">
                    <Award className="w-4 h-4 text-indigo-400" />
                    <span>
                      {lang === 'vi'
                        ? 'Chúc mừng! Bạn đã được mời tham gia Vòng 2'
                        : 'Congratulations! You are invited to Round 2'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {lang === 'vi'
                      ? 'Vòng 2 bao gồm bài kiểm tra thuật toán trực tuyến và phỏng vấn trực tiếp cùng kỹ sư trưởng. Hãy truy cập Trung tâm Lập trình để giải quyết bài toán kỹ thuật được chỉ định.'
                      : 'Round 2 consists of an interactive algorithm challenge and an engineering interview. Open the coding center to complete your assignment.'}
                  </p>
                </div>

                {candidate.codingSubmission ? (
                  <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-white">
                        {lang === 'vi' ? 'Kết quả bài kiểm tra lập trình:' : 'Coding Test Result:'}
                      </span>
                      <span className="font-mono text-emerald-400 font-bold">
                        {candidate.codingSubmission.testsPassed} / {candidate.codingSubmission.totalTests} tests passed
                      </span>
                    </div>
                    <div className="flex gap-4 text-slate-400 pt-1">
                      <span>Điểm AI Code: <b className="text-indigo-300 font-mono">{candidate.codingSubmission.aiCodeScore}/100</b></span>
                      <span>Thời gian: <b className="text-slate-200 font-mono">{candidate.codingSubmission.runtimeMs}ms</b></span>
                      <span>Độ phức tạp: <b className="text-slate-200 font-mono">{candidate.codingSubmission.timeComplexity}</b></span>
                    </div>
                  </div>
                ) : (
                  <div className="pt-2">
                    <button
                      onClick={onGoToCodingCenter}
                      className="flex items-center gap-2 px-5 py-2.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-lg shadow-indigo-600/30 transition-all"
                    >
                      <Code2 className="w-4 h-4" />
                      <span>{lang === 'vi' ? 'Vào Làm Bài Test Lập Trình Vòng 2' : 'Enter Round 2 Coding Sandbox'}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Stage 4: Final Decision */}
            {candidate.stage === 'final_decision' && (
              <div className="space-y-4">
                <div
                  className={`p-5 rounded-xl border ${
                    candidate.finalDecision === 'hire'
                      ? 'bg-emerald-950/30 border-emerald-800/40'
                      : 'bg-slate-950 border-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2 text-sm font-bold text-white mb-2">
                    <Award className="w-5 h-5 text-emerald-400" />
                    <span>
                      {candidate.finalDecision === 'hire'
                        ? lang === 'vi' ? 'Đã Nhận Được Đề Xuất Tuyển Dụng (Offer)!' : 'Official Hiring Offer Extended!'
                        : lang === 'vi' ? 'Hồ Sơ Đang Trong Danh Sách Chờ Xét Duyệt' : 'Application in Final Decision Pool'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {candidate.finalDecision === 'hire'
                      ? lang === 'vi'
                        ? 'Chúc mừng bạn đã vượt qua xuất sắc cả 4 vòng sàng lọc và đánh giá kỹ thuật của TalentMatch AI. Thư mời nhận việc chính thức đã sẵn sàng!'
                        : 'Congratulations! You have excelled across all screening and assessment stages. Your official offer letter is generated.'
                      : lang === 'vi'
                      ? 'Hội đồng tuyển dụng đang xem xét bảng xếp hạng tổng hợp có trọng số. Kết quả chính thức sẽ được công bố sớm nhất.'
                      : 'The hiring committee is finalizing weighted composite rankings. Final announcements will be delivered promptly.'}
                  </p>
                </div>

                {candidate.finalDecision === 'hire' && (
                  <div className="pt-2">
                    <button
                      onClick={onViewOfferLetter}
                      className="flex items-center gap-2 px-6 py-2.5 text-xs font-semibold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl shadow-lg shadow-emerald-600/25 transition-all"
                    >
                      <FileText className="w-4 h-4" />
                      <span>{lang === 'vi' ? 'Xem Thư Mời Nhận Việc Chính Thức' : 'View Official Offer Letter'}</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
