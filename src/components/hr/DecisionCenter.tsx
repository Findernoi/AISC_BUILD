import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Candidate } from '../../types';
import confetti from 'canvas-confetti';
import {
  Award,
  Sliders,
  CheckCircle2,
  FileText,
  Sparkles,
  Trophy,
  X,
  Copy,
  Printer,
  TrendingUp,
} from 'lucide-react';

export const DecisionCenter: React.FC = () => {
  const {
    lang,
    t,
    candidates,
    jobs,
    weights,
    setWeights,
    finalizeDecision,
  } = useApp();

  const [selectedCandidateForOffer, setSelectedCandidateForOffer] = useState<Candidate | null>(null);
  const [copiedSuccess, setCopiedSuccess] = useState(false);

  // Offer Letter configuration state
  const [stipendAmount, setStipendAmount] = useState('15,000,000 VND / tháng');
  const [startDate, setStartDate] = useState('01/11/2026');
  const [mentorName, setMentorName] = useState('Nguyễn Thanh Tùng (Principal AI Engineer)');

  // Filter candidates who have at least reached assessment or final_decision
  // and compute their weighted total score
  const rankedCandidates = candidates
    .map((cand) => {
      const aiScore = cand.aiScreeningReport?.fitScore ?? 60;
      const codingScore = cand.codingSubmission?.aiCodeScore ?? 65;
      const hrScore = cand.hrScorecard?.overallScore ?? 70;

      const totalWeight = weights.aiWeight + weights.codingWeight + weights.hrWeight || 100;
      const weightedScore = Number(
        (
          (aiScore * weights.aiWeight +
            codingScore * weights.codingWeight +
            hrScore * weights.hrWeight) /
          totalWeight
        ).toFixed(1)
      );

      return {
        candidate: cand,
        aiScore,
        codingScore,
        hrScore,
        weightedScore,
      };
    })
    .sort((a, b) => b.weightedScore - a.weightedScore);

  const handleWeightChange = (key: 'aiWeight' | 'codingWeight' | 'hrWeight', val: number) => {
    setWeights((prev) => ({
      ...prev,
      [key]: val,
    }));
  };

  const handleOpenOfferModal = (cand: Candidate) => {
    setSelectedCandidateForOffer(cand);
    // Trigger confetti celebration
    try {
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 },
      });
    } catch {}
  };

  const handleConfirmOffer = () => {
    if (selectedCandidateForOffer) {
      finalizeDecision(selectedCandidateForOffer.id, 'hire');
      try {
        confetti({
          particleCount: 120,
          spread: 80,
          origin: { y: 0.5 },
        });
      } catch {}
    }
  };

  const handleCopyOfferLetter = () => {
    if (!selectedCandidateForOffer) return;
    const targetJob = jobs.find((j) => j.id === selectedCandidateForOffer.jobId);
    const offerContent = `
THƯ MỜI NHẬN VIỆC CHÍNH THỨC (OFFICIAL OFFER LETTER)
TẬP ĐOÀN CÔNG NGHỆ TALENTMATCH AI

Kính gửi: ${selectedCandidateForOffer.fullName}
Email: ${selectedCandidateForOffer.email}
Trường: ${selectedCandidateForOffer.university}

Chúng tôi trân trọng chúc mừng bạn đã xuất sắc vượt qua các vòng sàng lọc AI, bài kiểm tra thuật toán và phỏng vấn chuyên môn để chính thức trở thành:

Vị trí: ${targetJob?.title || 'Kỹ sư Phần mềm / AI'}
Phòng ban: ${targetJob?.department || 'R&D Innovation Lab'}
Mức phụ cấp thực tập & đào tạo: ${stipendAmount}
Ngày bắt đầu làm việc: ${startDate}
Kỹ sư cố vấn hướng dẫn (Mentor): ${mentorName}
Địa điểm: ${targetJob?.location || 'Trụ sở TP. Hồ Chí Minh'}

Vui lòng xác nhận thư mời này trong vòng 5 ngày làm việc.
Trân trọng,
Hội Đồng Tuyển Dụng TalentMatch AI
    `;

    navigator.clipboard.writeText(offerContent.trim());
    setCopiedSuccess(true);
    setTimeout(() => setCopiedSuccess(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-400" />
            <h1 className="text-xl font-bold text-white">{t.decisionCenterTitle}</h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">{t.decisionWeightsDesc}</p>
        </div>
      </div>

      {/* Weighted Scoring Configuration Sliders */}
      <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 text-xs">
          <div className="flex items-center gap-2 font-bold text-white">
            <Sliders className="w-4 h-4 text-indigo-400" />
            <span>Tùy Chỉnh Ma Trận Trọng Số Tuyển Dụng (Weighted Decision Matrix)</span>
          </div>
          <span className="font-mono text-slate-400">
            Tổng tỷ trọng: {weights.aiWeight + weights.codingWeight + weights.hrWeight}%
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* AI Screening Weight */}
          <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
            <div className="flex justify-between text-xs">
              <span className="font-semibold text-white">{t.aiWeightLabel}</span>
              <span className="font-mono font-bold text-indigo-400">{weights.aiWeight}%</span>
            </div>
            <input
              type="range"
              min={10}
              max={60}
              step={5}
              value={weights.aiWeight}
              onChange={(e) => handleWeightChange('aiWeight', Number(e.target.value))}
              className="w-full accent-indigo-500 cursor-pointer"
            />
            <span className="text-[11px] text-slate-400 block">
              Dựa trên điểm phù hợp hồ sơ học thuật, GPA và kỹ năng AI bóc tách.
            </span>
          </div>

          {/* Coding Test Weight */}
          <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
            <div className="flex justify-between text-xs">
              <span className="font-semibold text-white">{t.codingWeightLabel}</span>
              <span className="font-mono font-bold text-emerald-400">
                {weights.codingWeight}%
              </span>
            </div>
            <input
              type="range"
              min={10}
              max={60}
              step={5}
              value={weights.codingWeight}
              onChange={(e) => handleWeightChange('codingWeight', Number(e.target.value))}
              className="w-full accent-emerald-500 cursor-pointer"
            />
            <span className="text-[11px] text-slate-400 block">
              Dựa trên số lượng unit test vượt qua, độ phức tạp và chất lượng code.
            </span>
          </div>

          {/* HR Interview Weight */}
          <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
            <div className="flex justify-between text-xs">
              <span className="font-semibold text-white">{t.hrWeightLabel}</span>
              <span className="font-mono font-bold text-teal-400">{weights.hrWeight}%</span>
            </div>
            <input
              type="range"
              min={10}
              max={60}
              step={5}
              value={weights.hrWeight}
              onChange={(e) => handleWeightChange('hrWeight', Number(e.target.value))}
              className="w-full accent-teal-500 cursor-pointer"
            />
            <span className="text-[11px] text-slate-400 block">
              Dựa trên tư duy giải quyết vấn đề, giao tiếp và độ phù hợp văn hóa.
            </span>
          </div>
        </div>
      </div>

      {/* Ranked Candidate Leaderboard */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 bg-slate-950/90 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Bảng Xếp Hạng Ứng Viên Toàn Diện (Candidate Composite Leaderboard)
            </h3>
          </div>
          <span className="text-xs text-slate-400">
            Tự động cập nhật xếp hạng theo thời gian thực
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 uppercase font-mono tracking-wider">
              <tr>
                <th className="py-3 px-4 text-center">{t.rank}</th>
                <th className="py-3 px-4">{t.fullName}</th>
                <th className="py-3 px-4">{lang === 'vi' ? 'Vị Trí Ứng Tuyển' : 'Target Role'}</th>
                <th className="py-3 px-4">{t.university}</th>
                <th className="py-3 px-4 text-center">AI Fit ({weights.aiWeight}%)</th>
                <th className="py-3 px-4 text-center">Coding ({weights.codingWeight}%)</th>
                <th className="py-3 px-4 text-center">HR ({weights.hrWeight}%)</th>
                <th className="py-3 px-4 text-center">{t.weightedTotalScore}</th>
                <th className="py-3 px-4 text-center">Trạng Thái</th>
                <th className="py-3 px-4 text-right">Quyết Định</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 text-slate-300">
              {rankedCandidates.map(({ candidate: cand, aiScore, codingScore, hrScore, weightedScore }, idx) => {
                const targetJob = jobs.find((j) => j.id === cand.jobId);
                const isTop1 = idx === 0;
                const isOffered = cand.finalDecision === 'hire';

                return (
                  <tr
                    key={cand.id}
                    className={`hover:bg-slate-800/40 transition-colors ${
                      isTop1 ? 'bg-indigo-950/20' : ''
                    }`}
                  >
                    {/* Rank */}
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center">
                        {isTop1 ? (
                          <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono font-bold flex items-center justify-center text-xs">
                            1
                          </div>
                        ) : idx === 1 ? (
                          <div className="w-6 h-6 rounded-full bg-slate-700 text-slate-200 font-mono font-bold flex items-center justify-center text-xs">
                            2
                          </div>
                        ) : idx === 2 ? (
                          <div className="w-6 h-6 rounded-full bg-amber-900/40 text-amber-400 font-mono font-bold flex items-center justify-center text-xs">
                            3
                          </div>
                        ) : (
                          <span className="font-mono text-slate-500">{idx + 1}</span>
                        )}
                      </div>
                    </td>

                    {/* Candidate Name & Info */}
                    <td className="py-3 px-4">
                      <div className="font-bold text-white flex items-center gap-2">
                        <span>{cand.fullName}</span>
                        {isTop1 && (
                          <span className="px-1.5 py-0.2 text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded font-semibold">
                            Top Match
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono">{cand.email}</div>
                    </td>

                    <td className="py-3 px-4 text-slate-300 max-w-[170px] truncate">
                      {targetJob?.title || 'Kỹ sư'}
                    </td>

                    <td className="py-3 px-4 text-slate-300 max-w-[180px] truncate">
                      {cand.university}
                    </td>

                    <td className="py-3 px-4 text-center font-mono font-semibold text-indigo-400">
                      {aiScore}%
                    </td>

                    <td className="py-3 px-4 text-center font-mono font-semibold text-emerald-400">
                      {codingScore}/100
                    </td>

                    <td className="py-3 px-4 text-center font-mono font-semibold text-teal-400">
                      {hrScore}/100
                    </td>

                    {/* Weighted Total Score */}
                    <td className="py-3 px-4 text-center">
                      <span className="font-mono font-extrabold text-sm text-white bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
                        {weightedScore}
                      </span>
                    </td>

                    {/* Status Badge */}
                    <td className="py-3 px-4 text-center">
                      {isOffered ? (
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          Đã Gửi Offer
                        </span>
                      ) : cand.status === 'passed' ? (
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                          Đủ Điều Kiện
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-800 text-slate-400">
                          Đang Xét
                        </span>
                      )}
                    </td>

                    {/* Action Button: Extend Offer */}
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleOpenOfferModal(cand)}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all ${
                          isOffered
                            ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                            : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-md shadow-emerald-600/20'
                        }`}
                      >
                        {isOffered ? 'Xem Offer' : t.actionExtendOffer}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Official Offer Letter Generator Modal */}
      {selectedCandidateForOffer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 sm:p-8 my-8 text-slate-100 space-y-5">
            <div className="flex items-start justify-between pb-4 border-b border-slate-800">
              <div>
                <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider block">
                  {lang === 'vi' ? 'Quyết Định Tuyển Dụng Chính Thức' : 'Official Hiring Decision'}
                </span>
                <h2 className="text-xl font-bold text-white mt-0.5">
                  Thư Mời Nhận Việc (Job Offer Letter)
                </h2>
              </div>
              <button
                onClick={() => setSelectedCandidateForOffer(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Offer Letter Document Preview */}
            <div className="p-6 bg-slate-950 border border-slate-800 rounded-xl space-y-4 text-xs font-sans leading-relaxed text-slate-300">
              <div className="flex items-center justify-between border-b border-slate-900 pb-3">
                <span className="font-bold text-white text-sm">TALENTMATCH AI ENTERPRISE</span>
                <span className="font-mono text-slate-400">Ref: OFFER-{selectedCandidateForOffer.id}</span>
              </div>

              <div>
                <p>
                  Kính gửi: <b>{selectedCandidateForOffer.fullName}</b>
                </p>
                <p>
                  Email: {selectedCandidateForOffer.email} · Trường: {selectedCandidateForOffer.university}
                </p>
              </div>

              <p>
                Hội đồng tuyển dụng và phòng Kỹ thuật trân trọng thông báo bạn đã đạt kết quả xuất sắc trong toàn bộ quy trình sàng lọc và phỏng vấn. Chúng tôi vui mừng gửi đến bạn lời mời gia nhập đội ngũ:
              </p>

              <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-lg space-y-2 font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-400">Vị trí thực tập:</span>
                  <span className="font-bold text-white">
                    {jobs.find((j) => j.id === selectedCandidateForOffer.jobId)?.title}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Mức phụ cấp & lương đào tạo:</span>
                  <span className="font-bold text-emerald-400">{stipendAmount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Ngày bắt đầu dự kiến:</span>
                  <span className="font-bold text-white">{startDate}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Mentor hướng dẫn:</span>
                  <span className="text-indigo-300">{mentorName}</span>
                </div>
              </div>

              <p className="text-slate-400 text-[11px]">
                * Ứng viên có thời hạn phản hồi và ký kết thỏa thuận trong vòng 05 ngày kể từ ngày nhận thông báo.
              </p>
            </div>

            {/* Config inputs for HR customization */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Mức phụ cấp / Lương tháng:</label>
                <input
                  type="text"
                  value={stipendAmount}
                  onChange={(e) => setStipendAmount(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-white"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Ngày bắt đầu nhận việc:</label>
                <input
                  type="text"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-white"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
              <button
                onClick={handleCopyOfferLetter}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-xl border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{copiedSuccess ? 'Đã sao chép nội dung!' : 'Sao chép văn bản'}</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedCandidateForOffer(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white"
                >
                  Đóng
                </button>
                <button
                  onClick={() => {
                    handleConfirmOffer();
                    setSelectedCandidateForOffer(null);
                  }}
                  className="flex items-center gap-1.5 px-5 py-2 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30 transition-all"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Xác Nhận & Gửi Offer Chính Thức</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
