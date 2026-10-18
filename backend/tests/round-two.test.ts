import test,{beforeEach,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import express from 'express';
import type {Server} from 'node:http';
import {initializeLocalRecruitment,localStore} from '../src/recruitment-local';
import {withIdentity} from '../src/database-preview';
import {createRecruitmentRouter} from '../src/recruitment-api';
import {validateRoundTwo} from '../src/round-two-validation';
import type {RecruitmentStore} from '../src/recruitment-store';
import type {InterviewEvaluationInput,InterviewScheduleInput} from '../../shared/recruitment';
import {interviewScore} from '../../frontend/src/lib/recruitment';
let db:PGlite,hr:RecruitmentStore,id:string;
const schedule:InterviewScheduleInput={starts_at:'2026-10-20T09:00:00+07:00',duration_minutes:60,location:'Phòng thử nghiệm',interviewer:'HR mẫu',instructions:'Chuẩn bị dự án mẫu.'};
const evaluation:InterviewEvaluationInput={scores:{technical:8.2,reasoning:7.4,learning:9,projects:6,communication:8},evidence:{technical:'Giải thích kiến trúc',reasoning:'Xét trường hợp biên',learning:'Tiếp thu gợi ý',projects:'Mô tả vai trò',communication:'Trình bày rõ'}};
beforeEach(async()=>{
  db=new PGlite();await initializeLocalRecruitment(db);hr=await localStore('hr',db);
  const candidate=await localStore('candidate_a',db),job=(await hr.jobs())[0];
  await db.query('update public.jobs set requirements=$1,min_gpa=3 where id=$2',[['Python','SQL'],job.id]);
  const app=await candidate.apply({job_id:job.id,full_name:'Ứng viên thử vòng 2',phone:'',major:'AI',gpa:4,gpa_scale:'4.0',graduation_year:2027,project_count:3,experience_months:6,skills:['Python','SQL'],project_description:''});
  id=app.id;await hr.invite([id],{jobId:job.id,major:'all'});
});
afterEach(async()=>{await db.close();});
async function revision(){return (await hr.roundTwo(id))!.revision;}
test('schedule and evaluations persist with database weighted score, actor and revision; zero coding is valid',async()=>{
  const initial=await revision();await hr.saveRoundTwo(id,{expectedRevision:initial,kind:'schedule',data:schedule});
  assert.equal(await revision(),initial+1);
  const stored=(await hr.roundTwo(id))!.schedule!;assert.equal(new Date(stored.starts_at).toISOString(),'2026-10-20T02:00:00.000Z');assert.equal(stored.updated_by,hr.user!.id);
  await hr.saveRoundTwo(id,{expectedRevision:await revision(),kind:'coding',data:{score:0,notes:'Điểm 0 hợp lệ'}});
  await hr.saveRoundTwo(id,{expectedRevision:await revision(),kind:'interview',data:evaluation});
  const result=(await hr.roundTwo(id))!;assert.equal(Number(result.coding!.score),0);assert.equal(result.interview!.reviewed_by,hr.user!.id);
  assert.equal(Math.round(Number(result.interview!.overall_score)*10)/10,interviewScore(evaluation.scores));
  await initializeLocalRecruitment(db);assert.deepEqual(await hr.roundTwo(id),result);
});
test('candidate sees own schedule but never internal scores; other candidates and anonymous see no application',async()=>{
  await hr.saveRoundTwo(id,{expectedRevision:await revision(),kind:'schedule',data:schedule});
  await hr.saveRoundTwo(id,{expectedRevision:await revision(),kind:'interview',data:evaluation});
  const a=await localStore('candidate_a',db),b=await localStore('candidate_b',db);
  const own=(await a.roundTwo(id))!;assert.ok(own.schedule);assert.equal(own.interview,null);assert.equal(own.coding,null);assert.equal(await b.roundTwo(id),null);
  await assert.rejects((await localStore('anonymous',db)).roundTwo(id),/permission denied/);
  await assert.rejects(a.saveRoundTwo(id,{expectedRevision:await revision(),kind:'schedule',data:schedule}),/HR access required/);
  await assert.rejects(withIdentity(db,'hr',tx=>tx.query('insert into public.coding_evaluations(application_id,score) values($1,100)',[id])),/permission denied/);
});
test('stale writes, non-interview stages and invalid database payloads do not alter saved result',async()=>{
  const old=await revision();await hr.saveRoundTwo(id,{expectedRevision:old,kind:'schedule',data:schedule});
  await assert.rejects(hr.saveRoundTwo(id,{expectedRevision:old,kind:'coding',data:{score:90,notes:''}}),/Stale/);
  assert.equal((await hr.roundTwo(id))!.coding,null);
  for(const data of [{...evaluation,scores:{...evaluation.scores,technical:10.04}},{...evaluation,evidence:{...evaluation.evidence,technical:''}},{...evaluation,scores:{...evaluation.scores,overall_score:100}}]) {
    await assert.rejects(hr.saveRoundTwo(id,{expectedRevision:await revision(),kind:'interview',data}),/Invalid|Missing/);
  }
  assert.equal((await hr.roundTwo(id))!.interview,null);
  await db.query("update public.applications set stage='withdrawn' where id=$1",[id]);
  await assert.rejects(hr.saveRoundTwo(id,{expectedRevision:await revision(),kind:'coding',data:{score:10,notes:''}}),/not in interview/);
});
test('API validation rejects forged actors, totals, missing evidence and ambiguous dates',()=>{
  const input={kind:'schedule',expectedRevision:1,data:schedule};assert.equal(validateRoundTwo(input).kind,'schedule');
  for(const invalid of [{...input,reviewed_by:'forged'},{...input,expectedRevision:0},{...input,data:{...schedule,starts_at:'2026-10-20T09:00'}},{...input,data:{...schedule,duration_minutes:0}},{kind:'coding',expectedRevision:1,data:{score:100.01,notes:''}},{kind:'interview',expectedRevision:1,data:{...evaluation,overall_score:100}},{kind:'interview',expectedRevision:1,data:{...evaluation,evidence:{technical:'only'}}}])assert.throws(()=>validateRoundTwo(invalid));
});
test('schedule validation rejects impossible dates instead of normalizing them and preserves timezone instants',()=>{
  const input={kind:'schedule',expectedRevision:1,data:schedule};
  for(const starts_at of ['2026-02-31T09:00:00+07:00','2026-02-29T09:00:00Z','2026-04-31T09:00Z','2026-10-20T24:00Z','2026-10-20T09:60Z'])assert.throws(()=>validateRoundTwo({...input,data:{...schedule,starts_at}}));
  const valid=validateRoundTwo({...input,data:{...schedule,starts_at:'2028-02-29T09:00:00+07:00'}});
  assert.equal(valid.kind,'schedule');if(valid.kind==='schedule')assert.equal(valid.data.starts_at,'2028-02-29T02:00:00.000Z');
});
test('HTTP round-two endpoints enforce identity, validation and conflict status',async()=>{
  const app=express();app.use('/api/recruitment',express.json(),createRecruitmentRouter({local:true,database:async()=>db}));
  const server=await new Promise<Server>(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
  const origin=`http://127.0.0.1:${(server.address() as {port:number}).port}`,cookies:Record<string,string>={};
  const call=(path:string,identity:string,body?:unknown)=>fetch(origin+'/api/recruitment'+path,{method:body===undefined?'GET':'POST',headers:{Origin:origin,...(cookies[identity]?{Cookie:cookies[identity]}:{}),...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})});
  try{
    for(const identity of ['candidate_a','candidate_b','hr']){const r=await call('/local-session',identity,{identity});cookies[identity]=r.headers.get('set-cookie')!.split(';')[0];await r.json();}
    const path=`/applications/${id}/round-two`,input={kind:'schedule',expectedRevision:await revision(),data:schedule};
    assert.equal((await call(path,'')).status,401);assert.equal((await call(path,'candidate_b')).status,404);assert.equal((await call(path,'candidate_a',input)).status,403);
    assert.equal((await call(path,'hr',{...input,overall_score:100})).status,400);
    assert.equal((await call(path,'hr',input)).status,200);assert.equal((await call(path,'hr',input)).status,409);
    const own=await (await call(path,'candidate_a')).json();assert.ok(own.report.schedule);assert.equal(own.report.interview,null);
  }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
