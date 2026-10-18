import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { DATABASE_TABLES, PREVIEW_IDENTITIES, type PreviewIdentity } from '../../shared/database';
import { createPreviewDatabase, withIdentity, SAMPLE_APP_A, SAMPLE_APP_B, SAMPLE_JOB, SAMPLE_CLOSED_JOB } from '../src/database-preview';

let db: PGlite;
before(async () => { db = await createPreviewDatabase(); });
after(async () => { await db?.close(); });
const rollback = new Error('ROLLBACK_TEST');
async function isolated(identity: PreviewIdentity, fn: Parameters<typeof withIdentity>[2]) {
  try { await withIdentity(db,identity,async tx => { await fn(tx); throw rollback; }); }
  catch (error) { if (error !== rollback) throw error; }
}
const fields = 'job_id,full_name,contact_email,major,gpa,gpa_scale,graduation_year';

test('migration creates every planned public table with RLS and preserves an isolated staff-role store', async () => {
  const rows = await db.query<{relname:string;relrowsecurity:boolean}>(`select relname,relrowsecurity from pg_class where relnamespace='public'::regnamespace and relkind='r'`);
  for (const table of DATABASE_TABLES) assert.equal(rows.rows.find(r=>r.relname===table.name)?.relrowsecurity,true,table.name);
  const cols = await db.query(`select column_name from information_schema.columns where table_name='profiles' and column_name='role'`);
  assert.equal(cols.rows.length,0);
  await assert.rejects(withIdentity(db,'candidate_a',tx=>tx.query('select * from private.staff_memberships')),/permission denied/);
});

test('anonymous sees only open jobs and cannot read applicant data', async () => {
  const jobs=await withIdentity(db,'anonymous',tx=>tx.query<{id:string}>('select id from public.jobs'));
  assert.deepEqual(jobs.rows.map(r=>r.id),[SAMPLE_JOB]);
  await assert.rejects(withIdentity(db,'anonymous',tx=>tx.query('select * from public.applications')),/permission denied/);
});

test('two candidates see only their own applications; HR sees both and concurrent identity scopes stay isolated', async () => {
  const results=await Promise.all((['candidate_a','candidate_b','hr'] as const).map(id=>withIdentity(db,id,tx=>tx.query<{id:string}>('select id from public.applications order by id'))));
  assert.deepEqual(results[0].rows.map(r=>r.id),[SAMPLE_APP_A]);
  assert.deepEqual(results[1].rows.map(r=>r.id),[SAMPLE_APP_B]);
  assert.equal(results[2].rows.length,2);
});

test('profile edits cannot become HR privileges or change another account', async () => {
  await isolated('candidate_a',async tx=>{
    const changed=await tx.query(`update public.profiles set display_name='Không được sửa' where id=$1 returning id`,[PREVIEW_IDENTITIES.candidate_b.userId]);
    assert.equal(changed.rows.length,0);
    const own=await tx.query(`update public.profiles set display_name='Tên mẫu mới' where id=$1 returning display_name`,[PREVIEW_IDENTITIES.candidate_a.userId]);
    assert.equal(own.rows.length,1);
  });
  const id='10000000-0000-4000-8000-000000000004';
  await db.query(`insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values($1,'metadata-hr-local@gm.uit.edu.vn',now(),'{"role":"admin"}')`,[id]);
  await db.transaction(async tx=>{
    await tx.query(`select set_config('request.jwt.claim.sub',$1,true)`,[id]);
    await tx.exec('set local role authenticated');
    assert.equal((await tx.query<{allowed:boolean}>('select private.is_hr() as allowed')).rows[0].allowed,false);
  });
});

test('candidate cannot forge workflow state, another owner, reviewer scores, or an email identity', async () => {
  await assert.rejects(withIdentity(db,'candidate_a',tx=>tx.query(`insert into public.applications(${fields},stage) values($1,'Mẫu','candidate_a-local-preview@gm.uit.edu.vn','AI',3.5,'4.0',2027,'offer')`,[SAMPLE_JOB])),/permission denied/);
  await assert.rejects(withIdentity(db,'candidate_a',tx=>tx.query(`insert into public.applications(${fields},applicant_id) values($1,'Mẫu','candidate_a-local-preview@gm.uit.edu.vn','AI',3.5,'4.0',2027,$2)`,[SAMPLE_JOB,PREVIEW_IDENTITIES.candidate_b.userId])),/row-level security/);
  await assert.rejects(withIdentity(db,'candidate_a',tx=>tx.query(`insert into public.applications(${fields}) values($1,'Mẫu','other-local@gm.uit.edu.vn','AI',3.5,'4.0',2027)`,[SAMPLE_JOB])),/row-level security/);
  await assert.rejects(withIdentity(db,'candidate_a',tx=>tx.query(`insert into public.coding_evaluations(application_id,score) values($1,100)`,[SAMPLE_APP_B])),/row-level security/);
  await isolated('candidate_a',async tx=>{
    assert.equal((await tx.query(`update public.applications set stage='accepted' where id=$1 returning id`,[SAMPLE_APP_A])).rows.length,0);
  });
});

test('unconfirmed UIT email and closed positions cannot create applications', async () => {
  await db.query(`update auth.users set email_confirmed_at=null where id=$1`,[PREVIEW_IDENTITIES.candidate_b.userId]);
  try {
    await assert.rejects(withIdentity(db,'candidate_b',tx=>tx.query(`insert into public.applications(${fields}) values($1,'Mẫu','candidate_b-local-preview@gm.uit.edu.vn','AI',3.5,'4.0',2027)`,[SAMPLE_JOB])),/row-level security/);
  } finally { await db.query(`update auth.users set email_confirmed_at=now() where id=$1`,[PREVIEW_IDENTITIES.candidate_b.userId]); }
  await assert.rejects(withIdentity(db,'candidate_b',tx=>tx.query(`insert into public.applications(${fields}) values($1,'Mẫu','candidate_b-local-preview@gm.uit.edu.vn','AI',3.5,'4.0',2027)`,[SAMPLE_CLOSED_JOB])),/row-level security/);
  await assert.rejects(withIdentity(db,'candidate_b',tx=>tx.query(`insert into public.applications(${fields}) values($1,'Mẫu','candidate_b-local-preview@gm.uit.edu.vn','AI',3.5,'4.0',2027)`,[SAMPLE_JOB])),/unique constraint/);
});

test('GPA scale and numeric interview limits are enforced by PostgreSQL', async () => {
  await assert.rejects(withIdentity(db,'hr',tx=>tx.query(`update public.applications set gpa=5 where id=$1`,[SAMPLE_APP_A])),/check constraint/);
  await assert.rejects(withIdentity(db,'hr',tx=>tx.query(`update public.interview_evaluations set technical=0 where application_id=$1`,[SAMPLE_APP_A])),/check constraint/);
  await assert.rejects(withIdentity(db,'hr',tx=>tx.query(`update public.interview_evaluations set evidence='{}' where application_id=$1`,[SAMPLE_APP_A])),/check constraint/);
  await assert.rejects(withIdentity(db,'hr',tx=>tx.query(`update public.coding_evaluations set score=101 where application_id=$1`,[SAMPLE_APP_A])),/check constraint/);
});

test('HR cannot invite an applicant below the job GPA or impersonate another reviewer', async () => {
  await isolated('hr',async tx=>{
    await tx.query(`update public.applications set gpa=2 where id=$1`,[SAMPLE_APP_B]);
    await assert.rejects(tx.query(`insert into public.interview_invitations(application_id,round_one_score) values($1,85)`,[SAMPLE_APP_B]),/not eligible/);
  });
  await assert.rejects(withIdentity(db,'hr',tx=>tx.query(`update public.coding_evaluations set reviewed_by=$1 where application_id=$2`,[PREVIEW_IDENTITIES.candidate_b.userId,SAMPLE_APP_A])),/row-level security/);
});

test('coding zero is valid; interview and final score are computed from stored evaluations', async () => {
  await isolated('hr',async tx=>{
    const coding=await tx.query<{score:string}>(`select score from public.coding_evaluations where application_id=$1`,[SAMPLE_APP_A]);
    assert.equal(Number(coding.rows[0].score),0);
    const result=await tx.query<{final_score:string;coding_score:string;interview_score:string}>(`insert into public.hiring_decisions(application_id,result,reason,round_one_score)
      values($1,'reserve','Thử nghiệm mẫu',85) returning final_score,coding_score,interview_score`,[SAMPLE_APP_A]);
    assert.equal(Number(result.rows[0].interview_score),80);
    assert.equal(Number(result.rows[0].coding_score),0);
    assert.equal(Number(result.rows[0].final_score),57.5);
  });
  await assert.rejects(withIdentity(db,'hr',tx=>tx.query(`insert into public.hiring_decisions(application_id,result,reason,round_one_score,interview_weight) values($1,'reserve','Mẫu',85,50)`,[SAMPLE_APP_A])),/check constraint/);
  await assert.rejects(withIdentity(db,'hr',tx=>tx.query(`insert into public.hiring_decisions(application_id,result,reason,round_one_score) values($1,'hire','Mẫu',85)`,[SAMPLE_APP_B])),/interview or offer|evaluations are required/);
});

test('file metadata belongs to the authenticated owner and SHA ties reviews to an exact file', async () => {
  const path=`${PREVIEW_IDENTITIES.candidate_a.userId}/${SAMPLE_APP_A}/cv-local.pdf`;
  await isolated('candidate_a',async tx=>{
    const result=await tx.query(`insert into public.application_files(application_id,kind,object_path,original_name,mime_type,byte_size,sha256)
      values($1,'cv',$2,'cv-local.pdf','application/pdf',1000,$3) returning id`,[SAMPLE_APP_A,path,'a'.repeat(64)]);
    assert.equal(result.rows.length,1);
  });
  await assert.rejects(withIdentity(db,'candidate_b',tx=>tx.query(`insert into public.application_files(application_id,kind,object_path,original_name,mime_type,byte_size,sha256)
      values($1,'cv',$2,'cv-local.pdf','application/pdf',1000,$3)`,[SAMPLE_APP_A,path,'a'.repeat(64)])),/row-level security/);
  await assert.rejects(withIdentity(db,'candidate_a',tx=>tx.query(`insert into public.application_files(application_id,kind,object_path,original_name,mime_type,byte_size,sha256)
      values($1,'cv',$2,'cv-local.png','image/png',1000,$3)`,[SAMPLE_APP_A,path,'a'.repeat(64)])),/check constraint/);
});

test('internal scores, decision drafts and audit events are hidden from applicants', async () => {
  await isolated('candidate_a',async tx=>{
    for (const name of ['coding_evaluations','interview_evaluations','hiring_decisions','email_outbox','audit_events']) {
      assert.equal((await tx.query(`select * from public.${name}`)).rows.length,0,name);
    }
    assert.equal((await tx.query('select * from public.interview_invitations')).rows.length,1);
  });
  await assert.rejects(withIdentity(db,'hr',tx=>tx.query('delete from public.audit_events')),/permission denied/);
  await assert.rejects(withIdentity(db,'hr',tx=>tx.query('delete from public.hiring_decisions')),/permission denied/);
});

test('evidence approval cannot be transferred to a different file hash', async () => {
  try {
    await db.transaction(async tx=>{
      const file='40000000-0000-4000-8000-000000000001';
      await tx.query(`insert into public.application_files(id,application_id,uploaded_by,kind,object_path,original_name,mime_type,byte_size,sha256)
        values($1,$2,$3,'english',$4,'english-local.pdf','application/pdf',1000,$5)`,
        [file,SAMPLE_APP_A,PREVIEW_IDENTITIES.candidate_a.userId,`${PREVIEW_IDENTITIES.candidate_a.userId}/${SAMPLE_APP_A}/english-local.pdf`,'a'.repeat(64)]);
      await tx.query(`select set_config('request.jwt.claim.sub',$1,true)`,[PREVIEW_IDENTITIES.hr.userId]);
      await tx.exec('set local role authenticated');
      await assert.rejects(tx.query(`insert into public.evidence_reviews(file_id,application_id,file_sha256,status,reference)
        values($1,$2,$3,'verified','Nguồn mẫu')`,[file,SAMPLE_APP_A,'b'.repeat(64)]),/foreign key constraint/);
      throw rollback;
    });
  } catch(error) { if(error !== rollback) throw error; }
  await assert.rejects(withIdentity(db,'candidate_a',tx=>tx.query(`insert into public.evidence_reviews(file_id,application_id,file_sha256,status,reference)
    values('40000000-0000-4000-8000-000000000001',$1,$2,'verified','Tự duyệt')`,[SAMPLE_APP_A,'a'.repeat(64)])),/row-level security/);
});

test('email cannot be redirected or queued from a stale decision after scores change', async () => {
  await assert.rejects(withIdentity(db,'hr',tx=>tx.query(`update public.email_outbox set recipient='other-local@gm.uit.edu.vn'`)),/recipient does not match/);
  await isolated('hr',async tx=>{
    await tx.query(`update public.email_outbox set status='queued'`);
    await tx.query(`update public.coding_evaluations set score=90 where application_id=$1`,[SAMPLE_APP_A]);
    await assert.rejects(tx.query(`update public.email_outbox set status='queued'`),/Decision is stale/);
  });
  await assert.rejects(withIdentity(db,'hr',tx=>tx.query(`update public.email_outbox set status='sent',sent_at=now()`)),/permission denied/);
});
