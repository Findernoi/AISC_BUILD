import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { JobPosting } from '../../types';
import {
  Briefcase,
  Plus,
  GraduationCap,
  Award,
  Code2,
  Users,
  Check,
  X,
  Edit2,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';

export const JobManager: React.FC = () => {
  const { lang, t, jobs, challenges, createJob, updateJob } = useApp();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<JobPosting | null>(null);

  // Form State
  const [title, setTitle] = useState('');
  const [department, setDepartment] = useState('AI & Data Innovation Lab');
  const [location, setLocation] = useState('TP. Hồ Chí Minh / Hybrid');
  const [type, setType] = useState<JobPosting['type']>('Internship');
  const [description, setDescription] = useState('');
  const [requirementsStr, setRequirementsStr] = useState('Python, PyTorch, RAG Architecture, FastAPI, Docker');
  const [minGpa, setMinGpa] = useState<string>('3.2');
  const [englishRequirement, setEnglishRequirement] = useState('IELTS 6.5+ hoặc TOEIC 750+');
  const [codingChallengeId, setCodingChallengeId] = useState(challenges[0]?.id || 'challenge-rag-tokens');

  const handleOpenCreateModal = () => {
    setEditingJob(null);
    setTitle('');
    setDepartment('AI & Data Innovation Lab');
    setLocation('TP. Hồ Chí Minh / Hybrid');
    setType('Internship');
    setDescription('Tham gia nghiên cứu và phát triển sản phẩm công nghệ tiên tiến...');
    setRequirementsStr('Python, PyTorch, Docker, Git');
    setMinGpa('3.2');
    setEnglishRequirement('IELTS 6.5+');
    setCodingChallengeId(challenges[0]?.id || '');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (job: JobPosting) => {
    setEditingJob(job);
    setTitle(job.title);
    setDepartment(job.department);
    setLocation(job.location);
    setType(job.type);
    setDescription(job.description);
    setRequirementsStr(job.requirements.join(', '));
    setMinGpa(job.minGpa.toString());
    setEnglishRequirement(job.englishRequirement);
    setCodingChallengeId(job.codingChallengeId);
    setIsModalOpen(true);
  };

  const handleSaveJob = (e: React.FormEvent) => {
    e.preventDefault();

    const requirements = requirementsStr
      .split(',')
      .map((r) => r.trim())
      .filter(Boolean);

    if (editingJob) {
      updateJob({
        ...editingJob,
        title,
        department,
        location,
        type,
        description,
        requirements,
        minGpa: parseFloat(minGpa) || 3.0,
        englishRequirement,
        codingChallengeId,
      });
    } else {
      createJob({
        title,
        department,
        location,
        type,
        description,
        requirements,
        minGpa: parseFloat(minGpa) || 3.0,
        englishRequirement,
        codingChallengeId,
        status: 'active',
      });
    }

    setIsModalOpen(false);
  };

  const handleToggleStatus = (job: JobPosting) => {
    updateJob({
      ...job,
      status: job.status === 'active' ? 'closed' : 'active',
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-slate-900 border border-slate-800 rounded-2xl">
        <div>
          <div className="flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-indigo-400" />
            <h1 className="text-xl font-bold text-white">{t.navHrJobs}</h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {lang === 'vi'
              ? 'Tạo mới, chỉnh sửa và cấu hình tiêu chuẩn tuyển dụng (Kỹ năng bắt buộc, GPA tối thiểu, chuẩn tiếng Anh và đề thi lập trình).'
              : 'Create, modify and configure hiring benchmarks (Required skills, minimum GPA, English level, and coding assessment).'}
          </p>
        </div>

        <button
          onClick={handleOpenCreateModal}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 transition-all shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>{lang === 'vi' ? 'Đăng Tin Tuyển Dụng Mới' : 'Post New Job'}</span>
        </button>
      </div>

      {/* Jobs Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {jobs.map((job) => {
          const challenge = challenges.find((c) => c.id === job.codingChallengeId);

          return (
            <div
              key={job.id}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span
                    className={`px-2 py-0.5 text-[11px] font-bold rounded-md uppercase ${
                      job.status === 'active'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {job.status === 'active' ? 'Đang Tuyển' : 'Tạm Đóng'}
                  </span>
                  <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
                    <Users className="w-3.5 h-3.5 text-indigo-400" />
                    <span>{job.applicantCount} ứng viên</span>
                  </div>
                </div>

                <div>
                  <h3 className="text-base font-bold text-white leading-snug">{job.title}</h3>
                  <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                    <span>{job.department}</span>
                    <span aria-hidden="true">·</span>
                    <span>{job.location}</span>
                  </div>
                </div>

                {/* Criteria */}
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="flex items-center gap-1.5 text-slate-400">
                      <GraduationCap className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Min GPA:</span>
                    </span>
                    <span className="font-mono font-bold text-indigo-300">≥ {job.minGpa} / 4.0</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="flex items-center gap-1.5 text-slate-400">
                      <Award className="w-3.5 h-3.5 text-amber-400" />
                      <span>Ngoại ngữ:</span>
                    </span>
                    <span className="text-slate-300 truncate max-w-[150px]">{job.englishRequirement}</span>
                  </div>
                  {challenge && (
                    <div className="flex justify-between">
                      <span className="flex items-center gap-1.5 text-slate-400">
                        <Code2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Bài test:</span>
                      </span>
                      <span className="text-[11px] text-slate-300 truncate max-w-[150px]">
                        {challenge.title.split('/')[0]}
                      </span>
                    </div>
                  )}
                </div>

                {/* Skills tags */}
                <div className="flex flex-wrap gap-1.5">
                  {job.requirements.map((r) => (
                    <span
                      key={r}
                      className="px-2 py-0.5 text-[11px] bg-slate-950 border border-slate-800 text-slate-300 rounded"
                    >
                      {r}
                    </span>
                  ))}
                </div>
              </div>

              {/* Action Toolbar */}
              <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between">
                <button
                  onClick={() => handleToggleStatus(job)}
                  className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
                >
                  {job.status === 'active' ? (
                    <>
                      <ToggleRight className="w-4 h-4 text-emerald-400" />
                      <span>Đóng tuyển</span>
                    </>
                  ) : (
                    <>
                      <ToggleLeft className="w-4 h-4 text-slate-500" />
                      <span>Mở tuyển</span>
                    </>
                  )}
                </button>

                <button
                  onClick={() => handleOpenEditModal(job)}
                  className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 font-medium"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Chỉnh sửa</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 sm:p-8 my-8 text-slate-100 space-y-4">
            <div className="flex items-start justify-between pb-3 border-b border-slate-800">
              <h2 className="text-lg font-bold text-white">
                {editingJob ? 'Chỉnh Sửa Tin Tuyển Dụng' : 'Tạo Tin Tuyển Dụng Mới'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveJob} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-slate-300 mb-1">Tiêu đề vị trí *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="AI Engineering Intern..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-300 mb-1">Phòng ban *</label>
                  <input
                    type="text"
                    required
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-300 mb-1">Địa điểm *</label>
                  <input
                    type="text"
                    required
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-300 mb-1">Yêu cầu GPA tối thiểu *</label>
                  <input
                    type="number"
                    step="0.1"
                    min="2.0"
                    max="4.0"
                    required
                    value={minGpa}
                    onChange={(e) => setMinGpa(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-300 mb-1">Chuẩn ngoại ngữ</label>
                  <input
                    type="text"
                    value={englishRequirement}
                    onChange={(e) => setEnglishRequirement(e.target.value)}
                    placeholder="IELTS 6.5+..."
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-300 mb-1">
                  Kỹ năng yêu cầu (phân cách bằng dấu phẩy) *
                </label>
                <input
                  type="text"
                  required
                  value={requirementsStr}
                  onChange={(e) => setRequirementsStr(e.target.value)}
                  placeholder="Python, PyTorch, RAG, Docker..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-300 mb-1">
                  Đề bài kiểm tra lập trình (Vòng 2) *
                </label>
                <select
                  value={codingChallengeId}
                  onChange={(e) => setCodingChallengeId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                >
                  {challenges.map((c) => (
                    <option key={c.id} value={c.id}>
                      [{c.difficulty}] {c.title.split('/')[0]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-300 mb-1">Mô tả công việc</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white leading-relaxed"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-slate-400 hover:text-white"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-md shadow-indigo-600/20"
                >
                  Lưu Tin Tuyển Dụng
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
