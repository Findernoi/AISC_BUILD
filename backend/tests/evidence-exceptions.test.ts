import test,{beforeEach,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import express from 'express';
import type {Server} from 'node:http';
import {initializeLocalRecruitment,localStore} from '../src/recruitment-local';
import {withIdentity} from '../src/database-preview';
import {compareEvidence,checkEvidence} from '../src/evidence-analysis';
import {uploadEvidence,type FileStorage} from '../src/recruitment-files';
import {createRecruitmentRouter} from '../src/recruitment-api';
import {makeEvidencePdf} from './fixtures/evidence-fixtures';
import type {RecruitmentStore} from '../src/recruitment-store';
import type {RecruitmentFile,EvidenceDeclaration,EvidencePage,RecruitmentApplication} from '../../shared/recruitment';
let db:PGlite,hr:RecruitmentStore,a:RecruitmentStore,b:RecruitmentStore,id:string,jobId:string,storage:FileStorage;
const text='TEST DATA ONLY\nName: NGUYEN AN\nIELTS\nOverall Band Score: 7.5';
const page=(text:string,confidence:number|null=null):EvidencePage=>({page:1,text,confidence,method:confidence===null?'pdf-text':'ocr'});
beforeEach(async()=>{
  db=new PGlite();await initializeLocalRecruitment(db);hr=await localStore('hr',db);a=await localStore('candidate_a',db);b=await localStore('candidate_b',db);
  const job=(await hr.jobs())[0];jobId=job.id;await db.query('update public.jobs set requirements=$1,min_gpa=3 where id=$2',[['Python','SQL'],jobId]);
  id=(await a.apply({job_id:jobId,full_name:'Nguyễn An',phone:'',major:'AI',gpa:4,gpa_scale:'4.0',graduation_year:2027,project_count:3,experience_months:6,skills:['Python','SQL'],project_description:''})).id;
  const files=new Map<string,Buffer>();storage={async put(k,v){files.set(k,v);},async get(k){return files.get(k)!;},async remove(k){files.delete(k);}};
});
afterEach(async()=>{await db.close();});
async function upload(kind:'english'|'achievement'='english',d:EvidenceDeclaration={credential:'IELTS',score:'7.5'}){return uploadEvidence(a,storage,id,makeEvidencePdf(text.split('\n')),'test.pdf',kind,d);}
async function read(f:RecruitmentFile,content=text,partial=false,confidence:number|null=null){return checkEvidence(a,storage,f.id,async()=>({pages:[page(content,confidence)],partial}),true);}
async function score(){return (await hr.roundOne({jobId,major:'all'})).rows.find(r=>r.application.id===id)!.score;}
test('fully matched current server result earns points without HR; matched files never enter exceptions',async()=>{
  const f=await upload();assert.equal((await hr.evidenceExceptions()).total,1);assert.equal((await score()).total,78);
  await read(f);assert.equal((await hr.evidenceAssessment(f.id))!.status,'automatic');assert.equal((await score()).total,90.5);assert.equal((await score()).evidenceAlerts,0);assert.equal((await hr.evidenceExceptions()).total,0);
  const rev=(await a.application(id))!.revision;assert.ok(rev>2);assert.equal((await a.application(id))!.status,'pending');
  const state=(await hr.evidenceAssessment(f.id))!;await assert.rejects(hr.resolveEvidence(f.id,{expectedBasis:state.basis,outcome:'accept',reason:'Unnecessary approval'}),/Stale/);
});
test('achievement level is required and compared; mismatch, partial, ambiguous and low-confidence results never auto-score',async()=>{
  const d={title:'AI Contest',issuer:'UIT',level:'national' as const},f=await upload('achievement',d);
  const content='TEST DATA ONLY\nName: NGUYEN AN\nAward: AI Contest\nIssuer: UIT\nLevel: National';
  for(const [value,partial,confidence] of [[content.replace('National','School'),false,null],[content.replace('\nLevel: National',''),false,null],[content,true,null],[content,false,70],[content+'\nLevel: International',false,null]] as const){await read(f,value,partial,confidence);assert.equal((await hr.evidenceAssessment(f.id))!.status,'exception');assert.equal((await score()).total,78);}
  await read(f,content);assert.equal((await hr.evidenceAssessment(f.id))!.status,'automatic');assert.equal((await score()).total,85);
  const comparison=compareEvidence({full_name:'Nguyễn An'} as RecruitmentApplication,{...f,declared_fields:d},[page(content.replace('National','Cấp quốc gia'))]);assert.equal(comparison.status,'matched');
});
test('HR resolves only exceptions with bound reason/actor; reject affects only evidence points and reread reopens stale resolution',async()=>{
  const f=await upload();await read(f,text.replace('7.5','6.0'));let state=(await hr.evidenceAssessment(f.id))!;
  await hr.resolveEvidence(f.id,{expectedBasis:state.basis,outcome:'accept',reason:'Đã xem tệp gốc; lỗi đọc điểm trong bản thử'});
  assert.equal((await hr.evidenceAssessment(f.id))!.status,'accepted');assert.equal((await score()).total,90.5);assert.equal((await hr.evidenceExceptions()).total,0);
  await assert.rejects(hr.resolveEvidence(f.id,{expectedBasis:state.basis,outcome:'reject',reason:'old'}),/Stale/);
  await read(f,text.replace('7.5','6.0'));state=(await hr.evidenceAssessment(f.id))!;assert.equal(state.status,'exception');
  await hr.resolveEvidence(f.id,{expectedBasis:state.basis,outcome:'reject',reason:'Không đủ căn cứ tính điểm'});assert.equal((await score()).total,78);assert.equal((await a.application(id))!.status,'pending');
  const review=await db.query<{reviewed_by:string;reference:string}>('select reviewed_by,reference from public.evidence_reviews where file_id=$1',[f.id]);assert.equal(review.rows[0].reviewed_by,hr.user!.id);assert.match(review.rows[0].reference,/Không đủ/);
});
test('new files, changed claims and OCR captured before a name edit invalidate automatic/manual points and stale HR submissions',async()=>{
  const f=await upload();await read(f);const original=await hr.evidenceAssessment(f.id);assert.equal(original!.status,'automatic');
  await db.query('update public.applications set full_name=$1 where id=$2',['Tran Binh',id]);assert.equal((await hr.evidenceAssessment(f.id))!.status,'exception');assert.equal((await score()).total,78);
  const stale=(await hr.evidenceAssessment(f.id))!;
  await read(f);await assert.rejects(hr.resolveEvidence(f.id,{expectedBasis:stale.basis,outcome:'accept',reason:'old result'}),/Stale/);
  await db.query('update public.applications set full_name=$1 where id=$2',['Nguyễn An',id]);
  await checkEvidence(a,storage,f.id,async()=>{await db.query('update public.applications set full_name=$1 where id=$2',['Changed during OCR',id]);return {pages:[page(text)],partial:false};},true);
  assert.equal((await hr.evidenceAssessment(f.id))!.status,'exception');
  const fresh=await upload();assert.equal((await hr.evidenceAssessment(f.id))!.status,'obsolete');assert.equal((await hr.evidenceAssessment(fresh.id))!.status,'exception');assert.equal((await score()).total,78);
});
test('A/B/HR isolation blocks queue, resolution and forged result/review writes; candidate reads own assessment only',async()=>{
  const f=await upload(),state=(await hr.evidenceAssessment(f.id))!;
  assert.ok(await a.evidenceAssessment(f.id));assert.equal(await b.evidenceAssessment(f.id),null);
  for(const candidate of [a,b]){await assert.rejects(candidate.evidenceExceptions(),/HR access required/);await assert.rejects(candidate.resolveEvidence(f.id,{expectedBasis:state.basis,outcome:'accept',reason:'forged'}),/HR access required/);}
  await assert.rejects(withIdentity(db,'hr',tx=>tx.query("insert into public.evidence_reviews(file_id,application_id,file_sha256,status,reference) values($1,$2,$3,'verified','bypass')",[f.id,id,f.sha256])),/permission denied/);
  await assert.rejects(withIdentity(db,'candidate_a',tx=>tx.query('insert into public.evidence_checks(file_id,application_id,file_sha256,claims_hash,created_by,result) values($1,$2,$3,$4,$5,$6)',[f.id,id,f.sha256,'a'.repeat(64),a.user!.id,JSON.stringify({status:'matched',issuer_verified:false})])),/permission denied/);
});
test('OCR/review changes invalidate saved hiring basis while preserving decision history',async()=>{
  await hr.invite([id],{jobId,major:'all'});
  await hr.saveRoundTwo(id,{kind:'coding',expectedRevision:(await hr.roundTwo(id))!.revision,data:{score:80,notes:''}});
  const scores={technical:8,reasoning:8,learning:8,projects:8,communication:8},evidence={technical:'a',reasoning:'a',learning:'a',projects:'a',communication:'a'};
  await hr.saveRoundTwo(id,{kind:'interview',expectedRevision:(await hr.roundTwo(id))!.revision,data:{scores,evidence}});
  const weights={roundOne:30,coding:30,interview:40};const r=(await hr.hiringReport(id,weights))!;
  const decision=await hr.decide(id,{expectedBasis:r.basis,weights,result:'reserve',reason:'Dữ liệu thử'});
  const f=await upload();await read(f);const next=(await hr.hiringReport(id,weights))!;assert.notEqual(next.basis,decision.source_basis);assert.equal(next.roundOne,90.5);assert.equal(next.history[0].id,decision.id);
});
test('HTTP queue/read/resolve enforce role, strict input and conflicts',async()=>{
  const f=await upload();await read(f,text.replace('7.5','6.0'));const app=express();app.use('/api/recruitment',express.json(),createRecruitmentRouter({local:true,database:async()=>db,storage}));
  const server=await new Promise<Server>(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});const origin=`http://127.0.0.1:${(server.address() as {port:number}).port}`,cookies:Record<string,string>={};
  const call=(path:string,who:string,body?:unknown)=>fetch(origin+'/api/recruitment'+path,{method:body===undefined?'GET':'POST',headers:{Origin:origin,...(cookies[who]?{Cookie:cookies[who]}:{}),...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})});
  try{for(const who of ['candidate_a','candidate_b','hr']){const r=await call('/local-session',who,{identity:who});cookies[who]=r.headers.get('set-cookie')!.split(';')[0];await r.json();}
    assert.equal((await call('/evidence-exceptions','')).status,401);assert.equal((await call('/evidence-exceptions','candidate_a')).status,403);
    const q=await (await call('/evidence-exceptions','hr')).json();assert.equal(q.report.total,1);
    const input={expectedBasis:q.report.rows[0].assessment.basis,outcome:'accept',reason:'Đã đối chiếu bản gốc thử nghiệm'},path=`/files/${f.id}/resolve-exception`;
    assert.equal((await call(path,'candidate_a',input)).status,403);assert.equal((await call(path,'hr',{...input,reviewed_by:'fake'})).status,400);assert.equal((await call(path,'hr',input)).status,200);assert.equal((await call(path,'hr',input)).status,409);
    assert.equal((await call(`/files/${f.id}/check`,'candidate_b')).status,404);
    assert.equal((await (await call('/evidence-exceptions','hr')).json()).report.total,0);
  }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
