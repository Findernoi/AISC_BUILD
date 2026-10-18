import { createClient } from '@supabase/supabase-js';
import type { ApplicationInput, RecruitmentApplication, RecruitmentJob, RecruitmentUser, RecruitmentFile, FileRegistration } from '../../shared/recruitment';
import { ApiError } from './recruitment-validation';
import type { EvidenceCheck, CheckRegistration } from '../../shared/recruitment';
import type { RoundOneScope,RoundOneReport,InterviewInvitation } from '../../shared/recruitment';
import type { RoundTwoReport,RoundTwoMutation } from '../../shared/recruitment';
import type { HiringReport,HiringWeights,HiringDecisionInput,HiringDecision } from '../../shared/recruitment';
import type { EvidenceAssessment,EvidenceExceptionReport,EvidenceResolutionInput } from '../../shared/recruitment';
import type {RecruitmentOffer,OfferInput,OfferResponseInput} from '../../shared/recruitment';
import type {RecruitmentAnalytics,RecruitmentAnalyticsScope} from '../../shared/recruitment';

export interface RecruitmentStore {
  user: RecruitmentUser | null;
  analytics(scope:RecruitmentAnalyticsScope):Promise<RecruitmentAnalytics>;
  offers():Promise<RecruitmentOffer[]>;
  visibleOffer(id:string):Promise<boolean>;
  issueOffer(id:string,input:OfferInput):Promise<string>;
  respondOffer(id:string,input:OfferResponseInput):Promise<void>;
  evidenceAssessment(id:string):Promise<EvidenceAssessment|null>;
  evidenceExceptions():Promise<EvidenceExceptionReport>;
  resolveEvidence(id:string,input:EvidenceResolutionInput):Promise<void>;
  hiringReport(id:string,weights:HiringWeights):Promise<HiringReport|null>;
  decide(id:string,input:HiringDecisionInput):Promise<HiringDecision>;
  roundTwo(id:string):Promise<RoundTwoReport|null>;
  saveRoundTwo(id:string,input:RoundTwoMutation):Promise<void>;
  roundOne(scope:RoundOneScope):Promise<RoundOneReport>;
  invite(ids:string[],scope:RoundOneScope):Promise<InterviewInvitation[]>;
  invitations():Promise<InterviewInvitation[]>;
  check(fileId:string):Promise<EvidenceCheck|null>;
  saveCheck(input:CheckRegistration):Promise<EvidenceCheck>;
  jobs(): Promise<RecruitmentJob[]>;
  applications(): Promise<RecruitmentApplication[]>;
  application(id:string): Promise<RecruitmentApplication | null>;
  files(applicationId:string): Promise<RecruitmentFile[]>;
  file(id:string): Promise<RecruitmentFile | null>;
  registerFile(input:FileRegistration): Promise<RecruitmentFile>;
  apply(input: ApplicationInput): Promise<RecruitmentApplication>;
  createJob(input: {title:string;department:string;description:string;location:string;min_gpa:number;requirements?:string[]}): Promise<RecruitmentJob>;
}
// Application lists exclude evaluations/decisions; separate HR endpoints handle those.
export const JOB_COLUMNS = 'id,title,department,description,location,requirements,min_gpa,status';
export const APPLICATION_COLUMNS = 'id,job_id,applicant_id,full_name,contact_email,phone,major,gpa,gpa_scale,graduation_year,project_count,experience_months,skills,project_description,stage,status,created_at,revision';

export async function supabaseStore(token: string | undefined): Promise<RecruitmentStore> {
  const url=process.env.SUPABASE_URL, key=process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new ApiError(503,'Chưa cấu hình Supabase cho API tuyển dụng.');
  // Each request gets its own user-scoped client. Never use service-role for CRUD.
  const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
    ...(token ? {accessToken:async()=>token} : {})});
  let user: RecruitmentUser | null=null;
  if (token) {
    const verifier=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
    const verified=await verifier.auth.getUser(token);
    if (verified.error || !verified.data.user) throw new ApiError(401,'Phiên đăng nhập hết hạn hoặc không hợp lệ.');
    if (!verified.data.user.email_confirmed_at) throw new ApiError(403,'Hãy xác nhận email trước khi sử dụng.');
    const role=await client.rpc('recruitment_role');
    if (role.error) throw role.error;
    user={id:verified.data.user.id,email:verified.data.user.email ?? '',role:role.data === 'hr' ? 'hr' : 'candidate'};
  }
  return {
    user,
    async analytics(scope){const r=await client.rpc('recruitment_analytics',{job_filter:scope.jobId,target_month:scope.month+'-01',as_of:scope.asOf});if(r.error)throw r.error;return r.data as RecruitmentAnalytics;},
    async offers(){const r=await client.rpc('read_offers');if(r.error)throw r.error;return r.data as RecruitmentOffer[];},
    async visibleOffer(id){const r=await client.from('recruitment_offers').select('id').eq('id',id).maybeSingle();if(r.error)throw r.error;return Boolean(r.data);},
    async issueOffer(id,input){const r=await client.rpc('issue_offer',{target:id,expected_decision:input.expectedDecisionId,expected_basis:input.expectedBasis,expected_offer:input.expectedOfferId,position_title:input.positionTitle,start_date:input.startDate,content:input.content});if(r.error)throw r.error;return r.data as string;},
    async respondOffer(id,input){const r=await client.rpc('respond_offer',{target:id,expected_revision:input.expectedRevision,outcome:input.outcome,note:input.note});if(r.error)throw r.error;},
    async evidenceAssessment(id){const r=await client.rpc('evidence_assessment',{target:id});if(r.error)throw r.error;return r.data as EvidenceAssessment|null;},
    async evidenceExceptions(){const r=await client.rpc('evidence_exceptions');if(r.error)throw r.error;return r.data as EvidenceExceptionReport;},
    async resolveEvidence(id,input){const r=await client.rpc('resolve_evidence_exception',{target:id,expected_basis:input.expectedBasis,outcome:input.outcome,explanation:input.reason});if(r.error)throw r.error;},
    async hiringReport(id,weights){const r=await client.rpc('hiring_report',{target:id,weights});if(r.error)throw r.error;return r.data as HiringReport|null;},
    async decide(id,input){const r=await client.rpc('save_hiring_decision',{target:id,expected_basis:input.expectedBasis,weights:input.weights,outcome:input.result,explanation:input.reason});if(r.error)throw r.error;return r.data as HiringDecision;},
    async roundTwo(id){const r=await client.rpc('read_round_two',{target:id});if(r.error)throw r.error;return r.data as RoundTwoReport|null;},
    async saveRoundTwo(id,input){const r=await client.rpc('save_round_two',{target:id,expected_revision:input.expectedRevision,kind:input.kind,payload:input.data});if(r.error)throw r.error;},
    async roundOne(scope){const r=await client.rpc('round_one_report',{job_filter:scope.jobId,major_filter:scope.major});if(r.error)throw r.error;return r.data as RoundOneReport;},
    async invite(ids,scope){const r=await client.rpc('invite_round_one',{application_ids:ids,job_filter:scope.jobId,major_filter:scope.major});if(r.error)throw r.error;return r.data as InterviewInvitation[];},
    async invitations(){const r=await client.from('interview_invitations').select('application_id,invited_by,invited_at,round_one_score,scope').order('invited_at',{ascending:false}).limit(200);if(r.error)throw r.error;return r.data as InterviewInvitation[];},
    async check(id) {const r=await client.from('evidence_checks').select('*').eq('file_id',id).order('created_at',{ascending:false}).limit(1).maybeSingle();if(r.error)throw r.error;return r.data as EvidenceCheck|null;},
    async saveCheck(input) {
      const service=process.env.SUPABASE_SERVICE_ROLE_KEY;
      if(!service)throw new ApiError(503,'Chưa cấu hình lưu kết quả đối chiếu trên server.');
      const writer=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
      const r=await writer.from('evidence_checks').insert(input).select('*').single();if(r.error)throw r.error;return r.data as EvidenceCheck;
    },
    async application(id) { const r=await client.from('applications').select(APPLICATION_COLUMNS).eq('id',id).maybeSingle();if(r.error)throw r.error;return r.data as RecruitmentApplication|null; },
    async files(id) { const r=await client.from('application_files').select('*').eq('application_id',id).order('created_at',{ascending:false}).limit(200);if(r.error)throw r.error;return r.data as RecruitmentFile[]; },
    async file(id) { const r=await client.from('application_files').select('*').eq('id',id).maybeSingle();if(r.error)throw r.error;return r.data as RecruitmentFile|null; },
    async registerFile(input) { const r=await client.from('application_files').insert(input).select('*').single();if(r.error)throw r.error;return r.data as RecruitmentFile; },
    async jobs() { const r=await client.from('jobs').select(JOB_COLUMNS).order('created_at',{ascending:false}).limit(200); if(r.error)throw r.error; return r.data as RecruitmentJob[]; },
    async applications() { const r=await client.from('applications').select(APPLICATION_COLUMNS).order('created_at',{ascending:false}).limit(200); if(r.error)throw r.error; return r.data as RecruitmentApplication[]; },
    async apply(input) { const r=await client.from('applications').insert({...input,applicant_id:user!.id,contact_email:user!.email.toLowerCase(),university:'UIT'}).select(APPLICATION_COLUMNS).single(); if(r.error)throw r.error; return r.data as RecruitmentApplication; },
    async createJob(input) { const r=await client.from('jobs').insert({...input,created_by:user!.id}).select(JOB_COLUMNS).single(); if(r.error)throw r.error; return r.data as RecruitmentJob; },
  };
}
