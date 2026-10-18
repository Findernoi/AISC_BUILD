import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type {Server} from 'node:http';
import {PGlite} from '@electric-sql/pglite';
import {initializeLocalRecruitment} from '../src/recruitment-local';
import {createRecruitmentRouter} from '../src/recruitment-api';
import {makeEvidencePdf} from './fixtures/evidence-fixtures';
import type {FileStorage} from '../src/recruitment-files';

test('A/B/HR full API flow: private files, actual PDF reading, exceptions, invitation, interview and immutable decision',async()=>{
  const db=new PGlite();await initializeLocalRecruitment(db);
  const objects=new Map<string,Buffer>();const storage:FileStorage={async put(k,v){objects.set(k,v);},async get(k){return objects.get(k)!;},async remove(k){objects.delete(k);}};
  const app=express();app.use('/api/recruitment',express.json({limit:'32kb'}),createRecruitmentRouter({local:true,database:async()=>db,storage}));
  const server=await new Promise<Server>(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
  const origin=`http://127.0.0.1:${(server.address() as {port:number}).port}`,base=origin+'/api/recruitment',cookies:Record<string,string>={};
  const raw=(path:string,who:string,body?:unknown)=>fetch(base+path,{method:body===undefined?'GET':'POST',headers:{Origin:origin,...(cookies[who]?{Cookie:cookies[who]}:{}),...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})});
  const call=async(path:string,who:string,body?:unknown)=>{const r=await raw(path,who,body);const data=await r.json();return {status:r.status,data};};
  const ok=async(path:string,who:string,body?:unknown)=>{const r=await call(path,who,body);assert.ok(r.status>=200&&r.status<300,JSON.stringify({path,...r}));return r.data;};
  const file=async(id:string,kind:string,name:string,lines:string[],declaration={})=>{
    const r=await fetch(base+`/applications/${id}/files?kind=${kind}`,{method:'POST',headers:{Origin:origin,Cookie:cookies.candidate_a,'Content-Type':'application/octet-stream','X-File-Name':encodeURIComponent(name),'X-Evidence-Declaration':encodeURIComponent(JSON.stringify(declaration))},body:makeEvidencePdf(lines)});
    assert.equal(r.status,201);return (await r.json()).file;
  };
  try{
    assert.equal((await call('/applications','')).status,401);
    for(const who of ['candidate_a','candidate_b','hr']){const r=await raw('/local-session',who,{identity:who});assert.equal(r.status,200);cookies[who]=r.headers.get('set-cookie')!.split(';')[0];await r.json();}
    const job=(await ok('/jobs','hr',{title:'Kiểm thử toàn luồng',department:'AI',description:'Dữ liệu giả trong database kiểm thử',location:'Local',min_gpa:3,requirements:['Python','SQL']})).job;
    const input={job_id:job.id,full_name:'Nguyễn An',phone:'',major:'AI',gpa:4,gpa_scale:'4.0',graduation_year:2027,project_count:3,experience_months:6,skills:['Python','SQL'],project_description:'Dự án mẫu'};
    const a=(await ok('/applications','candidate_a',input)).application;
    const b=(await ok('/applications','candidate_b',{...input,full_name:'Trần Bình',gpa:3,project_count:0,experience_months:0,skills:[]})).application;
    assert.equal((await call('/applications','candidate_a',input)).status,409);
    assert.deepEqual((await ok('/applications','candidate_a')).applications.map((r:any)=>r.id),[a.id]);
    assert.deepEqual((await ok('/applications','candidate_b')).applications.map((r:any)=>r.id),[b.id]);
    assert.equal((await ok('/applications','hr')).applications.length,2);
    const cv=await file(a.id,'cv','cv.pdf',['TEST DATA ONLY','Name: NGUYEN AN','Projects: Python SQL']);
    const english=await file(a.id,'english','english.pdf',['TEST DATA ONLY','Name: NGUYEN AN','IELTS','Overall Band Score: 7.5'],{credential:'IELTS',score:'7.5'});
    const achievement=await file(a.id,'achievement','award.pdf',['TEST DATA ONLY','Name: NGUYEN AN','Award: AI Contest','Issuer: UIT Demo','Level: School'],{title:'AI Contest',issuer:'UIT Demo',level:'national'});
    for(const path of [`/applications/${a.id}/files`,`/files/${cv.id}/check`,`/files/${english.id}/content`]){assert.equal((await raw(path,'candidate_b')).status,404);assert.equal((await raw(path,'')).status,401);}
    for(const who of ['candidate_a','hr']){const response=await raw(`/files/${cv.id}/content`,who);assert.equal(response.status,200);assert.match(Buffer.from(await response.arrayBuffer()).toString(),/TEST DATA ONLY/);}
    const matched=await ok(`/files/${english.id}/check`,'candidate_a',{});assert.equal(matched.assessment.status,'automatic');assert.equal(matched.check.result.issuer_verified,false);
    const mismatch=await ok(`/files/${achievement.id}/check`,'candidate_a',{});assert.equal(mismatch.assessment.status,'exception');assert.equal(mismatch.check.result.fields.find((f:any)=>f.key==='level').outcome,'mismatch');
    const queue=(await ok('/evidence-exceptions','hr')).report;assert.equal(queue.total,1);assert.equal(queue.rows[0].file.id,achievement.id);
    assert.equal((await call('/evidence-exceptions','candidate_a')).status,403);
    const resolution={expectedBasis:queue.rows[0].assessment.basis,outcome:'reject',reason:'Cấp khai báo không khớp tệp thử'};
    assert.equal((await call(`/files/${achievement.id}/resolve-exception`,'candidate_b',resolution)).status,403);
    await ok(`/files/${achievement.id}/resolve-exception`,'hr',resolution);
    assert.equal((await ok('/evidence-exceptions','hr')).report.total,0);
    assert.equal((await ok('/applications','candidate_a')).applications[0].status,'pending');
    let report=(await ok(`/round-one?jobId=${job.id}`,'hr')).report;
    const first=report.rows.find((r:any)=>r.application.id===a.id),second=report.rows.find((r:any)=>r.application.id===b.id);
    assert.equal(first.score.total,90.5);assert.equal(first.inTopTen,true);assert.equal(second.inTopTen,false);
    const invite={applicationIds:[a.id],jobId:job.id,major:'all'};
    assert.equal((await call('/round-one/invitations','candidate_a',invite)).status,403);
    await ok('/round-one/invitations','hr',invite);
    assert.equal((await ok('/invitations','candidate_a')).invitations.length,1);assert.equal((await ok('/invitations','candidate_b')).invitations.length,0);
    const path=`/applications/${a.id}/round-two`;
    const revision=(await ok(path,'hr')).report.revision;
    const schedule={kind:'schedule',expectedRevision:revision,data:{starts_at:'2026-10-20T09:00:00+07:00',duration_minutes:60,location:'Phòng thử',interviewer:'HR mẫu',instructions:'Chỉ thử nghiệm'}};
    assert.equal((await call(path,'hr',{...schedule,data:{...schedule.data,starts_at:'2026-02-31T09:00:00+07:00'}})).status,400);
    await ok(path,'hr',schedule);assert.equal((await call(path,'hr',schedule)).status,409);
    for(const mutation of [{kind:'coding',data:{score:0,notes:'Điểm 0 hợp lệ'}},{kind:'interview',data:{scores:{technical:8,reasoning:8,learning:8,projects:8,communication:8},evidence:{technical:'Kiến thức',reasoning:'Lập luận',learning:'Học hỏi',projects:'Dự án',communication:'Trình bày'}}}]){
      await ok(path,'hr',{...mutation,expectedRevision:(await ok(path,'hr')).report.revision});
    }
    const candidateRound=(await ok(path,'candidate_a')).report;assert.ok(candidateRound.schedule);assert.equal(candidateRound.coding,null);assert.equal(candidateRound.interview,null);assert.equal((await call(path,'candidate_b')).status,404);
    const hiring=`/applications/${a.id}/hiring`,summary=(await ok(hiring,'hr')).report;
    assert.equal(summary.finalScore,59.15);assert.equal(summary.coding,0);
    const decisionInput={expectedBasis:summary.basis,weights:summary.weights,result:'hire',reason:'Quyết định HR thử nghiệm, không tự chọn theo điểm'};
    assert.equal((await call(hiring,'candidate_a',decisionInput)).status,403);
    const decision=(await ok(hiring,'hr',decisionInput)).decision;
    assert.equal(Number(decision.final_score),59.15);assert.equal((await call(hiring,'hr',decisionInput)).status,409);
    const own=(await ok('/applications','candidate_a')).applications[0];assert.equal(own.stage,'offer');assert.equal(own.status,'passed');assert.notEqual(own.stage,'accepted');
    assert.equal((await call(hiring,'candidate_a')).status,403);assert.equal((await call(hiring,'candidate_b')).status,403);
    const beforeReread=(await ok(hiring,'hr')).report;
    await ok(`/files/${english.id}/check`,'candidate_a',{force:true});
    assert.equal((await call(hiring,'hr',{...decisionInput,expectedBasis:beforeReread.basis})).status,409);
    const afterReread=(await ok(hiring,'hr')).report;assert.notEqual(afterReread.basis,decision.source_basis);assert.equal(afterReread.history.length,1);assert.deepEqual(afterReread.history[0],decision);
    report=(await ok(`/round-one?jobId=${job.id}`,'hr')).report;assert.equal(report.rows.find((r:any)=>r.application.id===a.id).inTopTen,false);
    // HR re-approves the changed basis before issuing terms; candidate acceptance completes the flow.
    const freshDecision=(await ok(hiring,'hr',{...decisionInput,expectedBasis:afterReread.basis})).decision;
    const currentBasis=(await ok(hiring,'hr')).report.basis;
    const offerId=(await ok(`/applications/${a.id}/offers`,'hr',{expectedOfferId:null,expectedDecisionId:freshDecision.id,expectedBasis:currentBasis,positionTitle:'Thực tập sinh kiểm thử',startDate:'2026-11-02',content:'Offer thử trong ứng dụng, không gửi email'})).id;
    assert.equal((await ok('/offers','candidate_a')).offers[0].actionable,true);assert.equal((await ok('/offers','candidate_b')).offers.length,0);
    assert.equal((await call(`/offers/${offerId}/respond`,'candidate_b',{expectedRevision:1,outcome:'accepted',note:''})).status,404);
    await ok(`/offers/${offerId}/respond`,'candidate_a',{expectedRevision:1,outcome:'accepted',note:'Đồng ý offer thử'});
    assert.equal((await ok('/applications','candidate_a')).applications[0].stage,'accepted');assert.equal((await ok('/offers','hr')).offers[0].status,'accepted');
    await ok('/logout','candidate_a',{});assert.equal((await call('/applications','candidate_a')).status,401);assert.equal((await ok('/applications','candidate_b')).applications[0].id,b.id);
  }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));await db.close();}
});
