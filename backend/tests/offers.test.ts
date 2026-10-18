import test,{beforeEach,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import express from 'express';
import type {Server} from 'node:http';
import {initializeLocalRecruitment,localStore} from '../src/recruitment-local';
import {withIdentity} from '../src/database-preview';
import {createRecruitmentRouter} from '../src/recruitment-api';
import {validateOffer,validateOfferResponse} from '../src/offer-validation';
import {validateAnalyticsScope} from '../src/analytics-validation';
import type {RecruitmentStore} from '../src/recruitment-store';
import type {OfferInput} from '../../shared/recruitment';
let db:PGlite,hr:RecruitmentStore,a:RecruitmentStore,b:RecruitmentStore,id:string,jobId:string;
const weights={roundOne:30,coding:30,interview:40};
beforeEach(async()=>{
  db=new PGlite();await initializeLocalRecruitment(db);hr=await localStore('hr',db);a=await localStore('candidate_a',db);b=await localStore('candidate_b',db);
  jobId=(await hr.jobs())[0].id;await db.query('update public.jobs set requirements=$1,min_gpa=3 where id=$2',[['Python','SQL'],jobId]);
  id=(await a.apply({job_id:jobId,full_name:'Ứng viên thử offer',phone:'',major:'AI',gpa:4,gpa_scale:'4.0',graduation_year:2027,project_count:3,experience_months:6,skills:['Python','SQL'],project_description:''})).id;
  await hr.invite([id],{jobId,major:'all'});
  await hr.saveRoundTwo(id,{kind:'coding',expectedRevision:(await hr.roundTwo(id))!.revision,data:{score:90,notes:'Điểm thử'}});
  await hr.saveRoundTwo(id,{kind:'interview',expectedRevision:(await hr.roundTwo(id))!.revision,data:{scores:{technical:8,reasoning:8,learning:8,projects:8,communication:8},evidence:{technical:'a',reasoning:'a',learning:'a',projects:'a',communication:'a'}}});
  await decide();
});
afterEach(async()=>{await db.close();});
async function decide(result:'hire'|'reserve'|'reject'='hire'){
  const r=(await hr.hiringReport(id,weights))!;return hr.decide(id,{expectedBasis:r.basis,weights,result,reason:'Quyết định thử offer'});
}
async function input():Promise<OfferInput>{const r=(await hr.hiringReport(id,weights))!;return {expectedOfferId:(await hr.offers()).find(o=>o.application_id===id&&o.status==='pending')?.id??null,expectedDecisionId:r.history[0].id,expectedBasis:r.basis,positionTitle:'Thực tập sinh AI',startDate:'2026-11-02',content:'Đề nghị thử nghiệm trong ứng dụng; không gửi email.'};}
test('HR issues a public offer snapshot; candidate A reads only own terms without internal scoring, B reads none',async()=>{
  const request=await input(),offerId=await hr.issueOffer(id,request),own=await a.offers();
  assert.equal(own.length,1);assert.equal(own[0].id,offerId);assert.equal(own[0].content,request.content);assert.equal(own[0].start_date,'2026-11-02');assert.equal(own[0].actionable,true);assert.equal(own[0].issued_by,hr.user!.id);
  assert.equal('round_one_score' in own[0],false);assert.equal('source_basis' in own[0],false);assert.deepEqual(await b.offers(),[]);
  assert.equal(await b.visibleOffer(offerId),false);assert.equal((await hr.offers()).length,1);assert.equal((await a.application(id))!.stage,'offer');
  await assert.rejects(a.issueOffer(id,request),/HR access required/);
  await assert.rejects(b.respondOffer(offerId,{expectedRevision:1,outcome:'accepted',note:''}),/owner/);
  await assert.rejects(hr.respondOffer(offerId,{expectedRevision:1,outcome:'accepted',note:''}),/Candidate/);
});
test('acceptance is atomic, single-use and does not mean started work; decision history remains immutable',async()=>{
  const before=(await hr.hiringReport(id,weights))!.history[0],offerId=await hr.issueOffer(id,await input());
  await a.respondOffer(offerId,{expectedRevision:1,outcome:'accepted',note:'Đồng ý nhận offer thử'});
  const offer=(await a.offers())[0],app=(await a.application(id))!;assert.equal(offer.status,'accepted');assert.equal(offer.revision,2);assert.equal(offer.actionable,false);assert.equal(offer.responded_by,a.user!.id);assert.ok(offer.responded_at);assert.equal(app.stage,'accepted');assert.equal(app.status,'passed');
  await assert.rejects(a.respondOffer(offerId,{expectedRevision:2,outcome:'declined',note:'change'}),/Stale/);
  assert.deepEqual((await hr.hiringReport(id,weights))!.history[0],before);
  await initializeLocalRecruitment(db);assert.deepEqual((await a.offers())[0],offer);
});
test('declining keeps a distinct response and closes only that application; no HR rejection is fabricated',async()=>{
  const offerId=await hr.issueOffer(id,await input());await a.respondOffer(offerId,{expectedRevision:1,outcome:'declined',note:'Không phù hợp lịch học'});
  assert.equal((await a.offers())[0].status,'declined');assert.equal((await a.application(id))!.stage,'withdrawn');assert.equal((await a.application(id))!.status,'rejected');
  assert.equal((await hr.hiringReport(id,weights))!.history[0].result,'hire');await assert.rejects(hr.issueOffer(id,await input()),/Selected/);
});
test('replacement preserves history and detects concurrent publishing; old offer cannot be answered',async()=>{
  const original=await input(),first=await hr.issueOffer(id,original);
  await assert.rejects(hr.issueOffer(id,original),/Stale pending/);
  const updated={...await input(),content:'Bản đề nghị thay thế'};const next=await hr.issueOffer(id,updated);
  const all=await a.offers();assert.equal(all.length,2);assert.equal(all[0].id,next);assert.equal(all[0].status,'pending');assert.equal(all[1].id,first);assert.equal(all[1].status,'superseded');assert.equal(all[1].content,original.content);
  await assert.rejects(a.respondOffer(first,{expectedRevision:2,outcome:'accepted',note:''}),/Stale/);
});
test('changed basis or job blocks response; new hiring decision supersedes pending offers and requires fresh publication',async()=>{
  const offerId=await hr.issueOffer(id,await input());await db.query("update public.applications set phone='updated' where id=$1",[id]);
  assert.equal((await a.offers())[0].actionable,false);await assert.rejects(a.respondOffer(offerId,{expectedRevision:1,outcome:'accepted',note:''}),/Stale/);
  await assert.rejects(hr.issueOffer(id,await input()),/Stale offer decision/);
  await decide();assert.equal((await a.offers())[0].status,'superseded');
  const newId=await hr.issueOffer(id,await input());await db.query("update public.jobs set status='closed' where id=$1",[jobId]);
  assert.equal((await a.offers())[0].actionable,false);await assert.rejects(a.respondOffer(newId,{expectedRevision:1,outcome:'declined',note:''}),/Stale/);
});
test('two simultaneous responses commit once, raw writes cannot forge offers or response actors',async()=>{
  const offerId=await hr.issueOffer(id,await input());
  const results=await Promise.allSettled([a.respondOffer(offerId,{expectedRevision:1,outcome:'accepted',note:'A'}),a.respondOffer(offerId,{expectedRevision:1,outcome:'declined',note:'B'})]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal((await a.offers())[0].revision,2);
  for(const identity of ['candidate_a','candidate_b','hr'] as const)await assert.rejects(withIdentity(db,identity,tx=>tx.query("update public.recruitment_offers set status='pending',responded_by=null,responded_at=null where id=$1",[offerId])),/permission denied/);
});
test('strict input and SQL validation reject invalid terms, impossible dates and forged response fields without changing status',async()=>{
  const valid=await input();assert.deepEqual(validateOffer(valid),valid);
  for(const invalid of [{...valid,issued_by:'fake'},{...valid,startDate:'2026-02-31'},{...valid,content:' '},{...valid,positionTitle:''},{...valid,expectedOfferId:'fake'}])assert.throws(()=>validateOffer(invalid));
  for(const invalid of [{expectedRevision:0,outcome:'accepted'},{expectedRevision:1,outcome:'hire'},{expectedRevision:1,outcome:'accepted',responded_by:'fake'},{expectedRevision:1,outcome:'accepted',note:'x'.repeat(2001)}])assert.throws(()=>validateOfferResponse(invalid));
  const offerId=await hr.issueOffer(id,valid);await assert.rejects(a.respondOffer(offerId,{expectedRevision:1,outcome:'fake' as 'accepted',note:''}),/Invalid response/);assert.equal((await a.offers())[0].status,'pending');assert.equal((await a.application(id))!.stage,'offer');
});
test('HTTP issuance and response enforce A/B/HR roles, 404 for B, input checks and 409 after response',async()=>{
  const app=express();app.use('/api/recruitment',express.json(),createRecruitmentRouter({local:true,database:async()=>db}));
  const server=await new Promise<Server>(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});const origin=`http://127.0.0.1:${(server.address() as {port:number}).port}`,cookies:Record<string,string>={};
  const call=(path:string,who:string,body?:unknown)=>fetch(origin+'/api/recruitment'+path,{method:body===undefined?'GET':'POST',headers:{Origin:origin,...(cookies[who]?{Cookie:cookies[who]}:{}),...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})});
  try{
    for(const who of ['candidate_a','candidate_b','hr']){const r=await call('/local-session',who,{identity:who});cookies[who]=r.headers.get('set-cookie')!.split(';')[0];await r.json();}
    assert.equal((await call('/offers','')).status,401);const body=await input(),path=`/applications/${id}/offers`;
    const analytics='/analytics?month=2026-11&asOf=2026-10-18';
    assert.equal((await call(analytics,'')).status,401);assert.equal((await call(analytics,'candidate_a')).status,403);
    assert.equal((await call('/analytics?month=2026-11&asOf=2026-02-31','hr')).status,400);
    const report=await call(analytics,'hr');assert.equal(report.status,200);assert.equal((await report.json()).report.applications,1);
    assert.equal((await call(path,'candidate_a',body)).status,403);assert.equal((await call(path,'hr',{...body,issued_by:'fake'})).status,400);
    const issued=await call(path,'hr',body);assert.equal(issued.status,201);const offerId=(await issued.json()).id,reply={expectedRevision:1,outcome:'accepted',note:''};
    assert.equal((await call(`/offers/${offerId}/respond`,'candidate_b',reply)).status,404);assert.equal((await call(`/offers/${offerId}/respond`,'hr',reply)).status,403);
    assert.equal((await (await call('/offers','candidate_b')).json()).offers.length,0);
    assert.equal((await call(`/offers/${offerId}/respond`,'candidate_a',reply)).status,200);assert.equal((await call(`/offers/${offerId}/respond`,'candidate_a',reply)).status,409);
  }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));}
});

const scope={jobId:null,month:'2026-11',asOf:'2026-10-18'};
test('analytics counts milestones from records and never treats a hire decision as a pending offer',async()=>{
  const report=await hr.analytics(scope);
  assert.deepEqual(report.workflow,{applied:1,invited:1,evaluated:1,selected:1,issued:0,accepted:0});
  assert.equal(report.offers.pending,0);assert.equal(report.starts.expectedUpcoming,0);
  assert.equal(report.months.length,6);assert.equal(report.months[5].month,'2027-04');
  assert.ok(!JSON.stringify(report).includes('Ứng viên thử offer'));
  await assert.rejects(a.analytics(scope),/HR access required/);
  await assert.rejects(b.analytics(scope),/HR access required/);
  const blank=await hr.analytics({...scope,jobId:crypto.randomUUID()});assert.equal(blank.applications,0);assert.equal(blank.jobCount,0);assert.equal(blank.months[0].expected,0);
});
test('analytics counts latest offer once, preserves superseded history and excludes stale pending supply',async()=>{
  await hr.issueOffer(id,await input());await hr.issueOffer(id,await input());
  let report=await hr.analytics(scope);assert.equal(report.offers.pending,1);assert.equal(report.offers.supersededRecords,1);assert.equal(report.workflow.issued,1);
  assert.equal(report.starts.expectedPending,0.75);assert.equal(report.starts.expectedUpcoming,0.75);
  assert.equal(report.months[0].pending,1);assert.equal(report.jobs.find(j=>j.id===jobId)!.upcomingPending,1);
  await db.query("update public.applications set phone='changed' where id=$1",[id]);report=await hr.analytics(scope);
  assert.equal(report.offers.pending,0);assert.equal(report.offers.stalePending,1);assert.equal(report.starts.expectedUpcoming,0);
});
test('accepted offers supply their intended month only and past dates do not imply already working',async()=>{
  const offerId=await hr.issueOffer(id,await input());await a.respondOffer(offerId,{expectedRevision:1,outcome:'accepted',note:''});
  await db.query("update public.jobs set status='closed' where id=$1",[jobId]);
  let report=await hr.analytics({...scope,jobId});assert.equal(report.offers.accepted,1);assert.equal(report.offers.pending,0);assert.equal(report.starts.upcomingAccepted,1);assert.equal(report.starts.expectedUpcoming,1);
  report=await hr.analytics({...scope,asOf:'2026-11-02'});assert.equal(report.starts.upcomingAccepted,1);
  report=await hr.analytics({...scope,asOf:'2026-11-03'});assert.equal(report.starts.pastAccepted,1);assert.equal(report.starts.upcomingAccepted,0);assert.equal(report.months[0].expected,0);
  report=await hr.analytics({...scope,month:'2026-12'});assert.equal(report.starts.accepted,0);assert.equal(report.offers.accepted,1);
  await initializeLocalRecruitment(db);assert.equal((await hr.analytics(scope)).starts.upcomingAccepted,1);
});
test('declined and past pending offers never enter future supply',async()=>{
  const offerId=await hr.issueOffer(id,await input());
  let report=await hr.analytics({...scope,asOf:'2026-11-03'});assert.equal(report.starts.pastPending,1);assert.equal(report.starts.expectedUpcoming,0);
  await a.respondOffer(offerId,{expectedRevision:1,outcome:'declined',note:''});report=await hr.analytics(scope);
  assert.equal(report.offers.declined,1);assert.equal(report.offers.accepted,0);assert.equal(report.starts.expectedUpcoming,0);assert.equal(report.workflow.selected,1);
});
test('analytics totals include more than 200 applications and jobs without leaking candidate fields',async()=>{
  await db.query(`with inserted as (insert into public.jobs(title,department,created_by) select 'Bulk '||n,'AI',$1::uuid from generate_series(1,205) n returning id)
    insert into public.applications(job_id,applicant_id,full_name,contact_email,major,gpa,gpa_scale,graduation_year)
    select id,$2::uuid,'Bulk candidate','bulk@gm.uit.edu.vn','AI',4,'4.0',2027 from inserted`,[hr.user!.id,a.user!.id]);
  const report=await hr.analytics(scope);assert.equal(report.applications,206);assert.equal(report.workflow.applied,206);assert.equal(report.jobCount,207);assert.equal(report.jobs.length,200);
  assert.equal((await hr.analytics({...scope,jobId})).applications,1);assert.ok(!JSON.stringify(report).includes('contact_email'));
});
test('analytics validates calendar dates, query shapes, RPC permissions and December rollover',async()=>{
  assert.deepEqual(validateAnalyticsScope({month:'2026-12',asOf:'2026-10-18'}),{...scope,month:'2026-12'});
  for(const bad of [{month:'2026-13',asOf:'2026-10-18'},{month:'2026-11',asOf:'2026-02-31'},{month:'2026-11',asOf:'2026-10-18',jobId:['all']},{month:'2026-11',asOf:'2026-10-18',role:'hr'}])assert.throws(()=>validateAnalyticsScope(bad));
  await assert.rejects(withIdentity(db,'hr',tx=>tx.query("select public.recruitment_analytics(null,'2026-11-02','2026-10-18')")),/Invalid analytics dates/);
  await assert.rejects(withIdentity(db,'anonymous',tx=>tx.query("select public.recruitment_analytics(null,'2026-11-01','2026-10-18')")),/permission denied/);
  assert.deepEqual((await hr.analytics({...scope,month:'2026-12'})).months.map(m=>m.month),['2026-12','2027-01','2027-02','2027-03','2027-04','2027-05']);
});
