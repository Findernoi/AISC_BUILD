import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { HRScorecard, CodingSubmission } from '../../types';
import {
  Award,
  Code2,
  Terminal,
  CheckCircle2,
  Save,
  ArrowRight,
  UserCheck,
  Sparkles,
} from 'lucide-react';

interface AssessmentReviewProps {
  onAdvanceToDecision: (candidateId: string) => void;
}

export const AssessmentReview: React.FC<AssessmentReviewProps> = ({
  onAdvanceToDecision,
}) => {
  const {
    lang,
    t,
    candidates,
    activeCandidateId,
    setActiveCandidateId,
    jobs,
    challenges,
    saveHRScorecard,
    submitCodingTest,
  } = useApp();

  const candidate = candidates.find((c) => c.id === activeCandidateId) || candidates[0];
  const targetJob = jobs.find((j) => j.id === candidate?.jobId) || jobs[0];
  const targetChallenge =
    challenges.find((c) => c.id === targetJob?.codingChallengeId) || challenges[0];

  // Existing scorecard or defaults
  const existingScorecard = candidate?.hrScorecard;
  const [interviewerName, setInterviewerName] = useState(
    existingScorecard?.interviewerName || 'Trần Văn Kiên (Tech Hiring Lead)'
  );
  const [technicalScore, setTechnicalScore] = useState<number>(
    existingScorecard?.technicalScore ?? 88
  );
  const [problemSolvingScore, setProblemSolvingScore] = useState<number>(
    existingScorecard?.problemSolvingScore ?? 85
  );
  const [communicationScore, setCommunicationScore] = useState<number>(
    existingScorecard?.communicationScore ?? 82
  );
  const [cultureFitScore, setCultureFitScore] = useState<number>(
    existingScorecard?.cultureFitScore ?? 85
  );
  const [notes, setNotes] = useState<string>(
    existingScorecard?.notes ||
      'Ứng viên tự tin, diễn đạt rõ ràng logic thuật toán. Tư duy phân tích cấu trúc dữ liệu tốt.'
  );
  const [recommendation, setRecommendation] = useState<HRScorecard['recommendation']>(
    existingScorecard?.recommendation || 'hire'
  );
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  // Dynamic Overall Score: 30% Tech, 30% Problem, 20% Comm, 20% Culture
  const calculatedOverallScore = Math.round(
    technicalScore * 0.3 +
      problemSolvingScore * 0.3 +
      communicationScore * 0.2 +
      cultureFitScore * 0.2
  );

  const handleSaveScorecard = () => {
    if (!candidate) return;
    const scorecard: HRScorecard = {
      interviewerName,
      technicalScore,
      problemSolvingScore,
      communicationScore,
      cultureFitScore,
      overallScore: calculatedOverallScore,
      notes,
      recommendation,
      evaluatedAt: new Date().toISOString().split('T')[0],
    };

    saveHRScorecard(candidate.id, scorecard);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onAdvanceToDecision(candidate.id);
    }, 1000);
  };

  const handleSimulateCodingSubmission = () => {
    if (!candidate) return;
    const submission: CodingSubmission = {
      problemId: targetChallenge.id,
      code: targetChallenge.starterCode,
      testsPassed: 3,
      totalTests: 3,
      runtimeMs: 14,
      aiCodeScore: 92,
      timeComplexity: 'O(N)',
      spaceComplexity: 'O(N)',
      strengths: [
        'Vượt qua 100% test cases.',
        'Mã nguồn cấu trúc chuẩn và đặt tên biến có ngữ nghĩa.',
      ],
      improvements: ['Có thể tối ưu bộ nhớ cache nếu dữ liệu lớn.'],
      cleanCodeVerdict: 'Mã nguồn đạt chuẩn chất lượng kỹ sư công nghệ.',
      submittedAt: new Date().toISOString(),
    };
    submitCodingTest(candidate.id, submission);
  };

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-slate-900 border border-slate-800 rounded-2xl">
        <div>
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-indigo-400" />
            <h1 className="text-xl font-bold text-white">{t.navHrAssessment}</h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {lang === 'vi'
              ? 'Xem xét kết quả kiểm thử lập trình tự động và chấm điểm phỏng vấn nhân sự theo bộ tiêu chuẩn 4 chiều.'
              : 'Review automated coding assessment logs and evaluate candidate across 4 core interview rubrics.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 whitespace-nowrap">
            {lang === 'vi' ? 'Đang chấm điểm:' : 'Grading candidate:'}
          </span>
          <select
            value={candidate.id}
            onChange={(e) => setActiveCandidateId(e.target.value)}
            className="px-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-indigo-500 font-medium"
          >
            {candidates.map((c) => (
              <option key={c.id} value={c.id}>
                {c.fullName} ({c.stage})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Part 1: Technical Coding Submission Inspection */}
      <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Code2 className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white">
              {lang === 'vi'
                ? 'Mô-đun Đánh Giá Bài Test Lập Trình (Coding Submission)'
                : 'Technical Coding Assessment Submission'}
            </h3>
          </div>
          {candidate.codingSubmission && (
            <span className="font-mono text-xs text-emerald-400 font-bold">
              {candidate.codingSubmission.testsPassed} / {candidate.codingSubmission.totalTests} Tests Passed
            </span>
          )}
        </div>

        {candidate.codingSubmission ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Code snippet display */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-slate-400 block font-mono">
                Source Code ({targetChallenge.title.split('/')[0]}):
              </span>
              <pre className="p-4 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-indigo-200 overflow-x-auto max-h-56 leading-relaxed">
                <code>{candidate.codingSubmission.code}</code>
              </pre>
            </div>

            {/* AI Review & Metric Cards */}
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
                  <span className="text-slate-400 block text-[11px]">AI Code Score</span>
                  <span className="text-lg font-bold font-mono text-indigo-300">
                    {candidate.codingSubmission.aiCodeScore}/100
                  </span>
                </div>
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
                  <span className="text-slate-400 block text-[11px]">Thời gian chạy</span>
                  <span className="text-lg font-bold font-mono text-emerald-400">
                    {candidate.codingSubmission.runtimeMs}ms
                  </span>
                </div>
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
                  <span className="text-slate-400 block text-[11px]">Time Complexity</span>
                  <span className="text-lg font-bold font-mono text-white">
                    {candidate.codingSubmission.timeComplexity}
                  </span>
                </div>
              </div>

              <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl text-xs space-y-1.5">
                <div className="flex items-center gap-1.5 text-indigo-400 font-semibold">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Nhận định của AI:</span>
                </div>
                <p className="text-slate-300 italic">
                  "{candidate.codingSubmission.cleanCodeVerdict}"
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-6 bg-slate-950 border border-slate-800 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
            <span className="text-slate-400">
              {lang === 'vi'
                ? 'Ứng viên này chưa hoàn thành bài test lập trình trực tuyến.'
                : 'Candidate has not submitted coding test yet.'}
            </span>
            <button
              onClick={handleSimulateCodingSubmission}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
            >
              <Code2 className="w-3.5 h-3.5 text-indigo-400" />
              <span>{lang === 'vi' ? 'Mô phỏng nộp bài test mẫu' : 'Simulate Coding Test'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Part 2: HR & Technical Interview Scorecard */}
      <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-800">
          <div>
            <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider block">
              Đánh Giá Định Lượng
            </span>
            <h3 className="text-lg font-bold text-white mt-0.5">{t.hrScorecardTitle}</h3>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Điểm Tổng Hợp:</span>
            <span className="text-2xl font-bold font-mono text-emerald-400 bg-slate-950 px-3 py-1 rounded-xl border border-slate-800">
              {calculatedOverallScore}/100
            </span>
          </div>
        </div>

        {/* Rubric Sliders (4 Criteria) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Criterion 1: Technical Depth (30%) */}
          <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
            <div className="flex justify-between text-xs">
              <span className="font-semibold text-white">{t.technicalDepth}</span>
              <span className="font-mono font-bold text-indigo-400 text-sm">
                {technicalScore}/100
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={technicalScore}
              onChange={(e) => setTechnicalScore(Number(e.target.value))}
              className="w-full accent-indigo-500 cursor-pointer"
            />
            <span className="text-[11px] text-slate-400 block">
              Kiến thức nền tảng về hệ điều hành, cấu trúc dữ liệu, giải thuật và framework chuyên môn.
            </span>
          </div>

          {/* Criterion 2: Problem Solving (30%) */}
          <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
            <div className="flex justify-between text-xs">
              <span className="font-semibold text-white">{t.problemSolving}</span>
              <span className="font-mono font-bold text-indigo-400 text-sm">
                {problemSolvingScore}/100
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={problemSolvingScore}
              onChange={(e) => setProblemSolvingScore(Number(e.target.value))}
              className="w-full accent-indigo-500 cursor-pointer"
            />
            <span className="text-[11px] text-slate-400 block">
              Khả năng bóc tách vấn đề phức tạp, tư duy logic phản biện và đề xuất phương án tối ưu.
            </span>
          </div>

          {/* Criterion 3: Communication & English (20%) */}
          <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
            <div className="flex justify-between text-xs">
              <span className="font-semibold text-white">{t.communication}</span>
              <span className="font-mono font-bold text-indigo-400 text-sm">
                {communicationScore}/100
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={communicationScore}
              onChange={(e) => setCommunicationScore(Number(e.target.value))}
              className="w-full accent-indigo-500 cursor-pointer"
            />
            <span className="text-[11px] text-slate-400 block">
              Trình bày ý tưởng mạch lạc, lắng nghe phản hồi và phản xạ tiếng Anh chuyên ngành.
            </span>
          </div>

          {/* Criterion 4: Culture Fit & Growth Mindset (20%) */}
          <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
            <div className="flex justify-between text-xs">
              <span className="font-semibold text-white">{t.cultureFit}</span>
              <span className="font-mono font-bold text-indigo-400 text-sm">
                {cultureFitScore}/100
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={cultureFitScore}
              onChange={(e) => setCultureFitScore(Number(e.target.value))}
              className="w-full accent-indigo-500 cursor-pointer"
            />
            <span className="text-[11px] text-slate-400 block">
              Tinh thần chủ động học hỏi, trách nhiệm đồng đội và độ tương thích với giá trị doanh nghiệp.
            </span>
          </div>
        </div>

        {/* Qualitative Notes & Recommendation */}
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Người phỏng vấn chính (Interviewer)
              </label>
              <input
                type="text"
                value={interviewerName}
                onChange={(e) => setInterviewerName(e.target.value)}
                className="w-full px-3.5 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Khuyến nghị của người phỏng vấn
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { id: 'strong_hire', label: 'Strong Hire', color: 'emerald' },
                  { id: 'hire', label: 'Hire', color: 'teal' },
                  { id: 'borderline', label: 'Borderline', color: 'amber' },
                  { id: 'reject', label: 'Reject', color: 'rose' },
                ].map((rec) => (
                  <button
                    key={rec.id}
                    type="button"
                    onClick={() => setRecommendation(rec.id as any)}
                    className={`py-1.5 text-xs font-bold rounded-lg border transition-all ${
                      recommendation === rec.id
                        ? 'bg-indigo-600/30 border-indigo-500 text-indigo-300 shadow-sm'
                        : 'border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {rec.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Ghi chú nhận xét chi tiết buổi phỏng vấn (Interview Observations)
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3.5 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-indigo-500 leading-relaxed font-sans"
            />
          </div>
        </div>

        {/* Save CTA */}
        <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
          <span className="text-xs text-slate-400">
            {savedSuccess ? (
              <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                Đã lưu điểm phỏng vấn và chuyển tiếp sang Trung tâm Quyết định!
              </span>
            ) : (
              'Điểm số sẽ tự động được đồng bộ vào ma trận xếp hạng tuyển dụng.'
            )}
          </span>

          <button
            onClick={handleSaveScorecard}
            className="flex items-center gap-2 px-6 py-2.5 text-xs font-semibold rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white shadow-lg shadow-indigo-600/25 transition-all"
          >
            <Save className="w-4 h-4" />
            <span>{t.saveScorecard}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
