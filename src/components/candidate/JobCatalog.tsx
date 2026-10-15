import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { JobPosting } from '../../types';
import { ApplyModal } from './ApplyModal';
import { Briefcase, MapPin, GraduationCap, Award, Code2, ArrowRight } from 'lucide-react';

interface JobCatalogProps {
  onAppliedSuccess: (candidateId: string) => void;
}

export const JobCatalog: React.FC<JobCatalogProps> = ({ onAppliedSuccess }) => {
  const { lang, t, jobs, challenges } = useApp();
  const [selectedJobForApply, setSelectedJobForApply] = useState<JobPosting | null>(null);
  const [viewingDetailJob, setViewingDetailJob] = useState<JobPosting | null>(null);

  return (
    <div className="space-y-6">
      {/* Hero Banner */}
      <div className="relative rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 p-6 sm:p-8 overflow-hidden">
        <div className="relative z-10 max-w-2xl">
          <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider block mb-2">
            {lang === 'vi' ? 'Chương Trình Ươm Mầm Tài Năng Công Nghệ' : 'Technology Internship & Early Careers'}
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            {t.openRoles}
          </h1>
          <p className="text-sm text-slate-300 mt-2 leading-relaxed">
            {t.openRolesDesc}. {lang === 'vi' 
              ? 'Quy trình tuyển dụng tinh gọn ứng dụng AI để phân tích năng lực công bằng, minh bạch và cấp phản hồi tức thì.' 
              : 'Streamlined recruitment powered by AI for fair, objective evaluation and immediate feedback.'}
          </p>
        </div>
      </div>

      {/* Job Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {jobs.map((job) => {
          const challenge = challenges.find((c) => c.id === job.codingChallengeId);

          return (
            <div
              key={job.id}
              className="group bg-slate-900/90 border border-slate-800 hover:border-slate-700 rounded-2xl p-6 transition-all duration-200 flex flex-col justify-between shadow-sm hover:shadow-indigo-500/5"
            >
              <div className="space-y-4">
                {/* Department & Location */}
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <Briefcase className="w-3.5 h-3.5 text-slate-500" />
                    <span>{job.department}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-500" />
                    <span>{job.location}</span>
                  </div>
                </div>

                {/* Job Title */}
                <div>
                  <h3 className="text-base font-bold text-white group-hover:text-indigo-300 transition-colors">
                    {job.title}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1.5 line-clamp-2 leading-relaxed">
                    {job.description}
                  </p>
                </div>

                {/* Criteria strip (GPA & English) */}
                <div className="p-3 bg-slate-950/70 border border-slate-800/80 rounded-xl space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-slate-400">
                      <GraduationCap className="w-3.5 h-3.5 text-indigo-400" />
                      <span>{lang === 'vi' ? 'Yêu cầu GPA tối thiểu:' : 'Min GPA:'}</span>
                    </span>
                    <span className="font-mono font-semibold text-white">
                      ≥ {job.minGpa.toFixed(1)} / 4.0
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-slate-400">
                      <Award className="w-3.5 h-3.5 text-amber-400" />
                      <span>{lang === 'vi' ? 'Ngoại ngữ:' : 'English:'}</span>
                    </span>
                    <span className="font-medium text-slate-300 truncate max-w-[150px]">
                      {job.englishRequirement}
                    </span>
                  </div>
                  {challenge && (
                    <div className="flex items-center justify-between pt-1 border-t border-slate-900">
                      <span className="flex items-center gap-1.5 text-slate-400">
                        <Code2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>{lang === 'vi' ? 'Bài test Vòng 2:' : 'Round 2 Test:'}</span>
                      </span>
                      <span className="text-[11px] text-indigo-300 font-medium truncate max-w-[140px]">
                        {challenge.title.split('/')[0]}
                      </span>
                    </div>
                  )}
                </div>

                {/* Skill requirements list */}
                <div>
                  <span className="text-[11px] font-semibold text-slate-400 block mb-1.5">
                    {lang === 'vi' ? 'Kỹ năng trọng tâm:' : 'Key Tech Stack:'}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {job.requirements.slice(0, 5).map((req) => (
                      <span
                        key={req}
                        className="px-2 py-0.5 text-[11px] font-medium bg-slate-800/80 text-slate-300 rounded-md border border-slate-800"
                      >
                        {req}
                      </span>
                    ))}
                    {job.requirements.length > 5 && (
                      <span className="px-1.5 py-0.5 text-[11px] text-slate-500">
                        +{job.requirements.length - 5}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-5 mt-4 border-t border-slate-800/80 flex items-center gap-2">
                <button
                  onClick={() => setViewingDetailJob(job)}
                  className="px-3 py-2 text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
                >
                  {lang === 'vi' ? 'Xem chi tiết' : 'Details'}
                </button>
                <button
                  onClick={() => setSelectedJobForApply(job)}
                  className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-md shadow-indigo-600/20"
                >
                  <span>{t.applyNow}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Job Details Modal */}
      {viewingDetailJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-4 text-slate-100">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">
                  {viewingDetailJob.department}
                </span>
                <h2 className="text-xl font-bold text-white mt-1">{viewingDetailJob.title}</h2>
              </div>
              <button
                onClick={() => setViewingDetailJob(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>
            <div className="space-y-3 text-xs leading-relaxed text-slate-300">
              <div>
                <h4 className="font-semibold text-white mb-1">
                  {lang === 'vi' ? 'Mô tả công việc & Trách nhiệm:' : 'Job Description:'}
                </h4>
                <p>{viewingDetailJob.description}</p>
              </div>
              <div>
                <h4 className="font-semibold text-white mb-1">
                  {lang === 'vi' ? 'Yêu cầu kỹ năng & kiến thức:' : 'Requirements:'}
                </h4>
                <ul className="list-disc pl-4 space-y-1 text-slate-300">
                  {viewingDetailJob.requirements.map((req) => (
                    <li key={req}>{req}</li>
                  ))}
                  <li>
                    {lang === 'vi' ? 'Điểm GPA tối thiểu:' : 'Minimum GPA:'}{' '}
                    <span className="font-mono font-semibold text-indigo-300">
                      {viewingDetailJob.minGpa}/4.0
                    </span>
                  </li>
                  <li>
                    {lang === 'vi' ? 'Ngoại ngữ:' : 'English requirement:'}{' '}
                    <span className="font-medium text-slate-200">
                      {viewingDetailJob.englishRequirement}
                    </span>
                  </li>
                </ul>
              </div>
            </div>
            <div className="pt-4 border-t border-slate-800 flex justify-end gap-2">
              <button
                onClick={() => setViewingDetailJob(null)}
                className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white"
              >
                {lang === 'vi' ? 'Đóng' : 'Close'}
              </button>
              <button
                onClick={() => {
                  const jobToApply = viewingDetailJob;
                  setViewingDetailJob(null);
                  setSelectedJobForApply(jobToApply);
                }}
                className="px-5 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-md shadow-indigo-600/20"
              >
                {t.applyNow}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Apply Modal */}
      {selectedJobForApply && (
        <ApplyModal
          job={selectedJobForApply}
          isOpen={Boolean(selectedJobForApply)}
          onClose={() => setSelectedJobForApply(null)}
          onSuccess={(newCandidateId) => {
            onAppliedSuccess(newCandidateId);
          }}
        />
      )}
    </div>
  );
};
