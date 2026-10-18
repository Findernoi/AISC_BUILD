import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User } from '@supabase/supabase-js';
import {
  Language,
  PortalRole,
  JobPosting,
  Candidate,
  DecisionWeights,
} from '../types';
import {
  INITIAL_JOBS,
  I18N,
} from '../data/mockData';
import { getSupabaseClient, isSupabaseConfigured, supabase } from '../lib/supabase';
import { normalizeCandidate } from '../lib/recruitmentStats';
import { inviteShortlisted } from '../lib/recruitment';
import { makeUITDemoCandidates } from '../data/uitDemo';

interface AppContextType {
  authUser: User | null;
  authReady: boolean;
  demoMode: boolean;
  enterDemo: () => void;
  loadUITDemo: () => void;
  updateCandidate: (id: string, patch: Partial<Candidate>) => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  lang: Language;
  setLang: (lang: Language) => void;
  role: PortalRole;
  setRole: (role: PortalRole) => void;
  activeCandidateId: string;
  setActiveCandidateId: (id: string) => void;
  candidates: Candidate[];
  jobs: JobPosting[];
  weights: DecisionWeights;
  setWeights: React.Dispatch<React.SetStateAction<DecisionWeights>>;
  t: typeof I18N['vi'];
  applyCandidate: (newCandidate: Omit<Candidate, 'id' | 'appliedDate' | 'stage' | 'status'>) => Candidate;
  batchInviteToRound2: (candidateIds: string[], reviewer?: string, scope?: { jobId?: string; major?: string }) => void;
  createJob: (job: Omit<JobPosting, 'id' | 'applicantCount' | 'createdAt'>) => void;
  updateJob: (job: JobPosting) => void;
  resetData: () => void;
}

const STORAGE_KEY = 'talentmatch_ai_state_v2';
const demoCandidates = makeUITDemoCandidates;

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [demoMode, setDemoMode] = useState(() => sessionStorage.getItem('talentforecast_demo') === 'true');
  const [authReady, setAuthReady] = useState(!isSupabaseConfigured);
  const [lang, setLang] = useState<Language>('vi');
  const [role, setRole] = useState<PortalRole>('hr');
  const [activeCandidateId, setActiveCandidateId] = useState<string>('cand-001');
  const [weights, setWeights] = useState<DecisionWeights>({
    aiWeight: 30,
    assessmentWeight: 30,
    hrWeight: 40,
  });

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
    if (demoMode) { sessionStorage.removeItem('talentforecast_demo'); setDemoMode(false); return; }
    const { error } = await getSupabaseClient().auth.signOut();
    if (error) throw error;
  };

  const [jobs, setJobs] = useState<JobPosting[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_jobs`);
      return saved ? JSON.parse(saved) : INITIAL_JOBS.map((j, i) => ({ ...j, currentWorkforce: [5, 6, 4][i], hiringPeriod: '2026-11' }));
    } catch {
      return INITIAL_JOBS;
    }
  });

  const [candidates, setCandidates] = useState<Candidate[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_candidates`);
      return saved ? JSON.parse(saved).map(normalizeCandidate) : demoCandidates();
    } catch {
      return demoCandidates();
    }
  });


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
    const newId = `cand-${crypto.randomUUID()}`;
    const newCandidate: Candidate = {
      ...data,
      id: newId,
      appliedDate: new Date().toISOString().split('T')[0],
      stage: 'applied',
      status: 'pending',
      stageHistory: ['applied'],
    };

    setCandidates((prev) => [newCandidate, ...prev]);
    setActiveCandidateId(newId);

    // Increment applicant count for target job
    setJobs((prev) =>
      prev.map((j) => (j.id === data.jobId ? { ...j, applicantCount: j.applicantCount + 1 } : j))
    );

    return newCandidate;
  };

  const batchInviteToRound2 = (candidateIds: string[], reviewer = '', scope: { jobId?: string; major?: string } = {}) => {
    setCandidates(prev=>inviteShortlisted(prev,jobs,candidateIds,reviewer,{...scope,allowDemo:demoMode}));
  };

  const createJob = (jobData: Omit<JobPosting, 'id' | 'applicantCount' | 'createdAt'>) => {
    const newJob: JobPosting = {
      ...jobData,
      id: `job-${crypto.randomUUID()}`,
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
    setJobs(INITIAL_JOBS.map((j, i) => ({ ...j, currentWorkforce: [5, 6, 4][i], hiringPeriod: '2026-11' })));
    setCandidates(demoCandidates());
    setActiveCandidateId('cand-001');
  };

  return (
    <AppContext.Provider
      value={{
        authUser,
        authReady,
        demoMode,
        loadUITDemo: () => { if (demoMode) setCandidates(prev => [...prev, ...makeUITDemoCandidates().filter(c => !prev.some(p => p.id === c.id))]); },
        enterDemo: () => { sessionStorage.setItem('talentforecast_demo', 'true'); setDemoMode(true); },
        updateCandidate: (id, patch) => setCandidates(prev => prev.map(c => {
          if (c.id !== id) return c;
          const affectsEvaluation = ['email','fullName','university','gpa','gpaScale','major','studentId','verification','evidenceFiles','achievementLevel','achievements','englishCert','techBadges','projectCount','experienceMonths','interviewEvaluation','manualCodingEvaluation','codingAttempt','assignedProblemId'].some(key => Object.prototype.hasOwnProperty.call(patch,key));
          return { ...c, ...(affectsEvaluation ? { hiringDecision:undefined, emailDraft:undefined } : {}), ...patch };
        })),
        signIn,
        signUp,
        signOut,
        lang,
        setLang,
        role,
        setRole,
        activeCandidateId,
        setActiveCandidateId,
        candidates,
        jobs,
        weights,
        setWeights,
        t,
        applyCandidate,
        batchInviteToRound2,
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
