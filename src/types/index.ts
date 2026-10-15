export type Language = 'vi' | 'en';

export type PortalRole = 'candidate' | 'hr';

export type CandidateStage = 'applied' | 'ai_screening' | 'assessment' | 'final_decision';

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
  codingChallengeId: string;
  status: 'active' | 'closed';
  applicantCount: number;
  createdAt: string;
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

export interface CodingSubmission {
  problemId: string;
  code: string;
  testsPassed: number;
  totalTests: number;
  runtimeMs: number;
  aiCodeScore: number;
  timeComplexity: string;
  spaceComplexity: string;
  strengths: string[];
  improvements: string[];
  cleanCodeVerdict: string;
  submittedAt: string;
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
  codingSubmission?: CodingSubmission;
  hrScorecard?: HRScorecard;
  finalDecision?: 'hire' | 'reserve' | 'reject' | null;
  appliedDate: string;
}

export interface TestCase {
  input: any[];
  expected: any;
  description: string;
}

export interface CodingChallenge {
  id: string;
  title: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  timeLimitMinutes: number;
  description: string;
  functionName: string;
  examples: {
    input: string;
    output: string;
    explanation?: string;
  }[];
  starterCode: string;
  testCases: TestCase[];
}

export interface DecisionWeights {
  aiWeight: number; // e.g. 30
  codingWeight: number; // e.g. 40
  hrWeight: number; // e.g. 30
}
