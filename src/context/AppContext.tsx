import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User } from '@supabase/supabase-js';
import {
  Language,
  PortalRole,
  JobPosting,
  Candidate,
  CodingChallenge,
  DecisionWeights,
  AIScreeningReport,
  CodingSubmission,
  HRScorecard,
} from '../types';
import {
  INITIAL_JOBS,
  INITIAL_CHALLENGES,
  INITIAL_CANDIDATES,
  I18N,
} from '../data/mockData';
import { getSupabaseClient, isSupabaseConfigured, supabase } from '../lib/supabase';

interface AppContextType {
  authUser: User | null;
  authReady: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  lang: Language;
  setLang: (lang: Language) => void;
  role: PortalRole;
  setRole: (role: PortalRole) => void;
  activeCandidateId: string;
  setActiveCandidateId: (id: string) => void;
  activeJobId: string;
  setActiveJobId: (id: string) => void;
  candidates: Candidate[];
  jobs: JobPosting[];
  challenges: CodingChallenge[];
  weights: DecisionWeights;
  setWeights: React.Dispatch<React.SetStateAction<DecisionWeights>>;
  t: typeof I18N['vi'];
  isAiScreeningLoading: boolean;
  applyCandidate: (newCandidate: Omit<Candidate, 'id' | 'appliedDate' | 'stage' | 'status'>) => Candidate;
  runAiScreening: (candidateId: string) => Promise<AIScreeningReport | null>;
  batchInviteToRound2: (candidateIds: string[]) => void;
  submitCodingTest: (candidateId: string, submission: CodingSubmission) => void;
  saveHRScorecard: (candidateId: string, scorecard: HRScorecard) => void;
  finalizeDecision: (candidateId: string, decision: 'hire' | 'reserve' | 'reject') => void;
  createJob: (job: Omit<JobPosting, 'id' | 'applicantCount' | 'createdAt'>) => void;
  updateJob: (job: JobPosting) => void;
  resetData: () => void;
}

const STORAGE_KEY = 'talentmatch_ai_state_v2';

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(!isSupabaseConfigured);
  const [lang, setLang] = useState<Language>('vi');
  const [role, setRole] = useState<PortalRole>('hr');
  const [activeCandidateId, setActiveCandidateId] = useState<string>('cand-001');
  const [activeJobId, setActiveJobId] = useState<string>('job-ai-intern');
  const [weights, setWeights] = useState<DecisionWeights>({
    aiWeight: 30,
    codingWeight: 40,
    hrWeight: 30,
  });
  const [isAiScreeningLoading, setIsAiScreeningLoading] = useState<boolean>(false);

  useEffect(() => {
    if (!supabase) return;

    let mounted = true;
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthUser(session?.user ?? null);
      setAuthReady(true);
    });

    void supabase.auth.getSession()
      .then(({ data, error }) => {
        if (error) throw error;
        if (mounted) {
          setAuthUser(data.session?.user ?? null);
          setAuthReady(true);
        }
      })
      .catch((error: unknown) => {
        console.error('Unable to restore Supabase session:', error);
        if (mounted) setAuthReady(true);
      });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await getSupabaseClient().auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signUp = async (email: string, password: string) => {
    const { data, error } = await getSupabaseClient().auth.signUp({ email, password });
    if (error) throw error;
    return !data.session;
  };

  const signOut = async () => {
    const { error } = await getSupabaseClient().auth.signOut();
    if (error) throw error;
  };

  const [jobs, setJobs] = useState<JobPosting[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_jobs`);
      return saved ? JSON.parse(saved) : INITIAL_JOBS;
    } catch {
      return INITIAL_JOBS;
    }
  });

  const [candidates, setCandidates] = useState<Candidate[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_candidates`);
      return saved ? JSON.parse(saved) : INITIAL_CANDIDATES;
    } catch {
      return INITIAL_CANDIDATES;
    }
  });

  const challenges = INITIAL_CHALLENGES;

  useEffect(() => {
    try {
      localStorage.setItem(`${STORAGE_KEY}_jobs`, JSON.stringify(jobs));
    } catch (e) {
      console.warn('Storage save error:', e);
    }
  }, [jobs]);

  useEffect(() => {
    try {
      localStorage.setItem(`${STORAGE_KEY}_candidates`, JSON.stringify(candidates));
    } catch (e) {
      console.warn('Storage save error:', e);
    }
  }, [candidates]);

  const t = I18N[lang];

  const applyCandidate = (data: Omit<Candidate, 'id' | 'appliedDate' | 'stage' | 'status'>): Candidate => {
    const newId = `cand-${Date.now().toString().slice(-4)}`;
    const newCandidate: Candidate = {
      ...data,
      id: newId,
      appliedDate: new Date().toISOString().split('T')[0],
      stage: 'applied',
      status: 'pending',
    };

    setCandidates((prev) => [newCandidate, ...prev]);
    setActiveCandidateId(newId);

    // Increment applicant count for target job
    setJobs((prev) =>
      prev.map((j) => (j.id === data.jobId ? { ...j, applicantCount: j.applicantCount + 1 } : j))
    );

    return newCandidate;
  };

  const runAiScreening = async (candidateId: string): Promise<AIScreeningReport | null> => {
    const candidate = candidates.find((c) => c.id === candidateId);
    if (!candidate) return null;
    const job = jobs.find((j) => j.id === candidate.jobId) || jobs[0];

    setIsAiScreeningLoading(true);
    try {
      const res = await fetch('/api/ai/screen-resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidate, job, lang }),
      });

      const report: AIScreeningReport = await res.json();
      report.evaluatedAt = new Date().toISOString().split('T')[0];

      setCandidates((prev) =>
        prev.map((c) => {
          if (c.id === candidateId) {
            return {
              ...c,
              stage: 'ai_screening',
              status: report.recommendation === 'pass' ? 'passed' : report.recommendation === 'hold' ? 'hold' : 'rejected',
              aiScreeningReport: report,
            };
          }
          return c;
        })
      );

      return report;
    } catch (err) {
      console.error('Failed to run AI screening:', err);
      return null;
    } finally {
      setIsAiScreeningLoading(false);
    }
  };

  const batchInviteToRound2 = (candidateIds: string[]) => {
    setCandidates((prev) =>
      prev.map((c) => {
        if (candidateIds.includes(c.id)) {
          return {
            ...c,
            stage: 'assessment',
            status: 'passed',
          };
        }
        return c;
      })
    );
  };

  const submitCodingTest = (candidateId: string, submission: CodingSubmission) => {
    setCandidates((prev) =>
      prev.map((c) => {
        if (c.id === candidateId) {
          return {
            ...c,
            codingSubmission: submission,
          };
        }
        return c;
      })
    );
  };

  const saveHRScorecard = (candidateId: string, scorecard: HRScorecard) => {
    setCandidates((prev) =>
      prev.map((c) => {
        if (c.id === candidateId) {
          return {
            ...c,
            stage: 'final_decision',
            hrScorecard: scorecard,
          };
        }
        return c;
      })
    );
  };

  const finalizeDecision = (candidateId: string, decision: 'hire' | 'reserve' | 'reject') => {
    setCandidates((prev) =>
      prev.map((c) => {
        if (c.id === candidateId) {
          return {
            ...c,
            finalDecision: decision,
            status: decision === 'hire' ? 'passed' : decision === 'reserve' ? 'hold' : 'rejected',
          };
        }
        return c;
      })
    );
  };

  const createJob = (jobData: Omit<JobPosting, 'id' | 'applicantCount' | 'createdAt'>) => {
    const newJob: JobPosting = {
      ...jobData,
      id: `job-${Date.now().toString().slice(-4)}`,
      applicantCount: 0,
      createdAt: new Date().toISOString().split('T')[0],
    };
    setJobs((prev) => [newJob, ...prev]);
  };

  const updateJob = (updated: JobPosting) => {
    setJobs((prev) => prev.map((j) => (j.id === updated.id ? updated : j)));
  };

  const resetData = () => {
    try {
      localStorage.removeItem(`${STORAGE_KEY}_jobs`);
      localStorage.removeItem(`${STORAGE_KEY}_candidates`);
    } catch {}
    setJobs(INITIAL_JOBS);
    setCandidates(INITIAL_CANDIDATES);
    setActiveCandidateId('cand-001');
    setActiveJobId('job-ai-intern');
  };

  return (
    <AppContext.Provider
      value={{
        authUser,
        authReady,
        signIn,
        signUp,
        signOut,
        lang,
        setLang,
        role,
        setRole,
        activeCandidateId,
        setActiveCandidateId,
        activeJobId,
        setActiveJobId,
        candidates,
        jobs,
        challenges,
        weights,
        setWeights,
        t,
        isAiScreeningLoading,
        applyCandidate,
        runAiScreening,
        batchInviteToRound2,
        submitCodingTest,
        saveHRScorecard,
        finalizeDecision,
        createJob,
        updateJob,
        resetData,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
