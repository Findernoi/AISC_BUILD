import test,{beforeEach,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import express from 'express';
import type {Server} from 'node:http';
import {initializeLocalRecruitment,localStore} from '../src/recruitment-local';
import {withIdentity} from '../src/database-preview';
import {createRecruitmentRouter} from '../src/recruitment-api';
import {validateHiringDecision,validateHiringWeights} from '../src/hiring-validation';
import type {RecruitmentStore} from '../src/recruitment-store';
import type {HiringWeights,InterviewEvaluationInput,HiringDecisionInput} from '../../shared/recruitment';
import {finalScore} from '../../frontend/src/lib/recruitment';
import type {Candidate,JobPosting} from '../../frontend/src/types';
let db:PGlite,hr:RecruitmentStore,id:string,jobId:string;
const weights:HiringWeights={roundOne:30,coding:30,interview:40};
const evaluation:InterviewEvaluationInput={scores:{technical:8,reasoning:7,learning:9,projects:8,communication:8},evidence:{technical:'Nền tảng',reasoning:'Trường hợp biên',learning:'Tiếp thu gợi ý',projects:'Vai trò',communication:'Trình bày'}};
beforeEach(async()=>{
  db=new PGlite();await initializeLocalRecruitment(db);hr=await localStore('hr',db);
  const candidate=await localStore('candidate_a',db),job=(await hr.jobs())[0];jobId=job.id;
  await db.query('update public.jobs set requirements=$1,min_gpa=3 where id=$2',[['Python','SQL'],job.id]);
  const app=await candidate.apply({job_id:job.id,full_name:'Hồ sơ thử quyết định',phone:'',major:'AI',gpa:4,gpa_scale:'4.0',graduation_year:2027,project_count:3,experience_months:6,skills:['Python','SQL'],project_description:''});
  id=app.id;await hr.invite([id],{jobId,major:'all'});
});
afterEach(async()=>{await db.close();});
async function complete(coding=82) {
  await hr.saveRoundTwo(id,{expectedRevision:(await hr.roundTwo(id))!.revision,kind:'coding',data:{score:coding,notes:'Điểm thử'}});
  await hr.saveRoundTwo(id,{expectedRevision:(await hr.roundTwo(id))!.revision,kind:'interview',data:evaluation});
}
async function input(result:HiringDecisionInput['result']='hire',custom=weights):Promise<HiringDecisionInput> {
  return {expectedBasis:(await hr.hiringReport(id,custom))!.basis,weights:custom,result,reason:'Lý do thử theo kết quả đánh giá'};
}
test('requires complete evaluations even at zero weight; zero coding is valid and formula matches demo',async()=>{
  let report=(await hr.hiringReport(id,weights))!;assert.equal(report.finalScore,null);assert.equal(report.reasons.length,2);
  await assert.rejects(hr.decide(id,await input()),/Incomplete/);assert.equal((await hr.application(id))!.stage,'interview');
  assert.equal((await hr.hiringReport(id,{roundOne:100,coding:0,interview:0}))!.finalScore,null);
  await complete(0);report=(await hr.hiringReport(id,weights))!;assert.equal(report.roundOne,78);assert.equal(report.coding,0);assert.equal(report.interview,79);assert.equal(report.finalScore,55);
  const candidate={email:'a@gm.uit.edu.vn',major:'AI',gpa:4,gpaScale:'4.0',techBadges:['Python','SQL'],projectCount:3,experienceMonths:6,englishCert:{type:'None',score:''},invitation:{invitedBy:'HR'},manualCodingEvaluation:{score:0,reviewedBy:'HR'},interviewEvaluation:{reviewer:'HR',scores:evaluation.scores,evidence:evaluation.evidence}} as unknown as Candidate;
  assert.equal(report.finalScore,finalScore(candidate,{requirements:['Python','SQL'],minGpa:3} as JobPosting,{aiWeight:30,assessmentWeight:30,hrWeight:40}));
});
test('snapshot and offer transition are atomic, actor and scores server-owned, history immutable and redecision explicit',async()=>{
  await complete();const request=await input(),decision=await hr.decide(id,request);
  assert.equal(Number(decision.final_score),79.6);assert.equal(Number(decision.round_one_score),78);assert.equal(decision.decided_by,hr.user!.id);
  const app=(await hr.application(id))!;assert.equal(app.stage,'offer');assert.equal(app.status,'passed');assert.equal(Number(decision.application_revision),app.revision);
  let report=(await hr.hiringReport(id,weights))!;assert.equal(report.history.length,1);assert.equal(report.basis,decision.source_basis);
  await assert.rejects(hr.decide(id,request),/Stale/);assert.equal((await hr.hiringReport(id,weights))!.history.length,1);
  await hr.decide(id,await input('reserve',{roundOne:20,coding:40,interview:40}));
  assert.equal((await hr.application(id))!.status,'hold');assert.equal((await hr.application(id))!.stage,'interview');
  const latest=await hr.decide(id,await input('reject'));assert.equal((await hr.application(id))!.status,'rejected');
  report=(await hr.hiringReport(id,weights))!;assert.equal(report.history.length,3);assert.equal(report.history[0].id,latest.id);assert.deepEqual(report.history[2],decision);
  await initializeLocalRecruitment(db);assert.deepEqual((await hr.hiringReport(id,weights))!.history,report.history);
});
test('basis detects score, application and job changes; invalid result rolls back and decisions cannot be forged directly',async()=>{
  await complete();let request=await input();
  await db.query("update public.jobs set title=title||' new' where id=$1",[jobId]);await assert.rejects(hr.decide(id,request),/Stale/);
  request=await input();await db.query('update public.coding_evaluations set score=0 where application_id=$1',[id]);await assert.rejects(hr.decide(id,request),/Stale/);
  request=await input();await db.query("update public.applications set phone='new' where id=$1",[id]);await assert.rejects(hr.decide(id,request),/Stale/);
  await assert.rejects(hr.decide(id,{...await input(),result:'fake' as 'hire'}),/Invalid/);
  assert.equal((await hr.application(id))!.stage,'interview');assert.equal((await hr.hiringReport(id,weights))!.history.length,0);
  await assert.rejects(withIdentity(db,'hr',tx=>tx.query("insert into public.hiring_decisions(application_id,result,reason,round_one_score) values($1,'hire','forged',100)",[id])),/permission denied/);
});
test('closed job, low GPA and withdrawn/accepted applications cannot receive decisions',async()=>{
  await complete();await db.query("update public.jobs set status='closed' where id=$1",[jobId]);assert.equal((await hr.hiringReport(id,weights))!.finalScore,null);await assert.rejects(hr.decide(id,await input()),/Incomplete/);
  await db.query("update public.jobs set status='active',min_gpa=4 where id=$1",[jobId]);await db.query('update public.applications set gpa=3 where id=$1',[id]);assert.ok((await hr.hiringReport(id,weights))!.reasons.some(r=>r.includes('GPA')));
  await db.query('update public.applications set gpa=4 where id=$1',[id]);
  for(const stage of ['withdrawn','accepted']){await db.query('update public.applications set stage=$1 where id=$2',[stage,id]);await assert.rejects(hr.decide(id,await input()),/Incomplete/);}
});
test('candidates cannot read scores, reasons or history, call HR RPCs or write decisions',async()=>{
  await complete();await hr.decide(id,await input());
  for(const identity of ['candidate_a','candidate_b'] as const){const candidate=await localStore(identity,db);await assert.rejects(candidate.hiringReport(id,weights),/HR access required/);await assert.rejects(candidate.decide(id,await input()),/HR access required/);const rows=await withIdentity(db,identity,tx=>tx.query('select * from public.hiring_decisions'));assert.equal(rows.rows.length,0);}
});
test('validates weights, reason and basis and rejects caller-supplied totals or actors',()=>{
  assert.deepEqual(validateHiringWeights(weights),weights);
  for(const bad of [{roundOne:30,coding:30,interview:30},{...weights,extra:0},{...weights,coding:'30'},{roundOne:100,coding:-1,interview:1},{roundOne:29.5,coding:30.5,interview:40}])assert.throws(()=>validateHiringWeights(bad));
  const valid={expectedBasis:'a'.repeat(32),weights,result:'hire',reason:'Có căn cứ'};assert.equal(validateHiringDecision(valid).result,'hire');
  for(const bad of [{...valid,final_score:100},{...valid,decided_by:'fake'},{...valid,reason:' '},{...valid,result:'accepted'},{...valid,expectedBasis:''}])assert.throws(()=>validateHiringDecision(bad));
});
test('HTTP endpoints reject candidates, forged fields and stale basis with 409',async()=>{
  await complete();const app=express();app.use('/api/recruitment',express.json(),createRecruitmentRouter({local:true,database:async()=>db}));
  const server=await new Promise<Server>(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
  const origin=`http://127.0.0.1:${(server.address() as {port:number}).port}`,cookies:Record<string,string>={};
  const call=(path:string,identity:string,body?:unknown)=>fetch(origin+'/api/recruitment'+path,{method:body===undefined?'GET':'POST',headers:{Origin:origin,...(cookies[identity]?{Cookie:cookies[identity]}:{}),...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})});
  try{
    for(const identity of ['candidate_a','candidate_b','hr']){const r=await call('/local-session',identity,{identity});cookies[identity]=r.headers.get('set-cookie')!.split(';')[0];await r.json();}
    const path=`/applications/${id}/hiring`,request=await input();
    assert.equal((await call(path,'')).status,401);assert.equal((await call(path,'candidate_a')).status,403);assert.equal((await call(path,'candidate_b',request)).status,403);
    assert.equal((await call(path+'?coding=90','hr')).status,400);assert.equal((await call(path,'hr',{...request,final_score:100})).status,400);
    assert.equal((await call(path,'hr',request)).status,201);assert.equal((await call(path,'hr',request)).status,409);
    const payload=await (await call(path,'hr')).json();assert.equal(payload.report.history.length,1);assert.equal(payload.report.history[0].result,'hire');
  }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
