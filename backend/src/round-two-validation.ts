import type { RoundTwoMutation,InterviewCriterion } from '../../shared/recruitment';
import { ApiError } from './recruitment-validation';
const keys:InterviewCriterion[]=['technical','reasoning','learning','projects','communication'];
function object(value:unknown,allowed:string[]):Record<string,unknown> {
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!allowed.includes(k)))throw new ApiError(400,'Dữ liệu vòng 2 có trường không hợp lệ.');
  return value as Record<string,unknown>;
}
function text(value:unknown,max:number,required=false):string {
  if(typeof value!=='string'||value.length>max||(required&&!value.trim()))throw new ApiError(400,'Nhập đủ thông tin vòng 2 và tuân thủ giới hạn độ dài.');return value.trim();
}
function score(value:unknown,min:number,max:number):number {
  if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max||Math.abs(value*10-Math.round(value*10))>1e-8)throw new ApiError(400,`Điểm phải từ ${min} đến ${max}, tối đa một chữ số thập phân.`);return value;
}
export function validateRoundTwo(value:unknown):RoundTwoMutation {
  const body=object(value,['expectedRevision','kind','data']);
  const expectedRevision=body.expectedRevision;
  if(typeof expectedRevision!=='number'||!Number.isSafeInteger(expectedRevision)||expectedRevision<1)throw new ApiError(400,'Thiếu phiên bản hồ sơ. Hãy tải lại vòng 2.');
  if(body.kind==='schedule') {
    const d=object(body.data,['starts_at','duration_minutes','location','interviewer','instructions']);
    const starts_at=text(d.starts_at,40,true);
    if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/.test(starts_at)||!Number.isFinite(Date.parse(starts_at)))throw new ApiError(400,'Lịch phỏng vấn cần ngày giờ kèm múi giờ.');
    const duration_minutes=d.duration_minutes;
    if(typeof duration_minutes!=='number'||!Number.isInteger(duration_minutes)||duration_minutes<5||duration_minutes>480)throw new ApiError(400,'Thời lượng từ 5 đến 480 phút.');
    return {expectedRevision,kind:'schedule',data:{starts_at:new Date(starts_at).toISOString(),duration_minutes,location:text(d.location,1000,true),interviewer:text(d.interviewer,160,true),instructions:text(d.instructions,5000)}};
  }
  if(body.kind==='coding') {
    const d=object(body.data,['score','notes']);return {expectedRevision,kind:'coding',data:{score:score(d.score,0,100),notes:text(d.notes,5000)}};
  }
  if(body.kind==='interview') {
    const d=object(body.data,['scores','evidence']),scores=object(d.scores,keys),evidence=object(d.evidence,keys);
    return {expectedRevision,kind:'interview',data:{scores:Object.fromEntries(keys.map(k=>[k,score(scores[k],1,10)])) as Record<InterviewCriterion,number>,evidence:Object.fromEntries(keys.map(k=>[k,text(evidence[k],3000,true)])) as Record<InterviewCriterion,string>}};
  }
  throw new ApiError(400,'Thao tác vòng 2 không hợp lệ.');
}
