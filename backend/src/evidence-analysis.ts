import { Worker } from 'node:worker_threads';
import type { EvidenceDeclaration, EvidencePage, EvidenceResult, EvidenceField, RecruitmentFile, RecruitmentApplication } from '../../shared/recruitment';
import { ApiError } from './recruitment-validation';
import { digest, readEvidence, type FileStorage } from './recruitment-files';
import type { RecruitmentStore } from './recruitment-store';

export const EVIDENCE_ENGINE='local-ocr-rules-v2';
export function validateDeclaration(value:unknown):EvidenceDeclaration {
  if(!value||typeof value!=='object'||Array.isArray(value))throw new ApiError(400,'Thông tin minh chứng không hợp lệ.');
  const d=value as Record<string,unknown>;
  const allowed=['credential','score','issued_on','reference','title','issuer','level'];
  if(Object.keys(d).some(k=>!allowed.includes(k)))throw new ApiError(400,'Thông tin minh chứng có trường không được phép.');
  const result:Record<string,string>={};
  for(const key of allowed) {
    const v=d[key];if(v===undefined||v==='')continue;
    if(typeof v!=='string'||v.length>240||/[\x00-\x1f]/.test(v))throw new ApiError(400,'Thông tin minh chứng quá dài hoặc không hợp lệ.');
    result[key]=v.trim();
  }
  if(result.level&&!['school','national','international'].includes(result.level))throw new ApiError(400,'Cấp thành tích không hợp lệ.');
  if(result.credential&&!['IELTS','TOEIC','TOEFL'].includes(result.credential))throw new ApiError(400,'Loại chứng chỉ chưa hỗ trợ.');
  if(result.score&&(!/^\d+(\.\d+)?$/.test(result.score)||Number(result.score)>990))throw new ApiError(400,'Điểm chứng chỉ không hợp lệ.');
  if(result.score&&result.credential) {
    const n=Number(result.score),max=result.credential==='IELTS'?9:result.credential==='TOEFL'?120:990;
    if(n>max||(result.credential==='IELTS'?n*2!==Math.floor(n*2):!Number.isInteger(n)))throw new ApiError(400,'Điểm không hợp lệ cho loại chứng chỉ này.');
  }
  if(result.issued_on&&!/^\d{4}-\d{2}-\d{2}$/.test(result.issued_on))throw new ApiError(400,'Ngày cấp không hợp lệ.');
  if(result.issued_on&&(!Number.isFinite(Date.parse(result.issued_on))||new Date(result.issued_on).toISOString().slice(0,10)!==result.issued_on))throw new ApiError(400,'Ngày cấp không tồn tại.');
  return result;
}
const normalized=(s:string)=>s.normalize('NFD').replace(/\p{M}/gu,'').replace(/[đĐ]/g,'d').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
export function claimsHash(app:RecruitmentApplication,file:RecruitmentFile) {
  const d=validateDeclaration(file.declared_fields??{});
  return digest(Buffer.from(JSON.stringify([EVIDENCE_ENGINE,app.full_name,...['credential','score','issued_on','reference','title','issuer','level'].map(k=>d[k as keyof EvidenceDeclaration]??'')])));
}
const patterns:Record<string,RegExp>={
  full_name:/^(?:full name|candidate(?:'s)? name|name|ho va ten|ten thi sinh)\s*[:：]\s*(.+)$/i,
  credential:/\b(IELTS|TOEIC|TOEFL)\b/i,
  score:/^(?:overall(?: band)?(?: score)?|total score|score|diem(?: tong)?|diem so)\s*[:：]\s*(\d+(?:[.,]\d+)?)(?:\s*\/\s*\d+)?\s*$/i,
  issued_on:/^(?:date of issue|issue date|ngay cap)\s*[:：]\s*(\d{4}-\d{2}-\d{2}|\d{1,2}[\/.]\d{1,2}[\/.]\d{4})\s*$/i,
  reference:/^(?:trf(?: number)?|certificate(?: number| id)?|reference|ma chung chi)\s*[:：]\s*([a-z0-9-]+)\s*$/i,
  title:/^(?:achievement|award|thanh tich|giai thuong)\s*[:：]\s*(.+)$/i,
  issuer:/^(?:issuer|issued by|don vi cap)\s*[:：]\s*(.+)$/i,
  level:/^(?:level|award level|cap|cap thanh tich|cap giai thuong)\s*[:：]\s*(.+)$/i,
};
const fieldLabels:Record<string,string>={full_name:'Họ và tên',credential:'Loại chứng chỉ',score:'Điểm',issued_on:'Ngày cấp',reference:'Mã chứng chỉ',title:'Thành tích',issuer:'Đơn vị cấp',level:'Cấp thành tích'};
function comparable(key:string,value:string) {
  if(key==='level'){const v=normalized(value);return ({school:'school','cap truong':'school',truong:'school',national:'national','cap quoc gia':'national','quoc gia':'national',international:'international','cap quoc te':'international','quoc te':'international'} as Record<string,string>)[v]??v;}
  if(key==='score')return String(Number(value.replace(',','.')));
  if(key==='reference')return normalized(value).replace(/ /g,'');
  if(key==='issued_on') {const m=value.match(/^(\d{1,2})[\/.](\d{1,2})[\/.](\d{4})$/);return m?`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`:value;}
  return normalized(value);
}
export function compareEvidence(app:RecruitmentApplication,file:RecruitmentFile,pages:EvidencePage[],partial=false):EvidenceResult {
  const declared:Record<string,string>={...validateDeclaration(file.declared_fields??{}),full_name:app.full_name};
  const keys=['full_name',...(file.kind==='english'?['credential','score']:file.kind==='achievement'?['title','issuer','level']:[])];
  for(const key of ['issued_on','reference'])if(declared[key])keys.push(key);
  const fields:EvidenceField[]=keys.map(key=>{
    const expected=declared[key]??'';
    const found:Array<{value:string;page:EvidencePage;excerpt:string}>=[];
    for(const page of pages)for(const line of page.text.split(/\n/)) {
      const plain=line.normalize('NFD').replace(/\p{M}/gu,'').replace(/[đĐ]/g,'d').trim();
      if(key==='credential') {for(const m of plain.matchAll(/\b(IELTS|TOEIC|TOEFL)\b/gi))found.push({value:m[1],page,excerpt:line.trim().slice(0,300)});continue;}
      const match=plain.match(patterns[key]);
      if(match)found.push({value:match[1].trim(),page,excerpt:line.trim().slice(0,300)});
    }
    const unique=[...new Set(found.map(f=>comparable(key,f.value)))];
    const candidate=found[0];
    const reliable=Boolean(candidate&&(candidate.page.confidence===null||candidate.page.confidence>=85));
    const outcome=!expected||!comparable(key,expected)||!candidate||unique.length!==1||!unique[0]||!reliable?'unclear':unique[0]===comparable(key,expected)?'match':'mismatch';
    return {key,label:fieldLabels[key],declared:expected,extracted:candidate?.value??null,outcome,page:candidate?.page.page??null,excerpt:candidate?.excerpt??''};
  });
  const readable=pages.some(p=>p.text.replace(/\s/g,'').length>=15);
  const status=!readable?'unreadable':fields.some(f=>f.outcome==='mismatch')?'mismatch':partial||fields.some(f=>f.outcome==='unclear')?'unclear':'matched';
  const notes=['Đối chiếu thông tin tự động, không xác nhận tính thật từ đơn vị cấp. Minh chứng ngoại ngữ/thành tích khớp đầy đủ và còn hiệu lực sẽ được tính điểm theo công thức; ngoại lệ cần HR xử lý. Không tự loại ứng viên.'];
  if(partial)notes.push('Chỉ đọc tối đa 5 trang; cần HR kiểm tra phần còn lại.');
  if(fields.some(f=>f.outcome==='unclear'))notes.push('Thiếu khai báo, không thấy nhãn thông tin rõ ràng, có nhiều giá trị hoặc OCR chưa đủ rõ; cần HR đối chiếu.');
  return {status,issuer_verified:false,fields,pages,partial,notes,engine:EVIDENCE_ENGINE};
}
export async function extractEvidence(bytes:Buffer,mime:string):Promise<{pages:EvidencePage[];partial:boolean}> {
  return new Promise((resolve,reject)=>{
    const worker=new Worker(new URL('./evidence-ocr-worker.mjs',import.meta.url),{workerData:{bytes,mime},execArgv:[],resourceLimits:{maxOldGenerationSizeMb:384}});
    let done=false;
    const finish=(error?:Error,value?:{pages:EvidencePage[];partial:boolean})=>{if(done)return;done=true;clearTimeout(timer);void worker.terminate();if(error)reject(error);else resolve(value!);};
    const timer=setTimeout(()=>finish(new ApiError(503,'Đọc minh chứng quá thời gian. HR có thể xem bản gốc hoặc thử lại.')),60000);
    worker.once('message',value=>finish(undefined,value));
    worker.once('error',()=>finish(new ApiError(503,'Không khởi chạy được bộ đọc minh chứng.')));
    worker.once('exit',()=>{if(!done)finish(new ApiError(503,'Bộ đọc minh chứng đã dừng.'));});
  });
}
let processing=false;
export async function checkEvidence(store:RecruitmentStore,storage:FileStorage,id:string,extract=extractEvidence,force=false) {
  const {file,bytes}=await readEvidence(store,storage,id);
  const app=await store.application(file.application_id);if(!app)throw new ApiError(404,'Không tìm thấy hồ sơ.');
  const hash=claimsHash(app,file),cached=await store.check(id);
  if(!force&&cached&&cached.claims_hash===hash&&cached.file_sha256===file.sha256)return {...cached,stale:false};
  if(processing)throw new ApiError(429,'Bộ đọc đang xử lý một tệp khác. Vui lòng thử lại sau.');
  processing=true;
  try {
    const read=await extract(bytes,file.mime_type);
    const result=compareEvidence(app,file,read.pages,read.partial);
    const check=await store.saveCheck({file_id:id,application_id:app.id,file_sha256:file.sha256,claims_hash:hash,claims_snapshot:{full_name:app.full_name,declaration:file.declared_fields??{}},created_by:store.user!.id,result});
    const current=await store.application(app.id);
    return {...check,stale:!current||claimsHash(current,file)!==hash};
  }finally{processing=false;}
}
