import test,{beforeEach,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import express from 'express';
import type {Server} from 'node:http';
import {initializeLocalRecruitment,localStore} from '../src/recruitment-local';
import {seedRoundOneDemo} from '../src/round-one-demo';
import {withIdentity} from '../src/database-preview';
import {createRecruitmentRouter} from '../src/recruitment-api';
import {roundOneScore} from '../../frontend/src/lib/recruitment';
import type {Candidate,JobPosting} from '../../frontend/src/types';
import type {RecruitmentStore} from '../src/recruitment-store';
import type {RoundOneScope} from '../../shared/recruitment';
let db:PGlite,hr:RecruitmentStore,jobId:string;
const scope=():RoundOneScope=>({jobId,major:'all'});
beforeEach(async()=>{db=new PGlite();await initializeLocalRecruitment(db);jobId=await seedRoundOneDemo(db);hr=await localStore('hr',db);});
afterEach(async()=>{await db.close();});

test('server preserves rubric, deterministic top-ten cap and parity with existing frontend formula',async()=>{
  const report=await hr.roundOne(scope());assert.equal(report.total,12);assert.equal(report.qualified,12);assert.equal(report.rows.filter(r=>r.inTopTen).length,10);
  const ids=report.rows.map(r=>r.application.id);assert.deepEqual(ids,[...ids].sort());
  const legacy={gpa:4,gpaScale:'4.0',techBadges:['Python','SQL'],projectCount:3,experienceMonths:6,englishCert:{type:'None',score:''},achievementLevel:'none'} as Candidate;
  assert.equal(report.rows[0].score.total,roundOneScore(legacy,{requirements:['Python','SQL']} as JobPosting).total);
  assert.equal(report.rows[0].score.total,78);assert.equal(report.rows[0].rank,1);assert.equal(report.rows[11].inTopTen,false);
});
test('GPA scales, missing/zero counts, substring skill matching and integer-overflow inputs are handled consistently',async()=>{
  const id=(await hr.roundOne(scope())).rows[0].application.id;
  const variants=[{gpa:9,scale:'10',projects:2,experience:3,skills:['Python']},{gpa:3.6,scale:'4.0',projects:null,experience:null,skills:[]},{gpa:0,scale:'4.0',projects:0,experience:0,skills:['SQL']},{gpa:4,scale:'4.0',projects:2147483647,experience:2147483647,skills:['Python','SQL']}];
  for(const v of variants){
    await db.query('update public.applications set gpa=$1,gpa_scale=$2,project_count=$3,experience_months=$4,skills=$5 where id=$6',[v.gpa,v.scale,v.projects,v.experience,v.skills,id]);
    const row=(await hr.roundOne(scope())).rows.find(r=>r.application.id===id)!;
    const expected=roundOneScore({gpa:v.gpa,gpaScale:v.scale,projectCount:v.projects,experienceMonths:v.experience,techBadges:v.skills,englishCert:{type:'None',score:''}} as Candidate,{requirements:['Python','SQL']} as JobPosting);
    assert.equal(row.score.total,expected.total);
  }
});
test('job, major, GPA, rejected and withdrawn states produce explicit reasons and remain outside selection',async()=>{
  const first=(await hr.roundOne(scope())).rows[0].application.id;
  await db.query("update public.applications set major='KTPM',gpa=2 where id=$1",[first]);
  const ktpm=await hr.roundOne({jobId,major:'KTPM'});assert.equal(ktpm.total,1);assert.equal(ktpm.rows[0].inTopTen,false);assert.ok(ktpm.rows[0].reasons.some(r=>r.includes('GPA')));
  assert.equal((await hr.roundOne({jobId,major:'AI'})).total,11);
  await db.query("update public.applications set gpa=4,stage='withdrawn',status='rejected' where id=$1",[first]);
  const row=(await hr.roundOne(scope())).rows.find(r=>r.application.id===first)!;assert.equal(row.rank,null);assert.equal(row.reasons.length,2);
  await db.query("update public.jobs set status='closed' where id=$1",[jobId]);assert.equal((await hr.roundOne(scope())).qualified,0);
});
test('only HR can rank/invite; raw invitation inserts and caller supplied scores are not privileged',async()=>{
  const candidate=await localStore('candidate_a',db);await assert.rejects(candidate.roundOne(scope()),/HR access required/);
  const id=(await hr.roundOne(scope())).rows[0].application.id;
  await assert.rejects(candidate.invite([id],scope()),/HR access required/);
  await assert.rejects(withIdentity(db,'hr',tx=>tx.query('insert into public.interview_invitations(application_id,round_one_score) values($1,100)',[id])),/permission denied/);
  await assert.rejects(withIdentity(db,'candidate_a',tx=>tx.query('select private.round_one_score(a,j) from public.applications a join public.jobs j on j.id=a.job_id')),/permission denied/);
});
test('HR explicitly selects current top ten; snapshot and stage update are atomic and repeat invitations preserve the original',async()=>{
  const before=await hr.roundOne(scope()),ids=before.rows.slice(0,2).map(r=>r.application.id);
  const invitations=await hr.invite(ids,scope());assert.equal(invitations.length,2);assert.equal(Number(invitations[0].round_one_score),78);
  assert.equal(invitations[0].scope.applicationRevision,1);assert.equal(invitations[0].scope.version,'round-one-v2-evidence-exceptions');
  assert.equal((await hr.application(ids[0]))!.stage,'interview');assert.equal((await hr.application(ids[0]))!.status,'passed');
  const again=await hr.invite(ids,scope());assert.deepEqual(again,invitations);
  assert.equal((await hr.roundOne(scope())).rows.filter(r=>r.inTopTen).length,10);
  assert.equal((await hr.invitations()).length,2);
  await assert.rejects(hr.invite([before.rows[10].application.id],scope()),/outside current top ten/);
});
test('stale ranking or invalid selection rolls back the entire batch, including earlier valid IDs',async()=>{
  const report=await hr.roundOne(scope()),good=report.rows[0].application.id,changed=report.rows[1].application.id;
  await db.query('update public.applications set gpa=1 where id=$1',[changed]);
  await assert.rejects(hr.invite([good,changed],scope()),/outside current top ten/);
  assert.equal((await hr.invitations()).length,0);assert.equal((await hr.application(good))!.stage,'applied');
  await assert.rejects(hr.invite([good,good],scope()),/unique/);
});
test('legacy incomplete OCR never earns automatic points; existing manual conclusions stay bound to file and claims',async()=>{
  const id=(await hr.roundOne(scope())).rows[0].application.id,application=(await hr.application(id))!;
  const file=await db.query<{id:string}>(`insert into public.application_files(application_id,uploaded_by,kind,object_path,original_name,mime_type,byte_size,sha256,declared_fields)
    values($1,$2,'english',$3,'certificate.pdf','application/pdf',100,$4,$5) returning id`,[id,application.applicant_id,`${application.applicant_id}/${id}/${randomUUID()}.pdf`,'a'.repeat(64),JSON.stringify({credential:'IELTS',score:'8'})]);
  await db.query('insert into public.evidence_checks(file_id,application_id,file_sha256,claims_hash,created_by,result) values($1,$2,$3,$4,$5,$6)',[file.rows[0].id,id,'a'.repeat(64),'b'.repeat(64),application.applicant_id,JSON.stringify({status:'matched',issuer_verified:false,fields:[{key:'full_name',declared:application.full_name}]})]);
  let row=(await hr.roundOne(scope())).rows.find(r=>r.application.id===id)!;assert.equal(row.score.contributions.find(c=>c.key==='english')!.value,0);
  await db.query("insert into public.evidence_reviews(file_id,application_id,file_sha256,status,reference,reviewed_by) values($1,$2,$3,'verified','Manual test source',$4)",[file.rows[0].id,id,'a'.repeat(64),hr.user!.id]);
  row=(await hr.roundOne(scope())).rows.find(r=>r.application.id===id)!;assert.ok(Number(row.score.contributions.find(c=>c.key==='english')!.value)>0);
  await db.query('update public.applications set full_name=$1 where id=$2',['Changed name',id]);
  row=(await hr.roundOne(scope())).rows.find(r=>r.application.id===id)!;assert.equal(row.score.contributions.find(c=>c.key==='english')!.value,0);assert.ok(row.score.evidenceAlerts>0);
  await db.query('update public.applications set full_name=$1 where id=$2',[application.full_name,id]);
  const latest=await db.query<{id:string}>(`insert into public.application_files(application_id,uploaded_by,kind,object_path,original_name,mime_type,byte_size,sha256,declared_fields)
    values($1,$2,'english',$3,'replacement.pdf','application/pdf',100,$4,$5) returning id`,[id,application.applicant_id,`${application.applicant_id}/${id}/${randomUUID()}.pdf`,'c'.repeat(64),JSON.stringify({credential:'IELTS',score:'9'})]);
  row=(await hr.roundOne(scope())).rows.find(r=>r.application.id===id)!;assert.equal(row.score.contributions.find(c=>c.key==='english')!.value,0);
  const achievement=await db.query<{id:string}>(`insert into public.application_files(application_id,uploaded_by,kind,object_path,original_name,mime_type,byte_size,sha256,declared_fields)
    values($1,$2,'achievement',$3,'award.pdf','application/pdf',100,$4,$5) returning id`,[id,application.applicant_id,`${application.applicant_id}/${id}/${randomUUID()}.pdf`,'d'.repeat(64),JSON.stringify({title:'Test award',issuer:'Test source',level:'international'})]);
  for(const [proofId,hash] of [[latest.rows[0].id,'c'.repeat(64)],[achievement.rows[0].id,'d'.repeat(64)]])await db.query("insert into public.evidence_reviews(file_id,application_id,file_sha256,status,reference,reviewed_by) values($1,$2,$3,'verified','Existing manual fixture',$4)",[proofId,id,hash,hr.user!.id]);
  row=(await hr.roundOne(scope())).rows.find(r=>r.application.id===id)!;assert.equal(row.score.contributions.find(c=>c.key==='achievement')!.value,10);assert.equal(row.score.total,100);
});
test('ranking computes over the entire pool instead of only the newest 200 applications',async()=>{
  await db.query(`insert into auth.users(id,email,email_confirmed_at) select gen_random_uuid(),'bulk-round-one-'||n||'@gm.uit.edu.vn',now() from generate_series(1,221) n`);
  await db.query(`insert into public.applications(job_id,applicant_id,full_name,contact_email,major,gpa,gpa_scale,graduation_year) select $1,id,'Low score bulk fixture',email,'AI',1,'4.0',2027 from auth.users where email like 'bulk-round-one-%'`,[jobId]);
  const report=await hr.roundOne(scope());assert.equal(report.total,233);assert.equal(report.rows.length,200);assert.equal(report.qualified,12);assert.equal(report.rows.filter(r=>r.inTopTen).length,10);
});
test('HTTP routes enforce HR role and reject forged scores; candidates can read only their own invitations',async()=>{
  const app=express();app.use('/api/recruitment',express.json(),createRecruitmentRouter({local:true,database:async()=>db}));
  const server=await new Promise<Server>(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
  const origin=`http://127.0.0.1:${(server.address() as {port:number}).port}`,base=origin+'/api/recruitment';
  const cookies:Record<string,string>={};
  const call=async(path:string,identity:string,body?:unknown)=>fetch(base+path,{method:body===undefined?'GET':'POST',headers:{Origin:origin,...(cookies[identity]?{Cookie:cookies[identity]}:{}),...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})});
  try{
    for(const identity of ['candidate_a','candidate_b','hr']){const r=await call('/local-session',identity,{identity});cookies[identity]=r.headers.get('set-cookie')!.split(';')[0];await r.json();}
    assert.equal((await call('/round-one','candidate_a')).status,403);assert.equal((await call('/round-one','')).status,401);
    const ids=(await hr.roundOne(scope())).rows.slice(0,1).map(r=>r.application.id);
    assert.equal((await call('/round-one/invitations','hr',{applicationIds:ids,jobId,major:'all',round_one_score:100})).status,400);
    assert.equal((await call('/round-one/invitations','candidate_a',{applicationIds:ids,jobId})).status,403);
    assert.equal((await call('/round-one/invitations','hr',{applicationIds:ids,jobId})).status,200);
    assert.equal((await (await call('/invitations','candidate_b')).json()).invitations.length,0);
    const candidate=await localStore('candidate_a',db);
    const own=await candidate.apply({job_id:jobId,full_name:'Own invitation test',phone:'',major:'AI',gpa:4,gpa_scale:'4.0',graduation_year:2027,project_count:3,experience_months:6,skills:['Python','SQL'],project_description:''});
    await db.query('update public.applications set gpa=3.7 where job_id=$1 and id<>$2',[jobId,own.id]);
    await hr.invite([own.id],scope());
    assert.equal((await (await call('/invitations','candidate_a')).json()).invitations[0].application_id,own.id);
  }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
