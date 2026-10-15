import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { Candidate } from '../../types';
import {
  Users,
  Sparkles,
  Award,
  CheckCircle2,
  Search,
  Filter,
  Kanban,
  Table as TableIcon,
  ArrowRight,
  Send,
  Eye,
  GraduationCap,
} from 'lucide-react';

interface CandidatePipelineProps {
  onSelectCandidateForAi: (candidateId: string) => void;
  onSelectCandidateForAssessment: (candidateId: string) => void;
  onSelectCandidateForDecision: (candidateId: string) => void;
}

export const CandidatePipeline: React.FC<CandidatePipelineProps> = ({
  onSelectCandidateForAi,
  onSelectCandidateForAssessment,
  onSelectCandidateForDecision,
}) => {
  const {
    lang,
    t,
    candidates,
    jobs,
    batchInviteToRound2,
    runAiScreening,
  } = useApp();

  const [viewMode, setViewMode] = useState<'kanban' | 'table'>('kanban');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedJobFilter, setSelectedJobFilter] = useState('all');
  const [selectedUniFilter, setSelectedUniFilter] = useState('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('all');
  const [batchInvitedMessage, setBatchInvitedMessage] = useState<string | null>(null);

  // Statistics calculation
  const totalCount = candidates.length;
  const screenedCount = candidates.filter((c) => c.stage !== 'applied').length;
  const round2Count = candidates.filter(
    (c) => c.stage === 'assessment' || c.stage === 'final_decision'
  ).length;
  const offerCount = candidates.filter((c) => c.finalDecision === 'hire').length;

  // Filter candidates
  const filteredCandidates = useMemo(() => {
    return candidates.filter((c) => {
      const matchSearch =
        c.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.university.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.techBadges.some((b) => b.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchJob = selectedJobFilter === 'all' || c.jobId === selectedJobFilter;
      const matchUni =
        selectedUniFilter === 'all' ||
        c.university.toLowerCase().includes(selectedUniFilter.toLowerCase());
      const matchStatus =
        selectedStatusFilter === 'all' || c.status === selectedStatusFilter;

      return matchSearch && matchJob && matchUni && matchStatus;
    });
  }, [candidates, searchQuery, selectedJobFilter, selectedUniFilter, selectedStatusFilter]);

  // Candidates qualified for batch invite: fitScore >= 75 in applied or ai_screening stage
  const qualifiedForRound2 = candidates.filter(
    (c) =>
      (c.stage === 'applied' || c.stage === 'ai_screening') &&
      (c.aiScreeningReport?.fitScore ?? 0) >= 75
  );

  const handleBatchInvite = () => {
    const ids = qualifiedForRound2.map((c) => c.id);
    if (ids.length === 0) {
      alert(
        lang === 'vi'
          ? 'Không có ứng viên nào đạt điểm AI ≥ 75% đang chờ mời.'
          : 'No pending candidates with AI fit score ≥ 75%.'
      );
      return;
    }
    batchInviteToRound2(ids);
    setBatchInvitedMessage(
      lang === 'vi'
        ? `Đã gửi thư mời Vòng 2 cho ${ids.length} ứng viên xuất sắc!`
        : `Invited ${ids.length} qualified candidates to Round 2!`
    );
    setTimeout(() => setBatchInvitedMessage(null), 4000);
  };

  const STAGES: { id: Candidate['stage']; title: string; count: number }[] = [
    {
      id: 'applied',
      title: lang === 'vi' ? 'Mới Ứng Tuyển' : 'New Applications',
      count: filteredCandidates.filter((c) => c.stage === 'applied').length,
    },
    {
      id: 'ai_screening',
      title: lang === 'vi' ? 'Sàng Lọc Bằng AI' : 'AI Screening Studio',
      count: filteredCandidates.filter((c) => c.stage === 'ai_screening').length,
    },
    {
      id: 'assessment',
      title: lang === 'vi' ? 'Vòng 2: Test & Phỏng Vấn' : 'Round 2: Test & Interview',
      count: filteredCandidates.filter((c) => c.stage === 'assessment').length,
    },
    {
      id: 'final_decision',
      title: lang === 'vi' ? 'Quyết Định Tuyển Dụng' : 'Hiring Decisions',
      count: filteredCandidates.filter((c) => c.stage === 'final_decision').length,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top 4 Metric KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 font-medium block">{t.totalCandidates}</span>
            <span className="text-2xl font-bold font-mono text-white mt-1 block">
              {totalCount}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-800 text-slate-300 flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 font-medium block">{t.screenedByAi}</span>
            <span className="text-2xl font-bold font-mono text-indigo-400 mt-1 block">
              {screenedCount}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center border border-indigo-500/20">
            <Sparkles className="w-5 h-5" />
          </div>
        </div>

        <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 font-medium block">{t.readyForRound2}</span>
            <span className="text-2xl font-bold font-mono text-emerald-400 mt-1 block">
              {round2Count}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-600/20 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
            <Award className="w-5 h-5" />
          </div>
        </div>

        <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 font-medium block">{t.offersExtended}</span>
            <span className="text-2xl font-bold font-mono text-teal-300 mt-1 block">
              {offerCount}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-teal-600/20 text-teal-400 flex items-center justify-center border border-teal-500/20">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Control Bar: Filters, Search, View Switcher, Batch Action */}
      <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Left side: Search & Dropdowns */}
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          <div className="relative min-w-[220px] flex-1">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.searchPlaceholder}
              className="w-full pl-9 pr-3.5 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-indigo-500 placeholder:text-slate-500"
            />
          </div>

          <select
            value={selectedJobFilter}
            onChange={(e) => setSelectedJobFilter(e.target.value)}
            className="px-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-xl text-slate-300 focus:outline-none focus:border-indigo-500"
          >
            <option value="all">{lang === 'vi' ? 'Tất cả vị trí' : 'All Roles'}</option>
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.title}
              </option>
            ))}
          </select>

          <select
            value={selectedUniFilter}
            onChange={(e) => setSelectedUniFilter(e.target.value)}
            className="px-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-xl text-slate-300 focus:outline-none focus:border-indigo-500"
          >
            <option value="all">{lang === 'vi' ? 'Tất cả trường ĐH' : 'All Universities'}</option>
            <option value="uit">UIT (ĐH CNTT)</option>
            <option value="bách khoa">ĐH Bách Khoa</option>
            <option value="tự nhiên">ĐH KHTN</option>
            <option value="hust">HUST (Hà Nội)</option>
            <option value="fpt">ĐH FPT</option>
          </select>
        </div>

        {/* Right side: View Mode & 1-Click Batch Invite */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleBatchInvite}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white shadow-md shadow-indigo-600/20 transition-all whitespace-nowrap shrink-0"
            title="Mời tự động tất cả ứng viên có AI Score ≥ 75% vào Vòng 2"
          >
            <Send className="w-3.5 h-3.5" />
            <span>
              {t.btnBatchInvite} ({qualifiedForRound2.length})
            </span>
          </button>

          <div className="flex items-center p-1 bg-slate-950 border border-slate-800 rounded-xl">
            <button
              onClick={() => setViewMode('kanban')}
              className={`p-1.5 rounded-lg text-xs transition-colors ${
                viewMode === 'kanban'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Chế độ Kanban"
            >
              <Kanban className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg text-xs transition-colors ${
                viewMode === 'table'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Chế độ Bảng dữ liệu"
            >
              <TableIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Batch Invite notification toast */}
      {batchInvitedMessage && (
        <div className="p-3 bg-emerald-950/40 border border-emerald-800 text-emerald-300 text-xs font-medium rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{batchInvitedMessage}</span>
          </div>
          <button
            onClick={() => setBatchInvitedMessage(null)}
            className="text-slate-400 hover:text-white"
          >
            ✕
          </button>
        </div>
      )}

      {/* Kanban View */}
      {viewMode === 'kanban' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
          {STAGES.map((col) => {
            const colCandidates = filteredCandidates.filter((c) => c.stage === col.id);

            return (
              <div
                key={col.id}
                className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-col gap-3 min-h-[500px]"
              >
                {/* Column Header */}
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                    {col.title}
                  </h4>
                  <span className="px-2 py-0.5 text-xs font-mono font-bold bg-slate-800 text-slate-300 rounded-md">
                    {colCandidates.length}
                  </span>
                </div>

                {/* Candidate Cards */}
                <div className="space-y-3">
                  {colCandidates.map((cand) => {
                    const job = jobs.find((j) => j.id === cand.jobId);
                    const fitScore = cand.aiScreeningReport?.fitScore;

                    return (
                      <div
                        key={cand.id}
                        className="bg-slate-950 border border-slate-800 hover:border-indigo-500/40 rounded-xl p-3.5 space-y-2.5 transition-all shadow-sm hover:shadow-indigo-500/5 group"
                      >
                        {/* Name & AI Score */}
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h5 className="text-xs font-bold text-white group-hover:text-indigo-300 transition-colors">
                              {cand.fullName}
                            </h5>
                            <span className="text-[11px] text-slate-400 block truncate max-w-[160px]">
                              {cand.university}
                            </span>
                          </div>

                          {fitScore !== undefined ? (
                            <span
                              className={`px-2 py-0.5 text-xs font-mono font-bold rounded-md shrink-0 ${
                                fitScore >= 85
                                  ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/60'
                                  : fitScore >= 70
                                  ? 'bg-indigo-950/60 text-indigo-300 border border-indigo-800/60'
                                  : 'bg-amber-950/60 text-amber-300 border border-amber-800/60'
                              }`}
                            >
                              {fitScore}%
                            </span>
                          ) : (
                            <button
                              onClick={() => runAiScreening(cand.id)}
                              className="text-[10px] text-indigo-400 hover:text-indigo-300 bg-indigo-950/40 border border-indigo-800/40 px-1.5 py-0.5 rounded"
                              title="Chạy phân tích AI"
                            >
                              AI Screen
                            </button>
                          )}
                        </div>

                        {/* GPA & English */}
                        <div className="flex items-center gap-2 text-[11px] text-slate-400">
                          <span>
                            GPA:{' '}
                            <b className="text-slate-200 font-mono">
                              {cand.gpa}/{cand.gpaScale || '4.0'}
                            </b>
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>
                            {cand.englishCert?.type}:{' '}
                            <b className="text-slate-200 font-mono">
                              {cand.englishCert?.score || 'N/A'}
                            </b>
                          </span>
                        </div>

                        {/* Target Role */}
                        <div className="text-[11px] text-slate-400 truncate">
                          {job?.title || 'Kỹ sư'}
                        </div>

                        {/* Contextual Action Button */}
                        <div className="pt-2 border-t border-slate-900 flex items-center justify-between">
                          <button
                            onClick={() => onSelectCandidateForAi(cand.id)}
                            className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium"
                          >
                            <Eye className="w-3 h-3" />
                            <span>{lang === 'vi' ? 'Hồ sơ AI' : 'AI Profile'}</span>
                          </button>

                          {cand.stage === 'assessment' && (
                            <button
                              onClick={() => onSelectCandidateForAssessment(cand.id)}
                              className="text-[11px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-medium"
                            >
                              <span>{lang === 'vi' ? 'Chấm điểm' : 'Score'}</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          )}

                          {cand.stage === 'final_decision' && (
                            <button
                              onClick={() => onSelectCandidateForDecision(cand.id)}
                              className="text-[11px] text-teal-300 hover:text-teal-200 flex items-center gap-1 font-medium"
                            >
                              <span>{lang === 'vi' ? 'Xét tuyển' : 'Decision'}</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {colCandidates.length === 0 && (
                    <div className="py-8 text-center text-xs text-slate-500 italic">
                      {lang === 'vi' ? 'Chưa có ứng viên ở giai đoạn này' : 'No candidates'}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Table View */}
      {viewMode === 'table' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 uppercase font-mono tracking-wider">
                <tr>
                  <th className="py-3 px-4">{t.fullName}</th>
                  <th className="py-3 px-4">{lang === 'vi' ? 'Vị Trí' : 'Role'}</th>
                  <th className="py-3 px-4">{t.university}</th>
                  <th className="py-3 px-4 text-right">GPA</th>
                  <th className="py-3 px-4">Ngoại Ngữ</th>
                  <th className="py-3 px-4 text-center">AI Fit</th>
                  <th className="py-3 px-4 text-center">Coding</th>
                  <th className="py-3 px-4 text-center">HR Score</th>
                  <th className="py-3 px-4 text-center">Giai Đoạn</th>
                  <th className="py-3 px-4 text-right">{lang === 'vi' ? 'Thao Tác' : 'Action'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 text-slate-300">
                {filteredCandidates.map((cand) => {
                  const job = jobs.find((j) => j.id === cand.jobId);

                  return (
                    <tr
                      key={cand.id}
                      className="hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <div className="font-bold text-white">{cand.fullName}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{cand.email}</div>
                      </td>
                      <td className="py-3 px-4 text-slate-300 max-w-[160px] truncate">
                        {job?.title || 'Software Intern'}
                      </td>
                      <td className="py-3 px-4 text-slate-300 max-w-[180px] truncate">
                        {cand.university}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-indigo-300">
                        {cand.gpa}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-300">
                        {cand.englishCert?.type} {cand.englishCert?.score}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {cand.aiScreeningReport ? (
                          <span className="font-mono font-bold text-emerald-400">
                            {cand.aiScreeningReport.fitScore}%
                          </span>
                        ) : (
                          <span className="text-slate-500 font-mono">--</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {cand.codingSubmission ? (
                          <span className="font-mono font-bold text-indigo-300">
                            {cand.codingSubmission.aiCodeScore}/100
                          </span>
                        ) : (
                          <span className="text-slate-500 font-mono">--</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {cand.hrScorecard ? (
                          <span className="font-mono font-bold text-teal-300">
                            {cand.hrScorecard.overallScore}/100
                          </span>
                        ) : (
                          <span className="text-slate-500 font-mono">--</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-950 border border-slate-800 text-slate-300">
                          {cand.stage}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => onSelectCandidateForAi(cand.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                            title="Xem chi tiết phân tích AI"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onSelectCandidateForAssessment(cand.id)}
                            className="p-1.5 rounded-lg text-indigo-400 hover:text-indigo-300 hover:bg-slate-800"
                            title="Đánh giá Vòng 2 & Phỏng vấn"
                          >
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
