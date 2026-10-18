import { mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { AUTH_HARNESS, migrationUrl, withIdentity } from './database-preview';
import { PREVIEW_IDENTITIES, type PreviewIdentity } from '../../shared/database';
import { APPLICATION_COLUMNS, JOB_COLUMNS, type RecruitmentStore } from './recruitment-store';
import type { RecruitmentApplication, RecruitmentJob, RecruitmentFile, EvidenceCheck } from '../../shared/recruitment';

export const roleMigrationUrl=new URL('../database/migrations/202610180002_recruitment_role.sql',import.meta.url);
export async function initializeLocalRecruitment(db: PGlite) {
  const exists=await db.query<{relation:string|null}>(`select to_regclass('public.applications')::text as relation`);
  if (exists.rows[0].relation) {await ensureEvidenceMigration(db);return;}
  // Local-only bootstrap. Never run this harness against Supabase.
  const source=(await readFile(migrationUrl,'utf8'))+'\n'+(await readFile(roleMigrationUrl,'utf8'));
  await db.transaction(async tx=>{
    await tx.exec(AUTH_HARNESS);
    await tx.exec(source.replace(/^begin;\s*$/gmi,'').replace(/^commit;\s*$/gmi,''));
    for (const [identity,info] of Object.entries(PREVIEW_IDENTITIES)) {
      if(!info.userId)continue;
      await tx.query('insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values($1,$2,now(),$3)',
        [info.userId,`${identity}-local-preview@gm.uit.edu.vn`,JSON.stringify({full_name:info.label})]);
    }
    await tx.query("insert into private.staff_memberships(user_id,role) values($1,'hr')",[PREVIEW_IDENTITIES.hr.userId]);
    await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[PREVIEW_IDENTITIES.hr.userId]);
    await tx.exec('set local role authenticated');
    await tx.query(`insert into public.jobs(title,department,description,requirements,min_gpa) values
      ('Thực tập sinh AI','AI','Phát triển ứng dụng AI và xử lý dữ liệu. Vị trí mẫu để thử nộp hồ sơ.',ARRAY['Python','Machine Learning'],3.2),
      ('Thực tập sinh Backend','Backend','Xây dựng API và làm việc với cơ sở dữ liệu. Vị trí mẫu để thử nộp hồ sơ.',ARRAY['Node.js','SQL'],3.0)`);
  });
  await ensureEvidenceMigration(db);
}
async function ensureEvidenceMigration(db:PGlite) {
  const found=await db.query<{relation:string|null}>("select to_regclass('public.evidence_checks')::text as relation");
  if(found.rows[0].relation)return;
  await db.exec("do $$ begin if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if; end $$;");
  await db.exec(await readFile(new URL('../database/migrations/202610180004_evidence_checks.sql',import.meta.url),'utf8'));
}
let database: Promise<PGlite> | undefined;
export function localRecruitmentDatabase() {
  database ??= (async()=>{
    const directory=fileURLToPath(new URL('../../.local/recruitment/',import.meta.url));
    // Root .local is ignored; data stays on this machine across server restarts.
    await mkdir(directory,{recursive:true});
    const db=new PGlite(directory);
    try { await initializeLocalRecruitment(db); return db; }
    catch(error) { await db.close(); throw error; }
  })().catch(error=>{database=undefined;throw error;});
  return database;
}
export async function localStore(identity: PreviewIdentity, db: PGlite): Promise<RecruitmentStore> {
  const user=identity === 'anonymous' ? null : await withIdentity(db,identity,async tx=>{
    const r=await tx.query<{role:'hr'|'candidate'}>('select public.recruitment_role() as role');
    return {id:PREVIEW_IDENTITIES[identity].userId!,email:`${identity}-local-preview@gm.uit.edu.vn`,role:r.rows[0].role};
  });
  return {user,
    check:id=>withIdentity(db,identity,async tx=>(await tx.query<EvidenceCheck>('select * from public.evidence_checks where file_id=$1 order by created_at desc,id desc limit 1',[id])).rows[0]??null),
    saveCheck:async input=>{
      // Privileged insert only for server-produced, advisory extraction; caller already authorized the file through RLS.
      return (await db.query<EvidenceCheck>('insert into public.evidence_checks(file_id,application_id,file_sha256,claims_hash,created_by,result) values($1,$2,$3,$4,$5,$6) returning *',[input.file_id,input.application_id,input.file_sha256,input.claims_hash,input.created_by,JSON.stringify(input.result)])).rows[0];
    },
    application:id=>withIdentity(db,identity,async tx=>(await tx.query<RecruitmentApplication>(`select ${APPLICATION_COLUMNS} from public.applications where id=$1`,[id])).rows[0]??null),
    files:id=>withIdentity(db,identity,async tx=>(await tx.query<RecruitmentFile>('select * from public.application_files where application_id=$1 order by created_at desc,id limit 200',[id])).rows),
    file:id=>withIdentity(db,identity,async tx=>(await tx.query<RecruitmentFile>('select * from public.application_files where id=$1',[id])).rows[0]??null),
    registerFile:input=>withIdentity(db,identity,async tx=>{
      const keys=Object.keys(input);
      return (await tx.query<RecruitmentFile>(`insert into public.application_files(${keys.join(',')}) values(${keys.map((_,i)=>`$${i+1}`).join(',')}) returning *`,Object.values(input))).rows[0];
    }),
    jobs:()=>withIdentity(db,identity,async tx=>(await tx.query<RecruitmentJob>(`select ${JOB_COLUMNS} from public.jobs order by created_at desc,id limit 200`)).rows),
    applications:()=>withIdentity(db,identity,async tx=>(await tx.query<RecruitmentApplication>(`select ${APPLICATION_COLUMNS} from public.applications order by created_at desc,id limit 200`)).rows),
    apply:input=>withIdentity(db,identity,async tx=>{
      const row={...input,applicant_id:user!.id,contact_email:user!.email,university:'UIT'};
      const keys=Object.keys(row); // Keys are constructed by server validation, never raw request keys.
      const result=await tx.query<RecruitmentApplication>(`insert into public.applications(${keys.join(',')}) values(${keys.map((_,i)=>`$${i+1}`).join(',')}) returning ${APPLICATION_COLUMNS}`,Object.values(row));
      return result.rows[0];
    }),
    createJob:input=>withIdentity(db,identity,async tx=>{
      const result=await tx.query<RecruitmentJob>(`insert into public.jobs(title,department,description,location,min_gpa) values($1,$2,$3,$4,$5) returning ${JOB_COLUMNS}`,[input.title,input.department,input.description,input.location,input.min_gpa]);
      return result.rows[0];
    }),
  };
}
