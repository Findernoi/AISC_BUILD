export type Language = 'vi' | 'en';

export type PortalRole = 'candidate' | 'hr';

export type CandidateStage = 'applied' | 'cv_passed' | 'assessment' | 'interview' | 'offer' | 'accepted';

export type CandidateStatus = 'pending' | 'passed' | 'hold' | 'rejected';

export interface EnglishCert {
  type: 'IELTS' | 'TOEIC' | 'TOEFL' | 'VSTEP' | 'None';
  score: string;
  fileUrl?: string;
}

export interface JobPosting {
  id: string;
  title: string;
  department: string;
  location: string;
  type: 'Full-time' | 'Internship' | 'Part-time';
  description: string;
  requirements: string[];
  minGpa: number;
  englishRequirement: string;
  status: 'active' | 'closed';
  applicantCount: number;
  createdAt: string;
  currentWorkforce?: number;
  targetHeadcount?: number;
  hiringPeriod?: string;
  demandHistory?: number[];
  demandHistoryEndMonth?: string;
  workforceSnapshot?: Record<string, string | number>;
}

export interface AIScreeningReport {
  fitScore: number; // 0-100
  recommendation: 'pass' | 'hold' | 'reject';
  strengths: string[];
  redFlags: string[];
  skillMatch: Record<string, number>;
  summaryAnalysis: string;
  evaluatedAt: string;
}

export interface HRScorecard {
  interviewerName: string;
  technicalScore: number; // 0-100
  problemSolvingScore: number; // 0-100
  communicationScore: number; // 0-100
  cultureFitScore: number; // 0-100
  overallScore: number; // 0-100
  notes: string;
  recommendation: 'strong_hire' | 'hire' | 'borderline' | 'reject';
  evaluatedAt: string;
}

export interface Candidate {
  id: string;
  jobId: string;
  fullName: string;
  email: string;
  phone: string;
  university: string;
  major: string;
  graduationYear: number;
  gpa: number;
  gpaScale: '4.0' | '10';
  linkedinUrl: string;
  githubUrl: string;
  achievements: string;
  englishCert: EnglishCert;
  techBadges: string[];
  cvFileName: string;
  cvSummary: string;
  stage: CandidateStage;
  status: CandidateStatus;
  aiScreeningReport?: AIScreeningReport;
  hrScorecard?: HRScorecard;
  finalDecision?: 'hire' | 'reserve' | 'reject' | null;
  appliedDate: string;
  source?: string;
  projects?: string;
  projectCount?: number;
  experienceMonths?: number;
  assessmentScore?: number;
  stageHistory?: CandidateStage[];
  studentId?: string;
  verification?: Partial<Record<EvidenceKind, VerificationRecord>>;
  evidenceFiles?: Partial<Record<EvidenceKind, EvidenceFile>>;
  cvEvidence?: EvidenceFile;
  achievementLevel?: 'none' | 'school' | 'national' | 'international';
  invitation?: { invitedAt: string; invitedBy: string; roundOneScore: number; scopeJobId: string; majorFilter: string };
  interviewEvaluation?: InterviewEvaluation;
  codingAttempt?: CodingAttempt; // Legacy submissions are not used for scoring.
  manualCodingEvaluation?: { score: number; reviewedBy: string; notes: string; reviewedAt: string };
  hiringDecision?: { result: 'hire' | 'reserve' | 'reject'; reason: string; decidedBy: string; decidedAt: string; finalScore: number; weights: DecisionWeights };
  emailDraft?: { subject: string; body: string; createdAt: string; state: 'draft' | 'demo_sent' };
  sampleRecord?: boolean;
  assignedProblemId?: string;
  interviewQuestion?: { question: string; answer: string };
}

export type UITMajor = 'KHMT' | 'KTPM' | 'AI';
export type EvidenceKind = 'student' | 'gpa' | 'english' | 'achievement';
export interface EvidenceFile { id: string; name: string; size: number; type: string }
export interface VerificationRecord {
  status: 'verified' | 'rejected';
  reviewer: string;
  reference: string;
  reviewedAt: string;
  fingerprint: string;
  demoOnly?: boolean;
}
export const INTERVIEW_KEYS = ['technical', 'reasoning', 'learning', 'projects', 'communication'] as const;
export type InterviewKey = typeof INTERVIEW_KEYS[number];
export interface InterviewEvaluation {
  reviewer: string;
  scores: Record<InterviewKey, number>;
  evidence: Record<InterviewKey, string>;
  overallScore: number;
  evaluatedAt: string;
}
export interface CodingAttempt {
  problemId: string;
  code: string;
  passed: number;
  total: number;
  testScore: number;
  durationMs: number;
  details: { label: string; passed: boolean; actual: string }[];
  submittedAt: string;
  review?: { mode: 'demo' | 'ai'; qualityScore: number; feedback: string; timeComplexity: string; score: number; reviewedAt: string };
}

export interface DecisionWeights {
  aiWeight: number; // Round 1 profile weight
  assessmentWeight: number; // Coding completed outside the app, entered by HR
  hrWeight: number; // Round 2 interview weight
}
