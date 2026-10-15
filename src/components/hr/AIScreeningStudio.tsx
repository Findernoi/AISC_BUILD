import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  FileText,
  User,
  Briefcase,
  GraduationCap,
  Award,
  Send,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';

interface AIScreeningStudioProps {
  onAdvanceToAssessment: (candidateId: string) => void;
}

export const AIScreeningStudio: React.FC<AIScreeningStudioProps> = ({
  onAdvanceToAssessment,
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
    batchInviteToRound2,
  } = useApp();

  const candidate = candidates.find((c) => c.id === activeCandidateId) || candidates[0];
  const targetJob = jobs.find((j) => j.id === candidate?.jobId) || jobs[0];

  const [customPromptNote, setCustomPromptNote] = useState('');
  const [invitedSuccess, setInvitedSuccess] = useState(false);

  const report = candidate?.aiScreeningReport;

  const handleRunScreening = async () => {
    if (!candidate) return;
    await runAiScreening(candidate.id);
  };

  const handleInviteToRound2 = () => {
    batchInviteToRound2([candidate.id]);
    setInvitedSuccess(true);
    setTimeout(() => {
      setInvitedSuccess(false);
      onAdvanceToAssessment(candidate.id);
    }, 1200);
  };

  if (!candidate) {
    return <div className="p-8 text-center text-slate-400">Không tìm thấy ứng viên.</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header & Candidate Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-slate-900 border border-slate-800 rounded-2xl">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-400" />
            <h1 className="text-xl font-bold text-white">{t.navHrAiScreening}</h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {lang === 'vi'
              ? 'Phân tích tự động hồ sơ CV so với mô tả công việc bằng Gemini 3.8 Flash, bóc tách điểm mạnh và rủi ro tiềm ẩn.'
              : 'Automated resume screening powered by Gemini 3.8 Flash against target job specifications.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 whitespace-nowrap">
            {lang === 'vi' ? 'Ứng viên đang chọn:' : 'Selected candidate:'}
          </span>
          <select
            value={candidate.id}
            onChange={(e) => setActiveCandidateId(e.target.value)}
            className="px-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-indigo-500 font-medium"
          >
            {candidates.map((c) => (
              <option key={c.id} value={c.id}>
                {c.fullName} - {c.university.split('-')[0].trim()} ({c.stage})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Side-by-Side: Candidate Profile vs Job Description */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Candidate Application Data */}
        <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-indigo-400" />
              <h3 className="text-sm font-bold text-white">Hồ Sơ Ứng Viên (Candidate Record)</h3>
            </div>
            <span className="font-mono text-xs text-slate-400">{candidate.id}</span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">{t.fullName}:</span>
              <span className="font-bold text-white">{candidate.fullName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">{t.university}:</span>
              <span className="text-slate-200">{candidate.university}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">{t.major}:</span>
              <span className="text-slate-200">{candidate.major} ({candidate.graduationYear})</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Điểm GPA:</span>
              <span className="font-mono font-bold text-indigo-300">
                {candidate.gpa} / {candidate.gpaScale || '4.0'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Chứng chỉ ngoại ngữ:</span>
              <span className="font-mono font-semibold text-emerald-400">
                {candidate.englishCert?.type} {candidate.englishCert?.score}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Portfolio GitHub:</span>
              <span className="font-mono text-indigo-400 hover:underline truncate max-w-[200px]">
                {candidate.githubUrl}
              </span>
            </div>
          </div>

          <div>
            <span className="text-[11px] font-semibold text-slate-400 block mb-1.5">
              Kỹ năng & Thẻ kỹ thuật:
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

          <div>
            <span className="text-[11px] font-semibold text-slate-400 block mb-1">
              Trích xuất nội dung CV:
            </span>
            <p className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 leading-relaxed font-sans">
              {candidate.cvSummary}
            </p>
          </div>
        </div>

        {/* Right: Target Job Description & Standards */}
        <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-bold text-white">Tiêu Chí Tuyển Dụng (Target Job)</h3>
            </div>
            <span className="font-mono text-xs text-slate-400">{targetJob.id}</span>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <span className="text-slate-400 block">Vị trí:</span>
              <span className="font-bold text-white text-sm">{targetJob.title}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Phòng ban:</span>
              <span className="text-slate-200">{targetJob.department}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Địa điểm & Hình thức:</span>
              <span className="text-slate-200">{targetJob.location} · {targetJob.type}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Yêu cầu GPA tối thiểu:</span>
              <span className="font-mono font-bold text-emerald-400">≥ {targetJob.minGpa} / 4.0</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Chuẩn tiếng Anh:</span>
              <span className="font-medium text-slate-200">{targetJob.englishRequirement}</span>
            </div>
          </div>

          <div>
            <span className="text-[11px] font-semibold text-slate-400 block mb-1.5">
              Kỹ năng bắt buộc (Required Skills):
            </span>
            <div className="flex flex-wrap gap-1.5">
              {targetJob.requirements.map((req) => (
                <span
                  key={req}
                  className="px-2 py-0.5 text-[11px] font-medium bg-indigo-950/40 border border-indigo-800/40 text-indigo-300 rounded-md"
                >
                  {req}
                </span>
              ))}
            </div>
          </div>

          <div>
            <span className="text-[11px] font-semibold text-slate-400 block mb-1">
              Mô tả chi tiết:
            </span>
            <p className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 leading-relaxed">
              {targetJob.description}
            </p>
          </div>
        </div>
      </div>

      {/* AI Screening Studio Core Results & Action */}
      <div className="p-6 bg-gradient-to-br from-slate-900 via-indigo-950/20 to-slate-900 border border-indigo-500/30 rounded-2xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider block">
              Kết Quả Phân Tích Thông Minh
            </span>
            <h3 className="text-lg font-bold text-white mt-0.5">
              Báo Cáo Sàng Lọc Hồ Sơ Bằng AI (AI Resume Screening Studio)
            </h3>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleRunScreening}
              disabled={isAiScreeningLoading}
              className="flex items-center gap-2 px-5 py-2.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              <span>
                {isAiScreeningLoading
                  ? lang === 'vi' ? 'Đang phân tích với Gemini 3.8...' : 'Analyzing with Gemini...'
                  : lang === 'vi' ? 'Chạy Sàng Lọc AI (Gemini 3.8)' : 'Run AI Screening'}
              </span>
            </button>
          </div>
        </div>

        {/* Report Content */}
        {report ? (
          <div className="space-y-6">
            {/* Top Score & Recommendation Card */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Radial Fit Score */}
              <div className="p-5 bg-slate-950 border border-slate-800 rounded-xl flex items-center gap-4">
                <div className="relative w-20 h-20 rounded-full border-4 border-slate-800 flex items-center justify-center shrink-0">
                  <div
                    className="absolute inset-0 rounded-full border-4 border-indigo-500 transition-all duration-700"
                    style={{
                      clipPath: `polygon(50% 50%, -50% -50%, ${report.fitScore * 2}% -50%, 150% 150%, -50% 150%)`,
                    }}
                  />
                  <div className="text-center">
                    <span className="text-2xl font-bold font-mono text-white block">
                      {report.fitScore}%
                    </span>
                    <span className="text-[9px] text-slate-400 uppercase font-mono">Fit Score</span>
                  </div>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                    {t.fitScore}
                  </h4>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    {report.fitScore >= 80
                      ? 'Khớp xuất sắc các tiêu chí học thuật và kỹ thuật.'
                      : report.fitScore >= 65
                      ? 'Khớp khá tốt, đạt tiêu chuẩn nhận phỏng vấn.'
                      : 'Độ tương thích chưa đạt ngưỡng tối ưu.'}
                  </p>
                </div>
              </div>

              {/* Recommendation Banner */}
              <div className="p-5 bg-slate-950 border border-slate-800 rounded-xl flex flex-col justify-between">
                <div>
                  <span className="text-xs text-slate-400 font-medium block">
                    {t.recommendation}
                  </span>
                  <div className="mt-2 flex items-center gap-2">
                    <span
                      className={`px-3 py-1 text-xs font-bold uppercase rounded-lg ${
                        report.recommendation === 'pass'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : report.recommendation === 'hold'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      }`}
                    >
                      {report.recommendation === 'pass'
                        ? t.pass
                        : report.recommendation === 'hold'
                        ? t.hold
                        : t.reject}
                    </span>
                  </div>
                </div>
                <span className="text-[11px] text-slate-400 mt-2 block font-mono">
                  Đánh giá lúc: {report.evaluatedAt}
                </span>
              </div>

              {/* Quick Actions */}
              <div className="p-5 bg-slate-950 border border-slate-800 rounded-xl flex flex-col justify-between">
                <span className="text-xs text-slate-400 font-medium block">Thao Tác Tiếp Theo</span>
                <div className="space-y-2 mt-2">
                  <button
                    onClick={handleInviteToRound2}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-md shadow-emerald-600/20 transition-all"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>
                      {invitedSuccess ? 'Đã Gửi Lời Mời Vòng 2!' : 'Mời Vào Vòng 2 (Assessment)'}
                    </span>
                  </button>
                </div>
              </div>
            </div>

            {/* Executive Summary Quote */}
            <div className="p-4 bg-slate-950/80 border border-slate-800/80 rounded-xl text-xs text-slate-300 leading-relaxed italic">
              "{report.summaryAnalysis}"
            </div>

            {/* Strengths & Red Flags (2 columns) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Strengths */}
              <div className="p-4 bg-slate-950 border border-emerald-900/30 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{t.strengths}</span>
                </div>
                <ul className="space-y-1.5 text-xs text-slate-300 list-disc pl-4">
                  {report.strengths.map((str, idx) => (
                    <li key={idx}>{str}</li>
                  ))}
                </ul>
              </div>

              {/* Red Flags / Potential Risks */}
              <div className="p-4 bg-slate-950 border border-amber-900/30 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-amber-400 font-semibold text-xs">
                  <AlertTriangle className="w-4 h-4" />
                  <span>{t.redFlags}</span>
                </div>
                <ul className="space-y-1.5 text-xs text-slate-300 list-disc pl-4">
                  {report.redFlags.length > 0 ? (
                    report.redFlags.map((rf, idx) => <li key={idx}>{rf}</li>)
                  ) : (
                    <li className="italic text-slate-500">
                      Không phát hiện dấu hiệu cảnh báo đáng kể nào.
                    </li>
                  )}
                </ul>
              </div>
            </div>

            {/* Skill Match Breakdown Progress Bars */}
            {report.skillMatch && (
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-white flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4 text-indigo-400" />
                    <span>{t.skillBreakdown}</span>
                  </span>
                  <span className="text-slate-400 font-mono">Đo lường mức độ tương thích</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {Object.entries(report.skillMatch).map(([skill, pct]) => (
                    <div key={skill} className="space-y-1 text-xs">
                      <div className="flex justify-between font-mono">
                        <span className="text-slate-300">{skill}</span>
                        <span className="text-indigo-400 font-bold">{pct}%</span>
                      </div>
                      <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="bg-indigo-500 h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="p-8 text-center text-slate-400 space-y-2">
            <p>Hồ sơ này chưa được sàng lọc tự động qua AI.</p>
            <p className="text-xs text-slate-500">
              Nhấn nút <b>"Chạy Sàng Lọc AI (Gemini 3.8)"</b> ở trên để tạo báo cáo chi tiết.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
