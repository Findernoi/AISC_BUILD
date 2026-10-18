export interface RecruitmentUser { id: string; email: string; role: 'candidate' | 'hr'; }
export interface RecruitmentJob {
  id: string; title: string; department: string; description: string; location: string;
  requirements: string[]; min_gpa: number | string; status: 'active' | 'closed';
}
export interface ApplicationInput {
  job_id: string; full_name: string; phone: string; major: 'KHMT' | 'KTPM' | 'AI';
  gpa: number; gpa_scale: '4.0' | '10'; graduation_year: number;
  project_count: number | null; experience_months: number | null;
  skills: string[]; project_description: string;
}
export interface RecruitmentApplication extends ApplicationInput {
  id: string; applicant_id: string; contact_email: string; stage: string; status: string;
  created_at: string; revision: number;
}
export interface RecruitmentSession { user: RecruitmentUser | null; mode: 'local' | 'supabase'; configured: boolean; }
export type EvidenceKind = 'cv' | 'english' | 'achievement';
export interface RecruitmentFile {
  id: string; application_id: string; uploaded_by: string; kind: EvidenceKind;
  bucket: string; object_path: string; original_name: string;
  mime_type: 'application/pdf' | 'image/png' | 'image/jpeg'; byte_size: number; sha256: string; created_at: string;
  declared_fields?: EvidenceDeclaration;
}
export interface EvidenceDeclaration { credential?: 'IELTS'|'TOEIC'|'TOEFL'; score?: string; issued_on?: string; reference?: string; title?: string; issuer?: string; level?: 'school'|'national'|'international'; }
export interface EvidencePage { page:number; text:string; method:'pdf-text'|'ocr'; confidence:number|null; }
export interface EvidenceField { key:string; label:string; declared:string; extracted:string|null; outcome:'match'|'mismatch'|'unclear'; page:number|null; excerpt:string; }
export interface EvidenceResult {
  status:'matched'|'mismatch'|'unclear'|'unreadable'; issuer_verified:false; fields:EvidenceField[]; pages:EvidencePage[];
  notes:string[]; engine:string; partial:boolean;
}
export interface EvidenceCheck { id:string; file_id:string; application_id:string; file_sha256:string; claims_hash:string; claims_snapshot?:{full_name:string;declaration:EvidenceDeclaration}; created_by:string; created_at:string; result:EvidenceResult; stale?:boolean; }
export interface EvidenceAssessment {status:'automatic'|'exception'|'accepted'|'rejected'|'obsolete'|'not_scored';basis:string;checkId:string|null;reason:string;}
export interface EvidenceExceptionRow {file:RecruitmentFile;application:{id:string;full_name:string;major:string};assessment:EvidenceAssessment;}
export interface EvidenceExceptionReport {total:number;rows:EvidenceExceptionRow[];}
export interface EvidenceResolutionInput {expectedBasis:string;outcome:'accept'|'reject';reason:string;}
export type CheckRegistration=Omit<EvidenceCheck,'id'|'created_at'|'stale'>;
export type FileRegistration = Omit<RecruitmentFile,'id'|'bucket'|'created_at'>;
export interface RoundOneScope { jobId:string|null; major:'all'|'AI'|'KHMT'|'KTPM'; }
export interface InterviewInvitation { application_id:string; invited_by:string; invited_at:string; round_one_score:number|string; scope:Record<string,unknown>; }
export interface RoundOneRow {
  application:Pick<RecruitmentApplication,'id'|'job_id'|'full_name'|'contact_email'|'major'|'stage'|'status'|'revision'>;
  jobTitle:string; score:{total:number;gpaNormalized:number;evidenceAlerts:number;contributions:Array<{key:string;label:string;value:number;max:number}>};
  reasons:string[];rank:number|null;inTopTen:boolean;invitation:InterviewInvitation|null;
}
export interface RoundOneReport {version:string;threshold:number;total:number;qualified:number;rows:RoundOneRow[];}
export type InterviewCriterion = 'technical'|'reasoning'|'learning'|'projects'|'communication';
export interface InterviewScheduleInput { starts_at:string; duration_minutes:number; location:string; interviewer:string; instructions:string; }
export interface InterviewSchedule extends InterviewScheduleInput { application_id:string; updated_by:string; updated_at:string; }
export interface InterviewEvaluationInput { scores:Record<InterviewCriterion,number>; evidence:Record<InterviewCriterion,string>; }
export interface CodingEvaluationInput { score:number; notes:string; }
export type RoundTwoMutation = {expectedRevision:number} & (
  {kind:'schedule';data:InterviewScheduleInput}|{kind:'interview';data:InterviewEvaluationInput}|{kind:'coding';data:CodingEvaluationInput});
export interface RoundTwoReport {
  revision:number; schedule:InterviewSchedule|null;
  coding:(CodingEvaluationInput & {reviewed_by:string;reviewed_at:string})|null;
  interview:(Record<InterviewCriterion,number|string> & {evidence:Record<InterviewCriterion,string>;overall_score:number|string;reviewed_by:string;reviewed_at:string})|null;
}
export interface HiringWeights {roundOne:number;coding:number;interview:number;}
export interface HiringDecisionInput {expectedBasis:string;weights:HiringWeights;result:'hire'|'reserve'|'reject';reason:string;}
export interface HiringDecision {
  id:string;application_id:string;application_revision:number;result:HiringDecisionInput['result'];reason:string;decided_by:string;decided_at:string;
  round_one_score:number|string;coding_score:number|string;interview_score:number|string;final_score:number|string;
  round_one_weight:number|string;coding_weight:number|string;interview_weight:number|string;source_basis:string|null;
}
export interface HiringReport {
  revision:number;basis:string;weights:HiringWeights;roundOne:number;coding:number|null;interview:number|null;finalScore:number|null;reasons:string[];
  history:HiringDecision[];
}
export interface OfferInput {expectedOfferId:string|null;expectedDecisionId:string;expectedBasis:string;positionTitle:string;startDate:string;content:string;}
export interface OfferResponseInput {expectedRevision:number;outcome:'accepted'|'declined';note:string;}
export interface RecruitmentOffer {
  id:string;application_id:string;decision_id:string;position_title:string;start_date:string;content:string;
  status:'pending'|'superseded'|'accepted'|'declined';revision:number;issued_by:string;issued_at:string;
  responded_by:string|null;responded_at:string|null;response_note:string;candidate_name:string;actionable:boolean;
}
