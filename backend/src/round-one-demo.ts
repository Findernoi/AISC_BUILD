import { randomUUID } from 'node:crypto';
import type { PGlite } from '@electric-sql/pglite';
import { PREVIEW_IDENTITIES } from '../../shared/database';

// Local fixtures only. No Supabase signup, real identity, outbound mail or reset.
export async function seedRoundOneDemo(db:PGlite) {
  return db.transaction(async tx=>{
    await tx.query("select pg_advisory_xact_lock(170018,1)");
    const existing=await tx.query<{id:string}>("select id from public.jobs where legacy_id='round-one-local-demo-v1'");
    if(existing.rows[0])return existing.rows[0].id;
    await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[PREVIEW_IDENTITIES.hr.userId]);
    const job=await tx.query<{id:string}>(`insert into public.jobs(legacy_id,title,department,description,requirements,min_gpa,created_by)
      values('round-one-local-demo-v1','Vị trí thử xếp hạng vòng 1','Backend','Dữ liệu giả để kiểm tra top 10 và lời mời; không tuyển người thật.',ARRAY['Python','SQL'],3.2,$1) returning id`,[PREVIEW_IDENTITIES.hr.userId]);
    const id=job.rows[0].id;
    for(let i=1;i<=12;i++){
      const user=randomUUID(),name=`Ứng viên giả lập vòng 1 - ${String(i).padStart(2,'0')}`,email=`round-one-local-${i}@gm.uit.edu.vn`;
      await tx.query('insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values($1,$2,now(),$3)',[user,email,JSON.stringify({full_name:name})]);
      await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[user]);
      await tx.query(`insert into public.applications(job_id,applicant_id,full_name,contact_email,major,gpa,gpa_scale,graduation_year,project_count,experience_months,skills)
        values($1,$2,$3,$4,'AI',4,'4.0',2027,3,6,ARRAY['Python','SQL'])`,[id,user,name,email]);
    }
    return id;
  });
}
