import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { request, type Server } from 'node:http';
import { PGlite } from '@electric-sql/pglite';
import { createRecruitmentRouter } from '../src/recruitment-api';
import { initializeLocalRecruitment, localStore } from '../src/recruitment-local';
import { validateApplication } from '../src/recruitment-validation';
import { PREVIEW_IDENTITIES } from '../../shared/database';
import { supabaseStore } from '../src/recruitment-store';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname, basename } from 'node:path';

let db:PGlite,server:Server,base:string,origin:string,jobId:string;
const cookies:Record<string,string>={};
before(async()=>{
  db=new PGlite();await initializeLocalRecruitment(db);
  const app=express();app.use('/api/recruitment',express.json({limit:'32kb'}),createRecruitmentRouter({local:true,database:async()=>db}));
  server=await new Promise<Server>(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
  origin=`http://127.0.0.1:${(server.address() as {port:number}).port}`;base=origin+'/api/recruitment';
});
after(async()=>{await new Promise<void>(resolve=>server?.close(()=>resolve()));await db?.close();});
async function call(path:string,identity='',body?:unknown,extra:Record<string,string>={}) {
  const response=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{Origin:origin,...(cookies[identity]?{Cookie:cookies[identity]}:{}),...(body===undefined?{}:{'Content-Type':'application/json'}),...extra},...(body===undefined?{}:{body:JSON.stringify(body)})});
  const cookie=response.headers.get('set-cookie');if(cookie)cookies[identity]=cookie.split(';')[0];
  return {status:response.status,data:await response.json()};
}
const input=()=>({job_id:jobId,full_name:'Ứng viên kiểm thử',phone:'',major:'AI',gpa:3.5,gpa_scale:'4.0',graduation_year:2027,project_count:0,experience_months:null,skills:['Python'],project_description:'Dự án thử API'});

test('anonymous can browse jobs but cannot read or submit applications',async()=>{
  const jobs=await call('/jobs');assert.equal(jobs.status,200);assert.equal(jobs.data.jobs.length,2);jobId=jobs.data.jobs[0].id;
  assert.equal((await call('/applications')).status,401);
  assert.equal((await call('/applications','',input())).status,401);
  assert.equal((await call('/session')).data.user,null);
});
test('local sign-in validates identity and request origin, and ignores forged headers',async()=>{
  assert.equal((await call('/local-session','',{identity:'admin'})).status,400);
  assert.equal((await call('/local-session','',{identity:'hr'},{Origin:'https://attacker.example'})).status,403);
  assert.equal((await call('/applications','',undefined,{'X-User-Id':PREVIEW_IDENTITIES.hr.userId!})).status,401);
  // Node fetch rewrites Host, so use an actual HTTP request to exercise rebinding protection.
  const invalidHostStatus=await new Promise<number>(resolveStatus=>{
    const req=request(base+'/jobs',{headers:{Host:'attacker.example'}},res=>{res.resume();resolveStatus(res.statusCode!);});
    req.end();
  });
  assert.equal(invalidHostStatus,403);
  for(const identity of ['candidate_a','candidate_b','hr'])assert.equal((await call('/local-session',identity,{identity})).status,200);
  assert.equal((await call('/session','candidate_a')).data.user.role,'candidate');
  assert.equal((await call('/session','hr')).data.user.role,'hr');
});
test('submit is persisted with server-owned identity/email and default stage; double submit conflicts',async()=>{
  const submitted=await call('/applications','candidate_a',input());assert.equal(submitted.status,201);
  assert.equal(submitted.data.application.project_count,0);assert.equal(submitted.data.application.experience_months,null);
  assert.equal(submitted.data.application.applicant_id,PREVIEW_IDENTITIES.candidate_a.userId);
  assert.equal(submitted.data.application.contact_email,'candidate_a-local-preview@gm.uit.edu.vn');
  assert.equal(submitted.data.application.status,'pending');
  assert.equal((await call('/applications','candidate_a',input())).status,409);
  for(const patch of [{applicant_id:PREVIEW_IDENTITIES.hr.userId},{contact_email:'other@gm.uit.edu.vn'},{stage:'offer'},{status:'passed'},{gpa:4.01},{project_count:-1},{gpa:'3.5'},{skills:['x'.repeat(81)]}]){
    assert.equal((await call('/applications','candidate_b',{...input(),...patch})).status,400);
  }
});
test('HR sees submissions; the other candidate cannot read them even by changing the URL query',async()=>{
  const a=await call('/applications','candidate_a');assert.equal(a.data.applications.length,1);
  const b=await call('/applications?applicant_id='+PREVIEW_IDENTITIES.candidate_a.userId,'candidate_b');assert.equal(b.data.applications.length,0);
  const hr=await call('/applications','hr');assert.equal(hr.data.applications.length,1);
  assert.equal(Object.hasOwn(hr.data.applications[0],'interview_evaluation'),false);
  assert.equal((await call('/applications','hr',input())).status,403);
});
test('only HR creates positions; closed and unconfirmed submissions remain blocked by RLS',async()=>{
  const job={title:'Vị trí API thử',department:'AI',description:'',location:'',min_gpa:3};
  assert.equal((await call('/jobs','candidate_a',job)).status,403);
  assert.equal((await call('/jobs','hr',job)).status,201);
  await db.query("update public.jobs set status='closed' where id=$1",[jobId]);
  assert.equal((await call('/applications','candidate_b',input())).status,403);
  await db.query("update public.jobs set status='active' where id=$1",[jobId]);
  await db.query('update auth.users set email_confirmed_at=null where id=$1',[PREVIEW_IDENTITIES.candidate_b.userId]);
  assert.equal((await call('/applications','candidate_b',input())).status,403);
});
test('logout revokes the old cookie and local session endpoints are absent in production configuration',async()=>{
  const oldCookie=cookies.candidate_a;
  assert.equal((await call('/logout','candidate_a',{})).status,200);
  cookies.candidate_a=oldCookie;
  assert.equal((await call('/applications','candidate_a')).status,401);
  const app=express();app.use(express.json(),createRecruitmentRouter({local:false}));
  const other=await new Promise<Server>(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
  try{const r=await fetch(`http://127.0.0.1:${(other.address() as {port:number}).port}/local-session`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({identity:'hr'})});assert.equal(r.status,404);}
  finally{await new Promise<void>(resolve=>other.close(()=>resolve()));}
});
test('validation preserves missing versus zero and checks GPA against its scale',()=>{
  assert.equal(validateApplication({...input(),project_count:null}).project_count,null);
  assert.equal(validateApplication({...input(),project_count:0}).project_count,0);
  assert.equal(validateApplication({...input(),gpa:9,gpa_scale:'10'}).gpa,9);
  assert.throws(()=>validateApplication({...input(),gpa:9,gpa_scale:'4.0'}));
});
test('local database survives close/reopen and initialization does not re-seed or overwrite submissions',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'recruitment-test-'));
  let persistent=new PGlite(directory);
  try{
    await initializeLocalRecruitment(persistent);
    const candidate=await localStore('candidate_a',persistent);
    const job=(await candidate.jobs())[0];
    const created=await candidate.apply({...input(),job_id:job.id,major:'AI',gpa_scale:'4.0'});
    await persistent.close();persistent=new PGlite(directory);await initializeLocalRecruitment(persistent);
    const restored=await localStore('candidate_a',persistent);
    assert.equal((await restored.applications())[0].id,created.id);
    assert.equal((await restored.jobs()).length,2);
  }finally{
    await persistent.close();
    assert.equal(dirname(resolve(directory)),resolve(tmpdir()));
    assert.ok(basename(directory).startsWith('recruitment-test-'));
    await rm(directory,{recursive:true,force:true});
  }
});

test('Supabase CRUD verifies the token with Auth, derives the role from SQL, and forwards only the user token and anon key',async()=>{
  const saved={url:process.env.SUPABASE_URL,key:process.env.SUPABASE_ANON_KEY,service:process.env.SUPABASE_SERVICE_ROLE_KEY};
  const originalFetch=globalThis.fetch;
  process.env.SUPABASE_URL='https://recruitment-test.supabase.co';process.env.SUPABASE_ANON_KEY='test-anon-key';process.env.SUPABASE_SERVICE_ROLE_KEY='must-never-be-used';
  const calls:Array<{url:string;authorization:string|null;key:string|null}>=[];
  globalThis.fetch=async(input,init)=>{
    const url=String(input);const headers=new Headers(init?.headers);
    calls.push({url,authorization:headers.get('Authorization'),key:headers.get('apikey')});
    if(headers.get('Authorization')==='Bearer invalid')return Response.json({message:'Invalid token'},{status:401});
    if(url.endsWith('/auth/v1/user'))return Response.json({id:PREVIEW_IDENTITIES.candidate_a.userId,email:'candidate_a-local-preview@gm.uit.edu.vn',email_confirmed_at:new Date().toISOString(),user_metadata:{role:'hr'}});
    if(url.includes('/rpc/recruitment_role'))return Response.json('candidate');
    if(url.includes('/rest/v1/jobs'))return Response.json([]);
    throw new Error('Unexpected mocked Auth/database request');
  };
  try{
    await assert.rejects(supabaseStore('invalid'),/hết hạn|không hợp lệ/);
    const store=await supabaseStore('verified-user-token');
    assert.equal(store.user?.role,'candidate'); // Signup metadata cannot promote this account.
    await store.jobs();
    assert.ok(calls.some(c=>c.url.endsWith('/auth/v1/user')));
    assert.ok(calls.some(c=>c.url.includes('/rpc/recruitment_role')));
    assert.ok(calls.every(c=>c.key==='test-anon-key'));
    assert.ok(calls.every(c=>c.authorization==='Bearer invalid'||c.authorization==='Bearer verified-user-token'));
  }finally{
    globalThis.fetch=originalFetch;
    const restore:Array<[string,string|undefined]>=[['SUPABASE_URL',saved.url],['SUPABASE_ANON_KEY',saved.key],['SUPABASE_SERVICE_ROLE_KEY',saved.service]];
    for(const [key,value] of restore){if(value===undefined)delete process.env[key];else process.env[key]=value;}
  }
});
