import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { Server } from 'node:http';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname, basename } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { initializeLocalRecruitment, localStore } from '../src/recruitment-local';
import { createRecruitmentRouter } from '../src/recruitment-api';
import { diskFileStorage, digest, MAX_FILE_BYTES, uploadEvidence, validateUpload, type FileStorage } from '../src/recruitment-files';
import { PREVIEW_IDENTITIES } from '../../shared/database';
import { withIdentity } from '../src/database-preview';

function samplePdf() {
  const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
  const stream='BT /F1 18 Tf 50 760 Td (TalentForecast - synthetic CV for local test) Tj ET';objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  let source='%PDF-1.4\n';const offsets=[0];
  objects.forEach((object,i)=>{offsets.push(Buffer.byteLength(source));source+=`${i+1} 0 obj\n${object}\nendobj\n`;});
  const xref=Buffer.byteLength(source);source+=`xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(source);
}
const pdf=samplePdf();
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
const bytesByPath=new Map<string,Buffer>();
const storage:FileStorage={async put(path,bytes){assert.equal(bytesByPath.has(path),false);bytesByPath.set(path,Buffer.from(bytes));},async get(path){const data=bytesByPath.get(path);if(!data)throw new Error('missing');return data;},async remove(path){bytesByPath.delete(path);}};
let db:PGlite,server:Server,base:string,origin:string,appA:string,fileId:string,objectPath:string;
const cookies:Record<string,string>={};
before(async()=>{
  db=new PGlite();await initializeLocalRecruitment(db);
  const candidate=await localStore('candidate_a',db),job=(await candidate.jobs())[0];
  const app=await candidate.apply({job_id:job.id,full_name:'Fake upload candidate',phone:'',major:'AI',gpa:3.5,gpa_scale:'4.0',graduation_year:2027,project_count:null,experience_months:null,skills:[],project_description:''});appA=app.id;
  const appServer=express();appServer.use('/api/recruitment',express.json({limit:'32kb'}),createRecruitmentRouter({local:true,database:async()=>db,storage,extract:async()=>({pages:[{page:1,text:'Name: Fake upload candidate\nSynthetic CV for testing',method:'pdf-text',confidence:null}],partial:false})}));
  server=await new Promise<Server>(resolveServer=>{const s=appServer.listen(0,'127.0.0.1',()=>resolveServer(s));});
  origin=`http://127.0.0.1:${(server.address() as {port:number}).port}`;base=origin+'/api/recruitment';
  for(const id of ['candidate_a','candidate_b','hr']){const r=await fetch(base+'/local-session',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({identity:id})});cookies[id]=r.headers.get('set-cookie')!.split(';')[0];await r.json();}
});
after(async()=>{await new Promise<void>(resolveServer=>server.close(()=>resolveServer()));await db.close();});
const headers=(id:string)=>({Origin:origin,...(cookies[id]?{Cookie:cookies[id]}:{})});
const upload=(identity:string,bytes:Buffer,name='CV thử.pdf',kind='cv')=>fetch(`${base}/applications/${appA}/files?kind=${kind}`,{method:'POST',headers:{...headers(identity),'Content-Type':'application/octet-stream','X-File-Name':encodeURIComponent(name)},body:new Uint8Array(bytes)});

test('upload computes hash/size/type on server, stores bytes privately and increments application revision',async()=>{
  const r=await upload('candidate_a',pdf);assert.equal(r.status,201);const {file}=await r.json();fileId=file.id;objectPath=file.object_path;
  assert.equal(file.mime_type,'application/pdf');assert.equal(file.sha256,digest(pdf));assert.equal(Number(file.byte_size),pdf.length);
  assert.equal(file.uploaded_by,PREVIEW_IDENTITIES.candidate_a.userId);assert.ok(objectPath.startsWith(`${file.uploaded_by}/${appA}/`));assert.equal(bytesByPath.size,1);
  const candidate=await localStore('candidate_a',db);assert.equal(Number((await candidate.application(appA))!.revision),2);
});
test('owner and HR can list/download exact bytes; another candidate and anonymous cannot',async()=>{
  for(const id of ['candidate_a','hr']){
    const list=await fetch(`${base}/applications/${appA}/files`,{headers:headers(id)});assert.equal(list.status,200);assert.equal((await list.json()).files.length,1);
    const content=await fetch(`${base}/files/${fileId}/content`,{headers:headers(id)});assert.equal(content.status,200);assert.deepEqual(Buffer.from(await content.arrayBuffer()),pdf);
    assert.equal(content.headers.get('cache-control'),'no-store');assert.equal(content.headers.get('x-content-type-options'),'nosniff');assert.match(content.headers.get('content-disposition')!,/^attachment;/);
  }
  assert.equal((await fetch(`${base}/applications/${appA}/files`,{headers:headers('candidate_b')})).status,404);
  assert.equal((await fetch(`${base}/files/${fileId}/content`,{headers:headers('candidate_b')})).status,404);
  assert.equal((await fetch(`${base}/files/${fileId}/content`)).status,401);
  assert.equal((await upload('candidate_b',pdf)).status,404);
  assert.equal((await upload('hr',pdf)).status,403);
  assert.equal((await upload('',pdf)).status,401);
});
test('rejects renamed executables/HTML, extension mismatches, images as CV, empty files, invalid names/kinds, and oversized bodies',async()=>{
  for(const [bytes,name,kind] of [[Buffer.from('<script>alert(1)</script>'),'cv.pdf','cv'],[pdf,'cv.exe','cv'],[png,'image.png','cv'],[Buffer.alloc(0),'empty.pdf','cv'],[pdf,'../cv.pdf','cv'],[pdf,'cv.pdf','unknown']] as const){const r=await upload('candidate_a',bytes,name,kind);assert.equal(r.status,400,`${name}: ${await r.text()}`);}
  const tooBig=await upload('candidate_a',Buffer.alloc(MAX_FILE_BYTES+1),'large.pdf');assert.equal(tooBig.status,413);assert.match((await tooBig.json()).error,/10 MiB/);
  assert.equal(bytesByPath.size,1);
});
test('new CV/evidence create separate immutable paths and keep old submissions readable',async()=>{
  assert.equal((await upload('candidate_a',png,'certificate.png','english')).status,201);
  const cv=await upload('candidate_a',pdf,'cv-new.pdf');assert.equal(cv.status,201);assert.notEqual((await cv.json()).file.object_path,objectPath);
  const old=await fetch(`${base}/files/${fileId}/content`,{headers:headers('hr')});assert.equal(old.status,200);assert.deepEqual(Buffer.from(await old.arrayBuffer()),pdf);
  assert.equal(bytesByPath.size,3);
});
test('tampered bytes are refused; invalid IDs never become filesystem paths',async()=>{
  bytesByPath.set(objectPath,Buffer.from('tampered'));
  assert.equal((await fetch(`${base}/files/${fileId}/content`,{headers:headers('hr')})).status,409);
  bytesByPath.set(objectPath,pdf);
  assert.equal((await fetch(`${base}/files/not-a-uuid/content`,{headers:headers('hr')})).status,400);
});
test('closed applicant stage prevents additional uploads and registration failures clean up unregistered bytes',async()=>{
  await db.query("update public.applications set stage='accepted' where id=$1",[appA]);
  assert.equal((await upload('candidate_a',pdf)).status,409);assert.equal(bytesByPath.size,3);
  await db.query("update public.applications set stage='applied' where id=$1",[appA]);
  const candidate=await localStore('candidate_a',db);
  await assert.rejects(uploadEvidence({...candidate,registerFile:async()=>{throw new Error('Metadata insert failed');}},storage,appA,pdf,'cv.pdf','cv'),/Metadata insert failed/);
  assert.equal(bytesByPath.size,3);
});
test('disk storage survives reopening, refuses traversal, and does not overwrite existing bytes',async()=>{
  const root=await mkdtemp(join(tmpdir(),'recruitment-files-test-'));
  const path=`${PREVIEW_IDENTITIES.candidate_a.userId}/${appA}/${randomUUID()}.pdf`;
  try{
    const first=diskFileStorage(root);await first.put(path,pdf,'application/pdf');
    assert.deepEqual(await diskFileStorage(root).get(path),pdf);
    await assert.rejects(first.put(path,Buffer.from('overwrite'),'application/pdf'),/EEXIST/);
    await assert.rejects(first.get('../../secret.pdf'),/Đường dẫn/);
  }finally{assert.equal(dirname(resolve(root)),resolve(tmpdir()));assert.ok(basename(root).startsWith('recruitment-files-test-'));await rm(root,{recursive:true,force:true});}
});
test('signature detection ignores declared client MIME and validates footer/extension',()=>{
  assert.equal(validateUpload(pdf,'cv.pdf','cv').mime,'application/pdf');
  assert.equal(validateUpload(png,'evidence.png','achievement').mime,'image/png');
  assert.throws(()=>validateUpload(pdf.subarray(0,30),'cv.pdf','cv'));
});

test('storage migration creates a private bucket and blocks direct client access even with a permissive existing policy',async()=>{
  // Minimal Supabase Storage catalog harness; the storage HTTP service is not mocked here.
  await db.exec(`create schema storage;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id text primary key,bucket_id text not null);
    alter table storage.objects enable row level security;
    grant usage on schema storage to anon,authenticated;
    grant select,insert,update,delete on storage.objects to anon,authenticated;
    create policy existing_permissive on storage.objects for all to anon,authenticated using(true) with check(true);`);
  await db.exec(await readFile(new URL('../database/migrations/202610180003_private_documents.sql',import.meta.url),'utf8'));
  const bucket=await db.query<{public:boolean;file_size_limit:number}>("select public,file_size_limit from storage.buckets where id='application-documents'");
  assert.equal(bucket.rows[0].public,false);assert.equal(Number(bucket.rows[0].file_size_limit),MAX_FILE_BYTES);
  await db.query("insert into storage.objects(id,bucket_id) values('private-file','application-documents'),('other-file','other-bucket')");
  for(const identity of ['anonymous','candidate_a','candidate_b','hr'] as const){
    const rows=await withIdentity(db,identity,tx=>tx.query<{id:string}>('select id from storage.objects'));
    assert.deepEqual(rows.rows.map(r=>r.id),['other-file']);
    await assert.rejects(withIdentity(db,identity,tx=>tx.query("insert into storage.objects(id,bucket_id) values('forged','application-documents')")),/row-level security/);
  }
});

test('check endpoints enforce file ownership, reject supplied results and expose stale results without changing application status',async()=>{
  const run=await fetch(`${base}/files/${fileId}/check`,{method:'POST',headers:{...headers('candidate_a'),'Content-Type':'application/json'},body:'{}'});
  assert.equal(run.status,200);const {check}=await run.json();assert.equal(check.result.status,'matched');assert.equal(check.result.issuer_verified,false);
  const other=await fetch(`${base}/files/${fileId}/check`,{headers:headers('candidate_b')});assert.equal(other.status,404);
  assert.equal((await fetch(`${base}/files/${fileId}/check`)).status,401);
  const forged=await fetch(`${base}/files/${fileId}/check`,{method:'POST',headers:{...headers('candidate_a'),'Content-Type':'application/json'},body:JSON.stringify({result:{issuer_verified:true}})});assert.equal(forged.status,400);
  await db.query('update public.applications set full_name=$1 where id=$2',['New claimant',appA]);
  const old=await fetch(`${base}/files/${fileId}/check`,{headers:headers('hr')});assert.equal((await old.json()).check.stale,true);
  assert.equal((await (await localStore('candidate_a',db)).application(appA))!.status,'pending');
});
