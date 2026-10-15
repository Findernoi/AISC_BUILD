import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { JobPosting, EnglishCert } from '../../types';
import { X, Check, Upload, ArrowRight, ArrowLeft, FileText, CheckCircle2 } from 'lucide-react';

interface ApplyModalProps {
  job: JobPosting;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (candidateId: string) => void;
}

const TOP_UNIVERSITIES = [
  'Trường ĐH Công nghệ Thông tin - ĐHQG-HCM (UIT)',
  'Trường ĐH Bách Khoa - ĐHQG-HCM (HCMUT)',
  'Trường ĐH Khoa học Tự nhiên - ĐHQG-HCM (HCMUS)',
  'Đại học Bách Khoa Hà Nội (HUST)',
  'Trường ĐH Công nghệ - ĐHQG Hà Nội (UET)',
  'Đại học FPT',
  'Học viện Công nghệ Bưu chính Viễn thông (PTIT)',
  'Đại học Kinh tế Quốc dân (NEU)',
  'Trường ĐH Ngoại Thương (FTU)',
];

const SUGGESTED_SKILLS = [
  'Python',
  'PyTorch',
  'LangChain',
  'RAG Systems',
  'React',
  'TypeScript',
  'Next.js',
  'Tailwind CSS',
  'Node.js',
  'Express',
  'PostgreSQL',
  'Docker',
  'Redis',
  'Git',
];

export const ApplyModal: React.FC<ApplyModalProps> = ({ job, isOpen, onClose, onSuccess }) => {
  const { lang, t, applyCandidate } = useApp();

  const [step, setStep] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [createdCandidateId, setCreatedCandidateId] = useState<string | null>(null);

  // Form State
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [githubUrl, setGithubUrl] = useState('');

  const [university, setUniversity] = useState(TOP_UNIVERSITIES[0]);
  const [customUni, setCustomUni] = useState('');
  const [major, setMajor] = useState('Khoa học Máy tính / Trí tuệ Nhân tạo');
  const [graduationYear, setGraduationYear] = useState<number>(2026);
  const [gpa, setGpa] = useState<string>('3.6');
  const [gpaScale, setGpaScale] = useState<'4.0' | '10'>('4.0');

  const [achievements, setAchievements] = useState('');
  const [englishType, setEnglishType] = useState<EnglishCert['type']>('IELTS');
  const [englishScore, setEnglishScore] = useState('7.0');
  const [techBadges, setTechBadges] = useState<string[]>(['Python', 'PyTorch', 'Git']);

  const [cvFileName, setCvFileName] = useState<string>('');
  const [cvSummary, setCvSummary] = useState<string>('');

  if (!isOpen) return null;

  const handleToggleSkill = (skill: string) => {
    if (techBadges.includes(skill)) {
      setTechBadges(techBadges.filter((s) => s !== skill));
    } else {
      setTechBadges([...techBadges, skill]);
    }
  };

  const handleSimulateCvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCvFileName(file.name);
      setCvSummary(
        lang === 'vi'
          ? `Hồ sơ CV tự động trích xuất: ${fullName || 'Ứng viên'} tốt nghiệp ${university}. GPA: ${gpa}/${gpaScale}. Kỹ năng cốt lõi: ${techBadges.join(', ')}. Chứng chỉ ngoại ngữ: ${englishType} ${englishScore}. Có kinh nghiệm thực hiện các bài toán lập trình và dự án đồ án.`
          : `Extracted CV summary: ${fullName || 'Candidate'}, attending ${university}. GPA: ${gpa}/${gpaScale}. Core proficiencies: ${techBadges.join(', ')}. English qualification: ${englishType} ${englishScore}. Demonstrates hands-on project implementations.`
      );
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    setTimeout(() => {
      const finalUni = university === 'Khác' ? customUni || 'Đại học' : university;
      const candidate = applyCandidate({
        jobId: job.id,
        fullName: fullName || 'Nguyễn Văn A',
        email: email || 'candidate@example.com',
        phone: phone || '0901 234 567',
        linkedinUrl: linkedinUrl || 'https://linkedin.com',
        githubUrl: githubUrl || 'https://github.com',
        university: finalUni,
        major: major || 'Công nghệ Thông tin',
        graduationYear: Number(graduationYear) || 2026,
        gpa: parseFloat(gpa) || 3.5,
        gpaScale,
        achievements: achievements || 'Đạt thành tích học tập tốt.',
        englishCert: {
          type: englishType,
          score: englishScore,
        },
        techBadges,
        cvFileName: cvFileName || `${fullName.replace(/\s+/g, '_')}_CV.pdf`,
        cvSummary: cvSummary || `Hồ sơ ứng viên ${fullName} nộp cho vị trí ${job.title}. GPA ${gpa}/${gpaScale}.`,
      });

      setIsSubmitting(false);
      setCreatedCandidateId(candidate.id);
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 sm:p-8 my-8 text-slate-100">
        {/* Header */}
        <div className="flex items-start justify-between pb-5 border-b border-slate-800">
          <div>
            <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider block mb-1">
              {lang === 'vi' ? 'Đơn Ứng Tuyển Trực Tuyến' : 'Online Job Application'}
            </span>
            <h2 className="text-xl font-bold text-white">{job.title}</h2>
            <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
              <span>{job.department}</span>
              <span aria-hidden="true">·</span>
              <span>{job.location}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Progression (4 steps) */}
        {!createdCandidateId && (
          <div className="py-4 border-b border-slate-800/80 mb-6">
            <div className="flex items-center justify-between text-xs font-medium text-slate-400">
              <span className={step >= 1 ? 'text-indigo-400 font-semibold' : ''}>{t.stepBasic}</span>
              <span className={step >= 2 ? 'text-indigo-400 font-semibold' : ''}>{t.stepEducation}</span>
              <span className={step >= 3 ? 'text-indigo-400 font-semibold' : ''}>{t.stepCertificates}</span>
              <span className={step >= 4 ? 'text-indigo-400 font-semibold' : ''}>{t.stepCv}</span>
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
              <div
                className="bg-indigo-500 h-full transition-all duration-300 rounded-full"
                style={{ width: `${(step / 4) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Success Screen */}
        {createdCandidateId ? (
          <div className="py-8 text-center space-y-4">
            <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto ring-8 ring-emerald-500/10">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h3 className="text-2xl font-bold text-white">
              {lang === 'vi' ? 'Nộp Đơn Ứng Tuyển Thành Công!' : 'Application Submitted!'}
            </h3>
            <p className="text-sm text-slate-300 max-w-md mx-auto">
              {t.appliedSuccess}{' '}
              <span className="font-mono font-bold text-indigo-400">{createdCandidateId}</span>. Hệ thống TalentMatch AI sẽ tiến hành phân tích hồ sơ và thông báo kết quả cho bạn.
            </p>
            <div className="pt-4 flex justify-center gap-3">
              <button
                onClick={() => {
                  onSuccess(createdCandidateId);
                  onClose();
                }}
                className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition-colors shadow-lg shadow-indigo-600/25"
              >
                {lang === 'vi' ? 'Xem Tiến Trình Hồ Sơ' : 'View My Application'}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {/* Step 1: Basic Information */}
            {step === 1 && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">{t.fullName} *</label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Nguyễn Văn A"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">{t.email} *</label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@gm.uit.edu.vn"
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">{t.phone} *</label>
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="0912 345 678"
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">LinkedIn Profile</label>
                    <input
                      type="url"
                      value={linkedinUrl}
                      onChange={(e) => setLinkedinUrl(e.target.value)}
                      placeholder="https://linkedin.com/in/username"
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">GitHub Portfolio</label>
                    <input
                      type="url"
                      value={githubUrl}
                      onChange={(e) => setGithubUrl(e.target.value)}
                      placeholder="https://github.com/username"
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Academic Background */}
            {step === 2 && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">{t.university} *</label>
                  <select
                    value={university}
                    onChange={(e) => setUniversity(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
                  >
                    {TOP_UNIVERSITIES.map((uni) => (
                      <option key={uni} value={uni}>
                        {uni}
                      </option>
                    ))}
                    <option value="Khác">{lang === 'vi' ? 'Trường đại học khác...' : 'Other university...'}</option>
                  </select>
                </div>
                {university === 'Khác' && (
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      {lang === 'vi' ? 'Tên trường đại học của bạn' : 'Your University Name'}
                    </label>
                    <input
                      type="text"
                      value={customUni}
                      onChange={(e) => setCustomUni(e.target.value)}
                      placeholder="Đại học Sư phạm Kỹ thuật TP.HCM..."
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">{t.major} *</label>
                    <input
                      type="text"
                      required
                      value={major}
                      onChange={(e) => setMajor(e.target.value)}
                      placeholder="Kỹ thuật Phần mềm / CNTT"
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">{t.gradYear} *</label>
                    <select
                      value={graduationYear}
                      onChange={(e) => setGraduationYear(Number(e.target.value))}
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
                    >
                      <option value={2025}>2025</option>
                      <option value={2026}>2026 (Năm cuối)</option>
                      <option value={2027}>2027 (Năm ba)</option>
                      <option value={2028}>2028</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">{t.gpaScale}</label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setGpaScale('4.0')}
                        className={`flex-1 py-2 text-xs font-medium rounded-lg border transition-colors ${
                          gpaScale === '4.0'
                            ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300'
                            : 'border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Thang điểm 4.0
                      </button>
                      <button
                        type="button"
                        onClick={() => setGpaScale('10')}
                        className={`flex-1 py-2 text-xs font-medium rounded-lg border transition-colors ${
                          gpaScale === '10'
                            ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300'
                            : 'border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Thang điểm 10
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">{t.gpaScore} *</label>
                    <input
                      type="number"
                      step="0.01"
                      min={0}
                      max={gpaScale === '4.0' ? 4.0 : 10}
                      required
                      value={gpa}
                      onChange={(e) => setGpa(e.target.value)}
                      placeholder={gpaScale === '4.0' ? '3.50' : '8.50'}
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm font-mono text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Achievements & Certifications */}
            {step === 3 && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">{t.englishCertType}</label>
                    <select
                      value={englishType}
                      onChange={(e) => setEnglishType(e.target.value as any)}
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
                    >
                      <option value="IELTS">IELTS</option>
                      <option value="TOEIC">TOEIC</option>
                      <option value="TOEFL">TOEFL iBT</option>
                      <option value="VSTEP">VSTEP</option>
                      <option value="None">Chưa có chứng chỉ</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">{t.englishScore}</label>
                    <input
                      type="text"
                      value={englishScore}
                      disabled={englishType === 'None'}
                      onChange={(e) => setEnglishScore(e.target.value)}
                      placeholder={englishType === 'IELTS' ? '7.0' : englishType === 'TOEIC' ? '850' : 'B2'}
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm font-mono text-white focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">{t.skillsBadgesLabel}</label>
                  <div className="flex flex-wrap gap-1.5 p-3 bg-slate-950 border border-slate-800 rounded-xl max-h-36 overflow-y-auto">
                    {SUGGESTED_SKILLS.map((skill) => {
                      const isSelected = techBadges.includes(skill);
                      return (
                        <button
                          key={skill}
                          type="button"
                          onClick={() => handleToggleSkill(skill)}
                          className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-all ${
                            isSelected
                              ? 'bg-indigo-600/30 border-indigo-500 text-indigo-300 shadow-sm'
                              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {isSelected ? '✓ ' : '+ '}
                          {skill}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">{t.achievementsLabel}</label>
                  <textarea
                    rows={3}
                    value={achievements}
                    onChange={(e) => setAchievements(e.target.value)}
                    placeholder="Giải thưởng học thuật, học bổng xuất sắc, hackathon, nghiên cứu khoa học..."
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
            )}

            {/* Step 4: CV Upload & Confirmation */}
            {step === 4 && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">{t.cvUploadLabel} *</label>
                  <div className="relative border-2 border-dashed border-slate-800 hover:border-indigo-500/50 rounded-2xl p-6 text-center bg-slate-950/60 transition-colors">
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx"
                      onChange={handleSimulateCvUpload}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-12 h-12 rounded-full bg-indigo-600/20 text-indigo-400 flex items-center justify-center">
                        <Upload className="w-6 h-6" />
                      </div>
                      <span className="text-sm font-medium text-white">{t.dragDropCv}</span>
                      <span className="text-xs text-slate-400">PDF, DOCX (Tối đa 15MB)</span>
                    </div>
                  </div>
                </div>

                {cvFileName && (
                  <div className="p-3.5 bg-indigo-950/30 border border-indigo-800/40 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <FileText className="w-5 h-5 text-indigo-400" />
                      <div>
                        <span className="text-xs font-medium text-white block">{cvFileName}</span>
                        <span className="text-[11px] text-emerald-400">
                          {lang === 'vi' ? 'Đã tải lên & sẵn sàng để AI phân tích' : 'Uploaded & parsed'}
                        </span>
                      </div>
                    </div>
                    <Check className="w-4 h-4 text-emerald-400" />
                  </div>
                )}

                {/* Brief Confirmation summary */}
                <div className="p-4 bg-slate-950 border border-slate-800/80 rounded-xl text-xs space-y-1.5 text-slate-300">
                  <div className="flex justify-between">
                    <span className="text-slate-400">{t.fullName}:</span>
                    <span className="font-semibold text-white">{fullName || 'Chưa điền'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">{t.university}:</span>
                    <span className="text-white">{university}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">GPA:</span>
                    <span className="font-mono text-indigo-300 font-semibold">{gpa}/{gpaScale}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">{t.englishCertType}:</span>
                    <span className="font-mono text-white">{englishType} {englishScore}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex items-center justify-between pt-6 border-t border-slate-800 mt-6">
              {step > 1 ? (
                <button
                  type="button"
                  onClick={() => setStep(step - 1)}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-xl border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>{t.btnPrevious}</span>
                </button>
              ) : (
                <div />
              )}

              {step < 4 ? (
                <button
                  type="button"
                  onClick={() => setStep(step + 1)}
                  className="flex items-center gap-1.5 px-5 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-colors shadow-md shadow-indigo-600/20"
                >
                  <span>{t.btnNext}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 px-6 py-2.5 text-xs font-semibold rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white transition-all shadow-lg shadow-indigo-600/30 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <span>{lang === 'vi' ? 'Đang gửi hồ sơ...' : 'Submitting...'}</span>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>{t.btnSubmit}</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
