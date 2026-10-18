import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { DATABASE_TABLES, PREVIEW_IDENTITIES, type DatabasePreview, type PreviewIdentity } from '../../shared/database';

export const MIGRATION = '202610180001_recruitment.sql';
export const migrationUrl = new URL(`../database/migrations/${MIGRATION}`, import.meta.url);

// Test harness only. Supabase supplies auth.users/auth.uid()/roles in production.
export const AUTH_HARNESS = `
  create role anon nologin;
  create role authenticated nologin;
  create schema auth;
  create table auth.users (
    id uuid primary key, email text unique not null, email_confirmed_at timestamptz,
    raw_user_meta_data jsonb not null default '{}'
  );
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
  grant usage on schema auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
`;

export async function createPreviewDatabase(seed = true) {
  const db = new PGlite();
  await db.exec(AUTH_HARNESS);
  await db.exec(await readFile(migrationUrl, 'utf8'));
  if (seed) await seedPreview(db);
  return db;
}

export async function withIdentity<T>(db: PGlite, identity: PreviewIdentity, operation: (tx: Parameters<Parameters<PGlite['transaction']>[0]>[0]) => Promise<T>): Promise<T> {
  return db.transaction(async tx => {
    await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [PREVIEW_IDENTITIES[identity].userId ?? '']);
    await tx.exec(`set local role ${identity === 'anonymous' ? 'anon' : 'authenticated'}`);
    return operation(tx);
  });
}

export const SAMPLE_JOB = '20000000-0000-4000-8000-000000000001';
export const SAMPLE_CLOSED_JOB = '20000000-0000-4000-8000-000000000002';
export const SAMPLE_APP_A = '30000000-0000-4000-8000-000000000001';
export const SAMPLE_APP_B = '30000000-0000-4000-8000-000000000002';

async function seedPreview(db: PGlite) {
  for (const [identity, details] of Object.entries(PREVIEW_IDENTITIES)) {
    if (!details.userId) continue;
    await db.query(`insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values($1,$2,now(),$3)`,
      [details.userId, `${identity}-local-preview@gm.uit.edu.vn`, JSON.stringify({ full_name: details.label, role: identity === 'hr' ? 'hr' : 'candidate' })]);
  }
  await db.query(`insert into private.staff_memberships(user_id,role) values($1,'hr')`,[PREVIEW_IDENTITIES.hr.userId]);
  await db.query(`insert into public.jobs(id,title,department,status,min_gpa,created_by) values
    ($1,'Vị trí mẫu đang mở','AI','active',3.2,$3),($2,'Vị trí mẫu đã đóng','Backend','closed',3,$3)`,
    [SAMPLE_JOB,SAMPLE_CLOSED_JOB,PREVIEW_IDENTITIES.hr.userId]);
  for (const [id,identity] of [[SAMPLE_APP_A,'candidate_a'],[SAMPLE_APP_B,'candidate_b']] as const) {
    await db.query(`insert into public.applications(id,job_id,applicant_id,full_name,contact_email,major,gpa,gpa_scale,graduation_year,project_count)
      values($1,$2,$3,$4,$5,'AI',3.5,'4.0',2027,2)`,
      [id,SAMPLE_JOB,PREVIEW_IDENTITIES[identity].userId,PREVIEW_IDENTITIES[identity].label,`${identity}-local-preview@gm.uit.edu.vn`]);
  }
  await withIdentity(db,'hr',async tx => {
    await tx.query(`insert into public.interview_invitations(application_id,round_one_score) values($1,85)`,[SAMPLE_APP_A]);
    await tx.query(`update public.applications set stage='interview',status='passed' where id=$1`,[SAMPLE_APP_A]);
    await tx.query(`insert into public.coding_evaluations(application_id,score,notes) values($1,0,'Dữ liệu mẫu: điểm 0 hợp lệ')`,[SAMPLE_APP_A]);
    await tx.query(`insert into public.interview_evaluations(application_id,technical,reasoning,learning,projects,communication,evidence)
      values($1,8,8,8,8,8,$2)`,[SAMPLE_APP_A,JSON.stringify({technical:'Mẫu',reasoning:'Mẫu',learning:'Mẫu',projects:'Mẫu',communication:'Mẫu'})]);
    const decision = await tx.query<{id:string}>(`insert into public.hiring_decisions(application_id,result,reason,round_one_score)
      values($1,'reserve','Ví dụ quyết định dự phòng; không tuyển ứng viên thật',85) returning id`,[SAMPLE_APP_A]);
    await tx.query(`insert into public.email_outbox(application_id,decision_id,recipient,subject,body)
      values($1,$2,'candidate_a-local-preview@gm.uit.edu.vn','Thư nháp mẫu','Dữ liệu kiểm thử; không có email thật được gửi.')`,[SAMPLE_APP_A,decision.rows[0].id]);
  });
}

let instance: Promise<PGlite> | undefined;
export function localPreviewDatabase() {
  instance ??= createPreviewDatabase().catch(error => { instance = undefined; throw error; });
  return instance;
}

export async function readDatabasePreview(identity: PreviewIdentity, suppliedDatabase?: PGlite): Promise<DatabasePreview> {
  const db = suppliedDatabase ?? await localPreviewDatabase();
  const metadata: Array<Omit<DatabasePreview['tables'][number], 'visibleCount' | 'samples'>> = [];
  for (const definition of DATABASE_TABLES) {
    const columns = await db.query<{name:string;type:string;nullable:boolean;generated:boolean}>(`
      select column_name as name, data_type as type, is_nullable='YES' as nullable, is_generated='ALWAYS' as generated
      from information_schema.columns where table_schema='public' and table_name=$1 order by ordinal_position`,[definition.name]);
    const policies = await db.query<{name:string;command:string;roles:string[]}>(`
      select policyname as name, cmd as command, roles from pg_policies where schemaname='public' and tablename=$1`,[definition.name]);
    const rls = await db.query<{enabled:boolean}>(`select relrowsecurity as enabled from pg_class where oid=$1::regclass`,[`public.${definition.name}`]);
    metadata.push({...definition,columns:columns.rows,policies:policies.rows,rls:rls.rows[0].enabled});
  }
  const tables = await withIdentity(db,identity,async tx => {
    const result: DatabasePreview['tables'] = [];
    for (const entry of metadata) {
      const permission = await tx.query<{allowed:boolean}>(`select has_table_privilege(current_user,$1,'select') as allowed`,[`public.${entry.name}`]);
      if (!permission.rows[0].allowed) { result.push({...entry,visibleCount:null,samples:[]}); continue; }
      // Identifiers come exclusively from the checked-in allowlist, never from the request.
      const count = await tx.query<{count:number}>(`select count(*)::int as count from public.${entry.name}`);
      const samples = await tx.query<Record<string, unknown>>(`select * from public.${entry.name} limit 3`);
      result.push({...entry,visibleCount:count.rows[0].count,samples:samples.rows});
    }
    return result;
  });
  return {engine:'PostgreSQL cục bộ qua PGlite',migration:MIGRATION,identity,persistent:Boolean(suppliedDatabase),cloudModified:false,tables};
}
